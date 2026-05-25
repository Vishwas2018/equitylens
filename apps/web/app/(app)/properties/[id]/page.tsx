import { notFound, redirect } from 'next/navigation';

import { Chart } from '@/components/charts/chart';
import { Money } from '@/components/money';
import { Badge } from '@/components/ui/badge';

import { getApiSession } from '../../../../server/auth/api-guard';
import { getProperty } from '../../../../server/data/properties';

// ── Forecast generation ───────────────────────────────────────────────────────

function generateEquityForecast(
  purchasePriceCents: number,
  currentValueCents: number,
  stampDutyCents: number,
  acquisitionCostsCents: number,
  years = 30,
) {
  const totalCostBase = purchasePriceCents + stampDutyCents + acquisitionCostsCents;
  return Array.from({ length: years + 1 }, (_, i) => {
    const v = currentValueCents * Math.pow(1.065, i);
    return {
      year: i === 0 ? 'Now' : `Y+${i}`,
      value: Math.round(v / 100),
      costBase: Math.round(totalCostBase / 100),
      equity: Math.round((v - totalCostBase) / 100),
    };
  });
}

function generateCashflowForecast(purchasePriceCents: number, years = 30) {
  const weeklyRentCents = purchasePriceCents * 0.000038; // ~2% gross yield p.a. assumption
  return Array.from({ length: years + 1 }, (_, i) => {
    const annualRent = Math.round((weeklyRentCents * 52 * Math.pow(1.03, i)) / 100);
    const annualExpenses = Math.round(annualRent * 0.35);
    const netCashflow = annualRent - annualExpenses;
    return {
      year: i === 0 ? 'Now' : `Y+${i}`,
      rent: annualRent,
      expenses: annualExpenses,
      net: netCashflow,
    };
  });
}

// ── Assumptions panel ─────────────────────────────────────────────────────────

function AssumptionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-[var(--space-2)]">
      <span className="[font-size:var(--text-sm)] text-[var(--fg-muted)]">{label}</span>
      <span className="[font-size:var(--text-sm)] font-medium text-[var(--fg-default)]">
        {value}
      </span>
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

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  params: { id: string };
}

