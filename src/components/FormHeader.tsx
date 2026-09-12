/**
 * FormHeader — Shared Form Screen Header
 *
 * Consistent Cancel — Title — (spacer) layout used by
 * add-fuel, add-service, add-expense, and add-document screens.
 *
 * Keeps the header pattern DRY while allowing per-screen customization.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing } from '@/constants/theme';

interface FormHeaderProps {
  /** The title displayed in the center */
  title: string;
  /** Override the default "Cancel" back action */
  onCancel?: () => void;
}

export function FormHeader({ title, onCancel }: FormHeaderProps) {
  const colors = useThemeColors();
  const router = useRouter();

  return (
    <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={onCancel ?? (() => router.back())} style={styles.headerButton}>
        <Text style={[Typography.body, { color: colors.primary }]}>Cancel</Text>
      </TouchableOpacity>
      <Text style={[Typography.h3, { color: colors.text }]}>{title}</Text>
      <View style={styles.headerButton} />
    </View>
  );
}

const styles = StyleSheet.create({
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
});
