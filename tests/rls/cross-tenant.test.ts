/**
 * Cross-tenant RLS probe: verifies that user A cannot read user B's org data.
 *
 * Requires DATABASE_URL pointing to a Supabase postgres instance with:
 *   - migrations 0001 + 0002 applied
 *   - auth.uid() function available (Supabase, not plain postgres)
 *
 * Skips gracefully when DATABASE_URL is not set or auth.uid() is unavailable.
 *
 * Probe technique (D13-T2): SET LOCAL role = authenticated + request.jwt.claims
 * to impersonate a user within a transaction, verifying cross-tenant rows are
 * invisible. Covers all D9–D12 tables per BL-0029.
 */
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const { Client } = pg;

const dbUrl = process.env['DATABASE_URL'];

// Fixed test user / org UUIDs — never exist in production data
const USER_A = '00000000-0000-0000-0000-00000000000a';
const USER_B = '00000000-0000-0000-0000-00000000000b';
const ORG_A = '00000000-0000-0000-0000-000000000001';

// D9–D12 fixture row IDs
const PORTFOLIO_A = '00000000-0000-0000-0000-0000000000a1';
const PROPERTY_A = '00000000-0000-0000-0000-0000000000a2';
const SCENARIO_A = '00000000-0000-0000-0000-0000000000a3';
const SCENARIO_RESULT_A = '00000000-0000-0000-0000-0000000000a4';
const AI_INTERACTION_A = '00000000-0000-0000-0000-0000000000a5';
const REPORT_JOB_A = '00000000-0000-0000-0000-0000000000a6';
const TAX_RULE_SET_ID = 'rls-probe-trs-v99';

