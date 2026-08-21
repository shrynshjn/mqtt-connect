// Kept as a narrow interface (not "just use react-native-tcp-socket everywhere") so the
// fallback described in the plan — a purpose-built Nitro native module, if the patched
// react-native-tcp-socket path turns out not to hold up — only requires a new
// implementation of this file's `buildStream`, nothing else in the app.

export interface TlsConnectOptions {
  ca: string; // PEM, CA is mandatory whenever tls is present — enforced by the caller
  cert?: string; // PEM, already platform-normalized (see keyNormalize.emitKeyPemForPlatform)
  key?: string; // PEM, already platform-normalized
  certAlias?: string; // required alongside `cert`/`key` — keeps profiles from clobbering
  keyAlias?: string; // each other's iOS Keychain identity (see ClientIdentity in types/profile.ts)
}

export interface TcpConnectOptions {
  host: string;
  port: number;
  tls?: TlsConnectOptions; // absent => plain tcp; present => tls (CA always required)
  connectTimeoutMs?: number;
}
