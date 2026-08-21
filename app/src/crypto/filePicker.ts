import { pick, keepLocalCopy, types } from '@react-native-documents/picker';
import { readFile } from '@dr.pogodin/react-native-fs';

export interface PickedFile {
  name: string;
  content: string; // decoded per `encoding`
}

/**
 * Certs/keys/bundles rarely have a reliably-registered MIME type across iOS/Android, so
 * this deliberately allows any file rather than filtering by type — the crypto layer
 * (pem.ts / pkcs12.ts) validates the actual content and reports a clear error if it
 * isn't what was expected, which is more robust than guessing MIME types up front.
 */
export async function pickAndReadFile(
  encoding: 'utf8' | 'base64',
): Promise<PickedFile | null> {
  const results = await pick({
    type: [types.allFiles],
    allowMultiSelection: false,
  });
  const picked = results[0];
  if (!picked) return null;

  const name = picked.name ?? 'file';
  const [copy] = await keepLocalCopy({
    files: [{ uri: picked.uri, fileName: name }],
    destination: 'cachesDirectory',
  });
  if (copy.status === 'error')
    throw new Error(`Could not read "${name}": ${copy.copyError}`);

  const content = await readFile(copy.localUri, encoding);
  return { name, content };
}
