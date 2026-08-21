import { AppState, type AppStateStatus } from 'react-native';
import { getAllSnapshots, connect } from './connectionManager';

let started = false;

/**
 * iOS suspends open sockets in the background — a connection that was "connected" when
 * the app was backgrounded may be dead by the time it returns, with no event ever firing
 * to say so. Rather than trust the stale status, kick every non-idle connection through
 * connect() again on foreground; ManagedConnection.connect() is a no-op if a client
 * already exists and is genuinely alive, and mqtt.js's own reconnect logic takes over
 * for one that silently died.
 */
export function startAppLifecycleWatcher(): void {
  if (started) return;
  started = true;

  AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state !== 'active') return;
    getAllSnapshots()
      .filter(s => s.status === 'connected' || s.status === 'reconnecting')
      .forEach(s => connect(s.profileId));
  });
}
