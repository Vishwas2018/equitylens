'use server';

import { createActionClient } from '../../auth/actionClient';

export async function setBetaAck(): Promise<{ error: string | null }> {
  const supabase = await createActionClient();
  const { error } = await supabase.auth.updateUser({ data: { beta_ack: true } });
  if (error) return { error: error.message };

  // updateUser writes to the DB but does not re-issue the JWT. Without a refresh here,
  // getBetaAcked() in the layout decodes the stale JWT (no beta_ack) and the modal loops.
  const { error: refreshError } = await supabase.auth.refreshSession();
  return { error: refreshError?.message ?? null };
}
