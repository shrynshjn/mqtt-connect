import 'react-native-get-random-values';
import * as forge from 'node-forge';
import { p256 } from '@noble/curves/p256';
import {
  mapHashToField,
  getMinHashLength,
} from '@noble/curves/abstract/modular';
import { OID_EC_PUBLIC_KEY, curveByName } from './asn1Util';
import { toCanonicalPem, type EcParsedKey } from './keyNormalize';

// On-device EC P-256 key generation and PKCS#10 certificate signing request (CSR)
// building. node-forge can parse EC keys (see keyNormalize.ts) but can't generate or
// sign with them, so the curve maths comes from @noble/curves and the ASN.1 is built
// here with forge's encoder. The private key never leaves the device — only the CSR
// (public key + subject) is sent to a signer.

const { asn1 } = forge;
const OID_ECDSA_WITH_SHA256 = '1.2.840.10045.4.3.2';
const OID_COUNTRY = '2.5.4.6';
const OID_ORGANIZATION = '2.5.4.10';
const OID_COMMON_NAME = '2.5.4.3';

export interface CsrSubject {
  country: string; // two-letter ISO code
  organization: string;
  commonName: string;
}

export interface GeneratedEcIdentity {
  key: EcParsedKey;
  keyPem: string; // canonical PKCS#8, as stored by secretRepo
  csrPem: string;
}

const bytesToBinary = (b: Uint8Array): string => String.fromCharCode(...b);
const binaryToBytes = (s: string): Uint8Array =>
  Uint8Array.from(s, c => c.charCodeAt(0));

function oid(o: string): forge.asn1.Asn1 {
  return asn1.create(
    asn1.Class.UNIVERSAL,
    asn1.Type.OID,
    false,
    asn1.oidToDer(o).getBytes(),
  );
}

function seq(items: forge.asn1.Asn1[]): forge.asn1.Asn1 {
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, items);
}

function rdn(
  typeOid: string,
  stringType: number,
  value: string,
): forge.asn1.Asn1 {
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
    seq([
      oid(typeOid),
      asn1.create(asn1.Class.UNIVERSAL, stringType, false, value),
    ]),
  ]);
}

function nameAsn1(subject: CsrSubject): forge.asn1.Asn1 {
  if (!/^[A-Z]{2}$/.test(subject.country)) {
    throw new Error('CSR country must be a two-letter code');
  }
  return seq([
    rdn(OID_COUNTRY, asn1.Type.PRINTABLESTRING, subject.country),
    rdn(
      OID_ORGANIZATION,
      asn1.Type.UTF8,
      forge.util.encodeUtf8(subject.organization),
    ),
    rdn(
      OID_COMMON_NAME,
      asn1.Type.UTF8,
      forge.util.encodeUtf8(subject.commonName),
    ),
  ]);
}

function p256SpkiAsn1(publicPoint: string): forge.asn1.Asn1 {
  return seq([
    seq([oid(OID_EC_PUBLIC_KEY), oid(curveByName('P-256').oid)]),
    asn1.create(
      asn1.Class.UNIVERSAL,
      asn1.Type.BITSTRING,
      false,
      '\x00' + publicPoint,
    ),
  ]);
}

/** A fresh P-256 private scalar from the platform CSPRNG (FIPS 186-5 A.4.1-style:
 * hash-length+64 bits of entropy reduced mod n, so there's no modulo bias). */
function randomP256Scalar(): Uint8Array {
  const n = p256.CURVE.n;
  const seed = new Uint8Array(getMinHashLength(n));
  crypto.getRandomValues(seed);
  return mapHashToField(seed, n);
}

/** Generates a P-256 key pair and a CSR for it, self-signed with ECDSA-SHA256 as
 * PKCS#10 requires (proof of possession). */
export function generateEcP256Identity(
  subject: CsrSubject,
): GeneratedEcIdentity {
  const d = randomP256Scalar();
  const point = p256.getPublicKey(d, false); // uncompressed 0x04||X||Y

  const info = seq([
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, '\x00'),
    nameAsn1(subject),
    p256SpkiAsn1(bytesToBinary(point)),
    asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, []), // no attributes
  ]);
  const infoDer = asn1.toDer(info).getBytes();

  const digest = forge.md.sha256.create().update(infoDer).digest().getBytes();
  const sig = p256.sign(binaryToBytes(digest), d).toDERRawBytes();

  const csr = seq([
    info,
    seq([oid(OID_ECDSA_WITH_SHA256)]),
    asn1.create(
      asn1.Class.UNIVERSAL,
      asn1.Type.BITSTRING,
      false,
      '\x00' + bytesToBinary(sig),
    ),
  ]);
  const csrPem = forge.pem.encode(
    { type: 'CERTIFICATE REQUEST', body: asn1.toDer(csr).getBytes() },
    { maxline: 64 },
  );

  const key: EcParsedKey = {
    algorithm: 'EC',
    curve: 'P-256',
    d: bytesToBinary(d),
    publicPoint: bytesToBinary(point),
    keySizeBits: 256,
  };
  return { key, keyPem: toCanonicalPem(key), csrPem };
}
