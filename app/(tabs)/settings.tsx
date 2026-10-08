/**
 * Settings Screen
 *
 * Sections:
 * 1. Preferences — currency, distance unit, fuel unit, pressure unit, default vehicle
 * 2. Your Vehicles — view, edit, archive active vehicles
 * 3. Archived Vehicles — restore or permanently remove
 * 4. Data — backup (export JSON) & restore (import JSON)
 * 5. About — version info, update check, data safety guide
 */

import { FUEL_TYPE_SHORT_LABELS } from '@/constants/fuelTypes';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import { backupToJSON, createBackup, restoreFromJSON } from '@/engine/backupEngine';
import { buildLedgerCsv } from '@/utils/csvExport';
import { useThemeColors } from '@/hooks/useThemeColors';
import { checkForAppUpdate, showDataSafetyGuide } from '@/services/updateChecker';
import { useVehicleStore } from '@/stores/vehicleStore';
import {
  usePreferencesStore,
  CURRENCY_OPTIONS, DISTANCE_OPTIONS, FUEL_VOLUME_OPTIONS, PRESSURE_OPTIONS,
  type CurrencyCode, type DistanceUnit, type FuelVolumeUnit, type PressureUnit,
} from '@/stores/preferencesStore';
import type { Vehicle } from '@/types/vehicle';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── OptionPicker Modal ────────────────────────────────────────────────────
// Reusable bottom-sheet that shows a list of options for a preference.

interface OptionPickerProps<T extends string> {
  visible: boolean;
  title: string;
  options: { value: T; label: string; symbol?: string }[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
  colors: ReturnType<typeof useThemeColors>;
}

function OptionPicker<T extends string>({
  visible, title, options, selected, onSelect, onClose, colors,
}: OptionPickerProps<T>) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[pickerStyles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[pickerStyles.sheet, { backgroundColor: colors.background }]}>
          <Text style={[Typography.h3, { color: colors.text, marginBottom: Spacing.lg }]}>
            {title}
          </Text>
          {options.map((opt) => {
            const isSelected = opt.value === selected;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  pickerStyles.option,
                  {
                    backgroundColor: isSelected ? colors.primaryLight ?? colors.surface : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => { onSelect(opt.value); onClose(); }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.body, { color: isSelected ? colors.primary : colors.text, fontWeight: isSelected ? '700' : '400' }]}>
                    {opt.label}
                  </Text>
                  {opt.symbol && (
                    <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
                      Symbol: {opt.symbol}
                    </Text>
                  )}
                </View>
                {isSelected && (
                  <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '700' }}>✓</Text>
                )}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[pickerStyles.cancelBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[Typography.button, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Sizing.radiusXl, borderTopRightRadius: Sizing.radiusXl,
    padding: Spacing.xxl, paddingBottom: Spacing.section, maxHeight: '75%',
  },
  option: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Sizing.radiusMd, borderWidth: 1.5,
    padding: Spacing.lg, marginBottom: Spacing.sm,
    minHeight: Sizing.touchTarget,
  },
  cancelBtn: {
    borderRadius: Sizing.radiusMd, borderWidth: 1,
    height: Sizing.primaryButton, alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.sm,
  },
});

// ─── SettingsRow ──────────────────────────────────────────────────────────

interface SettingsRowProps {
  emoji: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  colors: ReturnType<typeof useThemeColors>;
  danger?: boolean;
  rightText?: string;
}

