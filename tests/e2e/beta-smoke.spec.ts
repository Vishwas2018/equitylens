/**
 * D16-DEPLOY smoke test — closed-beta staging validation.
 *
 * Run against staging:
 *   PLAYWRIGHT_BASE_URL=https://<deploy>.vercel.app \
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   npx playwright test tests/e2e/beta-smoke.spec.ts --reporter=line
 *
 * Pre-conditions (seeded by D16-DEPLOY):
 *   - smoke-test@equitylens.dev user exists, password SmokeTest2026!
 *   - Scenario 00000000-2222-0000-0000-000000000001 with a completed result (draft ruleset)
 *   - Supabase disable_signup=true
 *   - beta_invites row present for smoke-test@equitylens.dev
 */

import https from 'https';

import { expect, test } from '@playwright/test';

const SMOKE_EMAIL = 'smoke-test@equitylens.dev';
const SMOKE_PASS = 'SmokeTest2026!';
const SCENARIO_ID = '00000000-2222-0000-0000-000000000001';
const SMOKE_USER_ID = 'de9c4fb8-8f3e-414b-b9ec-2caecf8e2739';

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';

// Windows schannel TLS revocation check fails for external certs; disable for test helper only.
const tlsAgent = new https.Agent({ rejectUnauthorized: false });

async function signIn(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/sign-in');
  await page.fill('[name=email]', SMOKE_EMAIL);
  await page.fill('[name=password]', SMOKE_PASS);
  await page.click('[type=submit]');
  await page.waitForURL(/^(?!.*sign-in).*/, { timeout: 30_000 });
}

async function resetBetaAck(): Promise<void> {
  return new Promise((resolve, reject) => {
    const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
    const body = JSON.stringify({ data: { beta_ack: false } });
    const url = new URL(`${SUPABASE_URL}/auth/v1/admin/users/${SMOKE_USER_ID}`);
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
  await resetBetaAck();
  await signIn(page);

  const modal = page.locator('[role="dialog"][aria-modal="true"]');
  await expect(modal).toBeVisible({ timeout: 15_000 });
  await expect(modal).toContainText('UX');
  await expect(modal).toContainText('not rely on them for tax decisions');
});

// ── d–e) Acknowledge modal → banner appears and is sticky ─────────────────────

test('clicking acknowledge dismisses modal and shows sticky BETA banner', async ({ page }) => {
  await resetBetaAck();
  await signIn(page);

  const modal = page.locator('[role="dialog"][aria-modal="true"]');
  await expect(modal).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /I understand/i }).click();

  // Modal dismisses after router.refresh()
  await expect(modal).toBeHidden({ timeout: 20_000 });

  // BetaBanner is always-on — role="status" containing "BETA"
  const banner = page.locator('[role="status"]').filter({ hasText: 'BETA' });
  await expect(banner).toBeVisible({ timeout: 10_000 });

  // Verify banner survives scroll (sticky)
  await page.evaluate(() => window.scrollBy(0, 500));
  await expect(banner).toBeVisible();
});

// ── f) ProvisionalWarning renders on scenario result page ─────────────────────

test('ProvisionalWarning renders on scenario result page with draft ruleset', async ({ page }) => {
  await signIn(page);

  // Dismiss modal if showing (ack state may still be false from prior test)
  const modal = page.locator('[role="dialog"][aria-modal="true"]');
  if (await modal.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByRole('button', { name: /I understand/i }).click();
    await expect(modal).toBeHidden({ timeout: 20_000 });
  }

  await page.goto(`/scenarios/${SCENARIO_ID}`);

  const warning = page.locator('[role="alert"]').filter({ hasText: 'Provisional estimate' });
  await expect(warning).toBeVisible({ timeout: 15_000 });
  await expect(warning).toContainText('draft');
  await expect(warning).toContainText('not be relied upon for tax decisions');
});
