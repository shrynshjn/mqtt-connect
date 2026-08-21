import * as forge from 'node-forge';
import { toCanonicalPem, type ParsedKey } from './keyNormalize';

export interface UnwrappedBundle {
  certPem: string;
  chainPems: string[];
  keyPem: string; // canonical PKCS#8, via toCanonicalPem
  keySizeBits: number;
}

/**
 * Unwraps a .p12/.pfx bundle into the same shape as three separately-imported PEM
 * files, so ProfileForm's "Import .p12 bundle" and the three-slot manual import share
 * one downstream path. `base64Contents` is the file read as base64 by the document
 * picker (binary file — never treat as text).
 */
export function unwrapPkcs12(base64Contents: string, password: string): UnwrappedBundle {
  const der = forge.util.decode64(base64Contents);
  const asn1 = forge.asn1.fromDer(der);

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  } catch {
    throw new Error('Could not open this .p12 bundle — check the password.');
  }

  let cert: forge.pki.Certificate | undefined;
  const chain: forge.pki.Certificate[] = [];
  let key: ParsedKey['forgeKey'] | undefined;

  for (const safeContents of p12.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
        if (!cert) cert = safeBag.cert;
        else chain.push(safeBag.cert);
      } else if (
        (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag || safeBag.type === forge.pki.oids.keyBag) &&
        safeBag.key
      ) {
        key = safeBag.key as ParsedKey['forgeKey'];
      }
    }
  }

  if (!cert) throw new Error('No client certificate found in this bundle.');
  if (!key) throw new Error('No private key found in this bundle.');

  return {
    certPem: forge.pki.certificateToPem(cert),
    chainPems: chain.map(c => forge.pki.certificateToPem(c)),
    keyPem: toCanonicalPem(key),
    keySizeBits: key.n.bitLength(),
  };
}
