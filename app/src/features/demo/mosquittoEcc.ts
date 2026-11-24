import {
  generateEcP256Identity,
  type GeneratedEcIdentity,
} from '../../crypto/ecCsr';
import { keyMatchesCertificate } from '../../crypto/keyNormalize';

// test.mosquitto.org (https://test.mosquitto.org/) — Eclipse Mosquitto's public test
// broker. Port 8884 is MQTT over TLS with a client certificate *required*, and the
// project runs a free signer that issues client certificates (valid 90 days) for any
// CSR that includes a Country and an Organisation. That makes it the one public broker
// where an EC client certificate can be exercised end to end with no account: HiveMQ's
// public broker doesn't do client-certificate auth at all. Verified 2026-11-24 with an
// openssl-generated P-256 key: the signer accepted the EC CSR and 8884 completed an
// mTLS connect + subscribe/publish round trip with it.
export const MOSQUITTO_HOST = 'test.mosquitto.org';
export const MOSQUITTO_MTLS_PORT = 8884;
export const MOSQUITTO_SIGNER_URL = 'https://test.mosquitto.org/ssl/index.php';

// The test.mosquitto.org CA (https://test.mosquitto.org/ssl/mosquitto.org.crt). It is
// both the root that 8884's server certificate chains to and the issuer of the client
// certificates the signer hands out. RSA 2048, valid until 2030-06-07. SHA-256
// fingerprint FC:9E:45:E2:8F:6F:49:87:FD:14:81:E1:46:BC:FC:31:12:4E:F2:FA:BF:20:AB:04:7E:3F:85:92:C2:2B:65:39.
export const MOSQUITTO_CA_PEM = `-----BEGIN CERTIFICATE-----
MIIEAzCCAuugAwIBAgIUBY1hlCGvdj4NhBXkZ/uLUZNILAwwDQYJKoZIhvcNAQEL
BQAwgZAxCzAJBgNVBAYTAkdCMRcwFQYDVQQIDA5Vbml0ZWQgS2luZ2RvbTEOMAwG
A1UEBwwFRGVyYnkxEjAQBgNVBAoMCU1vc3F1aXR0bzELMAkGA1UECwwCQ0ExFjAU
BgNVBAMMDW1vc3F1aXR0by5vcmcxHzAdBgkqhkiG9w0BCQEWEHJvZ2VyQGF0Y2hv
by5vcmcwHhcNMjAwNjA5MTEwNjM5WhcNMzAwNjA3MTEwNjM5WjCBkDELMAkGA1UE
BhMCR0IxFzAVBgNVBAgMDlVuaXRlZCBLaW5nZG9tMQ4wDAYDVQQHDAVEZXJieTES
MBAGA1UECgwJTW9zcXVpdHRvMQswCQYDVQQLDAJDQTEWMBQGA1UEAwwNbW9zcXVp
dHRvLm9yZzEfMB0GCSqGSIb3DQEJARYQcm9nZXJAYXRjaG9vLm9yZzCCASIwDQYJ
KoZIhvcNAQEBBQADggEPADCCAQoCggEBAME0HKmIzfTOwkKLT3THHe+ObdizamPg
UZmD64Tf3zJdNeYGYn4CEXbyP6fy3tWc8S2boW6dzrH8SdFf9uo320GJA9B7U1FW
Te3xda/Lm3JFfaHjkWw7jBwcauQZjpGINHapHRlpiCZsquAthOgxW9SgDgYlGzEA
s06pkEFiMw+qDfLo/sxFKB6vQlFekMeCymjLCbNwPJyqyhFmPWwio/PDMruBTzPH
3cioBnrJWKXc3OjXdLGFJOfj7pP0j/dr2LH72eSvv3PQQFl90CZPFhrCUcRHSSxo
E6yjGOdnz7f6PveLIB574kQORwt8ePn0yidrTC1ictikED3nHYhMUOUCAwEAAaNT
MFEwHQYDVR0OBBYEFPVV6xBUFPiGKDyo5V3+Hbh4N9YSMB8GA1UdIwQYMBaAFPVV
6xBUFPiGKDyo5V3+Hbh4N9YSMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQEL
BQADggEBAGa9kS21N70ThM6/Hj9D7mbVxKLBjVWe2TPsGfbl3rEDfZ+OKRZ2j6AC
6r7jb4TZO3dzF2p6dgbrlU71Y/4K0TdzIjRj3cQ3KSm41JvUQ0hZ/c04iGDg/xWf
+pp58nfPAYwuerruPNWmlStWAXf0UTqRtg4hQDWBuUFDJTuWuuBvEXudz74eh/wK
sMwfu1HFvjy5Z0iMDU8PUDepjVolOCue9ashlS4EB5IECdSR2TItnAIiIwimx839
LdUdRudafMu5T5Xma182OC0/u/xRlEm+tvKGGmfFcN0piqVl8OrSPBgIlb+1IKJE
m/XriWr/Cq4h/JfB7NTsezVslgkBaoU=
-----END CERTIFICATE-----
`;

const SIGNER_TIMEOUT_MS = 20000;

export interface EccDemoIdentity extends GeneratedEcIdentity {
  certPem: string;
}

/** Pulls the issued certificate out of the signer's reply. On success the reply is the
 * PEM; on failure it's the signer's HTML form with `<p class="error">` lines. Exported
 * for tests. */
export function parseSignerResponse(body: string): string {
  const pem = body.match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/,
  );
  if (pem) return pem[0] + '\n';
  const errors = Array.from(
    body.matchAll(/<p class="error">([^<]*)<\/p>/g),
    m => m[1].trim(),
  ).filter(Boolean);
  throw new Error(
    errors.length
      ? `test.mosquitto.org rejected the certificate request: ${errors.join(
          '; ',
        )}`
      : 'test.mosquitto.org returned no certificate.',
  );
}

/** Generates an EC P-256 key on the device, has test.mosquitto.org's public signer issue
 * a client certificate for it, and checks the certificate really is for that key. Only
 * the CSR (public key + the generic subject below) leaves the device. */
export async function issueMosquittoEccIdentity(
  clientId: string,
): Promise<EccDemoIdentity> {
  const generated = generateEcP256Identity({
    // The signer refuses CSRs without C and O. Deliberately generic: nothing about the
    // user or device goes into a certificate issued by a public service.
    country: 'US',
    organization: 'MQTT Connect Test',
    commonName: clientId,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SIGNER_TIMEOUT_MS);
  let body: string;
  try {
    const res = await fetch(MOSQUITTO_SIGNER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `csr=${encodeURIComponent(generated.csrPem)}`,
      // RN's fetch honours AbortController; only its typings disagree with the DOM's.
      signal: controller.signal as unknown as RequestInit['signal'],
    });
    if (!res.ok) {
      throw new Error(`test.mosquitto.org signer replied HTTP ${res.status}.`);
    }
    body = await res.text();
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('test.mosquitto.org signer did not respond in time.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }

  const certPem = parseSignerResponse(body);
  if (keyMatchesCertificate(generated.key, certPem) !== true) {
    throw new Error(
      'The certificate test.mosquitto.org returned is not for the key generated on this device.',
    );
  }
  return { ...generated, certPem };
}
