/**
 * CSV renderers for all three Day 12 templates.
 *
 * Format: UTF-8 with BOM, CRLF line endings, RFC 4180 quoting.
 * Every output begins with identification header + disclaimer block as
 * #-prefixed comment lines. The disclaimer MUST be present; content-assertion
 * tests fail if it is absent.
 */

import { buildCsvDisclaimerLines } from './disclaimer';
import { buildCsvIdentificationLines } from './identification';
import type {
  CashflowAnnualScope,
  CgtDisposalScope,
  PortfolioSummaryScope,
  RenderContext,
} from './types';

// UTF-8 BOM so Excel auto-detects encoding
const BOM = '﻿';
const CRLF = '\r\n';

function centsToAud(cents: number): string {
  // Negative shown as -$1,234 in CSVs
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const formatted = dollars.toLocaleString('en-AU');
  return cents < 0 ? `-$${formatted}` : `$${formatted}`;
}

function csvField(value: string | number | boolean): string {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(...fields: Array<string | number | boolean>): string {
  return fields.map(csvField).join(',');
}

// ── Portfolio summary CSV ─────────────────────────────────────────────────────

export function renderPortfolioSummaryCsv(
  scope: PortfolioSummaryScope,
  ctx: RenderContext,
): Buffer {
  const lines: string[] = [];

  lines.push(buildCsvIdentificationLines(ctx.identification));
  lines.push(buildCsvDisclaimerLines(ctx.disclaimer));
  lines.push('# PROVISIONAL ESTIMATE — ruleset status: ' + ctx.disclaimer.rulesetStatus);
  lines.push('');

  // Data header
  lines.push(
    row('address', 'suburb', 'state', 'status', 'purchase_price_aud', 'estimated_value_aud'),
  );

  for (const p of scope.properties) {
    lines.push(
      row(
        p.address,
        p.suburb,
        p.state,
        p.status,
        centsToAud(p.purchasePriceCents),
        centsToAud(p.estimatedValueCents),
      ),
    );
  }

  lines.push('');
  lines.push(
    row(
      'TOTAL',
      '',
      '',
      '',
      centsToAud(scope.totalPurchasePriceCents),
      centsToAud(scope.totalEstimatedValueCents),
    ),
  );

  const content = BOM + lines.join(CRLF);
  return Buffer.from(content, 'utf8');
}

// ── Cashflow annual CSV ───────────────────────────────────────────────────────

export function renderCashflowAnnualCsv(scope: CashflowAnnualScope, ctx: RenderContext): Buffer {
  const lines: string[] = [];

  lines.push(buildCsvIdentificationLines(ctx.identification));
  lines.push(buildCsvDisclaimerLines(ctx.disclaimer));
  lines.push('# PROVISIONAL ESTIMATE — ruleset status: ' + ctx.disclaimer.rulesetStatus);
  lines.push('');

  lines.push(
    row(
      'fy',
      'property_id',
      'property_label',
      'gross_rent_aud',
      'vacancy_loss_aud',
      'net_rent_aud',
      'interest_aud',
      'council_rates_aud',
      'insurance_aud',
      'repairs_aud',
      'management_fees_aud',
      'total_expenses_aud',
      'net_cashflow_aud',
    ),
  );

  for (const r of scope.rows) {
    lines.push(
      row(
        r.fy,
        r.propertyId,
        r.propertyLabel,
        centsToAud(r.grossRentCents),
        centsToAud(r.vacancyLossCents),
        centsToAud(r.netRentCents),
        centsToAud(r.interestCents),
        centsToAud(r.councilRatesCents),
        centsToAud(r.insuranceCents),
        centsToAud(r.repairsCents),
        centsToAud(r.managementFeesCents),
        centsToAud(r.totalExpensesCents),
        centsToAud(r.netCashflowCents),
      ),
    );
  }

  const content = BOM + lines.join(CRLF);
  return Buffer.from(content, 'utf8');
}

// ── CGT disposal CSV ──────────────────────────────────────────────────────────

export function renderCgtDisposalCsv(scope: CgtDisposalScope, ctx: RenderContext): Buffer {
  const lines: string[] = [];

  lines.push(buildCsvIdentificationLines(ctx.identification));
  lines.push(buildCsvDisclaimerLines(ctx.disclaimer));
  lines.push('# PROVISIONAL ESTIMATE — ruleset status: ' + ctx.disclaimer.rulesetStatus);
  lines.push('');

  // Summary section
  lines.push(row('field', 'value'));
  lines.push(row('scenario', scope.scenarioLabel));
  lines.push(row('acquisition_date', scope.acquisitionDateISO));
  lines.push(row('disposal_date', scope.disposalDateISO));
  lines.push(row('days_held', scope.daysHeld));
  lines.push(row('total_cost_base_aud', centsToAud(scope.totalCostBaseCents)));
  lines.push(row('net_proceeds_aud', centsToAud(scope.netProceedsCents)));
  lines.push(
    row(
      scope.isCapitalLoss ? 'capital_loss_aud' : 'gross_capital_gain_aud',
      centsToAud(scope.grossGainCents),
    ),
  );
  lines.push(row('cgt_discount_eligible', scope.discountEligible ? 'Yes' : 'No'));
  lines.push(row('pre_cgt_asset', scope.isPreCgtAsset ? 'Yes' : 'No'));
  lines.push(row('ruleset_version', scope.rulesetVersion));
  lines.push(row('ruleset_status', scope.rulesetStatus));
  lines.push('');

  // Per-owner breakdown
  lines.push(
    row(
      'owner_entity_type',
      'share_pct',
      'gross_gain_aud',
      'discount_applied_aud',
      'taxable_gain_aud',
    ),
  );
  for (const o of scope.owners) {
    lines.push(
      row(
        o.entityType,
        o.sharePct.toFixed(2),
        centsToAud(o.grossGainCents),
        centsToAud(o.discountAppliedCents),
        centsToAud(o.taxableGainCents),
      ),
    );
  }

  const content = BOM + lines.join(CRLF);
  return Buffer.from(content, 'utf8');
}
