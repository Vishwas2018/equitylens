import { BarChart3 } from 'lucide-react';

import { cn } from '@/lib/utils';

interface TopBarProps {
  orgName?: string;
  className?: string;
}

export function TopBar({ orgName, className }: TopBarProps) {
  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 flex h-14 items-center border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-[var(--space-4)]',
        className,
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-[var(--space-2)]">
        <BarChart3 size={20} className="text-[var(--color-accent-600)]" aria-hidden="true" />
        <span className="text-[var(--text-md)] font-semibold text-[var(--fg-default)]">
          EquityLens
        </span>
      </div>

      {/* Org name */}
      {orgName && (
        <>
          <span className="mx-[var(--space-3)] text-[var(--fg-subtle)]" aria-hidden="true">
            /
          </span>
          <span className="text-[var(--text-sm)] text-[var(--fg-muted)]">{orgName}</span>
        </>
      )}
    </header>
  );
}
