import { StorageInterface } from './StorageInterface';
import { LocalStorageImpl } from './LocalStorageImpl';
import { Movement } from '../../core/entities/movement';
import { Attendant } from '../../core/entities/attendant';
import { SystemSettings } from '../../core/entities/settings';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabaseClient';

export class SupabaseStorageImpl implements StorageInterface {
  private localFallback = new LocalStorageImpl();

  private isUuid(val: string | null | undefined): boolean {
    if (!val || val === 'default') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(val);
  }

  private stringToUuid(str: string): string {
    if (!str || str === 'default') return crypto.randomUUID();
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    let hex = '';
    for (let i = 0; i < str.length; i++) {
      hex += str.charCodeAt(i).toString(16);
    }
    hex = (hex + Math.abs(hash).toString(16).repeat(8) + '0123456789abcdef').slice(0, 32);
    const part1 = hex.slice(0, 8);
    const part2 = hex.slice(8, 12);
    const part3 = '4' + hex.slice(13, 16);
    const part4 = 'a' + hex.slice(17, 20);
    const part5 = hex.slice(20, 32);
    return `${part1}-${part2}-${part3}-${part4}-${part5}`;
  }

  private toValidUuidOrNull(val: string | null | undefined): string | null {
    if (!val || val === 'default' || val.trim() === '' || val === 'null' || val === 'undefined') {
      return null;
    }
    if (this.isUuid(val)) {
      return val;
    }
    return this.stringToUuid(val);
  }

  private toValidUuid(val: string | null | undefined): string {
    if (!val || val === 'default' || val.trim() === '' || val === 'null' || val === 'undefined') {
      return crypto.randomUUID();
    }
    if (this.isUuid(val)) {
      return val;
    }
    return this.stringToUuid(val);
  }

  private mapMovementToDb(m: Movement) {
    return {
      id: this.toValidUuid(m.id),
      type: m.type,
      quantity: m.quantity,
      unit_price: m.unitPrice ?? 0,
      total_price: m.totalPrice ?? 0,
      attendant_id: this.toValidUuidOrNull(m.attendantId),
      attendant_name: m.attendantName,
      date: m.date,
      time: m.time,
      payment_method: m.paymentMethod || null,
      discount: m.discount ? JSON.stringify(m.discount) : null,
      loss_reason: m.lossReason || null,
      courtesy_recipient: m.courtesyRecipient || null,
      observation: m.observation || null,
      is_canceled: Boolean(m.isCanceled || m.status === 'cancelado'),
      status: m.status || (m.isCanceled ? 'cancelado' : 'ativo'),
      canceled_at: m.canceledAt || null,
      canceled_by: this.toValidUuidOrNull(m.canceledBy),
      cancel_reason: m.cancelReason || null,
      created_at: m.timestamp || new Date().toISOString(),
    };
  }

  private mapDbToMovement(row: any): Movement {
    let discountObj = undefined;
    if (row.discount) {
      try {
        discountObj = typeof row.discount === 'string' ? JSON.parse(row.discount) : row.discount;
      } catch {
        discountObj = undefined;
      }
    }

    return {
      id: row.id,
      timestamp: row.created_at || new Date().toISOString(),
      type: row.type,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price || 0),
      totalPrice: Number(row.total_price || 0),
      attendantId: row.attendant_id || '',
      attendantName: row.attendant_name,
      date: row.date,
      time: row.time,
      paymentMethod: row.payment_method || undefined,
      discount: discountObj,
      lossReason: row.loss_reason || undefined,
      courtesyRecipient: row.courtesy_recipient || undefined,
      observation: row.observation || undefined,
      isCanceled: Boolean(row.is_canceled || row.status === 'cancelado'),
      status: row.status || (row.is_canceled ? 'cancelado' : 'ativo'),
      canceledAt: row.canceled_at || undefined,
      canceledBy: row.canceled_by || undefined,
      cancelReason: row.cancel_reason || undefined,
    };
  }

 private mergeMovements(local: Movement[], remote: Movement[]): Movement[] {
  const map = new Map<string, Movement>();

  remote.forEach((movement) => {
    const normalizedId = this.toValidUuid(movement.id);
    map.set(normalizedId, movement);
  });

  local.forEach((movement) => {
    const normalizedId = this.toValidUuid(movement.id);
    const remoteMovement = map.get(normalizedId);

    if (
      !remoteMovement ||
      movement.isCanceled ||
      movement.status === 'cancelado' ||
      (movement.timestamp && movement.timestamp >= remoteMovement.timestamp)
    ) {
      map.set(normalizedId, movement);
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    b.timestamp > a.timestamp ? 1 : -1
  );
}

  getMovements(): Movement[] {
    const localData = this.localFallback.getMovements();
    if (!isSupabaseConfigured()) return localData;

    const supabase = getSupabaseClient();
    if (!supabase) return localData;

    // Trigger async fetch & cache refresh
    supabase
      .from('movements')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.warn('Supabase movements sync note:', error.message || error);
          return;
        }
        if (data && data.length > 0) {
          const remoteMovements = data.map((r) => this.mapDbToMovement(r));
          const currentLocal = this.localFallback.getMovements();
          const merged = this.mergeMovements(currentLocal, remoteMovements);
          if (typeof window !== 'undefined') {
            localStorage.setItem('controle_gelo_movements', JSON.stringify(merged));
          }
        }
      });

    return localData;
  }

  async fetchMovementsAsync(): Promise<Movement[]> {
    if (!isSupabaseConfigured()) return this.localFallback.getMovements();
    const supabase = getSupabaseClient();
    if (!supabase) return this.localFallback.getMovements();

    const { data, error } = await supabase
      .from('movements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return this.localFallback.getMovements();
    }

    const remoteMovements = data.map((r) => this.mapDbToMovement(r));
    const currentLocal = this.localFallback.getMovements();
    const merged = this.mergeMovements(currentLocal, remoteMovements);
    if (typeof window !== 'undefined') {
      localStorage.setItem('controle_gelo_movements', JSON.stringify(merged));
    }
    return merged;
  }

  saveMovement(movement: Movement): void {
    // Always persist locally
    this.localFallback.saveMovement(movement);

    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase
      .from('movements')
      .upsert(this.mapMovementToDb(movement))
      .then(({ error }) => {
        if (error) console.error('Error saving movement to Supabase:', error);
      });
  }

  deleteMovement(id: string): void {
    this.localFallback.deleteMovement(id);

    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase
      .from('movements')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('Error deleting movement from Supabase:', error);
      });
  }

  updateMovement(movement: Movement): void {
    this.localFallback.updateMovement(movement);

    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase
      .from('movements')
      .upsert(this.mapMovementToDb(movement))
      .then(({ error }) => {
        if (error) console.error('Error updating movement on Supabase:', error);
      });
  }

