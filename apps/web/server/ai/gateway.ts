/**
 * AI gateway — Anthropic tool-use with PII masking, grounding gate, and interaction logging.
 *
 * Design decisions (approved D11):
 * - Q2=B: tool_choice strict schema — prevents valid-but-wrong JSON reaching the user
 * - Q1=A: structural OpenAI fallback stub (BL-0030 — never functionally exercised)
 * - Q5: TFN → 422 hard refuse (caller checks tfnFound); card/email/mobile → masked
 * - Q3: grounding gate is fail-CLOSED: >1% divergence → suppressed, not just logged
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import type { ScenarioResultPayload, ScenarioResultRow } from '../data/scenarios';
import { getSupabaseAdmin } from '../db/client';

import { maskPii } from './pii-mask';

// ── Tool response schema ───────────────────────────────────────────────────────

const ExplanationItemSchema = z.object({
  label: z.string(),
  value: z.string(),
  note: z.string().optional(),
});

const ExplanationSchema = z.object({
  summary: z.string(),
  items: z.array(ExplanationItemSchema),
  disclaimer: z.string(),
});

export type ExplanationItem = z.infer<typeof ExplanationItemSchema>;
export type Explanation = z.infer<typeof ExplanationSchema>;

// ── Public result type ────────────────────────────────────────────────────────

export type ExplainResult =
  | { ok: true; explanation: Explanation; suppressed: false }
  | { ok: true; suppressed: true; reason: 'grounding_fail' | 'pii_tfn' }
  | { ok: false; error: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-6';
const TEMPLATE_ID = 'cgt_explanation_v1';
const GROUNDING_TOLERANCE = 0.01;

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(result: ScenarioResultRow): string {
  const p = result.result_payload;
  const ownerLines = p.owners
    .map(
      (o, i) =>
        `  Owner ${i + 1}: ${o.entityType} ${(o.shareBps / 100).toFixed(0)}% — gross gain ${o.ownerGrossGainCents}c, discount ${o.ownerDiscountAppliedCents}c, taxable ${o.ownerTaxableGainCents}c`,
    )
    .join('\n');

  return `You are a plain-English CGT explanation assistant for Australian property investors.
Explain the following CGT calculation in clear, jargon-free language suitable for a property owner.

Ruleset: ${result.tax_rule_set_id} (status: ${p.ruleset_status})
Days held: ${p.daysHeld}
Total cost base (elements 1–5): ${p.totalCostBaseCents} cents
Net proceeds: ${p.netProceedsCents} cents
Gross gain / (loss): ${p.grossGainCents} cents (capital loss: ${p.isCapitalLoss})
CGT discount eligible: ${p.discountEligible}
Pre-CGT asset: ${p.isPreCgtAsset}

Per-owner breakdown:
${ownerLines}

Use the provide_cgt_explanation tool. Dollar amounts in your response MUST be consistent with the figures above. Do not invent numbers.`;
}

// ── Grounding gate ────────────────────────────────────────────────────────────

function parseDollarsToCents(value: string): number | null {
  // Strip currency symbols, commas, spaces; keep digits and decimal point
  const digits = value.replace(/[^0-9.]/g, '');
  if (!digits) return null;
  const dollars = parseFloat(digits);
  if (isNaN(dollars) || dollars <= 0) return null;
  return Math.round(dollars * 100);
}

function groundingPass(explanation: Explanation, payload: ScenarioResultPayload): boolean {
  const keyEngineCents = [
    Number(payload.grossGainCents),
    Number(payload.netProceedsCents),
    Number(payload.totalCostBaseCents),
    ...payload.owners.map((o) => Number(o.ownerGrossGainCents)),
    ...payload.owners.map((o) => Number(o.ownerTaxableGainCents)),
    ...payload.owners.map((o) => Number(o.ownerDiscountAppliedCents)),
  ].filter((v) => v > 0);

  if (keyEngineCents.length === 0) return true;

  for (const item of explanation.items) {
    const itemCents = parseDollarsToCents(item.value);
    if (itemCents === null || itemCents < 10_00) continue; // ignore trivially small amounts

    // Find closest engine value by ratio
    let closestRatio = Infinity;
    for (const engineVal of keyEngineCents) {
      const ratio = Math.max(itemCents, engineVal) / Math.min(itemCents, engineVal);
      if (ratio < closestRatio) closestRatio = ratio;
    }

    // If item value is in the same order of magnitude as an engine value (ratio ≤ 10x)
    // but diverges by more than the tolerance, the model hallucinated — fail closed
    if (closestRatio <= 10 && closestRatio > 1 + GROUNDING_TOLERANCE) {
      return false;
    }
  }
  return true;
}

// ── Hash (non-cryptographic, for dedup/logging) ───────────────────────────────

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

// ── OpenAI fallback (structural stub — BL-0030) ───────────────────────────────

async function callOpenAiFallback(_maskedPrompt: string): Promise<Explanation | null> {
  // BL-0030: Structural stub only — has never been run against a real OpenAI endpoint.
  // Before RC: provision OPENAI_API_KEY in staging, add integration test,
  // verify grounding gate still applies, and fallback_used=true reaches ai_interactions.
  return null;
}

// ── Interaction logger (admin client — bypasses RLS for append-only log) ───────

async function logInteraction(params: {
  userId: string;
  scenarioResultId: string;
  model: string;
  promptHash: string;
  contextHash: string;
  responseRaw: unknown;
  schemaValid: boolean;
  leakDetected: boolean;
  fallbackUsed: boolean;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  costCents: number;
}): Promise<void> {
  try {
    await getSupabaseAdmin().from('ai_interactions').insert({
      user_id: params.userId,
      scenario_result_id: params.scenarioResultId,
      template_id: TEMPLATE_ID,
      model: params.model,
      prompt_hash: params.promptHash,
      context_hash: params.contextHash,
      response_raw: params.responseRaw,
      schema_valid: params.schemaValid,
      leak_detected: params.leakDetected,
      fallback_used: params.fallbackUsed,
      latency_ms: params.latencyMs,
      tokens_in: params.tokensIn,
      tokens_out: params.tokensOut,
      cost_cents: params.costCents,
    });
  } catch {
    // Log failures must not surface to the user — ai_interactions is observability-only
  }
}

// ── Gateway entry point ───────────────────────────────────────────────────────

export async function explainScenario(params: {
  userId: string;
  result: ScenarioResultRow;
}): Promise<ExplainResult> {
  const { userId, result } = params;

  const rawPrompt = buildPrompt(result);
  const { masked, tfnFound } = maskPii(rawPrompt);

  if (tfnFound) {
    return { ok: true, suppressed: true, reason: 'pii_tfn' };
  }

  const promptHash = simpleHash(masked);
  const contextHash = result.result_payload.output_hash;

  const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] ?? '' });

  const t0 = Date.now();
  let responseRaw: unknown = null;
  let schemaValid = false;
  let fallbackUsed = false;
  let tokensIn = 0;
  let tokensOut = 0;
  let explanation: Explanation | null = null;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tool_choice: { type: 'tool', name: 'provide_cgt_explanation' },
      tools: [
        {
          name: 'provide_cgt_explanation',
          description: 'Return a structured plain-English explanation of the CGT calculation.',
          input_schema: {
            type: 'object' as const,
            properties: {
              summary: {
                type: 'string',
                description: 'Plain text 2–4 sentence overview of the CGT outcome.',
              },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    value: { type: 'string' },
                    note: { type: 'string' },
                  },
                  required: ['label', 'value'],
                },
              },
              disclaimer: {
                type: 'string',
                description:
                  'Must note that this is an AI-generated estimate under draft rules and must not be relied upon for tax decisions.',
              },
            },
            required: ['summary', 'items', 'disclaimer'],
          },
        },
      ],
      messages: [{ role: 'user', content: masked }],
    });

    tokensIn = response.usage.input_tokens;
    tokensOut = response.usage.output_tokens;

    const toolBlock = response.content.find((b) => b.type === 'tool_use');
    responseRaw = toolBlock ?? null;

    const parsed = ExplanationSchema.safeParse(
      toolBlock?.type === 'tool_use' ? toolBlock.input : null,
    );
    if (parsed.success) {
      schemaValid = true;
      explanation = parsed.data;
    }
  } catch {
    // Anthropic call failed — attempt structural fallback (BL-0030)
    fallbackUsed = true;
    explanation = await callOpenAiFallback(masked);
    if (explanation) schemaValid = true;
  }

  const latencyMs = Date.now() - t0;
  // Approximate cost: Sonnet 4.6 ~$3/$15 per 1M tokens (in/out)
  const costCents = Math.round((tokensIn * 3 + tokensOut * 15) / 10_000);

  await logInteraction({
    userId,
    scenarioResultId: result.id,
    model: fallbackUsed ? 'openai-fallback' : MODEL,
    promptHash,
    contextHash,
    responseRaw,
    schemaValid,
    leakDetected: false, // TFN caught above; context already masked
    fallbackUsed,
    latencyMs,
    tokensIn,
    tokensOut,
    costCents,
  });

  if (!explanation) {
    return { ok: false, error: 'Failed to generate explanation.' };
  }

  if (!groundingPass(explanation, result.result_payload)) {
    return { ok: true, suppressed: true, reason: 'grounding_fail' };
  }

  return { ok: true, explanation, suppressed: false };
}
