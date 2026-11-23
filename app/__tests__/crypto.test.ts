/**
 * Key/certificate parsing for RSA and EC. Fixtures in ./fixtures/keys are throwaway
 * test-only keys generated with openssl; expectations are cross-checked against Node's
 * own crypto (an independent X.509 / key implementation), not hardcoded values.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as nodeCrypto from 'crypto';
import * as forge from 'node-forge';

const mockPlatform = { OS: 'ios' as 'ios' | 'android' };
jest.mock('react-native', () => ({
  get Platform() {
    return mockPlatform; // read lazily: jest.mock is hoisted above this const
  },
}));

import {
  emitKeyPemForPlatform,
  keyMatchesCertificate,
  parsePrivateKeyPem,
  toCanonicalPem,
  type EcParsedKey,
} from '../src/crypto/keyNormalize';
import { certMetaFromPem } from '../src/crypto/certInfo';
import { unwrapPkcs12 } from '../src/crypto/pkcs12';
import { splitAndClassifyPem } from '../src/crypto/pem';

const dir = path.join(__dirname, 'fixtures', 'keys');
const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');
const readB64 = (f: string) =>
  fs.readFileSync(path.join(dir, f)).toString('base64');

function jwk(pem: string) {
  return nodeCrypto.createPrivateKey(pem).export({ format: 'jwk' }) as {
    kty: string;
    crv?: string;
    x?: string;
    y?: string;
    d?: string;
    n?: string;
  };
}
const b64url = (bin: string) =>
  Buffer.from(bin, 'binary').toString('base64url');

describe('certMetaFromPem', () => {
  it.each(['rsa2048.crt', 'ec256.crt', 'ec384.crt', 'ec521.crt', 'ec-ca.crt'])(
    'matches Node for %s',
    file => {
      const pem = read(file);
      const meta = certMetaFromPem(pem);
      const x = new nodeCrypto.X509Certificate(pem);
      expect(meta.sha256Fingerprint).toBe(x.fingerprint256);
      expect(meta.serialNumber!.toUpperCase().replace(/^0+/, '')).toBe(
        x.serialNumber.toUpperCase().replace(/^0+/, ''),
      );
      expect(meta.subjectCn).toBe(/CN=(.*)/.exec(x.subject)![1].split('\n')[0]);
      expect(new Date(meta.notAfter!).getTime()).toBe(
        new Date(x.validTo).getTime(),
      );
      expect(new Date(meta.notBefore!).getTime()).toBe(
        new Date(x.validFrom).getTime(),
      );
    },
  );

  it('still matches forge for RSA certificates (no regression)', () => {
    const pem = read('rsa2048.crt');
    const cert = forge.pki.certificateFromPem(pem);
    expect(certMetaFromPem(pem).serialNumber).toBe(cert.serialNumber);
  });
});

describe('parsePrivateKeyPem', () => {
  it.each([
    ['ec256.sec1.pem', 256],
    ['ec256.pkcs8.pem', 256],
    ['ec384.sec1.pem', 384],
    ['ec384.pkcs8.pem', 384],
    ['ec521.sec1.pem', 521],
    ['ec521.pkcs8.pem', 521],
  ])('parses EC key %s', (file, bits) => {
    const key = parsePrivateKeyPem(read(file)) as EcParsedKey;
    const ref = jwk(read(file));
    expect(key.algorithm).toBe('EC');
    expect(key.keySizeBits).toBe(bits);
    expect(key.curve).toBe(ref.crv);
    expect(b64url(key.d)).toBe(ref.d);
    expect(b64url(key.publicPoint!.slice(1))).toBe(
      b64url(
        Buffer.concat([
          Buffer.from(ref.x!, 'base64url'),
          Buffer.from(ref.y!, 'base64url'),
        ]).toString('binary'),
      ),
    );
  });

  it('parses encrypted PKCS#8 EC keys with the passphrase', () => {
    expect(() => parsePrivateKeyPem(read('ec256.enc.pem'))).toThrow(
      'needs its passphrase',
    );
    expect(() => parsePrivateKeyPem(read('ec256.enc.pem'), 'nope')).toThrow(
      /Wrong passphrase/,
    );
    const key = parsePrivateKeyPem(read('ec256.enc.pem'), 'secret');
    expect(key.algorithm).toBe('EC');
    expect(toCanonicalPem(key)).toBe(
      toCanonicalPem(parsePrivateKeyPem(read('ec256.pkcs8.pem'))),
    );
  });

  it('parses EC keys without an embedded public key', () => {
    const key = parsePrivateKeyPem(read('ec256.nopub.pem')) as EcParsedKey;
    expect(key.publicPoint).toBeUndefined();
    expect(b64url(key.d)).toBe(jwk(read('ec256.sec1.pem')).d);
  });

  it('still parses RSA keys', () => {
    for (const f of ['rsa2048.pkcs1.pem', 'rsa2048.pkcs8.pem']) {
      const key = parsePrivateKeyPem(read(f));
      expect(key.algorithm).toBe('RSA');
      expect(key.keySizeBits).toBe(2048);
    }
  });

  it('rejects unsupported keys with a clear message', () => {
    expect(() => parsePrivateKeyPem(read('ed25519.pem'))).toThrow(/Ed25519/);
    expect(() => parsePrivateKeyPem(read('ec256.legacyenc.pem'))).toThrow(
      /legacy OpenSSL encryption/,
    );
    expect(() => parsePrivateKeyPem(read('ec256.crt'))).toThrow(
      /No private key found/,
    );
  });
});

describe('canonical form round-trips', () => {
  it.each([
    'ec256.sec1.pem',
    'ec384.pkcs8.pem',
    'ec521.sec1.pem',
    'rsa2048.pkcs1.pem',
  ])('%s → PKCS#8 that Node reads back as the same key', file => {
    const canonical = toCanonicalPem(parsePrivateKeyPem(read(file)));
    expect(canonical).toContain('-----BEGIN PRIVATE KEY-----');
    expect(jwk(canonical)).toEqual(jwk(read(file)));
    // and parses back to itself
    expect(toCanonicalPem(parsePrivateKeyPem(canonical))).toBe(canonical);
  });
});

describe('emitKeyPemForPlatform', () => {
  afterEach(() => {
    mockPlatform.OS = 'ios';
  });

  it.each(['ec256', 'ec384', 'ec521'])(
    'iOS: %s emits ANSI X9.63 (04||X||Y||D)',
    name => {
      mockPlatform.OS = 'ios';
      const key = parsePrivateKeyPem(read(`${name}.sec1.pem`));
      const pem = emitKeyPemForPlatform(key, read(`${name}.crt`));
      const msg = forge.pem.decode(pem)[0];
      expect(msg.type).toBe('EC X963 PRIVATE KEY');
      const ref = jwk(read(`${name}.sec1.pem`));
      const expected = Buffer.concat([
        Buffer.from([4]),
        Buffer.from(ref.x!, 'base64url'),
        Buffer.from(ref.y!, 'base64url'),
        Buffer.from(ref.d!, 'base64url'),
      ]);
      expect(Buffer.from(msg.body, 'binary').equals(expected)).toBe(true);
    },
  );

  it('iOS: takes the public point from the certificate when the key lacks it', () => {
    mockPlatform.OS = 'ios';
    const withPub = emitKeyPemForPlatform(
      parsePrivateKeyPem(read('ec256.sec1.pem')),
      read('ec256.crt'),
    );
    const fromCert = emitKeyPemForPlatform(
      parsePrivateKeyPem(read('ec256.nopub.pem')),
      read('ec256.crt'),
    );
    expect(fromCert).toBe(withPub);
  });

  it('Android: EC keys are emitted as PKCS#8 with the public key filled in', () => {
    mockPlatform.OS = 'android';
    const pem = emitKeyPemForPlatform(
      parsePrivateKeyPem(read('ec256.nopub.pem')),
      read('ec256.crt'),
    );
    expect(pem).toContain('-----BEGIN PRIVATE KEY-----');
    expect(jwk(pem)).toEqual(jwk(read('ec256.sec1.pem')));
  });

  it('RSA output is unchanged: PKCS#1 on iOS, PKCS#8 on Android', () => {
    const key = parsePrivateKeyPem(read('rsa2048.pkcs8.pem'));
    mockPlatform.OS = 'ios';
    expect(emitKeyPemForPlatform(key)).toContain('BEGIN RSA PRIVATE KEY');
    mockPlatform.OS = 'android';
    expect(emitKeyPemForPlatform(key)).toContain('BEGIN PRIVATE KEY');
  });

  it('refuses a key that does not belong to the certificate', () => {
    expect(() =>
      emitKeyPemForPlatform(
        parsePrivateKeyPem(read('ec256.sec1.pem')),
        read('ec384.crt'),
      ),
    ).toThrow(/does not match/);
  });
});

describe('keyMatchesCertificate', () => {
  it('detects matching and mismatched pairs', () => {
    const ec = parsePrivateKeyPem(read('ec256.sec1.pem'));
    const rsa = parsePrivateKeyPem(read('rsa2048.pkcs1.pem'));
    expect(keyMatchesCertificate(ec, read('ec256.crt'))).toBe(true);
    expect(keyMatchesCertificate(rsa, read('rsa2048.crt'))).toBe(true);
    expect(keyMatchesCertificate(ec, read('rsa2048.crt'))).toBe(false);
    expect(keyMatchesCertificate(rsa, read('ec256.crt'))).toBe(false);
    expect(keyMatchesCertificate(ec, read('ec384.crt'))).toBe(false);
    expect(
      keyMatchesCertificate(
        parsePrivateKeyPem(read('ec256.nopub.pem')),
        read('ec256.crt'),
      ),
    ).toBeUndefined();
  });
});

describe('unwrapPkcs12', () => {
  it.each(['ec256.p12', 'ec256.legacy.p12'])('unwraps EC bundle %s', file => {
    const bundle = unwrapPkcs12(readB64(file), 'secret');
    expect(bundle.keyAlgorithm).toBe('EC');
    expect(bundle.keySizeBits).toBe(256);
    expect(jwk(bundle.keyPem)).toEqual(jwk(read('ec256.sec1.pem')));
    expect(certMetaFromPem(bundle.certPem).sha256Fingerprint).toBe(
      new nodeCrypto.X509Certificate(read('ec256.crt')).fingerprint256,
    );
  });

  it('puts the CA in the chain, not in the leaf slot', () => {
    const bundle = unwrapPkcs12(readB64('ec256.p12'), 'secret');
    expect(bundle.chainPems).toHaveLength(1);
    expect(certMetaFromPem(bundle.chainPems[0]).subjectCn).toBe('EC Test CA');
  });

  it('still unwraps RSA bundles', () => {
    const bundle = unwrapPkcs12(readB64('rsa2048.p12'), 'secret');
    expect(bundle.keyAlgorithm).toBe('RSA');
    expect(bundle.keySizeBits).toBe(2048);
    expect(jwk(bundle.keyPem)).toEqual(jwk(read('rsa2048.pkcs1.pem')));
  });

  it('reports a wrong password', () => {
    expect(() => unwrapPkcs12(readB64('ec256.p12'), 'nope')).toThrow(
      /password/,
    );
  });
});

describe('splitAndClassifyPem', () => {
  it('ignores EC PARAMETERS blocks', () => {
    const blocks = splitAndClassifyPem(
      read('ec256.sec1.pem') + read('ec256.crt'),
    );
    expect(blocks.map(b => b.kind)).toEqual(['privateKey', 'certificate']);
  });
});
