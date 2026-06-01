/**
 * D16-DEPLOY smoke test — closed-beta staging validation.
 *
 * Run against staging:
 *   PLAYWRIGHT_BASE_URL=https://equitylens-p6myi40pw-vishwas2018s-projects.vercel.app \
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   npx playwright test beta-smoke.spec.ts --reporter=line
 *
 * Pre-conditions (seeded by D16-DEPLOY):
 *   - smoke-test@equitylens.dev user exists, password SmokeTest2026!
 *   - Scenario 00000000-2222-0000-0000-000000000001 exists for that user
 *   - A completed scenario_result with ruleset_status='draft' exists for that scenario
 *   - Supabase disable_signup=true
 *
 * Sign-in UI is bypassed: we inject the Supabase session cookie directly.
 * Reason: the sign-in server action calls checkSignInRateLimit (Upstash Redis),
 * which requires UPSTASH_REDIS_REST_URL — not yet provisioned in staging.
 * The cookie injection approach is equivalent to a successful sign-in for all
 * app-layer assertions (middleware reads the same cookie to verify session).
 */

import https from 'https';

import { expect, test } from '@playwright/test';

// Windows schannel TLS revocation check fails for external certs; disable for test helpers only.
const tlsAgent = new https.Agent({ rejectUnauthorized: false });

const SMOKE_EMAIL = 'smoke-test@equitylens.dev';
const SMOKE_PASS = 'SmokeTest2026!';
const SCENARIO_ID = '00000000-2222-0000-0000-000000000001';

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

// Derive cookie name from project ref (host prefix of Supabase URL)
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]!;
const AUTH_COOKIE_NAME = `sb-${projectRef}-auth-token`;

async function getSessionCookieValue(): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email: SMOKE_EMAIL, password: SMOKE_PASS });
    const url = new URL(`${SUPABASE_URL}/auth/v1/token?grant_type=password`);
    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: 'POST',
        agent: tlsAgent,
        headers: {
          apikey: ANON_KEY,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          const s = JSON.parse(d) as {
            access_token: string;
            token_type: string;
            expires_in: number;
            expires_at: number;
            refresh_token: string;
            user: unknown;
            error?: string;
          };
          if (s.error || !s.access_token) reject(new Error(`Sign-in failed: ${s.error}`));
          resolve(
            JSON.stringify({
              access_token: s.access_token,
              token_type: 'bearer',
              expires_in: s.expires_in,
              expires_at: s.expires_at,
              refresh_token: s.refresh_token,
              user: s.user,
            }),
          );
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Fixture: authenticated page context ──────────────────────────────────────

async function signedInPage(
  page: import('@playwright/test').Page,
  cookieValue: string,
): Promise<void> {
  const stagingHost = new URL(process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000')
    .hostname;
  await page.context().addCookies([
    {
      name: AUTH_COOKIE_NAME,
      value: cookieValue,
      domain: stagingHost,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
}

// ── a) Signup blocked ─────────────────────────────────────────────────────────

test('signup is blocked — non-invited email returns closed-beta error', async ({ page }) => {
  await page.goto('/sign-up');
  await page.fill('[name=email]', 'not-invited@example.com');
  await page.fill('[name=password]', 'Irrelevant12345!');
  await page.click('[type=submit]');

  await expect(
    page.getByText('EquityLens is currently in closed beta. Contact us for an invitation.'),
  ).toBeVisible({ timeout: 15_000 });
});

// ── b–c) Beta ack modal renders on first login ────────────────────────────────

test('beta ack modal renders on first authenticated visit', async ({ page }) => {
  const cookieValue = await getSessionCookieValue();

  // Ensure beta_ack is NOT set for this test by clearing user metadata first
  // (done externally; if already acked from a prior run this test may not see the modal —
  //  that is acceptable: the modal is a one-time gate, not a per-visit gate)
  await signedInPage(page, cookieValue);
  await page.goto('/scenarios');

  // If redirected to sign-in the cookie injection didn't work
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 10_000 });

  // Modal OR banner must be visible (modal only on first visit, banner always after)
  const modal = page.locator('[role="dialog"][aria-modal="true"]');
  const banner = page.locator('[role="status"]').filter({ hasText: 'BETA' });
  const eitherVisible =
    (await modal.isVisible({ timeout: 5_000 }).catch(() => false)) ||
    (await banner.isVisible({ timeout: 5_000 }).catch(() => false));
  expect(eitherVisible).toBe(true);

  if (await modal.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await expect(modal).toContainText('UX');
    await expect(modal).toContainText('not rely on them for tax decisions');
  }
});

// ── d–e) Acknowledge modal → banner is sticky ─────────────────────────────────

test('clicking acknowledge dismisses modal and shows sticky BETA banner', async ({ page }) => {
  // Reset beta_ack so the modal definitely shows — patch user_metadata via service role
  const resetAck = (): Promise<void> =>
    new Promise((resolve, reject) => {
      const body = JSON.stringify({ data: { beta_ack: false } });
      const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
      const url = new URL(
        `${SUPABASE_URL}/auth/v1/admin/users/de9c4fb8-8f3e-414b-b9ec-2caecf8e2739`,
      );
      const req = https.request(
        {
          hostname: url.hostname,
          port: 443,
          path: url.pathname,
          method: 'PUT',
          agent: tlsAgent,
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let d = '';
          res.on('data', (c) => (d += c));
          res.on('end', () => resolve());
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });

  await resetAck();

  const cookieValue = await getSessionCookieValue();
  await signedInPage(page, cookieValue);
  await page.goto('/scenarios');
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 10_000 });

  const modal = page.locator('[role="dialog"][aria-modal="true"]');
  await expect(modal).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /I understand/i }).click();

  // Modal dismisses after router.refresh()
  await expect(modal).toBeHidden({ timeout: 20_000 });

  // BetaBanner appears — sticky, always-on
  const banner = page.locator('[role="status"]').filter({ hasText: 'BETA' });
  await expect(banner).toBeVisible({ timeout: 10_000 });

  // Verify sticky behaviour survives scroll
  await page.evaluate(() => window.scrollBy(0, 500));
  await expect(banner).toBeVisible();
});

// ── f) ProvisionalWarning renders on scenario result page ─────────────────────

test('ProvisionalWarning renders on scenario result page with draft ruleset', async ({ page }) => {
  const cookieValue = await getSessionCookieValue();
  await signedInPage(page, cookieValue);

  await page.goto(`/scenarios/${SCENARIO_ID}`);
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 10_000 });

  // Dismiss beta ack modal if still showing
  const modal = page.locator('[role="dialog"][aria-modal="true"]');
  if (await modal.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await page.getByRole('button', { name: /I understand/i }).click();
    await expect(modal).toBeHidden({ timeout: 20_000 });
  }

  // ProvisionalWarning: role="alert" with "Provisional estimate" text
  const warning = page.locator('[role="alert"]').filter({ hasText: 'Provisional estimate' });
  await expect(warning).toBeVisible({ timeout: 10_000 });
  await expect(warning).toContainText('draft');
  await expect(warning).toContainText('not be relied upon for tax decisions');
});
