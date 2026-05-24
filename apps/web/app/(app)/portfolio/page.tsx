import { Building2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function PortfolioPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-[var(--space-4)] text-center">
      <div className="rounded-[var(--radius-lg)] bg-[var(--bg-muted)] p-[var(--space-5)]">
        <Building2 size={32} className="text-[var(--fg-subtle)]" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-[var(--space-2)]">
        <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--fg-default)]">
          No properties yet
        </h1>
        <p className="max-w-sm text-[var(--text-sm)] text-[var(--fg-muted)]">
          Add your first investment property to start tracking equity, cash flow, and CGT scenarios.
        </p>
      </div>
      <Button asChild>
        <a href="/properties/new">Add a property</a>
      </Button>
    </div>
  );
}
