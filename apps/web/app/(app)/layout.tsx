import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { BetaAckModal } from '@/components/shell/beta-ack-modal';
import { BetaBanner } from '@/components/shell/beta-banner';
import { RulesetStatusBanner } from '@/components/shell/ruleset-status-banner';
import { SideNav } from '@/components/shell/side-nav';
import { TopBar } from '@/components/shell/top-bar';

async function getBetaAcked(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Layout Server Components cannot write cookies; swallow the error so that
          // an implicit token refresh inside getUser() does not silently consume the
          // refresh token (leaving the browser with a dead cookie on the next request).
          // Token rotation is authoritative in middleware which has a writable setAll.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Expected in RSC context — cookies() is read-only here.
          }
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.user_metadata?.['beta_ack'] === true;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const betaAcked = await getBetaAcked();

  return (
    <>
      <TopBar />
      {/* BL-0025: banner slot — wired now, reads ruleset_status post D08-T4 */}
      <RulesetStatusBanner status="draft" rulesetLabel="FY2026" />
      <SideNav />
      <main
        className="ml-56 mt-14 min-h-[calc(100dvh-3.5rem)] bg-[var(--bg-page)]"
        id="main-content"
      >
        {/* D16-A4: persistent beta banner — not dismissible */}
        <BetaBanner />
        <div className="p-(--space-6)">{children}</div>
      </main>
      {/* D16-A3: block all routes until beta ack persisted to user_metadata */}
      {!betaAcked && <BetaAckModal />}
    </>
  );
}
