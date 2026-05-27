/**
 * API contract tests — shape + tenancy.
 *
 * These tests run the route handlers in a Node environment with all
 * external I/O mocked. They verify:
 *   1. Unauthenticated requests return 401 (tenancy: not logged in).
 *   2. Authenticated requests return the expected response shape.
 *   3. Malformed input returns 422 with field-level errors.
 *   4. APP-LAYER scoping: user_id is always passed to .eq() on every
 *      resource read (query-assertion tests). This proves the app layer
 *      cannot accidentally drop the filter due to a refactor.
 *
 * WHAT THESE TESTS DO NOT COVER: Postgres-level RLS isolation. A query
 * bug that bypasses the app-layer user_id filter AND the Postgres RLS
 * policy simultaneously would not be caught here. True RLS isolation
 * requires an integration test that hits a real Supabase instance with a
 * second user's JWT attempting a cross-tenant fetch. That lives in
 * tests/integration/ (Day 13 hardening scope, BL-0029).
 *
 * Real RLS tenancy (cross-org isolation) is enforced by Postgres at the DB
 * layer; the contract here verifies the API layer feeds the right org_id
 * scoping and user_id to the RLS-aware client.
 */

import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock next/headers so cookies() doesn't throw outside a Next.js runtime.
vi.mock('next/headers', () => ({
  cookies: () => ({ getAll: () => [], set: vi.fn() }),
}));

// Control the api-guard to simulate authenticated / unauthenticated callers.
const mockGetApiSession = vi.fn();
vi.mock('../server/auth/api-guard', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/auth/api-guard')>();
  return {
    ...original,
    getApiSession: mockGetApiSession,
  };
});

// Mock the RLS-aware DB client to return controlled data.
const mockFrom = vi.fn();

vi.mock('../server/db/client', () => ({
  getRlsAwareClient: vi.fn(() => ({
    from: mockFrom,
  })),
  getSupabaseAdmin: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock the AI gateway to isolate route handler logic from Anthropic API calls.
const mockExplainScenario = vi.fn();
vi.mock('../server/ai/gateway', () => ({
  explainScenario: mockExplainScenario,
}));

// Mock the engine to avoid loading JSON rulesets in tests.
vi.mock('@equitylens/engine', () => ({
  defaultRulesetAdapter: {
    resolveByFY: vi.fn(() => ({
      version: 'FY2026.1',
      status: 'draft',
      financialYear: 'FY2026',
    })),
  },
  runScenario: vi.fn(
    (_inputs: unknown, rulesetVersion: string, compute: () => unknown, _clock: unknown) => ({
      result: compute(),
      output_hash: 'mock-hash',
      engine_version: '0.1.0',
      ruleset_version: rulesetVersion,
    }),
  ),
  computeCGT: vi.fn(() => ({
    daysHeld: 365,
    isPreCgtAsset: false,
    totalCostBaseCents: '60000000',
    netProceedsCents: '82500000',
    grossGainCents: '22500000',
    isCapitalLoss: false,
    discountEligible: true,
    owners: [
      {
        entityType: 'individual',
        shareBps: 10000,
        ownerGrossGainCents: '22500000',
        ownerLossesAppliedCents: '0',
        ownerGainAfterLossesCents: '22500000',
        ownerDiscountAppliedCents: '11250000',
        ownerTaxableGainCents: '11250000',
        ownerCarryForwardLossCents: '0',
      },
    ],
  })),
  outputHash: vi.fn(() => 'mock-input-hash'),
  FixedClock: vi.fn().mockImplementation((ms: number) => ({ now: () => ms })),
}));

// ── Session fixtures ───────────────────────────────────────────────────────────

const AUTH_SESSION = {
  userId: 'user-aaa',
  accessToken: 'tok-aaa',
  orgId: 'org-111',
};

function makeRequest(method: string, body?: unknown): NextRequest {
  if (body !== undefined) {
    return new NextRequest('http://localhost/api/test', {
      method,
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new NextRequest('http://localhost/api/test', { method });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * Creates a fluent Supabase mock chain where every intermediate method returns
 * the same chain object. Only the terminal methods (single / maybeSingle)
 * resolve with the provided value. This handles variable-depth .eq() chains.
 */
function makeFluentChain(terminalResult: unknown) {
  const chain: Record<string, unknown> = {};
  const fluent = () => chain;
  const terminal = () => Promise.resolve(terminalResult);
  chain['select'] = fluent;
  chain['eq'] = fluent;
  chain['is'] = fluent;
  chain['order'] = fluent;
  chain['insert'] = fluent;
  chain['single'] = terminal;
  chain['maybeSingle'] = terminal;
  return chain;
}

/** Like makeFluentChain but .order() is the terminal (for list endpoints). */
function makeListChain(terminalResult: unknown) {
  const chain: Record<string, unknown> = {};
  const fluent = () => chain;
  chain['select'] = fluent;
  chain['eq'] = fluent;
  chain['is'] = fluent;
  chain['single'] = fluent;
  chain['maybeSingle'] = fluent;
  chain['order'] = () => Promise.resolve(terminalResult);
  return chain;
}

// ── GET /api/properties ────────────────────────────────────────────────────────

describe('GET /api/properties', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetApiSession.mockResolvedValue(null);
    const { GET } = await import('../app/api/properties/route');
    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toHaveProperty('error');
  });

  it('returns data array when authenticated', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const rows = [
      {
        id: 'prop-1',
        address_line1: '1 Test St',
        suburb: 'Melbourne',
        state: 'VIC',
        postcode: '3000',
        purchase_price_cents: 80000000,
        status: 'active',
        created_at: '2026-01-01',
      },
    ];
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          is: () => ({
            order: () => Promise.resolve({ data: rows, error: null }),
          }),
        }),
      }),
    });
    const { GET } = await import('../app/api/properties/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('data');
    expect(Array.isArray(json.data)).toBe(true);
  });
});

