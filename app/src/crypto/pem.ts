export interface ClassifiedPem {
  kind: 'certificate' | 'privateKey';
  pem: string;
}

/** Splits a multi-PEM blob (e.g. a pasted "here's my whole chain + key" text) into its
 * individual blocks and classifies each by its header. Used by the "Paste PEM text"
 * bulk-import shortcut in ProfileForm. */
export function splitAndClassifyPem(text: string): ClassifiedPem[] {
  const blocks = text.match(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g) ?? [];
  return blocks.map(pem => {
    const header = /-----BEGIN ([A-Z0-9 ]+)-----/.exec(pem)?.[1] ?? '';
    const kind: ClassifiedPem['kind'] = header.includes('PRIVATE KEY') ? 'privateKey' : 'certificate';
    return { kind, pem };
  });
}
