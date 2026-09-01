export interface SystemSettings {
  gasStationName: string;
  logoUrl?: string;
  defaultIceBagPrice: number;
  initialStock: number;
  adminPassword?: string; // Standard "102035" for admin panel, can be changed
  requireAdminForDiscount: boolean; // Permission: require admin PIN for discounts
  backupFrequency: 'diario' | 'semanal' | 'mensal' | 'desativado';
  
  // Advanced business rules
  minimumStockAlert: number; // Estoque mínimo para alertar reabastecimento
  maxDiscountPercentage: number; // Percentual máximo de desconto permitido
  maxBagsPerSale: number; // Quantidade máxima de sacos por operação
  requireObservationForLoss: boolean; // Exigir observação para registro de perda

  // Senior Admin approval fields
  pendingAdminPassword?: string; // Awaiting senior admin validation
}

export const DEFAULT_SETTINGS: SystemSettings = {
  gasStationName: 'Auto Posto Tropical',
  logoUrl: '',
  defaultIceBagPrice: 16.00, // R$ 16,00
  // A instalação nova deve começar zerada. O estoque real vem do Supabase
  // ou de uma entrada/ajuste explícito feito no sistema. O Supabase é a fonte oficial.
  initialStock: 0,
  adminPassword: '102035', // standard numeric passcode requested by user
  requireAdminForDiscount: false,
  backupFrequency: 'diario',
  
  // Advanced business rules defaults
  minimumStockAlert: 15,
  maxDiscountPercentage: 50, // Até 50% de desconto
  maxBagsPerSale: 100, // Máximo de 100 sacos de gelo por vez
  requireObservationForLoss: true, // Força justificar perda
};