// ── POST /api/properties ───────────────────────────────────────────────────────

describe('POST /api/properties', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetApiSession.mockResolvedValue(null);
    const { POST } = await import('../app/api/properties/route');
    const res = await POST(makeRequest('POST', {}));
    expect(res.status).toBe(401);
  });

  it('returns 422 for missing required fields', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const { POST } = await import('../app/api/properties/route');
    const res = await POST(makeRequest('POST', { address_line1: '1 Test St' }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json).toHaveProperty('error');
  });

  it('returns 422 for invalid postcode', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const { POST } = await import('../app/api/properties/route');
    const res = await POST(
      makeRequest('POST', {
        address_line1: '1 Test St',
        suburb: 'Melbourne',
        state: 'VIC',
        postcode: 'ABCD',
        purchase_price_cents: 80000000,
      }),
    );
    expect(res.status).toBe(422);
  });

  it('returns 201 with data shape on valid input', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const created = {
      id: 'prop-new',
      address_line1: '1 Test St',
      suburb: 'Melbourne',
      state: 'VIC',
      postcode: '3000',
      purchase_price_cents: 80000000,
      status: 'draft',
      created_at: '2026-01-01',
    };
    mockFrom.mockReturnValue({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: created, error: null }),
        }),
      }),
    });
    const { POST } = await import('../app/api/properties/route');
    const res = await POST(
      makeRequest('POST', {
        address_line1: '1 Test St',
        suburb: 'Melbourne',
        state: 'VIC',
        postcode: '3000',
        purchase_price_cents: 80000000,
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toHaveProperty('data');
    expect(json.data).toHaveProperty('id');
    expect(json.data).toHaveProperty('status');
  });
});

// ── GET /api/scenarios ─────────────────────────────────────────────────────────

describe('GET /api/scenarios', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetApiSession.mockResolvedValue(null);
    const { GET } = await import('../app/api/scenarios/route');
    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toHaveProperty('error');
  });

  it('returns data array when authenticated', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const rows = [
      {
        id: 'scen-1',
        label: 'CGT 2026',
        property_id: null,
        portfolio_id: null,
        pinned: false,
        created_at: '2026-01-01',
      },
    ];
    mockFrom.mockReturnValue(makeListChain({ data: rows, error: null }));

    const { GET } = await import('../app/api/scenarios/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('data');
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data[0]).toHaveProperty('id');
    expect(json.data[0]).toHaveProperty('label');
  });
});

// ── POST /api/scenarios ────────────────────────────────────────────────────────

