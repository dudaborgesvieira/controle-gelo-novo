import { StorageInterface } from './StorageInterface';
import { Movement } from '../../core/entities/movement';
import { Attendant, DEFAULT_ATTENDANTS } from '../../core/entities/attendant';
import { SystemSettings, DEFAULT_SETTINGS } from '../../core/entities/settings';

const KEYS = {
  MOVEMENTS: 'controle_gelo_movements',
  ATTENDANTS: 'controle_gelo_attendants',
  SETTINGS: 'controle_gelo_settings',
  OFFLINE_LOGS: 'controle_gelo_offline_logs',
};

export class LocalStorageImpl implements StorageInterface {
  private isClient(): boolean {
    return typeof window !== 'undefined';
  }

  private isUuid(value: string | null | undefined): boolean {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private ensureMovementUuid(movement: Movement): Movement {
    if (!this.isUuid(movement.id)) {
      movement.id = crypto.randomUUID();
    }
    return movement;
  }

  private getItem<T>(key: string, defaultValue: T): T {
    if (!this.isClient()) return defaultValue;
    const value = localStorage.getItem(key);
    if (!value) return defaultValue;
    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }

  private setItem<T>(key: string, value: T): void {
    if (!this.isClient()) return;
    localStorage.setItem(key, JSON.stringify(value));
  }

  getMovements(): Movement[] {
    if (!this.isClient()) return [];

    if (!localStorage.getItem(KEYS.MOVEMENTS)) {
      this.setItem(KEYS.MOVEMENTS, []);
      return [];
    }

    return this.getItem<Movement[]>(KEYS.MOVEMENTS, []);
  }

  saveMovement(movement: Movement): void {
    // New movements may still arrive from older UI code with short IDs such as
    // "mov-1234". Normalize them to a UUID before either local or Supabase
    // persistence so two operations can never overwrite each other by ID.
    const safeMovement = this.ensureMovementUuid(movement);
    const movements = this.getMovements();
    movements.unshift(safeMovement);
    this.setItem(KEYS.MOVEMENTS, movements);
    this.logOfflineOperation({ action: 'create', type: 'movement', data: safeMovement });
  }

  deleteMovement(id: string): void {
    const movements = this.getMovements();
    const updated = movements.filter((m) => m.id !== id);
    this.setItem(KEYS.MOVEMENTS, updated);
    this.logOfflineOperation({ action: 'delete', type: 'movement', data: { id } });
  }

  updateMovement(movement: Movement): void {
    const movements = this.getMovements();
    const index = movements.findIndex((m) => m.id === movement.id);
    if (index !== -1) {
      movements[index] = movement;
      this.setItem(KEYS.MOVEMENTS, movements);
      this.logOfflineOperation({ action: 'update', type: 'movement', data: movement });
    }
  }

  getAttendants(): Attendant[] {
    if (!this.isClient()) return DEFAULT_ATTENDANTS;

    if (!localStorage.getItem(KEYS.ATTENDANTS)) {
      this.setItem(KEYS.ATTENDANTS, DEFAULT_ATTENDANTS);
      return DEFAULT_ATTENDANTS;
    }

    const stored = this.getItem<Attendant[]>(KEYS.ATTENDANTS, []);
    const filtered = stored.filter(
      (a) => a.id !== 'att-jb' && a.name.trim().toLowerCase() !== 'joão bernardo' && a.name.trim().toLowerCase() !== 'joao bernardo'
    );
    if (filtered.length !== stored.length) {
      this.setItem(KEYS.ATTENDANTS, filtered);
    }
    return filtered;
  }

  saveAttendant(attendant: Attendant): void {
    const attendants = this.getAttendants();
    const existingIndex = attendants.findIndex(
      (a) => a.id === attendant.id || a.name.trim().toLowerCase() === attendant.name.trim().toLowerCase()
    );
    if (existingIndex !== -1) {
      attendants[existingIndex] = { ...attendants[existingIndex], ...attendant, isActive: true };
    } else {
      attendants.push(attendant);
    }
    this.setItem(KEYS.ATTENDANTS, attendants);
    this.logOfflineOperation({ action: 'create', type: 'attendant', data: attendant });
  }

  updateAttendant(attendant: Attendant): void {
    const attendants = this.getAttendants();
    const index = attendants.findIndex((a) => a.id === attendant.id);
    if (index !== -1) {
      attendants[index] = attendant;
      this.setItem(KEYS.ATTENDANTS, attendants);
      this.logOfflineOperation({ action: 'update', type: 'attendant', data: attendant });
    }
  }

  deleteAttendant(id: string): void {
    const attendants = this.getAttendants();
    const filtered = attendants.filter((a) => a.id !== id);
    this.setItem(KEYS.ATTENDANTS, filtered);
    this.logOfflineOperation({ action: 'delete', type: 'attendant', data: { id } });
  }

  getSettings(): SystemSettings {
    if (!this.isClient()) return DEFAULT_SETTINGS;
    if (!localStorage.getItem(KEYS.SETTINGS)) {
      this.setItem(KEYS.SETTINGS, DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    const stored = this.getItem<SystemSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);
    let updated = false;

    if (!stored.gasStationName || stored.gasStationName === 'Posto Petrobrás - Central' || stored.gasStationName === 'Alto Posto Tropical') {
      stored.gasStationName = 'Auto Posto Tropical';
      updated = true;
    }

    if (!stored.adminPassword || stored.adminPassword !== '102035') {
      stored.adminPassword = '102035';
      stored.pendingAdminPassword = undefined;
      updated = true;
    }

    if (stored.defaultIceBagPrice === 10.00) {
      stored.defaultIceBagPrice = 16.00;
      updated = true;
    }

    if (updated) {
      this.setItem(KEYS.SETTINGS, stored);
    }
    return stored;
  }

  saveSettings(settings: SystemSettings): void {
    this.setItem(KEYS.SETTINGS, settings);
    this.logOfflineOperation({ action: 'update', type: 'settings', data: settings });
  }

  getOfflineLogs(): any[] {
    return this.getItem<any[]>(KEYS.OFFLINE_LOGS, []);
  }

  clearOfflineLogs(): void {
    this.setItem(KEYS.OFFLINE_LOGS, []);
  }

  resetAllData(): void {
    if (!this.isClient()) return;
    this.setItem(KEYS.MOVEMENTS, []);
    this.setItem(KEYS.OFFLINE_LOGS, []);
    this.setItem(KEYS.SETTINGS, {
      ...DEFAULT_SETTINGS,
      initialStock: 0,
    });
    this.setItem(KEYS.ATTENDANTS, DEFAULT_ATTENDANTS);
  }

  private logOfflineOperation(operation: { action: string; type: string; data: any }): void {
    const logs = this.getOfflineLogs();
    logs.push({
      ...operation,
      timestamp: new Date().toISOString(),
    });
    this.setItem(KEYS.OFFLINE_LOGS, logs);
  }
}

export const storageService = new LocalStorageImpl();
