/**
 * Documents Screen
 *
 * Shows vehicle documents (RC, Insurance, PUC, FASTag, Warranty).
 * Highlights documents nearing expiry with color-coded badges.
 *
 * Features:
 * - List of current (non-superseded) documents
 * - Expiry warning badges (expired, expiring soon, valid)
 * - Renew button on expired/expiring documents
 * - Photo thumbnail display
 * - FAB to add new documents
 * - Wired to centralized documentStore
 */

import { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, Modal, Linking } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { useVehicleStore } from '@/stores/vehicleStore';
import { useDocumentStore } from '@/stores/documentStore';
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_ICONS } from '@/constants/documentTypes';
import { formatDisplayDateLong, daysUntil } from '@/utils/date';
import type { VehicleDocument } from '@/types/document';
import { VehicleContextHeader } from '@/components/VehicleContextHeader';

export default function DocumentsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);

  const documents = useDocumentStore((s) => s.documents);
  const loadDocuments = useDocumentStore((s) => s.loadDocuments);
  const deleteDocument = useDocumentStore((s) => s.deleteDocument);

  // Fullscreen image viewer state
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  // Reload when screen comes into focus (after adding a document)
  useFocusEffect(
    useCallback(() => {
      if (selectedVehicle) {
        loadDocuments(selectedVehicle.id);
      }
    }, [selectedVehicle?.id])
  );

  const getExpiryBadge = (expiryDate: string | null) => {
    if (!expiryDate) return { label: 'No Expiry', color: colors.textTertiary, bgColor: colors.shimmer };
    const days = daysUntil(expiryDate);
    if (days < 0) return { label: 'Expired', color: colors.danger, bgColor: colors.dangerLight };
    if (days <= 30) return { label: `${days}d left`, color: colors.warning, bgColor: colors.warningLight };
    if (days <= 90) return { label: `${days}d left`, color: colors.accent, bgColor: colors.accentLight };
    return { label: 'Valid', color: colors.success, bgColor: colors.successLight };
  };

  const handleRenew = (doc: VehicleDocument) => {
    const label = DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] || doc.type;
    Alert.alert(
      `Renew ${label}`,
      `This will create a new ${label} record and mark the current one as superseded.\n\nYou'll be taken to the form to fill in new details.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Renew',
          onPress: () => {
            // Navigate to add-document with renewal params
            router.push({
              pathname: '/add-document',
              params: { renewFrom: doc.id, renewType: doc.type },
            });
          },
        },
      ]
    );
  };

  /**
   * Open a document file:
   * - Images: show fullscreen modal
   * - PDFs: open in native viewer via Linking
   */
  const openDocumentFile = (uri: string) => {
    if (uri.toLowerCase().endsWith('.pdf')) {
      Linking.openURL(uri).catch(() => {
        Alert.alert('Cannot open PDF', 'No PDF viewer found on this device.');
      });
    } else {
      setViewerUri(uri);
    }
  };

  /**
   * Double-tap detection per card.
   * Returns an onPress handler that fires singleAction on first tap
   * and doubleAction if a second tap arrives within 300ms.
   */
  const useDoubleTap = (singleAction: () => void, doubleAction: () => void) => {
    const lastTap = useRef<number>(0);
    return () => {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        lastTap.current = 0;
        doubleAction();
      } else {
        lastTap.current = now;
        // Delay single action slightly so double-tap can cancel it
        setTimeout(() => {
          if (lastTap.current !== 0) {
            singleAction();
          }
        }, 310);
      }
    };
  };

  const renderDocument = ({ item }: { item: VehicleDocument }) => {
    const badge = getExpiryBadge(item.expiry_date);
    const isExpiredOrExpiring = item.expiry_date && daysUntil(item.expiry_date) <= 30;
    const isPDF = item.file_uri?.toLowerCase().endsWith('.pdf');

    // Double-tap: single = edit, double = view file
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const handleTap = useDoubleTap(
      () => router.push({ pathname: '/add-document', params: { id: item.id } }),
      () => item.file_uri ? openDocumentFile(item.file_uri) : router.push({ pathname: '/add-document', params: { id: item.id } })
    );

    return (
      <TouchableOpacity
        onPress={handleTap}
        onLongPress={() => {
          Alert.alert(
            'Delete Document',
            `Delete this ${DOCUMENT_TYPE_LABELS[item.type as keyof typeof DOCUMENT_TYPE_LABELS] || item.type} record?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  if (selectedVehicle) {
                    deleteDocument(item.id, selectedVehicle.id);
                  }
                },
              },
            ]
          );
        }}
        activeOpacity={0.7}
        style={[styles.docCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={styles.docRow}>
          <Text style={styles.docIcon}>
            {DOCUMENT_TYPE_ICONS[item.type as keyof typeof DOCUMENT_TYPE_ICONS] || '📄'}
          </Text>
          <View style={styles.docInfo}>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>
              {DOCUMENT_TYPE_LABELS[item.type as keyof typeof DOCUMENT_TYPE_LABELS] || item.type}
            </Text>
            {item.document_number && (
              <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
                {item.document_number}
              </Text>
            )}
            {item.insurer_name && (
              <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
                {item.insurer_name}
              </Text>
            )}
            {item.expiry_date && (
              <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
                Expires: {formatDisplayDateLong(item.expiry_date)}
              </Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end', gap: Spacing.xs }}>
            <View style={[styles.badge, { backgroundColor: badge.bgColor }]}>
              <Text style={[Typography.caption, { color: badge.color }]}>{badge.label}</Text>
            </View>
            {item.file_uri && (
              <Text style={{ fontSize: 14 }}>{isPDF ? '📄' : '📷'}</Text>
            )}
          </View>
        </View>
        {item.file_uri && !isPDF && (
          <Image source={{ uri: item.file_uri }} style={styles.docPhoto} resizeMode="cover" />
        )}
        {item.file_uri && isPDF && (
          <View style={[styles.pdfBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ fontSize: 20 }}>📄</Text>
            <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginLeft: Spacing.sm }]}>
              PDF attached — double tap to open
            </Text>
          </View>
        )}

        {/* ── Renew Button (M-07) ── */}
        {isExpiredOrExpiring && (
          <TouchableOpacity
            style={[styles.renewButton, {
              backgroundColor: daysUntil(item.expiry_date!) < 0 ? colors.danger : colors.warning,
            }]}
            onPress={() => handleRenew(item)}
            activeOpacity={0.8}
          >
            <Text style={[Typography.caption, { color: '#FFFFFF', fontWeight: '700' }]}>
              🔄 Renew Now
            </Text>
          </TouchableOpacity>
        )}

        <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
          Tap to edit · Double tap to view · Long press to delete
        </Text>
      </TouchableOpacity>
    );
  };

  if (!selectedVehicle) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48, marginBottom: Spacing.lg }}>📄</Text>
          <Text style={[Typography.h3, { color: colors.text }]}>No vehicle selected</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Vehicle Context ── */}
      <VehicleContextHeader label="Documents for" />

      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        renderItem={renderDocument}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48, marginBottom: Spacing.lg }}>📄</Text>
            <Text style={[Typography.h3, { color: colors.text }]}>No documents yet</Text>
            <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
              Store your RC, Insurance, PUC, and more digitally.
            </Text>
          </View>
        }
      />

      {/* ── FAB: Add Document ── */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        activeOpacity={0.85}
        onPress={() => router.push('/add-document')}
      >
        <Text style={styles.fabIcon}>+</Text>
        <Text style={[styles.fabText, { color: colors.textOnPrimary }]}>Add Document</Text>
      </TouchableOpacity>

      {/* ── Fullscreen Image Viewer Modal ── */}
      <Modal
        visible={!!viewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setViewerUri(null)}
            activeOpacity={0.8}
          >
            <Text style={styles.modalCloseText}>✕ Close</Text>
          </TouchableOpacity>
          {viewerUri && (
            <Image
              source={{ uri: viewerUri }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 100 },
  docCard: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  docPhoto: {
    width: '100%',
    height: 120,
    borderRadius: Sizing.radiusMd,
    marginTop: Spacing.sm,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  docIcon: {
    fontSize: 28,
    marginRight: Spacing.md,
  },
  docInfo: {
    flex: 1,
  },
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Sizing.radiusFull,
    marginLeft: Spacing.sm,
  },
  renewButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Sizing.radiusFull,
    alignSelf: 'flex-start',
  },
  pdfBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.section * 2,
    paddingHorizontal: Spacing.xxxl,
  },
  // ── Fullscreen modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 56,
    right: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalImage: {
    width: '95%',
    height: '80%',
    borderRadius: 12,
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
  fabIcon: { fontSize: 24, color: '#FFFFFF', fontWeight: '700' },
  fabText: { fontSize: 16, fontWeight: '700' },
});
