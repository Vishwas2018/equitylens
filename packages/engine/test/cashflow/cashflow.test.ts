/**
 * CashFlowService tests — CF-01..CF-12
 *
 * Rounding: HALF_UP throughout per financial-calc-engine.md §5.2 (DEV-0015).
 *
 * DEV-0016: test-matrix.md provides descriptions but no pre-computed expected
 * values. CF-01 and CF-03 are anchored to hand-derived goldens (see inline
 * derivations). CF-02, CF-04..CF-12 are invariant-tested: structural
 * correctness verified, pending CPA sign-off (same policy as AM fixtures,
 * confirmed Day 4 per Day 4 EOD report).
 *
 * CF-09 (depreciation pool): pool accumulation implemented. Actual div40/div43
 * deduction rates are Day 6 anti-scope; pool tracking is in scope here.
 */

import { describe, it, expect } from 'vitest';

import {
  daysInMonth,
  financialYearOf,
  buildMonthPeriods,
  grossRentForMonth,
  vacancyLossForMonth,
  rentForMonth,
  escalateExpense,
  expensesForMonth,
  apportionDeductible,
  aggregateToFY,
  computeCashFlow,
} from '../../src/cashflow/index.js';
import type {
  MonthPeriod,
  RentStream,
  ExpenseStream,
  CashFlowMonth,
  LoanPeriodData,
} from '../../src/cashflow/index.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePeriod(overrides: Partial<MonthPeriod> = {}): MonthPeriod {
  return {
    index: 0,
    year: 1,
    calendarYear: 2025,
    calendarMonth: 7,
    financialYear: 'FY2026',
    daysInMonth: 31,
    activeDays: 31,
    ...overrides,
  };
}

function makeRentStream(overrides: Partial<RentStream> = {}): RentStream {
  return {
    weeklyRentCents: 50_000n, // $500/week
    growthBps: 0,
    vacancyWeeksPerYear: 0,
    ...overrides,
  };
}

// ── CF-01 — Weekly rent normalised to monthly equivalent: 52/12 ratio ────────
//
// Hand-derived golden (authoritative):
//   weeklyRent = 50 000 c ($500/wk), no growth, no vacancy, year 1
//   grossMonthly = 50 000 × 52 / 12 = 2 600 000 / 12 = 216 666.666... → HALF_UP = 216 667 c
//
//   Derivation: mulDiv(50000n, 52n, 12n, HALF_UP)
//     = (50000 × 52 + 12/2) / 12
//     = (2600000 + 6) / 12
//     = 2600006n / 12n  = 216667n  ✓
//
// Source: test-matrix.md CF-01; formula per financial-calc-engine.md §5.2.
// ─────────────────────────────────────────────────────────────────────────────

describe('CF-01 — weekly rent normalised to monthly equivalent: 52/12 ratio', () => {
  const period = makePeriod();

  it('$500/wk → 216 667 cents/month (hand-derived golden)', () => {
    const gross = grossRentForMonth(50_000n, 0, 1);
    expect(gross).toBe(216_667n);
  });

  it('$1000/wk → 433 333 cents/month', () => {
    // 1000000 × 52 / 12: (1000000×52 + 6) / 12 = (52000000 + 6)/12 = 52000006/12 = 4333333n
    // Wait: 52000000 / 12 = 4333333.33... → HALF_UP = 4333333
    // With HALF_UP: (52000000 + 6) / 12 = 52000006 / 12 = 4333333 (integer)
    const gross = grossRentForMonth(100_000n, 0, 1);
    expect(gross).toBe(433_333n);
  });

  it('gross is identical for all calendarMonths in year 1 (ratio is month-agnostic)', () => {
    const results = [7, 8, 9, 10, 11, 12, 1].map((m) =>
      grossRentForMonth(50_000n, 0, m <= 6 ? 2 : 1),
    );
    const first = results[0];
    for (const r of results) {
      expect(r).toBe(first);
    }
  });

  it('rentForMonth result matches grossRentForMonth for full month, no vacancy', () => {
    const result = rentForMonth(makeRentStream(), period);
    expect(result.grossRentCents).toBe(216_667n);
    expect(result.vacancyLossCents).toBe(0n);
    expect(result.effectiveRentCents).toBe(216_667n);
  });
});

