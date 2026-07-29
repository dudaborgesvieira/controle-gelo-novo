import { Movement } from '../../core/entities/movement';

/**
 * Exports movements to a CSV file that can be opened directly in Excel.
 * Formats data, headers, currency, and handles Portuguese encoding character issues.
 */
export function exportToExcel(movements: Movement[]): void {
  // UTF-8 Byte Order Mark (BOM) to make sure Excel handles accents (like "Ação", "Cartão", etc.) correctly in Portuguese
  const BOM = '\uFEFF';
  
  const headers = [
    'Identificador',
    'Status',
    'Motivo do Cancelamento',
    'Data',
    'Hora',
    'Frentista',
    'Tipo de Movimentação',
    'Quantidade (Sacos)',
    'Valor Unitário',
    'Valor Total',
    'Forma de Pagamento',
    'Desconto Concedido',
    'Autorizado Por',
    'Cortesia Para',
    'Motivo da Perda',
    'Observações'
  ];

  const rows = movements.map((m) => {
    const isCanceled = m.isCanceled || m.status === 'cancelado';
    const statusLabel = isCanceled ? 'CANCELADO' : 'ATIVO';

    const typeLabel = {
      venda: 'Venda',
      producao: 'Produção',
      cortesia: 'Cortesia',
      perda: 'Perda'
    }[m.type];

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
      m.quantity,
      m.unitPrice ? `R$ ${m.unitPrice.toFixed(2).replace('.', ',')}` : '',
      m.totalPrice ? `R$ ${m.totalPrice.toFixed(2).replace('.', ',')}` : '',
      paymentLabel,
      m.discount ? `R$ ${m.discount.valorConcedido.toFixed(2).replace('.', ',')} (${m.discount.percentual}%)` : 'R$ 0,00',
      m.discount ? m.discount.autorizadoPor : '',
      m.courtesyRecipient || '',
      lossReasonLabel,
      m.observation || ''
    ];
  });

  // Convert row items into CSV format (using semicolon ; which Excel expects for European/Brazilian locales)
  const csvContent = [
    headers.join(';'),
    ...rows.map((row) => row.map((val) => {
      // Escape semicolons and double quotes
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(';'))
  ].join('\n');

  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Controle_de_Gelo_Relatorio_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
