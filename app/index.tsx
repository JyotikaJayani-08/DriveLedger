/**
 * App Entry Point
 *
 * Redirects to either:
 * - Onboarding (if no vehicles exist — first-time user)
 * - The main tab layout (if vehicles exist)
 *
 * This matches the charter's First-Time Experience flow:
 *   Install → Welcome → Add Vehicle → Dashboard
 */

import { Redirect } from 'expo-router';
import { useVehicleStore } from '@/stores/vehicleStore';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function Index() {
  const vehicles = useVehicleStore((s) => s.vehicles);
  const isLoading = useVehicleStore((s) => s.isLoading);
  const colors = useThemeColors();

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // First time user — no vehicles yet → onboarding
  if (vehicles.length === 0) {
    return <Redirect href="/onboarding" />;
  }

  // Existing user → main tabs
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