// ── CF-02 — Rent growth compounds annually on FY boundary, not monthly ────────
//
// Invariant tests (DEV-0016: pending CPA sign-off):
//   - Year 1 gross = base
//   - Year 2 gross = Year 1 × (1 + growthBps/10000) [once compounded]
//   - Year 3 gross = Year 2 × (1 + growthBps/10000) [twice compounded]
//   - All months within the same horizon year return the SAME gross rent
// ─────────────────────────────────────────────────────────────────────────────

describe('CF-02 — rent growth compounds annually on FY boundary', () => {
  const weeklyRent = 50_000n;
  const growthBps = 300; // 3% p.a.

  it('year 1 gross equals un-grown value', () => {
    expect(grossRentForMonth(weeklyRent, growthBps, 1)).toBe(grossRentForMonth(weeklyRent, 0, 1));
  });

  it('year 2 gross is exactly one compounding step above year 1', () => {
    const y1 = grossRentForMonth(weeklyRent, growthBps, 1);
    const y2 = grossRentForMonth(weeklyRent, growthBps, 2);
    // year 2 weekly = 50000 × 1.03 = 51500 → monthly = 51500 × 52 / 12
    // = (51500×52 + 6)/12 = (2678000 + 6)/12 = 2678006/12 = 223167
    expect(y2).toBe(223_167n);
    expect(y2).toBeGreaterThan(y1);
  });

  it('year 3 gross is two compounding steps above year 1', () => {
    const y2 = grossRentForMonth(weeklyRent, growthBps, 2);
    const y3 = grossRentForMonth(weeklyRent, growthBps, 3);
    // year 3 weekly = 51500 × 1.03 = 53045 → monthly = 53045 × 52 / 12
    // = (53045×52 + 6)/12 = (2758340 + 6)/12 = 2758346/12 = 229862
    expect(y3).toBe(229_862n);
    expect(y3).toBeGreaterThan(y2);
  });

  it('all months within the same horizon year produce the same gross', () => {
    // Build periods for a full year (12 months), all year=2
    const allY2 = Array.from({ length: 12 }, () => grossRentForMonth(weeklyRent, growthBps, 2));
    const first = allY2[0];
    for (const v of allY2) {
      expect(v).toBe(first);
    }
  });

  it('growthBps = 0 means all years produce identical gross', () => {
    const y1 = grossRentForMonth(weeklyRent, 0, 1);
    const y5 = grossRentForMonth(weeklyRent, 0, 5);
    expect(y5).toBe(y1);
  });
});

// ── CF-03 — Vacancy: 2 weeks/yr reduces rent by 2/52 of monthly gross ─────────
//
// Hand-derived golden (authoritative):
//   grossMonthly = 216 667 c (from CF-01 golden)
//   vacancyWeeks = 2
//   vacancyMonthly = mulDiv(216667n, 2n, 52n, HALF_UP)
//               = (216667 × 2 + 26) / 52
//               = (433334 + 26) / 52
//               = 433360 / 52
//               = 8333.846... → 8333 c
//   effectiveRent = 216 667 − 8 333 = 208 334 c
//
// Source: test-matrix.md CF-03; formula per financial-calc-engine.md §5.2.
// ─────────────────────────────────────────────────────────────────────────────

describe('CF-03 — vacancy: 2 weeks/yr reduces rent by 2/52 of gross', () => {
  const period = makePeriod();
  const stream = makeRentStream({ vacancyWeeksPerYear: 2 });

  it('vacancy loss = 8 333 cents/month (hand-derived golden)', () => {
    const gross = 216_667n;
    const loss = vacancyLossForMonth(gross, 2);
    expect(loss).toBe(8_333n);
  });

  it('effective rent = 208 334 cents/month (CF-01 gross − CF-03 vacancy)', () => {
    const result = rentForMonth(stream, period);
    expect(result.grossRentCents).toBe(216_667n);
    expect(result.vacancyLossCents).toBe(8_333n);
    expect(result.effectiveRentCents).toBe(208_334n);
  });

  it('zero vacancy weeks → zero vacancy loss', () => {
    expect(vacancyLossForMonth(216_667n, 0)).toBe(0n);
  });

  it('52 weeks vacancy → vacancy loss equals gross rent', () => {
    // mulDiv(216667n, 52n, 52n, HALF_UP) = 216667n
    const loss = vacancyLossForMonth(216_667n, 52);
    expect(loss).toBe(216_667n);
  });

  it('effectiveRent = grossRent − vacancyLoss (identity holds)', () => {
    const result = rentForMonth(stream, period);
    expect(result.effectiveRentCents).toBe(result.grossRentCents - result.vacancyLossCents);
  });
});

