import { supabaseStorageService } from '../persistence/SupabaseStorageImpl';

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
    // Initial call
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

    this.isSyncing = true;
    this.notify();

    // Perform synchronization with Supabase and local storage
    supabaseStorageService
      .syncLocalDataToSupabase()
      .then(() => {
        setTimeout(() => {
          this.isSyncing = false;
          this.notify();
        }, 800);
      })
      .catch((err) => {
        console.error('Auto sync error:', err);
        this.isSyncing = false;
        this.notify();
      });
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.connectionState, this.isSyncing));
  }
}

export const syncEngine = new SyncEngine();
