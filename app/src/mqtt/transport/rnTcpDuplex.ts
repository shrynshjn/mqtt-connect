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

    write: socket.write.bind(socket),

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
