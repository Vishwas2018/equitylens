import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Creates a Supabase client for use inside Next.js server actions.
// Cookie reading and writing is wired to next/headers so token rotation works.
export function createActionClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );
}
