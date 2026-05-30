'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { setBetaAck } from '@/server/actions/beta/set-beta-ack';

export function BetaAckModal() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAck() {
    setLoading(true);
    setError(null);
    const result = await setBetaAck();
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="beta-ack-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="mx-4 max-w-md rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-6)] shadow-xl">
        <div className="mb-[var(--space-5)] flex flex-col gap-[var(--space-2)]">
          <span className="inline-flex h-6 w-fit items-center rounded-full bg-[var(--color-warning-500)]/15 px-2 [font-size:var(--text-xs)] font-semibold text-[var(--color-warning-500)]">
            CLOSED BETA
          </span>
          <h2
            id="beta-ack-title"
            className="[font-size:var(--text-lg)] font-semibold text-[var(--fg-default)]"
          >
            Before you continue
          </h2>
        </div>

        <p className="mb-[var(--space-5)] [font-size:var(--text-sm)] leading-relaxed text-[var(--fg-muted)]">
          You are testing <strong className="text-[var(--fg-default)]">UX, not tax accuracy</strong>
          . All figures are provisional drafts pending legal and ATO verification.{' '}
          <strong className="text-[var(--fg-default)]">
            Do not rely on them for tax decisions.
          </strong>
        </p>

        <p className="mb-[var(--space-5)] [font-size:var(--text-xs)] text-[var(--fg-subtle)]">
          This is a UX preview only. Numbers, rates, and calculations will change before general
          availability. Always consult a qualified tax adviser for actual tax decisions.
        </p>

        {error && (
          <p
            className="mb-[var(--space-3)] [font-size:var(--text-sm)] text-[var(--fg-negative)]"
            role="alert"
          >
            {error}
          </p>
        )}

        <Button onClick={handleAck} disabled={loading} className="w-full">
          {loading ? 'Saving…' : 'I understand — continue to beta'}
        </Button>
      </div>
    </div>
  );
}