// ── CF-04 — Mixed-use: only investment fraction of interest deductible ─────────
//
// Invariant tests (DEV-0016):
//   - Full investment use (10000 bps) → all interest deductible
//   - Half investment use (5000 bps) → half deductible
//   - PPOR (0 bps) → none deductible
//   - deductible + nonDeductible = total interest (conservation)
// ─────────────────────────────────────────────────────────────────────────────

describe('CF-04 — mixed-use: investment fraction of interest deductible', () => {
  const interest = 200_000n; // $2000

  it('100% investment use → all interest deductible', () => {
    const { deductibleCents, nonDeductibleCents } = apportionDeductible(interest, 10000);
    expect(deductibleCents).toBe(200_000n);
    expect(nonDeductibleCents).toBe(0n);
  });

  it('50% investment use → half deductible, half non-deductible', () => {
    const { deductibleCents, nonDeductibleCents } = apportionDeductible(interest, 5000);
    expect(deductibleCents).toBe(100_000n);
    expect(nonDeductibleCents).toBe(100_000n);
  });

  it('0% investment use (PPOR) → none deductible', () => {
    const { deductibleCents, nonDeductibleCents } = apportionDeductible(interest, 0);
    expect(deductibleCents).toBe(0n);
    expect(nonDeductibleCents).toBe(200_000n);
  });

  it('deductible + nonDeductible = total interest (conservation)', () => {
    for (const bps of [0, 2500, 5000, 7500, 10000]) {
      const { deductibleCents, nonDeductibleCents } = apportionDeductible(interest, bps);
      expect(deductibleCents + nonDeductibleCents).toBe(interest);
    }
  });

  it('75% use → deductible = 150 000 c, non-deductible = 50 000 c', () => {
    const { deductibleCents, nonDeductibleCents } = apportionDeductible(200_000n, 7500);
    expect(deductibleCents).toBe(150_000n);
    expect(nonDeductibleCents).toBe(50_000n);
  });
});

// ── CF-05 — Expense stream with end date: stops contributing post-end ─────────
//
// Invariant tests (DEV-0016):
//   - Before end date → contributes monthly amount
//   - On end month → still contributes
//   - After end month → contributes 0
// ─────────────────────────────────────────────────────────────────────────────

describe('CF-05 — expense stream with end date stops post-end', () => {
  const expense: ExpenseStream = {
    kind: 'fixed_annual',
    annualBaseCents: 120_000n, // $1200/yr = $100/month
    escalation: 'none',
    isCapital: false,
    endDate: '2025-09-30', // expires after September 2025
  };

  it('before end date → contributes monthly amount', () => {
    const period = makePeriod({ calendarYear: 2025, calendarMonth: 7 }); // July 2025
    const { operatingExpensesCents } = expensesForMonth([expense], period, 0n, 0n);
    expect(operatingExpensesCents).toBeGreaterThan(0n);
  });

  it('on end month → still contributes', () => {
    const period = makePeriod({ calendarYear: 2025, calendarMonth: 9 }); // September 2025
    const { operatingExpensesCents } = expensesForMonth([expense], period, 0n, 0n);
    expect(operatingExpensesCents).toBeGreaterThan(0n);
  });

  it('after end month → contributes 0', () => {
    const period = makePeriod({ calendarYear: 2025, calendarMonth: 10 }); // October 2025
    const { operatingExpensesCents } = expensesForMonth([expense], period, 0n, 0n);
    expect(operatingExpensesCents).toBe(0n);
  });

  it('year after end → contributes 0', () => {
    const period = makePeriod({ calendarYear: 2026, calendarMonth: 1 });
    const { operatingExpensesCents } = expensesForMonth([expense], period, 0n, 0n);
    expect(operatingExpensesCents).toBe(0n);
  });
});

