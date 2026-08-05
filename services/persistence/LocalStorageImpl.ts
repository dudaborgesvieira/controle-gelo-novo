import { StorageInterface } from './StorageInterface';
import { Movement, getSeedMovements } from '../../core/entities/movement';
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
    const movements = this.getMovements();
    movements.unshift(movement); // Newest first
    this.setItem(KEYS.MOVEMENTS, movements);
    
    // Add to offline queue
    this.logOfflineOperation({ action: 'create', type: 'movement', data: movement });
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
    
    // Auto-migration: Ensure all default attendants exist in stored list
    let updated = false;
    const existingNames = new Set(stored.map((a) => a.name.trim().toLowerCase()));

    for (const defAtt of DEFAULT_ATTENDANTS) {
      if (!existingNames.has(defAtt.name.trim().toLowerCase())) {
        stored.push(defAtt);
        existingNames.add(defAtt.name.trim().toLowerCase());
        updated = true;
      }
    }

    if (updated) {
      this.setItem(KEYS.ATTENDANTS, stored);
    }

    return stored;
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

    // Migration: enforce '102035' password if they have an old or unconfigured password
    if (!stored.adminPassword || stored.adminPassword !== '102035') {
      stored.adminPassword = '102035';
      // Also clear any pending passwords to avoid confusion
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

  // Offline logs for Firebase readiness
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
