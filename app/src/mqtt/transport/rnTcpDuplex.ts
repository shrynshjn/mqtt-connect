import type Socket from 'react-native-tcp-socket/lib/types/Socket';

// mqtt.js's own IStream type lives in an internal path its package.json "exports" don't
// expose to TypeScript's resolver, so this mirrors just the surface MqttClient actually
// calls (verified by grepping the installed package's compiled client.js).
export interface IStream {
  pipe(dest: unknown): unknown;
  on(event: string, listener: (...args: any[]) => void): unknown;
  once(event: string, listener: (...args: any[]) => void): unknown;
  removeListener(event: string, listener: (...args: any[]) => void): unknown;
  emit(event: string, ...args: any[]): unknown;
  write(chunk: unknown, ...rest: any[]): boolean;
  end(cb?: () => void): unknown;
  destroy(): unknown;
  setMaxListeners(n?: number): unknown;
  socket?: unknown;
}

// react-native-tcp-socket's Socket is an eventemitter3 EventEmitter (on/once/off/emit),
// NOT a Node Duplex — no `pipe`, no `setMaxListeners`. mqtt.js's MqttClient calls exactly:
// stream.pipe(writable), stream.on('error'|'close'), stream.once('drain'),
// stream.write(buf), stream.end(cb), stream.destroy(), stream.removeListener('close', cb),
// stream.setMaxListeners(n) — verified by grepping the installed mqtt package's compiled
// client.js rather than assuming. This adapter supplies exactly that surface; everything
// that already matches 1:1 (on/once/removeListener/write/destroy) is passed straight
// through, and only `pipe`/`end`/`setMaxListeners` need real shims.
export function wrapAsIStream(socket: Socket): IStream {
  // react-native-tcp-socket's own Socket.write() *throws* ("Socket is closed.") if the
  // socket hasn't finished connecting yet, rather than buffering like Node's net.Socket
  // does. mqtt.js assumes standard Node semantics: it pipes the stream and immediately
  // writes the CONNECT packet in the same tick, well before our socket (whose connect is
  // an async native bridge call) has actually connected — so every real connection attempt
  // hit that throw. Plain sockets emit 'connect' once ready; TLS sockets (from
  // connectTLS()) emit 'secureConnect' instead (and never 'connect' on themselves) — buffer
  // writes until whichever one fires, then flush in order.
  let ready = false;
  const pending: { chunk: unknown; args: unknown[] }[] = [];

  function flush() {
    if (ready) return;
    ready = true;
    for (const { chunk, args } of pending.splice(0, pending.length)) {
      socket.write(chunk as any, ...(args as []));
    }
  }
  socket.once('connect', flush);
  socket.once('secureConnect', flush);

  const iStream = {
    // Minimal manual `pipe`: forward incoming chunks to the destination writable, and
    // end it when the source closes. MQTT.js only ever pipes into its own internal
    // parser stream, so a full Node-stream-compatible pipe() isn't needed — just this.
    pipe(dest: { write: (chunk: unknown) => void; end: () => void }) {
      socket.on('data', (chunk: unknown) => dest.write(chunk));
      socket.on('end', () => dest.end());
      return dest;
    },

    on: socket.on.bind(socket),
    once: socket.once.bind(socket),
    removeListener: socket.removeListener.bind(socket),
    emit: socket.emit.bind(socket),

    write(chunk: unknown, ...args: unknown[]) {
      if (!ready) {
        pending.push({ chunk, args });
        return true;
      }
      return socket.write(chunk as any, ...(args as []));
    },

    // react-native-tcp-socket's Socket.end() takes no callback (unlike Node's Writable).
    // MQTT.js expects the callback to fire once the stream has actually finished
    // closing, so hook 'close' rather than firing it immediately.
    end(cb?: () => void) {
      if (cb) socket.once('close', cb);
      socket.end();
      return iStream;
    },

    destroy() {
      socket.destroy();
      return iStream;
    },

    // eventemitter3 (what Socket actually extends) has no concept of a listener cap —
    // this exists purely so MQTT.js's `setMaxListeners` call doesn't throw.
    setMaxListeners() {
      return iStream;
    },

    socket,
  };

  return iStream;
}
