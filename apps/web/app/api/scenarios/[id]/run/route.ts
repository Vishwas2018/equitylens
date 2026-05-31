import {
  FixedClock,
  computeCGT,
  defaultRulesetAdapter,
  outputHash,
  runScenario,
} from '@equitylens/engine';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getApiSession, notFound, unauthorised } from '../../../../../server/auth/api-guard';
import { getRlsAwareClient, getSupabaseAdmin } from '../../../../../server/db/client';

const FINANCIAL_YEAR = 'FY2026';

// Cents in JSONB are stored as decimal strings (no BigInt in JSON).
const CentsBigInt = z
  .string()
  .regex(/^\d+$/, 'Must be a non-negative integer string')
  .transform(BigInt);

const DisposalInputSchema = z.object({
  acquisitionDateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  disposalDateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  grossProceedsCents: CentsBigInt,
  sellingCostsCents: CentsBigInt,
  costBase: z.object({
    element1AcquisitionCents: CentsBigInt,
    element2IncidentalCents: CentsBigInt,
    element3OwnershipCents: CentsBigInt,
    element4ImprovementCents: CentsBigInt,
    element5TitleCents: CentsBigInt,
  }),
  div43ClaimedCents: CentsBigInt,
  wasIncomeProducing: z.boolean(),
  priorYearCapitalLossesCents: CentsBigInt,
  owners: z
    .array(
      z.object({
        entityType: z.enum(['individual', 'smsf', 'company', 'trust']),
        shareBps: z.number().int().min(0).max(10000),
      }),
    )
    .min(1),
  isPreCgtAsset: z.boolean(),
});

const RunPayloadSchema = z.object({
  asOfMs: z.number().int().positive(),
  horizonYears: z.number().int().positive().default(1),
  disposal: DisposalInputSchema,
});

/** Recursively converts BigInt values to strings for JSONB storage. */
function serializeBigInts(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(serializeBigInts);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, serializeBigInts(v)]),
    );
  }
  return value;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sess = await getApiSession();
  if (!sess) return unauthorised();

  // Fetch the scenario — RLS ensures we only see our own.
  const client = getRlsAwareClient(sess.accessToken);
  const { data: scenario, error: scenarioErr } = await client
    .from('scenarios')
    .select('id, input_payload, user_id')
    .eq('id', id)
    .eq('user_id', sess.userId)
    .single();

  if (scenarioErr || !scenario) return notFound();

  // Parse and validate the stored input_payload.
  const payloadParsed = RunPayloadSchema.safeParse(scenario.input_payload);
  if (!payloadParsed.success) {
    return NextResponse.json(
      {
        error: 'Scenario input_payload does not contain valid CGT disposal inputs',
        details: payloadParsed.error.flatten(),
      },
      { status: 422 },
    );
  }

  const { asOfMs, horizonYears, disposal: disposalInput } = payloadParsed.data;

  // Idempotency: hash the raw payload + FY to key the result.
  const inputHash = outputHash({
    scenarioId: id,
    payload: scenario.input_payload,
    fy: FINANCIAL_YEAR,
  });

  // Return cached result if same inputs have been run before.
  const { data: cached } = await client
    .from('scenario_results')
    .select('*')
    .eq('scenario_id', id)
    .eq('input_hash', inputHash)
    .eq('status', 'completed')
    .maybeSingle();

  if (cached) {
    return NextResponse.json({ data: cached });
  }

  // Resolve ruleset — read FY from stored payload so the form's selection drives it;
  // fall back to FINANCIAL_YEAR constant when payload predates this field.
  const storedFy = (scenario.input_payload as Record<string, unknown>)['fy'];
  const fy = typeof storedFy === 'string' ? storedFy : FINANCIAL_YEAR;
  const ruleset = defaultRulesetAdapter.resolveByFY(fy, { status: 'draft' });

  // Run the engine — deterministic, no ambient clock or randomness.
  const clock = new FixedClock(asOfMs);
  const scenarioInputs = {
    scenarioId: id,
    asOfMs,
    horizonYears,
    disposal: scenario.input_payload, // raw for logging; parsed form used in compute
  };

  const engineResult = runScenario(
    scenarioInputs,
    ruleset.version,
    () => computeCGT(disposalInput, ruleset),
    clock,
  );

  // BL-0025: stamp ruleset_status into result_payload alongside CGT output.
  const resultPayload = {
    ...(serializeBigInts(engineResult.result) as Record<string, unknown>),
    ruleset_status: ruleset.status,
    output_hash: engineResult.output_hash,
  };

  const startMs = Date.now();
  const admin = getSupabaseAdmin();
  const { data: inserted, error: insertErr } = await admin
    .from('scenario_results')
    .insert({
      scenario_id: id,
      user_id: sess.userId,
      tax_rule_set_id: ruleset.version,
      input_hash: inputHash,
      engine_version: engineResult.engine_version,
      status: 'completed',
      result_payload: resultPayload,
      duration_ms: Date.now() - startMs,
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ data: inserted }, { status: 201 });
}
