/**
 * Expense Categories
 *
 * Non-fuel vehicle expense categories.
 * Fuel is tracked separately in the fuel_entries table.
 *
 * Matches the charter's expense category list.
 */

export interface ExpenseCategoryItem {
  id: string;
  name: string;
  icon: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategoryItem[] = [
  { id: 'insurance', name: 'Insurance', icon: '🛡️' },
  { id: 'repair', name: 'Repair', icon: '🔧' },
  { id: 'tyres', name: 'Tyres', icon: '🛞' },
  { id: 'parking', name: 'Parking', icon: '🅿️' },
  { id: 'cleaning', name: 'Cleaning', icon: '🧽' },
  { id: 'fine', name: 'Fine / Challan', icon: '📋' },
  { id: 'accessories', name: 'Accessories', icon: '🎒' },
  { id: 'toll', name: 'Toll', icon: '🛣️' },
  { id: 'other', name: 'Other', icon: '📝' },
];

/** Array of category names for simple lookups */
export const EXPENSE_CATEGORY_LIST = EXPENSE_CATEGORIES.map((c) => c.name);

