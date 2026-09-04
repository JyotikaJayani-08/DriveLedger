/**
 * Design System & Theme
 *
 * Centralized design tokens for DriveLedger.
 * All colors, typography, spacing, and sizing come from here.
 *
 * DESIGN PRINCIPLES (from charter):
 * - Body text 16sp minimum. Numbers and stats 20sp+.
 * - Minimum 48dp touch targets. Primary actions get 56dp+.
 * - WCAG AA contrast ratio (4.5:1 minimum).
 * - One-handed operation. Bottom-sheet forms.
 * - Theme: system / light / dark.
 *
 * COLOR PALETTE:
 * - Primary: Deep blue (trustworthy, automotive feel)
 * - Accent: Amber/Orange (fuel, energy, warmth)
 * - Success: Green (good mileage, on-time docs)
 * - Warning: Orange (unusual mileage, expiring soon)
 * - Danger: Red (errors, expired, low mileage)
 */

export const Colors = {
  light: {
    // ── Backgrounds ──
    background: '#F8F9FC',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    card: '#FFFFFF',

    // ── Primary (Deep Blue) ──
    primary: '#1A73E8',
    primaryDark: '#1557B0',
    primaryLight: '#E8F0FE',
    primaryText: '#FFFFFF',

    // ── Accent (Amber) ──
    accent: '#F59E0B',
    accentDark: '#D97706',
    accentLight: '#FEF3C7',

    // ── Text ──
    text: '#1A1C1E',
    textSecondary: '#5F6368',
    textTertiary: '#9AA0A6',
    textOnPrimary: '#FFFFFF',

    // ── Borders & Dividers ──
    border: '#E0E3E8',
    borderLight: '#F0F2F5',
    divider: '#EEEFF2',

    // ── Semantic ──
    success: '#0F9D58',
    successLight: '#E6F4EA',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    danger: '#EA4335',
    dangerLight: '#FCE8E6',

    // ── Tab Bar ──
    tabBar: '#FFFFFF',
    tabBarBorder: '#E0E3E8',
    tabIconDefault: '#9AA0A6',
    tabIconSelected: '#1A73E8',

    // ── Misc ──
    shadow: 'rgba(0, 0, 0, 0.08)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    shimmer: '#E8EBF0',
  },
  dark: {
    // ── Backgrounds ──
    background: '#121214',
    surface: '#1E1E22',
    surfaceElevated: '#2A2A2E',
    card: '#1E1E22',

    // ── Primary (Deep Blue) ──
    primary: '#4DA3FF',
    primaryDark: '#1A73E8',
    primaryLight: '#1A2744',
    primaryText: '#FFFFFF',

    // ── Accent (Amber) ──
    accent: '#FBBF24',
    accentDark: '#F59E0B',
    accentLight: '#3D2E0A',

    // ── Text ──
    text: '#E8EAED',
    textSecondary: '#9AA0A6',
    textTertiary: '#6B7280',
    textOnPrimary: '#FFFFFF',

    // ── Borders & Dividers ──
    border: '#3C3C40',
    borderLight: '#2A2A2E',
    divider: '#2C2C30',

    // ── Semantic ──
    success: '#34D399',
    successLight: '#0D3326',
    warning: '#FBBF24',
    warningLight: '#3D2E0A',
    danger: '#F87171',
    dangerLight: '#3B1515',

    // ── Tab Bar ──
    tabBar: '#1E1E22',
    tabBarBorder: '#3C3C40',
    tabIconDefault: '#6B7280',
    tabIconSelected: '#4DA3FF',

    // ── Misc ──
    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    shimmer: '#2A2A2E',
  },
};

export type ThemeColors = typeof Colors.light;

// ─── Typography ─────────────────────────────────────────────────────

export const Typography = {
  /** Large page titles */
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  /** Section headers */
  h2: {
    fontSize: 22,
    fontWeight: '600' as const,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  /** Card titles */
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  /** Body text — charter mandates 16sp minimum */
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  /** Secondary body text */
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  /** Labels and captions */
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  /** Stat numbers — charter mandates 20sp+ */
  stat: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  /** Medium stat numbers */
  statMedium: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 30,
  },
  /** Button text */
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
};

// ─── Spacing ────────────────────────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
};

// ─── Sizing ─────────────────────────────────────────────────────────

export const Sizing = {
  /** Minimum touch target — charter mandates 48dp */
  touchTarget: 48,
  /** Primary action button — charter mandates 56dp+ */
  primaryButton: 56,
  /** FAB (Floating Action Button) */
  fab: 64,
  /** Icon sizes */
  iconSm: 18,
  iconMd: 24,
  iconLg: 32,
  /** Border radius */
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 20,
  radiusFull: 999,
  /** Card elevation shadow */
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
};
