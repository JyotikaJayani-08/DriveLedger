/**
 * Add / Edit Fuel Entry — Modal Form
 *
 * THE CORE USER FLOW. This is the 3-tap dream from the charter:
 *   Tap [+ Add Fuel] → Fill 3 fields → Save → See mileage
 *
 * EDIT MODE: If opened with ?id=<entryId>, loads existing entry for editing.
 *
 * REQUIRED FIELDS (minimum viable entry):
 *   1. Odometer reading
 *   2. Fuel amount (litres/kg/kWh)
 *   3. Price per unit
 *
 * AUTO-FILLED:
 *   - Date → today (editable)
 *   - Fuel unit → from vehicle's fuel_type
 *   - Full tank → yes (toggle)
 *   - Odometer → smart default from last entry
 *
 * VALIDATION:
 *   - Uses validationEngine for error/warning checks
 *   - Warnings show a confirmation dialog, don't block save
 *   - Errors block save entirely
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useVehicleStore } from '@/stores/vehicleStore';
import { useFuelStore } from '@/stores/fuelStore';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import {
  FuelType,
  FuelUnit,
  FUEL_TYPE_TO_DEFAULT_UNIT,
  MILEAGE_UNIT_LABELS,
} from '@/constants/fuelTypes';
import { todayISO } from '@/utils/date';
import { displayToISO, isoToDisplay, formatDateInput, validateDateDisplay } from '@/utils/dateInput';
import { formatMileage } from '@/utils/format';
import { validateFuelEntry, hasWarningsOnly } from '@/engine/validationEngine';
import { recalculateAllMileage } from '@/engine/mileageEngine';
import { FormHeader } from '@/components/FormHeader';
import { NoVehicleState } from '@/components/NoVehicleState';
import { VehicleContextHeader } from '@/components/VehicleContextHeader';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';

export default function AddFuelScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();

  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const loadVehicles = useVehicleStore((s) => s.loadVehicles);
  const addFuelEntry = useFuelStore((s) => s.addFuelEntry);
  const loadEntries = useFuelStore((s) => s.loadEntries);

  const isEditMode = !!params.id;

  // Form state
  const [date, setDate] = useState(todayISO());
  const [dateDisplay, setDateDisplay] = useState('');
  const [odometer, setOdometer] = useState('');
  const [fuelAmount, setFuelAmount] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [fuelStation, setFuelStation] = useState('');
  const [isFullTank, setIsFullTank] = useState(true);
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  // Initialize date display
  useEffect(() => {
    setDateDisplay(isoToDisplay(date));
  }, []);

  // Load existing entry for edit mode
  useEffect(() => {
    if (isEditMode && params.id) {
      const existing = fuelRepo.getFuelEntryById(params.id);
      if (existing) {
        setDate(existing.date);
        setDateDisplay(isoToDisplay(existing.date));
        setOdometer(existing.odometer.toString());
        setFuelAmount(existing.fuel_amount.toString());
        setPricePerUnit(existing.price_per_unit.toString());
        setFuelStation(existing.fuel_station || '');
        setIsFullTank(existing.is_full_tank === 1);
        setNotes(existing.notes || '');
        setPhotoUri(existing.receipt_photo_uri || null);
      }
    }
  }, [params.id]);

  if (!selectedVehicle) {
    return <NoVehicleState />;
  }

  const fuelUnit = FUEL_TYPE_TO_DEFAULT_UNIT[selectedVehicle.fuel_type as FuelType];
  const fuelUnitLabel = fuelUnit === FuelUnit.LITRES ? 'L' : fuelUnit === FuelUnit.KG ? 'kg' : 'kWh';
  const isEV = selectedVehicle.fuel_type === FuelType.ELECTRIC;

  const handleDateChange = (text: string) => {
    const formatted = formatDateInput(text, dateDisplay);
    setDateDisplay(formatted);
    const parsed = displayToISO(formatted);
    if (parsed) {
      setDate(parsed);
    }
  };

  // ── Photo Picker ──
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('📸 Hold up!', 'We need access to your photo library to grab that receipt pic. Allow it in settings — promise we\'re only here for the receipt! 🧾');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('📷 Cheese! (Almost)', 'Camera access is needed to snap that receipt. Allow it in settings and we\'ll be ready to shoot! 📸');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handlePickPhoto = () => {
    Alert.alert('Attach Receipt 🧾', 'How do you want to add it?', [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Gallery', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSave = () => {
    const odoVal = parseFloat(odometer);
    const amountVal = parseFloat(fuelAmount);
    const priceVal = parseFloat(pricePerUnit);

    // Basic field presence checks
    if (!odometer || isNaN(odoVal)) {
      setErrors(['Enter a valid odometer reading.']);
      return;
    }
    if (!fuelAmount || isNaN(amountVal)) {
      setErrors([`Enter the fuel quantity in ${fuelUnitLabel}.`]);
      return;
    }
    if (!pricePerUnit || isNaN(priceVal)) {
      setErrors([`Enter the price per ${fuelUnitLabel}.`]);
      return;
    }

    const dateVal = validateDateDisplay(dateDisplay);
    if (!dateVal.isValid) {
      setErrors([dateVal.error || 'Enter a valid date in DD/MM/YYYY format.']);
      return;
    }
    const isoDate = displayToISO(dateDisplay);
    if (!isoDate) {
      setErrors(['Enter a valid date in DD/MM/YYYY format.']);
      return;
    }

    if (isEditMode && params.id) {
      doUpdate(params.id, odoVal, amountVal, priceVal, isoDate);
    } else {
      // Get the previous entry BEFORE this date for date-aware validation.
      // This prevents false "odometer must be higher" errors when logging past entries.
      const lastEntry = fuelRepo.getFuelEntryBeforeDate(selectedVehicle.id, isoDate);
      const previousOdometer = lastEntry?.odometer ?? null;

      // Run validation engine
      const validation = validateFuelEntry(
        { odometer: odoVal, fuel_amount: amountVal, fuel_unit: fuelUnit, price_per_unit: priceVal, date: isoDate },
        previousOdometer,
        selectedVehicle.tank_capacity,
        selectedVehicle.fuel_type as FuelType
      );

      if (!validation.isValid) {
        setErrors(validation.issues.filter((i) => i.severity === 'error').map((i) => i.message));
        return;
      }

      // If warnings exist, show confirmation
      if (hasWarningsOnly(validation)) {
        const warningMessages = validation.issues.map((i) => i.message).join('\n');
        Alert.alert(
          'Heads Up! 👀',
          warningMessages + '\n\nStill want to save it?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Save Anyway', onPress: () => doSave(odoVal, amountVal, priceVal, isoDate) },
          ]
        );
        return;
      }

      doSave(odoVal, amountVal, priceVal, isoDate);
    }
  };

  const doUpdate = (entryId: string, odoVal: number, amountVal: number, priceVal: number, entryDate: string) => {
    // B-03 FIX: Update the entry
    fuelRepo.updateFuelEntry(entryId, {
      date: entryDate,
      odometer: odoVal,
      fuel_amount: amountVal,
      price_per_unit: priceVal,
      is_full_tank: isFullTank ? 1 : 0,
      fuel_station: fuelStation || null,
      receipt_photo_uri: photoUri || null,
      notes: notes || null,
    });

    // B-03 FIX: Recalculate ALL mileage in the chain (edit may affect downstream)
    const chronological = fuelRepo.getFuelEntriesByVehicleChronological(selectedVehicle.id);
    const recalculated = recalculateAllMileage(chronological, selectedVehicle.fuel_type as FuelType);
    for (const { entryId: id, mileage } of recalculated) {
      fuelRepo.updateFuelEntryMileage(
        id,
        mileage?.value ?? null,
        mileage?.unit ?? null
      );
    }

    // B-04 FIX: Update vehicle odometer to the highest reading
    if (chronological.length > 0) {
      const maxOdometer = Math.max(...chronological.map((e) => e.odometer));
      vehicleRepo.updateVehicleOdometer(selectedVehicle.id, maxOdometer);
      loadVehicles();
    }

    // Reload entries so UI reflects new mileage
    loadEntries(selectedVehicle.id);

    Alert.alert('✅ Entry Updated!', 'Fuel entry updated. Your mileage is recalculating in the background... 🔄', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  const doSave = (odoVal: number, amountVal: number, priceVal: number, entryDate: string) => {
    const { entry, warning } = addFuelEntry(
      {
        vehicle_id: selectedVehicle.id,
        date: entryDate,
        odometer: odoVal,
        fuel_amount: amountVal,
        fuel_unit: fuelUnit,
        price_per_unit: priceVal,
        is_full_tank: isFullTank ? 1 : 0,
        fuel_station: fuelStation || undefined,
        receipt_photo_uri: photoUri || undefined,
        notes: notes || undefined,
      },
      selectedVehicle
    );

    // Refresh vehicle store to get updated odometer
    loadVehicles();

    // Show mileage result if calculated
    if (entry.calculated_mileage && entry.mileage_unit) {
      const mileageText = formatMileage(
        entry.calculated_mileage,
        MILEAGE_UNIT_LABELS[entry.mileage_unit]
      );
      const warningText = warning ? `\n\n⚠️ ${warning.message}` : '';
      Alert.alert(
        '⛽ Fuelled Up!',
        `Mileage: ${mileageText}${warningText}`,
        [{ text: 'Let\'s ride! 🚗', onPress: () => router.back() }]
      );
    } else {
      router.back();
    }
  };

  const totalCost = (parseFloat(fuelAmount) || 0) * (parseFloat(pricePerUnit) || 0);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'android' ? 'height' : 'padding'}
    >
      {/* ── Header ── */}
      <FormHeader title={isEditMode ? 'Edit Fuel' : 'Add Fuel'} />

      {/* ── Vehicle Context ── */}
      <VehicleContextHeader label="Recording for" />

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        {/* ── Date ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Date (DD/MM/YYYY)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={colors.textTertiary}
          value={dateDisplay}
          onChangeText={handleDateChange}
          keyboardType="number-pad"
          maxLength={10}
        />

        {/* ── Odometer ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Odometer (km) *</Text>
        <TextInput
          style={[styles.input, styles.inputLarge, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., 12500"
          placeholderTextColor={colors.textTertiary}
          value={odometer}
          onChangeText={setOdometer}
          keyboardType="numeric"
          autoFocus={!isEditMode}
        />

        {/* ── Fuel Quantity ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Fuel Quantity ({fuelUnitLabel}) *
        </Text>
        <Text style={[styles.subLabel, { color: colors.textTertiary }]}>
          {isEV ? 'kWh charged this session' : `Litres/kg added this fill-up (not current tank level)`}
        </Text>
        <TextInput
          style={[styles.input, styles.inputLarge, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder={`e.g., ${isEV ? '25' : '30'}`}
          placeholderTextColor={colors.textTertiary}
          value={fuelAmount}
          onChangeText={setFuelAmount}
          keyboardType="decimal-pad"
        />

        {/* ── Price Per Unit ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Price per {fuelUnitLabel} (₹) *
        </Text>
        <TextInput
          style={[styles.input, styles.inputLarge, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder={`e.g., ${isEV ? '8' : '105'}`}
          placeholderTextColor={colors.textTertiary}
          value={pricePerUnit}
          onChangeText={setPricePerUnit}
          keyboardType="decimal-pad"
        />

        {/* ── Total Cost (computed, read-only) ── */}
        {totalCost > 0 && (
          <View style={[styles.totalCostCard, { backgroundColor: colors.primaryLight }]}>
            <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>Total Cost</Text>
            <Text style={[Typography.statMedium, { color: colors.primary }]}>
              ₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        )}

        {/* ── Full Tank Toggle ── */}
        {!isEV && (
          <View style={[styles.toggleRow, { borderColor: colors.border }]}>
            <View style={{ flex: 1, marginRight: Spacing.lg }}>
              <Text style={[Typography.body, { color: colors.text }]}>Full Tank Fill?</Text>
              <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                Turn ON if you filled the tank to the brim. Gives accurate mileage.{`\n`}Partial fills show an estimated (~) mileage.
              </Text>
            </View>
            <Switch
              value={isFullTank}
              onValueChange={setIsFullTank}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={isFullTank ? colors.primary : colors.textTertiary}
            />
          </View>
        )}

        {/* ── Optional Fields ── */}
        <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.xxl }]}>
          Fuel Station (optional)
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., HP Pump, Bandra"
          placeholderTextColor={colors.textTertiary}
          value={fuelStation}
          onChangeText={setFuelStation}
        />

        {/* ── Receipt Photo (M-06) ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Receipt Photo (optional)</Text>
        {photoUri ? (
          <View style={styles.photoContainer}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={[styles.photoActionButton, { backgroundColor: colors.primary }]}
                onPress={handlePickPhoto}
              >
                <Text style={[Typography.caption, { color: colors.textOnPrimary }]}>Change</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoActionButton, { backgroundColor: colors.danger }]}
                onPress={() => setPhotoUri(null)}
              >
                <Text style={[Typography.caption, { color: '#FFFFFF' }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.photoButton, { borderColor: colors.primary, backgroundColor: colors.surface }]}
            onPress={handlePickPhoto}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 24 }}>🧾</Text>
            <Text style={[Typography.bodySmall, { color: colors.primary, marginTop: Spacing.xs }]}>
              Attach Receipt Photo
            </Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.label, { color: colors.textSecondary }]}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Any notes..."
          placeholderTextColor={colors.textTertiary}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        {/* ── Errors ── */}
        {errors.length > 0 && (
          <View style={[styles.errorBox, { backgroundColor: colors.dangerLight }]}>
            {errors.map((e, i) => (
              <Text key={i} style={[Typography.bodySmall, { color: colors.danger }]}>
                ❌ {e}
              </Text>
            ))}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Save Button ── */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.accent }]}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={[Typography.button, { color: '#1A1C1E', fontSize: 18 }]}>
            {isEditMode ? 'Update Fuel Entry ✏️' : 'Save Fuel Entry ⛽'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.section,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  headerButton: { width: 60 },
  form: { padding: Spacing.xxl },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
    marginTop: Spacing.lg,
  },
  subLabel: {
    fontSize: 12,
    marginBottom: Spacing.sm,
  },
  input: {
    height: Sizing.primaryButton,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
  },
  inputLarge: {
    height: 60,
    fontSize: 22,
    fontWeight: '600',
  },
  inputMultiline: {
    height: 80,
    paddingTop: Spacing.md,
    textAlignVertical: 'top',
  },
  totalCostCard: {
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginTop: Spacing.md,
    borderBottomWidth: 1,
  },
  errorBox: {
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    gap: Spacing.xs,
  },
  bottomBar: {
    padding: Spacing.lg,
  },
  saveButton: {
    height: Sizing.primaryButton,
    borderRadius: Sizing.radiusMd,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── Photo ──
  photoButton: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  photoContainer: {
    borderRadius: Sizing.radiusMd,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: 150,
    borderRadius: Sizing.radiusMd,
  },
  photoActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  photoActionButton: {
    flex: 1,
    height: 36,
    borderRadius: Sizing.radiusMd,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