export default async function PropertyDetailPage({ params }: Props) {
  const sess = await getApiSession();
  if (!sess) redirect('/sign-in');

  const { data: property, error } = await getProperty(params.id, sess);

  // Cross-tenant probe returns 404 — org_id scoping ensures no hint of existence.
  if (error || !property) return notFound();

  const purchasePriceCents = property.purchase_price_cents;
  const currentValueCents = property.current_estimated_value_cents ?? purchasePriceCents;
  const equityCents = currentValueCents - purchasePriceCents;

  const equityForecast = generateEquityForecast(
    purchasePriceCents,
    currentValueCents,
    property.stamp_duty_paid_cents,
    property.acquisition_costs_cents,
  );

  const cashflowForecast = generateCashflowForecast(purchasePriceCents);

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <Disclaimer />

      {/* Property header */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-5)]">
        <div className="flex flex-col gap-[var(--space-4)] sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-[var(--space-1)]">
            <div className="flex items-center gap-[var(--space-2)]">
              <Badge variant={property.status}>{property.status}</Badge>
              <span className="[font-size:var(--text-xs)] text-[var(--fg-muted)]">
                {property.property_type}
              </span>
            </div>
            <h1 className="[font-size:var(--text-2xl)] font-semibold text-[var(--fg-default)]">
              {property.address_line1}
            </h1>
            <p className="[font-size:var(--text-sm)] text-[var(--fg-muted)]">
              {property.suburb}, {property.state} {property.postcode}
            </p>
          </div>
          <div className="flex flex-col gap-[var(--space-4)] sm:items-end">
            <div className="flex flex-col gap-[var(--space-1)] sm:items-end">
              <span className="[font-size:var(--text-xs)] text-[var(--fg-muted)]">
                Est. current value
              </span>
              <span className="[font-size:var(--text-2xl)] font-semibold text-[var(--fg-default)]">
                <Money cents={currentValueCents} />
              </span>
            </div>
            <div className="flex gap-[var(--space-4)]">
              <div className="flex flex-col gap-[var(--space-1)]">
                <span className="[font-size:var(--text-xs)] text-[var(--fg-muted)]">
                  Purchase price
                </span>
                <span className="[font-size:var(--text-sm)] font-medium tabular-nums text-[var(--fg-default)]">
                  <Money cents={purchasePriceCents} />
                </span>
              </div>
              <div className="flex flex-col gap-[var(--space-1)]">
                <span className="[font-size:var(--text-xs)] text-[var(--fg-muted)]">Equity</span>
                <span className="[font-size:var(--text-sm)] font-medium tabular-nums text-[var(--fg-default)]">
                  <Money cents={equityCents} />
                </span>
              </div>
              <div className="flex flex-col gap-[var(--space-1)]">
                <span className="[font-size:var(--text-xs)] text-[var(--fg-muted)]">Purchased</span>
                <span className="[font-size:var(--text-sm)] font-medium text-[var(--fg-default)]">
                  {new Date(property.purchase_date).toLocaleDateString('en-AU', {
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts — two columns on large screens */}
      <div className="grid grid-cols-1 gap-[var(--space-6)] lg:grid-cols-2">
        {/* Equity forecast */}
        <section
          aria-label="30-year equity forecast"
          className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-5)]"
        >
          <h2 className="mb-[var(--space-4)] [font-size:var(--text-base)] font-semibold text-[var(--fg-default)]">
            30-year equity forecast
            <span className="ml-2 [font-size:var(--text-xs)] font-normal text-[var(--fg-muted)]">
              6.5% p.a. growth assumption
            </span>
          </h2>
          <Chart
            data={equityForecast}
            type="line"
            xKey="year"
            series={[
              { id: 'value', key: 'value', label: 'Value' },
              { id: 'equity', key: 'equity', label: 'Equity', dashed: true },
            ]}
            marker={{ fromIndex: 1 }}
            height={240}
            title="30-year equity forecast"
            description="Line chart showing estimated property value and equity over 30 years."
          />
        </section>

        {/* Cashflow forecast */}
        <section
          aria-label="30-year annual cashflow forecast"
          className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-5)]"
        >
          <h2 className="mb-[var(--space-4)] [font-size:var(--text-base)] font-semibold text-[var(--fg-default)]">
            Annual cashflow forecast
            <span className="ml-2 [font-size:var(--text-xs)] font-normal text-[var(--fg-muted)]">
              2% gross yield · 3% rent growth · 35% expenses
            </span>
          </h2>
          <Chart
            data={cashflowForecast}
            type="stacked-area"
            xKey="year"
            series={[
              { id: 'rent', key: 'rent', label: 'Rental income', stack: 'cashflow' },
              { id: 'expenses', key: 'expenses', label: 'Expenses', stack: 'cashflow' },
            ]}
            marker={{ fromIndex: 1 }}
            height={240}
            title="Annual cashflow forecast"
            description="Stacked area chart showing estimated rental income and expenses over 30 years."
          />
        </section>
      </div>

      {/* Assumptions panel */}
      <section
        aria-label="Property assumptions"
        className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-5)]"
      >
        <h2 className="mb-[var(--space-4)] [font-size:var(--text-base)] font-semibold text-[var(--fg-default)]">
          Property details
        </h2>
        <div className="divide-y divide-[var(--border-muted)]">
          <AssumptionRow label="Property type" value={property.property_type} />
          <AssumptionRow label="Ownership kind" value={property.ownership_kind} />
          <AssumptionRow
            label="Purchase price"
            value={new Intl.NumberFormat('en-AU', {
              style: 'currency',
              currency: 'AUD',
              maximumFractionDigits: 0,
            }).format(purchasePriceCents / 100)}
          />
          <AssumptionRow
            label="Stamp duty"
            value={new Intl.NumberFormat('en-AU', {
              style: 'currency',
              currency: 'AUD',
              maximumFractionDigits: 0,
            }).format(property.stamp_duty_paid_cents / 100)}
          />
          <AssumptionRow
            label="Acquisition costs"
            value={new Intl.NumberFormat('en-AU', {
              style: 'currency',
              currency: 'AUD',
              maximumFractionDigits: 0,
            }).format(property.acquisition_costs_cents / 100)}
          />
          <AssumptionRow
            label="Total cost base"
            value={new Intl.NumberFormat('en-AU', {
              style: 'currency',
              currency: 'AUD',
              maximumFractionDigits: 0,
            }).format(
              (purchasePriceCents +
                property.stamp_duty_paid_cents +
                property.acquisition_costs_cents) /
                100,
            )}
          />
          {property.notes && <AssumptionRow label="Notes" value={property.notes} />}
        </div>
      </section>
    </div>
  );
}
