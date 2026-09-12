/**
 * Stats Helpers
 *
 * Shared computation functions for monthly cost breakdowns.
 * Extracted from dashboard (index.tsx) and stats screen (stats.tsx)
 * where the same filter-reduce pattern was duplicated.
 */

import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord } from '@/types/service';
import type { Expense } from '@/types/expense';

/**
 * Filters records to a specific month/year and sums a numeric field.
 */
function sumByMonth<T>(
  records: T[],
  month: number,
  year: number,
  getDate: (record: T) => string,
  getAmount: (record: T) => number
): number {
  return records
    .filter((r) => {
      const d = new Date(getDate(r));
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((sum, r) => sum + getAmount(r), 0);
}

/**
 * Computes the total spending for a given month across fuel, service, and expenses.
 */
export function getMonthlyTotalSpend(
  entries: FuelEntry[],
  serviceRecords: ServiceRecord[],
  expenses: Expense[],
  month: number,
  year: number
): { fuel: number; service: number; expense: number; total: number } {
  const fuel = sumByMonth(entries, month, year, (e) => e.date, (e) => e.total_cost);
  const service = sumByMonth(serviceRecords, month, year, (r) => r.date, (r) => r.cost || 0);
  const expense = sumByMonth(expenses, month, year, (e) => e.date, (e) => e.amount);
  return { fuel, service, expense, total: fuel + service + expense };
}

/**
 * Computes the current month's total spend.
 */
export function getCurrentMonthTotalSpend(
  entries: FuelEntry[],
  serviceRecords: ServiceRecord[],
  expenses: Expense[]
): { fuel: number; service: number; expense: number; total: number } {
  const now = new Date();
  return getMonthlyTotalSpend(entries, serviceRecords, expenses, now.getMonth(), now.getFullYear());
}

/**
 * Computes monthly spending data for the last N months (for charts).
 */
export function getMonthlySpendHistory(
  entries: FuelEntry[],
  serviceRecords: ServiceRecord[],
  expenses: Expense[],
  months: number = 6
): { label: string; value: number }[] {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const result: { label: string; value: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const { total } = getMonthlyTotalSpend(
      entries,
      serviceRecords,
      expenses,
      monthDate.getMonth(),
      monthDate.getFullYear()
    );
    result.push({ label: monthNames[monthDate.getMonth()], value: Math.round(total) });
  }

  return result;
}
