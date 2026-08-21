// iOS's "Smart Punctuation" keyboard feature silently rewrites straight quotes/dashes
// into their typographic equivalents as you type — invisible in a UI font, but it turns
// `{"deviceId": "H310000"}` into a string JSON.parse rejects (curly quotes aren't valid
// JSON string delimiters). React Native's TextInput has no direct prop to disable just
// smart-quotes (autoCorrect/spellCheck don't reliably cover it), so any field where the
// user types code-like text (JSON, topics) sanitizes on every keystroke instead.
const REPLACEMENTS: Record<string, string> = {
  '“': '"',
  '”': '"',
  '‘': "'",
  '’': "'",
  '–': '-',
  '—': '-',
};
const PATTERN = /[‘’“”–—]/g;

export function stripSmartPunctuation(text: string): string {
  return text.replace(PATTERN, ch => REPLACEMENTS[ch] ?? ch);
}