describe('POST /api/scenarios', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetApiSession.mockResolvedValue(null);
    const { POST } = await import('../app/api/scenarios/route');
    const res = await POST(makeRequest('POST', {}));
    expect(res.status).toBe(401);
  });

  it('returns 422 when label is missing', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const { POST } = await import('../app/api/scenarios/route');
    const res = await POST(makeRequest('POST', { input_payload: {} }));
    expect(res.status).toBe(422);
  });

  it('returns 201 with data shape on valid input', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const created = {
      id: 'scen-new',
      label: 'CGT 2026',
      property_id: null,
      portfolio_id: null,
      input_payload: {},
      pinned: false,
      created_at: '2026-01-01',
    };
    mockFrom.mockReturnValue({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: created, error: null }),
        }),
      }),
    });
    const { POST } = await import('../app/api/scenarios/route');
    const res = await POST(
      makeRequest('POST', { label: 'CGT 2026', input_payload: { asOfMs: 1700000000000 } }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toHaveProperty('data');
    expect(json.data).toHaveProperty('id');
    expect(json.data).toHaveProperty('label');
    expect(json.data).toHaveProperty('input_payload');
  });
});

// ── GET /api/scenarios/[id] ────────────────────────────────────────────────────

describe('GET /api/scenarios/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetApiSession.mockResolvedValue(null);
    const { GET } = await import('../app/api/scenarios/[id]/route');
    const res = await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'scen-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when scenario not found', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'not found' } }),
          }),
        }),
      }),
    });
    const { GET } = await import('../app/api/scenarios/[id]/route');
    const res = await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'scen-missing' }) });
    expect(res.status).toBe(404);
  });

  it('returns data shape when found', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const scenario = {
      id: 'scen-1',
      label: 'CGT 2026',
      property_id: null,
      portfolio_id: null,
      input_payload: {},
      pinned: false,
      created_at: '2026-01-01',
    };
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: scenario, error: null }),
          }),
        }),
      }),
    });
    const { GET } = await import('../app/api/scenarios/[id]/route');
    const res = await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'scen-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('data');
    expect(json.data).toHaveProperty('id');
    expect(json.data).toHaveProperty('input_payload');
  });
});

// ── POST /api/scenarios/[id]/run ───────────────────────────────────────────────

const VALID_DISPOSAL_PAYLOAD = {
  asOfMs: 1700000000000,
  horizonYears: 1,
  disposal: {
    acquisitionDateISO: '2020-01-15',
    disposalDateISO: '2026-06-30',
    grossProceedsCents: '85000000',
    sellingCostsCents: '2500000',
    costBase: {
      element1AcquisitionCents: '60000000',
      element2IncidentalCents: '2000000',
      element3OwnershipCents: '8000000',
      element4ImprovementCents: '500000',
      element5TitleCents: '50000',
    },
    div43ClaimedCents: '0',
    wasIncomeProducing: true,
    priorYearCapitalLossesCents: '0',
    owners: [{ entityType: 'individual', shareBps: 10000 }],
    isPreCgtAsset: false,
  },
};

