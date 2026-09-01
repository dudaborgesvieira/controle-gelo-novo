'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Movement, MovementType, getSeedMovements } from '../core/entities/movement';
import { Attendant } from '../core/entities/attendant';
import { SystemSettings, DEFAULT_SETTINGS } from '../core/entities/settings';
import { calculateStock, StockCalculationResult } from '../core/usecases/calculateStock';
import { validateMovement } from '../core/usecases/validateMovement';
import { storageService as localStorageService } from '../services/persistence/LocalStorageImpl';
import { supabaseStorageService as storageService } from '../services/persistence/SupabaseStorageImpl';
import { isSupabaseConfigured, getSupabaseClient } from '../lib/supabaseClient';
import { syncEngine, ConnectionState } from '../services/sync/SyncEngine';
import { exportDatabaseBackupToFile, importDatabaseBackupFromFile, getLastBackupTimestamp } from '../services/persistence/backupManager';
import { getLocalDateString, isSameLocalDate } from '../lib/utils';

export function useIceApp() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [isSupabaseActive, setIsSupabaseActive] = useState(() => isSupabaseConfigured());
  
  // Connection and Sync State
  const [connectionState, setConnectionState] = useState<ConnectionState>('online');
  const [isSyncing, setIsSyncing] = useState(false);

  // Active user / navigation state
  const [activeAttendant, setActiveAttendant] = useState<Attendant | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // Refresh remote data
  const refreshRemoteData = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const [mList, aList, sData] = await Promise.all([
        storageService.fetchMovementsAsync(),
        storageService.fetchAttendantsAsync(),
        storageService.fetchSettingsAsync(),
      ]);
      // Empty lists from Supabase are valid authoritative states and must
      // clear stale movements/attendants already loaded in the browser.
      setMovements(mList || []);
      const remoteAttendants = aList || [];
      setAttendants(remoteAttendants);
      setActiveAttendant((prev) => {
        if (prev) {
          const found = remoteAttendants.find((a) => a.id === prev.id);
          if (found) return found;
        }
        const activeOnes = remoteAttendants.filter((a) => a.isActive);
        return activeOnes.length > 0 ? activeOnes[0] : null;
      });
      if (sData) setSettings(sData);
    } catch (e) {
      console.warn('Realtime refresh note:', e);
    }
  }, []);

  // Initial load & sync subscriptions
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSupabaseActive(isSupabaseConfigured());

      // Load initial local/cached data first for immediate rendering
      const loadedMovements = storageService.getMovements();
      const loadedAttendants = storageService.getAttendants();
      const loadedSettings = storageService.getSettings();

      setMovements(loadedMovements);
      setAttendants(loadedAttendants);
      setSettings(loadedSettings);
      setLastBackupTime(getLastBackupTimestamp());

      // Set first active attendant if available
      const activeOnes = loadedAttendants.filter((a) => a.isActive);
      if (activeOnes.length > 0) {
        setActiveAttendant(activeOnes[0]);
      }

      // Initial remote fetch
      if (isSupabaseConfigured()) {
        refreshRemoteData();
      }
    }, 0);

    // Subscribe to synchronization engine
    const unsubscribeSync = syncEngine.subscribe((connState, syncing) => {
      setConnectionState(connState);
      setIsSyncing(syncing);
      setIsSupabaseActive(isSupabaseConfigured());
    });

    // Real-time Supabase Subscription
    let realtimeChannel: any = null;
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        realtimeChannel = supabase
          .channel('schema-db-changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'movements' },
            () => refreshRemoteData()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'attendants' },
            () => refreshRemoteData()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'settings' },
            () => refreshRemoteData()
          )
          .subscribe();
      } catch (err) {
        console.warn('Supabase realtime channel error:', err);
      }
    }

    // Polling interval for multi-device sync
    const pollInterval = setInterval(() => {
      if (isSupabaseConfigured() && navigator.onLine) {
        refreshRemoteData();
      }
    }, 8000);

    // Re-sync on focus/visibility
    const handleFocus = () => {
      if (isSupabaseConfigured() && navigator.onLine) {
        refreshRemoteData();
      }
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearTimeout(timer);
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
      unsubscribeSync();
      if (realtimeChannel && supabase) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [refreshRemoteData]);



  // Compute stock state automatically
  const stockResult = useMemo<StockCalculationResult>(() => {
    return calculateStock(settings.initialStock, movements);
  }, [movements, settings]);

  // Compute stock inconsistency alerts dynamically (avoiding state and useEffect)
  const inconsistencyAlert = useMemo(() => {
    if (stockResult.hasInconsistency && stockResult.inconsistencyMessage) {
      return stockResult.inconsistencyMessage;
    }
    return null;
  }, [stockResult]);

  // Action: Add a new operation
  const registerMovement = useCallback((
    movementData: Omit<Movement, 'id' | 'timestamp' | 'date' | 'time' | 'attendantId' | 'attendantName'>
  ): { success: boolean; message: string; movement?: Movement } => {
    if (!settings) return { success: false, message: 'Configurações não carregadas.' };
    if (!activeAttendant) return { success: false, message: 'Selecione um frentista antes de continuar.' };

    const todayStr = getLocalDateString();
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // Create new movement representation
    const newMovement: Movement = {
      ...movementData,
      id: `mov-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      date: todayStr,
      time: timeStr,
      attendantId: activeAttendant.id,
      attendantName: activeAttendant.name,
    };

    // Validate using the strict validation usecase
    const validation = validateMovement(newMovement, stockResult.currentStock, settings);
    if (!validation.isValid) {
      return { success: false, message: validation.errorMessage || 'Dados inválidos.' };
    }

    // Persist
    storageService.saveMovement(newMovement);
    
    // Update local state reactive bindings
    setMovements((prev) => [newMovement, ...prev]);

    // Trigger background sync simulation
    syncEngine.triggerAutoSync();

    return { success: true, message: 'Operação registrada com sucesso!', movement: newMovement };
  }, [settings, activeAttendant, stockResult.currentStock]);

  // Action: Add an administrative operation directly (for manual adjustments or bypassing attendant checks)
  const registerAdminMovement = useCallback((
    movementData: Partial<Movement> & { type: MovementType; quantity: number }
  ): { success: boolean; message: string; movement?: Movement } => {
    if (!settings) return { success: false, message: 'Configurações não carregadas.' };

    const todayStr = getLocalDateString();
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const newMovement: Movement = {
      id: movementData.id || `mov-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: movementData.timestamp || new Date().toISOString(),
      date: movementData.date || todayStr,
      time: movementData.time || timeStr,
      attendantId: movementData.attendantId || 'admin',
      attendantName: movementData.attendantName || 'Administrador',
      type: movementData.type,
      quantity: movementData.quantity,
      observation: movementData.observation,
      unitPrice: movementData.unitPrice,
      totalPrice: movementData.totalPrice,
      paymentMethod: movementData.paymentMethod,
      discount: movementData.discount,
      courtesyRecipient: movementData.courtesyRecipient,
      lossReason: movementData.lossReason,
    };

    // Persist
    storageService.saveMovement(newMovement);
    
    // Update local state reactive bindings
    setMovements((prev) => [newMovement, ...prev]);

    // Trigger background sync simulation
    syncEngine.triggerAutoSync();

    return { success: true, message: 'Ajuste administrativo registrado com sucesso!', movement: newMovement };
  }, [settings]);

  // Action: Correct/Delete movement (admin permissions required)
  const removeMovement = useCallback((id: string): void => {
    storageService.deleteMovement(id);
    setMovements((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Action: Cancel movement (soft cancellation for audit and reporting)
  const cancelMovement = useCallback((id: string, reason?: string): { success: boolean; message: string } => {
    const mov = movements.find(m => m.id === id);
    if (!mov) return { success: false, message: 'Lançamento não encontrado.' };
    if (mov.isCanceled || mov.status === 'cancelado') return { success: false, message: 'Este lançamento já está cancelado.' };

    const updated: Movement = {
      ...mov,
      isCanceled: true,
      status: 'cancelado',
      canceledAt: new Date().toISOString(),
      canceledBy: 'Administrador',
      cancelReason: reason || 'Cancelamento solicitado no sistema',
    };

    storageService.updateMovement(updated);
    setMovements((prev) => prev.map((m) => m.id === id ? updated : m));
    syncEngine.triggerAutoSync();

    return { success: true, message: 'Lançamento cancelado com sucesso! O estoque e o faturamento foram estornados e o registro constará no relatório.' };
  }, [movements]);

  // Action: Uncancel / restore movement
  const uncancelMovement = useCallback((id: string): { success: boolean; message: string } => {
    const mov = movements.find(m => m.id === id);
    if (!mov) return { success: false, message: 'Lançamento não encontrado.' };
    if (!mov.isCanceled && mov.status !== 'cancelado') return { success: false, message: 'Este lançamento não está cancelado.' };

    const updated: Movement = {
      ...mov,
      isCanceled: false,
      status: 'ativo',
      canceledAt: undefined,
      canceledBy: undefined,
      cancelReason: undefined,
    };

    storageService.updateMovement(updated);
    setMovements((prev) => prev.map((m) => m.id === id ? updated : m));
    syncEngine.triggerAutoSync();

    return { success: true, message: 'Lançamento reativado com sucesso!' };
  }, [movements]);

  // Action: Edit movement (admin correction)
  const updateMovement = useCallback((movement: Movement): void => {
    storageService.updateMovement(movement);
    setMovements((prev) => prev.map((m) => m.id === movement.id ? movement : m));
  }, []);

  // Action: Add Attendant
  const addAttendant = useCallback((name: string): void => {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Check if attendant with same name already exists
    const existing = attendants.find((a) => a.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      if (!existing.isActive) {
        const updated = { ...existing, isActive: true };
        storageService.updateAttendant(updated);
        setAttendants((prev) => prev.map((a) => (a.id === existing.id ? updated : a)));
        if (!activeAttendant) setActiveAttendant(updated);
      } else {
        if (!activeAttendant) setActiveAttendant(existing);
      }
      return;
    }

    const newAttendant: Attendant = {
      id: `att-${Date.now()}`,
      name: trimmed,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    storageService.saveAttendant(newAttendant);
    setAttendants((prev) => [...prev, newAttendant]);
    
    if (!activeAttendant) {
      setActiveAttendant(newAttendant);
    }
  }, [activeAttendant, attendants]);

  // Action: Update Attendant Status / Photo (e.g. toggle active/inactive)
  const updateAttendant = useCallback((attendant: Attendant): void => {
    storageService.updateAttendant(attendant);
    setAttendants((prev) => prev.map((a) => a.id === attendant.id ? attendant : a));
    
    // If we inactivated the active attendant, select another one
    if (activeAttendant?.id === attendant.id && !attendant.isActive) {
      const activeOnes = attendants.filter(a => a.id !== attendant.id && a.isActive);
      setActiveAttendant(activeOnes.length > 0 ? activeOnes[0] : null);
    }
  }, [activeAttendant, attendants]);

  // Action: Delete / Remove Attendant
  const deleteAttendant = useCallback((id: string): void => {
    storageService.deleteAttendant(id);
    setAttendants((prev) => prev.filter((a) => a.id !== id));

    // If we deleted the active attendant, select another one
    if (activeAttendant?.id === id) {
      const remainingActive = attendants.filter((a) => a.id !== id && a.isActive);
      setActiveAttendant(remainingActive.length > 0 ? remainingActive[0] : null);
    }
  }, [activeAttendant, attendants]);

  // Action: Update Settings
  const saveSettings = useCallback((newSettings: SystemSettings): void => {
    // When saving settings, user enters target stock in newSettings.initialStock.
    // Calculate net movements from active non-canceled movements so currentStock matches target
    let netMovements = 0;
    movements.forEach((m) => {
      if (m.isCanceled || m.status === 'cancelado') return;
      if (m.type === 'producao') netMovements += m.quantity;
      else if (m.type === 'venda' || m.type === 'cortesia' || m.type === 'perda') netMovements -= m.quantity;
    });

    const settingsToSave: SystemSettings = {
      ...newSettings,
      initialStock: newSettings.initialStock - netMovements,
    };

    storageService.saveSettings(settingsToSave);
    setSettings(settingsToSave);
  }, [movements]);

  // Action: Reset All Data to Zero (for tests)
 const resetAllData = useCallback(async (): Promise<void> => {
  await storageService.resetAllData();
    setMovements([]);
    setSettings({
      ...DEFAULT_SETTINGS,
      initialStock: 0,
    });
    const defaultAtts = storageService.getAttendants();
    setAttendants(defaultAtts);
    const activeOnes = defaultAtts.filter((a) => a.isActive);
    setActiveAttendant(activeOnes.length > 0 ? activeOnes[0] : null);
  }, []);

  // Backup helpers
  const exportBackup = useCallback(() => {
    exportDatabaseBackupToFile();
    setLastBackupTime(getLastBackupTimestamp());
  }, []);

  const importBackup = useCallback(async (file: File): Promise<{ success: boolean; message: string }> => {
    const result = await importDatabaseBackupFromFile(file);
    if (result.success) {
      setMovements(storageService.getMovements());
      setAttendants(storageService.getAttendants());
      setSettings(storageService.getSettings());
      setLastBackupTime(getLastBackupTimestamp());
    }
    return result;
  }, []);

  // Derived helpers
  const activeAttendants = useMemo(() => attendants.filter((a) => a.isActive), [attendants]);

  const todayMovements = useMemo(() => {
    return movements.filter((m) => isSameLocalDate(m.date, getLocalDateString()));
  }, [movements]);

  return {
    movements,
    attendants,
    activeAttendants,
    settings,
    stockResult,
    inconsistencyAlert,
    activeAttendant,
    setActiveAttendant,
    isAdminLoggedIn,
    setIsAdminLoggedIn,
    connectionState,
    isSyncing,
    isSupabaseActive,
    lastBackupTime,
    todayMovements,
    registerMovement,
    registerAdminMovement,
    removeMovement,
    cancelMovement,
    uncancelMovement,
    updateMovement,
    addAttendant,
    updateAttendant,
    deleteAttendant,
    saveSettings,
    resetAllData,
    exportBackup,
    importBackup,
    refreshRemoteData,
  };
}
