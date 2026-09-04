/**
 * Settings Screen
 *
 * Full settings with:
 * - Vehicle management (view, archive, add)
 * - Backup (export via Share) & Restore (paste JSON)
 * - Quick-add shortcuts for service/expense
 * - App info
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
  TextInput,
  Modal,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { useVehicleStore } from '@/stores/vehicleStore';
import { createBackup, backupToJSON, restoreFromJSON } from '@/engine/backupEngine';
import { FUEL_TYPE_LABELS } from '@/constants/fuelTypes';
import type { Vehicle } from '@/types/vehicle';

interface SettingsRowProps {
  emoji: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  colors: ReturnType<typeof useThemeColors>;
  danger?: boolean;
}

function SettingsRow({ emoji, title, subtitle, onPress, colors, danger }: SettingsRowProps) {
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
      <Text style={{ color: colors.textTertiary, fontSize: 18 }}>›</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const vehicles = useVehicleStore((s) => s.vehicles);
  const loadVehicles = useVehicleStore((s) => s.loadVehicles);
  const archiveVehicle = useVehicleStore((s) => s.archiveVehicle);

  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreJSON, setRestoreJSON] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadVehicles();
    }, [])
  );

  const handleBackup = () => {
    const result = createBackup();
    if (result.success && result.backup) {
      const json = backupToJSON(result.backup);
      Share.share({
        message: json,
        title: 'DriveLedger Backup',
      }).then(() => {
        Alert.alert('✅ Backup Ready', result.message);
      }).catch(() => {
        // User cancelled share
      });
    } else {
      Alert.alert('❌ Backup Failed', result.message);
    }
  };

  const handleRestore = () => {
    if (!restoreJSON.trim()) {
      Alert.alert('Empty', 'Paste the backup JSON first.');
      return;
    }

    Alert.alert(
      '⚠️ Restore Data',
      'This will REPLACE all current data with the backup. This cannot be undone.\n\nAre you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            const result = restoreFromJSON(restoreJSON.trim());
            if (result.success && result.counts) {
              setShowRestoreModal(false);
              setRestoreJSON('');
              loadVehicles();
              Alert.alert(
                '✅ Restored!',
                `Imported:\n• ${result.counts.vehicles} vehicles\n• ${result.counts.fuel_entries} fuel entries\n• ${result.counts.service_records} service records\n• ${result.counts.expenses} expenses\n• ${result.counts.documents} documents`
              );
            } else {
              Alert.alert('❌ Restore Failed', result.message);
            }
          },
        },
      ]
    );
  };

  const handleArchive = (vehicle: Vehicle) => {
    Alert.alert(
      'Archive Vehicle',
      `Are you sure you want to archive "${vehicle.nickname}"?\nYou can restore it later from the database.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => {
            archiveVehicle(vehicle.id);
            loadVehicles();
          },
        },
      ]
    );
  };

  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          {/* ── Vehicles ── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Your Vehicles ({vehicles.length})
          </Text>
          {vehicles.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={[styles.vehicleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => handleArchive(v)}
              activeOpacity={0.7}
            >
              <View style={styles.vehicleInfo}>
                <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>
                  {v.nickname}
                </Text>
                <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
                  {v.registration_number} · {FUEL_TYPE_LABELS[v.fuel_type as keyof typeof FUEL_TYPE_LABELS] || v.fuel_type}
                </Text>
              </View>
              <Text style={[Typography.caption, { color: colors.textTertiary }]}>
                Tap to archive
              </Text>
            </TouchableOpacity>
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

          {/* ── Data ── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Data</Text>
          <SettingsRow
            emoji="💾"
            title="Create Backup"
            subtitle="Export all data as JSON (share or save)"
            colors={colors}
            onPress={handleBackup}
          />
          <SettingsRow
            emoji="📥"
            title="Restore from Backup"
            subtitle="Import a previously exported JSON backup"
            colors={colors}
            onPress={() => setShowRestoreModal(true)}
          />

          {/* ── Quick Actions ── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Quick Add</Text>
          <SettingsRow
            emoji="🔧"
            title="Log a Service"
            subtitle="Oil change, tyre rotation, etc."
            colors={colors}
            onPress={() => router.push('/add-service')}
          />
          <SettingsRow
            emoji="💰"
            title="Log an Expense"
            subtitle="Insurance, repair, toll, etc."
            colors={colors}
            onPress={() => router.push('/add-expense')}
          />

          {/* ── About ── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>About</Text>
          <SettingsRow
            emoji="ℹ️"
            title="DriveLedger"
            subtitle="v1.0.0 · Built with ❤️ for Indian drivers"
            colors={colors}
            onPress={() =>
              Alert.alert(
                'DriveLedger v1.0.0',
                'Track fuel, mileage, services, and documents — all offline, all private.\n\nNo account needed. No data leaves your phone.',
                [{ text: 'Nice!' }]
              )
            }
          />

          <View style={{ height: Spacing.section }} />
        </View>
      </ScrollView>

      {/* ── Restore Modal ── */}
      <Modal visible={showRestoreModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[Typography.h2, { color: colors.text, marginBottom: Spacing.md }]}>
              Restore from Backup
            </Text>
            <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginBottom: Spacing.lg }]}>
              Paste the complete backup JSON below. This will REPLACE all existing data.
            </Text>
            <TextInput
              style={[styles.restoreInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Paste backup JSON here..."
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
    minHeight: Sizing.primaryButton,
  },
  vehicleInfo: { flex: 1 },
  addVehicleButton: {
    padding: Spacing.lg, borderRadius: Sizing.radiusMd,
    borderWidth: 2, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    minHeight: Sizing.primaryButton, marginBottom: Spacing.sm,
  },
  // ── Modal ──
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: Sizing.radiusXl, borderTopRightRadius: Sizing.radiusXl,
    padding: Spacing.xxl, paddingBottom: Spacing.section,
    maxHeight: '80%',
  },
  restoreInput: {
    borderRadius: Sizing.radiusMd, borderWidth: 1.5,
    padding: Spacing.lg, fontSize: 13, fontFamily: 'monospace',
    minHeight: 160,
  },
  modalButtons: {
    flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl,
  },
  modalButton: {
    flex: 1, height: Sizing.primaryButton,
    borderRadius: Sizing.radiusMd, justifyContent: 'center', alignItems: 'center',
  },
});
