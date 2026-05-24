import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getActiveOrgId } from './session';

export interface ApiSession {
  userId: string;
  accessToken: string;
  orgId: string;
}

/**
 * Resolves the caller's Supabase session + active org from cookies.
 * Returns null if unauthenticated or the user has no active org.
 */
export async function getApiSession(): Promise<ApiSession | null> {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Route handlers are read-only; token rotation handled by middleware.
        },
      },
    },
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const orgId = await getActiveOrgId(session.user.id, session.access_token);
  if (!orgId) return null;

  return { userId: session.user.id, accessToken: session.access_token, orgId };
}

export const unauthorised = () => NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
export const forbidden = () => NextResponse.json({ error: 'Forbidden' }, { status: 403 });
export const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 });