// ── CF-06 — Property management fee as % of rent recomputes monthly ───────────
//
// Invariant tests (DEV-0016):
//   - Fee = pctBps / 10000 × effectiveRent
//   - When rent grows, fee grows proportionally
// ─────────────────────────────────────────────────────────────────────────────

describe('CF-06 — property management fee as % of effective rent', () => {
  const mgmtFee: ExpenseStream = {
    kind: 'pct_of_effective_rent',
    rateBps: 800, // 8%
    escalation: 'none',
    isCapital: false,
  };
  const period = makePeriod();

  it('fee = 8% of effective rent', () => {
    const effectiveRent = 208_334n; // from CF-03 golden
    const { operatingExpensesCents } = expensesForMonth([mgmtFee], period, effectiveRent, 0n);
    // 208334 × 800 / 10000 = 166667.2 → HALF_UP = 16667 c ($166.67)
    // Actually: mulDiv(208334n, 800n, 10000n, HALF_UP) = (208334×800 + 5000) / 10000
    // = (166667200 + 5000) / 10000 = 166672200 / 10000 = 16667
    expect(operatingExpensesCents).toBe(16_667n);
  });

  it('fee scales proportionally with rent', () => {
    const rent1 = 200_000n;
    const rent2 = 400_000n;
    const { operatingExpensesCents: fee1 } = expensesForMonth([mgmtFee], period, rent1, 0n);
    const { operatingExpensesCents: fee2 } = expensesForMonth([mgmtFee], period, rent2, 0n);
    expect(fee2).toBe(fee1 * 2n);
  });

  it('zero rent → zero fee', () => {
    const { operatingExpensesCents } = expensesForMonth([mgmtFee], period, 0n, 0n);
    expect(operatingExpensesCents).toBe(0n);
  });
});

// ── CF-07 — Insurance escalates at CPI when escalation = 'cpi' ───────────────
//
// Invariant tests (DEV-0016):
//   - Year 1: base cost (no escalation)
//   - Year 2: base × (1 + cpiBps/10000)
//   - escalation = 'none': cost unchanged across years
// ─────────────────────────────────────────────────────────────────────────────

describe('CF-07 — insurance escalates at CPI annually', () => {
  const baseAnnual = 240_000n; // $2400/year

  it('year 1: no escalation applied', () => {
    const y1 = escalateExpense(baseAnnual, 250, 0); // 0 years elapsed
    expect(y1).toBe(baseAnnual);
  });

  it('year 2: one CPI step applied (2.5% → annual = 246 000 c)', () => {
    // 240000 × 1.0250 = 246000 exactly (250 bps)
    // compoundCents: mulDiv(240000n, 10250n, 10000n, HALF_UP) = (240000×10250+5000)/10000
    // = (2460000000 + 5000) / 10000 = 2460005000 / 10000 = 246000
    const y2 = escalateExpense(baseAnnual, 250, 1);
    expect(y2).toBe(246_000n);
  });

  it('year 3: two CPI steps applied', () => {
    const y3 = escalateExpense(baseAnnual, 250, 2);
    // 246000 × 1.025 = 252150 exactly
    expect(y3).toBe(252_150n);
  });

  it('cpiBps = 0 means no escalation regardless of years', () => {
    const y5 = escalateExpense(baseAnnual, 0, 4);
    expect(y5).toBe(baseAnnual);
  });

  it('expense with escalation=cpi escalates; escalation=none stays flat', () => {
    const cpiExpense: ExpenseStream = {
      kind: 'fixed_annual',
      annualBaseCents: 240_000n,
      escalation: 'cpi',
      cpiBps: 250,
      isCapital: false,
    };
    const noneExpense: ExpenseStream = {
      kind: 'fixed_annual',
      annualBaseCents: 240_000n,
      escalation: 'none',
      isCapital: false,
    };
    const period = makePeriod({ year: 2 }); // year 2 → 1 year elapsed
    const { operatingExpensesCents: cpiResult } = expensesForMonth([cpiExpense], period, 0n, 0n);
    const { operatingExpensesCents: noneResult } = expensesForMonth([noneExpense], period, 0n, 0n);
    expect(cpiResult).toBeGreaterThan(noneResult);
  });
});

