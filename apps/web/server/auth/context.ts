/** Minimal interface satisfied by pg.Client, pg.PoolClient, and compatible DB clients. */
interface PgClient {
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

/**
 * Wraps a callback in a pg transaction with Supabase-compatible RLS context.
 *
 * Sets:
 *   SET LOCAL role TO authenticated
 *   request.jwt.claims = {"sub": userId}  — makes auth.uid() resolve correctly
 *   request.session_user_id = userId      — custom audit tracking
 *
 * Usage: caller is responsible for providing a pooled pg client.
 */
export async function withUserContext<T>(
  userId: string,
  client: PgClient,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL role TO authenticated');
    await client.query("SELECT pg_catalog.set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId }),
    ]);
    await client.query("SELECT pg_catalog.set_config('request.session_user_id', $1, true)", [
      userId,
    ]);
    const result = await fn();
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
