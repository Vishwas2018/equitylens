import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Money } from '@/components/money';

import { getApiSession } from '../../../../server/auth/api-guard';
import { getLatestScenarioResult, getScenario } from '../../../../server/data/scenarios';

import { AiExplanation } from './ai-explanation';
import { RunTrigger } from './run-trigger';

// ── BL-0025 provisional warning ───────────────────────────────────────────────
// Shown on every result display where ruleset_status !== 'published'.
// Today this is always shown (all repo rulesets are 'draft' per ADR-0011).

function ProvisionalWarning({
  rulesetStatus,
  rulesetVersion,
}: {
  rulesetStatus: string;
  rulesetVersion: string;
}) {
  if (rulesetStatus === 'published') return null;
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-muted)] px-[var(--space-4)] py-[var(--space-3)]"
    >
      <p className="[font-size:var(--text-xs)] text-[var(--fg-muted)]">
        <strong className="text-[var(--fg-default)]">
          Provisional estimate — {rulesetStatus} rules ({rulesetVersion}).
        </strong>{' '}
        This calculation uses a ruleset that has not been published. Figures are estimates only and
        must not be relied upon for tax decisions. Consult a qualified tax adviser before acting on
        this output.
      </p>
    </div>
  );
}

// ── Result row helper ─────────────────────────────────────────────────────────

function ResultRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-[var(--space-2)]">
      <span className="[font-size:var(--text-sm)] text-[var(--fg-muted)]">{label}</span>
      <span className="[font-size:var(--text-sm)] font-medium tabular-nums text-[var(--fg-default)]">
        {value}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ScenarioDetailPage({ params }: Props) {
  const { id } = await params;
  const sess = await getApiSession();
  if (!sess) redirect('/sign-in');

  const { data: scenario, error } = await getScenario(id, sess);

  // Cross-tenant probe returns 404 — user_id scoping ensures no hint of existence.
  if (error || !scenario) return notFound();

  const { data: result } = await getLatestScenarioResult(id, sess);

  const payload = result?.result_payload;

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/scenarios"
            className="[font-size:var(--text-xs)] text-[var(--fg-muted)] hover:underline"
          >
            ← Scenarios
          </Link>
          <h1 className="mt-[var(--space-1)] [font-size:var(--text-2xl)] font-semibold text-[var(--fg-default)]">
            {scenario.label}
          </h1>
          <p className="[font-size:var(--text-sm)] text-[var(--fg-muted)]">
            Created{' '}
            {new Date(scenario.created_at).toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {payload ? (
        <>
          {/* BL-0025: provisional warning — always shown while ruleset_status !== 'published' */}
          <ProvisionalWarning
            rulesetStatus={payload.ruleset_status}
            rulesetVersion={result.tax_rule_set_id}
          />

          {/* Summary */}
          <section
            aria-label="CGT result summary"
            className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-5)]"
          >
            <h2 className="mb-[var(--space-4)] [font-size:var(--text-base)] font-semibold text-[var(--fg-default)]">
              CGT estimate
            </h2>
            <div className="divide-y divide-[var(--border-muted)]">
              <ResultRow label="Days held" value={payload.daysHeld.toLocaleString()} />
              <ResultRow
                label="Cost base (element 1–5)"
                value={<Money cents={Number(payload.totalCostBaseCents)} />}
              />
              <ResultRow
                label="Net proceeds"
                value={<Money cents={Number(payload.netProceedsCents)} />}
              />
              <ResultRow
                label={payload.isCapitalLoss ? 'Capital loss' : 'Gross capital gain'}
                value={<Money cents={Number(payload.grossGainCents)} />}
              />
              <ResultRow
                label="CGT discount eligible"
                value={payload.discountEligible ? 'Yes' : 'No'}
              />
              {payload.isPreCgtAsset && (
                <ResultRow label="Pre-CGT asset" value="Exempt — acquired before 20 Sep 1985" />
              )}
            </div>
          </section>

          {/* Per-owner breakdown */}
          {payload.owners.length > 0 && (
            <section
              aria-label="Per-owner CGT breakdown"
              className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)]"
            >
              <div className="border-b border-[var(--border-default)] px-[var(--space-5)] py-[var(--space-4)]">
                <h2 className="[font-size:var(--text-base)] font-semibold text-[var(--fg-default)]">
                  Per-owner breakdown
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full [font-size:var(--text-sm)]">
                  <thead>
                    <tr className="border-b border-[var(--border-muted)]">
                      <th
                        scope="col"
                        className="px-[var(--space-5)] py-[var(--space-3)] text-left font-medium text-[var(--fg-subtle)]"
                      >
                        Entity
                      </th>
                      <th
                        scope="col"
                        className="px-[var(--space-5)] py-[var(--space-3)] text-right font-medium text-[var(--fg-subtle)]"
                      >
                        Gross gain
                      </th>
                      <th
                        scope="col"
                        className="px-[var(--space-5)] py-[var(--space-3)] text-right font-medium text-[var(--fg-subtle)]"
                      >
                        Discount applied
                      </th>
                      <th
                        scope="col"
                        className="px-[var(--space-5)] py-[var(--space-3)] text-right font-medium text-[var(--fg-subtle)]"
                      >
                        Taxable gain
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.owners.map((owner, i) => (
                      <tr key={i} className="border-b border-[var(--border-muted)]">
                        <td className="px-[var(--space-5)] py-[var(--space-3)] capitalize">
                          {owner.entityType}
                          <span className="ml-[var(--space-1)] [font-size:var(--text-xs)] text-[var(--fg-muted)]">
                            ({(owner.shareBps / 100).toFixed(0)}%)
                          </span>
                        </td>
                        <td className="px-[var(--space-5)] py-[var(--space-3)] text-right tabular-nums">
                          <Money cents={Number(owner.ownerGrossGainCents)} />
                        </td>
                        <td className="px-[var(--space-5)] py-[var(--space-3)] text-right tabular-nums text-[var(--fg-muted)]">
                          <Money cents={Number(owner.ownerDiscountAppliedCents)} />
                        </td>
                        <td className="px-[var(--space-5)] py-[var(--space-3)] text-right tabular-nums font-medium">
                          <Money cents={Number(owner.ownerTaxableGainCents)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* AI explanation — doubly provisional (draft rules + model-generated) */}
          <section
            aria-label="AI-generated plain-English explanation"
            className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-5)]"
          >
            <h2 className="mb-[var(--space-4)] [font-size:var(--text-base)] font-semibold text-[var(--fg-default)]">
              Plain-English explanation
            </h2>
            <AiExplanation scenarioId={scenario.id} />
          </section>

          {/* Ruleset metadata */}
          <section
            aria-label="Calculation metadata"
            className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-5)]"
          >
            <h2 className="mb-[var(--space-4)] [font-size:var(--text-base)] font-semibold text-[var(--fg-default)]">
              Calculation details
            </h2>
            <div className="divide-y divide-[var(--border-muted)]">
              <ResultRow label="Ruleset version" value={result.tax_rule_set_id} />
              <ResultRow label="Ruleset status" value={payload.ruleset_status} />
              <ResultRow label="Engine version" value={result.engine_version} />
              <ResultRow
                label="Computed"
                value={new Date(result.created_at).toLocaleString('en-AU')}
              />
            </div>
          </section>
        </>
      ) : (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-[var(--space-4)] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-6)] text-center">
          <RunTrigger scenarioId={scenario.id} />
        </div>
      )}
    </div>
  );
}