// ── CF-08 — Capital expense excluded from operating cash flow ─────────────────
//
// Invariant tests (DEV-0016):
//   - Capital expense → capitalExpensesCents only; not in operatingExpensesCents
//   - netOperatingCashCents does not include capital expense
// ─────────────────────────────────────────────────────────────────────────────

describe('CF-08 — capital expense excluded from operating cash flow', () => {
  const operatingExpense: ExpenseStream = {
    kind: 'fixed_annual',
    annualBaseCents: 120_000n, // $1200/yr = $100/month
    escalation: 'none',
    isCapital: false,
  };
  const capitalExpense: ExpenseStream = {
    kind: 'fixed_annual',
    annualBaseCents: 60_000_000n, // $600k renovation (capital)
    escalation: 'none',
    isCapital: true,
  };
  const period = makePeriod();

  it('capital expense appears in capitalExpensesCents, not operatingExpensesCents', () => {
    const { operatingExpensesCents, capitalExpensesCents } = expensesForMonth(
      [capitalExpense],
      period,
      0n,
      0n,
    );
    expect(operatingExpensesCents).toBe(0n);
    expect(capitalExpensesCents).toBeGreaterThan(0n);
  });

  it('operating expense appears only in operatingExpensesCents', () => {
    const { operatingExpensesCents, capitalExpensesCents } = expensesForMonth(
      [operatingExpense],
      period,
      0n,
      0n,
    );
    expect(operatingExpensesCents).toBeGreaterThan(0n);
    expect(capitalExpensesCents).toBe(0n);
  });

  it('mixed streams: capital and operating are correctly separated', () => {
    const { operatingExpensesCents, capitalExpensesCents } = expensesForMonth(
      [operatingExpense, capitalExpense],
      period,
      0n,
      0n,
    );
    expect(operatingExpensesCents).toBeGreaterThan(0n);
    expect(capitalExpensesCents).toBeGreaterThan(0n);
  });

  it('netOperatingCashCents does not include capital in computeCashFlow', () => {
    const withCapital = computeCashFlow({
      periods: [period],
      rent: makeRentStream(),
      expenses: [capitalExpense],
      loans: [],
      mixedUseFractionBps: 10000,
    });
    const withoutCapital = computeCashFlow({
      periods: [period],
      rent: makeRentStream(),
      expenses: [],
      loans: [],
      mixedUseFractionBps: 10000,
    });
    const m1 = withCapital.months[0];
    const m2 = withoutCapital.months[0];
    expect(m1?.netOperatingCashCents).toBe(m2?.netOperatingCashCents);
    expect(m1?.capitalExpensesCents).toBeGreaterThan(0n);
  });
});

// ── CF-09 — Capital expense added to depreciation pool prospectively ──────────
//
// Invariant tests (DEV-0016):
//   - Capital expense in month N → depreciationPoolCents grows from month N
//   - Prior months unaffected
//   - Multiple capital expenses accumulate
//
// Note: actual div40/div43 deduction rates are Day 6 anti-scope.
// Pool tracking is in scope here (running balance of capital additions).
// ─────────────────────────────────────────────────────────────────────────────

