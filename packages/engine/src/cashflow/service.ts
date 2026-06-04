import { mulDiv, RoundingMode, ZERO } from '../money/cents.js';
import type { Cents } from '../money/cents.js';

import type {
  CashFlowInput,
  CashFlowMonth,
  CashFlowOutput,
  ExpenseStream,
  FYAggregate,
  MonthPeriod,
  RentStream,
} from './types.js';

// ── Calendar helpers ──────────────────────────────────────────────────────────

/** Returns the number of days in a calendar month (1 = Jan, 12 = Dec). */
export function daysInMonth(calendarYear: number, calendarMonth: number): number {
  if (calendarMonth === 2) {
    const isLeap = (calendarYear % 4 === 0 && calendarYear % 100 !== 0) || calendarYear % 400 === 0;
    return isLeap ? 29 : 28;
  }
  // Jan(1) Mar(3) May(5) Jul(7) → odd ≤7: 31; Aug(8) Oct(10) Dec(12) → even ≥8: 31
  if (calendarMonth <= 7) return calendarMonth % 2 === 1 ? 31 : 30;
  return calendarMonth % 2 === 0 ? 31 : 30;
}

/**
 * Returns the financial year label for a given calendar month.
 *
 * Australian FY: July 1 – June 30. July (month 7) through December (month 12)
 * belong to the FY that ends in the following calendar year.
 * January (month 1) through June (month 6) belong to the FY ending that year.
 */
export function financialYearOf(calendarYear: number, calendarMonth: number): string {
  const fyEndYear = calendarMonth >= 7 ? calendarYear + 1 : calendarYear;
  return `FY${fyEndYear}`;
}

// ── Period builder ────────────────────────────────────────────────────────────

/**
 * Builds the monthly period array for a scenario horizon.
 *
 * @param startYear   Calendar year of the first period.
 * @param startMonth  Calendar month of the first period (1–12).
 * @param startDay    Day of month of asOf. When > 1, the first period is
 *                    pro-rated (activeDays = remaining days in that month).
 * @param horizonMonths  Total number of monthly periods to generate.
 */
