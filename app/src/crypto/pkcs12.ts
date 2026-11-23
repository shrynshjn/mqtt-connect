import * as forge from 'node-forge';
import type { KeyAlgorithm } from '../types/profile';
import {
  keyMatchesCertificate,
  parsePrivateKeyInfoAsn1,
  toCanonicalPem,
  type ParsedKey,
} from './keyNormalize';

export interface UnwrappedBundle {
  certPem: string;
  chainPems: string[];
  keyPem: string; // canonical PKCS#8, via toCanonicalPem
  keyAlgorithm: KeyAlgorithm;
  keySizeBits: number;
}

function bagCertPem(bag: forge.pkcs12.Bag): string | undefined {
  if (bag.cert) return forge.pki.certificateToPem(bag.cert);
  // forge leaves non-RSA (e.g. ECDSA) certificates undecoded, as raw ASN.1
  const raw = (bag as { asn1?: forge.asn1.Asn1 }).asn1;
  if (!raw) return undefined;
  return forge.pem.encode(
    { type: 'CERTIFICATE', body: forge.asn1.toDer(raw).getBytes() },
    { maxline: 64 },
  );
}

function bagKey(bag: forge.pkcs12.Bag): ParsedKey | undefined {
  if (bag.key) {
    const rsa = bag.key as forge.pki.rsa.PrivateKey;
    return { algorithm: 'RSA', forgeKey: rsa, keySizeBits: rsa.n.bitLength() };
  }
  // forge leaves non-RSA (e.g. EC) keys undecoded, as a raw PrivateKeyInfo
  const raw = (bag as { asn1?: forge.asn1.Asn1 }).asn1;
  return raw ? parsePrivateKeyInfoAsn1(raw) : undefined;
}

/**
 * Unwraps a .p12/.pfx bundle into the same shape as three separately-imported PEM
 * files, so ProfileForm's "Import .p12 bundle" and the three-slot manual import share
 * one downstream path. `base64Contents` is the file read as base64 by the document
 * picker (binary file — never treat as text). Handles both RSA and EC keys/certificates.
 */
export function unwrapPkcs12(
  base64Contents: string,
  password: string,
): UnwrappedBundle {
  const der = forge.util.decode64(base64Contents);
  const asn1 = forge.asn1.fromDer(der);

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  } catch {
    throw new Error('Could not open this .p12 bundle — check the password.');
  }

  const certs: string[] = [];
  let key: ParsedKey | undefined;

  for (const safeContents of p12.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (safeBag.type === forge.pki.oids.certBag) {
        const pem = bagCertPem(safeBag);
        if (pem) certs.push(pem);
      } else if (
        safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag ||
        safeBag.type === forge.pki.oids.keyBag
      ) {
        key = bagKey(safeBag) ?? key;
      }
    }
  }

  if (certs.length === 0)
    throw new Error('No client certificate found in this bundle.');
  if (!key) throw new Error('No private key found in this bundle.');

  // The leaf is the certificate whose public key matches the private key; fall back to
  // the first one when that can't be determined.
  const k = key;
  const leafIndex = Math.max(
    0,
    certs.findIndex(c => keyMatchesCertificate(k, c) === true),
  );
  const [certPem] = certs.splice(leafIndex, 1);

  return {
    certPem,
    chainPems: certs,
    keyPem: toCanonicalPem(key),
    keyAlgorithm: key.algorithm,
    keySizeBits: key.keySizeBits,
  };
}
