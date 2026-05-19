// ============================================================================
// EquityLens — TypeScript Types & Zod Schemas
// ----------------------------------------------------------------------------
// Mirrors /database/schema.sql exactly. Money is BIGINT cents in DB; we use
// `number` here on the assumption no single property amount exceeds 2^53
// (~$90 trillion). Total portfolios use BigInt aggregation server-side.
// ============================================================================

import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { z } from 'zod';

// ============================================================================
// 1. Enums
// ============================================================================

export const SubscriptionTier = z.enum(['free', 'pro', 'professional']);
export const SubscriptionStatus = z.enum([
  'trialing',
  'active',
  'past_due',
  'cancelled',
  'incomplete',
]);
export const OrgRole = z.enum(['owner', 'admin', 'accountant', 'viewer']);
export const Jurisdiction = z.enum(['VIC', 'NSW', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']);
export const PropertyType = z.enum(['house', 'apartment', 'townhouse', 'land', 'commercial']);
export const OwnershipKind = z.enum([
  'individual',
  'joint',
  'tenants_in_common',
  'trust',
  'company',
]);
export const LoanTypeEnum = z.enum(['principal_and_interest', 'interest_only']);
export const LoanRateType = z.enum(['variable', 'fixed', 'split']);
export const ExpenseCategory = z.enum([
  'council_rates',
  'water_rates',
  'insurance',
  'property_management',
  'maintenance',
  'strata',
  'land_tax',
  'agent_letting',
  'advertising',
  'gardening',
  'pest_control',
  'accounting_fees',
  'other',
]);
export const IncomeKind = z.enum(['rent', 'bond_drawdown', 'other']);
export const DepreciationDivision = z.enum(['div_40', 'div_43']);
export const ScenarioStatus = z.enum(['pending', 'completed', 'failed']);
export const AuditAction = z.enum([
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'export',
  'scenario_run',
  'subscription_change',
  'rls_deny',
  'admin_recompute',
]);
export const PropertyStatus = z.enum(['draft', 'active', 'sold', 'archived']);
export const DepreciationMethod = z.enum(['prime_cost', 'diminishing_value', 'straight_line']);
export const ReportFormat = z.enum(['pdf', 'csv']);
export const ReportStatus = z.enum(['pending', 'running', 'completed', 'failed']);
export const ScheduledCadence = z.enum(['monthly', 'quarterly', 'annual']);

// ============================================================================
// 2. Primitives
// ============================================================================

export const UUID = z.string().uuid();
export const ISODateTime = z.string().datetime({ offset: true });
export const ISODate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const FYString = z.string().regex(/^FY\d{4}$/);

/** Monetary amount in integer cents. */
export const Cents = z.number().int();
export const PositiveCents = Cents.refine((n) => n >= 0, 'Must be ≥ 0');
export const StrictPositiveCents = Cents.refine((n) => n > 0, 'Must be > 0');

/** Percent expressed as decimal: 0.0625 = 6.25%. */
export const Percent = z.number().min(-1).max(1);
export const PositivePct = z.number().min(0).max(1);
export const InterestRate = z.number().min(0).max(0.5); // sane upper bound

// ============================================================================
// 3. Core domain entities (rows)
// ============================================================================

export const OrganisationRow = z.object({
  id: UUID,
  name: z.string().min(1).max(200),
  abn: z
    .string()
    .regex(/^\d{11}$/)
    .nullable(),
  created_by: UUID,
  created_at: ISODateTime,
  updated_at: ISODateTime,
  deleted_at: ISODateTime.nullable(),
});
export type OrganisationRow = z.infer<typeof OrganisationRow>;

export const UserOrgMembershipRow = z.object({
  id: UUID,
  user_id: UUID,
  org_id: UUID,
  role: OrgRole,
  created_at: ISODateTime,
});
export type UserOrgMembershipRow = z.infer<typeof UserOrgMembershipRow>;

export const SubscriptionRow = z.object({
  id: UUID,
  user_id: UUID,
  stripe_customer_id: z.string().nullable(),
  stripe_subscription_id: z.string().nullable(),
  tier: SubscriptionTier,
  status: SubscriptionStatus,
  trial_ends_at: ISODateTime.nullable(),
  current_period_start: ISODateTime.nullable(),
  current_period_end: ISODateTime.nullable(),
  cancel_at_period_end: z.boolean(),
  seat_count: z.number().int().min(1),
  created_at: ISODateTime,
  updated_at: ISODateTime,
});
export type SubscriptionRow = z.infer<typeof SubscriptionRow>;

export const PortfolioRow = z.object({
  id: UUID,
  org_id: UUID,
  user_id: UUID,
  name: z.string().min(1).max(200),
  created_at: ISODateTime,
  updated_at: ISODateTime,
  deleted_at: ISODateTime.nullable(),
});
export type PortfolioRow = z.infer<typeof PortfolioRow>;

export const PropertyRow = z.object({
  id: UUID,
  portfolio_id: UUID,
  org_id: UUID,
  user_id: UUID,
  address_line1: z.string().min(1).max(200),
  address_line2: z.string().max(200).nullable(),
  suburb: z.string().min(1).max(100),
  state: Jurisdiction,
  postcode: z.string().regex(/^\d{4}$/),
  property_type: PropertyType,
  purchase_date: ISODate,
  purchase_price_cents: StrictPositiveCents,
  stamp_duty_paid_cents: PositiveCents,
  acquisition_costs_cents: PositiveCents,
  current_estimated_value_cents: PositiveCents.nullable(),
  ownership_kind: OwnershipKind,
  status: PropertyStatus,
  notes: z.string().nullable(),
  created_at: ISODateTime,
  updated_at: ISODateTime,
  deleted_at: ISODateTime.nullable(),
});
export type PropertyRow = z.infer<typeof PropertyRow>;

export const PropertyOwnershipSplitRow = z.object({
  id: UUID,
  property_id: UUID,
  owner_label: z.string().min(1).max(120),
  user_id: UUID.nullable(),
  percentage: z.number().min(0).max(100),
  marginal_rate_pct: Percent.nullable(),
  created_at: ISODateTime,
});
export type PropertyOwnershipSplitRow = z.infer<typeof PropertyOwnershipSplitRow>;

export const PpoREntryRow = z.object({
  id: UUID,
  property_id: UUID,
  from_date: ISODate,
  to_date: ISODate.nullable(),
});
export type PpoREntryRow = z.infer<typeof PpoREntryRow>;

export const LoanRow = z.object({
  id: UUID,
  property_id: UUID,
  user_id: UUID,
  lender: z.string().nullable(),
  account_label: z.string().nullable(),
  loan_type: LoanTypeEnum,
  rate_type: LoanRateType,
  principal_cents: StrictPositiveCents,
  current_balance_cents: PositiveCents,
  interest_rate_pct: InterestRate,
  term_months: z.number().int().min(1).max(600),
  io_expiry_date: ISODate.nullable(),
  fixed_until_date: ISODate.nullable(),
  offset_balance_cents: PositiveCents,
  split_of_loan_id: UUID.nullable(),
  start_date: ISODate,
  created_at: ISODateTime,
  updated_at: ISODateTime,
  deleted_at: ISODateTime.nullable(),
});
export type LoanRow = z.infer<typeof LoanRow>;

export const IncomeRecordRow = z.object({
  id: UUID,
  property_id: UUID,
  user_id: UUID,
  kind: IncomeKind,
  period_start: ISODate,
  period_end: ISODate,
  amount_cents: PositiveCents,
  weekly_rate_cents: PositiveCents.nullable(),
  vacancy_days: z.number().int().min(0).max(366),
  notes: z.string().nullable(),
  created_at: ISODateTime,
  updated_at: ISODateTime,
});
export type IncomeRecordRow = z.infer<typeof IncomeRecordRow>;

export const ExpenseRecordRow = z.object({
  id: UUID,
  property_id: UUID,
  user_id: UUID,
  category: ExpenseCategory,
  description: z.string().nullable(),
  incurred_date: ISODate,
  amount_cents: PositiveCents,
  is_capital: z.boolean(),
  gst_inclusive: z.boolean(),
  created_at: ISODateTime,
  updated_at: ISODateTime,
});
export type ExpenseRecordRow = z.infer<typeof ExpenseRecordRow>;

export const DepreciationScheduleRow = z.object({
  id: UUID,
  property_id: UUID,
  user_id: UUID,
  qs_provider: z.string().nullable(),
  effective_date: ISODate,
  source_file_url: z.string().url().nullable(),
  notes: z.string().nullable(),
  created_at: ISODateTime,
});
export type DepreciationScheduleRow = z.infer<typeof DepreciationScheduleRow>;

export const DepreciationLineItemRow = z.object({
  id: UUID,
  schedule_id: UUID,
  division: DepreciationDivision,
  description: z.string().min(1),
  cost_cents: PositiveCents,
  effective_life_years: z.number().nullable(),
  method: DepreciationMethod,
  rate_pct: Percent.nullable(),
  starts_on: ISODate,
  ends_on: ISODate.nullable(),
});
export type DepreciationLineItemRow = z.infer<typeof DepreciationLineItemRow>;

// ============================================================================
// 4. Tax Rule Sets
// ============================================================================

export const MarginalBracket = z.object({
  threshold_cents: Cents,
  rate: PositivePct,
  base_tax_cents: Cents,
});

export const LandTaxBracket = z.object({
  threshold_cents: Cents,
  rate: PositivePct,
  base_cents: Cents,
});

export const TaxRulePayload = z.object({
  marginal_rates: z.array(MarginalBracket).min(1),
  medicare_levy_pct: PositivePct,
  medicare_low_income_threshold_cents: Cents.optional(),
  cgt_discount_pct: PositivePct, // typically 0.5
  cgt_min_hold_days: z.number().int().min(0),
  negative_gearing: z.object({
    allow_offset_against_other_income: z.boolean(),
    quarantined: z.boolean(),
  }),
  land_tax: z.object({
    free_threshold_cents: Cents,
    brackets: z.array(LandTaxBracket).min(1),
    absentee_surcharge_pct: PositivePct.optional(),
    vacancy_levy_pct: PositivePct.optional(),
  }),
  citations: z.array(z.object({ key: z.string(), source: z.string() })),
});
export type TaxRulePayload = z.infer<typeof TaxRulePayload>;

export const TaxRuleSetRow = z.object({
  id: z.string(), // e.g. trs_FY2026_VIC_v3
  financial_year: FYString,
  jurisdiction: Jurisdiction,
  version: z.number().int().min(1),
  status: z.enum(['draft', 'staged', 'published', 'archived']),
  effective_from: ISODate,
  effective_to: ISODate.nullable(),
  rules: TaxRulePayload,
  authored_by: UUID,
  reviewed_by: UUID.nullable(),
  published_at: ISODateTime.nullable(),
  created_at: ISODateTime,
});
export type TaxRuleSetRow = z.infer<typeof TaxRuleSetRow>;

// ============================================================================
// 5. Scenarios & Results
// ============================================================================

export const ScenarioAssumptions = z.object({
  rate_shock_bps: z.number().int().min(-1000).max(1000).default(0),
  rent_growth_pct: Percent.default(0),
  vacancy_weeks_pa: z.number().min(0).max(52).default(0),
  cpi_pct: Percent.default(0.025),
  capital_growth_pct: Percent.default(0.04),
  sell_at_year: z.number().int().min(1).max(30).optional(),
  refinance_year: z.number().int().min(1).max(30).optional(),
  refinance_new_rate: Percent.optional(),
  etf_alternative_return_pct: Percent.optional(),
});

export const ScenarioInput = z.object({
  scope: z.discriminatedUnion('type', [
    z.object({ type: z.literal('property'), property_id: UUID }),
    z.object({ type: z.literal('portfolio') }),
  ]),
  horizon_years: z.number().int().min(1).max(30),
  financial_year: FYString,
  jurisdiction: Jurisdiction,
  assumptions: ScenarioAssumptions,
  label: z.string().min(1).max(120).optional(),
});
export type ScenarioInput = z.infer<typeof ScenarioInput>;

export const YearlyProjection = z.object({
  year_index: z.number().int().min(0),
  rental_income_cents: Cents,
  operating_expenses_cents: Cents,
  interest_paid_cents: Cents,
  principal_paid_cents: Cents,
  depreciation_div40_cents: Cents,
  depreciation_div43_cents: Cents,
  land_tax_cents: Cents,
  pre_tax_cash_flow_cents: Cents,
  taxable_income_impact_cents: Cents,
  tax_position_cents: Cents,
  after_tax_cash_flow_cents: Cents,
  closing_loan_balance_cents: Cents,
  estimated_value_cents: Cents,
  estimated_equity_cents: Cents,
});

export const ScenarioResultPayload = z.object({
  yearly: z.array(YearlyProjection).min(1),
  summary: z.object({
    after_tax_cash_flow_cents_pa: Cents,
    projected_equity_cents_y10: Cents,
    irr_pct: z.number().nullable(),
    hold_recommendation_score: z.number().min(0).max(1).nullable(),
    cgt_estimate_cents: Cents.nullable(),
  }),
  sensitivity: z.array(
    z.object({
      factor: z.string(),
      delta_cents: Cents,
      description: z.string(),
    }),
  ),
});
export type ScenarioResultPayload = z.infer<typeof ScenarioResultPayload>;

export const ScenarioRow = z.object({
  id: UUID,
  user_id: UUID,
  portfolio_id: UUID.nullable(),
  property_id: UUID.nullable(),
  label: z.string().nullable(),
  input_payload: ScenarioInput,
  pinned: z.boolean(),
  created_at: ISODateTime,
});
export type ScenarioRow = z.infer<typeof ScenarioRow>;

export const ScenarioResultRow = z.object({
  id: UUID,
  scenario_id: UUID,
  user_id: UUID,
  tax_rule_set_id: z.string(),
  input_hash: z.string(),
  engine_version: z.string(),
  status: ScenarioStatus,
  result_payload: ScenarioResultPayload,
  duration_ms: z.number().int().nullable(),
  created_at: ISODateTime,
});
export type ScenarioResultRow = z.infer<typeof ScenarioResultRow>;

// ============================================================================
// 6. AI Interactions
// ============================================================================

export const AiInteractionRow = z.object({
  id: UUID,
  user_id: UUID,
  scenario_result_id: UUID,
  template_id: z.string(),
  model: z.string(),
  prompt_hash: z.string(),
  context_hash: z.string(),
  response_raw: z.unknown(),
  schema_valid: z.boolean(),
  leak_detected: z.boolean(),
  fallback_used: z.boolean(),
  latency_ms: z.number().int(),
  tokens_in: z.number().int(),
  tokens_out: z.number().int(),
  cost_cents: z.number().int(),
  created_at: ISODateTime,
});
export type AiInteractionRow = z.infer<typeof AiInteractionRow>;

// ============================================================================
// 7. Audit Log
// ============================================================================

export const AuditLogRow = z.object({
  id: UUID,
  occurred_at: ISODateTime,
  actor_user_id: UUID.nullable(),
  actor_email: z.string().email().nullable(),
  actor_ip: z.string().nullable(),
  org_id: UUID.nullable(),
  action: AuditAction,
  entity_type: z.string(),
  entity_id: UUID.nullable(),
  metadata: z.record(z.string(), z.unknown()),
  request_id: z.string().nullable(),
});
export type AuditLogRow = z.infer<typeof AuditLogRow>;

// ============================================================================
// 8. Reports
// ============================================================================

export const ReportTemplateId = z.enum([
  'portfolio_summary',
  'property_snapshot',
  'scenario_comparison',
  'eofy_pack',
  'cgt_estimate',
]);

export const ReportJobRow = z.object({
  id: UUID,
  user_id: UUID,
  template_id: ReportTemplateId,
  format: ReportFormat,
  scope: z.record(z.string(), z.unknown()),
  status: ReportStatus,
  storage_path: z.string().nullable(),
  sha256: z.string().nullable(),
  error_detail: z.string().nullable(),
  requested_at: ISODateTime,
  completed_at: ISODateTime.nullable(),
});
export type ReportJobRow = z.infer<typeof ReportJobRow>;

// ============================================================================
// 9. API Input Schemas (re-exported for handlers)
// ============================================================================

export const PropertyCreateInput = z.object({
  portfolio_id: UUID,
  address_line1: z.string().min(1).max(200),
  address_line2: z.string().max(200).optional(),
  suburb: z.string().min(1).max(100),
  state: Jurisdiction,
  postcode: z.string().regex(/^\d{4}$/),
  property_type: PropertyType,
  purchase_date: ISODate,
  purchase_price_cents: StrictPositiveCents,
  stamp_duty_paid_cents: PositiveCents.default(0),
  acquisition_costs_cents: PositiveCents.default(0),
  ownership: z.object({
    kind: OwnershipKind,
    splits: z
      .array(
        z.object({
          owner_label: z.string().min(1).max(120),
          user_id: UUID.optional(),
          percentage: z.number().min(0).max(100),
          marginal_rate_pct: Percent.optional(),
        }),
      )
      .min(1)
      .refine(
        (s) => Math.abs(s.reduce((a, b) => a + b.percentage, 0) - 100) < 0.001,
        'Ownership splits must total exactly 100%',
      ),
  }),
});
export type PropertyCreateInput = z.infer<typeof PropertyCreateInput>;

export const LoanCreateInput = z
  .object({
    property_id: UUID,
    lender: z.string().max(120).optional(),
    account_label: z.string().max(120).optional(),
    loan_type: LoanTypeEnum,
    rate_type: LoanRateType,
    principal_cents: StrictPositiveCents,
    current_balance_cents: PositiveCents,
    interest_rate_pct: InterestRate,
    term_months: z.number().int().min(1).max(600),
    io_expiry_date: ISODate.optional(),
    fixed_until_date: ISODate.optional(),
    offset_balance_cents: PositiveCents.default(0),
    start_date: ISODate,
  })
  .refine((d) => d.loan_type !== 'interest_only' || !!d.io_expiry_date, {
    message: 'io_expiry_date required for interest_only loans',
  })
  .refine((d) => d.rate_type !== 'fixed' || !!d.fixed_until_date, {
    message: 'fixed_until_date required for fixed rate loans',
  });
export type LoanCreateInput = z.infer<typeof LoanCreateInput>;

// ============================================================================
// 10. Database typing surface (matches Supabase generated Database type)
// ============================================================================

export interface Database {
  public: {
    Tables: {
      organisations: {
        Row: OrganisationRow;
        Insert: Omit<OrganisationRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
        Update: Partial<OrganisationRow>;
      };
      user_org_membership: {
        Row: UserOrgMembershipRow;
        Insert: Omit<UserOrgMembershipRow, 'id' | 'created_at'>;
        Update: Partial<UserOrgMembershipRow>;
      };
      subscriptions: {
        Row: SubscriptionRow;
        Insert: Omit<SubscriptionRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<SubscriptionRow>;
      };
      portfolios: {
        Row: PortfolioRow;
        Insert: Omit<PortfolioRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
        Update: Partial<PortfolioRow>;
      };
      properties: {
        Row: PropertyRow;
        Insert: Omit<PropertyRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
        Update: Partial<PropertyRow>;
      };
      property_ownership_splits: {
        Row: PropertyOwnershipSplitRow;
        Insert: Omit<PropertyOwnershipSplitRow, 'id' | 'created_at'>;
        Update: Partial<PropertyOwnershipSplitRow>;
      };
      property_ppor_history: {
        Row: PpoREntryRow;
        Insert: Omit<PpoREntryRow, 'id'>;
        Update: Partial<PpoREntryRow>;
      };
      loans: {
        Row: LoanRow;
        Insert: Omit<LoanRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
        Update: Partial<LoanRow>;
      };
      income_records: {
        Row: IncomeRecordRow;
        Insert: Omit<IncomeRecordRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<IncomeRecordRow>;
      };
      expense_records: {
        Row: ExpenseRecordRow;
        Insert: Omit<ExpenseRecordRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<ExpenseRecordRow>;
      };
      depreciation_schedules: {
        Row: DepreciationScheduleRow;
        Insert: Omit<DepreciationScheduleRow, 'id' | 'created_at'>;
        Update: Partial<DepreciationScheduleRow>;
      };
      depreciation_line_items: {
        Row: DepreciationLineItemRow;
        Insert: Omit<DepreciationLineItemRow, 'id'>;
        Update: Partial<DepreciationLineItemRow>;
      };
      tax_rule_sets: { Row: TaxRuleSetRow; Insert: TaxRuleSetRow; Update: Partial<TaxRuleSetRow> };
      scenarios: {
        Row: ScenarioRow;
        Insert: Omit<ScenarioRow, 'id' | 'created_at'>;
        Update: Partial<ScenarioRow>;
      };
      scenario_results: {
        Row: ScenarioResultRow;
        Insert: Omit<ScenarioResultRow, 'id' | 'created_at'>;
        Update: never;
      };
      ai_interactions: {
        Row: AiInteractionRow;
        Insert: Omit<AiInteractionRow, 'id' | 'created_at'>;
        Update: never;
      };
      audit_logs: {
        Row: AuditLogRow;
        Insert: Omit<AuditLogRow, 'id' | 'occurred_at'>;
        Update: never;
      };
      report_jobs: {
        Row: ReportJobRow;
        Insert: Omit<ReportJobRow, 'id' | 'requested_at' | 'completed_at'>;
        Update: Partial<ReportJobRow>;
      };
    };
  };
}

// ============================================================================
// 11. Type-safe query helpers
// ============================================================================

export type PWIClient = SupabaseClient<Database>;

/** Strongly-typed result for `select * from properties` with RLS. */
export async function listMyProperties(
  client: PWIClient,
  opts: { cursor?: string; limit?: number } = {},
): Promise<{ data: PropertyRow[]; nextCursor: string | null; error: PostgrestError | null }> {
  const limit = Math.min(opts.limit ?? 25, 100);
  let q = client
    .from('properties')
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit + 1);
  if (opts.cursor) {
    const [ts, id] = decodeCursor(opts.cursor);
    q = q.or(`updated_at.lt.${ts},and(updated_at.eq.${ts},id.lt.${id})`);
  }
  const { data, error } = await q;
  if (error || !data) return { data: [], nextCursor: null, error };
  const hasMore = data.length > limit;
  const slice = hasMore ? data.slice(0, limit) : data;
  const next = hasMore ? encodeCursor(slice[slice.length - 1]) : null;
  return { data: slice, nextCursor: next, error: null };
}

function encodeCursor(row: PropertyRow): string {
  return Buffer.from(`${row.updated_at}|${row.id}`).toString('base64url');
}
function decodeCursor(c: string): [string, string] {
  const [ts, id] = Buffer.from(c, 'base64url').toString().split('|');
  return [ts, id];
}

/** Always-validated insert helper — server-side use only. */
export async function insertProperty(
  client: PWIClient,
  input: PropertyCreateInput,
  ctx: { userId: string; orgId: string },
): Promise<PropertyRow> {
  const parsed = PropertyCreateInput.parse(input);
  const { data, error } = await client
    .from('properties')
    .insert({
      portfolio_id: parsed.portfolio_id,
      org_id: ctx.orgId,
      user_id: ctx.userId,
      address_line1: parsed.address_line1,
      address_line2: parsed.address_line2 ?? null,
      suburb: parsed.suburb,
      state: parsed.state,
      postcode: parsed.postcode,
      property_type: parsed.property_type,
      purchase_date: parsed.purchase_date,
      purchase_price_cents: parsed.purchase_price_cents,
      stamp_duty_paid_cents: parsed.stamp_duty_paid_cents,
      acquisition_costs_cents: parsed.acquisition_costs_cents,
      ownership_kind: parsed.ownership.kind,
      status: 'active',
      notes: null,
      current_estimated_value_cents: null,
    })
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('Insert failed');
  return PropertyRow.parse(data);
}

// ============================================================================
// 12. Tagged ID nominal typing (compile-time only)
// ============================================================================

declare const tag: unique symbol;
type Tagged<T, K extends string> = T & { readonly [tag]: K };

export type UserId = Tagged<string, 'UserId'>;
export type PropertyId = Tagged<string, 'PropertyId'>;
export type ScenarioId = Tagged<string, 'ScenarioId'>;
export type LoanId = Tagged<string, 'LoanId'>;
export type OrgId = Tagged<string, 'OrgId'>;

export const asUserId = (s: string) => s as UserId;
export const asPropertyId = (s: string) => s as PropertyId;
export const asScenarioId = (s: string) => s as ScenarioId;

// ============================================================================
// END
// ============================================================================