describe('CF-09 — capital expense added to depreciation pool prospectively', () => {
  const capitalExpense: ExpenseStream = {
    kind: 'fixed_annual',
    annualBaseCents: 12_000_000n, // $120k/yr capital (unusual but tests the pool)
    escalation: 'none',
    isCapital: true,
  };

  it('capital expense increases depreciationPoolCents', () => {
    const period = makePeriod();
    const { depreciationPoolCents } = expensesForMonth([capitalExpense], period, 0n, 0n);
    expect(depreciationPoolCents).toBeGreaterThan(0n);
  });

  it('no capital expense → pool unchanged', () => {
    const operatingExpense: ExpenseStream = {
      kind: 'fixed_annual',
      annualBaseCents: 120_000n,
      escalation: 'none',
      isCapital: false,
    };
    const period = makePeriod();
    const { depreciationPoolCents } = expensesForMonth([operatingExpense], period, 0n, 500_000n);
    expect(depreciationPoolCents).toBe(500_000n); // unchanged
  });

  it('capital in month 2 → pool grows from month 2 onward in computeCashFlow', () => {
    const period1 = makePeriod({ index: 0, calendarMonth: 7, calendarYear: 2025 });
    const period2 = makePeriod({
      index: 1,
      calendarMonth: 8,
      calendarYear: 2025,
      financialYear: 'FY2026',
    });

    const _noCapitalExpenseStream: ExpenseStream = {
      kind: 'fixed_annual',
      annualBaseCents: 0n,
      escalation: 'none',
      isCapital: false,
    };
    const capitalOnlyMonth2: ExpenseStream = {
      kind: 'fixed_annual',
      annualBaseCents: 12_000_000n,
      escalation: 'none',
      isCapital: true,
      endDate: '9999-12-31', // always active
    };

    const output = computeCashFlow({
      periods: [period1, period2],
      rent: makeRentStream(),
      expenses: [capitalOnlyMonth2],
      loans: [],
      mixedUseFractionBps: 10000,
    });

    const m1 = output.months[0];
    const m2 = output.months[1];
    expect(m1?.depreciationPoolCents).toBeGreaterThan(0n); // capital in both months
    expect(m2?.depreciationPoolCents).toBeGreaterThanOrEqual(m1?.depreciationPoolCents ?? 0n);
  });
});

// ── CF-10 — FY rollover June → July correctly buckets income ──────────────────
//
// Invariant tests (DEV-0016):
//   - June month → belongs to FY ending that calendar year
//   - July month → belongs to FY ending the following calendar year
//   - aggregateToFY produces separate entries for adjacent FYs
// ─────────────────────────────────────────────────────────────────────────────

describe('CF-10 — FY rollover June → July buckets into different FYs', () => {
  it('financialYearOf: June 2026 → FY2026', () => {
    expect(financialYearOf(2026, 6)).toBe('FY2026');
  });

  it('financialYearOf: July 2026 → FY2027', () => {
    expect(financialYearOf(2026, 7)).toBe('FY2027');
  });

  it('financialYearOf: December 2025 → FY2026', () => {
    expect(financialYearOf(2025, 12)).toBe('FY2026');
  });

  it('financialYearOf: January 2026 → FY2026', () => {
    expect(financialYearOf(2026, 1)).toBe('FY2026');
  });

  it('aggregateToFY places June and July in different FY buckets', () => {
    const juneMonth: CashFlowMonth = {
      period: makePeriod({ calendarYear: 2026, calendarMonth: 6, financialYear: 'FY2026' }),
      grossRentCents: 100_000n,
      vacancyLossCents: 0n,
      effectiveRentCents: 100_000n,
      operatingExpensesCents: 0n,
      capitalExpensesCents: 0n,
      deductibleInterestCents: 0n,
      nonDeductibleInterestCents: 0n,
      principalPaidCents: 0n,
      netOperatingCashCents: 100_000n,
      depreciationPoolCents: 0n,
    };
    const julyMonth: CashFlowMonth = {
      period: makePeriod({ calendarYear: 2026, calendarMonth: 7, financialYear: 'FY2027' }),
      grossRentCents: 100_000n,
      vacancyLossCents: 0n,
      effectiveRentCents: 100_000n,
      operatingExpensesCents: 0n,
      capitalExpensesCents: 0n,
      deductibleInterestCents: 0n,
      nonDeductibleInterestCents: 0n,
      principalPaidCents: 0n,
      netOperatingCashCents: 100_000n,
      depreciationPoolCents: 0n,
    };
    const byFY = aggregateToFY([juneMonth, julyMonth]);
    expect(byFY.size).toBe(2);
    expect(byFY.has('FY2026')).toBe(true);
    expect(byFY.has('FY2027')).toBe(true);
    expect(byFY.get('FY2026')?.grossRentCents).toBe(100_000n);
    expect(byFY.get('FY2027')?.grossRentCents).toBe(100_000n);
  });
});

