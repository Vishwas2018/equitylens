import { BarChart3 } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--bg-page)] px-[var(--space-4)] py-[var(--space-8)]">
      {/* Logo */}
      <div className="mb-[var(--space-6)] flex items-center gap-[var(--space-2)]">
        <BarChart3 size={22} className="text-[var(--color-accent-600)]" aria-hidden="true" />
        <span className="[font-size:var(--text-xl)] font-semibold text-[var(--fg-default)]">
          EquityLens
        </span>
      </div>
      {/* Auth card */}
      <div className="w-full max-w-[400px] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-6)] shadow-[var(--shadow-2)]">
        {children}
      </div>
    </div>
  );
}
