import { RulesetStatusBanner } from '@/components/shell/ruleset-status-banner';
import { SideNav } from '@/components/shell/side-nav';
import { TopBar } from '@/components/shell/top-bar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      {/* BL-0025: banner slot — wired now, reads ruleset_status post D08-T4 */}
      <RulesetStatusBanner status="draft" rulesetLabel="FY2026" />
      <SideNav />
      <main
        className="ml-56 mt-14 min-h-[calc(100dvh-3.5rem)] bg-[var(--bg-page)] p-[var(--space-6)]"
        id="main-content"
      >
        {children}
      </main>
    </>
  );
}