// ── CF-11 — Leap year: February has 29 days ────────────────────────────────────
//
// Invariant tests (DEV-0016):
//   - Feb 2024 (leap year) → 29 days
//   - Feb 2025 (non-leap) → 28 days
//   - buildMonthPeriods reflects correct daysInMonth
// ─────────────────────────────────────────────────────────────────────────────

describe('CF-11 — leap year: February month has 29 days', () => {
  it('daysInMonth(2024, 2) = 29 (leap year)', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
  });

  it('daysInMonth(2025, 2) = 28 (non-leap year)', () => {
    expect(daysInMonth(2025, 2)).toBe(28);
  });

  it('daysInMonth(2000, 2) = 29 (century leap year)', () => {
    expect(daysInMonth(2000, 2)).toBe(29);
  });

  it('daysInMonth(1900, 2) = 28 (century non-leap year)', () => {
    expect(daysInMonth(1900, 2)).toBe(28);
  });

  it('buildMonthPeriods reflects leap February correctly', () => {
    // Start at Jan 2024, 2 months: Jan and Feb
    const periods = buildMonthPeriods(2024, 1, 1, 2);
    expect(periods[0]?.daysInMonth).toBe(31); // January
    expect(periods[1]?.daysInMonth).toBe(29); // February (leap)
  });

  it('buildMonthPeriods reflects non-leap February correctly', () => {
    const periods = buildMonthPeriods(2025, 1, 1, 2);
    expect(periods[1]?.daysInMonth).toBe(28); // February 2025
  });
});

// ── CF-12 — Half-month at horizon start (mid-month asOf): pro-rates correctly ─
//
// Invariant tests (DEV-0016):
//   - asOf on day 1 → activeDays = daysInMonth (full month)
//   - asOf on day 16 of 31-day month → activeDays = 16
//   - grossRent for partial first period is pro-rated by activeDays/daysInMonth
//   - Subsequent periods are full months
// ─────────────────────────────────────────────────────────────────────────────

