import { Platform } from 'react-native';
import { FEEDBACK_EMAIL } from '../../config/appLinks';

export type FeedbackType = 'Bug' | 'Idea' | 'Question' | 'Other';

export function buildFeedbackMailto(args: {
  type: FeedbackType;
  message: string;
  versionString: string;
}): string {
  const subject = `MQTT Connect feedback — ${args.type}`;
  const body = [
    args.message.trim(),
    '',
    '—',
    `App: MQTT Connect ${args.versionString}`,
    `Platform: ${Platform.OS} ${Platform.Version}`,
  ].join('\n');

  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}