export function buildMonthPeriods(
  startYear: number,
  startMonth: number,
  startDay: number,
  horizonMonths: number,
): MonthPeriod[] {
  const periods: MonthPeriod[] = [];
  let year = startYear;
  let month = startMonth;

  for (let i = 0; i < horizonMonths; i++) {
    const dim = daysInMonth(year, month);
    const activeDays = i === 0 && startDay > 1 ? dim - startDay + 1 : dim;
    const horizonYear = Math.floor(i / 12) + 1;
    periods.push({
      index: i,
      year: horizonYear,
      calendarYear: year,
      calendarMonth: month,
      financialYear: financialYearOf(year, month),
      daysInMonth: dim,
      activeDays,
    });
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return periods;
}

// ── Rent ──────────────────────────────────────────────────────────────────────

/**
 * Applies compound annual growth to a base amount for a given number of years.
 * Growth is applied at each anniversary (FY boundary), not continuously.
 */
export function compoundCents(baseCents: Cents, rateBps: number, years: number): Cents {
  let result = baseCents;
  for (let i = 0; i < years; i++) {
    result = mulDiv(result, BigInt(10000 + rateBps), 10000n, RoundingMode.HALF_UP);
  }
  return result;
}

/**
 * Gross monthly rent using the 52/12 normalisation ratio (CF-01).
 *
 * Hand-derived golden (CF-01):
 *   weeklyRent = 50 000 c ($500/wk), growth = 0, year 1
 *   grossMonthly = 50000 × 52 / 12 = 2 600 000 / 12 = 216 666.666... → HALF_UP = 216 667 c
 */
export function grossRentForMonth(
  weeklyRentCents: Cents,
  growthBps: number,
  horizonYear: number,
): Cents {
  const yearsElapsed = horizonYear - 1;
  const grown = compoundCents(weeklyRentCents, growthBps, yearsElapsed);
  return mulDiv(grown, 52n, 12n, RoundingMode.HALF_UP);
}

/**
 * Vacancy deduction for one month: distribute annual vacancy uniformly (CF-03).
 *
 * vacancyMonthly = grossMonthly × vacancyWeeksPerYear / 52   (HALF_UP)
 *
 * Hand-derived golden (CF-03):
 *   grossMonthly = 216 667 c, vacancyWeeksPerYear = 2
 *   vacancyMonthly = 216 667 × 2 / 52 = 433 334 / 52 = 8 333.346... → HALF_UP = 8 333 c
 */
export function vacancyLossForMonth(grossRentCents: Cents, vacancyWeeksPerYear: number): Cents {
  if (vacancyWeeksPerYear === 0) return ZERO;
  return mulDiv(grossRentCents, BigInt(vacancyWeeksPerYear), 52n, RoundingMode.HALF_UP);
}

/** Rent result for a single month, handling growth and vacancy. */
export function rentForMonth(
  stream: RentStream,
  period: MonthPeriod,
): { grossRentCents: Cents; vacancyLossCents: Cents; effectiveRentCents: Cents } {
  const gross = grossRentForMonth(stream.weeklyRentCents, stream.growthBps, period.year);
  const proRated =
    period.activeDays < period.daysInMonth
      ? mulDiv(gross, BigInt(period.activeDays), BigInt(period.daysInMonth), RoundingMode.HALF_UP)
      : gross;
  const vacancy = vacancyLossForMonth(proRated, stream.vacancyWeeksPerYear);
  return {
    grossRentCents: proRated,
    vacancyLossCents: vacancy,
    effectiveRentCents: proRated - vacancy,
  };
}

// ── Expenses ──────────────────────────────────────────────────────────────────

/**
 * Apply CPI escalation to a base annual cost (CF-07).
 * Uses the same compound formula as rent growth.
 */
export function escalateExpense(
  baseAnnualCents: Cents,
  cpiBps: number,
  yearsElapsed: number,
): Cents {
  return compoundCents(baseAnnualCents, cpiBps, yearsElapsed);
}

/**
 * Returns true if the expense stream is active for the given period.
 * Streams with an endDate stop contributing the month after the end date.
 */
function isExpenseActive(stream: ExpenseStream, period: MonthPeriod): boolean {
  if (stream.endDate === undefined) return true;
  const [endYear, endMonth] = stream.endDate.split('-').map(Number) as [number, number, number];
  // Active while calendar year/month <= end year/month
  if (period.calendarYear < endYear) return true;
  if (period.calendarYear === endYear && period.calendarMonth <= endMonth) return true;
  return false;
}

/**
 * Computes the operating and capital expense totals for a single month (CF-05..CF-09).
 *
 * @param streams          Expense streams for this property.
 * @param period           Current period metadata.
 * @param effectiveRentCents  Net rent after vacancy (used for pct_of_effective_rent expenses).
 * @param prevDepPoolCents Running depreciation pool balance before this period.
 */
export function expensesForMonth(
  streams: readonly ExpenseStream[],
  period: MonthPeriod,
  effectiveRentCents: Cents,
  prevDepPoolCents: Cents,
): { operatingExpensesCents: Cents; capitalExpensesCents: Cents; depreciationPoolCents: Cents } {
  let operating = ZERO;
  let capital = ZERO;

  for (const s of streams) {
    if (!isExpenseActive(s, period)) continue;

    let monthlyCents: Cents;
    if (s.kind === 'fixed_annual') {
      const base = s.annualBaseCents ?? ZERO;
      const yearsElapsed = period.year - 1;
      const escalated =
        s.escalation === 'cpi' && s.cpiBps !== undefined
          ? escalateExpense(base, s.cpiBps, yearsElapsed)
          : base;
      // Pro-rate for partial first period
      const annual =
        period.activeDays < period.daysInMonth
          ? mulDiv(
              escalated,
              BigInt(period.activeDays),
              BigInt(period.daysInMonth),
              RoundingMode.HALF_UP,
            )
          : escalated;
      monthlyCents = mulDiv(annual, 1n, 12n, RoundingMode.HALF_UP);
    } else {
      // pct_of_effective_rent
      const rateBps = s.rateBps ?? 0;
      monthlyCents = mulDiv(effectiveRentCents, BigInt(rateBps), 10000n, RoundingMode.HALF_UP);
    }

    if (s.isCapital) {
      capital += monthlyCents;
    } else {
      operating += monthlyCents;
    }
  }

  return {
    operatingExpensesCents: operating,
    capitalExpensesCents: capital,
    depreciationPoolCents: prevDepPoolCents + capital,
  };
}

// ── Loan apportionment ────────────────────────────────────────────────────────

/**
 * Splits loan interest into deductible and non-deductible portions (CF-04).
 *
 * @param mixedUseFractionBps  Investment-use fraction in bps (0–10 000).
 */
export function apportionDeductible(
  interestCents: Cents,
  mixedUseFractionBps: number,
): { deductibleCents: Cents; nonDeductibleCents: Cents } {
  const deductible = mulDiv(
    interestCents,
    BigInt(mixedUseFractionBps),
    10000n,
    RoundingMode.HALF_UP,
  );
  return { deductibleCents: deductible, nonDeductibleCents: interestCents - deductible };
}

// ── FY aggregation ────────────────────────────────────────────────────────────

/**
 * Aggregates monthly cash flow results by financial year (CF-10).
 * June (month 6) buckets into FY ending that calendar year; July (month 7)
 * buckets into FY ending the following calendar year.
 */
export function aggregateToFY(months: readonly CashFlowMonth[]): ReadonlyMap<string, FYAggregate> {
  const map = new Map<string, FYAggregate>();
  for (const m of months) {
    const fy = m.period.financialYear;
    const existing = map.get(fy);
    const agg: FYAggregate = existing
      ? {
          financialYear: fy,
          grossRentCents: existing.grossRentCents + m.grossRentCents,
          vacancyLossCents: existing.vacancyLossCents + m.vacancyLossCents,
          effectiveRentCents: existing.effectiveRentCents + m.effectiveRentCents,
          operatingExpensesCents: existing.operatingExpensesCents + m.operatingExpensesCents,
          capitalExpensesCents: existing.capitalExpensesCents + m.capitalExpensesCents,
          deductibleInterestCents: existing.deductibleInterestCents + m.deductibleInterestCents,
          nonDeductibleInterestCents:
            existing.nonDeductibleInterestCents + m.nonDeductibleInterestCents,
          principalPaidCents: existing.principalPaidCents + m.principalPaidCents,
          netOperatingCashCents: existing.netOperatingCashCents + m.netOperatingCashCents,
        }
      : {
          financialYear: fy,
          grossRentCents: m.grossRentCents,
          vacancyLossCents: m.vacancyLossCents,
          effectiveRentCents: m.effectiveRentCents,
          operatingExpensesCents: m.operatingExpensesCents,
          capitalExpensesCents: m.capitalExpensesCents,
          deductibleInterestCents: m.deductibleInterestCents,
          nonDeductibleInterestCents: m.nonDeductibleInterestCents,
          principalPaidCents: m.principalPaidCents,
          netOperatingCashCents: m.netOperatingCashCents,
        };
    map.set(fy, agg);
  }
  return map;
}

// ── Main service ──────────────────────────────────────────────────────────────

/** Computes period-by-period cash flow for a single investment property. */
export function computeCashFlow(input: CashFlowInput): CashFlowOutput {
  const months: CashFlowMonth[] = [];
  let depPool = ZERO;

  for (const period of input.periods) {
    const { grossRentCents, vacancyLossCents, effectiveRentCents } = rentForMonth(
      input.rent,
      period,
    );

    const { operatingExpensesCents, capitalExpensesCents, depreciationPoolCents } =
      expensesForMonth(input.expenses, period, effectiveRentCents, depPool);
    depPool = depreciationPoolCents;

    let totalInterest = ZERO;
    let totalPrincipal = ZERO;
    for (const loanPeriods of input.loans) {
      const p = loanPeriods[period.index];
      if (p !== undefined) {
        totalInterest += p.interestCharged;
        totalPrincipal += p.principalPaid;
      }
    }

    const { deductibleCents, nonDeductibleCents } = apportionDeductible(
      totalInterest,
      input.mixedUseFractionBps,
    );

    const netOperatingCashCents = effectiveRentCents - operatingExpensesCents - deductibleCents;

    months.push({
      period,
      grossRentCents,
      vacancyLossCents,
      effectiveRentCents,
      operatingExpensesCents,
      capitalExpensesCents,
      deductibleInterestCents: deductibleCents,
      nonDeductibleInterestCents: nonDeductibleCents,
      principalPaidCents: totalPrincipal,
      netOperatingCashCents,
      depreciationPoolCents,
    });
  }

  return { months, byFY: aggregateToFY(months) };
}
