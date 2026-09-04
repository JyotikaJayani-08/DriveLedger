/**
 * Add / Edit / Renew Document — Modal Form
 *
 * Adds vehicle documents: RC, Insurance, PUC, FASTag, Warranty.
 * Supports document number, insurer name, issue/expiry dates.
 * Photo attachment via expo-image-picker.
 *
 * RENEWAL MODE: If opened with ?renewFrom=<docId>&renewType=<type>,
 * creates a new document and supersedes the old one.
 *
 * Charter user story: "Carry a digital copy, not physical."
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
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useVehicleStore } from '@/stores/vehicleStore';
import { useDocumentStore } from '@/stores/documentStore';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { DocumentType, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_LIST, DOCUMENT_TYPE_ICONS } from '@/constants/documentTypes';
import * as documentRepo from '@/database/repositories/documentRepo';

export default function AddDocumentScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; renewFrom?: string; renewType?: string }>();
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const addDocument = useDocumentStore((s) => s.addDocument);
  const editDocument = useDocumentStore((s) => s.editDocument);
  const renewDocument = useDocumentStore((s) => s.renewDocument);

  const isEditMode = !!params.id;
  const isRenewMode = !!params.renewFrom;

  const [docType, setDocType] = useState<DocumentType | ''>('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [insurerName, setInsurerName] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Load existing document for edit mode
  useEffect(() => {
    if (isEditMode && params.id) {
      const existing = documentRepo.getDocumentById(params.id);
      if (existing) {
        setDocType(existing.type as DocumentType);
        setDocumentNumber(existing.document_number || '');
        setInsurerName(existing.insurer_name || '');
        setNotes(existing.notes || '');
        setPhotoUri(existing.file_uri || null);
        if (existing.issue_date) {
          const parts = existing.issue_date.split('-');
          if (parts.length === 3) {
            setIssueDate(`${parts[2]}/${parts[1]}/${parts[0]}`);
          }
        }
        if (existing.expiry_date) {
          const parts = existing.expiry_date.split('-');
          if (parts.length === 3) {
            setExpiryDate(`${parts[2]}/${parts[1]}/${parts[0]}`);
          }
        }
      }
    }
  }, [params.id]);

  // Pre-fill type for renewal mode
  useEffect(() => {
    if (isRenewMode && params.renewType) {
      setDocType(params.renewType as DocumentType);
    }
  }, [params.renewType]);

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

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library access to attach document photos.');
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
      Alert.alert('Permission needed', 'Please grant camera access to take document photos.');
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
    Alert.alert('Attach Photo', 'How would you like to add the document photo?', [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Gallery', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const parseDateInput = (display: string): string | undefined => {
    if (!display.trim()) return undefined;
    const parts = display.trim().split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return display.trim();
  };

  const handleSave = () => {
    if (!docType) {
      setError('Select a document type.');
      return;
    }
    setError('');

    const parsedIssue = parseDateInput(issueDate);
    const parsedExpiry = parseDateInput(expiryDate);

    if (isRenewMode && params.renewFrom) {
      // Renewal: create new doc and supersede old one
      renewDocument(params.renewFrom, {
        vehicle_id: selectedVehicle.id,
        type: docType,
        document_number: documentNumber || undefined,
        insurer_name: insurerName || undefined,
        issue_date: parsedIssue,
        expiry_date: parsedExpiry,
        notes: notes || undefined,
        file_uri: photoUri || undefined,
      });
      Alert.alert('✅ Renewed!', 'New document created. The old one has been marked as superseded.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else if (isEditMode && params.id) {
      editDocument(params.id, {
        type: docType,
        document_number: documentNumber || null,
        insurer_name: insurerName || null,
        issue_date: parsedIssue || null,
        expiry_date: parsedExpiry || null,
        notes: notes || null,
        file_uri: photoUri || null,
      });
      Alert.alert('✅ Updated', 'Document updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      addDocument({
        vehicle_id: selectedVehicle.id,
        type: docType,
        document_number: documentNumber || undefined,
        insurer_name: insurerName || undefined,
        issue_date: parsedIssue,
        expiry_date: parsedExpiry,
        notes: notes || undefined,
        file_uri: photoUri || undefined,
      });
      router.back();
    }
  };

  const headerTitle = isRenewMode
    ? `Renew ${DOCUMENT_TYPE_LABELS[docType as DocumentType] || 'Document'}`
    : isEditMode
    ? 'Edit Document'
    : 'Add Document';

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
          {headerTitle}
        </Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        {/* ── Renewal Banner ── */}
        {isRenewMode && (
          <View style={[styles.renewBanner, { backgroundColor: colors.primaryLight }]}>
            <Text style={[Typography.bodySmall, { color: colors.primary }]}>
              🔄 Renewing document. The old record will be marked as superseded.
            </Text>
          </View>
        )}

        {/* ── Document Type ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Document Type *</Text>
        <View style={styles.chipGrid}>
          {DOCUMENT_TYPE_LIST.map((dt) => (
            <Pressable
              key={dt}
              onPress={() => setDocType(dt)}
              style={[
                styles.chip,
                {
                  backgroundColor: docType === dt ? colors.primary : colors.surface,
                  borderColor: docType === dt ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={styles.chipEmoji}>{DOCUMENT_TYPE_ICONS[dt] || '📄'}</Text>
              <Text
                style={[
                  styles.chipText,
                  { color: docType === dt ? colors.textOnPrimary : colors.text },
                ]}
              >
                {DOCUMENT_TYPE_LABELS[dt]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Document Number ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Document Number</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., POL-123456789"
          placeholderTextColor={colors.textTertiary}
          value={documentNumber}
          onChangeText={setDocumentNumber}
        />

        {/* ── Insurer Name (only for Insurance) ── */}
        {docType === DocumentType.INSURANCE && (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Insurer Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g., ICICI Lombard"
              placeholderTextColor={colors.textTertiary}
              value={insurerName}
              onChangeText={setInsurerName}
            />
          </>
        )}

        {/* ── Issue Date ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Issue Date</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="DD/MM/YYYY (e.g., 15/03/2026)"
          placeholderTextColor={colors.textTertiary}
          value={issueDate}
          onChangeText={setIssueDate}
          keyboardType="numeric"
        />

        {/* ── Expiry Date ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Expiry Date</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="DD/MM/YYYY (e.g., 15/03/2027)"
          placeholderTextColor={colors.textTertiary}
          value={expiryDate}
          onChangeText={setExpiryDate}
          keyboardType="numeric"
        />

        {/* ── Photo Attachment ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Document Photo</Text>
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
            <Text style={{ fontSize: 28 }}>📷</Text>
            <Text style={[Typography.bodySmall, { color: colors.primary, marginTop: Spacing.xs }]}>
              Take Photo or Choose from Gallery
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
              Carry a digital copy — don't carry physical!
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Notes ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Notes</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Any notes..."
          placeholderTextColor={colors.textTertiary}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
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
          style={[styles.saveButton, { backgroundColor: isRenewMode ? colors.success : colors.primary }]}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={[Typography.button, { color: '#FFFFFF' }]}>
            {isRenewMode
              ? 'Save Renewed Document 🔄'
              : isEditMode
              ? 'Update Document ✏️'
              : 'Save Document 📄'}
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
  renewBanner: {
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  // ── Photo ──
  photoButton: {
    borderRadius: Sizing.radiusMd, borderWidth: 2, borderStyle: 'dashed',
    padding: Spacing.xxl, alignItems: 'center', justifyContent: 'center',
  },
  photoContainer: {
    borderRadius: Sizing.radiusMd, overflow: 'hidden',
  },
  photoPreview: {
    width: '100%', height: 200, borderRadius: Sizing.radiusMd,
  },
  photoActions: {
    flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm,
  },
  photoActionButton: {
    flex: 1, height: 36, borderRadius: Sizing.radiusMd,
    justifyContent: 'center', alignItems: 'center',
  },
  bottomBar: { padding: Spacing.lg },
  saveButton: {
    height: Sizing.primaryButton, borderRadius: Sizing.radiusMd,
    justifyContent: 'center', alignItems: 'center',
  },
});
