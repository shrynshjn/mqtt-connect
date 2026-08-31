import { AppState, Linking } from 'react-native';
import InAppReview from 'react-native-in-app-review';
import { storeListingUrl } from '../config/appLinks';
import { getPrefs, setPrefs } from '../storage/prefsRepo';

export const MAX_PROACTIVE_PROMPTS = 2;
export const COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

/** Opens the real App Store/Play Store listing page — used only by the manual "Rate
 * MQTT Connect" row. Deliberately not the native review API: that sheet is silently a
 * no-op once the OS's own quota is exhausted (or, on Android, outside an
 * internal-testing/production install), so a user who explicitly asked to rate the app
 * needs a path that's guaranteed to get them somewhere they can actually leave one. No
 * throttling — an explicit navigation + tap is already opt-in. */
export function openStoreListing(): void {
  try {
    Linking.openURL(storeListingUrl());
  } catch (err) {
    console.warn('openStoreListing failed:', err);
  }
}

function requestNativeReview(): void {
  try {
    if (!InAppReview.isAvailable()) return;
    InAppReview.RequestInAppReview().catch((err: unknown) =>
      console.warn('RequestInAppReview failed:', err),
    );
  } catch (err) {
    console.warn('requestNativeReview failed:', err);
  }
}

type Milestone = 'firstConnect' | 'firstSnippetPin';

const MILESTONE_PREF_KEY: Record<
  Milestone,
  'reviewMilestoneFirstConnectFired' | 'reviewMilestoneFirstSnippetPinFired'
> = {
  firstConnect: 'reviewMilestoneFirstConnectFired',
  firstSnippetPin: 'reviewMilestoneFirstSnippetPinFired',
};

/** The only place the native in-app review sheet is invoked — reserved for proactive
 * "happy moment" nudges (a first successful connection, a first pinned snippet), never
 * for the manual row. Each milestone can only ever fire once (it genuinely can only
 * happen once), and the two milestones share one global proactive-prompt budget rather
 * than each getting their own — the constraint that matters is "how often does this
 * user see a review sheet from us at all," not per-milestone frequency. */
export function notifyMilestone(milestone: Milestone): void {
  try {
    const prefs = getPrefs();
    const milestoneKey = MILESTONE_PREF_KEY[milestone];
    if (prefs[milestoneKey]) return;

    // Consumed regardless of what happens next — a one-shot milestone left unconsumed
    // has no benefit and risks re-firing once eligibility reopens later.
    setPrefs({ [milestoneKey]: true });

    if (prefs.reviewProactivePromptCount >= MAX_PROACTIVE_PROMPTS) return;
    if (
      prefs.reviewProactiveLastPromptedAt != null &&
      Date.now() - prefs.reviewProactiveLastPromptedAt < COOLDOWN_MS
    ) {
      return;
    }
    if (AppState.currentState !== 'active') return;

    setPrefs({
      reviewProactivePromptCount: prefs.reviewProactivePromptCount + 1,
      reviewProactiveLastPromptedAt: Date.now(),
    });
    requestNativeReview();
  } catch (err) {
    console.warn(`notifyMilestone(${milestone}) failed:`, err);
  }
}
