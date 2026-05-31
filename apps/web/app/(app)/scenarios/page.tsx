import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';

import { getApiSession } from '../../../server/auth/api-guard';
import { getScenarios } from '../../../server/data/scenarios';

export default async function ScenariosPage() {
  const sess = await getApiSession();
  if (!sess) redirect('/sign-in');

  const { data: scenarios } = await getScenarios(sess);

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="[font-size:var(--text-2xl)] font-semibold text-[var(--fg-default)]">
            Scenarios
          </h1>
          <p className="mt-[var(--space-1)] [font-size:var(--text-sm)] text-[var(--fg-muted)]">
            CGT disposal scenarios — create a scenario to estimate capital gains tax.
          </p>
        </div>
        <Link
          href="/scenarios/new"
          className="rounded-[var(--radius-md)] bg-[var(--fg-default)] px-[var(--space-4)] py-[var(--space-2)] [font-size:var(--text-sm)] font-medium text-[var(--bg-page)] hover:opacity-90"
        >
          New scenario
        </Link>
      </div>

      {scenarios.length === 0 ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-[var(--space-4)] text-center">
          <div className="rounded-[var(--radius-lg)] bg-[var(--bg-muted)] p-[var(--space-5)]">
            <svg
              width={32}
              height={32}
              viewBox="0 0 24 24"
              fill="none"
              className="text-[var(--fg-subtle)]"
              aria-hidden="true"
            >
              <path
                d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M9 7h8l-2-2H9L7 7m2 0v8"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="flex flex-col gap-[var(--space-2)]">
            <h2 className="[font-size:var(--text-xl)] font-semibold text-[var(--fg-default)]">
              No scenarios yet
            </h2>
            <p className="max-w-sm [font-size:var(--text-sm)] text-[var(--fg-muted)]">
              Create a scenario to estimate CGT on a property disposal under FY2026 draft rules.
            </p>
          </div>
          <Link
            href="/scenarios/new"
            className="rounded-[var(--radius-md)] bg-[var(--fg-default)] px-[var(--space-4)] py-[var(--space-2)] [font-size:var(--text-sm)] font-medium text-[var(--bg-page)] hover:opacity-90"
          >
            New scenario
          </Link>
        </div>
      ) : (
        <section
          aria-label="Scenarios"
          className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)]"
        >
          <div className="overflow-x-auto">
            <table className="w-full [font-size:var(--text-sm)]">
              <thead>
                <tr className="border-b border-[var(--border-muted)]">
                  <th
                    scope="col"
                    className="px-[var(--space-5)] py-[var(--space-3)] text-left font-medium text-[var(--fg-subtle)]"
                  >
                    Scenario
                  </th>
                  <th
                    scope="col"
                    className="px-[var(--space-5)] py-[var(--space-3)] text-left font-medium text-[var(--fg-subtle)]"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    className="px-[var(--space-5)] py-[var(--space-3)] text-left font-medium text-[var(--fg-subtle)]"
                  >
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-[var(--border-muted)] hover:bg-[var(--bg-muted)]"
                  >
                    <td className="px-[var(--space-5)] py-[var(--space-3)]">
                      <Link
                        href={`/scenarios/${s.id}`}
                        className="font-medium text-[var(--fg-default)] hover:underline"
                      >
                        {s.label}
                      </Link>
                    </td>
                    <td className="px-[var(--space-5)] py-[var(--space-3)]">
                      <Badge variant="draft">CGT disposal</Badge>
                    </td>
                    <td className="px-[var(--space-5)] py-[var(--space-3)] tabular-nums text-[var(--fg-muted)]">
                      {new Date(s.created_at).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
