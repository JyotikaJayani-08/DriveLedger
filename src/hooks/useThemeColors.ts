/**
 * useThemeColors hook
 *
 * Returns the correct color palette based on the current system theme.
 * Supports 'light', 'dark', and 'system' (auto-detect).
 */

import { useColorScheme } from 'react-native';
import { Colors, type ThemeColors } from '@/constants/theme';

/**
 * Returns the active color palette based on the device's color scheme.
 *
 * @returns ThemeColors object (light or dark palette)
 */
export function useThemeColors(): ThemeColors {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? Colors.dark : Colors.light;
}
