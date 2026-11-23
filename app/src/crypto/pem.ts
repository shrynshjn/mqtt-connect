export interface ClassifiedPem {
  kind: 'certificate' | 'privateKey';
  pem: string;
}

/** Splits a multi-PEM blob (e.g. a pasted "here's my whole chain + key" text) into its
 * individual blocks and classifies each by its header. Used by the "Paste PEM text"
 * bulk-import shortcut in ProfileForm. Blocks that are neither a certificate nor a
 * private key (e.g. the "EC PARAMETERS" block `openssl ecparam -genkey` emits) are
 * dropped. */
export function splitAndClassifyPem(text: string): ClassifiedPem[] {
  const blocks =
    text.match(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g) ?? [];
  return blocks.flatMap((pem): ClassifiedPem[] => {
    const header = /-----BEGIN ([A-Z0-9 ]+)-----/.exec(pem)?.[1] ?? '';
    if (header.endsWith('PRIVATE KEY')) return [{ kind: 'privateKey', pem }];
    if (header.endsWith('CERTIFICATE')) return [{ kind: 'certificate', pem }];
    return [];
  });
}
