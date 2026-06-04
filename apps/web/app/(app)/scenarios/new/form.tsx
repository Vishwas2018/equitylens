'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { PropertyRow } from '@/server/data/properties';

interface Props {
  properties: PropertyRow[];
}

const FINANCIAL_YEARS = [{ value: 'FY2026', label: 'FY2026 (draft)' }] as const;

function toCentString(dollars: string): string {
  const n = parseFloat(dollars);
  if (isNaN(n) || n < 0) return '0';
  return String(Math.round(n * 100));
}

export function ScenarioNewForm({ properties }: Props) {
  const router = useRouter();

  const [label, setLabel] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [fy, setFy] = useState<string>('FY2026');
  const [acquisitionDate, setAcquisitionDate] = useState('');
  const [disposalDate, setDisposalDate] = useState('');
  const [grossProceeds, setGrossProceeds] = useState('');
  const [sellingCosts, setSellingCosts] = useState('0');
  const [acquisitionPrice, setAcquisitionPrice] = useState('');
  const [entityType, setEntityType] = useState<'individual' | 'smsf' | 'company' | 'trust'>(
    'individual',
  );
  const [wasIncomeProducing, setWasIncomeProducing] = useState(false);
  const [isPreCgtAsset, setIsPreCgtAsset] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const inputPayload = {
        fy,
        asOfMs: Date.now(),
        horizonYears: 1,
        disposal: {
          acquisitionDateISO: acquisitionDate,
          disposalDateISO: disposalDate,
          grossProceedsCents: toCentString(grossProceeds),
          sellingCostsCents: toCentString(sellingCosts),
          costBase: {
            element1AcquisitionCents: toCentString(acquisitionPrice),
            element2IncidentalCents: '0',
            element3OwnershipCents: '0',
            element4ImprovementCents: '0',
            element5TitleCents: '0',
          },
          div43ClaimedCents: '0',
          wasIncomeProducing,
          priorYearCapitalLossesCents: '0',
          owners: [{ entityType, shareBps: 10000 }],
          isPreCgtAsset,
        },
      };

      const createRes = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          property_id: propertyId || undefined,
          input_payload: inputPayload,
        }),
      });

      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? 'Failed to create scenario.');
        return;
      }

      const { data: scenario } = (await createRes.json()) as { data: { id: string } };

      // Run immediately — idempotent so safe to re-trigger.
      const runRes = await fetch(`/api/scenarios/${scenario.id}/run`, { method: 'POST' });
      if (!runRes.ok) {
        // Run failure is non-fatal — user can retry from the detail page.
        console.warn('Scenario run failed on create:', runRes.status);
      }

      router.push(`/scenarios/${scenario.id}`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass =
    'w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-[var(--space-3)] py-[var(--space-2)] [font-size:var(--text-sm)] text-[var(--fg-default)] focus:outline-none focus:ring-2 focus:ring-[var(--border-strong)]';
  const labelClass = 'block [font-size:var(--text-sm)] font-medium text-[var(--fg-default)]';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-5)]">
      {error && (
        <p className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-muted)] px-[var(--space-4)] py-[var(--space-3)] [font-size:var(--text-sm)] text-[var(--fg-muted)]">
          {error}
        </p>
      )}

      {/* Scenario name */}
      <div className="flex flex-col gap-[var(--space-1)]">
        <label htmlFor="label" className={labelClass}>
          Scenario name <span aria-hidden="true">*</span>
        </label>
        <input
          id="label"
          type="text"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. 34 Oak Ave disposal — FY2026"
          className={fieldClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-[var(--space-5)] sm:grid-cols-2">
        {/* Property (optional) */}
        <div className="flex flex-col gap-[var(--space-1)]">
          <label htmlFor="property" className={labelClass}>
            Property <span className="font-normal text-[var(--fg-muted)]">(optional)</span>
          </label>
          <select
            id="property"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className={fieldClass}
          >
            <option value="">No property linked</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.address_line1}, {p.suburb}
              </option>
            ))}
          </select>
        </div>

        {/* Ruleset / financial year selector */}
        <div className="flex flex-col gap-[var(--space-1)]">
          <label htmlFor="fy" className={labelClass}>
            Financial year (ruleset)
          </label>
          <select id="fy" value={fy} onChange={(e) => setFy(e.target.value)} className={fieldClass}>
            {FINANCIAL_YEARS.map((yr) => (
              <option key={yr.value} value={yr.value}>
                {yr.label}
              </option>
            ))}
          </select>
          <p className="[font-size:var(--text-xs)] text-[var(--fg-muted)]">
            Selects the tax ruleset used when running this scenario.
          </p>
        </div>
      </div>

      <hr className="border-[var(--border-muted)]" />

      <h2 className="[font-size:var(--text-base)] font-semibold text-[var(--fg-default)]">
        Disposal details
      </h2>

      <div className="grid grid-cols-1 gap-[var(--space-5)] sm:grid-cols-2">
        {/* Acquisition date */}
        <div className="flex flex-col gap-[var(--space-1)]">
          <label htmlFor="acquisitionDate" className={labelClass}>
            Acquisition date <span aria-hidden="true">*</span>
          </label>
          <input
            id="acquisitionDate"
            type="date"
            required
            value={acquisitionDate}
            onChange={(e) => setAcquisitionDate(e.target.value)}
            className={fieldClass}
          />
        </div>

        {/* Disposal date */}
        <div className="flex flex-col gap-[var(--space-1)]">
          <label htmlFor="disposalDate" className={labelClass}>
            Disposal date <span aria-hidden="true">*</span>
          </label>
          <input
            id="disposalDate"
            type="date"
            required
            value={disposalDate}
            onChange={(e) => setDisposalDate(e.target.value)}
            className={fieldClass}
          />
        </div>

        {/* Acquisition price (cost base element 1) */}
        <div className="flex flex-col gap-[var(--space-1)]">
          <label htmlFor="acquisitionPrice" className={labelClass}>
            Acquisition price ($) <span aria-hidden="true">*</span>
          </label>
          <input
            id="acquisitionPrice"
            type="number"
            required
            min="0"
            step="1"
            value={acquisitionPrice}
            onChange={(e) => setAcquisitionPrice(e.target.value)}
            placeholder="e.g. 600000"
            className={fieldClass}
          />
          <p className="[font-size:var(--text-xs)] text-[var(--fg-muted)]">Cost base element 1</p>
        </div>

        {/* Gross proceeds */}
        <div className="flex flex-col gap-[var(--space-1)]">
          <label htmlFor="grossProceeds" className={labelClass}>
            Gross sale proceeds ($) <span aria-hidden="true">*</span>
          </label>
          <input
            id="grossProceeds"
            type="number"
            required
            min="0"
            step="1"
            value={grossProceeds}
            onChange={(e) => setGrossProceeds(e.target.value)}
            placeholder="e.g. 850000"
            className={fieldClass}
          />
        </div>

        {/* Selling costs */}
        <div className="flex flex-col gap-[var(--space-1)]">
          <label htmlFor="sellingCosts" className={labelClass}>
            Selling costs ($)
          </label>
          <input
            id="sellingCosts"
            type="number"
            min="0"
            step="1"
            value={sellingCosts}
            onChange={(e) => setSellingCosts(e.target.value)}
            placeholder="e.g. 25000"
            className={fieldClass}
          />
          <p className="[font-size:var(--text-xs)] text-[var(--fg-muted)]">
            Agent fees, legal costs, etc.
          </p>
        </div>

        {/* Entity type */}
        <div className="flex flex-col gap-[var(--space-1)]">
          <label htmlFor="entityType" className={labelClass}>
            Owner entity type <span aria-hidden="true">*</span>
          </label>
          <select
            id="entityType"
            value={entityType}
            onChange={(e) =>
              setEntityType(e.target.value as 'individual' | 'smsf' | 'company' | 'trust')
            }
            className={fieldClass}
          >
            <option value="individual">Individual</option>
            <option value="smsf">SMSF</option>
            <option value="company">Company</option>
            <option value="trust">Trust</option>
          </select>
          <p className="[font-size:var(--text-xs)] text-[var(--fg-muted)]">
            Determines CGT discount eligibility.
          </p>
        </div>
      </div>

      {/* Checkboxes */}
      <div className="flex flex-col gap-[var(--space-3)]">
        <label className="flex cursor-pointer items-center gap-[var(--space-2)] [font-size:var(--text-sm)] text-[var(--fg-default)]">
          <input
            type="checkbox"
            checked={wasIncomeProducing}
            onChange={(e) => setWasIncomeProducing(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          Property was income-producing (investment property)
        </label>
        <label className="flex cursor-pointer items-center gap-[var(--space-2)] [font-size:var(--text-sm)] text-[var(--fg-default)]">
          <input
            type="checkbox"
            checked={isPreCgtAsset}
            onChange={(e) => setIsPreCgtAsset(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          Pre-CGT asset (acquired before 20 September 1985)
        </label>
      </div>

      <div className="flex items-center gap-[var(--space-3)]">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-[var(--radius-md)] bg-[var(--fg-default)] px-[var(--space-5)] py-[var(--space-2)] [font-size:var(--text-sm)] font-medium text-[var(--bg-page)] hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create & run scenario'}
        </button>
        <Link
          href="/scenarios"
          className="[font-size:var(--text-sm)] text-[var(--fg-muted)] hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
