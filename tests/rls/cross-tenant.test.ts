/**
 * Cross-tenant RLS probe: verifies that user A cannot read user B's org data.
 *
 * Requires DATABASE_URL pointing to a Supabase postgres instance with:
 *   - migrations 0001 + 0002 applied
 *   - auth.uid() function available (Supabase, not plain postgres)
 *
 * Skips gracefully when DATABASE_URL is not set or auth.uid() is unavailable.
 *
 * Probe technique: uses SET LOCAL role/request.jwt.claims to impersonate
 * a user within a transaction, verifying cross-tenant rows are invisible.
 */
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const { Client } = pg;

const dbUrl = process.env['DATABASE_URL'];

const USER_A = '00000000-0000-0000-0000-00000000000a';
const USER_B = '00000000-0000-0000-0000-00000000000b';
const ORG_A = '00000000-0000-0000-0000-000000000001';

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

    await client.query(
      `
      INSERT INTO organisations (id, name, created_by)
      VALUES ($1, 'Org A (rls-probe)', $2)
      ON CONFLICT (id) DO NOTHING
    `,
      [ORG_A, USER_A],
    );

    await client.query(
      `
      INSERT INTO user_org_membership (user_id, org_id, role)
      VALUES ($1, $2, 'owner')
      ON CONFLICT (user_id, org_id) DO NOTHING
    `,
      [USER_A, ORG_A],
    );
  });

  afterAll(async () => {
    if (supportsAuth && client) {
      await client.query(`DELETE FROM user_org_membership WHERE user_id = $1`, [USER_A]);
      await client.query(`DELETE FROM organisations WHERE id = $1`, [ORG_A]);
    }
    await client?.end();
  });

  it("user B cannot see user A's organisation", async () => {
    if (!supportsAuth) {
      console.log(
        '  SKIP: auth.uid() unavailable — run against Supabase staging, not plain postgres',
      );
      return;
    }

    const { rows } = await queryAs(client, USER_B, 'SELECT id FROM organisations WHERE id = $1', [
      ORG_A,
    ]);
    expect(rows.length, "cross-tenant probe: user B must see 0 rows from user A's org").toBe(0);
  });

  it('user A can see their own organisation', async () => {
    if (!supportsAuth) {
      console.log(
        '  SKIP: auth.uid() unavailable — run against Supabase staging, not plain postgres',
      );
      return;
    }

    const { rows } = await queryAs(client, USER_A, 'SELECT id FROM organisations WHERE id = $1', [
      ORG_A,
    ]);
    expect(rows.length, 'user A must see their own org').toBe(1);
  });
});
