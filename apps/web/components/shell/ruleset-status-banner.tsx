import { AlertTriangle } from 'lucide-react';

type RulesetStatus = 'draft' | 'published';

interface RulesetStatusBannerProps {
  status: RulesetStatus;
  rulesetLabel?: string;
}

export function RulesetStatusBanner({ status, rulesetLabel = 'FY2026' }: RulesetStatusBannerProps) {
  if (status === 'published') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-[var(--space-2)] border-b border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/10 px-[var(--space-4)] py-[var(--space-2)]"
    >
      <AlertTriangle
        size={14}
        className="shrink-0 text-[var(--color-warning-500)]"
        aria-hidden="true"
      />
      <p className="text-[var(--text-xs)] text-[var(--color-warning-500)]">
        <span className="font-semibold">Draft ruleset ({rulesetLabel}).</span> Tax calculations are
        estimates only — results will change when the ruleset is published.
      </p>
    </div>
  );
}
