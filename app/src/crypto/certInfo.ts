import * as forge from 'node-forge';
import type { CertMeta } from '../types/profile';

export function certMetaFromPem(certPem: string): CertMeta {
  const cert = forge.pki.certificateFromPem(certPem);
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const md = forge.md.sha256.create();
  md.update(der);
  const sha256Fingerprint = md.digest().toHex().match(/.{2}/g)!.join(':').toUpperCase();

  return {
    subjectCn: cert.subject.getField('CN')?.value,
    issuerCn: cert.issuer.getField('CN')?.value,
    notBefore: cert.validity.notBefore.toISOString(),
    notAfter: cert.validity.notAfter.toISOString(),
    serialNumber: cert.serialNumber,
    sha256Fingerprint,
  };
}

export function daysUntilExpiry(notAfterIso: string): number {
  return Math.ceil((new Date(notAfterIso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}
