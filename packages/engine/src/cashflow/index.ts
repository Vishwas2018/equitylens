export type {
  MonthPeriod,
  RentStream,
  ExpenseStream,
  ExpenseKind,
  ExpenseEscalation,
  LoanPeriodData,
  CashFlowInput,
  CashFlowMonth,
  FYAggregate,
  CashFlowOutput,
} from './types.js';

export {
  daysInMonth,
  financialYearOf,
  buildMonthPeriods,
  compoundCents,
  grossRentForMonth,
  vacancyLossForMonth,
  rentForMonth,
  escalateExpense,
  expensesForMonth,
  apportionDeductible,
  aggregateToFY,
  computeCashFlow,
} from './service.js';
