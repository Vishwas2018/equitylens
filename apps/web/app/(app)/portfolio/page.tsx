import { TrendingDown, TrendingUp } from 'lucide-react';
import { redirect } from 'next/navigation';

import { Chart } from '@/components/charts/chart';
import { Money } from '@/components/money';
import { Badge } from '@/components/ui/badge';

import { getApiSession } from '../../../server/auth/api-guard';
import { getPortfolios, getPortfolioSummary } from '../../../server/data/portfolios';
import { getProperties } from '../../../server/data/properties';

// ── Sub-components ────────────────────────────────────────────────────────────

interface KpiTileProps {
  label: string;
  value: React.ReactNode;
  trend?: 'up' | 'down';
  sub?: string;
}

function KpiTile({ label, value, trend, sub }: KpiTileProps) {
  return (
    <div className="flex flex-col gap-[var(--space-2)] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-5)]">
      <p className="[font-size:var(--text-sm)] text-[var(--fg-subtle)]">{label}</p>
      <p className="[font-size:var(--text-2xl)] font-semibold text-[var(--fg-default)]">{value}</p>
      {(sub ?? trend) && (
        <div className="flex items-center gap-[var(--space-1)] [font-size:var(--text-xs)] text-[var(--fg-muted)]">
          {trend === 'up' && <TrendingUp size={12} aria-hidden="true" />}
          {trend === 'down' && <TrendingDown size={12} aria-hidden="true" />}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  );
}

function Disclaimer() {
  return (
    <p className="rounded-[var(--radius-md)] border border-[var(--border-muted)] bg-[var(--bg-muted)] px-[var(--space-4)] py-[var(--space-3)] [font-size:var(--text-xs)] text-[var(--fg-muted)]">
      <strong>General information only.</strong> Projections are estimates based on assumptions and
      do not constitute financial advice. Consult a qualified financial adviser before making
      investment decisions.
    </p>
  );
}

// 6.5% growth / 3% debt reduction — labelled on chart, not hidden.
function generateEquityForecast(valueCents: number, debtCents: number, years = 10) {
  return Array.from({ length: years + 1 }, (_, i) => {
    const v = valueCents * Math.pow(1.065, i);
    const d = Math.max(0, debtCents * Math.pow(0.97, i));
    return {
      year: i === 0 ? 'Now' : `Y+${i}`,
      equity: Math.round((v - d) / 100),
      value: Math.round(v / 100),
      debt: Math.round(d / 100),
    };
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PortfolioPage() {
  const sess = await getApiSession();
  if (!sess) redirect('/sign-in');

  const { data: portfolios, error: portErr } = await getPortfolios(sess);
  if (portErr) throw new Error(portErr.message);

  if (!portfolios || portfolios.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-[var(--space-4)] text-center">
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
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="flex flex-col gap-[var(--space-2)]">
          <h1 className="[font-size:var(--text-2xl)] font-semibold text-[var(--fg-default)]">
            No properties yet
          </h1>
          <p className="max-w-sm [font-size:var(--text-sm)] text-[var(--fg-muted)]">
            Add your first investment property to start tracking equity, cash flow, and CGT
            scenarios.
          </p>
        </div>
      </div>
    );
  }

  const portfolio = portfolios[0]!;

  const [summaryResult, propertiesResult] = await Promise.all([
    getPortfolioSummary(portfolio.id, sess),
    getProperties(sess),
  ]);

  const summary = summaryResult.data;
  const properties = propertiesResult.data ?? [];

  const equityCents = summary?.estimated_equity_cents ?? 0;
  const debtCents = summary?.total_debt_cents ?? 0;
  const valueCents = summary?.total_value_cents ?? 0;
  const propertyCount = summary?.active_properties ?? 0;

  const forecastData = generateEquityForecast(valueCents, debtCents);

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <Disclaimer />

      <div className="flex items-baseline justify-between">
        <h1 className="[font-size:var(--text-2xl)] font-semibold text-[var(--fg-default)]">
          {portfolio.name}
        </h1>
        <Badge variant="draft">FY2026</Badge>
      </div>

      <div className="grid grid-cols-2 gap-[var(--space-4)] lg:grid-cols-4">
        <KpiTile
          label="Total equity"
          value={<Money cents={equityCents} />}
          trend="up"
          sub="estimated"
        />
        <KpiTile
          label="Total value"
          value={<Money cents={valueCents} />}
          sub={`${propertyCount} ${propertyCount === 1 ? 'property' : 'properties'}`}
        />
        <KpiTile
          label="Total debt"
          value={<Money cents={debtCents} />}
          trend="down"
          sub="outstanding"
        />
        <KpiTile
          label="LVR"
          value={valueCents > 0 ? `${((debtCents / valueCents) * 100).toFixed(1)}%` : '—'}
          sub="loan-to-value ratio"
        />
      </div>

      <section
        aria-label="10-year equity forecast"
        className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-5)]"
      >
        <h2 className="mb-[var(--space-4)] [font-size:var(--text-base)] font-semibold text-[var(--fg-default)]">
          10-year equity forecast
          <span className="ml-2 [font-size:var(--text-xs)] font-normal text-[var(--fg-muted)]">
            6.5% p.a. growth · 3% p.a. debt reduction
          </span>
        </h2>
        <Chart
          data={forecastData}
          type="line"
          xKey="year"
          series={[
            { id: 'equity', key: 'equity', label: 'Equity' },
            { id: 'value', key: 'value', label: 'Value', dashed: true },
            { id: 'debt', key: 'debt', label: 'Debt' },
          ]}
          marker={{ fromIndex: 1 }}
          height={280}
          title="10-year equity forecast"
          description="Line chart showing estimated equity, property value, and debt over 10 years."
        />
      </section>

      {properties.length > 0 && (
        <section
          aria-label="Properties"
          className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)]"
        >
          <div className="border-b border-[var(--border-default)] px-[var(--space-5)] py-[var(--space-4)]">
            <h2 className="[font-size:var(--text-base)] font-semibold text-[var(--fg-default)]">
              Properties
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
                    Address
                  </th>
                  <th
                    scope="col"
                    className="px-[var(--space-5)] py-[var(--space-3)] text-right font-medium text-[var(--fg-subtle)]"
                  >
                    Purchase price
                  </th>
                  <th
                    scope="col"
                    className="px-[var(--space-5)] py-[var(--space-3)] text-right font-medium text-[var(--fg-subtle)]"
                  >
                    Est. value
                  </th>
                  <th
                    scope="col"
                    className="px-[var(--space-5)] py-[var(--space-3)] text-left font-medium text-[var(--fg-subtle)]"
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-[var(--border-muted)] hover:bg-[var(--bg-muted)]"
                  >
                    <td className="px-[var(--space-5)] py-[var(--space-3)]">
                      <a
                        href={`/properties/${p.id}`}
                        className="font-medium text-[var(--fg-default)] hover:underline"
                      >
                        {p.address_line1}
                      </a>
                      <p className="[font-size:var(--text-xs)] text-[var(--fg-muted)]">
                        {p.suburb}, {p.state} {p.postcode}
                      </p>
                    </td>
                    <td className="px-[var(--space-5)] py-[var(--space-3)] text-right tabular-nums">
                      <Money cents={p.purchase_price_cents} />
                    </td>
                    <td className="px-[var(--space-5)] py-[var(--space-3)] text-right tabular-nums text-[var(--fg-muted)]">
                      {p.current_estimated_value_cents != null ? (
                        <Money cents={p.current_estimated_value_cents} />
                      ) : (
                        <span className="text-[var(--fg-subtle)]">—</span>
                      )}
                    </td>
                    <td className="px-[var(--space-5)] py-[var(--space-3)]">
                      <Badge variant={p.status}>{p.status}</Badge>
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
