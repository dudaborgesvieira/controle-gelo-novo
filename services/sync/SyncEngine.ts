export type ConnectionState = 'online' | 'offline';

export class SyncEngine {
  private listeners: ((state: ConnectionState, syncing: boolean) => void)[] = [];
  private connectionState: ConnectionState = 'online';
  private isSyncing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.connectionState = navigator.onLine ? 'online' : 'offline';

      window.addEventListener('online', () => this.handleConnectionChange('online'));
      window.addEventListener('offline', () => this.handleConnectionChange('offline'));
    }
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  public subscribe(callback: (state: ConnectionState, syncing: boolean) => void): () => void {
    this.listeners.push(callback);
    callback(this.connectionState, this.isSyncing);

    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private handleConnectionChange(state: ConnectionState): void {
    this.connectionState = state;
    this.notify();

    if (state === 'online') {
      this.triggerAutoSync();
    }
  }

  public triggerAutoSync(): void {
    if (this.connectionState === 'offline' || this.isSyncing) return;

    // Individual writes are already sent directly to Supabase by
    // SupabaseStorageImpl. Do not bulk-upload the browser's local cache here:
    // stale local history could recreate records that were intentionally
    // deleted/reset in Supabase.
    this.isSyncing = true;
    this.notify();

    setTimeout(() => {
      this.isSyncing = false;
      this.notify();
    }, 300);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.connectionState, this.isSyncing));
  }
}

export const syncEngine = new SyncEngine();
