/**
 * Service Templates
 *
 * Predefined service types for one-tap selection instead of typing
 * "Oil Change" every time. Matches the charter's service template list.
 *
 * WHY a const array + type extraction?
 * - `as const` makes the array readonly and narrows the type to literal strings.
 * - ServiceTemplate type is derived from the array, so adding a new template
 *   here automatically updates the type everywhere.
 * - The array itself is used to populate the UI dropdown.
 */

export interface ServiceTemplateItem {
  id: string;
  name: string;
  icon: string;
}

export const SERVICE_TEMPLATES: ServiceTemplateItem[] = [
  { id: 'engine_oil', name: 'Engine Oil Change', icon: '🛢️' },
  { id: 'oil_filter', name: 'Oil Filter', icon: '🔧' },
  { id: 'air_filter', name: 'Air Filter', icon: '💨' },
  { id: 'tyre_rotation', name: 'Tyre Rotation', icon: '🔄' },
  { id: 'tyre_replacement', name: 'Tyre Replacement', icon: '🛞' },
  { id: 'battery', name: 'Battery Replacement', icon: '🔋' },
  { id: 'coolant', name: 'Coolant Flush', icon: '❄️' },
  { id: 'brake_pad', name: 'Brake Pad Replacement', icon: '🛑' },
  { id: 'brake_oil', name: 'Brake Oil Change', icon: '💧' },
  { id: 'chain_lube', name: 'Chain Lubrication', icon: '⛓️' },
  { id: 'spark_plug', name: 'Spark Plug', icon: '⚡' },
  { id: 'general', name: 'General Service', icon: '🔩' },
  { id: 'other', name: 'Other', icon: '📝' },
];

/** Type derived from the template names for compile-time safety */
export type ServiceTemplateName = typeof SERVICE_TEMPLATES[number]['name'];

