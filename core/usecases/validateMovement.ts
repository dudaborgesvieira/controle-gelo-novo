import { Movement, MovementType } from '../entities/movement';
import { SystemSettings } from '../entities/settings';

export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Validates whether a new movement is safe and has all required information.
 * E.g., prevents negative stocks and ensures required parameters are provided.
 */
export function validateMovement(
  movement: Partial<Movement>,
  currentStock: number,
  settings?: SystemSettings
): ValidationResult {
  const { type, quantity, courtesyRecipient, lossReason, observation, discount } = movement;

  if (quantity === undefined || quantity <= 0) {
    return {
      isValid: false,
      errorMessage: 'A quantidade deve ser maior do que zero.',
    };
  }

  // 1. Rule: Maximum quantity per operation
  const maxBags = settings?.maxBagsPerSale ?? 100;
  if (quantity > maxBags) {
    return {
      isValid: false,
      errorMessage: `Quantidade inválida! O limite máximo permitido por operação é de ${maxBags} sacos.`,
    };
  }

  // Validate specific fields per movement type
  if (type === 'cortesia') {
    if (!courtesyRecipient || courtesyRecipient.trim() === '') {
      return {
        isValid: false,
        errorMessage: 'O campo "Cortesia concedida para" é obrigatório.',
      };
    }
  }

  if (type === 'perda') {
    if (!lossReason) {
      return {
        isValid: false,
        errorMessage: 'O motivo da perda é obrigatório.',
      };
    }
    // 2. Rule: Exigir observação para registro de perda
    const requireObs = settings?.requireObservationForLoss ?? true;
    if (requireObs && (!observation || observation.trim() === '')) {
      return {
        isValid: false,
        errorMessage: 'Para lançar uma perda, a justificativa (observação) é obrigatória pelas regras de negócio do posto.',
      };
    }
  }

  // 3. Rule: Maximum discount percentage limit
  if (type === 'venda' && discount && discount.valorConcedido > 0) {
    const maxDiscountPct = settings?.maxDiscountPercentage ?? 50;
    if (discount.percentual > maxDiscountPct) {
      return {
        isValid: false,
        errorMessage: `Desconto não permitido! O percentual de desconto de ${discount.percentual}% excede o limite máximo configurado de ${maxDiscountPct}%.`,
      };
    }
  }

  // Check if this operation causes negative stock
  // Operations that subtract stock: venda, cortesia, perda
  const subtractsStock = type === 'venda' || type === 'cortesia' || type === 'perda';
  if (subtractsStock && currentStock < quantity) {
    return {
      isValid: false,
      errorMessage: `Estoque insuficiente! Estoque atual é de ${currentStock} sacos, mas você está tentando registrar a saída de ${quantity} sacos.`,
    };
  }

  return { isValid: true };
}
