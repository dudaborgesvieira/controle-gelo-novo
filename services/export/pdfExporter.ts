import { Movement } from '../../core/entities/movement';

/**
 * Creates a print-friendly document representing the operations report and triggers the native browser print/save-to-pdf flow.
 */
export function exportToPDF(movements: Movement[], stats: {
  currentStock: number;
  totalSales: number;
  salesVolume: number;
  totalLosses: number;
  totalProduction: number;
  totalCourtesy: number;
  totalCanceled?: number;
  totalCanceledValue?: number;
}): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Erro ao abrir janela de exportação de PDF. Por favor, desative o bloqueador de popups.');
    return;
  }

  const todayStr = new Date().toLocaleDateString('pt-BR');
  
  const typeMap = {
    venda: 'Venda',
    producao: 'Produção',
    cortesia: 'Cortesia',
    perda: 'Perda'
  };

  const rowsHTML = movements.map((m) => {
    const isCanceled = m.isCanceled || m.status === 'cancelado';

    const detail = m.type === 'venda'
      ? `Pgto: ${m.paymentMethod === 'credito' ? 'C. Crédito' : m.paymentMethod === 'debito' ? 'C. Débito' : m.paymentMethod === 'pix' ? 'Pix Maq.' : m.paymentMethod === 'pix_cnpj' ? 'Pix CNPJ' : 'Dinheiro'}${m.discount ? ` (Desc: R$ ${m.discount.valorConcedido.toFixed(2)})` : ''}`
      : m.type === 'cortesia'
      ? `Para: ${m.courtesyRecipient}`
      : m.type === 'perda'
      ? `Motivo: ${m.lossReason === 'saco_rasgado' ? 'Saco Rasgado' : m.lossReason === 'gelo_derretido' ? 'Gelo Derretido' : m.lossReason === 'embalagem_danificada' ? 'Emb. Danificada' : m.lossReason === 'queda' ? 'Queda' : 'Outro'}`
      : 'Produção de estoque';

    const value = m.type === 'venda'
      ? `R$ ${m.totalPrice?.toFixed(2).replace('.', ',')}`
      : 'R$ 0,00';

    const cancelNotice = isCanceled
      ? `<br><strong style="color: #93000a; font-size: 11px;">[CANCELADO] Motivo: ${m.cancelReason || 'Cancelamento solicitado no sistema'}</strong>`
      : '';

    const rowClass = isCanceled ? 'class="canceled-row"' : '';
    const badgeHTML = isCanceled
      ? `<span class="badge cancelado">CANCELADO</span>`
      : `<span class="badge ${m.type}">${typeMap[m.type]}</span>`;

    return `
      <tr ${rowClass}>
        <td><strong>${m.id}</strong></td>
        <td>${m.date} - ${m.time}</td>
        <td>${m.attendantName}</td>
        <td>${badgeHTML}</td>
        <td style="text-align: center; ${isCanceled ? 'text-decoration: line-through;' : ''}">${m.quantity}</td>
        <td style="${isCanceled ? 'text-decoration: line-through; color: #999;' : ''}">${value}</td>
        <td><small>${detail} ${m.observation ? ` - Obs: ${m.observation}` : ''} ${cancelNotice}</small></td>
      </tr>
    `;
  }).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Relatório - Controle de Gelo</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: #1c1b1f;
          padding: 30px;
          line-height: 1.4;
        }
        .header {
          border-bottom: 2px solid #00488d;
          padding-bottom: 15px;
          margin-bottom: 30px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header h1 {
          color: #00488d;
          margin: 0;
          font-size: 26px;
          font-weight: 700;
        }
        .header p {
          margin: 5px 0 0 0;
          color: #424752;
          font-size: 14px;
        }
        .date {
          text-align: right;
          font-size: 14px;
          color: #727783;
        }
        .grid-stats {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 15px;
          margin-bottom: 30px;
        }
        .stat-card {
          border: 1px solid #c2c6d4;
          border-radius: 8px;
          padding: 12px;
          background-color: #f7f2f8;
          text-align: center;
        }
        .stat-card h4 {
          margin: 0 0 5px 0;
          font-size: 11px;
          color: #424752;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .stat-card p {
          margin: 0;
          font-size: 18px;
          font-weight: bold;
          color: #00488d;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
          font-size: 12px;
        }
        th {
          background-color: #00488d;
          color: #ffffff;
          text-align: left;
          padding: 10px;
          font-weight: 600;
        }
        td {
          padding: 10px;
          border-bottom: 1px solid #c2c6d4;
        }
        .badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: bold;
          text-transform: uppercase;
        }
        .badge.venda { background-color: #d6e3ff; color: #001b3d; }
        .badge.producao { background-color: #e9ddff; color: #22005d; }
        .badge.cortesia { background-color: #a3f69c; color: #002204; }
        .badge.perda { background-color: #ffdad6; color: #93000a; }
        .badge.cancelado { background-color: #ffdad6; color: #93000a; border: 1px solid #ffb4ab; }
        
        tr.canceled-row { background-color: #fff8f8; }
        tr.canceled-row td { color: #777; }
        
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>Controle de Gelo - Relatório de Movimentações</h1>
          <p>Posto de Combustíveis - Sistema de Controle Integrado</p>
        </div>
        <div class="date">
          Emitido em: ${todayStr}<br>
          <button class="no-print" style="margin-top:10px; padding: 6px 14px; background:#00488d; color:#fff; border:none; border-radius:4px; cursor:pointer;" onclick="window.print()">Imprimir / Salvar PDF</button>
        </div>
      </div>

      <div class="grid-stats" style="grid-template-columns: repeat(7, 1fr);">
        <div class="stat-card">
          <h4>Estoque Atual</h4>
          <p>${stats.currentStock} sacos</p>
        </div>
        <div class="stat-card">
          <h4>Vendas Totais</h4>
          <p>R$ ${stats.totalSales.toFixed(2).replace('.', ',')}</p>
        </div>
        <div class="stat-card">
          <h4>Sacos Vendidos</h4>
          <p>${stats.salesVolume} un</p>
        </div>
        <div class="stat-card">
          <h4>Produção</h4>
          <p>${stats.totalProduction} un</p>
        </div>
        <div class="stat-card">
          <h4>Cortesias</h4>
          <p>${stats.totalCourtesy} un</p>
        </div>
        <div class="stat-card">
          <h4>Perdas</h4>
          <p>${stats.totalLosses} un</p>
        </div>
        <div class="stat-card" style="border-color: #ffb4ab; background-color: #fff5f5;">
          <h4 style="color: #93000a;">Cancelados</h4>
          <p style="color: #93000a; font-size: 14px;">${stats.totalCanceled || 0} reg<br><small style="font-size: 10px;">R$ ${(stats.totalCanceledValue || 0).toFixed(2).replace('.', ',')}</small></p>
        </div>
      </div>

      <h2>Histórico Completo de Lançamentos (${movements.length} registros)</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Data/Hora</th>
            <th>Frentista</th>
            <th>Tipo</th>
            <th style="text-align: center;">Qtd (Sacos)</th>
            <th>Valor Financeiro</th>
            <th>Detalhes e Observações</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>

      <script>
        // Automatically trigger print dialog on load
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            window.print();
          }, 500);
        });
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
