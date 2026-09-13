/**
 * History Screen
 *
 * Shows fuel history, service history, and expense history.
 * Features:
 * - Segmented tabs: Fuel | Service | Expenses
 * - Tap to edit, long press to delete
 * - FABs for quick-add service/expense
 * - Wired to centralized Zustand stores
 */

import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useVehicleStore } from '@/stores/vehicleStore';
import { useFuelStore } from '@/stores/fuelStore';
import { useServiceStore } from '@/stores/serviceStore';
import { useExpenseStore } from '@/stores/expenseStore';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';
import { formatDisplayDateLong } from '@/utils/date';
import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord } from '@/types/service';
import type { Expense } from '@/types/expense';
import { VehicleContextHeader } from '@/components/VehicleContextHeader';

type Tab = 'fuel' | 'service' | 'expenses';

export default function HistoryScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);

  // Stores
  const fuelEntries = useFuelStore((s) => s.entries);
  const loadEntries = useFuelStore((s) => s.loadEntries);
  const deleteFuelEntry = useFuelStore((s) => s.deleteFuelEntry);

  const serviceRecords = useServiceStore((s) => s.records);
  const loadRecords = useServiceStore((s) => s.loadRecords);
  const deleteServiceRecord = useServiceStore((s) => s.deleteRecord);

  const expenses = useExpenseStore((s) => s.expenses);
  const loadExpenses = useExpenseStore((s) => s.loadExpenses);
  const deleteExpense = useExpenseStore((s) => s.deleteExpense);

  const [tab, setTab] = useState<Tab>('fuel');

  const loadAll = useCallback(() => {
    if (selectedVehicle) {
      loadEntries(selectedVehicle.id);
      loadRecords(selectedVehicle.id);
      loadExpenses(selectedVehicle.id);
    }
  }, [selectedVehicle?.id]);

  useFocusEffect(loadAll);

  const handleDeleteFuel = (entry: FuelEntry) => {
    Alert.alert(
      'Delete This Fill-up? ⛽',
      `Heads up — deleting the entry from ${formatDisplayDateLong(entry.date)} will trigger a mileage recalculation for everything after it.\n${entry.fuel_amount} ${entry.fuel_unit} · ${formatCurrency(entry.total_cost)}\n\nStill want to nuke it?`,
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Delete It',
          style: 'destructive',
          onPress: () => {
            if (selectedVehicle) {
              deleteFuelEntry(entry.id, selectedVehicle);
            }
          },
        },
      ]
    );
  };

  const handleDeleteService = (record: ServiceRecord) => {
    Alert.alert(
      'Delete Service Record? 🔧',
      `Bye-bye "${record.service_type}" from ${formatDisplayDateLong(record.date)}. Gone forever!`,
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Delete It',
          style: 'destructive',
          onPress: () => {
            deleteServiceRecord(record.id);
          },
        },
      ]
    );
  };

  const handleDeleteExpense = (expense: Expense) => {
    Alert.alert(
      'Delete Expense? 💸',
      `Removing "${expense.category}" — ${formatCurrency(expense.amount)}. One less thing to track!`,
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Delete It',
          style: 'destructive',
          onPress: () => {
            deleteExpense(expense.id);
          },
        },
      ]
    );
  };

  // ── Fuel Entry Row ──
  const renderFuelEntry = ({ item }: { item: FuelEntry }) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/add-fuel', params: { id: item.id } })}
      onLongPress={() => handleDeleteFuel(item)}
      activeOpacity={0.7}
      style={[styles.entryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.entryHeader}>
        <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>
          {formatDisplayDateLong(item.date)}
        </Text>
        <Text style={[Typography.body, { color: colors.primary, fontWeight: '700' }]}>
          {formatCurrency(item.total_cost)}
        </Text>
      </View>
      <View style={styles.entryDetails}>
        <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
          {item.fuel_amount} {item.fuel_unit} · ₹{item.price_per_unit}/{item.fuel_unit === 'kWh' ? 'kWh' : item.fuel_unit === 'kg' ? 'kg' : 'L'}
        </Text>
        <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
          {item.odometer.toLocaleString('en-IN')} km
        </Text>
      </View>
      {item.calculated_mileage && (
        <View style={[styles.mileageBadge, { backgroundColor: colors.successLight }]}>
          <Text style={[Typography.caption, { color: colors.success }]}>
            {item.calculated_mileage.toFixed(1)} {item.mileage_unit === 'km_per_litre' ? 'km/L' : item.mileage_unit === 'km_per_kg' ? 'km/kg' : 'km/kWh'}
          </Text>
        </View>
      )}
      {!item.calculated_mileage && item.is_full_tank === 0 && (
        <View style={[styles.mileageBadge, { backgroundColor: colors.warningLight }]}>
          <Text style={[Typography.caption, { color: colors.warning }]}>Partial Fill</Text>
        </View>
      )}
      <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
        Tap to edit · Long press to delete
      </Text>
    </TouchableOpacity>
  );

  // ── Service Record Row ──
  const renderServiceRecord = ({ item }: { item: ServiceRecord }) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/add-service', params: { id: item.id } })}
      onLongPress={() => handleDeleteService(item)}
      activeOpacity={0.7}
      style={[styles.entryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.entryHeader}>
        <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>
          {item.service_type}
        </Text>
        {item.cost != null && (
          <Text style={[Typography.body, { color: colors.primary, fontWeight: '700' }]}>
            {formatCurrency(item.cost)}
          </Text>
        )}
      </View>
      <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
        {formatDisplayDateLong(item.date)}
        {item.garage_name ? ` · ${item.garage_name}` : ''}
      </Text>
      {item.work_done && (
        <Text style={[Typography.bodySmall, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
          {item.work_done}
        </Text>
      )}
      <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
        Tap to edit · Long press to delete
      </Text>
    </TouchableOpacity>
  );

  // ── Expense Row ──
  const renderExpense = ({ item }: { item: Expense }) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/add-expense', params: { id: item.id } })}
      onLongPress={() => handleDeleteExpense(item)}
      activeOpacity={0.7}
      style={[styles.entryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.entryHeader}>
        <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>
          {item.category}
        </Text>
        <Text style={[Typography.body, { color: colors.accent, fontWeight: '700' }]}>
          {formatCurrency(item.amount)}
        </Text>
      </View>
      <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
        {formatDisplayDateLong(item.date)}
      </Text>
      {item.description && (
        <Text style={[Typography.bodySmall, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
          {item.description}
        </Text>
      )}
      <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
        Tap to edit · Long press to delete
      </Text>
    </TouchableOpacity>
  );

  const emptyComponent = (type: string) => (
    <View style={styles.emptyState}>
      <Text style={{ fontSize: 48, marginBottom: Spacing.lg }}>
        {type === 'fuel' ? '⛽' : type === 'service' ? '🔧' : '💰'}
      </Text>
      <Text style={[Typography.h3, { color: colors.text }]}>No {type} entries yet</Text>
      <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
        {type === 'fuel'
          ? 'Tap ⛽ Add Fuel on the Home screen to record a refill.'
          : type === 'service'
          ? "Tap 🔧 below to record your vehicle's latest maintenance or workshop visit."
          : 'Tap 💰 below to record non-fuel costs like tolls, parking, or insurance.'}
      </Text>
    </View>
  );

  if (!selectedVehicle) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[Typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.section }]}>
          No vehicle selected.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Vehicle Context ── */}
      <VehicleContextHeader label="History for" />

      {/* ── Segmented Tabs ── */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(['fuel', 'service', 'expenses'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tabButton,
              tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
          >
            <Text
              style={[
                Typography.bodySmall,
                {
                  color: tab === t ? colors.primary : colors.textSecondary,
                  fontWeight: tab === t ? '700' : '400',
                },
              ]}
            >
              {t === 'fuel' ? `Fuel (${fuelEntries.length})` : t === 'service' ? `Service (${serviceRecords.length})` : `Expenses (${expenses.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── List ── */}
      {tab === 'fuel' && (
        <FlatList
          data={fuelEntries}
          keyExtractor={(item) => item.id}
          renderItem={renderFuelEntry}
          contentContainerStyle={styles.list}
          ListEmptyComponent={emptyComponent('fuel')}
        />
      )}
      {tab === 'service' && (
        <FlatList
          data={serviceRecords}
          keyExtractor={(item) => item.id}
          renderItem={renderServiceRecord}
          contentContainerStyle={styles.list}
          ListEmptyComponent={emptyComponent('service')}
        />
      )}
      {tab === 'expenses' && (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          renderItem={renderExpense}
          contentContainerStyle={styles.list}
          ListEmptyComponent={emptyComponent('expenses')}
        />
      )}

      {/* ── FAB: Quick-add Service or Expense from History ── */}
      {tab === 'service' && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
          onPress={() => router.push('/add-service')}
        >
          <Text style={styles.fabIcon}>🔧</Text>
          <Text style={[styles.fabText, { color: colors.textOnPrimary }]}>Record Maintenance</Text>
        </TouchableOpacity>
      )}
      {tab === 'expenses' && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.accent }]}
          activeOpacity={0.85}
          onPress={() => router.push('/add-expense')}
        >
          <Text style={styles.fabIcon}>💰</Text>
          <Text style={[styles.fabText, { color: '#1A1C1E' }]}>Track Running Cost</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 100 },
  entryCard: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  entryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mileageBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Sizing.radiusFull,
    marginTop: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.section * 2,
    paddingHorizontal: Spacing.xxxl,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.xxl,
    right: Spacing.lg,
    height: Sizing.fab,
    borderRadius: Sizing.radiusFull,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    gap: Spacing.sm,
  },
  fabIcon: { fontSize: 22 },
  fabText: { fontSize: 16, fontWeight: '700' },
});
