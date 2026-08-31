import { getBuildNumber, getVersion } from 'react-native-device-info';

// Single source of truth for the app's displayed version — reads the real native build
// metadata (MARKETING_VERSION/CURRENT_PROJECT_VERSION on iOS, versionName/versionCode on
// Android) instead of a hand-maintained literal, which has already drifted out of sync
// with the real shipped build twice in one release cycle.
export function getAppVersionString(): string {
  return `${getVersion()} (${getBuildNumber()})`;
}
