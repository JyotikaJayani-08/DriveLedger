import { escapeCsvCell, toCsvLine, buildLedgerCsv } from '../csvExport';

describe('escapeCsvCell', () => {
  it('passes plain values through and blanks null/undefined', () => {
    expect(escapeCsvCell('abc')).toBe('abc');
    expect(escapeCsvCell(12.5)).toBe('12.5');
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('quotes commas, quotes and newlines', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('l1\nl2')).toBe('"l1\nl2"');
  });

  it('neutralises formula injection in strings but not numbers', () => {
    expect(escapeCsvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(escapeCsvCell(-5)).toBe('-5');
  });
});

describe('toCsvLine', () => {
  it('joins escaped cells', () => {
    expect(toCsvLine(['a', 'b,c', 3, null])).toBe('a,"b,c",3,');
  });
});

describe('buildLedgerCsv', () => {
  const data: any = {
    vehicles: [{ id: 'v1', nickname: 'Swift' }],
    fuel_entries: [
      { vehicle_id: 'v1', date: '2026-02-01', odometer: 1000, fuel_amount: 10, fuel_unit: 'litres', total_cost: 1000, fuel_station: 'HP, Bandra', notes: null, deleted_at: null },
      { vehicle_id: 'v1', date: '2026-03-01', odometer: 1500, fuel_amount: 5, fuel_unit: 'litres', total_cost: 500, fuel_station: null, notes: null, deleted_at: '2026-03-02' },
    ],
    service_records: [
      { vehicle_id: 'v1', date: '2026-01-15', service_type: 'Oil Change', work_done: 'Oil', garage_name: 'Joe', odometer: 900, cost: 2000, deleted_at: null },
    ],
    expenses: [
      { vehicle_id: 'v1', date: '2026-02-10', category: 'Parking', description: null, amount: 50, deleted_at: null },
    ],
    documents: [],
  };

  it('has a header row and skips soft-deleted rows', () => {
    const lines = buildLedgerCsv(data).split('\r\n');
    expect(lines[0]).toBe('Date,Vehicle,Type,Category,Details,Odometer,Quantity,Unit,Amount');
    expect(lines).toHaveLength(4); // header + 3 live rows
  });

  it('sorts oldest first and escapes cells', () => {
    const lines = buildLedgerCsv(data).split('\r\n');
    expect(lines[1]).toContain('Service');
    expect(lines[1]).toContain('Oil @ Joe');
    expect(lines[2]).toContain('Fuel');
    expect(lines[2]).toContain('"HP, Bandra"');
    expect(lines[3]).toContain('Expense');
  });
});
