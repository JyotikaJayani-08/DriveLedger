/**
 * Home / Vehicle Dashboard
 *
 * THE MOST IMPORTANT SCREEN. This is what the user sees 80% of the time.
 *
 * Charter requirements:
 * - Last selected vehicle dashboard on open
 * - Mileage card (last fill + running average)
 * - Quick stats (total spent, last service, this month, km until service)
 * - [+ Add Fuel] — biggest button on screen
 * - Vehicle switcher (top area)
 * - Document expiry warnings
 *
 * Flow: Open App → Dashboard → Tap [+ Add Fuel] → Fill → Save → See mileage → Close
 */

import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useVehicleStore } from '@/stores/vehicleStore';
import { useFuelStore } from '@/stores/fuelStore';
import { useServiceStore, getKmUntilService } from '@/stores/serviceStore';
import { useExpenseStore } from '@/stores/expenseStore';
import { useDocumentStore } from '@/stores/documentStore';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { MILEAGE_UNIT_LABELS } from '@/constants/fuelTypes';
import { formatCurrency, formatOdometer, formatMileage } from '@/utils/format';
import { formatDisplayDateLong, daysUntil } from '@/utils/date';
import { getCurrentMonthTotalSpend } from '@/utils/statsHelpers';
import { DOCUMENT_TYPE_LABELS } from '@/constants/documentTypes';
import { VehicleContextHeader } from '@/components/VehicleContextHeader';