function SettingsRow({ emoji, title, subtitle, onPress, colors, danger, rightText }: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <View style={styles.rowText}>
        <Text style={[Typography.body, { color: danger ? colors.danger : colors.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>{subtitle}</Text>
        )}
      </View>
      <Text style={{ color: rightText ? colors.primary : colors.textTertiary, fontSize: rightText ? 13 : 18, fontWeight: rightText ? '700' : '400' }}>
        {rightText ?? '›'}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const colors = useThemeColors();
  const router = useRouter();

  // Vehicle store
  const vehicles      = useVehicleStore((s) => s.vehicles);
  const loadVehicles  = useVehicleStore((s) => s.loadVehicles);
  const archiveVehicle  = useVehicleStore((s) => s.archiveVehicle);
  const restoreVehicle  = useVehicleStore((s) => s.restoreVehicle);

  // Preferences store
  const currency          = usePreferencesStore((s) => s.currency);
  const distanceUnit      = usePreferencesStore((s) => s.distanceUnit);
  const fuelVolumeUnit    = usePreferencesStore((s) => s.fuelVolumeUnit);
  const pressureUnit      = usePreferencesStore((s) => s.pressureUnit);
  const defaultVehicleId  = usePreferencesStore((s) => s.defaultVehicleId);
  const setCurrency         = usePreferencesStore((s) => s.setCurrency);
  const setDistanceUnit     = usePreferencesStore((s) => s.setDistanceUnit);
  const setFuelVolumeUnit   = usePreferencesStore((s) => s.setFuelVolumeUnit);
  const setPressureUnit     = usePreferencesStore((s) => s.setPressureUnit);
  const setDefaultVehicleId = usePreferencesStore((s) => s.setDefaultVehicleId);

  // Local UI state
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreJSON, setRestoreJSON]           = useState('');
  const [archivedVehicles, setArchivedVehicles] = useState<Vehicle[]>([]);
  const [showArchived, setShowArchived]         = useState(false);

  // Option picker visibility
  const [pickerCurrency,   setPickerCurrency]   = useState(false);
  const [pickerDistance,   setPickerDistance]   = useState(false);
  const [pickerFuel,       setPickerFuel]       = useState(false);
  const [pickerPressure,   setPickerPressure]   = useState(false);
  const [pickerVehicle,    setPickerVehicle]    = useState(false);

  // Load vehicles + archived list on every focus
  useFocusEffect(
    useCallback(() => {
      loadVehicles();
      const all = vehicleRepo.getAllVehicles();
      setArchivedVehicles(all.filter((v) => v.is_archived === 1));
    }, [])
  );

  // ── Derived display labels ──
  const currencyLabel    = CURRENCY_OPTIONS.find((o) => o.value === currency)?.symbol ?? currency;
  const distanceLabel    = DISTANCE_OPTIONS.find((o) => o.value === distanceUnit)?.label ?? distanceUnit;
  const fuelVolumeLabel  = FUEL_VOLUME_OPTIONS.find((o) => o.value === fuelVolumeUnit)?.label ?? fuelVolumeUnit;
  const pressureLabel    = PRESSURE_OPTIONS.find((o) => o.value === pressureUnit)?.label ?? pressureUnit;
  const defaultVehicleLabel = vehicles.find((v) => v.id === defaultVehicleId)?.nickname ?? 'First Added';

  // ── Vehicle picker options ──
  const vehiclePickerOptions = [
    { value: '__first__', label: 'First Added (auto)' },
    ...vehicles.map((v) => ({ value: v.id, label: `${v.nickname} · ${v.registration_number}` })),
  ];

  // ── Backup ──
  const handleBackup = () => {
    const result = createBackup();
    if (result.success && result.backup) {
      const json = backupToJSON(result.backup);
      Share.share({ message: json, title: 'DriveLedger Backup' })
        .catch(() => { /* user cancelled */ });
    } else {
      Alert.alert('😨 Backup Failed', `Something went sideways: ${result.message}\n\nMaybe try again in a sec?`);
    }
  };

  // ── CSV export (spreadsheet-friendly ledger) ──
  const handleExportCsv = () => {
    const result = createBackup();
    if (result.success && result.backup) {
      Share.share({ message: buildLedgerCsv(result.backup.data), title: 'DriveLedger Ledger (CSV)' })
        .catch(() => { /* user cancelled */ });
    } else {
      Alert.alert('😨 Export Failed', `Something went sideways: ${result.message}`);
    }
  };

  // ── Restore ──
  const handleRestore = () => {
    const trimmed = restoreJSON.trim();
    if (!trimmed) {
      Alert.alert('🤔 Nothing to Restore', 'Paste your backup JSON first!');
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object' || !parsed.data) {
        Alert.alert('😕 That Doesn\'t Look Right', 'This doesn\'t look like a DriveLedger backup.\n\nMake sure you paste the complete JSON that was shared from the app.');
        return;
      }
    } catch {
      Alert.alert('🤨 Not Valid JSON', 'The text you pasted isn\'t valid JSON. Copy the entire backup text including the opening { and closing }.');
      return;
    }
    Alert.alert(
      '⚠️ Replace Everything?',
      'This will WIPE your current data and restore from the backup.\n\nThere\'s no undo!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Restore!',
          style: 'destructive',
          onPress: () => {
            const result = restoreFromJSON(trimmed);
            if (result.success && result.counts) {
              setShowRestoreModal(false);
              setRestoreJSON('');
              loadVehicles();
              Alert.alert(
                '🎉 Data Restored!',
                `Everything's back!\n\n🚗 ${result.counts.vehicles} vehicle(s)\n⛽ ${result.counts.fuel_entries} fuel entries\n🔧 ${result.counts.service_records} service records\n💸 ${result.counts.expenses} expenses\n📄 ${result.counts.documents} documents\n\nWelcome back! 😄`
              );
            } else {
              Alert.alert('😨 Restore Failed', result.message);
            }
          },
        },
      ]
    );
  };

  // ── Archive vehicle ──
  const handleArchive = (vehicle: Vehicle) => {
    Alert.alert(
      'Archive This Ride? 🏎️',
      `"${vehicle.nickname}" will take a break from your active list.\n\nAll its history stays safe. You can bring it back anytime!`,
      [
        { text: 'Keep It Active', style: 'cancel' },
        {
          text: 'Archive It',
          style: 'destructive',
          onPress: () => {
            archiveVehicle(vehicle.id);
            const all = vehicleRepo.getAllVehicles();
            setArchivedVehicles(all.filter((v) => v.is_archived === 1));
          },
        },
      ]
    );
  };

  // ── Restore archived vehicle ──
  const handleRestoreVehicle = (vehicle: Vehicle) => {
    Alert.alert(
      'Welcome Back! 🎉',
      `"${vehicle.nickname}" is ready to roll again!`,
      [
        { text: 'Nah, Keep Archived', style: 'cancel' },
        {
          text: 'Restore It!',
          onPress: () => {
            restoreVehicle(vehicle.id);
            loadVehicles();
            const all = vehicleRepo.getAllVehicles();
            setArchivedVehicles(all.filter((v) => v.is_archived === 1));
          },
        },
      ]
    );
  };

  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>

          {/* ── Preferences ── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Preferences</Text>

          <SettingsRow
            emoji="💰"
            title="Currency"
            subtitle="How costs and prices are displayed"
            rightText={currencyLabel}
            colors={colors}
            onPress={() => setPickerCurrency(true)}
          />
          <SettingsRow
            emoji="📏"
            title="Distance Unit"
            subtitle="Odometer and trip distance display"
            rightText={distanceUnit === 'km' ? 'km' : 'mi'}
            colors={colors}
            onPress={() => setPickerDistance(true)}
          />
          <SettingsRow
            emoji="⛽"
            title="Fuel Volume Unit"
            subtitle="How fuel quantity is displayed"
            rightText={fuelVolumeUnit === 'litres' ? 'L' : 'gal'}
            colors={colors}
            onPress={() => setPickerFuel(true)}
          />
          <SettingsRow
            emoji="🔴"
            title="Tyre Pressure Unit"
            subtitle="Recommended tyre pressure display"
            rightText={pressureUnit}
            colors={colors}
            onPress={() => setPickerPressure(true)}
          />
          <SettingsRow
            emoji="🚗"
            title="Default Vehicle"
            subtitle="Which vehicle opens on launch"
            rightText={defaultVehicleLabel}
            colors={colors}
            onPress={() => setPickerVehicle(true)}
          />

          {/* ── Active Vehicles ── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Your Vehicles ({vehicles.length})
          </Text>

          {vehicles.map((v) => (
            <View
              key={v.id}
              style={[styles.vehicleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.vehicleInfo}>
                <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
                  {v.nickname}
                </Text>
                <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
                  {v.registration_number} · {FUEL_TYPE_SHORT_LABELS[v.fuel_type as keyof typeof FUEL_TYPE_SHORT_LABELS] || v.fuel_type}
                </Text>
                {(v.front_tyre_pressure || v.rear_tyre_pressure) && (
                  <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                    🚨 Tyre: {v.front_tyre_pressure ? `F ${v.front_tyre_pressure} ${pressureUnit}` : ''}
                    {v.front_tyre_pressure && v.rear_tyre_pressure ? '  ·  ' : ''}
                    {v.rear_tyre_pressure ? `R ${v.rear_tyre_pressure} ${pressureUnit}` : ''}
                  </Text>
                )}
              </View>

              <View style={styles.vehicleActions}>
                <TouchableOpacity
                  style={[styles.vehicleAction, { borderColor: colors.primary }]}
                  onPress={() => router.push({ pathname: '/edit-vehicle', params: { id: v.id } })}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.vehicleActionText, { color: colors.primary }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.vehicleAction, { borderColor: colors.border }]}
                  onPress={() => handleArchive(v)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.vehicleActionText, { color: colors.textSecondary }]}>Archive</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.addVehicleButton, { borderColor: colors.primary }]}
            onPress={() => router.push('/add-vehicle')}
            activeOpacity={0.7}
          >
            <Text style={[Typography.body, { color: colors.primary, fontWeight: '600' }]}>
              + Add Another Vehicle
            </Text>
          </TouchableOpacity>

          {/* ── Archived Vehicles ── */}
          {archivedVehicles.length > 0 && (
            <>
              <TouchableOpacity
                style={styles.archivedToggle}
                onPress={() => setShowArchived(!showArchived)}
                activeOpacity={0.7}
              >
                <Text style={[Typography.bodySmall, { color: colors.textSecondary, fontWeight: '600' }]}>
                  {showArchived ? '▲' : '▼'}  Archived Vehicles ({archivedVehicles.length})
                </Text>
              </TouchableOpacity>

              {showArchived && archivedVehicles.map((v) => (
                <View
                  key={v.id}
                  style={[styles.vehicleCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.65 }]}
                >
                  <View style={styles.vehicleInfo}>
                    <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>{v.nickname}</Text>
                    <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
                      {v.registration_number} · Archived
                    </Text>
                    <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                      All history is preserved.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.vehicleAction, { borderColor: colors.success }]}
                    onPress={() => handleRestoreVehicle(v)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.vehicleActionText, { color: colors.success }]}>Restore</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {/* ── Data & Backup ── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Data & Backup</Text>
          <SettingsRow
            emoji="💾"
            title="Create Backup"
            subtitle="Export all data as JSON — share to Drive, WhatsApp, or Files"
            colors={colors}
            onPress={handleBackup}
          />
          <SettingsRow
            emoji="📊"
            title="Export as CSV"
            subtitle="Fuel, service & expenses in one sheet — opens in Excel / Google Sheets"
            colors={colors}
            onPress={handleExportCsv}
          />
          <SettingsRow
            emoji="📥"
            title="Restore from Backup"
            subtitle="Import a backup JSON — replaces all current data"
            colors={colors}
            onPress={() => setShowRestoreModal(true)}
          />

          {/* ── About ── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>About</Text>
          <SettingsRow
            emoji="ℹ️"
            title="DriveLedger  v1.0.3"
            subtitle="Offline · Private · No account needed"
            colors={colors}
            onPress={() =>
              Alert.alert(
                'DriveLedger v1.0.3 🚗',
                'Fuel, mileage, services, documents — all tracked, all offline, zero drama.\n\nNo account. No cloud. Your data stays on your phone, where it belongs. 🔐',
                [{ text: 'Love it! ❤️' }]
              )
            }
          />
          <SettingsRow
            emoji="🔄"
            title="Check for Updates"
            subtitle="Check GitHub Releases for a new APK version"
            colors={colors}
            onPress={() => checkForAppUpdate({ manual: true })}
          />
          <SettingsRow
            emoji="🛡️"
            title="Update & Data Safety Guide"
            subtitle="How to update without losing your records"
            colors={colors}
            onPress={showDataSafetyGuide}
          />

          <View style={{ height: Spacing.section }} />
        </View>
      </ScrollView>

      {/* ── Restore Modal ── */}
      <Modal visible={showRestoreModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[Typography.h2, { color: colors.text, marginBottom: Spacing.sm }]}>
              Restore from Backup
            </Text>
            <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginBottom: Spacing.lg }]}>
              Paste the complete backup JSON below.{'\n'}
              <Text style={{ color: colors.danger, fontWeight: '600' }}>⚠️ This replaces ALL existing data.</Text>
            </Text>
            <TextInput
              style={[styles.restoreInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder={'Paste backup JSON here...\n\n(The full text starting with { and ending with })'}
              placeholderTextColor={colors.textTertiary}
              value={restoreJSON}
              onChangeText={setRestoreJSON}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => { setShowRestoreModal(false); setRestoreJSON(''); }}
              >
                <Text style={[Typography.button, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.danger }]}
                onPress={handleRestore}
              >
                <Text style={[Typography.button, { color: '#FFFFFF' }]}>Restore Data</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Preference Pickers ── */}
      <OptionPicker<CurrencyCode>
        visible={pickerCurrency}
        title="Currency"
        options={CURRENCY_OPTIONS}
        selected={currency}
        onSelect={setCurrency}
        onClose={() => setPickerCurrency(false)}
        colors={colors}
      />
      <OptionPicker<DistanceUnit>
        visible={pickerDistance}
        title="Distance Unit"
        options={DISTANCE_OPTIONS}
        selected={distanceUnit}
        onSelect={setDistanceUnit}
        onClose={() => setPickerDistance(false)}
        colors={colors}
      />
      <OptionPicker<FuelVolumeUnit>
        visible={pickerFuel}
        title="Fuel Volume Unit"
        options={FUEL_VOLUME_OPTIONS}
        selected={fuelVolumeUnit}
        onSelect={setFuelVolumeUnit}
        onClose={() => setPickerFuel(false)}
        colors={colors}
      />
      <OptionPicker<PressureUnit>
        visible={pickerPressure}
        title="Tyre Pressure Unit"
        options={PRESSURE_OPTIONS}
        selected={pressureUnit}
        onSelect={setPressureUnit}
        onClose={() => setPickerPressure(false)}
        colors={colors}
      />

      {/* Vehicle picker — custom because it uses vehicle IDs not string literals */}
      <Modal visible={pickerVehicle} animationType="slide" transparent onRequestClose={() => setPickerVehicle(false)}>
        <View style={[pickerStyles.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[pickerStyles.sheet, { backgroundColor: colors.background }]}>
            <Text style={[Typography.h3, { color: colors.text, marginBottom: Spacing.lg }]}>
              Default Vehicle
            </Text>
            {vehiclePickerOptions.map((opt) => {
              const isSelected = opt.value === '__first__'
                ? defaultVehicleId === null
                : defaultVehicleId === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    pickerStyles.option,
                    {
                      backgroundColor: isSelected ? colors.primaryLight ?? colors.surface : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    setDefaultVehicleId(opt.value === '__first__' ? null : opt.value);
                    setPickerVehicle(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[Typography.body, { color: isSelected ? colors.primary : colors.text, fontWeight: isSelected ? '700' : '400', flex: 1 }]}>
                    {opt.label}
                  </Text>
                  {isSelected && (
                    <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '700' }}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[pickerStyles.cancelBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setPickerVehicle(false)}
              activeOpacity={0.7}
            >
              <Text style={[Typography.button, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.section },
  sectionTitle: {
    fontSize: 12, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 1, marginTop: Spacing.xxl, marginBottom: Spacing.sm, marginLeft: Spacing.xs,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.lg,
    borderRadius: Sizing.radiusMd, borderWidth: 1, marginBottom: Spacing.sm,
    minHeight: Sizing.primaryButton,
  },
  rowEmoji: { fontSize: 22, marginRight: Spacing.md, width: 32, textAlign: 'center' },
  rowText: { flex: 1 },
  vehicleCard: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.lg,
    borderRadius: Sizing.radiusMd, borderWidth: 1, marginBottom: Spacing.sm,
  },
  vehicleInfo: { flex: 1 },
  vehicleActions: { flexDirection: 'row', gap: Spacing.sm, marginLeft: Spacing.sm },
  vehicleAction: {
    borderWidth: 1.5, borderRadius: Sizing.radiusMd,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    justifyContent: 'center', alignItems: 'center',
  },
  vehicleActionText: { fontSize: 13, fontWeight: '600' },
  addVehicleButton: {
    padding: Spacing.lg, borderRadius: Sizing.radiusMd,
    borderWidth: 2, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    minHeight: Sizing.primaryButton, marginBottom: Spacing.sm,
  },
  archivedToggle: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm },
  // ── Modal ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: Sizing.radiusXl, borderTopRightRadius: Sizing.radiusXl,
    padding: Spacing.xxl, paddingBottom: Spacing.section,
    maxHeight: '85%',
  },
  restoreInput: {
    borderRadius: Sizing.radiusMd, borderWidth: 1.5,
    padding: Spacing.lg, fontSize: 13, fontFamily: 'monospace',
    minHeight: 160,
  },
  modalButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  modalButton: {
    flex: 1, height: Sizing.primaryButton,
    borderRadius: Sizing.radiusMd, justifyContent: 'center', alignItems: 'center',
  },
});

