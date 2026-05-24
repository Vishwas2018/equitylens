'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { acceptInvite } from '../../../../server/actions/org/acceptInvite';

import { Button } from '@/components/ui/button';

export default function AcceptInvitePage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    setLoading(true);
    setError(null);
    const result = await acceptInvite(token);
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
        Accept invitation
      </h1>
      <div className="flex flex-col gap-[var(--space-4)]">
        {error && (
          <p className="[font-size:var(--text-sm)] text-[var(--fg-negative)]" role="alert">
            {error}
          </p>
        )}
        <Button onClick={handleAccept} disabled={loading}>
          {loading ? 'Accepting…' : 'Accept invitation'}
        </Button>
      </div>
    </div>
  );
}
