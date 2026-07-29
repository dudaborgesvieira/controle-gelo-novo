import { Movement } from '../../core/entities/movement';

/**
 * Exports movements to a standard RFC 4180 compliant CSV file.
 * Perfect for bookkeeping, auditing, and loading into databases or ERPs.
 * Uses comma (,) as the separator and standard UTF-8 BOM for wide compatibility.
 */
export function exportToCSV(movements: Movement[]): void {
  const BOM = '\uFEFF';
  
  const headers = [
    'id',
    'status',
    'motivo_cancelamento',
    'data',
    'hora',
    'frentista_nome',
    'tipo_movimentacao',
    'quantidade_sacos',
    'valor_unitario',
    'valor_total',
    'forma_pagamento',
    'desconto_concedido',
    'desconto_autorizado_por',
    'cortesia_destinatario',
    'motivo_perda',
    'observacoes'
  ];

  const rows = movements.map((m) => {
    const isCanceled = m.isCanceled || m.status === 'cancelado';
    const statusLabel = isCanceled ? 'CANCELADO' : 'ATIVO';

    const typeLabel = {
      venda: 'Venda',
      producao: 'Produção',
      cortesia: 'Cortesia',
      perda: 'Perda'
    }[m.type] || m.type;

    const paymentLabel = m.paymentMethod ? {
      credito: 'Cartão de Crédito',
      debito: 'Cartão de Débito',
      pix: 'Pix Maquininha',
      pix_cnpj: 'Pix CNPJ Direto',
      dinheiro: 'Dinheiro'
    }[m.paymentMethod] : '';

    const lossReasonLabel = m.lossReason ? {
      saco_rasgado: 'Saco rasgado',
      gelo_derretido: 'Gelo derretido',
      embalagem_danificada: 'Embalagem danificada',
      queda: 'Queda',
      outro: 'Outro'
    }[m.lossReason] : '';

    return [
      m.id,
      statusLabel,
      isCanceled ? (m.cancelReason || 'Cancelado') : '',
      m.date,
      m.time,
      m.attendantName,
      typeLabel,
      m.quantity.toString(),
      m.unitPrice ? m.unitPrice.toFixed(2) : '0.00',
      m.totalPrice ? m.totalPrice.toFixed(2) : '0.00',
      paymentLabel,
      m.discount ? m.discount.valorConcedido.toFixed(2) : '0.00',
      m.discount ? m.discount.autorizadoPor : '',
      m.courtesyRecipient || '',
      lossReasonLabel,
      m.observation || ''
    ];
  });

  // Generate standard CSV content
  const csvLines = [
    headers.join(','),
    ...rows.map((row) => 
      row.map((val) => {
        const cleanVal = String(val).replace(/"/g, '""');
        // Wrap in quotes if it contains commas, double quotes, or newlines
        if (cleanVal.includes(',') || cleanVal.includes('"') || cleanVal.includes('\n') || cleanVal.includes('\r')) {
          return `"${cleanVal}"`;
        }
        return cleanVal;
      }).join(',')
    )
  ];

  const csvContent = csvLines.join('\n');
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `movimentacoes_gelo_audit_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
