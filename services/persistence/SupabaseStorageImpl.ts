import { SupabaseStorageImpl as LegacySupabaseStorageImpl } from './SupabaseStorageLegacy';
import { LocalStorageImpl } from './LocalStorageImpl';
import { Movement } from '../../core/entities/movement';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

/**
 * Production persistence layer.
 *
 * Movement creation is deliberately confirmed by Supabase before it is
 * accepted into the browser cache. This prevents the UI from reporting a
 * successful sale/production/courtesy/loss when the remote write failed.
 *
 * The remaining persistence behaviour stays in the legacy implementation
 * while the app is migrated incrementally to fully async writes.
 */
export class SupabaseStorageImpl extends LegacySupabaseStorageImpl {
  private confirmedLocalStorage = new LocalStorageImpl();

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

  override saveMovement(movement: Movement): void {
    const safeMovement = this.ensureMovementUuid(movement);

    if (!isSupabaseConfigured()) {
      const message = 'Não foi possível registrar a operação: Supabase não configurado.';
      if (typeof window !== 'undefined') window.alert(message);
      throw new Error(message);
    }

    if (typeof window === 'undefined') {
      throw new Error('A gravação confirmada de movimentações deve ocorrer no navegador.');
    }

    if (!navigator.onLine) {
      const message = 'Sem conexão com a internet. A operação NÃO foi registrada. Tente novamente quando a conexão voltar.';
      window.alert(message);
      throw new Error(message);
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      const message = 'Não foi possível registrar a operação: configuração do Supabase indisponível.';
      window.alert(message);
      throw new Error(message);
    }

    const payload = {
      id: safeMovement.id,
      type: safeMovement.type,
      quantity: safeMovement.quantity,
      unit_price: safeMovement.unitPrice ?? 0,
      total_price: safeMovement.totalPrice ?? 0,
      attendant_id: safeMovement.attendantId || null,
      attendant_name: safeMovement.attendantName,
      date: safeMovement.date,
      time: safeMovement.time,
      payment_method: safeMovement.paymentMethod || null,
      discount: safeMovement.discount || null,
      loss_reason: safeMovement.lossReason || null,
      courtesy_recipient: safeMovement.courtesyRecipient || null,
      observation: safeMovement.observation || null,
      is_canceled: Boolean(safeMovement.isCanceled || safeMovement.status === 'cancelado'),
      status: safeMovement.status || (safeMovement.isCanceled ? 'cancelado' : 'ativo'),
      canceled_at: safeMovement.canceledAt || null,
      canceled_by: safeMovement.canceledBy || null,
      cancel_reason: safeMovement.cancelReason || null,
      created_at: safeMovement.timestamp || new Date().toISOString(),
    };

    try {
      // A synchronous request is intentional here: the existing UI is still
      // synchronous. Returning only after PostgREST answers guarantees that the
      // current UI cannot display success before Supabase confirms the insert.
      const request = new XMLHttpRequest();
      request.open('POST', `${url}/rest/v1/movements?on_conflict=id`, false);
      request.setRequestHeader('apikey', key);
      request.setRequestHeader('Authorization', `Bearer ${key}`);
      request.setRequestHeader('Content-Type', 'application/json');
      request.setRequestHeader('Prefer', 'resolution=merge-duplicates,return=minimal');
      request.send(JSON.stringify(payload));

      if (request.status < 200 || request.status >= 300) {
        const detail = request.responseText ? ` (${request.responseText.slice(0, 180)})` : '';
        throw new Error(`Supabase respondeu HTTP ${request.status}${detail}`);
      }

      // Only after the remote confirmation do we update the browser cache.
      this.confirmedLocalStorage.saveMovement(safeMovement);
    } catch (error: any) {
      const detail = error?.message || 'falha desconhecida';
      const message = `A operação NÃO foi registrada no Supabase. Nenhuma baixa foi confirmada. Detalhe: ${detail}`;
      console.error(message, error);
      window.alert(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }
}

export const supabaseStorageService = new SupabaseStorageImpl();
