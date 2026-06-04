/**
 * Verifies every table in the public schema has RLS enabled.
 * Requires DATABASE_URL pointing to a postgres instance with migrations applied.
 * Skips gracefully when DATABASE_URL is not set (e.g. standard unit-test runs).
 */
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const { Client } = pg;

const SCHEMA_TABLES = [
  'organisations',
  'user_org_membership',
  'subscriptions',
  'stripe_events',
  'usage_events',
  'portfolios',
  'properties',
  'property_ownership_splits',
  'property_ppor_history',
  'loans',
  'income_records',
  'expense_records',
  'depreciation_schedules',
  'depreciation_line_items',
  'tax_rule_sets',
  'scenarios',
  'scenario_results',
  'ai_interactions',
  'audit_logs',
  'report_jobs',
  'scheduled_reports',
];

const dbUrl = process.env['DATABASE_URL'];

describe.skipIf(!dbUrl)('RLS policy coverage', () => {
  let client: InstanceType<typeof Client>;

  beforeAll(async () => {
    client = new Client({ connectionString: dbUrl });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  it('all schema tables have RLS enabled', async () => {
    const { rows } = await client.query<{ relname: string; rowsecurity: boolean }>(`
      SELECT c.relname, c.relrowsecurity AS rowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
      ORDER BY c.relname
    `);

    const tableMap = Object.fromEntries(rows.map((r) => [r.relname, r.rowsecurity]));

    for (const table of SCHEMA_TABLES) {
      expect(tableMap[table], `${table} must have RLS enabled`).toBe(true);
    }
  });

  it('all schema tables have at least one policy', async () => {
    const { rows } = await client.query<{ tablename: string; count: string }>(`
      SELECT tablename, COUNT(*) AS count
      FROM pg_policies
      WHERE schemaname = 'public'
      GROUP BY tablename
    `);

    const policyMap = Object.fromEntries(rows.map((r) => [r.tablename, parseInt(r.count)]));

    const noPoliciesExpected = ['stripe_events'];

    for (const table of SCHEMA_TABLES) {
      if (noPoliciesExpected.includes(table)) continue;
      expect((policyMap[table] ?? 0) > 0, `${table} should have at least one RLS policy`).toBe(
        true,
      );
    }
  });
});
