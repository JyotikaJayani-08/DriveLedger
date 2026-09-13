/**
 * Settings Screen
 *
 * Sections:
 * 1. Your Vehicles — view, edit, archive active vehicles
 * 2. Archived Vehicles — restore or permanently remove
 * 3. Data — backup (export JSON) & restore (import JSON)
 * 4. About — version info, update check, data safety guide
 */

import { FUEL_TYPE_SHORT_LABELS } from '@/constants/fuelTypes';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import { backupToJSON, createBackup, restoreFromJSON } from '@/engine/backupEngine';
import { useThemeColors } from '@/hooks/useThemeColors';
import { checkForAppUpdate, showDataSafetyGuide } from '@/services/updateChecker';
import { useVehicleStore } from '@/stores/vehicleStore';
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
      <Text style={{ color: colors.textTertiary, fontSize: rightText ? 13 : 18, fontWeight: rightText ? '600' : '400' }}>
        {rightText ?? '›'}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const colors = useThemeColors();
  const router = useRouter();

  const vehicles = useVehicleStore((s) => s.vehicles);
  const loadVehicles = useVehicleStore((s) => s.loadVehicles);
  const archiveVehicle = useVehicleStore((s) => s.archiveVehicle);
  const restoreVehicle = useVehicleStore((s) => s.restoreVehicle);

  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreJSON, setRestoreJSON] = useState('');
  const [archivedVehicles, setArchivedVehicles] = useState<Vehicle[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // Load vehicles + archived list on every focus
  useFocusEffect(
    useCallback(() => {
      loadVehicles();
      // Load ALL vehicles and filter archived ones separately
      const all = vehicleRepo.getAllVehicles();
      setArchivedVehicles(all.filter((v) => v.is_archived === 1));
    }, [])
  );

  // ── Backup ──
  const handleBackup = () => {
    const result = createBackup();
    if (result.success && result.backup) {
      const json = backupToJSON(result.backup);
      Share.share({
        message: json,
        title: 'DriveLedger Backup',
      }).catch(() => { /* user cancelled */ });
    } else {
      Alert.alert('😨 Backup Failed', `Something went sideways: ${result.message}\n\nMaybe try again in a sec?`);
    }
  };

  // ── Restore ──
  const handleRestore = () => {
    const trimmed = restoreJSON.trim();

    if (!trimmed) {
      Alert.alert('🤔 Nothing to Restore', 'Paste your backup JSON first — it\'s the big text blob you exported earlier!');
      return;
    }

    // Pre-validate JSON format before asking for confirmation
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object' || !parsed.data) {
        Alert.alert(
          '😕 That Doesn\'t Look Right',
          'This doesn\'t look like a DriveLedger backup.\n\nMake sure you paste the complete JSON that was shared from the app — the whole thing, curly braces and all!'
        );
        return;
      }
    } catch {
      Alert.alert(
        '🤨 Not Valid JSON',
        'The text you pasted isn\'t valid JSON — copy the entire backup text, including the opening { and closing } brackets. Every character counts!'
      );
      return;
    }

    Alert.alert(
      '⚠️ Replace Everything?',
      'This will WIPE your current data and restore from the backup.\n\nMake absolutely sure this is the right backup file before proceeding — there\'s no undo!',
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
                `Everything\'s back!\n\n🚗 ${result.counts.vehicles} vehicle(s)\n⛽ ${result.counts.fuel_entries} fuel entries\n🔧 ${result.counts.service_records} service records\n💸 ${result.counts.expenses} expenses\n📄 ${result.counts.documents} documents\n\nWelcome back! 😄`
              );
            } else {
              // result.message tells user exactly what failed and whether data is safe
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
      `"${vehicle.nickname}" will take a break from your active list.\n\nAll its history — fuel, service, expenses — stays safe. You can bring it back anytime!`,
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
  const handleRestore_Vehicle = (vehicle: Vehicle) => {
    Alert.alert(
      'Welcome Back! 🎉',
      `"${vehicle.nickname}" is ready to roll again! It\'ll pop back into your active list along with all its history.`,
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

          {/* ── Active Vehicles ── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Your Vehicles ({vehicles.length})
          </Text>

          {vehicles.map((v) => (
            <View
              key={v.id}
              style={[styles.vehicleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              {/* Vehicle info */}
              <View style={styles.vehicleInfo}>
                <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
                  {v.nickname}
                </Text>
                <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
                  {v.registration_number} · {FUEL_TYPE_SHORT_LABELS[v.fuel_type as keyof typeof FUEL_TYPE_SHORT_LABELS] || v.fuel_type}
                </Text>
                {(v.front_tyre_pressure || v.rear_tyre_pressure) && (
                  <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                    🚨 Tyre: {v.front_tyre_pressure ? `F ${v.front_tyre_pressure} PSI` : ''}
                    {v.front_tyre_pressure && v.rear_tyre_pressure ? '  ·  ' : ''}
                    {v.rear_tyre_pressure ? `R ${v.rear_tyre_pressure} PSI` : ''}
                  </Text>
                )}
              </View>

              {/* Action buttons */}
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
                    <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
                      {v.nickname}
                    </Text>
                    <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
                      {v.registration_number} · Archived
                    </Text>
                    <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                      All history is preserved.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.vehicleAction, { borderColor: colors.success }]}
                    onPress={() => handleRestore_Vehicle(v)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.vehicleActionText, { color: colors.success }]}>Restore</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {/* ── Data ── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Data & Backup</Text>
          <SettingsRow
            emoji="💾"
            title="Create Backup"
            subtitle="Export all data as JSON — share to Drive, WhatsApp, or Files"
            colors={colors}
            onPress={handleBackup}
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
  archivedToggle: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
  },
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
