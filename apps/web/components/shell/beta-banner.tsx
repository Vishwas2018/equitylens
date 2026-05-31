export function BetaBanner() {
  return (
    <div
      role="status"
      className="sticky top-14 z-30 flex items-center justify-center border-b border-[var(--color-accent-600)]/40 bg-[var(--color-accent-600)]/10 px-[var(--space-4)] py-[var(--space-1.5)]"
    >
      <p className="[font-size:var(--text-xs)] font-semibold text-[var(--color-accent-600)]">
        BETA &mdash; UX preview only. Not for tax decisions.
      </p>
    </div>
  );
}
