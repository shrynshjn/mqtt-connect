import * as forge from 'node-forge';
import type { CertMeta } from '../types/profile';
import {
  children,
  fromDer,
  publicKeyInfoFromAsn1,
  type PublicKeyInfo,
} from './asn1Util';

const CERT_PEM_TYPES = [
  'CERTIFICATE',
  'X509 CERTIFICATE',
  'TRUSTED CERTIFICATE',
];
const OID_COMMON_NAME = '2.5.4.3';

export interface ParsedCertificate {
  der: string;
  meta: CertMeta;
  publicKey: PublicKeyInfo;
}

/** First certificate block in a PEM (a CA file may hold a whole chain). */
function firstCertificateDer(pem: string): string {
  let blocks: forge.pem.ObjectPEM[];
  try {
    blocks = forge.pem.decode(pem);
  } catch {
    throw new Error('Not a valid PEM file');
  }
  const block = blocks.find(b => CERT_PEM_TYPES.includes(b.type));
  if (!block) {
    throw new Error(
      'No certificate found (expected a -----BEGIN CERTIFICATE----- block)',
    );
  }
  return block.body;
}

function commonName(name: forge.asn1.Asn1): string | undefined {
  // Exported by forge at runtime but missing from @types/node-forge.
  const pki = forge.pki as unknown as {
    RDNAttributesAsArray(
      rdn: forge.asn1.Asn1,
    ): Array<{ type: string; value: string }>;
  };
  const attrs = pki.RDNAttributesAsArray(name);
  return attrs.find(a => a.type === OID_COMMON_NAME)?.value;
}

function timeToDate(node: forge.asn1.Asn1): Date {
  const value = node.value as string;
  return node.type === forge.asn1.Type.UTCTIME
    ? forge.asn1.utcTimeToDate(value)
    : forge.asn1.generalizedTimeToDate(value);
}

/**
 * Parses an X.509 certificate regardless of its key type. node-forge's
 * certificateFromPem only accepts RSA public keys, which made every ECDSA certificate
 * (CA or client) un-importable — so the fields we need are read straight from the ASN.1.
 */
export function parseCertificatePem(certPem: string): ParsedCertificate {
  const der = firstCertificateDer(certPem);
  let tbs: forge.asn1.Asn1[];
  try {
    tbs = children(children(fromDer(der))[0]);
  } catch {
    throw new Error('Could not parse this certificate (malformed DER)');
  }
  // version is an optional explicit [0] tag in front of the serial number
  const off = tbs[0].tagClass === forge.asn1.Class.CONTEXT_SPECIFIC ? 1 : 0;
  const serial = tbs[off];
  const issuer = tbs[off + 2];
  const validity = children(tbs[off + 3]);
  const subject = tbs[off + 4];
  const spki = tbs[off + 5];

  const md = forge.md.sha256.create();
  md.update(der);
  const sha256Fingerprint = md
    .digest()
    .toHex()
    .match(/.{2}/g)!
    .join(':')
    .toUpperCase();

  return {
    der,
    meta: {
      subjectCn: commonName(subject),
      issuerCn: commonName(issuer),
      notBefore: timeToDate(validity[0]).toISOString(),
      notAfter: timeToDate(validity[1]).toISOString(),
      serialNumber: forge.util.bytesToHex(serial.value as string),
      sha256Fingerprint,
    },
    publicKey: publicKeyInfoFromAsn1(spki),
  };
}

export function certMetaFromPem(certPem: string): CertMeta {
  return parseCertificatePem(certPem).meta;
}

export function daysUntilExpiry(notAfterIso: string): number {
  return Math.ceil(
    (new Date(notAfterIso).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
}
