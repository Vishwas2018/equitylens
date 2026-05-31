import type { DisclaimerContext } from './disclaimer';
import type { IdentificationContext } from './identification';

export interface RenderContext {
  disclaimer: DisclaimerContext;
  identification: IdentificationContext;
}

/** Rendered artifact bytes with metadata. */
export interface RenderedArtifact {
  bytes: Buffer;
  mimeType: string;
  extension: 'pdf' | 'csv';
}

// ── Portfolio summary ─────────────────────────────────────────────────────────

export interface PropertySummaryItem {
  address: string;
  suburb: string;
  state: string;
  status: string;
  estimatedValueCents: number;
  purchasePriceCents: number;
}

export interface PortfolioSummaryScope {
  properties: PropertySummaryItem[];
  totalEstimatedValueCents: number;
  totalPurchasePriceCents: number;
  activeCount: number;
}

// ── Cashflow annual ───────────────────────────────────────────────────────────

export interface CashflowAnnualRow {
  fy: string;
  propertyId: string;
  propertyLabel: string;
  grossRentCents: number;
  vacancyLossCents: number;
  netRentCents: number;
  interestCents: number;
  councilRatesCents: number;
  insuranceCents: number;
  repairsCents: number;
  managementFeesCents: number;
  totalExpensesCents: number;
  netCashflowCents: number;
}

export interface CashflowAnnualScope {
  rows: CashflowAnnualRow[];
  rulesetVersion: string;
}

// ── CGT disposal ──────────────────────────────────────────────────────────────

export interface CgtOwnerRow {
  entityType: string;
  sharePct: number;
  grossGainCents: number;
  discountAppliedCents: number;
  taxableGainCents: number;
}

export interface CgtDisposalScope {
  scenarioLabel: string;
  acquisitionDateISO: string;
  disposalDateISO: string;
  daysHeld: number;
  totalCostBaseCents: number;
  netProceedsCents: number;
  grossGainCents: number;
  isCapitalLoss: boolean;
  discountEligible: boolean;
  isPreCgtAsset: boolean;
  owners: CgtOwnerRow[];
  rulesetVersion: string;
  rulesetStatus: string;
}
