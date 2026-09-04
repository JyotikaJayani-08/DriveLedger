/**
 * Add / Edit Service Record — Modal Form
 *
 * Logs vehicle servicing events: oil change, tyre rotation, etc.
 * Uses predefined service templates for one-tap selection.
 *
 * EDIT MODE: If opened with ?id=<recordId>, loads existing record for editing.
 *
 * FEATURES:
 * - Editable date field (DD/MM/YYYY)
 * - Service template chips for one-tap selection
 * - Wired to centralized serviceStore
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVehicleStore } from '@/stores/vehicleStore';
import { useServiceStore } from '@/stores/serviceStore';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { SERVICE_TEMPLATES } from '@/constants/serviceTemplates';
import { todayISO } from '@/utils/date';
import * as serviceRepo from '@/database/repositories/serviceRepo';

export default function AddServiceScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const addRecord = useServiceStore((s) => s.addRecord);
  const editRecord = useServiceStore((s) => s.editRecord);

  const isEditMode = !!params.id;

  const [serviceType, setServiceType] = useState('');
  const [dateDisplay, setDateDisplay] = useState('');
  const [date, setDate] = useState(todayISO());
  const [cost, setCost] = useState('');
  const [odometer, setOdometer] = useState('');
  const [garageName, setGarageName] = useState('');
  const [workDone, setWorkDone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Initialize date display
  useEffect(() => {
    const parts = date.split('-');
    if (parts.length === 3) {
      setDateDisplay(`${parts[2]}/${parts[1]}/${parts[0]}`);
    }
  }, []);

  // Load existing record for edit mode
  useEffect(() => {
    if (isEditMode && params.id) {
      const existing = serviceRepo.getServiceRecordById(params.id);
      if (existing) {
        setServiceType(existing.service_type);
        setDate(existing.date);
        const parts = existing.date.split('-');
        if (parts.length === 3) {
          setDateDisplay(`${parts[2]}/${parts[1]}/${parts[0]}`);
        }
        setCost(existing.cost != null ? existing.cost.toString() : '');
        setOdometer(existing.odometer != null ? existing.odometer.toString() : '');
        setGarageName(existing.garage_name || '');
        setWorkDone(existing.work_done || '');
        setNotes(existing.notes || '');
      }
    }
  }, [params.id]);

  if (!selectedVehicle) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Text style={[Typography.body, { color: colors.primary }]}>Close</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl }}>
          <Text style={{ fontSize: 48, marginBottom: Spacing.lg }}>🚗</Text>
          <Text style={[Typography.h2, { color: colors.text, textAlign: 'center' }]}>No Vehicle Selected</Text>
          <Text style={[Typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm }]}>
            Add a vehicle first from the Home or Settings tab.
          </Text>
        </View>
      </View>
    );
  }

  const parseDate = (display: string): string | null => {
    const parts = display.trim().split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return null;
  };

  const handleDateChange = (text: string) => {
    setDateDisplay(text);
    const parsed = parseDate(text);
    if (parsed) {
      setDate(parsed);
    }
  };

  const handleSave = () => {
    if (!serviceType.trim()) {
      setError('Select or type a service type.');
      return;
    }
    setError('');

    if (isEditMode && params.id) {
      editRecord(params.id, {
        service_type: serviceType.trim(),
        date,
        cost: cost ? parseFloat(cost) : null,
        odometer: odometer ? parseFloat(odometer) : null,
        garage_name: garageName || null,
        work_done: workDone || null,
        notes: notes || null,
      });
      Alert.alert('✅ Updated', 'Service record updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      addRecord({
        vehicle_id: selectedVehicle.id,
        date,
        service_type: serviceType.trim(),
        cost: cost ? parseFloat(cost) : undefined,
        odometer: odometer ? parseFloat(odometer) : undefined,
        garage_name: garageName || undefined,
        work_done: workDone || undefined,
        notes: notes || undefined,
      });
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'android' ? 'height' : 'padding'}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Text style={[Typography.body, { color: colors.primary }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[Typography.h3, { color: colors.text }]}>
          {isEditMode ? 'Edit Service' : 'Log Service'}
        </Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        {/* ── Date ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Date (DD/MM/YYYY)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={colors.textTertiary}
          value={dateDisplay}
          onChangeText={handleDateChange}
          keyboardType="numeric"
        />

        {/* ── Service Type (one-tap chips) ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Service Type *</Text>
        <View style={styles.chipGrid}>
          {SERVICE_TEMPLATES.map((template) => (
            <Pressable
              key={template.id}
              onPress={() => setServiceType(template.name)}
              style={[
                styles.chip,
                {
                  backgroundColor: serviceType === template.name ? colors.primary : colors.surface,
                  borderColor: serviceType === template.name ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={styles.chipEmoji}>{template.icon}</Text>
              <Text
                style={[
                  styles.chipText,
                  { color: serviceType === template.name ? colors.textOnPrimary : colors.text },
                ]}
              >
                {template.name}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Or type custom ── */}
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, marginTop: Spacing.sm }]}
          placeholder="Or type a custom service..."
          placeholderTextColor={colors.textTertiary}
          value={serviceType}
          onChangeText={setServiceType}
        />

        {/* ── Cost ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Cost (₹)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., 2500"
          placeholderTextColor={colors.textTertiary}
          value={cost}
          onChangeText={setCost}
          keyboardType="numeric"
        />

        {/* ── Odometer ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Odometer (km)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., 15000"
          placeholderTextColor={colors.textTertiary}
          value={odometer}
          onChangeText={setOdometer}
          keyboardType="numeric"
        />

        {/* ── Garage Name ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Garage / Workshop</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., Sharma Auto Care"
          placeholderTextColor={colors.textTertiary}
          value={garageName}
          onChangeText={setGarageName}
        />

        {/* ── Work Done ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Work Done</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Describe what was done..."
          placeholderTextColor={colors.textTertiary}
          value={workDone}
          onChangeText={setWorkDone}
          multiline
          numberOfLines={3}
        />

        {/* ── Notes ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Notes</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Any notes..."
          placeholderTextColor={colors.textTertiary}
          value={notes}
          onChangeText={setNotes}
        />

        {error ? (
          <Text style={[Typography.bodySmall, { color: colors.danger, marginTop: Spacing.md }]}>
            ❌ {error}
          </Text>
        ) : null}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Save ── */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={[Typography.button, { color: colors.textOnPrimary }]}>
            {isEditMode ? 'Update Service ✏️' : 'Save Service Record 🔧'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.section, paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  headerButton: { width: 60 },
  form: { padding: Spacing.xxl },
  label: {
    fontSize: 13, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: Spacing.sm, marginTop: Spacing.lg,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Sizing.radiusFull, borderWidth: 1.5,
    minHeight: Sizing.touchTarget,
  },
  chipEmoji: { fontSize: 16 },
  chipText: { fontSize: 13, fontWeight: '600' },
  input: {
    height: Sizing.primaryButton, borderRadius: Sizing.radiusMd,
    borderWidth: 1.5, paddingHorizontal: Spacing.lg, fontSize: 16,
  },
  inputMultiline: { height: 80, paddingTop: Spacing.md, textAlignVertical: 'top' },
  bottomBar: { padding: Spacing.lg },
  saveButton: {
    height: Sizing.primaryButton, borderRadius: Sizing.radiusMd,
    justifyContent: 'center', alignItems: 'center',
  },
});
