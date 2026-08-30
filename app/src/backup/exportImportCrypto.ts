import 'react-native-get-random-values';
import * as forge from 'node-forge';
import type { ExportPayload } from './exportImportPayload';

export const BACKUP_FILE_VERSION = 1;
const MAGIC = 'MQTTCONNECT_BACKUP';
// Old backups still decrypt fine regardless of this constant, since decrypt reads the
// iteration count from the file's own envelope — safe to raise/lower over time.
const KDF_ITERATIONS = 100000;
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
  return forge.util
    .createBuffer(crypto.getRandomValues(new Uint8Array(count)))
    .getBytes();
}

const PROGRESS_CHUNK_ITERATIONS = 250;

/** Re-implements PBKDF2-HMAC-SHA256 by hand instead of calling forge.pkcs5.pbkdf2,
 * so the derivation can be chunked with a real, measured progress callback. forge's own
 * async form technically doesn't block either, but it yields the event loop on every
 * single HMAC round — huge per-iteration overhead — and exposes no progress hook;
 * its sync form is one giant blocking call that freezes the JS thread (and the whole
 * UI, including the password prompt and "Encrypting…" state) for the entire derivation.
 * Only handles the single-block case (key size <= hash digest size), which covers this
 * file's 32-byte key against SHA-256's 32-byte digest — see the fallback below. */
function deriveKey(
  password: string,
  saltForgeBytes: string,
  iterations: number,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const md = forge.md.sha256.create();
      const hLen = md.digestLength;
      if (KEY_BYTES > hLen) {
        // Not reachable today — falls back to forge's own multi-block implementation
        // (no progress reporting) if KEY_BYTES ever grows past one SHA-256 block.
        forge.pkcs5.pbkdf2(
          password,
          saltForgeBytes,
          iterations,
          KEY_BYTES,
          forge.md.sha256.create(),
          (err, key) => (err ? reject(err) : resolve(key)),
        );
        return;
      }

      const prf = forge.hmac.create();
      prf.start(md, password);

      // PRF(P, S || INT(1)) — first round, i.e. u_1.
      prf.start(null as unknown as forge.md.Algorithm, null);
      prf.update(saltForgeBytes);
      prf.update(forge.util.int32ToBytes(1));
      let xor = prf.digest().getBytes();
      let prev = xor;

      if (iterations <= 1) {
        resolve(xor.substr(0, KEY_BYTES));
        return;
      }

      let i = 2;
      const step = () => {
        const end = Math.min(i + PROGRESS_CHUNK_ITERATIONS - 1, iterations);
        for (; i <= end; i++) {
          // u_i = PRF(P, u_{i-1}); F(...) accumulates as u_1 XOR u_2 XOR ... XOR u_c.
          prf.start(null as unknown as forge.md.Algorithm, null);
          prf.update(prev);
          const u = prf.digest().getBytes();
          xor = forge.util.xorBytes(xor, u, hLen);
          prev = u;
        }
        onProgress?.(Math.min(1, (i - 1) / iterations));
        if (i <= iterations) {
          setTimeout(step, 0);
        } else {
          resolve(xor.substr(0, KEY_BYTES));
        }
      };
      setTimeout(step, 0);
    } catch (err) {
      reject(err as Error);
    }
  });
}

export async function encryptPayload(
  payload: ExportPayload,
  password: string,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const salt = randomForgeBytes(SALT_BYTES);
  const iv = randomForgeBytes(IV_BYTES);
  const key = await deriveKey(password, salt, KDF_ITERATIONS, onProgress);

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
  onProgress?: (fraction: number) => void,
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
  // Use the iteration count stored in the file, not the current KDF_ITERATIONS constant
  // — otherwise a backup encrypted before a future iteration-count change would fail to
  // decrypt with "Incorrect password" even when the password is right.
  const key = await deriveKey(
    password,
    salt,
    envelope.kdfIterations,
    onProgress,
  );

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