describe('POST /api/scenarios/[id]/run', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetApiSession.mockResolvedValue(null);
    const { POST } = await import('../app/api/scenarios/[id]/run/route');
    const res = await POST(makeRequest('POST'), { params: Promise.resolve({ id: 'scen-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when scenario not found or not owned', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'not found' } }),
          }),
        }),
      }),
    });
    const { POST } = await import('../app/api/scenarios/[id]/run/route');
    const res = await POST(makeRequest('POST'), {
      params: Promise.resolve({ id: 'scen-other-org' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 422 when input_payload has invalid disposal inputs', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'scen-1',
                  input_payload: { bad: 'data' },
                  user_id: AUTH_SESSION.userId,
                },
                error: null,
              }),
          }),
        }),
      }),
    });
    const { POST } = await import('../app/api/scenarios/[id]/run/route');
    const res = await POST(makeRequest('POST'), { params: Promise.resolve({ id: 'scen-1' }) });
    expect(res.status).toBe(422);
  });

  it('returns cached result on idempotent re-run', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const scenarioData = {
      id: 'scen-1',
      input_payload: VALID_DISPOSAL_PAYLOAD,
      user_id: AUTH_SESSION.userId,
    };
    const cached = {
      id: 'res-cached',
      scenario_id: 'scen-1',
      status: 'completed',
      result_payload: { ruleset_status: 'draft' },
    };
    // First call: scenario fetch (.single)
    mockFrom.mockImplementationOnce(() => makeFluentChain({ data: scenarioData, error: null }));
    // Second call: idempotency check (.maybeSingle) — returns cached hit
    mockFrom.mockImplementationOnce(() => makeFluentChain({ data: cached, error: null }));
    const { POST } = await import('../app/api/scenarios/[id]/run/route');
    const res = await POST(makeRequest('POST'), { params: Promise.resolve({ id: 'scen-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveProperty('result_payload');
  });

  it('stamps ruleset_status in result_payload on fresh run', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);

    const scenarioData = {
      id: 'scen-1',
      input_payload: VALID_DISPOSAL_PAYLOAD,
      user_id: AUTH_SESSION.userId,
    };
    const insertedResult = {
      id: 'res-new',
      scenario_id: 'scen-1',
      tax_rule_set_id: 'FY2026.1',
      input_hash: 'mock-input-hash',
      engine_version: '0.1.0',
      status: 'completed',
      result_payload: {
        daysHeld: 365,
        ruleset_status: 'draft', // BL-0025: must be present
      },
      duration_ms: 5,
    };

    // Sequence: 1) scenario fetch, 2) idempotency check (miss), 3) insert result
    mockFrom.mockImplementationOnce(() => makeFluentChain({ data: scenarioData, error: null }));
    mockFrom.mockImplementationOnce(() => makeFluentChain({ data: null, error: null }));
    mockFrom.mockImplementationOnce(() => makeFluentChain({ data: insertedResult, error: null }));

    const { POST } = await import('../app/api/scenarios/[id]/run/route');
    const res = await POST(makeRequest('POST'), { params: Promise.resolve({ id: 'scen-1' }) });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toHaveProperty('data');
    expect(json.data).toHaveProperty('result_payload');
    // BL-0025: ruleset_status must be present in the stored result
    expect(json.data.result_payload).toHaveProperty('ruleset_status');
  });
});

// ── GET /api/scenario-results/[id] ────────────────────────────────────────────

describe('GET /api/scenario-results/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetApiSession.mockResolvedValue(null);
    const { GET } = await import('../app/api/scenario-results/[id]/route');
    const res = await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'res-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 for result not owned by caller (cross-tenant probe)', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'not found' } }),
          }),
        }),
      }),
    });
    const { GET } = await import('../app/api/scenario-results/[id]/route');
    const res = await GET(makeRequest('GET'), {
      params: Promise.resolve({ id: 'res-other-user' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns data with result_payload shape', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const result = {
      id: 'res-1',
      scenario_id: 'scen-1',
      tax_rule_set_id: 'FY2026.1',
      input_hash: 'abc',
      engine_version: '0.1.0',
      status: 'completed',
      result_payload: { ruleset_status: 'draft', daysHeld: 365 },
      duration_ms: 5,
      created_at: '2026-01-01',
    };
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: result, error: null }),
          }),
        }),
      }),
    });
    const { GET } = await import('../app/api/scenario-results/[id]/route');
    const res = await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'res-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('data');
    expect(json.data).toHaveProperty('result_payload');
    // BL-0025: contract guarantees ruleset_status is in result_payload
    expect(json.data.result_payload).toHaveProperty('ruleset_status');
    expect(json.data).toHaveProperty('engine_version');
    expect(json.data).toHaveProperty('status');
  });
});

// ── Query-assertion tests: app-layer user_id scoping ──────────────────────────
//
// These tests verify that user_id is ALWAYS included in the query's .eq() chain
// for every resource-fetch route. A refactor that accidentally drops the filter
// would fail here before reaching Postgres RLS.
//
// Scope: app-layer only. Postgres RLS isolation (cross-JWT, real DB) is tracked
// as BL-0029, targeting Day 13 integration hardening.

