export type MovementType = 'venda' | 'producao' | 'cortesia' | 'perda';

export type PaymentMethod = 'credito' | 'debito' | 'pix' | 'pix_cnpj' | 'dinheiro';

export type LossReason = 'saco_rasgado' | 'gelo_derretido' | 'embalagem_danificada' | 'queda' | 'outro';

export interface DiscountInfo {
  valorOriginal: number;
  valorConcedido: number;
  valorFinal: number;
  percentual: number;
  autorizadoPor: string;
}

export interface Movement {
  id: string;
  timestamp: string; // ISO DateTime
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  attendantId: string;
  attendantName: string;
  type: MovementType;
  quantity: number;
  observation?: string;
  
  // Specific for Sales
  unitPrice?: number;
  totalPrice?: number;
  paymentMethod?: PaymentMethod;
  discount?: DiscountInfo;
  
  // Specific for Courtesy
  courtesyRecipient?: string; // "Cortesia concedida para"
  
  // Specific for Loss
  lossReason?: LossReason;

  // Cancellation tracking
  isCanceled?: boolean;
  status?: 'ativo' | 'cancelado';
  canceledAt?: string;
  canceledBy?: string;
  cancelReason?: string;
}

// Generate some nice realistic seed data representing transactions spanning today and yesterday
export const getSeedMovements = (): Movement[] => {
  const todayStr = '2026-07-16';
  const yesterdayStr = '2026-07-15';
  
  return [
    {
      id: 'mov-1',
      timestamp: `${yesterdayStr}T08:30:00Z`,
      date: yesterdayStr,
      time: '08:30',
      attendantId: 'att-1',
      attendantName: 'Danilo',
      type: 'producao',
      quantity: 50,
      observation: 'Produção inicial do turno da manhã',
    },
    {
      id: 'mov-2',
      timestamp: `${yesterdayStr}T10:15:00Z`,
      date: yesterdayStr,
      time: '10:15',
      attendantId: 'att-1',
      attendantName: 'Danilo',
      type: 'venda',
      quantity: 5,
      unitPrice: 10,
      totalPrice: 50,
      paymentMethod: 'pix',
    },
    {
      id: 'mov-3',
      timestamp: `${yesterdayStr}T11:45:00Z`,
      date: yesterdayStr,
      time: '11:45',
      attendantId: 'att-2',
      attendantName: 'Roseli',
      type: 'venda',
      quantity: 12,
      unitPrice: 10,
      totalPrice: 120,
      paymentMethod: 'credito',
    },
    {
      id: 'mov-4',
      timestamp: `${yesterdayStr}T14:00:00Z`,
      date: yesterdayStr,
      time: '14:00',
      attendantId: 'att-3',
      attendantName: 'Wagner',
      type: 'cortesia',
      quantity: 2,
      courtesyRecipient: 'Caminhoneiro parceiro da distribuidora',
    },
    {
      id: 'mov-5',
      timestamp: `${yesterdayStr}T16:30:00Z`,
      date: yesterdayStr,
      time: '16:30',
      attendantId: 'att-4',
      attendantName: 'Luciano',
      type: 'perda',
      quantity: 3,
      lossReason: 'gelo_derretido',
      observation: 'Ficou fora do freezer durante reposição',
    },
    {
      id: 'mov-6',
      timestamp: `${yesterdayStr}T19:15:00Z`,
      date: yesterdayStr,
      time: '19:15',
      attendantId: 'att-1',
      attendantName: 'Danilo',
      type: 'venda',
      quantity: 10,
      unitPrice: 10,
      totalPrice: 80,
      paymentMethod: 'pix_cnpj',
      discount: {
        valorOriginal: 100,
        valorConcedido: 20,
        valorFinal: 80,
        percentual: 20,
        autorizadoPor: 'Administrador (Supervisor)',
      }
    },
    {
      id: 'mov-7',
      timestamp: `${todayStr}T07:15:00Z`,
      date: todayStr,
      time: '07:15',
      attendantId: 'att-2',
      attendantName: 'Roseli',
      type: 'producao',
      quantity: 40,
      observation: 'Recarga rápida da máquina de gelo',
    },
    {
      id: 'mov-8',
      timestamp: `${todayStr}T09:45:00Z`,
      date: todayStr,
      time: '09:45',
      attendantId: 'att-1',
      attendantName: 'Danilo',
      type: 'venda',
      quantity: 12,
      unitPrice: 10,
      totalPrice: 120,
      paymentMethod: 'pix',
    },
    {
      id: 'mov-9',
      timestamp: `${todayStr}T11:20:00Z`,
      date: todayStr,
      time: '11:20',
      attendantId: 'att-2',
      attendantName: 'Roseli',
      type: 'venda',
      quantity: 8,
      unitPrice: 10,
      totalPrice: 80,
      paymentMethod: 'debito',
    },
    {
      id: 'mov-10',
      timestamp: `${todayStr}T13:10:00Z`,
      date: todayStr,
      time: '13:10',
      attendantId: 'att-3',
      attendantName: 'Wagner',
      type: 'venda',
      quantity: 5,
      unitPrice: 10,
      totalPrice: 50,
      paymentMethod: 'dinheiro',
    },
    {
      id: 'mov-11',
      timestamp: `${todayStr}T14:45:00Z`,
      date: todayStr,
      time: '14:45',
      attendantId: 'att-4',
      attendantName: 'Luciano',
      type: 'venda',
      quantity: 3,
      unitPrice: 10,
      totalPrice: 30,
      paymentMethod: 'pix',
    },
    {
      id: 'mov-12',
      timestamp: `${todayStr}T15:30:00Z`,
      date: todayStr,
      time: '15:30',
      attendantId: 'att-3',
      attendantName: 'Wagner',
      type: 'cortesia',
      quantity: 2,
      courtesyRecipient: 'Cliente VIP - Abastecimento completo',
    },
    {
      id: 'mov-13',
      timestamp: `${todayStr}T16:00:00Z`,
      date: todayStr,
      time: '16:00',
      attendantId: 'att-2',
      attendantName: 'Roseli',
      type: 'perda',
      quantity: 1,
      lossReason: 'saco_rasgado',
      observation: 'Rachou ao retirar do freezer vertical',
    }
  ];
};
