/**
 * Notification Service
 *
 * Handles local push notifications for document expiry warnings
 * and service-due reminders.
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
 * - Service overdue / due within 500 km or 7 days → notification now
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
import * as serviceRepo from '@/database/repositories/serviceRepo';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import { getKmUntilService } from '@/stores/serviceStore';
import { DOCUMENT_TYPE_LABELS } from '@/constants/documentTypes';
import { daysUntil } from '@/utils/date';

// ─── Constants ──────────────────────────────────────────────────────

const CHANNEL_DOCUMENT_EXPIRY = 'document-expiry';
const CHANNEL_SERVICE_DUE = 'service-due';

/** Remind when the next service is within this many km. */
const SERVICE_DUE_KM_THRESHOLD = 500;
/** Remind when the next service date is within this many days. */
const SERVICE_DUE_DAYS_THRESHOLD = 7;

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

// ─── Helpers ────────────────────────────────────────────────────────

type NotificationsModule = typeof import('expo-notifications');

/** Fires a notification immediately on the given Android channel. */
function notifyNow(
  N: NotificationsModule,
  channelId: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<string> {
  return N.scheduleNotificationAsync({
    content: { title, body, data },
    trigger: { channelId },
  });
}

/** "1 day" / "3 days" */
function pluralDays(n: number): string {
  return `${n} day${n !== 1 ? 's' : ''}`;
}

// ─── Document Expiry ────────────────────────────────────────────────

async function scheduleDocumentNotifications(
  N: NotificationsModule,
  vehicleId: string
): Promise<void> {
  const docs = documentRepo.getCurrentDocumentsByVehicle(vehicleId);

  for (const doc of docs) {
    if (!doc.expiry_date) continue;

    const days = daysUntil(doc.expiry_date);
    const label = DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] || doc.type;
    const data = { documentId: doc.id, type: 'expiry' };

    if (days < 0) {
      await notifyNow(
        N, CHANNEL_DOCUMENT_EXPIRY,
        '🚨 Document Expired!',
        `Your ${label} expired ${pluralDays(Math.abs(days))} ago. Please renew it.`,
        data
      );
    } else if (days <= 7) {
      await notifyNow(
        N, CHANNEL_DOCUMENT_EXPIRY,
        '⚠️ Document Expiring Soon!',
        `Your ${label} expires in ${pluralDays(days)}. Renew before it's too late!`,
        data
      );

      // Daily 9 AM reminder for the remaining days
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
            channelId: CHANNEL_DOCUMENT_EXPIRY,
          },
        });
      }
    } else if (days <= 30) {
      await notifyNow(
        N, CHANNEL_DOCUMENT_EXPIRY,
        '📋 Document Expiry Notice',
        `Your ${label} expires in ${days} days. Plan to renew it soon.`,
        data
      );
    }
  }
}

// ─── Service Due ────────────────────────────────────────────────────

/**
 * Notifies when the latest service record's next_due_km / next_due_date
 * is overdue or approaching.
 */
async function scheduleServiceNotifications(
  N: NotificationsModule,
  vehicleId: string
): Promise<void> {
  const vehicle = vehicleRepo.getVehicleById(vehicleId);
  const latest = serviceRepo.getLatestServiceRecord(vehicleId);
  if (!vehicle || !latest) return;

  const data = { vehicleId, serviceId: latest.id, type: 'service_due' };
  const name = vehicle.nickname;

  // Distance-based
  const kmLeft = getKmUntilService(vehicle, latest);
  if (kmLeft !== null) {
    if (kmLeft <= 0) {
      await notifyNow(
        N, CHANNEL_SERVICE_DUE,
        '🔧 Service Overdue!',
        `${name} is ${Math.round(Math.abs(kmLeft)).toLocaleString('en-IN')} km past its service due. Book a service.`,
        data
      );
    } else if (kmLeft <= SERVICE_DUE_KM_THRESHOLD) {
      await notifyNow(
        N, CHANNEL_SERVICE_DUE,
        '🔧 Service Due Soon',
        `${name} is due for service in ${Math.round(kmLeft).toLocaleString('en-IN')} km.`,
        data
      );
    }
  }

  // Date-based
  if (latest.next_due_date) {
    const days = daysUntil(latest.next_due_date);
    if (days < 0) {
      await notifyNow(
        N, CHANNEL_SERVICE_DUE,
        '🔧 Service Overdue!',
        `${name}'s service was due ${pluralDays(Math.abs(days))} ago.`,
        data
      );
    } else if (days <= SERVICE_DUE_DAYS_THRESHOLD) {
      await notifyNow(
        N, CHANNEL_SERVICE_DUE,
        '🔧 Service Due Soon',
        days === 0 ? `${name} is due for service today.` : `${name} is due for service in ${pluralDays(days)}.`,
        data
      );
    }
  }
}

// ─── Schedule All Reminders ─────────────────────────────────────────

/**
 * Checks all vehicles' documents and service records, and schedules
 * notifications for anything expired, overdue, or coming due.
 *
 * Call on app launch and whenever vehicles change (from _layout.tsx).
 *
 * @param vehicleIds - Array of active vehicle IDs to check
 */
export async function scheduleReminderNotifications(vehicleIds: string[]): Promise<void> {
  const N = getNotifications();
  if (!N) return;

  ensureHandlerConfigured();

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  try {
    // Cancel previously scheduled notifications to avoid duplicates
    await cancelAllExpiryNotifications();

    for (const vehicleId of vehicleIds) {
      await scheduleDocumentNotifications(N, vehicleId);
      await scheduleServiceNotifications(N, vehicleId);
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
      await N.setNotificationChannelAsync(CHANNEL_DOCUMENT_EXPIRY, {
        name: 'Document Expiry',
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF9500',
        description: 'Notifications for vehicle document expiry reminders',
      });
      await N.setNotificationChannelAsync(CHANNEL_SERVICE_DUE, {
        name: 'Service Reminders',
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0A84FF',
        description: 'Notifications for upcoming and overdue vehicle services',
      });
    }
  } catch {
    console.warn('[DriveLedger] Failed to set up notification channel.');
  }
}
