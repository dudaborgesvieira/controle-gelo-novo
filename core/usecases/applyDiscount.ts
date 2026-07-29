import { DiscountInfo } from '../entities/movement';

export interface DiscountInput {
  quantity: number;
  originalUnitPrice: number;
  discountType: 'unitPrice' | 'totalAmount';
  value: number; // New unit price, or flat discount amount
  authorizedBy: string;
}

/**
 * Calculates and returns a full DiscountInfo object.
 */
export function calculateDiscount(input: DiscountInput): DiscountInfo {
  const { quantity, originalUnitPrice, discountType, value, authorizedBy } = input;
  const valorOriginal = originalUnitPrice * quantity;

  let valorFinal = valorOriginal;
  let valorConcedido = 0;

  if (discountType === 'unitPrice') {
    // value represents the new unit price
    const finalUnitPrice = Math.max(0, Math.min(originalUnitPrice, value));
    valorFinal = finalUnitPrice * quantity;
    valorConcedido = valorOriginal - valorFinal;
  } else {
    // value represents the total flat discount amount
    valorConcedido = Math.max(0, Math.min(valorOriginal, value));
    valorFinal = valorOriginal - valorConcedido;
  }

  const percentual = valorOriginal > 0 ? (valorConcedido / valorOriginal) * 100 : 0;

  return {
    valorOriginal,
    valorConcedido,
    valorFinal,
    percentual: parseFloat(percentual.toFixed(2)),
    autorizadoPor: authorizedBy || 'Frentista',
  };
}
