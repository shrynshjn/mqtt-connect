import { Platform } from 'react-native';

const PRIVACY_POLICY_BASE = 'https://shrynshjn.com/mqtt-connect/privacy.html';
const TERMS_BASE = 'https://shrynshjn.com/mqtt-connect/terms.html';
const DEVELOPER_SITE_BASE = 'https://shrynshjn.com/';
// Apple's `apps.apple.com` product-page URLs do NOT support generic utm_* query params
// for attribution — Apple has its own separate "Campaign Links" system (App Store
// Connect → App Analytics → Create Campaign Link) that mints a URL carrying a pt/ct/mt
// provider/campaign token. Until that's set up, the utm_* params appended below are
// inert on Apple's side — kept only for our own log-reading consistency. Swap this
// constant for a real Campaign Link URL to make iOS-side tracking actually work.
const APP_STORE_BASE =
  'https://apps.apple.com/app/mqtt-connect-secure/id6803739526';
// Play, unlike Apple, genuinely supports a `referrer` query param carrying a
// URL-encoded UTM string — Play Console's acquisition reports and Google Analytics for
// Firebase both read it natively (see storeListingUrl() below).
const PLAY_STORE_BASE =
  'https://play.google.com/store/apps/details?id=com.shrynshjn.secure.mqtt.connect';

export const FEEDBACK_EMAIL = 'shreyansh@shrynshjn.com';

const PLATFORM_SOURCE = Platform.OS === 'ios' ? 'ios_app' : 'android_app';

// Plain string-concat query building — deliberately not the URL/URLSearchParams APIs,
// since Hermes's support for those isn't guaranteed without a polyfill this app doesn't
// carry (see react-native-get-random-values, used the same way for crypto.getRandomValues).
function appendUtm(baseUrl: string, params: Record<string, string>): string {
  const query = Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join('&');
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}${query}`;
}

function utmParams(content: string): Record<string, string> {
  return {
    utm_source: PLATFORM_SOURCE,
    utm_medium: 'app',
    utm_campaign: 'settings_screen',
    utm_content: content,
  };
}

export function privacyPolicyUrl(): string {
  return appendUtm(PRIVACY_POLICY_BASE, utmParams('privacy_policy'));
}

export function termsUrl(): string {
  return appendUtm(TERMS_BASE, utmParams('terms_of_use'));
}

export function developerSiteUrl(): string {
  return appendUtm(DEVELOPER_SITE_BASE, utmParams('developer_site'));
}

// Platform-aware: App Store on iOS (UTM params inert on Apple's side, see note above),
// Play Store on Android with a real, functional `referrer` UTM string.
export function storeListingUrl(): string {
  if (Platform.OS === 'ios') {
    return appendUtm(APP_STORE_BASE, utmParams('rate_prompt'));
  }
  const referrer = Object.entries({
    utm_source: PLATFORM_SOURCE,
    utm_medium: 'app',
    utm_campaign: 'rate_prompt',
  })
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return `${PLAY_STORE_BASE}&referrer=${encodeURIComponent(referrer)}`;
}
