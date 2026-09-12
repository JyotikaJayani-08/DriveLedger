import { Alert, Linking } from 'react-native';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import {
  GITHUB_REPO,
  GitHubRelease,
  parseGitHubRelease,
} from '@/utils/releaseParser';

export { GITHUB_REPO, GitHubRelease, parseGitHubRelease };

/**
 * Displays the 2 golden rules of data safety when updating APKs.
 */
export function showDataSafetyGuide() {
  Alert.alert(
    '🛡️ Update & Data Safety Rules',
    `Rule 1: NEVER UNINSTALL FIRST\n` +
      `When you download a new APK, DO NOT uninstall your current app. Simply open the new APK and tap "Update". Android preserves all your offline vehicle data, fuel logs, and service records.\n\n` +
      `Rule 2: EXPORT A BACKUP ANYTIME\n` +
      `All DriveLedger data is stored 100% offline on your device. You can tap "Export Backup" above in Settings anytime to save a JSON copy to your Google Drive or Files.\n\n` +
      `Rule 3: USE OFFICIAL RELEASES\n` +
      `Always download APKs from your official GitHub Releases page to ensure matching security signatures.`,
    [{ text: 'Understood 👍' }]
  );
}

/**
 * Checks GitHub Releases API for new APK versions.
 */
export async function checkForAppUpdate(options?: {
  manual?: boolean;
  repo?: string;
}): Promise<boolean> {
  const isManual = options?.manual ?? false;
  const repo = options?.repo ?? GITHUB_REPO;
  const currentVersion = Constants.expoConfig?.version || '1.0.0';

  if (repo === 'your-username/DriveLedger') {
    if (isManual) {
      Alert.alert(
        'GitHub Repo Not Configured',
        `Current app version: v${currentVersion}\n\n` +
          `To connect with your GitHub Releases, set your "owner/repo" in src/utils/releaseParser.ts.\n\n` +
          `Whenever you publish a release on GitHub, users can check for updates with one tap.`,
        [
          { text: 'Safety Rules', onPress: showDataSafetyGuide },
          { text: 'OK', style: 'cancel' },
        ]
      );
    }
    return false;
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'DriveLedger-App',
      },
    });

    if (response.status === 404) {
      if (isManual) {
        Alert.alert(
          'No Releases Yet',
          `No public releases found on GitHub for ${repo}.\n\nCurrent version: v${currentVersion}`
        );
      }
      return false;
    }

    if (!response.ok) {
      throw new Error(`GitHub API error ${response.status}`);
    }

    const data: GitHubRelease = await response.json();
    const result = parseGitHubRelease(data, currentVersion);

    if (result.hasUpdate) {
      Alert.alert(
        `Update Available (v${result.version})`,
        `${result.releaseNotes}\n\n` +
          `🛡️ TWO SAFETY RULES:\n` +
          `1. DO NOT uninstall your current app! Tap 'Download APK' and install over this version to keep all your records.\n` +
          `2. Tap 'Export Backup' in Settings anytime if you want an extra copy of your data.`,
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Download APK',
            onPress: async () => {
              if (result.downloadUrl) {
                try {
                  await WebBrowser.openBrowserAsync(result.downloadUrl);
                } catch {
                  await Linking.openURL(result.downloadUrl);
                }
              }
            },
          },
        ]
      );
      return true;
    } else if (isManual) {
      Alert.alert(
        'Up to Date ✨',
        `DriveLedger v${currentVersion} is currently the latest version. No update needed!`
      );
      return false;
    }
  } catch (err) {
    if (isManual) {
      Alert.alert(
        'Connection Error',
        `Could not reach GitHub Releases. Please check your internet connection.\n\nCurrent version: v${currentVersion}`,
        [{ text: 'OK' }]
      );
    }
  }

  return false;
}
