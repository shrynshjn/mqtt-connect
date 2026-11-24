/**
 * On-device EC P-256 key + CSR generation, cross-checked against Node's own crypto (an
 * independent key / signature implementation) rather than hardcoded values.
 */
import * as nodeCrypto from 'crypto';
import * as forge from 'node-forge';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
// The RN polyfill can't load under Jest; Node already provides crypto.getRandomValues.
jest.mock('react-native-get-random-values', () => ({}));

import { generateEcP256Identity } from '../src/crypto/ecCsr';
import { parsePrivateKeyPem } from '../src/crypto/keyNormalize';

const subject = {
  country: 'US',
  organization: 'MQTT Connect Test',
  commonName: 'mqtt-connect-ecc-abcd',
};

function parseCsr(pem: string) {
  const der = forge.pem.decode(pem)[0].body;
  const csr = forge.asn1.fromDer(der, { decodeBitStrings: false } as never);
  const [info, algId, sigBits] = csr.value as forge.asn1.Asn1[];
  const [, name, spki] = info.value as forge.asn1.Asn1[];
  const toBuf = (s: string) => Buffer.from(s, 'binary');
  return {
    infoDer: toBuf(forge.asn1.toDer(info).getBytes()),
    spkiDer: toBuf(forge.asn1.toDer(spki).getBytes()),
    sigAlgOid: forge.asn1.derToOid(
      (algId.value as forge.asn1.Asn1[])[0].value as string,
    ),
    signature: toBuf(
      (
        (sigBits as unknown as { bitStringContents: string })
          .bitStringContents ?? ''
      ).slice(1),
    ),
    nameDer: toBuf(forge.asn1.toDer(name).getBytes()),
  };
}

describe('generateEcP256Identity', () => {
  const generated = generateEcP256Identity(subject);
  const csr = parseCsr(generated.csrPem);

  it('signs the CSR with ECDSA-SHA256 over its own public key', () => {
    expect(generated.csrPem).toMatch(/^-----BEGIN CERTIFICATE REQUEST-----/);
    expect(csr.sigAlgOid).toBe('1.2.840.10045.4.3.2');
    const pub = nodeCrypto.createPublicKey({
      key: csr.spkiDer,
      format: 'der',
      type: 'spki',
    });
    expect(pub.asymmetricKeyDetails?.namedCurve).toBe('prime256v1');
    expect(nodeCrypto.verify('sha256', csr.infoDer, pub, csr.signature)).toBe(
      true,
    );
  });

  it('emits a PKCS#8 private key whose public half is the CSR key', () => {
    const priv = nodeCrypto.createPrivateKey(generated.keyPem);
    const derivedSpki = nodeCrypto
      .createPublicKey(priv)
      .export({ format: 'der', type: 'spki' });
    expect(Buffer.compare(derivedSpki, csr.spkiDer)).toBe(0);
  });

  it('round-trips through the app key parser', () => {
    const parsed = parsePrivateKeyPem(generated.keyPem);
    expect(parsed.algorithm).toBe('EC');
    if (parsed.algorithm !== 'EC') return;
    expect(parsed.curve).toBe('P-256');
    expect(parsed.publicPoint).toBe(generated.key.publicPoint);
    expect(parsed.d).toBe(generated.key.d);
  });

  it('includes the C, O and CN the signer requires', () => {
    const text = csr.nameDer.toString('latin1');
    expect(text).toContain('US');
    expect(text).toContain(subject.organization);
    expect(text).toContain(subject.commonName);
  });

  it('generates a different key every call', () => {
    expect(generateEcP256Identity(subject).key.d).not.toBe(generated.key.d);
  });

  it('rejects a country that is not a two-letter code', () => {
    expect(() =>
      generateEcP256Identity({ ...subject, country: 'USA' }),
    ).toThrow(/two-letter/);
  });
});

describe('parseSignerResponse', () => {
  // mosquittoEcc imports the profile/storage layers only via types, but keep the
  // native-module surface out of this test entirely.
  const { parseSignerResponse } = jest.requireActual<
    typeof import('../src/features/demo/mosquittoEcc')
  >('../src/features/demo/mosquittoEcc');

  it('extracts the certificate PEM from a success reply', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';
    expect(parseSignerResponse(`${pem}\n`)).toBe(`${pem}\n`);
  });

  it("surfaces the signer's own error lines", () => {
    const html =
      '<div><p class="error">Please include a Country in your CSR</p>' +
      '<p class="error">Please include an Organisation in your CSR</p></div>';
    expect(() => parseSignerResponse(html)).toThrow(
      /Country in your CSR; Please include an Organisation/,
    );
  });

  it('fails clearly on an unexpected reply', () => {
    expect(() => parseSignerResponse('<html></html>')).toThrow(
      /returned no certificate/,
    );
  });
});
