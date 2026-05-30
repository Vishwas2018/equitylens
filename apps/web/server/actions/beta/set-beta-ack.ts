'use server';

import { createActionClient } from '../../auth/actionClient';

export async function setBetaAck(): Promise<{ error: string | null }> {
  const supabase = await createActionClient();
  const { error } = await supabase.auth.updateUser({ data: { beta_ack: true } });
  return { error: error?.message ?? null };
}
