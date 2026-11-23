import { Platform } from 'react-native';
import * as forge from 'node-forge';
import type { KeyAlgorithm } from '../types/profile';
import {
  OID_EC_PUBLIC_KEY,
  OID_RSA_ENCRYPTION,
  bitStringBytes,
  children,
  contextTag,
  curveByName,
  curveByOid,
  describeOid,
  fixedLength,
  fromDer,
  oidOf,
  reparse,
  type EcCurve,
} from './asn1Util';
import { parseCertificatePem } from './certInfo';

export interface RsaParsedKey {
  algorithm: 'RSA';
  forgeKey: forge.pki.rsa.PrivateKey;
  keySizeBits: number;
}

export interface EcParsedKey {
  algorithm: 'EC';
  curve: EcCurve;
  d: string; // private scalar, binary string, left-padded to the curve's byte length
  publicPoint?: string; // uncompressed 0x04||X||Y, when the key file carries it
  keySizeBits: number;
}

export type ParsedKey = RsaParsedKey | EcParsedKey;

// ── parsing ────────────────────────────────────────────────────────────────────────────

function rsaFromForge(forgeKey: forge.pki.rsa.PrivateKey): RsaParsedKey {
  return { algorithm: 'RSA', forgeKey, keySizeBits: forgeKey.n.bitLength() };
}

/** ECPrivateKey (SEC1 / RFC 5915). `paramsCurveOid` comes from the PKCS#8 wrapper, if
 * any; a bare SEC1 key names its curve in the optional [0] parameters field instead. */
function ecFromSec1(
  ecAsn1: forge.asn1.Asn1,
  paramsCurveOid?: string,
): EcParsedKey {
  const fields = children(ecAsn1);
  const dRaw = fields[1]?.value;
  if (typeof dRaw !== 'string') {
    throw new Error('Malformed EC private key');
  }
  const params = contextTag(ecAsn1, 0);
  const curveOid =
    paramsCurveOid ?? (params ? oidOf(children(params)[0]) : undefined);
  if (!curveOid) {
    throw new Error('EC private key does not say which curve it uses');
  }
  const curve = curveByOid(curveOid);
  const pub = contextTag(ecAsn1, 1);
  const publicPoint = pub ? bitStringBytes(children(pub)[0]) : undefined;
  if (publicPoint && publicPoint.charCodeAt(0) !== 0x04) {
    throw new Error(
      'Compressed EC public keys are not supported — re-export the key with an uncompressed public point.',
    );
  }
  return {
    algorithm: 'EC',
    curve: curve.name,
    d: fixedLength(dRaw, curve.byteLength),
    publicPoint,
    keySizeBits: curve.bits,
  };
}

/** PrivateKeyInfo (PKCS#8, RFC 5208) ::= SEQUENCE { version, algorithm, privateKey OCTET
 * STRING } — dispatched on the algorithm OID so both RSA and EC keys go through. */
function fromPrivateKeyInfo(pkcs8: forge.asn1.Asn1): ParsedKey {
  const [, algId, privateKey] = children(pkcs8);
  const algChildren = children(algId);
  const oid = oidOf(algChildren[0]);
  const inner = fromDer(privateKey.value as string);
  if (oid === OID_RSA_ENCRYPTION) {
    return rsaFromForge(forge.pki.privateKeyFromAsn1(inner));
  }
  if (oid === OID_EC_PUBLIC_KEY) {
    return ecFromSec1(inner, oidOf(algChildren[1]));
  }
  throw new Error(
    `Unsupported private key type (${describeOid(
      oid,
    )}) — only RSA and EC (P-256, P-384, P-521) keys are supported.`,
  );
}

/** Same as fromPrivateKeyInfo, for a node forge decoded itself (.p12 bag, decrypted
 * PKCS#8). */
export function parsePrivateKeyInfoAsn1(node: forge.asn1.Asn1): ParsedKey {
  return fromPrivateKeyInfo(reparse(node));
}

