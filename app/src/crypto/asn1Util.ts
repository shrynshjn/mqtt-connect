import * as forge from 'node-forge';

// Small ASN.1 helpers shared by the key and certificate parsers. node-forge's high-level
// pki API only understands RSA (certificateFromPem / privateKeyFromAsn1 throw on anything
// else), so anything that must also handle EC keys and ECDSA certificates walks the raw
// ASN.1 tree with these instead.

export const OID_RSA_ENCRYPTION = '1.2.840.113549.1.1.1';
export const OID_EC_PUBLIC_KEY = '1.2.840.10045.2.1';

export type EcCurve = 'P-256' | 'P-384' | 'P-521';

export interface EcCurveInfo {
  name: EcCurve;
  oid: string;
  bits: number;
  byteLength: number; // length of one field element / the private scalar
}

// The NIST curves that both TLS stacks we hand keys to (Android's JCA/Conscrypt and
// Apple's Security framework via kSecAttrKeyTypeECSECPrimeRandom) support for client auth.
export const EC_CURVES: EcCurveInfo[] = [
  { name: 'P-256', oid: '1.2.840.10045.3.1.7', bits: 256, byteLength: 32 },
  { name: 'P-384', oid: '1.3.132.0.34', bits: 384, byteLength: 48 },
  { name: 'P-521', oid: '1.3.132.0.35', bits: 521, byteLength: 66 },
];

const KNOWN_KEY_OIDS: Record<string, string> = {
  '1.3.101.112': 'Ed25519',
  '1.3.101.113': 'Ed448',
  '1.3.101.110': 'X25519',
  '1.2.840.10040.4.1': 'DSA',
  '1.2.840.113549.1.1.10': 'RSA-PSS',
  '1.3.132.0.10': 'secp256k1',
};

export function describeOid(oid: string): string {
  return KNOWN_KEY_OIDS[oid] ?? oid;
}

export function curveByOid(oid: string): EcCurveInfo {
  const curve = EC_CURVES.find(c => c.oid === oid);
  if (!curve) {
    throw new Error(
      `Unsupported elliptic curve (${describeOid(
        oid,
      )}) — only P-256, P-384 and P-521 are supported for TLS.`,
    );
  }
  return curve;
}

export function curveByName(name: EcCurve): EcCurveInfo {
  return EC_CURVES.find(c => c.name === name)!;
}

export function fromDer(bytes: string): forge.asn1.Asn1 {
  // decodeBitStrings:false keeps BIT STRING contents (e.g. an EC public point, which
  // starts with 0x04 — the OCTET STRING tag) as raw bytes instead of letting forge guess
  // they're nested ASN.1.
  return forge.asn1.fromDer(bytes, { decodeBitStrings: false } as never);
}

/** Re-parses a node forge already decoded with its defaults (e.g. from a .p12 or an
 * encrypted PKCS#8), so it follows the same BIT STRING handling as fromDer above. */
export function reparse(node: forge.asn1.Asn1): forge.asn1.Asn1 {
  return fromDer(forge.asn1.toDer(node).getBytes());
}

export function children(node: forge.asn1.Asn1): forge.asn1.Asn1[] {
  if (!Array.isArray(node.value)) {
    throw new Error('Malformed ASN.1: expected a constructed value');
  }
  return node.value as forge.asn1.Asn1[];
}

export function oidOf(node: forge.asn1.Asn1): string {
  if (node.type !== forge.asn1.Type.OID) {
    throw new Error('Malformed ASN.1: expected an OBJECT IDENTIFIER');
  }
  return forge.asn1.derToOid(node.value as string);
}

/** BIT STRING contents without the leading "unused bits" byte. */
export function bitStringBytes(node: forge.asn1.Asn1): string {
  const raw =
    (node as unknown as { bitStringContents?: string }).bitStringContents ??
    (typeof node.value === 'string'
      ? node.value
      : forge.asn1.toDer(node).getBytes().slice(2)); // unreachable with fromDer above
  return raw.slice(1);
}

export function contextTag(
  node: forge.asn1.Asn1,
  tag: number,
): forge.asn1.Asn1 | undefined {
  return children(node).find(
    c => c.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && c.type === tag,
  );
}

/** Left-pads (or strips leading zero bytes from) a big-endian integer to `length`. */
export function fixedLength(bytes: string, length: number): string {
  let b = bytes;
  while (b.length > length && b.charCodeAt(0) === 0) b = b.slice(1);
  if (b.length > length) throw new Error('Integer is too large for this curve');
  return '\0'.repeat(length - b.length) + b;
}

export type PublicKeyInfo =
  | { algorithm: 'RSA'; modulusHex: string; bits: number }
  | { algorithm: 'EC'; curve: EcCurve; point: string }
  | { algorithm: 'other'; oid: string };

/** Reads a SubjectPublicKeyInfo — RSA modulus or EC curve + uncompressed point. */
export function publicKeyInfoFromAsn1(spki: forge.asn1.Asn1): PublicKeyInfo {
  const [algId, keyBits] = children(spki);
  const algChildren = children(algId);
  const oid = oidOf(algChildren[0]);
  if (oid === OID_RSA_ENCRYPTION) {
    const rsa = fromDer(bitStringBytes(keyBits));
    const modulus = children(rsa)[0].value as string;
    const n = new forge.jsbn.BigInteger(forge.util.bytesToHex(modulus), 16);
    return {
      algorithm: 'RSA',
      modulusHex: n.toString(16),
      bits: n.bitLength(),
    };
  }
  if (oid === OID_EC_PUBLIC_KEY) {
    const curve = curveByOid(oidOf(algChildren[1]));
    return {
      algorithm: 'EC',
      curve: curve.name,
      point: bitStringBytes(keyBits),
    };
  }
  return { algorithm: 'other', oid };
}
