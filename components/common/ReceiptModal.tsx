'use client';

import React, { useEffect } from 'react';
import { Movement } from '../../core/entities/movement';

interface ReceiptModalProps {
  movement: Movement | null;
  onClose: () => void;
  autoPrint?: boolean;
  stationName?: string;
}

export default function ReceiptModal({ 
  movement, 
  onClose, 
  autoPrint = false,
  stationName = 'Auto Posto Tropical'
}: ReceiptModalProps) {
  
  if (!movement) return null;

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'venda':
        return 'COMPROVANTE DE VENDA';
      case 'cortesia':
        return 'COMPROVANTE DE CORTESIA';
      case 'perda':
        return 'REGISTRO DE PERDA';
      case 'producao':
        return 'ENTRADA DE PRODUÇÃO';
      default:
        return 'MOVIMENTAÇÃO DE ESTOQUE';
    }
  };

  const formattedDate = movement.date 
    ? movement.date.split('-').reverse().join('/') 
    : new Date().toLocaleDateString('pt-BR');

  const unitPrice = movement.unitPrice ?? 16;
  const subtotal = movement.quantity * unitPrice;
  const discountVal = movement.discount?.valorConcedido ?? 0;
  const finalTotal = movement.totalPrice ?? (subtotal - discountVal);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      
      {/* Screen Modal Container */}
      <div className="bg-white text-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 relative my-8">
        
        {/* Top bar controls */}
        <div className="flex items-center justify-between border-b pb-3 border-slate-100">
          <div className="flex items-center gap-2 text-primary font-bold">
            <span className="material-symbols-outlined">print</span>
            <span>Comprovante de Operação</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
            title="Fechar"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Live Thermal Receipt Preview Box */}
        <div 
          id="thermal-receipt-printable" 
          className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-4 font-mono text-xs text-slate-900 space-y-2 select-text shadow-inner"
        >
          {/* Header */}
          <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-2">
            <p className="font-bold text-sm tracking-wider uppercase">{stationName || 'AUTO POSTO TROPICAL'}</p>
            <p className="font-semibold text-[11px] uppercase">CONTROLE DE ESTOQUE - GELO</p>
            <p className="text-[10px] text-slate-600 font-sans tracking-wide">COMPROVANTE NÃO FISCAL</p>
          </div>

          {/* Type Badge */}
          <div className="text-center py-1">
            <span className="font-extrabold text-sm uppercase px-2 py-0.5 border border-slate-800 rounded">
              {getTypeName(movement.type)}
            </span>
          </div>

          {/* Info Block */}
          <div className="space-y-1 text-[11px] pt-1">
            <div className="flex justify-between">
              <span>Data: <b>{formattedDate}</b></span>
              <span>Hora: <b>{movement.time || '10:00'}</b></span>
            </div>
            <div className="flex justify-between">
              <span>Controle #: <b>{movement.id}</b></span>
            </div>
            <div>
              <span>Vendedor/Atendente: <b>{movement.attendantName}</b></span>
            </div>
          </div>

          <p className="border-b border-dashed border-slate-300 my-1"></p>

          {/* Product & Quantity */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between font-bold">
              <span>PRODUTO</span>
              <span>QTD</span>
            </div>
            <div className="flex justify-between text-slate-800">
              <span>Saco de Gelo (Pacote)</span>
              <span className="font-bold text-sm">{movement.quantity} un</span>
            </div>

            {movement.type === 'venda' && (
              <>
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Preço Unitário:</span>
                  <span>R$ {unitPrice.toFixed(2).replace('.', ',')}</span>
                </div>

                {movement.discount && movement.discount.valorConcedido > 0 && (
                  <div className="bg-amber-50 p-1.5 rounded border border-amber-200 text-[10px] space-y-0.5 my-1">
                    <div className="flex justify-between text-amber-900">
                      <span>Subtotal:</span>
                      <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div className="flex justify-between font-bold text-red-600">
                      <span>Desconto ({movement.discount.percentual}%):</span>
                      <span>- R$ {discountVal.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div className="text-[9px] text-amber-800 italic">
                      Autorizado por: {movement.discount.autorizadoPor}
                    </div>
                  </div>
                )}

                <p className="border-b border-dashed border-slate-300 my-1"></p>

                <div className="flex justify-between text-sm font-extrabold pt-0.5">
                  <span>VALOR TOTAL:</span>
                  <span>R$ {finalTotal.toFixed(2).replace('.', ',')}</span>
                </div>

                {movement.paymentMethod && (
                  <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                    <span>Forma de Pagamento:</span>
                    <span className="uppercase">{movement.paymentMethod}</span>
                  </div>
                )}
              </>
            )}

            {movement.type === 'cortesia' && (
              <div className="bg-blue-50 p-2 rounded border border-blue-200 space-y-1 mt-1 text-[11px]">
                <p className="font-bold text-blue-900">DESTINATÁRIO DA CORTESIA:</p>
                <p className="text-blue-800 font-medium">{movement.courtesyRecipient || 'Não especificado'}</p>
                <p className="text-[10px] text-blue-700">Valor Cortesia: R$ {(movement.quantity * unitPrice).toFixed(2).replace('.', ',')}</p>
              </div>
            )}

            {movement.type === 'perda' && (
              <div className="bg-red-50 p-2 rounded border border-red-200 space-y-1 mt-1 text-[11px]">
                <p className="font-bold text-red-900">MOTIVO DA PERDA:</p>
                <p className="text-red-800 font-medium uppercase">{movement.lossReason ? movement.lossReason.replace('_', ' ') : 'Outro'}</p>
              </div>
            )}

            {movement.type === 'producao' && (
              <div className="bg-emerald-50 p-2 rounded border border-emerald-200 text-[11px] mt-1 text-emerald-900 font-bold text-center">
                + ENTRADA NO ESTOQUE
              </div>
            )}

            {movement.observation && (
              <div className="text-[10px] text-slate-600 pt-1 border-t border-dashed border-slate-300 mt-1">
                <span className="font-bold">Obs:</span> {movement.observation}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center pt-2 border-t border-dashed border-slate-400 text-[10px] text-slate-500 space-y-0.5">
            <p className="font-medium">Obrigado! Comprovante Interno</p>
            <p className="text-[9px]">{new Date().toLocaleString('pt-BR')}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 h-12 bg-primary hover:bg-primary/90 active:scale-95 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
          >
            <span className="material-symbols-outlined text-lg">print</span>
            Imprimir Recibo
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-12 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-semibold text-sm rounded-xl transition-all"
          >
            Concluir
          </button>
        </div>

      </div>

      {/* Global CSS for Thermal Printer Support */}
      <style jsx global>{`
        @media print {
          /* Hide everything outside receipt */
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt-printable, #thermal-receipt-printable * {
            visibility: visible !important;
          }
          #thermal-receipt-printable {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 76mm !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 8px !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-weight: 600 !important;
            font-size: 11px !important;
            line-height: 1.25 !important;
            box-shadow: none !important;
            border: none !important;
            z-index: 999999 !important;
          }
          @page {
            size: auto;
            margin: 0mm;
          }
        }
      `}</style>
    </div>
  );
}
