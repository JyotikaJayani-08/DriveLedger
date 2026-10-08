/**
 * Share Summary
 *
 * Builds a plain-text vehicle summary for the native share sheet
 * (WhatsApp, Notes, email, …). Pure function — currency formatting is
 * injected so it stays independent of user preferences and is unit-testable.
 */

export interface ShareSummaryInput {
  vehicleName: string;
  registrationNumber?: string | null;
  /** Pre-formatted odometer, e.g. "12,345 km". */
  odometerText?: string | null;
  fuelCost: number;
  serviceCost: number;
  expenseCost: number;
  fillUps: number;
  /** Pre-formatted average mileage, e.g. "18.2 km/L". */
  avgMileageText?: string | null;
  /** Pre-formatted best / worst mileage values, e.g. "21.0". */
  bestMileageText?: string | null;
  worstMileageText?: string | null;
  kmTracked?: number | null;
  costPerKm?: number | null;
  /** Currency formatter (e.g. formatCurrency from utils/format). */
  formatMoney: (amount: number) => string;
}

/**
 * Computes km tracked and cost-per-km from fuel entries' odometer readings.
 *
 * @param odometers - Odometer readings in any order
 * @param totalCost - Total ownership cost over the tracked distance
 */
export function computeCostPerKm(
  odometers: number[],
  totalCost: number
): { kmTracked: number; costPerKm: number | null } {
  if (odometers.length < 2) return { kmTracked: 0, costPerKm: null };
  const kmTracked = Math.max(Math.max(...odometers) - Math.min(...odometers), 0);
  return { kmTracked, costPerKm: kmTracked > 0 ? totalCost / kmTracked : null };
}

/**
 * Builds the shareable text summary.
 */
export function buildShareSummary(input: ShareSummaryInput): string {
  const {
    vehicleName, registrationNumber, odometerText,
    fuelCost, serviceCost, expenseCost, fillUps,
    avgMileageText, bestMileageText, worstMileageText,
    kmTracked, costPerKm, formatMoney,
  } = input;

  const total = fuelCost + serviceCost + expenseCost;
  const title = registrationNumber ? `${vehicleName} (${registrationNumber})` : vehicleName;

  const lines: string[] = [`🚗 ${title}`];
  if (odometerText) lines.push(`🧭 Odometer: ${odometerText}`);

  lines.push(
    '',
    `💰 Total cost: ${formatMoney(total)}`,
    `   ⛽ Fuel: ${formatMoney(fuelCost)}`,
    `   🔧 Service: ${formatMoney(serviceCost)}`,
    `   🧾 Other: ${formatMoney(expenseCost)}`,
    '',
    `⛽ Fill-ups: ${fillUps}`,
  );

  if (avgMileageText) lines.push(`📊 Avg mileage: ${avgMileageText}`);
  if (bestMileageText && worstMileageText) {
    lines.push(`🏆 Best / Worst: ${bestMileageText} / ${worstMileageText}`);
  }
  if (kmTracked && kmTracked > 0) lines.push(`🛣️ Tracked: ${Math.round(kmTracked).toLocaleString('en-IN')} km`);
  if (costPerKm != null) lines.push(`📉 Cost per km: ${formatMoney(costPerKm)}`);

  lines.push('', 'Tracked with DriveLedger');
  return lines.join('\n');
}