getAttendants(): Attendant[] {
  const localData = this.localFallback.getAttendants();

  const uniqueActive = new Map<string, Attendant>();

  localData
    .filter((attendant) => attendant.isActive)
    .forEach((attendant) => {
      const normalizedName = attendant.name.trim().toLowerCase();

      if (!uniqueActive.has(normalizedName)) {
        uniqueActive.set(normalizedName, attendant);
      }
    });

  const cleanLocalList = Array.from(uniqueActive.values());

  if (!isSupabaseConfigured()) {
    return cleanLocalList;
  }

  const supabase = getSupabaseClient();

  if (!supabase) {
    return cleanLocalList;
  }

  this.fetchAttendantsAsync().catch((error) => {
    console.error('Erro ao atualizar frentistas do Supabase:', error);
  });

  return cleanLocalList;
}  

  saveAttendant(attendant: Attendant): void {
    this.localFallback.saveAttendant(attendant);

    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase
      .from('attendants')
      .upsert({
        id: this.toValidUuid(attendant.id),
        name: attendant.name,
        is_active: attendant.isActive ?? true,
        created_at: attendant.createdAt || new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error('Error saving attendant to Supabase:', error);
      });
  }

  updateAttendant(attendant: Attendant): void {
    this.localFallback.updateAttendant(attendant);

    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase
      .from('attendants')
      .upsert({
        id: this.toValidUuid(attendant.id),
        name: attendant.name,
        is_active: attendant.isActive ?? true,
        created_at: attendant.createdAt || new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error('Error updating attendant on Supabase:', error);
      });
  }
  async fetchAttendantsAsync(): Promise<Attendant[]> {
    if (!isSupabaseConfigured()) {
      return this.localFallback.getAttendants();
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return this.localFallback.getAttendants();
    }

    const { data, error } = await supabase.from('attendants').select('*');
    if (error || !data) {
      return this.localFallback.getAttendants();
    }

    const remoteAttendants: Attendant[] = data.map((r) => ({
      id: r.id,
      name: r.name,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at || new Date().toISOString(),
    }));

    const uniqueByName = new Map<string, Attendant>();
    remoteAttendants.forEach((attendant) => {
      const normalizedName = attendant.name.trim().toLowerCase();
      const existing = uniqueByName.get(normalizedName);
      if (!existing || attendant.isActive) {
        uniqueByName.set(normalizedName, attendant);
      }
    });

    const cleanList = Array.from(uniqueByName.values());
    if (typeof window !== 'undefined') {
      localStorage.setItem('controle_gelo_attendants', JSON.stringify(cleanList));
    }

    return cleanList;
  }

  async fetchSettingsAsync(): Promise<SystemSettings> {
    const localData = this.localFallback.getSettings();
    if (!isSupabaseConfigured()) return localData;

    const supabase = getSupabaseClient();
    if (!supabase) return localData;

    const { data, error } = await supabase.from('settings').select('*').limit(1);
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) {
      return localData;
    }

    const remoteSettings: SystemSettings = {
      ...localData,
      defaultIceBagPrice: Number(row.default_ice_bag_price || 16.0),
      initialStock: Number(row.initial_stock || 0),
      adminPassword: row.admin_password || '102035',
      pendingAdminPassword: row.pending_admin_password || undefined,
      minimumStockAlert: Number(row.minimum_stock_alert || 15),
      maxDiscountPercentage: Number(row.max_discount_percentage || 50),
      maxBagsPerSale: Number(row.max_bags_per_sale || 100),
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem('controle_gelo_settings', JSON.stringify(remoteSettings));
    }

    return remoteSettings;
  }

  getSettings(): SystemSettings {
    const localData = this.localFallback.getSettings();
    if (!isSupabaseConfigured()) return localData;

    const supabase = getSupabaseClient();
    if (!supabase) return localData;

    supabase
      .from('settings')
      .select('*')
      .limit(1)
      .then(({ data, error }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (!error && row) {
          const remoteSettings: SystemSettings = {
            ...localData,
            defaultIceBagPrice: Number(row.default_ice_bag_price || 16.0),
            initialStock: Number(row.initial_stock || 0),
            adminPassword: row.admin_password || '102035',
            pendingAdminPassword: row.pending_admin_password || undefined,
            minimumStockAlert: Number(row.minimum_stock_alert || 15),
            maxDiscountPercentage: Number(row.max_discount_percentage || 50),
            maxBagsPerSale: Number(row.max_bags_per_sale || 100),
          };
          if (typeof window !== 'undefined') {
            localStorage.setItem('controle_gelo_settings', JSON.stringify(remoteSettings));
          }
        }
      });

    return localData;
  }

  saveSettings(settings: SystemSettings): void {
    this.localFallback.saveSettings(settings);

    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const settingsId = '00000000-0000-0000-0000-000000000000';

    supabase
      .from('settings')
      .upsert({
        id: settingsId,
        default_ice_bag_price: settings.defaultIceBagPrice,
        initial_stock: settings.initialStock,
        admin_password: settings.adminPassword,
        pending_admin_password: settings.pendingAdminPassword || null,
        minimum_stock_alert: settings.minimumStockAlert,
        max_discount_percentage: settings.maxDiscountPercentage,
        max_bags_per_sale: settings.maxBagsPerSale,
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error('Error saving settings to Supabase:', error);
      });
  }

  getOfflineLogs(): any[] {
    return this.localFallback.getOfflineLogs();
  }

  clearOfflineLogs(): void {
    this.localFallback.clearOfflineLogs();
  }

 async resetAllData(): Promise<void> {
  this.localFallback.resetAllData();

  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error: movementsError } = await supabase
    .from('movements')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (movementsError) {
    console.error('Erro ao limpar movimentações:', movementsError);
    throw movementsError;
  }

  const { error: settingsError } = await supabase
    .from('settings')
    .update({ initial_stock: 0 })
    .eq('id', '00000000-0000-0000-0000-000000000000');

  if (settingsError) {
    console.error('Erro ao resetar configurações:', settingsError);
    throw settingsError;
  }
}

  // Push all existing local movements and attendants to Supabase on first connect
  async syncLocalDataToSupabase(): Promise<{ success: boolean; syncedCount: number }> {
    if (!isSupabaseConfigured()) {
      return { success: false, syncedCount: 0 };
    }
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, syncedCount: 0 };

    try {
      const localMovements = this.localFallback.getMovements();
      const localAttendants = this.localFallback.getAttendants();
      const localSettings = this.localFallback.getSettings();

      // 1. Sync Settings
      const settingsId = '00000000-0000-0000-0000-000000000000';
      await supabase.from('settings').upsert({
        id: settingsId,
        default_ice_bag_price: localSettings.defaultIceBagPrice,
        initial_stock: localSettings.initialStock,
        admin_password: localSettings.adminPassword,
        minimum_stock_alert: localSettings.minimumStockAlert,
        max_discount_percentage: localSettings.maxDiscountPercentage,
        max_bags_per_sale: localSettings.maxBagsPerSale,
      });

      // 2. Sync Attendants
      if (localAttendants.length > 0) {
        const mappedAttendants = localAttendants.map((a) => ({
          id: this.toValidUuid(a.id),
          name: a.name,
          is_active: a.isActive ?? true,
          created_at: a.createdAt || new Date().toISOString(),
        }));
        await supabase.from('attendants').upsert(mappedAttendants);
      }

      // 3. Sync Movements
      if (localMovements.length > 0) {
        const mappedMovements = localMovements.map((m) => this.mapMovementToDb(m));
        await supabase.from('movements').upsert(mappedMovements);
      }

      return { success: true, syncedCount: localMovements.length };
    } catch (err) {
      console.error('Error in syncLocalDataToSupabase:', err);
      return { success: false, syncedCount: 0 };
    }
  }
}

export const supabaseStorageService = new SupabaseStorageImpl();