export default function HomeScreen() {
  const colors = useThemeColors();
  const router = useRouter();

  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);

  const entries = useFuelStore((s) => s.entries);
  const stats = useFuelStore((s) => s.stats);
  const partialEstimates = useFuelStore((s) => s.partialEstimates);
  const loadEntries = useFuelStore((s) => s.loadEntries);

  const serviceRecords = useServiceStore((s) => s.records);
  const loadRecords = useServiceStore((s) => s.loadRecords);

  const expenses = useExpenseStore((s) => s.expenses);
  const loadExpenses = useExpenseStore((s) => s.loadExpenses);

  const expiringDocs = useDocumentStore((s) => s.expiringDocs);
  const loadDocuments = useDocumentStore((s) => s.loadDocuments);

  // Load all data when selected vehicle changes
  useEffect(() => {
    if (selectedVehicle) {
      loadEntries(selectedVehicle.id);
      loadRecords(selectedVehicle.id);
      loadExpenses(selectedVehicle.id);
      loadDocuments(selectedVehicle.id);
    }
  }, [selectedVehicle?.id]);

  if (!selectedVehicle) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyEmoji]}>🚗</Text>
          <Text style={[Typography.h2, { color: colors.text }]}>No vehicles yet</Text>
          <Text style={[Typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm }]}>
            Add your first vehicle to start tracking!
          </Text>
          <TouchableOpacity
            style={[styles.addVehicleButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/add-vehicle')}
            activeOpacity={0.85}
          >
            <Text style={[Typography.button, { color: colors.textOnPrimary }]}>+ Add Vehicle</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const lastEntry = entries.length > 0 ? entries[0] : null;
  const lastService = serviceRecords.length > 0 ? serviceRecords[0] : null;
  const kmUntilService = getKmUntilService(selectedVehicle, lastService);

  // Compute this month's total spend (fuel + service + expense)
  const { total: monthlyTotal } = getCurrentMonthTotalSpend(entries, serviceRecords, expenses);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Vehicle Context Header ── */}
        <VehicleContextHeader />

        {/* ── Vehicle Header ── */}
        <View style={styles.vehicleHeader}>
          <Text style={[Typography.h1, { color: colors.text }]}>
            {selectedVehicle.nickname}
          </Text>
          <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
            {selectedVehicle.registration_number}
          </Text>
        </View>

        {/* ── Mileage Card ── */}
        <View style={[styles.card, styles.mileageCard, { backgroundColor: colors.primary }]}>
          {stats.lastFillMileage ? (
            <>
              <Text style={[styles.mileageLabel, { color: 'rgba(255,255,255,0.8)' }]}>
                Last Fill Mileage
              </Text>
              <Text style={[Typography.stat, { color: '#FFFFFF' }]}>
                {formatMileage(
                  stats.lastFillMileage.value,
                  MILEAGE_UNIT_LABELS[stats.lastFillMileage.unit]
                )}
              </Text>
              {stats.runningAverage && (
                <Text style={[Typography.bodySmall, { color: 'rgba(255,255,255,0.7)', marginTop: Spacing.xs }]}>
                  Running avg: {formatMileage(
                    stats.runningAverage.value,
                    MILEAGE_UNIT_LABELS[stats.runningAverage.unit]
                  )}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={[Typography.h3, { color: '#FFFFFF' }]}>
                {entries.length === 0
                  ? 'No fuel entries yet'
                  : 'Not enough data yet'}
              </Text>
              <Text style={[Typography.bodySmall, { color: 'rgba(255,255,255,0.7)', marginTop: Spacing.sm }]}>
                {entries.length === 0
                  ? 'Fill up and tap + to log your first refill! ⛽'
                  : 'One more full-tank fill and we can calculate your mileage! 🎉'}
              </Text>
            </>
          )}
        </View>

        {/* ── Document Expiry Warnings ── */}
        {expiringDocs.length > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/documents')}
            style={[styles.expiryBanner, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}
            activeOpacity={0.7}
          >
            <Text style={[Typography.body, { color: colors.danger, fontWeight: '700', marginBottom: Spacing.xs }]}>
              ⚠️ Document Alert
            </Text>
            {expiringDocs.map((doc) => {
              const days = daysUntil(doc.expiry_date!);
              const label = DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] || doc.type;
              return (
                <Text key={doc.id} style={[Typography.bodySmall, { color: colors.danger }]}>
                  {label}: {days < 0 ? `Expired ${Math.abs(days)} days ago` : days === 0 ? 'Expires today!' : `Expires in ${days} days`}
                </Text>
              );
            })}
            <Text style={[Typography.caption, { color: colors.danger, marginTop: Spacing.xs, opacity: 0.7 }]}>
              Tap to view documents →
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Quick Stats Row (top) ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Odometer</Text>
            <Text style={[Typography.statMedium, { color: colors.text }]}>
              {selectedVehicle.current_odometer
                ? formatOdometer(selectedVehicle.current_odometer)
                : '—'}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Last Fill</Text>
            <Text style={[Typography.statMedium, { color: colors.text }]}>
              {lastEntry ? formatDisplayDateLong(lastEntry.date) : '—'}
            </Text>
          </View>
        </View>

        {/* ── Quick Stats Row (bottom) ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Last Service</Text>
            <Text style={[Typography.statMedium, { color: colors.text }]} numberOfLines={1}>
              {lastService ? formatDisplayDateLong(lastService.date) : '—'}
            </Text>
            {lastService && (
              <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]} numberOfLines={1}>
                {lastService.service_type}
              </Text>
            )}
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>This Month</Text>
            <Text style={[Typography.statMedium, { color: monthlyTotal > 0 ? colors.accent : colors.text }]}>
              {monthlyTotal > 0 ? formatCurrency(monthlyTotal) : '—'}
            </Text>
          </View>
        </View>

        {/* ── Km Until Service (if applicable) ── */}
        {kmUntilService !== null && (
          <View style={[styles.serviceAlert, {
            backgroundColor: kmUntilService <= 0 ? colors.dangerLight : kmUntilService <= 500 ? colors.warningLight : colors.successLight,
            borderColor: kmUntilService <= 0 ? colors.danger : kmUntilService <= 500 ? colors.warning : colors.success,
          }]}>
            <Text style={[Typography.body, {
              color: kmUntilService <= 0 ? colors.danger : kmUntilService <= 500 ? colors.warning : colors.success,
              fontWeight: '700',
            }]}>
              {kmUntilService <= 0
                ? `🔧 Service overdue by ${Math.abs(Math.round(kmUntilService))} km`
                : `🔧 Next service in ${Math.round(kmUntilService).toLocaleString('en-IN')} km`}
            </Text>
          </View>
        )}

        {/* ── Tyre Pressure Recommendation ── */}
        {(selectedVehicle.front_tyre_pressure || selectedVehicle.rear_tyre_pressure) && (
          <View style={[styles.tyrePressureCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary, marginBottom: Spacing.sm }]}>
              🚨 Recommended Tyre Pressure
            </Text>
            <View style={styles.tyrePressureRow}>
              {selectedVehicle.front_tyre_pressure != null && (
                <View style={styles.tyrePressureItem}>
                  <Text style={[Typography.caption, { color: colors.textTertiary }]}>Front</Text>
                  <Text style={[Typography.statMedium, { color: colors.text }]}>
                    {selectedVehicle.front_tyre_pressure} PSI
                  </Text>
                </View>
              )}
              {selectedVehicle.rear_tyre_pressure != null && (
                <View style={styles.tyrePressureItem}>
                  <Text style={[Typography.caption, { color: colors.textTertiary }]}>Rear</Text>
                  <Text style={[Typography.statMedium, { color: colors.text }]}>
                    {selectedVehicle.rear_tyre_pressure} PSI
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Recent Entries ── */}
        {entries.length > 0 && (
          <View style={styles.section}>
            <Text style={[Typography.h3, { color: colors.text, marginBottom: Spacing.md }]}>
              Recent Fuel Entries
            </Text>
            {entries.slice(0, 5).map((entry) => {
              const estimate = partialEstimates[entry.id];
              return (
                <View
                  key={entry.id}
                  style={[styles.entryRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.entryLeft}>
                    <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>
                      {formatDisplayDateLong(entry.date)}
                    </Text>
                    <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
                      {entry.fuel_amount} {entry.fuel_unit} · {formatCurrency(entry.total_cost)}
                    </Text>
                  </View>
                  <View style={styles.entryRight}>
                    {entry.calculated_mileage ? (
                      <Text style={[Typography.body, { color: colors.success, fontWeight: '700' }]}>
                        {entry.calculated_mileage.toFixed(1)}
                      </Text>
                    ) : estimate ? (
                      <>
                        <Text style={[Typography.body, { color: colors.warning, fontWeight: '700' }]}>
                          ~{estimate.value.toFixed(1)}
                        </Text>
                        <Text style={[Typography.caption, { color: colors.textTertiary }]}>est.</Text>
                      </>
                    ) : (
                      <Text style={[Typography.bodySmall, { color: colors.textTertiary }]}>
                        {entry.is_full_tank === 1 ? '—' : 'Partial'}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Bottom padding for FAB */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── FAB: Add Fuel (biggest button on screen) ── */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent }]}
        activeOpacity={0.85}
        onPress={() => router.push('/add-fuel')}
      >
        <Text style={styles.fabIcon}>⛽</Text>
        <Text style={[styles.fabText, { color: '#1A1C1E' }]}>Add Fuel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  // ── Vehicle Header ──
  vehicleHeader: {
    marginBottom: Spacing.xl,
  },
  // ── Mileage Card ──
  card: {
    borderRadius: Sizing.radiusLg,
    padding: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  mileageCard: {
    minHeight: 140,
    justifyContent: 'center',
  },
  mileageLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // ── Stats Row ──
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  // ── Service Alert ──
  serviceAlert: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  // ── Section ──
  section: {
    marginBottom: Spacing.xxl,
  },
  // ── Entry Row ──
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  entryLeft: {
    flex: 1,
  },
  entryRight: {
    marginLeft: Spacing.md,
    alignItems: 'flex-end',
  },
  // ── FAB ──
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
  fabIcon: {
    fontSize: 22,
  },
  fabText: {
    fontSize: 16,
    fontWeight: '700',
  },
  // ── Empty State ──
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  addVehicleButton: {
    marginTop: Spacing.xxl,
    height: Sizing.primaryButton,
    borderRadius: Sizing.radiusMd,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  // ── Expiry Banner ──
  expiryBanner: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  // ── Tyre Pressure ──
  tyrePressureCard: {
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  tyrePressureRow: {
    flexDirection: 'row',
    gap: Spacing.xxl,
  },
  tyrePressureItem: {
    alignItems: 'center',
  },
});
