'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RunTrigger({ scenarioId }: { scenarioId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/scenarios/${scenarioId}/run`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? 'Run failed. Please try again.');
        return;
      }
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-[var(--space-4)]">
      <p className="[font-size:var(--text-sm)] text-[var(--fg-muted)]">
        No result yet. Run the scenario to compute the CGT estimate.
      </p>
      {error && <p className="[font-size:var(--text-sm)] text-[var(--fg-muted)]">{error}</p>}
      <button
        onClick={run}
        disabled={running}
        className="rounded-[var(--radius-md)] bg-[var(--fg-default)] px-[var(--space-5)] py-[var(--space-2)] [font-size:var(--text-sm)] font-medium text-[var(--bg-page)] hover:opacity-90 disabled:opacity-50"
      >
        {running ? 'Running…' : 'Run scenario'}
      </button>
    </div>
  );
}
