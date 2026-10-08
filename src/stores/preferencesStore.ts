/**
 * Preferences Store (Zustand + AsyncStorage)
 *
 * Persists user preferences across app restarts.
 *
 * Charter preferences:
 *   - currency:       INR default
 *   - distanceUnit:   km default
 *   - fuelVolumeUnit: litres default
 *   - pressureUnit:   PSI default
 *   - defaultVehicleId: first added vehicle
 *
 * PATTERN:
 *   loadPreferences() called once on app launch from _layout.tsx.
 *   All setters persist immediately via AsyncStorage.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Types ---

export type CurrencyCode    = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD';
export type DistanceUnit    = 'km' | 'miles';
export type FuelVolumeUnit  = 'litres' | 'gallons';
export type PressureUnit    = 'PSI' | 'bar' | 'kPa';

export interface Preferences {
  currency: CurrencyCode;
  distanceUnit: DistanceUnit;
  fuelVolumeUnit: FuelVolumeUnit;
  pressureUnit: PressureUnit;
  defaultVehicleId: string | null;
}

// --- Options for UI pickers ---

export const CURRENCY_OPTIONS: { value: CurrencyCode; label: string; symbol: string }[] = [
  { value: 'INR', label: 'Indian Rupee', symbol: 'Rs.' },
  { value: 'USD', label: 'US Dollar',    symbol: '$'   },
  { value: 'EUR', label: 'Euro',          symbol: 'E'  },
  { value: 'GBP', label: 'British Pound', symbol: 'P'  },
  { value: 'AED', label: 'UAE Dirham',   symbol: 'AED' },
  { value: 'SGD', label: 'Singapore $',  symbol: 'S$'  },
];

export const DISTANCE_OPTIONS: { value: DistanceUnit; label: string }[] = [
  { value: 'km',    label: 'Kilometres (km)' },
  { value: 'miles', label: 'Miles (mi)'      },
];

export const FUEL_VOLUME_OPTIONS: { value: FuelVolumeUnit; label: string }[] = [
  { value: 'litres',  label: 'Litres (L)'     },
  { value: 'gallons', label: 'Gallons (gal)'  },
];

export const PRESSURE_OPTIONS: { value: PressureUnit; label: string }[] = [
  { value: 'PSI', label: 'PSI'        },
  { value: 'bar', label: 'Bar'        },
  { value: 'kPa', label: 'kPa'        },
];

// --- Storage keys ---

const KEYS = {
  currency:         'pref_currency',
  distanceUnit:     'pref_distance_unit',
  fuelVolumeUnit:   'pref_fuel_volume_unit',
  pressureUnit:     'pref_pressure_unit',
  defaultVehicleId: 'pref_default_vehicle_id',
} as const;

const DEFAULTS: Preferences = {
  currency: 'INR',
  distanceUnit: 'km',
  fuelVolumeUnit: 'litres',
  pressureUnit: 'PSI',
  defaultVehicleId: null,
};

// --- Store ---

interface PreferencesState extends Preferences {
  isLoaded: boolean;
  loadPreferences:    () => Promise<void>;
  setCurrency:        (v: CurrencyCode)   => Promise<void>;
  setDistanceUnit:    (v: DistanceUnit)   => Promise<void>;
  setFuelVolumeUnit:  (v: FuelVolumeUnit) => Promise<void>;
  setPressureUnit:    (v: PressureUnit)   => Promise<void>;
  setDefaultVehicleId:(v: string | null)  => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  ...DEFAULTS,
  isLoaded: false,

  loadPreferences: async () => {
    try {
      const pairs = await AsyncStorage.multiGet([
        KEYS.currency, KEYS.distanceUnit, KEYS.fuelVolumeUnit,
        KEYS.pressureUnit, KEYS.defaultVehicleId,
      ]);
      const [currency, distanceUnit, fuelVolumeUnit, pressureUnit, defaultVehicleId] = pairs;
      set({
        currency:         (currency[1]        as CurrencyCode)   ?? DEFAULTS.currency,
        distanceUnit:     (distanceUnit[1]     as DistanceUnit)   ?? DEFAULTS.distanceUnit,
        fuelVolumeUnit:   (fuelVolumeUnit[1]   as FuelVolumeUnit) ?? DEFAULTS.fuelVolumeUnit,
        pressureUnit:     (pressureUnit[1]     as PressureUnit)   ?? DEFAULTS.pressureUnit,
        defaultVehicleId: defaultVehicleId[1] ?? null,
        isLoaded: true,
      });
    } catch {
      set({ ...DEFAULTS, isLoaded: true });
    }
  },

  setCurrency:        async (v) => { await AsyncStorage.setItem(KEYS.currency, v);       set({ currency: v });       },
  setDistanceUnit:    async (v) => { await AsyncStorage.setItem(KEYS.distanceUnit, v);   set({ distanceUnit: v });   },
  setFuelVolumeUnit:  async (v) => { await AsyncStorage.setItem(KEYS.fuelVolumeUnit, v); set({ fuelVolumeUnit: v }); },
  setPressureUnit:    async (v) => { await AsyncStorage.setItem(KEYS.pressureUnit, v);   set({ pressureUnit: v });   },
  setDefaultVehicleId: async (v) => {
    if (v === null) { await AsyncStorage.removeItem(KEYS.defaultVehicleId); }
    else            { await AsyncStorage.setItem(KEYS.defaultVehicleId, v); }
    set({ defaultVehicleId: v });
  },
}));

// --- Convenience getters (for use outside React components) ---

export function getPreferences(): Preferences {
  return usePreferencesStore.getState();
}

export function getCurrencySymbol(): string {
  const { currency } = getPreferences();
  return CURRENCY_OPTIONS.find((o) => o.value === currency)?.symbol ?? 'Rs.';
}

export function getDistanceLabel(): string {
  return getPreferences().distanceUnit === 'km' ? 'km' : 'mi';
}

export function convertDistance(km: number): number {
  return getPreferences().distanceUnit === 'miles' ? km * 0.621371 : km;
}

export function convertPressure(psi: number): number {
  switch (getPreferences().pressureUnit) {
    case 'bar': return +(psi * 0.0689476).toFixed(2);
    case 'kPa': return +(psi * 6.89476).toFixed(1);
    default:    return psi;
  }
}

export function getPressureLabel(): string {
  return getPreferences().pressureUnit;
}