/**
 * Parses a private key PEM in any of the encodings a real mTLS setup hands you:
 * PKCS#1 ("RSA PRIVATE KEY"), SEC1 ("EC PRIVATE KEY", optionally preceded by an
 * "EC PARAMETERS" block as `openssl ecparam -genkey` writes it), unencrypted PKCS#8
 * ("PRIVATE KEY") or encrypted PKCS#8 ("ENCRYPTED PRIVATE KEY", requires `passphrase`).
 * RSA and EC keys on P-256 / P-384 / P-521 are supported.
 */
export function parsePrivateKeyPem(
  pem: string,
  passphrase?: string,
): ParsedKey {
  let blocks: forge.pem.ObjectPEM[];
  try {
    blocks = forge.pem.decode(pem);
  } catch {
    throw new Error('Not a valid PEM file');
  }
  if (blocks.length === 0)
    throw new Error('Not a PEM file (missing -----BEGIN----- header)');

  const block = blocks.find(b => b.type.endsWith('PRIVATE KEY'));
  if (!block) {
    throw new Error(
      `No private key found in this file (found: ${blocks
        .map(b => b.type)
        .join(', ')})`,
    );
  }
  if (block.procType?.type === 'ENCRYPTED') {
    throw new Error(
      'This key uses legacy OpenSSL encryption, which is not supported — convert it with `openssl pkcs8 -topk8 -in key.pem -out key-pkcs8.pem` and import that.',
    );
  }

  try {
    switch (block.type) {
      case 'RSA PRIVATE KEY':
        return rsaFromForge(forge.pki.privateKeyFromAsn1(fromDer(block.body)));
      case 'EC PRIVATE KEY':
        return ecFromSec1(fromDer(block.body));
      case 'PRIVATE KEY':
        return fromPrivateKeyInfo(fromDer(block.body));
      case 'ENCRYPTED PRIVATE KEY': {
        if (!passphrase)
          throw new Error('This key is encrypted and needs its passphrase');
        const decrypted = forge.pki.decryptPrivateKeyInfo(
          forge.asn1.fromDer(block.body),
          passphrase,
        );
        if (!decrypted)
          throw new Error('Wrong passphrase, or the key is corrupted');
        return parsePrivateKeyInfoAsn1(decrypted);
      }
      default:
        throw new Error(`Unrecognized private key format: ${block.type}`);
    }
  } catch (e) {
    const message = (e as Error).message;
    // forge's decryptor throws its own (unhelpful) errors on a wrong passphrase
    if (
      block.type === 'ENCRYPTED PRIVATE KEY' &&
      !/passphrase|Unsupported/.test(message)
    ) {
      throw new Error('Wrong passphrase, or the key is corrupted');
    }
    throw e;
  }
}

/** Short human label, e.g. "RSA 2048" or "EC P-256". */
export function describeKey(key: {
  keyAlgorithm: KeyAlgorithm;
  keySizeBits?: number;
}): string {
  if (key.keyAlgorithm === 'EC') {
    const bits = key.keySizeBits;
    return bits ? `EC P-${bits}` : 'EC';
  }
  return key.keySizeBits ? `RSA ${key.keySizeBits}` : 'RSA';
}

// ── encoding ───────────────────────────────────────────────────────────────────────────

const { asn1 } = forge;

function pemEncode(type: string, der: string): string {
  return forge.pem.encode({ type, body: der }, { maxline: 64 });
}

function ecSec1Asn1(key: EcParsedKey): forge.asn1.Asn1 {
  const fields: forge.asn1.Asn1[] = [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, '\x01'),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, key.d),
  ];
  if (key.publicPoint) {
    fields.push(
      asn1.create(asn1.Class.CONTEXT_SPECIFIC, 1, true, [
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.BITSTRING,
          false,
          '\x00' + key.publicPoint,
        ),
      ]),
    );
  }
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, fields);
}

function ecPkcs8Pem(key: EcParsedKey): string {
  const curve = curveByName(key.curve);
  const oid = (o: string) =>
    asn1.create(
      asn1.Class.UNIVERSAL,
      asn1.Type.OID,
      false,
      asn1.oidToDer(o).getBytes(),
    );
  const pkcs8 = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, '\x00'),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      oid(OID_EC_PUBLIC_KEY),
      oid(curve.oid),
    ]),
    asn1.create(
      asn1.Class.UNIVERSAL,
      asn1.Type.OCTETSTRING,
      false,
      asn1.toDer(ecSec1Asn1(key)).getBytes(),
    ),
  ]);
  return pemEncode('PRIVATE KEY', asn1.toDer(pkcs8).getBytes());
}

