import { Movement } from '../../core/entities/movement';
import { Attendant } from '../../core/entities/attendant';
import { SystemSettings } from '../../core/entities/settings';

export interface StorageInterface {
  getMovements(): Movement[];
  saveMovement(movement: Movement): void;
  deleteMovement(id: string): void;
  updateMovement(movement: Movement): void;
  
  getAttendants(): Attendant[];
  saveAttendant(attendant: Attendant): void;
  updateAttendant(attendant: Attendant): void;
  
  getSettings(): SystemSettings;
  saveSettings(settings: SystemSettings): void;
  
  // Backups, Reset and Local logs
  resetAllData?(): void;
  getOfflineLogs(): any[];
  clearOfflineLogs(): void;
}
