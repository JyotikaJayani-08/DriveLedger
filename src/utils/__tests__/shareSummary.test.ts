import { buildShareSummary, computeCostPerKm } from '../shareSummary';

const money = (n: number) => `Rs.${n.toFixed(0)}`;

describe('computeCostPerKm', () => {
  it('returns null cost with fewer than 2 readings', () => {
    expect(computeCostPerKm([], 100)).toEqual({ kmTracked: 0, costPerKm: null });
    expect(computeCostPerKm([500], 100)).toEqual({ kmTracked: 0, costPerKm: null });
  });

  it('computes from min/max regardless of order', () => {
    expect(computeCostPerKm([1500, 1000, 1200], 500)).toEqual({ kmTracked: 500, costPerKm: 1 });
  });

  it('returns null cost when distance is zero', () => {
    expect(computeCostPerKm([1000, 1000], 500)).toEqual({ kmTracked: 0, costPerKm: null });
  });
});

describe('buildShareSummary', () => {
  const base = {
    vehicleName: 'Swift',
    fuelCost: 6000,
    serviceCost: 3000,
    expenseCost: 1000,
    fillUps: 12,
    formatMoney: money,
  };

  it('includes totals and breakdown', () => {
    const text = buildShareSummary(base);
    expect(text).toContain('🚗 Swift');
    expect(text).toContain('Total cost: Rs.10000');
    expect(text).toContain('Fuel: Rs.6000');
    expect(text).toContain('Fill-ups: 12');
    expect(text).toContain('Tracked with DriveLedger');
  });

  it('adds registration and optional lines only when provided', () => {
    const minimal = buildShareSummary(base);
    expect(minimal).not.toContain('Avg mileage');
    expect(minimal).not.toContain('Cost per km');

    const full = buildShareSummary({
      ...base,
      registrationNumber: 'MH12AB1234',
      odometerText: '12,345 km',
      avgMileageText: '18.2 km/L',
      bestMileageText: '21.0',
      worstMileageText: '15.0',
      kmTracked: 5000,
      costPerKm: 2,
    });
    expect(full).toContain('Swift (MH12AB1234)');
    expect(full).toContain('Odometer: 12,345 km');
    expect(full).toContain('Avg mileage: 18.2 km/L');
    expect(full).toContain('Best / Worst: 21.0 / 15.0');
    expect(full).toContain('Cost per km: Rs.2');
  });
});
