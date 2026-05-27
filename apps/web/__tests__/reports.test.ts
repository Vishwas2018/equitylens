/**
 * D12-T7 content-assertion tests.
 *
 * Hard constraint: content-assertion FAILS if disclaimer absent, per
 * template, per format (CSV + PDF). Presigned URL = file outlives session +
 * auth; in-document disclaimer is what makes 7-day link exposure acceptable.
 *
 * Coverage:
 *   1. Disclaimer sentinel present in every CSV (3 templates)
 *   2. Disclaimer sentinel present in every PDF (2 templates, via renderArtifact)
 *   3. renderArtifact throws MissingDisclaimerError when sentinel absent
 *   4. CSV round-trip: key columns + data values present in rendered output
 */

import { describe, expect, it, vi } from 'vitest';

import * as csvModule from '../server/reports/csv';
import { renderArtifact } from '../server/reports/render';
import type {
  CashflowAnnualScope,
  CgtDisposalScope,
  PortfolioSummaryScope,
  RenderContext,
} from '../server/reports/types';

// Pass-through mock so vi.spyOn can intercept calls inside renderArtifact
vi.mock('../server/reports/csv', async (importOriginal) => {
  return await importOriginal<typeof import('../server/reports/csv')>();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DISCLAIMER_SENTINEL = 'EquityLens Pty Ltd';

const ctx: RenderContext = {
  disclaimer: {
    engineVersion: '0.1.0',
    rulesetVersion: 'FY2026.1',
    rulesetStatus: 'draft',
    generatedAt: '2026-01-01T00:00:00.000Z',
    reportId: '00000000-0000-0000-0000-000000000001',
    templateSlug: 'test-template',
    templateVersion: '1.0.0',
  },
  identification: {
    templateHumanName: 'Test Report',
    tenantDisplayName: 'Acme Pty Ltd',
    userDisplayName: 'Test User',
    userEmail: 'test@example.com',
    generatedAtHuman: '1 January 2026',
    scenarioName: 'Test Scenario',
    scenarioId: '00000000-0000-0000-0000-000000000002',
  },
};

const portfolioScope: PortfolioSummaryScope = {
  properties: [
    {
      address: '123 Test St',
      suburb: 'Testville',
      state: 'VIC',
      status: 'active',
      purchasePriceCents: 50_000_000,
      estimatedValueCents: 65_000_000,
    },
  ],
  totalPurchasePriceCents: 50_000_000,
  totalEstimatedValueCents: 65_000_000,
  activeCount: 1,
};

const cashflowScope: CashflowAnnualScope = {
  rows: [
    {
      fy: 'FY2026',
      propertyId: 'prop-001',
      propertyLabel: '123 Test St',
      grossRentCents: 2_600_000,
      vacancyLossCents: 130_000,
      netRentCents: 2_470_000,
      interestCents: 1_800_000,
      councilRatesCents: 200_000,
      insuranceCents: 150_000,
      repairsCents: 100_000,
      managementFeesCents: 247_000,
      totalExpensesCents: 2_497_000,
      netCashflowCents: -27_000,
    },
  ],
  rulesetVersion: 'FY2026.1',
};

const cgtScope: CgtDisposalScope = {
  scenarioLabel: 'Test Sale',
  acquisitionDateISO: '2015-06-01',
  disposalDateISO: '2026-01-15',
  daysHeld: 3880,
  totalCostBaseCents: 55_000_000,
  netProceedsCents: 75_000_000,
  grossGainCents: 20_000_000,
  isCapitalLoss: false,
  discountEligible: true,
  isPreCgtAsset: false,
  owners: [
    {
      entityType: 'individual',
      sharePct: 100,
      grossGainCents: 20_000_000,
      discountAppliedCents: 10_000_000,
      taxableGainCents: 10_000_000,
    },
  ],
  rulesetVersion: 'FY2026.1',
  rulesetStatus: 'draft',
};

// ── CSV: disclaimer present ───────────────────────────────────────────────────
// If the disclaimer is removed from any renderer, these tests fail.

describe('CSV disclaimer content-assertion', () => {
  it('portfolio-summary CSV contains disclaimer sentinel', () => {
    const bytes = csvModule.renderPortfolioSummaryCsv(portfolioScope, ctx);
    expect(bytes.toString('utf8')).toContain(DISCLAIMER_SENTINEL);
  });

  it('cashflow-annual CSV contains disclaimer sentinel', () => {
    const bytes = csvModule.renderCashflowAnnualCsv(cashflowScope, ctx);
    expect(bytes.toString('utf8')).toContain(DISCLAIMER_SENTINEL);
  });

  it('cgt-disposal CSV contains disclaimer sentinel', () => {
    const bytes = csvModule.renderCgtDisposalCsv(cgtScope, ctx);
    expect(bytes.toString('utf8')).toContain(DISCLAIMER_SENTINEL);
  });
});

// ── CSV: round-trip data ──────────────────────────────────────────────────────

describe('CSV round-trip data', () => {
  it('portfolio-summary CSV has expected columns and data values', () => {
    const text = csvModule.renderPortfolioSummaryCsv(portfolioScope, ctx).toString('utf8');
    // Column headers
    expect(text).toContain('address');
    expect(text).toContain('purchase_price_aud');
    expect(text).toContain('estimated_value_aud');
    // Data values
    expect(text).toContain('123 Test St');
    expect(text).toContain('Testville');
    expect(text).toContain('$500,000'); // 50_000_000 cents
    expect(text).toContain('$650,000'); // 65_000_000 cents
  });

  it('cashflow-annual CSV has expected columns and data values', () => {
    const text = csvModule.renderCashflowAnnualCsv(cashflowScope, ctx).toString('utf8');
    // Column headers
    expect(text).toContain('fy');
    expect(text).toContain('gross_rent_aud');
    expect(text).toContain('net_cashflow_aud');
    // Data values
    expect(text).toContain('FY2026');
    expect(text).toContain('prop-001');
    expect(text).toContain('$26,000'); // 2_600_000 cents gross rent
  });

  it('cgt-disposal CSV has expected fields and data values', () => {
    const text = csvModule.renderCgtDisposalCsv(cgtScope, ctx).toString('utf8');
    // Summary fields
    expect(text).toContain('acquisition_date');
    expect(text).toContain('total_cost_base_aud');
    expect(text).toContain('cgt_discount_eligible');
    // Data values
    expect(text).toContain('Test Sale');
    expect(text).toContain('2015-06-01');
    expect(text).toContain('individual');
    expect(text).toContain('$550,000'); // 55_000_000 cents cost base
  });
});

// ── PDF: disclaimer present ───────────────────────────────────────────────────
// renderArtifact calls assertDisclaimerPresent before returning — if the
// sentinel is absent the promise rejects. Resolution confirms sentinel found.

describe('PDF disclaimer content-assertion', () => {
  it('portfolio-summary PDF passes assertDisclaimerPresent', async () => {
    const artifact = await renderArtifact(
      'portfolio-summary',
      'pdf',
      JSON.stringify(portfolioScope),
      ctx,
    );
    expect(artifact.mimeType).toBe('application/pdf');
    expect(artifact.extension).toBe('pdf');
    expect(artifact.bytes.length).toBeGreaterThan(0);
  });

  it('cgt-disposal PDF passes assertDisclaimerPresent', async () => {
    const artifact = await renderArtifact('cgt-disposal', 'pdf', JSON.stringify(cgtScope), ctx);
    expect(artifact.mimeType).toBe('application/pdf');
    expect(artifact.extension).toBe('pdf');
    expect(artifact.bytes.length).toBeGreaterThan(0);
  });
});

// ── Structural enforcement ────────────────────────────────────────────────────
// Verify that renderArtifact's assertDisclaimerPresent is not passive — it
// actually throws if the sentinel is missing. This confirms the guard cannot
// be silently bypassed by a renderer that forgets the disclaimer block.

describe('Structural enforcement', () => {
  it('renderArtifact throws MissingDisclaimerError when CSV sentinel absent', async () => {
    const spy = vi
      .spyOn(csvModule, 'renderPortfolioSummaryCsv')
      .mockReturnValueOnce(Buffer.from('field,value\nno-disclaimer-text-here', 'utf8'));

    await expect(
      renderArtifact('portfolio-summary', 'csv', JSON.stringify(portfolioScope), ctx),
    ).rejects.toThrow('MissingDisclaimerError');

    spy.mockRestore();
  });
});
