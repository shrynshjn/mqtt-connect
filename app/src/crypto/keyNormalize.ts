import { Platform } from 'react-native';
import * as forge from 'node-forge';
import type { KeyAlgorithm } from '../types/profile';

export interface ParsedKey {
  forgeKey: forge.pki.rsa.PrivateKey;
  algorithm: KeyAlgorithm;
  keySizeBits: number;
}

function pemHeader(pem: string): string | undefined {
  return /-----BEGIN ([A-Z0-9 ]+)-----/.exec(pem)?.[1];
}

// PrivateKeyInfo (PKCS#8, RFC 5208) ::= SEQUENCE { version, algorithm, privateKey OCTET STRING }
// — the OCTET STRING holds the DER of the inner RSAPrivateKey (PKCS#1). Verified against
// real openssl-generated PKCS#8 keys during development (round-trips + modulus match).
function unwrapPkcs8ToRsaAsn1(pkcs8Asn1: forge.asn1.Asn1): forge.asn1.Asn1 {
  const octetString = (pkcs8Asn1.value as forge.asn1.Asn1[])[2];
  return forge.asn1.fromDer(octetString.value as string);
}

/**
 * Parses a private key PEM in any of the encodings a real mTLS setup hands you:
 * PKCS#1 ("RSA PRIVATE KEY"), unencrypted PKCS#8 ("PRIVATE KEY"), or encrypted PKCS#8
 * ("ENCRYPTED PRIVATE KEY", requires `passphrase`). Only RSA is supported today — the
 * transport (react-native-tcp-socket) has no EC path without an additional patch (see
 * the plan's transport risk section), so EC keys should be rejected loudly upstream of
 * this function with an actionable message rather than failing silently at connect time.
 */
export function parsePrivateKeyPem(
  pem: string,
  passphrase?: string,
): ParsedKey {
  const header = pemHeader(pem);
  if (!header)
    throw new Error('Not a PEM file (missing -----BEGIN----- header)');

  let forgeKey: forge.pki.rsa.PrivateKey;

  if (header === 'RSA PRIVATE KEY') {
    forgeKey = forge.pki.privateKeyFromPem(pem);
  } else if (header === 'PRIVATE KEY') {
    const asn1 = forge.asn1.fromDer(forge.pki.pemToDer(pem));
    forgeKey = forge.pki.privateKeyFromAsn1(unwrapPkcs8ToRsaAsn1(asn1));
  } else if (header === 'ENCRYPTED PRIVATE KEY') {
    if (!passphrase)
      throw new Error('This key is encrypted and needs its passphrase');
    const asn1 = forge.asn1.fromDer(forge.pki.pemToDer(pem));
    const decrypted = forge.pki.decryptPrivateKeyInfo(asn1, passphrase);
    if (!decrypted)
      throw new Error('Wrong passphrase, or the key is corrupted');
    forgeKey = forge.pki.privateKeyFromAsn1(unwrapPkcs8ToRsaAsn1(decrypted));
  } else if (header === 'EC PRIVATE KEY') {
    throw new Error(
      'EC private keys are not supported by the current transport on this platform — re-issue this certificate with an RSA key.',
    );
  } else {
    throw new Error(`Unrecognized private key format: ${header}`);
  }

  return { forgeKey, algorithm: 'RSA', keySizeBits: forgeKey.n.bitLength() };
}

export function toPkcs1Pem(forgeKey: forge.pki.rsa.PrivateKey): string {
  return forge.pki.privateKeyToPem(forgeKey);
}

export function toPkcs8Pem(forgeKey: forge.pki.rsa.PrivateKey): string {
  const rsaAsn1 = forge.pki.privateKeyToAsn1(forgeKey);
  const pkcs8Asn1 = forge.pki.wrapRsaPrivateKey(rsaAsn1);
  return forge.pki.privateKeyInfoToPem(pkcs8Asn1);
}

/**
 * react-native-tcp-socket currently accepts *disjoint* private-key encodings per
 * platform (verified against library source during planning): iOS's SecKey import path
 * wants PKCS#1, Android's KeyFactory("RSA") path wants unencrypted PKCS#8. This is the
 * one place that difference is bridged — call it right before handing a key to the
 * transport, never store its output as the canonical form.
 */
export function emitKeyPemForPlatform(
  forgeKey: forge.pki.rsa.PrivateKey,
): string {
  return Platform.OS === 'ios' ? toPkcs1Pem(forgeKey) : toPkcs8Pem(forgeKey);
}

// Canonical on-disk form: unencrypted PKCS#8. Chosen over PKCS#1 because it round-trips
// through parsePrivateKeyPem for every input we accept, and because "no passphrase to
// juggle at rest" is simpler given the passphrase itself is already Keychain-protected
// via secretRepo — the encryption is on the encrypted MMKV store, not the PEM itself.
export function toCanonicalPem(forgeKey: forge.pki.rsa.PrivateKey): string {
  return toPkcs8Pem(forgeKey);
}
