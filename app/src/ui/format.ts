export function formatUptime(sinceMs: number): string {
  const totalSeconds = Math.max(0, Math.floor((Date.now() - sinceMs) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `up ${h}h ${m}m`;
  if (m > 0) return `up ${m}m ${s}s`;
  return `up ${s}s`;
}

export function formatRelative(ms: number): string {
  const diffMs = Date.now() - ms;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

export function byteLength(payload: Uint8Array): string {
  return `${payload.length} B`;
}