describe('query-assertion: user_id scoping is always applied', () => {
  /**
   * Builds a spy-chain where every .eq() call is recorded.
   * The chain self-returns so arbitrary depth works.
   * Terminal methods resolve with the given result.
   */
  function makeEqSpy(terminalResult: unknown) {
    const eqCalls: Array<[string, unknown]> = [];
    const chain: Record<string, unknown> = {};
    chain['select'] = () => chain;
    chain['is'] = () => chain;
    chain['insert'] = () => chain;
    chain['eq'] = (field: string, value: unknown) => {
      eqCalls.push([field, value]);
      return chain;
    };
    // Terminal on both single (detail routes) and order (list routes).
    chain['single'] = () => Promise.resolve(terminalResult);
    chain['maybeSingle'] = () => Promise.resolve(terminalResult);
    chain['order'] = () => Promise.resolve(terminalResult);
    return { chain, eqCalls };
  }

  it('GET /api/scenarios/[id] passes user_id to query', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const { chain, eqCalls } = makeEqSpy({ data: null, error: { message: 'not found' } });
    mockFrom.mockReturnValue(chain);

    const { GET } = await import('../app/api/scenarios/[id]/route');
    await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'scen-any' }) });

    const userIdFilter = eqCalls.find(([field]) => field === 'user_id');
    expect(userIdFilter).toBeDefined();
    expect(userIdFilter![1]).toBe(AUTH_SESSION.userId);
  });

  it('GET /api/scenario-results/[id] passes user_id to query', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const { chain, eqCalls } = makeEqSpy({ data: null, error: { message: 'not found' } });
    mockFrom.mockReturnValue(chain);

    const { GET } = await import('../app/api/scenario-results/[id]/route');
    await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'res-any' }) });

    const userIdFilter = eqCalls.find(([field]) => field === 'user_id');
    expect(userIdFilter).toBeDefined();
    expect(userIdFilter![1]).toBe(AUTH_SESSION.userId);
  });

  it('POST /api/scenarios/[id]/run passes user_id to scenario fetch', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const { chain, eqCalls } = makeEqSpy({ data: null, error: { message: 'not found' } });
    mockFrom.mockReturnValue(chain);

    const { POST } = await import('../app/api/scenarios/[id]/run/route');
    await POST(makeRequest('POST'), { params: Promise.resolve({ id: 'scen-any' }) });

    // Scenario fetch is the first DB call; user_id must be in its eq chain.
    const userIdFilter = eqCalls.find(([field]) => field === 'user_id');
    expect(userIdFilter).toBeDefined();
    expect(userIdFilter![1]).toBe(AUTH_SESSION.userId);
  });

  it('GET /api/scenarios passes user_id to query', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const { chain, eqCalls } = makeEqSpy({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const { GET } = await import('../app/api/scenarios/route');
    await GET();

    const userIdFilter = eqCalls.find(([field]) => field === 'user_id');
    expect(userIdFilter).toBeDefined();
    expect(userIdFilter![1]).toBe(AUTH_SESSION.userId);
  });

  it('GET /api/properties passes org_id (not user_id) to query', async () => {
    // Properties are org-scoped, not user-scoped; verify org_id is the tenant filter.
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const { eqCalls } = makeEqSpy({ data: [], error: null });
    mockFrom.mockReturnValue({
      select: () => ({
        eq: (field: string, value: unknown) => {
          eqCalls.push([field, value]);
          return {
            is: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          };
        },
      }),
    });

    const { GET } = await import('../app/api/properties/route');
    await GET();

    const orgIdFilter = eqCalls.find(([field]) => field === 'org_id');
    expect(orgIdFilter).toBeDefined();
    expect(orgIdFilter![1]).toBe(AUTH_SESSION.orgId);
  });

  it('GET /api/portfolios passes org_id to query', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const { chain, eqCalls } = makeEqSpy({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const { GET } = await import('../app/api/portfolios/route');
    await GET();

    const orgIdFilter = eqCalls.find(([field]) => field === 'org_id');
    expect(orgIdFilter).toBeDefined();
    expect(orgIdFilter![1]).toBe(AUTH_SESSION.orgId);
  });

  it('GET /api/portfolios/[id]/summary passes user_id to query', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const { chain, eqCalls } = makeEqSpy({ data: null, error: { message: 'not found' } });
    mockFrom.mockReturnValue(chain);

    const { GET } = await import('../app/api/portfolios/[id]/summary/route');
    await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'port-any' }) });

    const userIdFilter = eqCalls.find(([field]) => field === 'user_id');
    expect(userIdFilter).toBeDefined();
    expect(userIdFilter![1]).toBe(AUTH_SESSION.userId);
  });

  it('GET /api/properties/[id] passes org_id to query', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const { chain, eqCalls } = makeEqSpy({ data: null, error: { message: 'not found' } });
    mockFrom.mockReturnValue(chain);

    const { GET } = await import('../app/api/properties/[id]/route');
    await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'prop-any' }) });

    const orgIdFilter = eqCalls.find(([field]) => field === 'org_id');
    expect(orgIdFilter).toBeDefined();
    expect(orgIdFilter![1]).toBe(AUTH_SESSION.orgId);
  });
});

