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
import * as DocumentPicker from 'expo-document-picker';
import { useVehicleStore } from '@/stores/vehicleStore';
import { useDocumentStore } from '@/stores/documentStore';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { DocumentType, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_LIST, DOCUMENT_TYPE_ICONS } from '@/constants/documentTypes';
import { displayToISO, isoToDisplay, formatDateInput } from '@/utils/dateInput';
import { FormHeader } from '@/components/FormHeader';
import { NoVehicleState } from '@/components/NoVehicleState';
import { VehicleContextHeader } from '@/components/VehicleContextHeader';
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
          setIssueDate(isoToDisplay(existing.issue_date));
        }
        if (existing.expiry_date) {
          setExpiryDate(isoToDisplay(existing.expiry_date));
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
    return <NoVehicleState />;
  }

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('🖼️ Gallery Locked!', 'We need photo library access to grab your document. Pop into settings and allow it — we\'ll wait! 😄');
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
      Alert.alert('📷 Say Cheese!', 'Camera access is needed to photograph your document. Allow it in settings and let\'s go! 📸');
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
    Alert.alert('Attach Document 📂', 'How would you like to add it?', [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Gallery (Image)', onPress: pickImage },
      { text: 'Upload PDF', onPress: pickPDF },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickPDF = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleIssueDateChange = (text: string) => {
    const formatted = formatDateInput(text, issueDate);
    setIssueDate(formatted);
  };

  const handleExpiryDateChange = (text: string) => {
    const formatted = formatDateInput(text, expiryDate);
    setExpiryDate(formatted);
  };

  const parseDateInput = (display: string): string | undefined => {
    if (!display.trim()) return undefined;
    return displayToISO(display) ?? display.trim();
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
      Alert.alert('🎉 Renewed!', 'Fresh document added! The old one\'s been gracefully retired — out with the old, in with the new! 🔄', [
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
      Alert.alert('✅ Looking Good!', 'Document updated and looking sharp 📌', [
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
      <FormHeader title={headerTitle} />

      {/* ── Vehicle Context ── */}
      <VehicleContextHeader label="For" />

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
          onChangeText={handleIssueDateChange}
          keyboardType="number-pad"
          maxLength={10}
        />

        {/* ── Expiry Date ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Expiry Date</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="DD/MM/YYYY (e.g., 15/03/2027)"
          placeholderTextColor={colors.textTertiary}
          value={expiryDate}
          onChangeText={handleExpiryDateChange}
          keyboardType="number-pad"
          maxLength={10}
        />

        {/* ── Photo / PDF Attachment ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Document Photo or PDF</Text>
        {photoUri ? (
          <View style={styles.photoContainer}>
            {photoUri.toLowerCase().endsWith('.pdf') ? (
              // PDF preview placeholder
              <View style={[styles.pdfPreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 48 }}>📄</Text>
                <Text style={[Typography.body, { color: colors.text, fontWeight: '600', marginTop: Spacing.sm }]}>PDF Document</Text>
                <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs, textAlign: 'center' }]}
                  numberOfLines={1}>
                  {photoUri.split('/').pop()}
                </Text>
              </View>
            ) : (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
            )}
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
              Take Photo, Gallery, or Upload PDF
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
  pdfPreview: {
    width: '100%',
    minHeight: 120,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
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
