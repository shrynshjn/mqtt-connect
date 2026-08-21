import TcpSockets from 'react-native-tcp-socket';
import { wrapAsIStream, type IStream } from './rnTcpDuplex';
import type { TcpConnectOptions } from './types';

const noop = () => {};

/**
 * Builds the raw socket for an MQTT connection and wraps it as the IStream mqtt.js's
 * custom-transport constructor (`new mqtt.MqttClient(streamBuilder, options)`) expects.
 * Returned synchronously — the actual TCP/TLS handshake happens in the background, and
 * mqtt.js finds out once real bytes (or an error) arrive on the wrapped stream.
 */
export function buildStream(options: TcpConnectOptions): IStream {
  const { host, port, tls, connectTimeoutMs } = options;

  if (!tls) {
    const socket = TcpSockets.connect(
      { host, port, connectTimeout: connectTimeoutMs },
      noop,
    );
    return wrapAsIStream(socket);
  }

  // CA is mandatory for every TLS profile (product decision — see plan's transport risk
  // section): it's what makes react-native-tcp-socket's Android path actually honor the
  // client certificate instead of silently discarding it, and real server-trust
  // validation on both platforms depends on it after the trust-manager patch.
  if (!tls.ca) {
    throw new Error(
      'TLS connection requested without a CA certificate — this should never happen (CA is mandatory in ProfileForm).',
    );
  }

  const socket = TcpSockets.connectTLS({
    host,
    port,
    connectTimeout: connectTimeoutMs,
    // `rejectUnauthorized` is read natively on both platforms (confirmed by reading
    // TcpSocketClient.java) but missing from this version's TS types — cast needed.
    ...({ rejectUnauthorized: true } as object),
    ca: tls.ca,
    cert: tls.cert,
    key: tls.key,
    certAlias: tls.certAlias,
    keyAlias: tls.keyAlias,
  });

  return wrapAsIStream(socket);
}

/** Adapts buildStream to mqtt.js's `StreamBuilder` signature (client/opts args are unused —
 * everything needed is already captured in `options` by the caller). */
export function makeStreamBuilder(options: TcpConnectOptions) {
  return () => buildStream(options);
}
