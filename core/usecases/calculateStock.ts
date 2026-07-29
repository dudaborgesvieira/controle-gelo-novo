import { Movement } from '../entities/movement';

export interface StockCalculationResult {
  currentStock: number;
  initialStock: number;
  totalProduced: number;
  totalSold: number;
  totalCourtesy: number;
  totalLost: number;
  hasInconsistency: boolean;
  inconsistencyMessage?: string;
}

/**
 * Calculates current stock and other metrics based on historical movements.
 * Formula: Estoque Atual = Estoque Inicial + Produção − Vendas − Cortesias − Perdas.
 */
export function calculateStock(
  initialStock: number,
  movements: Movement[]
): StockCalculationResult {
  let totalProduced = 0;
  let totalSold = 0;
  let totalCourtesy = 0;
  let totalLost = 0;

  movements.forEach((mov) => {
    // Ignore canceled movements for active stock calculation
    if (mov.isCanceled || mov.status === 'cancelado') return;

    switch (mov.type) {
      case 'producao':
        totalProduced += mov.quantity;
        break;
      case 'venda':
        totalSold += mov.quantity;
        break;
      case 'cortesia':
        totalCourtesy += mov.quantity;
        break;
      case 'perda':
        totalLost += mov.quantity;
        break;
    }
  });

  const currentStock = initialStock + totalProduced - totalSold - totalCourtesy - totalLost;
  const hasInconsistency = currentStock < 0;

  return {
    currentStock: Math.max(0, currentStock), // Never permit actual negative stock representation
    initialStock,
    totalProduced,
    totalSold,
    totalCourtesy,
    totalLost,
    hasInconsistency,
    inconsistencyMessage: hasInconsistency
      ? `Aviso de inconsistência: O estoque calculado resultou em um valor negativo (${currentStock} sacos). Por favor, revise os registros!`
      : undefined,
  };
}
