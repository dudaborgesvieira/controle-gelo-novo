import { StorageInterface } from './StorageInterface';
import { LocalStorageImpl } from './LocalStorageImpl';
import { Movement } from '../../core/entities/movement';
import { Attendant } from '../../core/entities/attendant';
import { SystemSettings } from '../../core/entities/settings';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabaseClient';

export class SupabaseStorageImpl implements StorageInterface {
  private localFallback = new LocalStorageImpl();

  private mapMovementToDb(m: Movement) {
    return {
      id: m.id,
      type: m.type,
      quantity: m.quantity,
      unit_price: m.unitPrice ?? 0,
      total_price: m.totalPrice ?? 0,
      attendant_id: m.attendantId || null,
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
      canceled_by: m.canceledBy || null,
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
    // Add remote movements
    remote.forEach((m) => map.set(m.id, m));
    // Overlay local movements so unsynced or updated local movements are preserved
    local.forEach((m) => {
      if (!map.has(m.id)) {
        map.set(m.id, m);
      } else {
        const remoteM = map.get(m.id)!;
        if (m.isCanceled || m.status === 'cancelado' || (m.timestamp && m.timestamp >= remoteM.timestamp)) {
          map.set(m.id, m);
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
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
    if (!isSupabaseConfigured()) return localData;

    const supabase = getSupabaseClient();
    if (!supabase) return localData;

    supabase
      .from('attendants')
      .select('*')
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const remoteAttendants: Attendant[] = data.map((r) => ({
            id: r.id,
            name: r.name,
            isActive: Boolean(r.is_active),
            createdAt: r.created_at || new Date().toISOString(),
          }));
          
          // Merge local and remote attendants so locally created ones are preserved
          const currentLocal = this.localFallback.getAttendants();
          const mergedMap = new Map<string, Attendant>();
          currentLocal.forEach((a) => mergedMap.set(a.id, a));
          remoteAttendants.forEach((a) => {
            // Prefer local state if active, or remote
            if (!mergedMap.has(a.id)) {
              mergedMap.set(a.id, a);
            }
          });
          const mergedList = Array.from(mergedMap.values());

          if (typeof window !== 'undefined') {
            localStorage.setItem('controle_gelo_attendants', JSON.stringify(mergedList));
          }
        }
      });

    return localData;
  }

  saveAttendant(attendant: Attendant): void {
    this.localFallback.saveAttendant(attendant);

    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase
      .from('attendants')
      .upsert({
        id: attendant.id,
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
        id: attendant.id,
        name: attendant.name,
        is_active: attendant.isActive ?? true,
        created_at: attendant.createdAt || new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error('Error updating attendant on Supabase:', error);
      });
  }

  getSettings(): SystemSettings {
    const localData = this.localFallback.getSettings();
    if (!isSupabaseConfigured()) return localData;

    const supabase = getSupabaseClient();
    if (!supabase) return localData;

    supabase
      .from('settings')
      .select('*')
      .eq('id', 'default')
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          const remoteSettings: SystemSettings = {
            ...localData,
            defaultIceBagPrice: Number(data.default_ice_bag_price || 16.0),
            initialStock: Number(data.initial_stock || 0),
            adminPassword: data.admin_password || '102035',
            pendingAdminPassword: data.pending_admin_password || undefined,
            minimumStockAlert: Number(data.minimum_stock_alert || 15),
            maxDiscountPercentage: Number(data.max_discount_percentage || 50),
            maxBagsPerSale: Number(data.max_bags_per_sale || 100),
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

    supabase
      .from('settings')
      .upsert({
        id: 'default',
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

  resetAllData(): void {
    this.localFallback.resetAllData();
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
      await supabase.from('settings').upsert({
        id: 'default',
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
          id: a.id,
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