// ── GET /api/portfolios ────────────────────────────────────────────────────────

describe('GET /api/portfolios', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetApiSession.mockResolvedValue(null);
    const { GET } = await import('../app/api/portfolios/route');
    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toHaveProperty('error');
  });

  it('returns data array when authenticated', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const rows = [
      { id: 'port-1', name: 'My portfolio', created_at: '2026-01-01', updated_at: '2026-01-01' },
    ];
    mockFrom.mockReturnValue(makeListChain({ data: rows, error: null }));

    const { GET } = await import('../app/api/portfolios/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('data');
    expect(Array.isArray(json.data)).toBe(true);
  });
});

// ── GET /api/portfolios/[id]/summary ──────────────────────────────────────────

describe('GET /api/portfolios/[id]/summary', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetApiSession.mockResolvedValue(null);
    const { GET } = await import('../app/api/portfolios/[id]/summary/route');
    const res = await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'port-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when portfolio not found (cross-tenant probe)', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    mockFrom.mockReturnValue(makeFluentChain({ data: null, error: { message: 'not found' } }));

    const { GET } = await import('../app/api/portfolios/[id]/summary/route');
    const res = await GET(makeRequest('GET'), {
      params: Promise.resolve({ id: 'port-other-user' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns summary KPI shape when found', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const summary = {
      portfolio_id: 'port-1',
      user_id: AUTH_SESSION.userId,
      active_properties: 2,
      total_value_cents: 160000000,
      total_debt_cents: 80000000,
      estimated_equity_cents: 80000000,
    };
    mockFrom.mockReturnValue(makeFluentChain({ data: summary, error: null }));

    const { GET } = await import('../app/api/portfolios/[id]/summary/route');
    const res = await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'port-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('data');
    expect(json.data).toHaveProperty('active_properties');
    expect(json.data).toHaveProperty('estimated_equity_cents');
    expect(json.data).toHaveProperty('total_value_cents');
    expect(json.data).toHaveProperty('total_debt_cents');
  });
});

// ── GET /api/properties/[id] ──────────────────────────────────────────────────

