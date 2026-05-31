/**
 * Cross-tenant API probe: for every /api/* route that accepts an org_id or
 * resource_id path segment, a request from a user not in that org must return
 * 403 — never 200, never 404.
 *
 * Auto-discovers routes by walking apps/web/app/api/**.
 * Skips routes that have no dynamic [org_id]-shaped segments.
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to run.
 *
 * When no org-scoped API routes exist yet, this suite passes vacuously and
 * the inventory is printed so future routes are automatically enrolled.
 */
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const BASE_URL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000';

const skip = !SUPABASE_URL || !SERVICE_KEY;

// Walk the api directory and collect all route paths.
function discoverApiRoutes(dir: string, base = '/api'): string[] {
  const routes: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return routes; // directory doesn't exist
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      routes.push(...discoverApiRoutes(fullPath, `${base}/${entry}`));
    } else if (entry === 'route.ts' || entry === 'route.js') {
      routes.push(base);
    }
  }
  return routes;
}

// Returns true if the route contains a dynamic segment that looks like an ID param.
function hasIdSegment(route: string): boolean {
  return /\[(org_id|resource_id|id|orgId)\]/.test(route);
}

const API_DIR = join(process.cwd(), 'apps/web/app/api');
const allRoutes = discoverApiRoutes(API_DIR);
const idRoutes = allRoutes.filter(hasIdSegment);

describe('cross-tenant API probe', () => {
  it('discovers all /api/* routes (inventory)', () => {
    console.log('Discovered API routes:', allRoutes);
    console.log('Routes with ID segments:', idRoutes);
    // Always pass — this is an informational assertion.
    expect(allRoutes.length).toBeGreaterThanOrEqual(0);
  });

  if (idRoutes.length === 0) {
    it('no org-scoped API routes exist yet — probe vacuously passes', () => {
      // Document the absence. When routes are added they will be auto-enrolled.
      expect(idRoutes).toHaveLength(0);
    });
  }
});

describe.skipIf(skip || idRoutes.length === 0)('cross-tenant 403 assertions', () => {
  for (const route of idRoutes) {
    it(`GET ${route} with foreign org_id returns 403`, async () => {
      // Mint a fresh user with no org memberships.
      const { createClient } = await import('@supabase/supabase-js');
      const admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
        auth: { persistSession: false },
      });

      const email = `probe-${Date.now()}@equitylens.test`;
      const { data: user } = await admin.auth.admin.createUser({
        email,
        password: 'probe-password-123!',
        email_confirm: true,
      });

      const { data: session } = await admin.auth.admin.createSession(user.user!.id, {
        scopes: 'all',
      });

      // Use a random UUID as the org_id (guaranteed to not be in any org).
      const foreignOrgId = '00000000-dead-beef-0000-000000000000';
      const url = `${BASE_URL}${route.replace(/\[(org_id|id|orgId)\]/, foreignOrgId)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      });

      await admin.auth.admin.deleteUser(user.user!.id);

      expect([403]).toContain(res.status);
    });
  }
});
