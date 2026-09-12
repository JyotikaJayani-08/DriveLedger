/**
 * Shared Form Styles
 *
 * Common styles used across all form screens (add-fuel, add-service,
 * add-expense, add-document). Eliminates duplication of identical
 * label, input, chip, header, and bottom bar styles.
 */

import { StyleSheet } from 'react-native';
import { Spacing, Sizing } from '@/constants/theme';

export const formStyles = StyleSheet.create({
  /** Full-screen flex container */
  container: { flex: 1 },

  /** Form header: Cancel — Title — (spacer) */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.section,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },

  /** Left/right header button area */
  headerButton: { width: 60 },

  /** Form scroll content padding */
  form: { padding: Spacing.xxl },

  /** Uppercase field label */
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },

  /** Standard single-line input */
  input: {
    height: Sizing.primaryButton,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
  },

  /** Large emphasized input (odometer, amount) */
  inputLarge: {
    height: 60,
    fontSize: 22,
    fontWeight: '600',
  },

  /** Multi-line input */
  inputMultiline: {
    height: 80,
    paddingTop: Spacing.md,
    textAlignVertical: 'top',
  },

  /** Chip grid (wrapping row) */
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },

  /** Individual selection chip */
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1.5,
    minHeight: Sizing.touchTarget,
  },

  /** Chip emoji icon */
  chipEmoji: { fontSize: 16 },

  /** Chip text label */
  chipText: { fontSize: 13, fontWeight: '600' },

  /** Bottom-anchored action bar */
  bottomBar: { padding: Spacing.lg },

  /** Primary save button */
  saveButton: {
    height: Sizing.primaryButton,
    borderRadius: Sizing.radiusMd,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /** Error message container */
  errorBox: {
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    gap: Spacing.xs,
  },

  /** Photo picker dashed button */
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

  /** Photo preview container */
  photoContainer: {
    borderRadius: Sizing.radiusMd,
    overflow: 'hidden',
  },

  /** Photo preview image */
  photoPreview: {
    width: '100%',
    height: 150,
    borderRadius: Sizing.radiusMd,
  },

  /** Photo action buttons row */
  photoActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },

  /** Individual photo action button */
  photoActionButton: {
    flex: 1,
    height: 36,
    borderRadius: Sizing.radiusMd,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
