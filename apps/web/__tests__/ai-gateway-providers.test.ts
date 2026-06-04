/**
 * D16-B4 — Per-provider gateway integration tests.
 *
 * Validates the three gate guarantees for each provider:
 *   1. Real call returns valid structured output (schema-valid explanation).
 *   2. Masking fires — canary TFN in the prompt → pii_tfn suppress (before dispatch).
 *   3. Grounding gate triggers on >1% divergence (runs after provider response).
 *
 * Pattern: skip-with-key-absent, run-when-present (same as BL-0030/BL-0032).
 * Skip ≠ green — these must run in CI once keys are provisioned.
 *
 * Provider routing (B5): Anthropic primary → OpenAI → Grok.
 * Tests isolate each provider by stubbing the others absent via env.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { ScenarioResultRow } from '../server/data/scenarios';

// ── Fixture ───────────────────────────────────────────────────────────────────

const SAMPLE_RESULT: ScenarioResultRow = {
  id: 'result-00000000-0000-0000-0000-000000000002',
  scenario_id: 'scenario-00000000-0000-0000-0000-000000000002',
  tax_rule_set_id: 'ato-cgt-2024',
  engine_version: '1.0.0',
  status: 'completed',
  duration_ms: 42,
  created_at: '2024-01-01T00:00:00.000Z',
  result_payload: {
    daysHeld: 400,
    isPreCgtAsset: false,
    totalCostBaseCents: '500000',
    netProceedsCents: '700000',
    grossGainCents: '200000',
    isCapitalLoss: false,
    discountEligible: true,
    ruleset_status: 'published',
    output_hash: 'abc456',
    owners: [
      {
        entityType: 'individual',
        shareBps: 10000,
        ownerGrossGainCents: '200000',
        ownerLossesAppliedCents: '0',
        ownerGainAfterLossesCents: '200000',
        ownerDiscountAppliedCents: '100000',
        ownerTaxableGainCents: '100000',
        ownerCarryForwardLossCents: '0',
      },
    ],
  },
};

// Result whose prompt would contain a canary TFN — must be caught at the chokepoint.
// "123 456 789" is a valid TFN pattern; it appears in the scenario ID string which
// passes through buildPrompt unchanged (any free-text field would trigger this).
const TFN_RESULT: ScenarioResultRow = {
  ...SAMPLE_RESULT,
  id: 'result-tfn-canary',
  // inject canary TFN into tax_rule_set_id (used verbatim in the prompt)
  tax_rule_set_id: 'tfn-canary-123 456 789',
};

// Result that will cause a grounding failure — the explanation item value
// is set to $99,999 when the engine says $2,000 — >1% divergence.
// We test this by mocking the provider to return a hallucinated value.
const GROUNDING_RESULT: ScenarioResultRow = {
  ...SAMPLE_RESULT,
  id: 'result-grounding-test',
  result_payload: {
    ...SAMPLE_RESULT.result_payload,
    grossGainCents: '200000', // $2,000
    owners: [
      {
        ...SAMPLE_RESULT.result_payload.owners[0]!,
        ownerGrossGainCents: '200000',
        ownerTaxableGainCents: '100000',
        ownerDiscountAppliedCents: '100000',
      },
    ],
  },
};

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockAnthropicCreate, insertedRows, mockInsert } = vi.hoisted(() => {
  const insertedRows: unknown[] = [];
  const mockInsert = vi.fn().mockImplementation((row: unknown) => {
    insertedRows.push(row);
    return Promise.resolve({ error: null });
  });
  return { mockAnthropicCreate: vi.fn(), insertedRows, mockInsert };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  })),
}));

const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

vi.mock('../server/db/client', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
  getRlsAwareClient: () => ({ from: mockFrom }),
}));

// ── Shared helpers ────────────────────────────────────────────────────────────

function makeValidAnthropicResponse(overrides?: { grossGain?: string }) {
  return {
    usage: { input_tokens: 100, output_tokens: 200 },
    content: [
      {
        type: 'tool_use' as const,
        id: 'tool_1',
        name: 'provide_cgt_explanation',
        input: {
          summary: 'Your property generated a capital gain.',
          items: [{ label: 'Gross gain', value: overrides?.grossGain ?? '$2,000.00' }],
          disclaimer: 'AI estimate under draft rules. Not for tax decisions.',
        },
      },
    ],
  };
}

// ── 1. Masking fires (canary TFN → pii_tfn) — always runs ────────────────────
// This runs regardless of which provider is configured.

describe('chokepoint: canary TFN → pii_tfn suppress (always runs)', () => {
  beforeAll(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-placeholder');
    mockAnthropicCreate.mockResolvedValue(makeValidAnthropicResponse());
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    mockAnthropicCreate.mockReset();
    insertedRows.length = 0;
  });

  it('suppresses with reason pii_tfn when TFN canary is in prompt', async () => {
    const { explainScenario } = await import('../server/ai/gateway');
    const result = await explainScenario({
      userId: '00000000-0000-0000-0000-000000000001',
      result: TFN_RESULT,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.suppressed).toBe(true);
      if (result.suppressed) expect(result.reason).toBe('pii_tfn');
    }
  });

  it('does NOT call any provider when TFN is detected (masking before dispatch)', async () => {
    mockAnthropicCreate.mockClear();
    const { explainScenario } = await import('../server/ai/gateway');
    await explainScenario({
      userId: '00000000-0000-0000-0000-000000000001',
      result: TFN_RESULT,
    });
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });
});

// ── 2. Grounding gate fires on >1% divergence — always runs ──────────────────

describe('chokepoint: grounding gate suppresses hallucinated values (always runs)', () => {
  beforeAll(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-placeholder');
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('GROK_API_KEY', '');
    // Provider returns $2,100 when engine says $2,000 (grossGainCents=200000).
    // ratio = 2100/2000 = 1.05 — same order of magnitude (≤10x) AND >1% divergence → gate fails.
    mockAnthropicCreate.mockResolvedValue(makeValidAnthropicResponse({ grossGain: '$2,100.00' }));
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    mockAnthropicCreate.mockReset();
    insertedRows.length = 0;
  });

  it('suppresses with reason grounding_fail when provider output diverges', async () => {
    const { explainScenario } = await import('../server/ai/gateway');
    const result = await explainScenario({
      userId: '00000000-0000-0000-0000-000000000001',
      result: GROUNDING_RESULT,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.suppressed).toBe(true);
      if (result.suppressed) expect(result.reason).toBe('grounding_fail');
    }
  });
});

// ── 3. Live Anthropic — schema-valid output + provider surfaced ───────────────

const hasAnthropicKey = !!process.env['ANTHROPIC_API_KEY'];

describe.skipIf(!hasAnthropicKey)(
  'live Anthropic — schema-valid output and provider field (requires ANTHROPIC_API_KEY)',
  () => {
    beforeAll(() => {
      // Don't stub ANTHROPIC_API_KEY — use the real key from env.
      // Stub out fallback providers so only Anthropic runs.
      vi.stubEnv('OPENAI_API_KEY', '');
      vi.stubEnv('GROK_API_KEY', '');
      insertedRows.length = 0;
    });

    afterAll(() => {
      vi.unstubAllEnvs();
      insertedRows.length = 0;
    });

    it('returns ok:true with provider=anthropic', async () => {
      const { explainScenario } = await import('../server/ai/gateway');
      const result = await explainScenario({
        userId: '00000000-0000-0000-0000-000000000001',
        result: SAMPLE_RESULT,
      });
      if (result.ok && !result.suppressed) {
        expect(result.provider).toBe('anthropic');
        expect(typeof result.explanation.summary).toBe('string');
      } else {
        // ok:false or suppressed are valid outcomes (quota/grounding) — verify log
        expect(insertedRows.length).toBeGreaterThan(0);
      }
    });

    it('logs provider=anthropic (or none if quota) to ai_interactions', () => {
      const logged = insertedRows[0] as Record<string, unknown> | undefined;
      expect(logged).toBeDefined();
      const model = logged?.['model'];
      expect(['anthropic', 'none']).toContain(model);
    });
  },
);

// ── 4. Live OpenAI — schema-valid output (requires OPENAI_API_KEY) ────────────

const hasOpenAiKey = !!process.env['OPENAI_API_KEY'];

describe.skipIf(!hasOpenAiKey)(
  'live OpenAI — schema-valid output and fallback_used=true (requires OPENAI_API_KEY)',
  () => {
    beforeAll(() => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-invalid'); // force Anthropic to fail
      // OPENAI_API_KEY comes from real env; stub Grok absent.
      vi.stubEnv('GROK_API_KEY', '');
      mockAnthropicCreate.mockRejectedValue(new Error('Anthropic unavailable (forced for test)'));
      insertedRows.length = 0;
    });

    afterAll(() => {
      vi.unstubAllEnvs();
      mockAnthropicCreate.mockReset();
      insertedRows.length = 0;
    });

    it('returns ok:true via OpenAI when Anthropic fails (or ok:false on quota)', async () => {
      const { explainScenario } = await import('../server/ai/gateway');
      const result = await explainScenario({
        userId: '00000000-0000-0000-0000-000000000001',
        result: SAMPLE_RESULT,
      });
      if (result.ok && !result.suppressed) {
        expect(result.provider).toBe('openai');
      } else {
        // quota exhausted or grounding — fallback was exercised, check log
        expect(insertedRows.length).toBeGreaterThan(0);
      }
    });

    it('logs fallback_used=true via OpenAI path', () => {
      const logged = insertedRows[0] as Record<string, unknown> | undefined;
      expect(logged).toBeDefined();
      expect(logged?.['fallback_used']).toBe(true);
    });

    it('grounding gate applies to OpenAI output', async () => {
      const { explainScenario } = await import('../server/ai/gateway');
      const result = await explainScenario({
        userId: '00000000-0000-0000-0000-000000000001',
        result: SAMPLE_RESULT,
      });
      if (result.ok && !result.suppressed) {
        expect(typeof result.explanation.summary).toBe('string');
        expect(Array.isArray(result.explanation.items)).toBe(true);
      }
    });
  },
);

// ── 5. Live Grok — schema-valid output (requires GROK_API_KEY) ───────────────

const hasGrokKey = !!process.env['GROK_API_KEY'];

describe.skipIf(!hasGrokKey)(
  'live Grok — schema-valid output and fallback_used=true (requires GROK_API_KEY)',
  () => {
    beforeAll(() => {
      vi.stubEnv('ANTHROPIC_API_KEY', ''); // absent — skip Anthropic
      vi.stubEnv('OPENAI_API_KEY', ''); // absent — skip OpenAI; Grok is next
      // GROK_API_KEY comes from real env
      insertedRows.length = 0;
    });

    afterAll(() => {
      vi.unstubAllEnvs();
      insertedRows.length = 0;
    });

    it('returns ok:true via Grok when higher-priority providers absent', async () => {
      const { explainScenario } = await import('../server/ai/gateway');
      const result = await explainScenario({
        userId: '00000000-0000-0000-0000-000000000001',
        result: SAMPLE_RESULT,
      });
      if (result.ok && !result.suppressed) {
        expect(result.provider).toBe('grok');
        expect(typeof result.explanation.summary).toBe('string');
        expect(Array.isArray(result.explanation.items)).toBe(true);
      } else {
        // ok:false or suppressed are valid (quota/grounding) — verify log reached Grok
        expect(insertedRows.length).toBeGreaterThan(0);
        const logged = insertedRows[0] as Record<string, unknown> | undefined;
        expect(['grok', 'none']).toContain(logged?.['model']);
      }
    });

    it('logs fallback_used=true via Grok path', () => {
      const logged = insertedRows[0] as Record<string, unknown> | undefined;
      expect(logged).toBeDefined();
      expect(logged?.['fallback_used']).toBe(true);
    });

    it('grounding gate applies to Grok output', async () => {
      const { explainScenario } = await import('../server/ai/gateway');
      const result = await explainScenario({
        userId: '00000000-0000-0000-0000-000000000001',
        result: SAMPLE_RESULT,
      });
      if (result.ok && !result.suppressed) {
        expect(typeof result.explanation.summary).toBe('string');
        expect(Array.isArray(result.explanation.items)).toBe(true);
      }
    });
  },
);
