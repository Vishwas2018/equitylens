/**
 * AI gateway — multi-provider with PII masking, grounding gate, and interaction logging.
 *
 * Design decisions (approved D11/D16):
 * - Q2=B: tool_choice strict schema — prevents valid-but-wrong JSON reaching the user
 * - Q5: TFN → 422 hard refuse; card/email/mobile → masked
 * - Q3: grounding gate is fail-CLOSED: >1% divergence → suppressed, not just logged
 * - D16-B1: Provider interface — single dispatch chokepoint; masking + grounding run
 *   here, never inside adapters. Routing: Anthropic → OpenAI → Grok (explicit, B5).
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { z } from 'zod';

import type { ScenarioResultPayload, ScenarioResultRow } from '../data/scenarios';
import { getSupabaseAdmin } from '../db/client';

import { maskPii } from './pii-mask';

// ── Tool response schema ──────────────────────────────────────────────────────

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
  | { ok: true; explanation: Explanation; suppressed: false; provider: string }
  | { ok: true; suppressed: true; reason: 'grounding_fail' | 'pii_tfn' }
  | { ok: false; error: string };

// ── Provider interface ────────────────────────────────────────────────────────

interface ProviderResult {
  explanation: Explanation;
  tokensIn: number;
  tokensOut: number;
  raw: unknown;
}

interface AiProvider {
  readonly name: string;
  call(maskedPrompt: string): Promise<ProviderResult | null>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TEMPLATE_ID = 'cgt_explanation_v1';
const GROUNDING_TOLERANCE = 0.01;

// ── Shared tool definition (same Zod schema for all providers) ────────────────

const TOOL_NAME = 'provide_cgt_explanation';
const TOOL_DESCRIPTION = 'Return a structured plain-English explanation of the CGT calculation.';
const TOOL_PARAMS = {
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
};

// ── Anthropic adapter ─────────────────────────────────────────────────────────

class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  private static readonly MODEL = 'claude-sonnet-4-6';

  async call(maskedPrompt: string): Promise<ProviderResult | null> {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) return null;

    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: AnthropicProvider.MODEL,
        max_tokens: 1024,
        tool_choice: { type: 'tool', name: TOOL_NAME },
        tools: [{ name: TOOL_NAME, description: TOOL_DESCRIPTION, input_schema: TOOL_PARAMS }],
        messages: [{ role: 'user', content: maskedPrompt }],
      });

      const toolBlock = response.content.find((b) => b.type === 'tool_use');
      const parsed = ExplanationSchema.safeParse(
        toolBlock?.type === 'tool_use' ? toolBlock.input : null,
      );
      if (!parsed.success) return null;

      return {
        explanation: parsed.data,
        tokensIn: response.usage.input_tokens,
        tokensOut: response.usage.output_tokens,
        raw: toolBlock ?? null,
      };
    } catch {
      return null;
    }
  }
}

// ── OpenAI-compatible adapter (shared by OpenAI and Grok) ────────────────────

const OPENAI_TOOL_DEF = {
  type: 'function' as const,
  function: { name: TOOL_NAME, description: TOOL_DESCRIPTION, parameters: TOOL_PARAMS },
};

class OpenAICompatProvider implements AiProvider {
  constructor(
    readonly name: string,
    private readonly model: string,
    private readonly apiKeyEnv: string,
    private readonly baseURL?: string,
  ) {}

  async call(maskedPrompt: string): Promise<ProviderResult | null> {
    const apiKey = process.env[this.apiKeyEnv];
    if (!apiKey) return null;

    try {
      const client = new OpenAI({ apiKey, ...(this.baseURL ? { baseURL: this.baseURL } : {}) });
      const response = await client.chat.completions.create({
        model: this.model,
        max_tokens: 1024,
        tool_choice: { type: 'function', function: { name: TOOL_NAME } },
        tools: [OPENAI_TOOL_DEF],
        messages: [{ role: 'user', content: maskedPrompt }],
      });

      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.type !== 'function') return null;

      const raw: unknown = JSON.parse(toolCall.function.arguments);
      const parsed = ExplanationSchema.safeParse(raw);
      if (!parsed.success) return null;

      return {
        explanation: parsed.data,
        tokensIn: response.usage?.prompt_tokens ?? 0,
        tokensOut: response.usage?.completion_tokens ?? 0,
        raw: { provider: this.name, tool_call: toolCall },
      };
    } catch (err) {
      if (process.env['NODE_ENV'] !== 'production') {
        console.error(
          `[gateway:${this.name}]`,
          err instanceof Error ? `${err.constructor.name}: ${err.message}` : String(err),
        );
      }
      return null;
    }
  }
}

// ── Provider registry — explicit routing order (B5) ───────────────────────────
// Default: Anthropic. Fallback: OpenAI → Grok.
// Masking + TFN-refuse + grounding run at the chokepoint below, not here.

const PROVIDERS: readonly AiProvider[] = [
  new AnthropicProvider(),
  new OpenAICompatProvider('openai', 'gpt-4o-mini', 'OPENAI_API_KEY'),
  new OpenAICompatProvider('grok', 'grok-3', 'GROK_API_KEY', 'https://api.x.ai/v1'),
];

// ── Dispatch chokepoint ───────────────────────────────────────────────────────
// Iterates providers in order; returns on first non-null result.
// Called AFTER masking+TFN-refuse and BEFORE grounding gate.

async function dispatchToProvider(
  maskedPrompt: string,
): Promise<{ result: ProviderResult; providerName: string } | null> {
  for (const provider of PROVIDERS) {
    const result = await provider.call(maskedPrompt);
    if (result !== null) return { result, providerName: provider.name };
  }
  return null;
}

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
    if (itemCents === null || itemCents < 10_00) continue;

    let closestRatio = Infinity;
    for (const engineVal of keyEngineCents) {
      const ratio = Math.max(itemCents, engineVal) / Math.min(itemCents, engineVal);
      if (ratio < closestRatio) closestRatio = ratio;
    }

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

// ── Interaction logger ────────────────────────────────────────────────────────

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

  // ── Chokepoint: masking + TFN-refuse (before any provider dispatch) ───────
  const { masked, tfnFound } = maskPii(rawPrompt);
  if (tfnFound) {
    return { ok: true, suppressed: true, reason: 'pii_tfn' };
  }

  const promptHash = simpleHash(masked);
  const contextHash = result.result_payload.output_hash;

  const t0 = Date.now();

  // ── Provider dispatch: Anthropic → OpenAI → Grok ─────────────────────────
  const dispatched = await dispatchToProvider(masked);

  const latencyMs = Date.now() - t0;
  const providerName = dispatched?.providerName ?? 'none';
  const providerResult = dispatched?.result ?? null;
  // fallback_used: true whenever Anthropic was not the provider (maintains existing semantics)
  const fallbackUsed = providerName !== 'anthropic';

  const tokensIn = providerResult?.tokensIn ?? 0;
  const tokensOut = providerResult?.tokensOut ?? 0;
  // Approximate cost: Sonnet 4.6 ~$3/$15 per 1M tokens (in/out)
  const costCents = Math.round((tokensIn * 3 + tokensOut * 15) / 10_000);

  await logInteraction({
    userId,
    scenarioResultId: result.id,
    model: providerName,
    promptHash,
    contextHash,
    responseRaw: providerResult ? { provider: providerName, raw: providerResult.raw } : null,
    schemaValid: providerResult !== null,
    leakDetected: false, // TFN caught above; context already masked
    fallbackUsed,
    latencyMs,
    tokensIn,
    tokensOut,
    costCents,
  });

  if (!providerResult) {
    return { ok: false, error: 'Failed to generate explanation.' };
  }

  // ── Grounding gate (after provider response, fail-CLOSED) ────────────────
  if (!groundingPass(providerResult.explanation, result.result_payload)) {
    return { ok: true, suppressed: true, reason: 'grounding_fail' };
  }

  return {
    ok: true,
    explanation: providerResult.explanation,
    suppressed: false,
    provider: providerName,
  };
}