export function toPkcs1Pem(forgeKey: forge.pki.rsa.PrivateKey): string {
  return forge.pki.privateKeyToPem(forgeKey);
}

export function toPkcs8Pem(key: ParsedKey): string {
  if (key.algorithm === 'EC') return ecPkcs8Pem(key);
  const rsaAsn1 = forge.pki.privateKeyToAsn1(key.forgeKey);
  const pkcs8Asn1 = forge.pki.wrapRsaPrivateKey(rsaAsn1);
  return forge.pki.privateKeyInfoToPem(pkcs8Asn1);
}

/** The EC public point to pair with this key: the key's own if it carries one,
 * otherwise the client certificate's (they must be the same key pair anyway). */
function resolvePublicPoint(key: EcParsedKey, certPem?: string): string {
  const certKey = certPem ? parseCertificatePem(certPem).publicKey : undefined;
  if (certKey && (certKey.algorithm !== 'EC' || certKey.curve !== key.curve)) {
    throw new Error(
      'The client private key does not match the client certificate (different key type or curve).',
    );
  }
  const point =
    key.publicPoint ??
    (certKey?.algorithm === 'EC' ? certKey.point : undefined);
  if (!point) {
    throw new Error(
      'This EC key has no public key embedded and no client certificate was provided to take it from.',
    );
  }
  if (
    key.publicPoint &&
    certKey?.algorithm === 'EC' &&
    certKey.point !== key.publicPoint
  ) {
    throw new Error(
      'The client private key does not match the client certificate.',
    );
  }
  return point;
}

/**
 * react-native-tcp-socket currently accepts *disjoint* private-key encodings per
 * platform (verified against library source): iOS's SecKey import path wants PKCS#1 for
 * RSA, and — with this app's patch — the raw ANSI X9.63 form (0x04||X||Y||D) for EC, which
 * is what SecKeyCreateWithData expects for kSecAttrKeyTypeECSECPrimeRandom; Android's
 * KeyFactory path wants unencrypted PKCS#8 for both. This is the one place that
 * difference is bridged — call it right before handing a key to the transport, never
 * store its output as the canonical form. `certPem` is the matching client certificate,
 * used to recover the EC public point when the key file didn't carry it.
 */
export function emitKeyPemForPlatform(
  key: ParsedKey,
  certPem?: string,
): string {
  if (key.algorithm === 'RSA') {
    return Platform.OS === 'ios' ? toPkcs1Pem(key.forgeKey) : toPkcs8Pem(key);
  }
  const point = resolvePublicPoint(key, certPem);
  if (Platform.OS === 'ios') {
    // App-private PEM label understood only by our patched TcpSocketClient.m.
    return pemEncode('EC X963 PRIVATE KEY', point + key.d);
  }
  return toPkcs8Pem({ ...key, publicPoint: point });
}

/**
 * Whether `key` is the private half of `certPem`'s public key. Returns undefined when
 * that can't be determined offline (an EC key file without its public point — checking
 * would need EC point multiplication, which forge doesn't provide).
 */
export function keyMatchesCertificate(
  key: ParsedKey,
  certPem: string,
): boolean | undefined {
  const certKey = parseCertificatePem(certPem).publicKey;
  if (key.algorithm === 'RSA') {
    return (
      certKey.algorithm === 'RSA' &&
      certKey.modulusHex === key.forgeKey.n.toString(16)
    );
  }
  if (certKey.algorithm !== 'EC' || certKey.curve !== key.curve) return false;
  return key.publicPoint ? key.publicPoint === certKey.point : undefined;
}

// Canonical on-disk form: unencrypted PKCS#8. Chosen over PKCS#1/SEC1 because it is the
// one encoding that carries both RSA and EC keys and round-trips through
// parsePrivateKeyPem for every input we accept, and because "no passphrase to juggle at
// rest" is simpler given the passphrase itself is already Keychain-protected via
// secretRepo — the encryption is on the encrypted MMKV store, not the PEM itself.
export function toCanonicalPem(key: ParsedKey): string {
  return toPkcs8Pem(key);
}
