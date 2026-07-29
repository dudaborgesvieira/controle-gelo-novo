import { LocalStorageImpl } from './LocalStorageImpl';
import { Movement } from '../../core/entities/movement';
import { Attendant } from '../../core/entities/attendant';
import { SystemSettings } from '../../core/entities/settings';

const storage = new LocalStorageImpl();
const LAST_BACKUP_KEY = 'controle_gelo_last_backup_time';

export interface LocalDatabaseDump {
  app: string;
  version: string;
  exportedAt: string;
  stationName: string;
  summary: {
    movementsCount: number;
    attendantsCount: number;
  };
  data: {
    movements: Movement[];
    attendants: Attendant[];
    settings: SystemSettings;
    offlineLogs: any[];
  };
}

export async function exportDatabaseBackupToFile(): Promise<{ success: boolean; method: string; filename: string }> {
  const settings = storage.getSettings();
  const movements = storage.getMovements();
  const attendants = storage.getAttendants();
  const logs = storage.getOfflineLogs();

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestampStr = `${dateStr}_${hours}h${minutes}m${seconds}s`;

  const stationSlug = (settings.gasStationName || 'posto_gelo')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');
  const filename = `banco_gelo_${stationSlug}_${timestampStr}.db.json`;

  const payload: LocalDatabaseDump = {
    app: 'Controle de Vendas e Estoque de Gelo - Banco Local',
    version: '2.0-local',
    exportedAt: new Date().toISOString(),
    stationName: settings.gasStationName || 'Posto de Combustível',
    summary: {
      movementsCount: movements.length,
      attendantsCount: attendants.length,
    },
    data: {
      movements,
      attendants,
      settings,
      offlineLogs: logs,
    },
  };

  const jsonContent = JSON.stringify(payload, null, 2);

  // Mark last backup time
  if (typeof window !== 'undefined') {
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  }

  // 1. Try Web File System Access API (Modern Chrome / Edge / Electron on PC)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'Arquivo de Banco de Dados Local (.db.json)',
            accept: {
              'application/json': ['.json', '.db', '.db.json'],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(jsonContent);
      await writable.close();
      return { success: true, method: 'file_picker', filename };
    } catch (err: any) {
      // User canceled or browser permission denied, fallback to Blob download
      if (err.name === 'AbortError') {
        return { success: false, method: 'canceled', filename };
      }
    }
  }

  // 2. Standard Browser Blob Download (Works on all browsers & PCs)
  if (typeof window !== 'undefined') {
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return { success: true, method: 'download', filename };
  }

  return { success: false, method: 'none', filename };
}

export async function importDatabaseBackupFromFile(file: File): Promise<{
  success: boolean;
  movementsCount?: number;
  attendantsCount?: number;
  error?: string;
}> {
  try {
    const text = await file.text();
    const parsed: LocalDatabaseDump = JSON.parse(text);

    if (!parsed || !parsed.data || !Array.isArray(parsed.data.movements)) {
      return {
        success: false,
        error: 'Arquivo de backup inválido. Estrutura de banco de dados não reconhecida.',
      };
    }

    // Reset current storage & apply backup
    storage.resetAllData();

    // 1. Settings
    if (parsed.data.settings) {
      storage.saveSettings(parsed.data.settings);
    }

    // 2. Attendants
    if (Array.isArray(parsed.data.attendants)) {
      parsed.data.attendants.forEach((a) => storage.saveAttendant(a));
    }

    // 3. Movements
    if (Array.isArray(parsed.data.movements)) {
      parsed.data.movements.forEach((m) => storage.saveMovement(m));
    }

    return {
      success: true,
      movementsCount: parsed.data.movements.length,
      attendantsCount: parsed.data.attendants ? parsed.data.attendants.length : 0,
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Erro ao ler arquivo de backup: ' + (err.message || 'Formato JSON incorreto'),
    };
  }
}

export function getLastBackupTimestamp(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_BACKUP_KEY);
}
