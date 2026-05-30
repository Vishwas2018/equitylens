'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Button } from '@/components/ui/button';

import { switchOrg } from '../../../../server/actions/org/switchOrg';

function SwitchOrgContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const orgId = params.get('orgId') ?? '';

  async function handleSwitch() {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    const result = await switchOrg(orgId);
    if (result.error) {
      setError(result.error);
    } else {
      router.replace('/');
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-[var(--space-5)] [font-size:var(--text-2xl)] font-semibold text-[var(--fg-default)]">
        Switch organisation
      </h1>
      {orgId ? (
        <div className="flex flex-col gap-[var(--space-4)]">
          <p className="[font-size:var(--text-sm)] text-[var(--fg-muted)]">
            Switch to:{' '}
            <code className="rounded-[var(--radius-xs)] bg-[var(--bg-muted)] px-1.5 py-0.5 [font-size:var(--text-xs)] text-[var(--fg-default)]">
              {orgId}
            </code>
          </p>
          {error && (
            <p className="[font-size:var(--text-sm)] text-[var(--fg-negative)]" role="alert">
              {error}
            </p>
          )}
          <Button onClick={handleSwitch} disabled={loading}>
            {loading ? 'Switching…' : 'Confirm switch'}
          </Button>
        </div>
      ) : (
        <p className="[font-size:var(--text-sm)] text-[var(--fg-muted)]">No org specified.</p>
      )}
    </div>
  );
}

export default function SwitchOrgPage() {
  return (
    <Suspense fallback={null}>
      <SwitchOrgContent />
    </Suspense>
  );
}
