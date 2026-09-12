/**
 * Stats Screen
 *
 * Summary cards + visual bar charts.
 * Charts are built with pure React Native Views — no external charting library needed.
 *
 * Shows:
 * - Total ownership cost (fuel + service + expense)
 * - Summary cards (total fuel cost, fill-ups, avg/best/worst mileage)
 * - Mileage trend bar chart (last 10 fill-ups)
 * - Monthly fuel cost bar chart (last 6 months)
 * - Cost breakdown by category
 */

import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { useFuelStore } from '@/stores/fuelStore';
import { useServiceStore } from '@/stores/serviceStore';
import { useExpenseStore } from '@/stores/expenseStore';
import { useVehicleStore } from '@/stores/vehicleStore';
import { MILEAGE_UNIT_LABELS } from '@/constants/fuelTypes';
import { formatCurrency, formatMileage } from '@/utils/format';
import { getMonthlySpendHistory } from '@/utils/statsHelpers';
import { VehicleContextHeader } from '@/components/VehicleContextHeader';

// ─── Pure RN Bar Chart Component ────────────────────────────────────

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
  barColor: string;
  labelColor: string;
  valueColor: string;
  height?: number;
}

function BarChart({ data, maxValue, barColor, labelColor, valueColor, height = 120 }: BarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={chartStyles.container}>
      <View style={[chartStyles.barsRow, { height }]}>
        {data.map((item, i) => {
          const barHeight = max > 0 ? (item.value / max) * height : 0;
          return (
            <View key={i} style={chartStyles.barColumn}>
              <Text style={[chartStyles.barValue, { color: valueColor }]}>
                {item.value % 1 === 0 ? item.value : item.value.toFixed(1)}
              </Text>
              <View
                style={[
                  chartStyles.bar,
                  {
                    height: Math.max(barHeight, 4),
                    backgroundColor: item.color || barColor,
                    borderRadius: 4,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={chartStyles.labelsRow}>
        {data.map((item, i) => (
          <View key={i} style={chartStyles.labelColumn}>
            <Text style={[chartStyles.label, { color: labelColor }]} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {},
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '80%',
    minWidth: 12,
  },
  barValue: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  labelsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  labelColumn: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
});

// ─── Stats Screen ───────────────────────────────────────────────────

export default function StatsScreen() {
  const colors = useThemeColors();
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);

  const entries = useFuelStore((s) => s.entries);
  const stats = useFuelStore((s) => s.stats);
  const loadEntries = useFuelStore((s) => s.loadEntries);

  const serviceRecords = useServiceStore((s) => s.records);
  const loadRecords = useServiceStore((s) => s.loadRecords);

  const expenses = useExpenseStore((s) => s.expenses);
  const loadExpenses = useExpenseStore((s) => s.loadExpenses);

  useEffect(() => {
    if (selectedVehicle) {
      loadEntries(selectedVehicle.id);
      loadRecords(selectedVehicle.id);
      loadExpenses(selectedVehicle.id);
    }
  }, [selectedVehicle?.id]);

  if (!selectedVehicle) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48 }}>📈</Text>
          <Text style={[Typography.h3, { color: colors.text, marginTop: Spacing.lg }]}>
            No vehicle selected
          </Text>
        </View>
      </View>
    );
  }

  // ── Compute stats ──
  const totalFuelCost = entries.reduce((sum, e) => sum + e.total_cost, 0);
  const totalServiceCost = serviceRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
  const totalExpenseCost = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalOwnershipCost = totalFuelCost + totalServiceCost + totalExpenseCost;
  const totalLitres = entries.reduce((sum, e) => sum + e.fuel_amount, 0);
  const totalEntries = entries.length;

  // ── Mileage trend (last 10 entries with mileage, oldest first) ──
  const mileageEntries = entries
    .filter((e) => e.calculated_mileage != null)
    .slice(0, 10)
    .reverse();

  const mileageChartData = mileageEntries.map((e) => {
    const date = new Date(e.date);
    const label = `${date.getDate()}/${date.getMonth() + 1}`;
    const value = e.calculated_mileage!;
    const avg = stats.runningAverage?.value ?? 0;
    // Color code: green if above average, orange if below
    const color = value >= avg ? colors.success : colors.warning;
    return { label, value, color };
  });

  // ── Monthly cost (last 6 months) ──
  const monthlyCostData = getMonthlySpendHistory(entries, serviceRecords, expenses, 6);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <VehicleContextHeader label="Stats for" />

        <Text style={[Typography.h2, { color: colors.text, marginBottom: Spacing.xl, marginTop: Spacing.md }]}>
          {selectedVehicle.nickname} Stats
        </Text>

        {/* ── Total Ownership Cost (hero card) ── */}
        <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
          <Text style={[styles.heroLabel, { color: 'rgba(255,255,255,0.8)' }]}>
            Total Ownership Cost
          </Text>
          <Text style={[Typography.stat, { color: '#FFFFFF' }]}>
            {formatCurrency(totalOwnershipCost)}
          </Text>
          <View style={styles.heroBreakdown}>
            <Text style={[Typography.caption, { color: 'rgba(255,255,255,0.7)' }]}>
              ⛽ {formatCurrency(totalFuelCost)}
            </Text>
            <Text style={[Typography.caption, { color: 'rgba(255,255,255,0.7)' }]}>
              🔧 {formatCurrency(totalServiceCost)}
            </Text>
            <Text style={[Typography.caption, { color: 'rgba(255,255,255,0.7)' }]}>
              💰 {formatCurrency(totalExpenseCost)}
            </Text>
          </View>
        </View>

        {/* ── Summary Cards ── */}
        <View style={styles.grid}>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Total Fuel Cost</Text>
            <Text style={[Typography.statMedium, { color: colors.text }]}>
              {formatCurrency(totalFuelCost)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Fill-ups</Text>
            <Text style={[Typography.statMedium, { color: colors.text }]}>{totalEntries}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Avg Mileage</Text>
            <Text style={[Typography.statMedium, { color: colors.text }]}>
              {stats.runningAverage
                ? formatMileage(stats.runningAverage.value, MILEAGE_UNIT_LABELS[stats.runningAverage.unit])
                : '—'}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Best / Worst</Text>
            <Text style={[Typography.statMedium, { color: colors.success }]}>
              {stats.best ? stats.best.value.toFixed(1) : '—'}
            </Text>
            {stats.worst && (
              <Text style={[Typography.caption, { color: colors.danger }]}>
                / {stats.worst.value.toFixed(1)}
              </Text>
            )}
          </View>
        </View>

        {/* ── Mileage Trend Chart ── */}
        {mileageChartData.length >= 2 && (
          <View style={[styles.chartCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
            <Text style={[Typography.h3, { color: colors.text, marginBottom: Spacing.lg }]}>
              Mileage Trend
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary, marginBottom: Spacing.md }]}>
              Last {mileageChartData.length} fill-ups · Green = above avg, Orange = below
            </Text>
            <BarChart
              data={mileageChartData}
              barColor={colors.primary}
              labelColor={colors.textTertiary}
              valueColor={colors.textSecondary}
              height={100}
            />
          </View>
        )}

        {/* ── Monthly Cost Chart ── */}
        {monthlyCostData.some((d) => d.value > 0) && (
          <View style={[styles.chartCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
            <Text style={[Typography.h3, { color: colors.text, marginBottom: Spacing.lg }]}>
              Monthly Total Spend
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary, marginBottom: Spacing.md }]}>
              Fuel + Service + Expenses
            </Text>
            <BarChart
              data={monthlyCostData}
              barColor={colors.accent}
              labelColor={colors.textTertiary}
              valueColor={colors.textSecondary}
              height={100}
            />
          </View>
        )}

        {/* ── Extra Stats ── */}
        <View style={[styles.chartCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
          <Text style={[Typography.h3, { color: colors.text, marginBottom: Spacing.md }]}>
            Quick Numbers
          </Text>
          <View style={[styles.quickRow, { borderBottomColor: colors.border }]}>
            <Text style={[Typography.body, { color: colors.textSecondary }]}>Total {entries[0]?.fuel_unit || 'fuel'} consumed</Text>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
              {totalLitres.toFixed(1)}
            </Text>
          </View>
          <View style={[styles.quickRow, { borderBottomColor: colors.border }]}>
            <Text style={[Typography.body, { color: colors.textSecondary }]}>Avg cost per fill</Text>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
              {totalEntries > 0 ? formatCurrency(totalFuelCost / totalEntries) : '—'}
            </Text>
          </View>
          <View style={[styles.quickRow, { borderBottomColor: colors.border }]}>
            <Text style={[Typography.body, { color: colors.textSecondary }]}>Services logged</Text>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
              {serviceRecords.length}
            </Text>
          </View>
          <View style={[styles.quickRow, { borderBottomColor: colors.border }]}>
            <Text style={[Typography.body, { color: colors.textSecondary }]}>Total service cost</Text>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
              {formatCurrency(totalServiceCost)}
            </Text>
          </View>
          {entries.length >= 2 && (
            <View style={[styles.quickRow, { borderBottomColor: colors.border }]}>
              <Text style={[Typography.body, { color: colors.textSecondary }]}>Total km tracked</Text>
              <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
                {(entries[0].odometer - entries[entries.length - 1].odometer).toLocaleString('en-IN')} km
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: Spacing.section }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg },
  heroCard: {
    borderRadius: Sizing.radiusLg,
    padding: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  heroBreakdown: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xl },
  summaryCard: {
    width: '47%',
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
  },
  cardLabel: {
    fontSize: 12, fontWeight: '500', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: Spacing.sm,
  },
  chartCard: {
    borderRadius: Sizing.radiusMd,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emptyState: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
});
