import 'react-native-get-random-values';
import * as forge from 'node-forge';
import type { ExportPayload } from './exportImportPayload';

export const BACKUP_FILE_VERSION = 1;
const MAGIC = 'MQTTCONNECT_BACKUP';
const KDF_ITERATIONS = 150000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const TAG_LENGTH_BITS = 128;

interface BackupEnvelope {
  magic: typeof MAGIC;
  version: number;
  kdf: 'PBKDF2-HMAC-SHA256';
  kdfIterations: number;
  saltB64: string;
  cipher: 'AES-256-GCM';
  ivB64: string;
  tagLengthBits: typeof TAG_LENGTH_BITS;
  ciphertextB64: string;
  tagB64: string;
}

/** Thrown only when the AES-GCM auth tag fails to verify — i.e. the wrong password was
 * used (or the file was tampered with). Any other failure (bad JSON, unrecognized
 * envelope, future version) throws a plain `Error` instead, so callers can show "wrong
 * password, try again" only for this specific case rather than for every failure mode. */
export class BackupDecryptError extends Error {}

function randomForgeBytes(count: number): string {
  return forge.util.createBuffer(
    crypto.getRandomValues(new Uint8Array(count)),
  ).getBytes();
}

function deriveKey(password: string, saltForgeBytes: string): string {
  return forge.pkcs5.pbkdf2(
    password,
    saltForgeBytes,
    KDF_ITERATIONS,
    KEY_BYTES,
    forge.md.sha256.create(),
  );
}

export async function encryptPayload(
  payload: ExportPayload,
  password: string,
): Promise<string> {
  const salt = randomForgeBytes(SALT_BYTES);
  const iv = randomForgeBytes(IV_BYTES);
  const key = deriveKey(password, salt);

  const cipher = forge.cipher.createCipher('AES-GCM', key);
  cipher.start({ iv, tagLength: TAG_LENGTH_BITS });
  cipher.update(forge.util.createBuffer(JSON.stringify(payload), 'utf8'));
  cipher.finish();

  const envelope: BackupEnvelope = {
    magic: MAGIC,
    version: BACKUP_FILE_VERSION,
    kdf: 'PBKDF2-HMAC-SHA256',
    kdfIterations: KDF_ITERATIONS,
    saltB64: forge.util.encode64(salt),
    cipher: 'AES-256-GCM',
    ivB64: forge.util.encode64(iv),
    tagLengthBits: TAG_LENGTH_BITS,
    ciphertextB64: forge.util.encode64(cipher.output.getBytes()),
    tagB64: forge.util.encode64(cipher.mode.tag.getBytes()),
  };
  return JSON.stringify(envelope);
}

export async function decryptPayload(
  fileContents: string,
  password: string,
): Promise<ExportPayload> {
  let envelope: BackupEnvelope;
  try {
    envelope = JSON.parse(fileContents) as BackupEnvelope;
  } catch {
    throw new Error('This file is not a valid MQTT Connect backup.');
  }
  if (envelope?.magic !== MAGIC) {
    throw new Error('This file is not a valid MQTT Connect backup.');
  }
  if (envelope.version > BACKUP_FILE_VERSION) {
    throw new Error(
      'This backup was created by a newer version of the app — update the app to import it.',
    );
  }

  const salt = forge.util.decode64(envelope.saltB64);
  const iv = forge.util.decode64(envelope.ivB64);
  const tag = forge.util.decode64(envelope.tagB64);
  const ciphertext = forge.util.decode64(envelope.ciphertextB64);
  const key = deriveKey(password, salt);

  const decipher = forge.cipher.createDecipher('AES-GCM', key);
  decipher.start({
    iv,
    tagLength: envelope.tagLengthBits,
    tag: forge.util.createBuffer(tag),
  });
  decipher.update(forge.util.createBuffer(ciphertext));
  const ok = decipher.finish();
  if (!ok) {
    throw new BackupDecryptError('Incorrect password.');
  }

  try {
    // forge's ByteStringBuffer.toString() always UTF-8 decodes — it takes no encoding arg.
    return JSON.parse(decipher.output.toString()) as ExportPayload;
  } catch {
    throw new Error('This backup is corrupted.');
  }
}