describe('GET /api/properties/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetApiSession.mockResolvedValue(null);
    const { GET } = await import('../app/api/properties/[id]/route');
    const res = await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'prop-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when property not found (cross-tenant probe)', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    mockFrom.mockReturnValue(makeFluentChain({ data: null, error: { message: 'not found' } }));

    const { GET } = await import('../app/api/properties/[id]/route');
    const res = await GET(makeRequest('GET'), {
      params: Promise.resolve({ id: 'prop-other-org' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns property data shape when found', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const property = {
      id: 'prop-1',
      portfolio_id: 'port-1',
      address_line1: '1 Test St',
      address_line2: null,
      suburb: 'Melbourne',
      state: 'VIC',
      postcode: '3000',
      property_type: 'residential',
      purchase_date: '2020-01-15',
      purchase_price_cents: 80000000,
      stamp_duty_paid_cents: 3200000,
      acquisition_costs_cents: 500000,
      current_estimated_value_cents: 95000000,
      ownership_kind: 'individual',
      status: 'active',
      notes: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    mockFrom.mockReturnValue(makeFluentChain({ data: property, error: null }));

    const { GET } = await import('../app/api/properties/[id]/route');
    const res = await GET(makeRequest('GET'), { params: Promise.resolve({ id: 'prop-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('data');
    expect(json.data).toHaveProperty('id');
    expect(json.data).toHaveProperty('purchase_price_cents');
    expect(json.data).toHaveProperty('current_estimated_value_cents');
    expect(json.data).toHaveProperty('status');
  });
});

// ── POST /api/scenarios/[id]/explain ─────────────────────────────────────────

const MOCK_SCENARIO = {
  id: 'scen-1',
  label: 'CGT 2026',
  property_id: null,
  portfolio_id: null,
  input_payload: {},
  pinned: false,
  created_at: '2026-01-01',
};

const MOCK_RESULT = {
  id: 'res-1',
  scenario_id: 'scen-1',
  tax_rule_set_id: 'FY2026.1',
  engine_version: '0.1.0',
  status: 'completed',
  result_payload: {
    daysHeld: 365,
    isPreCgtAsset: false,
    totalCostBaseCents: '60000000',
    netProceedsCents: '82500000',
    grossGainCents: '22500000',
    isCapitalLoss: false,
    discountEligible: true,
    owners: [],
    ruleset_status: 'draft',
    output_hash: 'abc123',
  },
  duration_ms: 5,
  created_at: '2026-01-01',
};

describe('POST /api/scenarios/[id]/explain', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetApiSession.mockResolvedValue(null);
    const { POST } = await import('../app/api/scenarios/[id]/explain/route');
    const res = await POST(makeRequest('POST'), { params: Promise.resolve({ id: 'scen-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when scenario not found', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    // Scenario fetch returns null (cross-tenant or missing)
    mockFrom.mockReturnValue(makeFluentChain({ data: null, error: { message: 'not found' } }));
    const { POST } = await import('../app/api/scenarios/[id]/explain/route');
    const res = await POST(makeRequest('POST'), {
      params: Promise.resolve({ id: 'scen-missing' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 422 when no completed result exists', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    // Scenario fetch succeeds; result fetch returns null (no completed run yet)
    mockFrom.mockImplementationOnce(() => makeFluentChain({ data: MOCK_SCENARIO, error: null }));
    mockFrom.mockImplementationOnce(() =>
      // getLatestScenarioResult uses .order() as terminal
      ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    );
    const { POST } = await import('../app/api/scenarios/[id]/explain/route');
    const res = await POST(makeRequest('POST'), { params: Promise.resolve({ id: 'scen-1' }) });
    expect(res.status).toBe(422);
  });

  it('returns 200 with explanation on success', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    mockFrom.mockImplementationOnce(() => makeFluentChain({ data: MOCK_SCENARIO, error: null }));
    mockFrom.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [MOCK_RESULT], error: null }),
            }),
          }),
        }),
      }),
    }));
    mockExplainScenario.mockResolvedValue({
      ok: true,
      suppressed: false,
      explanation: {
        summary: 'Your property sale generated a capital gain.',
        items: [
          { label: 'Gross gain', value: '$225,000' },
          { label: 'CGT discount', value: '$112,500' },
        ],
        disclaimer: 'This is an AI-generated estimate under draft FY2026 rules.',
      },
    });
    const { POST } = await import('../app/api/scenarios/[id]/explain/route');
    const res = await POST(makeRequest('POST'), { params: Promise.resolve({ id: 'scen-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('explanation');
    expect(json.explanation).toHaveProperty('summary');
    expect(json.explanation).toHaveProperty('items');
    expect(json.explanation).toHaveProperty('disclaimer');
  });

  it('returns 200 suppressed=true when grounding fails', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    mockFrom.mockImplementationOnce(() => makeFluentChain({ data: MOCK_SCENARIO, error: null }));
    mockFrom.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [MOCK_RESULT], error: null }),
            }),
          }),
        }),
      }),
    }));
    mockExplainScenario.mockResolvedValue({
      ok: true,
      suppressed: true,
      reason: 'grounding_fail',
    });
    const { POST } = await import('../app/api/scenarios/[id]/explain/route');
    const res = await POST(makeRequest('POST'), { params: Promise.resolve({ id: 'scen-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.suppressed).toBe(true);
    expect(json.reason).toBe('grounding_fail');
  });
});

// ── Query-assertion: explain route passes user_id to scenario fetch ────────────

describe('query-assertion: POST /api/scenarios/[id]/explain passes user_id to scenario fetch', () => {
  it('passes user_id to getScenario query', async () => {
    mockGetApiSession.mockResolvedValue(AUTH_SESSION);
    const eqCalls: Array<[string, unknown]> = [];
    mockFrom.mockReturnValue({
      select: () => ({
        eq: (field: string, value: unknown) => {
          eqCalls.push([field, value]);
          return {
            eq: (f2: string, v2: unknown) => {
              eqCalls.push([f2, v2]);
              return {
                single: () => Promise.resolve({ data: null, error: { message: 'not found' } }),
              };
            },
          };
        },
      }),
    });
    const { POST } = await import('../app/api/scenarios/[id]/explain/route');
    await POST(makeRequest('POST'), { params: Promise.resolve({ id: 'scen-any' }) });
    const userIdFilter = eqCalls.find(([field]) => field === 'user_id');
    expect(userIdFilter).toBeDefined();
    expect(userIdFilter![1]).toBe(AUTH_SESSION.userId);
  });
});