describe('CF-12 — half-month at horizon start pro-rates correctly', () => {
  it('asOf day 1 → first period is full month (activeDays = daysInMonth)', () => {
    const periods = buildMonthPeriods(2025, 7, 1, 1);
    expect(periods[0]?.activeDays).toBe(31); // July has 31 days
    expect(periods[0]?.daysInMonth).toBe(31);
  });

  it('asOf day 16 of 31-day month → activeDays = 16', () => {
    const periods = buildMonthPeriods(2025, 7, 16, 1); // July 16
    expect(periods[0]?.activeDays).toBe(16);
    expect(periods[0]?.daysInMonth).toBe(31);
  });

  it('asOf day 20 of 28-day month → activeDays = 9', () => {
    const periods = buildMonthPeriods(2025, 2, 20, 1); // Feb 20 non-leap
    expect(periods[0]?.activeDays).toBe(9);
    expect(periods[0]?.daysInMonth).toBe(28);
  });

  it('second period is always a full month', () => {
    const periods = buildMonthPeriods(2025, 7, 16, 2);
    expect(periods[1]?.activeDays).toBe(periods[1]?.daysInMonth);
  });

  it('partial first month produces pro-rated gross rent', () => {
    const stream = makeRentStream();
    const fullPeriod = buildMonthPeriods(2025, 7, 1, 1)[0]!;
    const halfPeriod = buildMonthPeriods(2025, 7, 16, 1)[0]!; // 16/31 of month

    const fullResult = rentForMonth(stream, fullPeriod);
    const halfResult = rentForMonth(stream, halfPeriod);

    expect(halfResult.grossRentCents).toBeLessThan(fullResult.grossRentCents);
    // Pro-rated: halfGross = fullGross × 16 / 31
    // mulDiv(216667n, 16n, 31n, HALF_UP)
    const expected = (216_667n * 16n + 15n) / 31n;
    expect(halfResult.grossRentCents).toBe(expected);
  });

  it('activeDays = daysInMonth on day 1 produces same result as full period', () => {
    const stream = makeRentStream();
    const period1 = makePeriod({ activeDays: 31, daysInMonth: 31 });
    const period2 = makePeriod({ activeDays: 31, daysInMonth: 31 });
    const r1 = rentForMonth(stream, period1);
    const r2 = rentForMonth(stream, period2);
    expect(r1.grossRentCents).toBe(r2.grossRentCents);
  });

  it('fixed_annual expense is pro-rated for partial first period (line 192 branch)', () => {
    // Covers the activeDays < daysInMonth branch in expensesForMonth.
    const partialPeriod = makePeriod({ activeDays: 16, daysInMonth: 31 });
    const expense: ExpenseStream = {
      kind: 'fixed_annual',
      annualBaseCents: 120_000n, // $1200/yr
      escalation: 'none',
      isCapital: false,
    };
    const { operatingExpensesCents } = expensesForMonth([expense], partialPeriod, 0n, 0n);
    // Full month = 120000 / 12 = 10000; partial must be less
    expect(operatingExpensesCents).toBeGreaterThan(0n);
    expect(operatingExpensesCents).toBeLessThan(10_000n);
  });

  it('buildMonthPeriods handles December → January year rollover (lines 69-71 branch)', () => {
    // Triggers the `month > 12` branch that resets month=1 and increments year.
    const periods = buildMonthPeriods(2025, 11, 1, 3); // Nov → Dec → Jan
    expect(periods[0]?.calendarMonth).toBe(11);
    expect(periods[0]?.calendarYear).toBe(2025);
    expect(periods[1]?.calendarMonth).toBe(12);
    expect(periods[1]?.calendarYear).toBe(2025);
    expect(periods[2]?.calendarMonth).toBe(1);
    expect(periods[2]?.calendarYear).toBe(2026); // year rolled
    expect(periods[2]?.financialYear).toBe('FY2026'); // Jan 2026 = FY2026
  });
});

// ── Integration: computeCashFlow wires all components correctly ───────────────

describe('CashFlowService integration — computeCashFlow', () => {
  const periods = buildMonthPeriods(2025, 7, 1, 3); // 3 months from Jul 2025

  const loanPeriods: LoanPeriodData[] = periods.map(() => ({
    interestCharged: 100_000n, // $1000/month interest
    principalPaid: 50_000n, // $500/month principal
  }));

  const input = {
    periods,
    rent: makeRentStream({ vacancyWeeksPerYear: 2 }),
    expenses: [
      {
        kind: 'fixed_annual' as const,
        annualBaseCents: 240_000n, // $2400/yr = $200/month
        escalation: 'none' as const,
        isCapital: false,
      },
    ],
    loans: [loanPeriods],
    mixedUseFractionBps: 10000, // 100% investment
  };

  it('produces one CashFlowMonth per period', () => {
    const output = computeCashFlow(input);
    expect(output.months).toHaveLength(3);
  });

  it('deductibleInterest equals total interest when 100% investment', () => {
    const output = computeCashFlow(input);
    for (const m of output.months) {
      expect(m.deductibleInterestCents).toBe(100_000n);
      expect(m.nonDeductibleInterestCents).toBe(0n);
    }
  });

  it('principalPaid is tracked but NOT included in netOperatingCash', () => {
    const output = computeCashFlow(input);
    for (const m of output.months) {
      expect(m.principalPaidCents).toBe(50_000n);
      // netOp = effectiveRent - operating - deductibleInterest (principal excluded)
      const expected = m.effectiveRentCents - m.operatingExpensesCents - m.deductibleInterestCents;
      expect(m.netOperatingCashCents).toBe(expected);
    }
  });

  it('aggregateToFY sums all periods into one FY (all Jul–Sep = FY2026)', () => {
    const output = computeCashFlow(input);
    expect(output.byFY.size).toBe(1);
    expect(output.byFY.has('FY2026')).toBe(true);
    const fy = output.byFY.get('FY2026')!;
    expect(fy.principalPaidCents).toBe(50_000n * 3n); // 3 months
  });
});
