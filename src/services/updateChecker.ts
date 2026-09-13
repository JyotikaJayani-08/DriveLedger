import {
  GITHUB_REPO,
  GitHubRelease,
  parseGitHubRelease,
} from '@/utils/releaseParser';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking } from 'react-native';

export { GITHUB_REPO, GitHubRelease, parseGitHubRelease };

/**
 * Displays the 2 golden rules of data safety when updating APKs.
 */
export function showDataSafetyGuide() {
  Alert.alert(
    '🛡️ Update & Data Safety Guide',
    `1. NEVER UNINSTALL BEFORE UPDATING\n` +
    `• DO NOT delete your current app.\n` +
    `• Open the downloaded APK and tap "Update".\n` +
    `• Android preserves all offline vehicle logs, fuel records, and history automatically.\n\n` +

    `2. BACK UP YOUR DATA\n` +
    `• DriveLedger is 100% offline—data lives only on your device.\n` +
    `• Go to Settings > "Export Backup" to save a JSON copy to Google Drive or Files.\n\n` +

    `3. USE OFFICIAL BUILDS ONLY\n` +
    `• Install only from official GitHub Releases.\n` +
    `• Third-party builds will fail to install due to signature mismatches and can risk data loss.`,
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
  const currentVersion = Constants.expoConfig?.version || '1.0.1';

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
          `No public releases found on GitHub for DriveLedger.\n\nCurrent version: v${currentVersion}`
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
