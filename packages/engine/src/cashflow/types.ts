import type { Cents } from '../money/cents.js';

// ── Calendar ─────────────────────────────────────────────────────────────────

/** A single calendar month within a scenario horizon. */
export interface MonthPeriod {
  /** 0-based position in the horizon (period 0 = first month). */
  readonly index: number;
  /** 1-based horizon year (year 1 = first 12 months). */
  readonly year: number;
  /** Calendar year, e.g. 2025. */
  readonly calendarYear: number;
  /** Calendar month, 1 = January … 12 = December. */
  readonly calendarMonth: number;
  /** "FY2026" — financial year this month belongs to (July–June). */
  readonly financialYear: string;
  /** Actual days in this calendar month (handles leap Feb). */
  readonly daysInMonth: number;
  /**
   * Days actually in scope for this period. Equal to daysInMonth for full
   * months; reduced for the first period when asOf is mid-month (CF-12).
   */
  readonly activeDays: number;
}

// ── Income ────────────────────────────────────────────────────────────────────

export interface RentStream {
  /** Nominal weekly rent in cents at the start of the horizon. */
  readonly weeklyRentCents: Cents;
  /** Annual rent growth in basis points (e.g. 300 = 3%). */
  readonly growthBps: number;
  /** Vacancy allowance: full weeks lost per calendar year. */
  readonly vacancyWeeksPerYear: number;
}

// ── Expenses ─────────────────────────────────────────────────────────────────

export type ExpenseEscalation = 'none' | 'cpi';
export type ExpenseKind = 'fixed_annual' | 'pct_of_effective_rent';

export interface ExpenseStream {
  readonly kind: ExpenseKind;
  /**
   * Annual base cost in cents.
   * Required for kind = 'fixed_annual'; ignored for 'pct_of_effective_rent'.
   */
  readonly annualBaseCents?: Cents;
  /**
   * Rate in basis points of effective rent.
   * Required for kind = 'pct_of_effective_rent'.
   */
  readonly rateBps?: number;
  readonly escalation: ExpenseEscalation;
  /** CPI in basis points used only when escalation = 'cpi'. */
  readonly cpiBps?: number;
  /**
   * True if this is a capital expense. Capital expenses are excluded from
   * operating cash flow and tracked in the depreciation pool (CF-08, CF-09).
   */
  readonly isCapital: boolean;
  /**
   * ISO date (YYYY-MM-DD). The stream stops contributing after this date.
   * Absent = no end date.
   */
  readonly endDate?: string;
}

// ── Loan amortisation pass-through ───────────────────────────────────────────

/** Per-period amortisation data consumed by cashflow (from Schedule.periods[]). */
export interface LoanPeriodData {
  readonly interestCharged: Cents;
  readonly principalPaid: Cents;
}

// ── Input ─────────────────────────────────────────────────────────────────────

export interface CashFlowInput {
  readonly periods: readonly MonthPeriod[];
  readonly rent: RentStream;
  readonly expenses: readonly ExpenseStream[];
  /**
   * One entry per loan, per period. loans[l][p] = loan l in period p.
   * Must have same period count as periods[].
   */
  readonly loans: readonly (readonly LoanPeriodData[])[];
  /**
   * Investment-use fraction in basis points (0–10 000).
   * Determines what fraction of interest is deductible (CF-04).
   */
  readonly mixedUseFractionBps: number;
}

// ── Output ────────────────────────────────────────────────────────────────────

export interface CashFlowMonth {
  readonly period: MonthPeriod;
  /** Gross rent before vacancy (CF-01, CF-02). */
  readonly grossRentCents: Cents;
  /** Vacancy deduction (CF-03). */
  readonly vacancyLossCents: Cents;
  /** Net rent after vacancy = grossRent − vacancyLoss. */
  readonly effectiveRentCents: Cents;
  /** Sum of operating (non-capital) expenses for this month (CF-05..CF-07). */
  readonly operatingExpensesCents: Cents;
  /** Sum of capital expenses for this month (CF-08, CF-09). */
  readonly capitalExpensesCents: Cents;
  /** Interest deductible for investment purpose (CF-04). */
  readonly deductibleInterestCents: Cents;
  /** Non-deductible portion of interest. */
  readonly nonDeductibleInterestCents: Cents;
  /** Total principal repaid across all loans. */
  readonly principalPaidCents: Cents;
  /**
   * Net operating cash = effectiveRent − operatingExpenses − deductibleInterest.
   * Negative = property is negatively geared (CF-08).
   */
  readonly netOperatingCashCents: Cents;
  /**
   * Running depreciation pool balance AFTER this month's capital addition.
   * Actual div40/div43 deductions are Day 6.
   */
  readonly depreciationPoolCents: Cents;
}

export interface FYAggregate {
  readonly financialYear: string;
  readonly grossRentCents: Cents;
  readonly vacancyLossCents: Cents;
  readonly effectiveRentCents: Cents;
  readonly operatingExpensesCents: Cents;
  readonly capitalExpensesCents: Cents;
  readonly deductibleInterestCents: Cents;
  readonly nonDeductibleInterestCents: Cents;
  readonly principalPaidCents: Cents;
  readonly netOperatingCashCents: Cents;
}

export interface CashFlowOutput {
  readonly months: readonly CashFlowMonth[];
  readonly byFY: ReadonlyMap<string, FYAggregate>;
}
