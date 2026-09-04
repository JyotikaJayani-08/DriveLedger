/**
 * Notification Service
 *
 * Handles local push notifications for document expiry warnings.
 *
 * HOW IT WORKS:
 * 1. On app launch, checks all documents for upcoming expiry.
 * 2. Schedules local notifications for documents expiring within 30 days.
 * 3. Uses expo-notifications for Android local notifications.
 *
 * NOTIFICATION SCHEDULE:
 * - Expired documents → immediate notification
 * - Expiring in ≤7 days → notification now + daily reminder
 * - Expiring in ≤30 days → notification now
 *
 * NOTE: All notifications are LOCAL. No server, no internet, no account.
 *
 * EXPO GO COMPATIBILITY:
 * Since SDK 53, expo-notifications is NOT available in Expo Go.
 * All calls are wrapped in try/catch and the module is lazily imported
 * so the app runs fine without notifications in Expo Go.
 * In a production dev build, notifications work normally.
 */

import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import * as documentRepo from '@/database/repositories/documentRepo';
import { DOCUMENT_TYPE_LABELS } from '@/constants/documentTypes';
import { daysUntil } from '@/utils/date';

// ─── Expo Go detection ──────────────────────────────────────────────
// Since SDK 53, expo-notifications is NOT available in Expo Go.
// Even a try/catch around require() still triggers the dev error overlay,
// so we detect Expo Go upfront and never call require() at all.
// We use the same isRunningInExpoGo() that expo-notifications uses internally.

const isExpoGo = isRunningInExpoGo();

// ─── Lazy module reference ──────────────────────────────────────────

let Notifications: typeof import('expo-notifications') | null = null;
/** Set to true after a failed require — never retry. */
let notificationsUnavailable = false;

function getNotifications(): typeof import('expo-notifications') | null {
  if (Notifications) return Notifications;
  if (notificationsUnavailable || isExpoGo) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications') as typeof import('expo-notifications');
    return Notifications;
  } catch {
    // expo-notifications not available in this runtime
    notificationsUnavailable = true;
    console.warn('[DriveLedger] expo-notifications not available — notifications disabled.');
    return null;
  }
}

// ─── Configuration ──────────────────────────────────────────────────

/**
 * Configure how notifications appear when app is in foreground.
 * Called lazily on first use, not at module load time.
 */
let handlerConfigured = false;

function ensureHandlerConfigured(): void {
  if (handlerConfigured) return;
  const N = getNotifications();
  if (!N) return;

  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerConfigured = true;
  } catch {
    console.warn('[DriveLedger] Failed to configure notification handler.');
  }
}

// ─── Permission ─────────────────────────────────────────────────────

/**
 * Requests notification permissions from the user.
 * @returns true if permission granted
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const N = getNotifications();
  if (!N) return false;

  try {
    if (Platform.OS === 'android') {
      const { status: existingStatus } = await N.getPermissionsAsync();
      if (existingStatus === 'granted') return true;

      const { status } = await N.requestPermissionsAsync();
      return status === 'granted';
    }
  } catch {
    console.warn('[DriveLedger] Notification permission request failed.');
  }
  return false;
}

// ─── Schedule Expiry Notifications ──────────────────────────────────

/**
 * Checks all vehicles' documents and schedules notifications for
 * any that are expired or expiring soon.
 *
 * Call this once on app launch (from _layout.tsx).
 *
 * @param vehicleIds - Array of active vehicle IDs to check
 */
export async function scheduleExpiryNotifications(vehicleIds: string[]): Promise<void> {
  const N = getNotifications();
  if (!N) return;

  ensureHandlerConfigured();

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  try {
    // Cancel any previously scheduled expiry notifications
    await cancelAllExpiryNotifications();

    for (const vehicleId of vehicleIds) {
      const docs = documentRepo.getCurrentDocumentsByVehicle(vehicleId);

      for (const doc of docs) {
        if (!doc.expiry_date) continue;

        const days = daysUntil(doc.expiry_date);
        const label = DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] || doc.type;

        if (days < 0) {
          // Already expired — immediate notification
          await N.scheduleNotificationAsync({
            content: {
              title: '🚨 Document Expired!',
              body: `Your ${label} expired ${Math.abs(days)} days ago. Please renew it.`,
              data: { documentId: doc.id, type: 'expiry' },
            },
            trigger: null, // Fire immediately
          });
        } else if (days <= 7) {
          // Expiring very soon — immediate + daily reminder
          await N.scheduleNotificationAsync({
            content: {
              title: '⚠️ Document Expiring Soon!',
              body: `Your ${label} expires in ${days} day${days !== 1 ? 's' : ''}. Renew before it's too late!`,
              data: { documentId: doc.id, type: 'expiry' },
            },
            trigger: null,
          });

          // Schedule a daily reminder at 9 AM for the remaining days
          if (days > 0) {
            await N.scheduleNotificationAsync({
              content: {
                title: '📋 Renewal Reminder',
                body: `Your ${label} expires soon. Don't forget to renew!`,
                data: { documentId: doc.id, type: 'expiry_reminder' },
              },
              trigger: {
                type: N.SchedulableTriggerInputTypes.DAILY,
                hour: 9,
                minute: 0,
              },
            });
          }
        } else if (days <= 30) {
          // Expiring within a month — one-time heads-up
          await N.scheduleNotificationAsync({
            content: {
              title: '📋 Document Expiry Notice',
              body: `Your ${label} expires in ${days} days. Plan to renew it soon.`,
              data: { documentId: doc.id, type: 'expiry' },
            },
            trigger: null,
          });
        }
      }
    }
  } catch (error) {
    console.warn('[DriveLedger] Failed to schedule notifications:', error);
  }
}

// ─── Cancel ─────────────────────────────────────────────────────────

/**
 * Cancels all previously scheduled expiry notifications.
 * Called before re-scheduling to avoid duplicates.
 */
export async function cancelAllExpiryNotifications(): Promise<void> {
  const N = getNotifications();
  if (!N) return;

  try {
    await N.cancelAllScheduledNotificationsAsync();
  } catch {
    console.warn('[DriveLedger] Failed to cancel notifications.');
  }
}

// ─── Setup Android Channel ──────────────────────────────────────────

/**
 * Sets up the Android notification channel.
 * Must be called once before any notifications are scheduled.
 */
export async function setupNotificationChannel(): Promise<void> {
  const N = getNotifications();
  if (!N) return;

  ensureHandlerConfigured();

  try {
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('document-expiry', {
        name: 'Document Expiry',
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF9500',
        description: 'Notifications for vehicle document expiry reminders',
      });
    }
  } catch {
    console.warn('[DriveLedger] Failed to set up notification channel.');
  }
}