async function queryAs(
  client: InstanceType<typeof Client>,
  uid: string,
  sql: string,
  params: unknown[] = [],
): Promise<pg.QueryResult> {
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL role TO authenticated');
    await client.query(`SELECT pg_catalog.set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: uid }),
    ]);
    const result = await client.query(sql, params);
    await client.query('ROLLBACK');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

describe.skipIf(!dbUrl)('Cross-tenant RLS probe', () => {
  let client: InstanceType<typeof Client>;
  let supportsAuth = false;

  beforeAll(async () => {
    client = new Client({ connectionString: dbUrl });
    await client.connect();

    const { rows } = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'auth' AND p.proname = 'uid'
      ) AS exists
    `);
    supportsAuth = rows[0]?.exists ?? false;

    if (!supportsAuth) return;

    // ── organisations + membership (baseline) ────────────────────────────
    await client.query(
      `INSERT INTO organisations (id, name, created_by)
       VALUES ($1, 'Org A (rls-probe)', $2)
       ON CONFLICT DO NOTHING`,
      [ORG_A, USER_A],
    );

    await client.query(
      `INSERT INTO user_org_membership (user_id, org_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT DO NOTHING`,
      [USER_A, ORG_A],
    );

    // ── D9: portfolios ────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO portfolios (id, org_id, user_id, name)
       VALUES ($1, $2, $3, 'RLS probe portfolio')
       ON CONFLICT DO NOTHING`,
      [PORTFOLIO_A, ORG_A, USER_A],
    );

    // ── D9: properties ────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO properties
         (id, portfolio_id, org_id, user_id, address_line1, suburb,
          state, postcode, property_type, purchase_date, purchase_price_cents)
       VALUES ($1, $2, $3, $4, '1 Probe St', 'Probeville',
         'VIC', '3000', 'house', '2020-01-01', 50000000)
       ON CONFLICT DO NOTHING`,
      [PROPERTY_A, PORTFOLIO_A, ORG_A, USER_A],
    );

    // ── D10: scenarios (property_id set — exercises org-member branch) ──
    await client.query(
      `INSERT INTO scenarios (id, user_id, property_id, label, input_payload)
       VALUES ($1, $2, $3, 'RLS probe scenario', '{}')
       ON CONFLICT DO NOTHING`,
      [SCENARIO_A, USER_A, PROPERTY_A],
    );

    // ── D10: scenario_results ─────────────────────────────────────────────
    // Partitioned table — delete then insert for deterministic row count.
    await client.query(
      `INSERT INTO tax_rule_sets
         (id, financial_year, jurisdiction, version, status, effective_from, rules, authored_by)
       VALUES ($1, 'FY2026', 'VIC', 99, 'draft', '2026-01-01', '{}', $2)
       ON CONFLICT DO NOTHING`,
      [TAX_RULE_SET_ID, USER_A],
    );

    await client.query(`DELETE FROM scenario_results WHERE id = $1`, [SCENARIO_RESULT_A]);
    await client.query(
      `INSERT INTO scenario_results
         (id, scenario_id, user_id, tax_rule_set_id, input_hash, engine_version)
       VALUES ($1, $2, $3, $4, 'rls-probe-hash', '0.1.0')`,
      [SCENARIO_RESULT_A, SCENARIO_A, USER_A, TAX_RULE_SET_ID],
    );

    // ── D11: ai_interactions ──────────────────────────────────────────────
    await client.query(
      `INSERT INTO ai_interactions
         (id, user_id, scenario_result_id, template_id, model,
          prompt_hash, context_hash, response_raw, schema_valid,
          leak_detected, fallback_used, latency_ms, tokens_in, tokens_out, cost_cents)
       VALUES ($1, $2, '00000000-0000-0000-0000-000000000099',
         'cgt-explain', 'claude-sonnet-4-5', 'ph', 'ch', '{}',
         true, false, false, 500, 100, 50, 10)
       ON CONFLICT DO NOTHING`,
      [AI_INTERACTION_A, USER_A],
    );

    // ── D12: report_jobs ──────────────────────────────────────────────────
    await client.query(
      `INSERT INTO report_jobs (id, user_id, template_id, format, scope, status)
       VALUES ($1, $2, 'portfolio-summary', 'csv', '{}', 'queued')
       ON CONFLICT DO NOTHING`,
      [REPORT_JOB_A, USER_A],
    );
  });

  afterAll(async () => {
    if (supportsAuth && client) {
      // Delete in dependency order: no-cascade tables first, then cascade from org
      await client.query(`DELETE FROM ai_interactions WHERE id = $1`, [AI_INTERACTION_A]);
      await client.query(`DELETE FROM report_jobs WHERE id = $1`, [REPORT_JOB_A]);
      await client.query(`DELETE FROM user_org_membership WHERE user_id = $1`, [USER_A]);
      // CASCADE: organisations → portfolios → properties → scenarios → scenario_results
      await client.query(`DELETE FROM organisations WHERE id = $1`, [ORG_A]);
      // tax_rule_set can only be removed after scenario_results (cascade above)
      await client.query(`DELETE FROM tax_rule_sets WHERE id = $1`, [TAX_RULE_SET_ID]);
    }
    await client?.end();
  });

  const noAuth = 'auth.uid() unavailable — run against Supabase staging, not plain postgres';

  // ── organisations ─────────────────────────────────────────────────────────

  it("user B cannot see user A's organisation", async () => {
    if (!supportsAuth) {
      console.log(`  SKIP: ${noAuth}`);
      return;
    }
    const { rows } = await queryAs(client, USER_B, 'SELECT id FROM organisations WHERE id = $1', [
      ORG_A,
    ]);
    expect(rows.length, "cross-tenant probe: user B must see 0 rows from user A's org").toBe(0);
  });

  it('user A can see their own organisation', async () => {
    if (!supportsAuth) {
      console.log(`  SKIP: ${noAuth}`);
      return;
    }
    const { rows } = await queryAs(client, USER_A, 'SELECT id FROM organisations WHERE id = $1', [
      ORG_A,
    ]);
    expect(rows.length, 'user A must see their own org').toBe(1);
  });

  // ── portfolios (D9) ───────────────────────────────────────────────────────

  it("user B cannot see user A's portfolio", async () => {
    if (!supportsAuth) {
      console.log(`  SKIP: ${noAuth}`);
      return;
    }
    const { rows } = await queryAs(client, USER_B, 'SELECT id FROM portfolios WHERE id = $1', [
      PORTFOLIO_A,
    ]);
    expect(rows.length, "cross-tenant probe: user B must see 0 rows from user A's portfolio").toBe(
      0,
    );
  });

  it('user A can see their own portfolio', async () => {
    if (!supportsAuth) {
      console.log(`  SKIP: ${noAuth}`);
      return;
    }
    const { rows } = await queryAs(client, USER_A, 'SELECT id FROM portfolios WHERE id = $1', [
      PORTFOLIO_A,
    ]);
    expect(rows.length, 'user A must see their own portfolio').toBe(1);
  });

  // ── properties (D9) ───────────────────────────────────────────────────────

  it("user B cannot see user A's property", async () => {
    if (!supportsAuth) {
      console.log(`  SKIP: ${noAuth}`);
      return;
    }
    const { rows } = await queryAs(client, USER_B, 'SELECT id FROM properties WHERE id = $1', [
      PROPERTY_A,
    ]);
    expect(rows.length, "cross-tenant probe: user B must see 0 rows from user A's property").toBe(
      0,
    );
  });

  it('user A can see their own property', async () => {
    if (!supportsAuth) {
      console.log(`  SKIP: ${noAuth}`);
      return;
    }
    const { rows } = await queryAs(client, USER_A, 'SELECT id FROM properties WHERE id = $1', [
      PROPERTY_A,
    ]);
    expect(rows.length, 'user A must see their own property').toBe(1);
  });

  // ── scenarios (D10) ───────────────────────────────────────────────────────

  it("user B cannot see user A's scenario", async () => {
    if (!supportsAuth) {
      console.log(`  SKIP: ${noAuth}`);
      return;
    }
    const { rows } = await queryAs(client, USER_B, 'SELECT id FROM scenarios WHERE id = $1', [
      SCENARIO_A,
    ]);
    expect(rows.length, "cross-tenant probe: user B must see 0 rows from user A's scenario").toBe(
      0,
    );
  });

  it('user A can see their own scenario', async () => {
    if (!supportsAuth) {
      console.log(`  SKIP: ${noAuth}`);
      return;
    }
    const { rows } = await queryAs(client, USER_A, 'SELECT id FROM scenarios WHERE id = $1', [
      SCENARIO_A,
    ]);
    expect(rows.length, 'user A must see their own scenario').toBe(1);
  });

  // ── scenario_results (D10) ────────────────────────────────────────────────

  it("user B cannot see user A's scenario result", async () => {
    if (!supportsAuth) {
      console.log(`  SKIP: ${noAuth}`);
      return;
    }
    const { rows } = await queryAs(
      client,
      USER_B,
      'SELECT id FROM scenario_results WHERE id = $1',
      [SCENARIO_RESULT_A],
    );
    expect(
      rows.length,
      "cross-tenant probe: user B must see 0 rows from user A's scenario result",
    ).toBe(0);
  });

  it('user A can see their own scenario result', async () => {
    if (!supportsAuth) {
      console.log(`  SKIP: ${noAuth}`);
      return;
    }
    const { rows } = await queryAs(
      client,
      USER_A,
      'SELECT id FROM scenario_results WHERE id = $1',
      [SCENARIO_RESULT_A],
    );
    expect(rows.length, 'user A must see their own scenario result').toBe(1);
  });

  // ── ai_interactions (D11) ─────────────────────────────────────────────────

  it("user B cannot see user A's AI interaction", async () => {
    if (!supportsAuth) {
      console.log(`  SKIP: ${noAuth}`);
      return;
    }
    const { rows } = await queryAs(client, USER_B, 'SELECT id FROM ai_interactions WHERE id = $1', [
      AI_INTERACTION_A,
    ]);
    expect(
      rows.length,
      "cross-tenant probe: user B must see 0 rows from user A's AI interaction",
    ).toBe(0);
  });

  it('user A can see their own AI interaction', async () => {
    if (!supportsAuth) {
      console.log(`  SKIP: ${noAuth}`);
      return;
    }
    const { rows } = await queryAs(client, USER_A, 'SELECT id FROM ai_interactions WHERE id = $1', [
      AI_INTERACTION_A,
    ]);
    expect(rows.length, 'user A must see their own AI interaction').toBe(1);
  });

  // ── report_jobs (D12) ─────────────────────────────────────────────────────

  it("user B cannot see user A's report job", async () => {
    if (!supportsAuth) {
      console.log(`  SKIP: ${noAuth}`);
      return;
    }
    const { rows } = await queryAs(client, USER_B, 'SELECT id FROM report_jobs WHERE id = $1', [
      REPORT_JOB_A,
    ]);
    expect(rows.length, "cross-tenant probe: user B must see 0 rows from user A's report job").toBe(
      0,
    );
  });

  it('user A can see their own report job', async () => {
    if (!supportsAuth) {
      console.log(`  SKIP: ${noAuth}`);
      return;
    }
    const { rows } = await queryAs(client, USER_A, 'SELECT id FROM report_jobs WHERE id = $1', [
      REPORT_JOB_A,
    ]);
    expect(rows.length, 'user A must see their own report job').toBe(1);
  });
});
