'use client';

import React, { useState } from 'react';
import { LossReason, Movement } from '../../../core/entities/movement';
import ReceiptModal from '../../common/ReceiptModal';

interface RegisterLossProps {
  onBack: () => void;
  currentStock: number;
  requireObservation?: boolean;
  onRegister: (data: {
    type: 'perda';
    quantity: number;
    lossReason: LossReason;
    observation?: string;
  }) => { success: boolean; message: string; movement?: Movement };
}

export default function RegisterLoss({ onBack, currentStock, requireObservation = true, onRegister }: RegisterLossProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedReason, setSelectedReason] = useState<LossReason | null>(null);
  const [observation, setObservation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptMovement, setReceiptMovement] = useState<Movement | null>(null);

  // Increments
  const increment = () => setQuantity((q) => q + 1);
  const decrement = () => setQuantity((q) => (q > 0 ? q - 1 : 0));

  const reasons = [
    { id: 'saco_rasgado', label: 'Saco rasgado', icon: 'inventory_2' },
    { id: 'gelo_derretido', label: 'Gelo derretido', icon: 'ac_unit' },
    { id: 'embalagem_danificada', label: 'Embalagem danificada', icon: 'package_2' },
    { id: 'queda', label: 'Queda', icon: 'release_alert' },
    { id: 'outro', label: 'Outro', icon: 'more_horiz' },
  ];

  const handleSubmit = () => {
    if (quantity <= 0) {
      alert('Por favor, selecione uma quantidade maior que zero.');
      return;
    }
    if (!selectedReason) {
      alert('Por favor, selecione o motivo da perda.');
      return;
    }
    if (requireObservation && !observation.trim()) {
      alert('De acordo com as regras de negócio do posto, a justificativa (observação) por escrito é obrigatória para perdas.');
      return;
    }

    setIsSubmitting(true);

    // Give a brief elegant delay for visual satisfaction
    setTimeout(() => {
      const result = onRegister({
        type: 'perda',
        quantity,
        lossReason: selectedReason,
        observation: observation.trim() || undefined,
      });

      setIsSubmitting(false);

      if (result.success) {
        if (result.movement) {
          setReceiptMovement(result.movement);
        } else {
          alert(result.message);
          onBack();
        }
      } else {
        alert(result.message);
      }
    }, 1000);
  };

  return (
    <div id="register-loss-screen" className="min-h-screen bg-surface text-on-surface flex flex-col w-full max-w-md mx-auto">
      
      {/* Header Top Bar */}
      <header className="bg-surface-container-lowest flex justify-between items-center w-full px-5 py-2 h-14 sticky top-0 z-50 border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center gap-2">
          <button 
            id="btn-back-loss"
            onClick={onBack}
            className="material-symbols-outlined text-primary p-2 hover:bg-surface-variant rounded-full transition-colors active:scale-95"
          >
            arrow_back
          </button>
          <h1 className="font-bold text-lg text-primary">Registrar Perda</h1>
        </div>
        <div className="flex items-center gap-1 text-primary text-sm font-semibold bg-primary-container/20 px-3 py-1.5 rounded-full">
          <span className="material-symbols-outlined text-sm">inventory_2</span>
          <span>Estoque: {currentStock} un</span>
        </div>
      </header>

      {/* Main Form Content */}
      <main className="flex-1 px-5 py-6 flex flex-col gap-6 overflow-y-auto pb-28">
        
        {/* Quantity Card Selection */}
        <section className="space-y-3">
          <h2 className="text-on-surface-variant font-semibold text-xs tracking-wider uppercase">Quantidade Perdida</h2>
          <div className="bg-surface-container-low rounded-[24px] border border-outline-variant p-5 flex items-center justify-between shadow-sm">
            <button 
              id="btn-decrement-loss"
              type="button"
              className="w-14 h-14 rounded-full bg-white border border-outline-variant flex items-center justify-center active:scale-95 transition-transform text-primary shadow-sm"
              onClick={decrement}
            >
              <span className="material-symbols-outlined text-3xl font-bold">remove</span>
            </button>
            <div className="flex flex-col items-center">
              <span id="quantity-loss-display" className="text-4xl font-extrabold text-primary tabular-nums">{quantity}</span>
              <span className="text-xs text-on-surface-variant font-medium">unidades</span>
            </div>
            <button 
              id="btn-increment-loss"
              type="button"
              className="w-14 h-14 rounded-full bg-white border border-outline-variant flex items-center justify-center active:scale-95 transition-transform text-primary shadow-sm"
              onClick={increment}
            >
              <span className="material-symbols-outlined text-3xl font-bold">add</span>
            </button>
          </div>
        </section>

        {/* Reason Card Selector (Mandatory) */}
        <section className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-on-surface-variant font-semibold text-xs tracking-wider uppercase">Motivo da Perda</h2>
            <span className="text-[10px] font-bold text-error uppercase tracking-wider">Obrigatório</span>
          </div>
          
          <div className="grid grid-cols-1 gap-2.5">
            {reasons.map((reason) => {
              const active = selectedReason === reason.id;
              return (
                <button
                  key={reason.id}
                  id={`btn-reason-${reason.id}`}
                  type="button"
                  className={`flex items-center justify-between p-4 rounded-[20px] border transition-all active:scale-[0.98] ${
                    active 
                      ? 'border-primary bg-primary-fixed text-on-primary-fixed font-semibold' 
                      : 'border-outline-variant bg-white text-on-surface hover:bg-surface-variant/30'
                  }`}
                  onClick={() => setSelectedReason(reason.id as LossReason)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined ${active ? 'text-primary' : 'text-on-surface-variant'}`}>
                      {reason.icon}
                    </span>
                    <span className="text-sm font-medium">{reason.label}</span>
                  </div>
                  {active && (
                    <span className="material-symbols-outlined text-primary text-xl">check_circle</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Observations field */}
        <section className="space-y-2">
          <h2 className="text-on-surface-variant font-semibold text-xs tracking-wider uppercase">
            Justificativa / Observação{' '}
            {requireObservation ? (
              <span className="text-[10px] font-bold text-error uppercase tracking-wider ml-1">(Obrigatório)</span>
            ) : (
              <span className="lowercase font-normal opacity-70 ml-1">(opcional)</span>
            )}
          </h2>
          <div className="relative">
            <textarea
              id="loss-observation-input"
              className="w-full bg-white border-2 border-outline-variant/40 rounded-2xl p-4 text-sm focus:border-primary focus:ring-0 placeholder:text-outline-variant transition-colors"
              placeholder={requireObservation ? "Justifique detalhadamente o motivo desta perda..." : "Descreva mais detalhes se necessário..."}
              rows={3}
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
            />
            <div className="absolute right-4 bottom-4 opacity-30 text-outline-variant">
              <span className="material-symbols-outlined">edit_note</span>
            </div>
          </div>
        </section>

      </main>

      {/* Footer Submission button */}
      <footer className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-background via-background to-transparent pt-8 z-40">
        <div className="max-w-md mx-auto">
          <button 
            id="btn-submit-loss"
            className="w-full h-14 bg-error text-white rounded-full font-semibold shadow-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all text-sm uppercase tracking-wider"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined animate-spin text-xl">sync</span>
                <span>Processando...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-xl">delete_forever</span>
                <span>Registrar Perda</span>
              </>
            )}
          </button>
        </div>
      </footer>

      {/* Printable Receipt Modal */}
      <ReceiptModal 
        movement={receiptMovement} 
        stationName="Auto Posto Tropical"
        onClose={() => {
          setReceiptMovement(null);
          onBack();
        }} 
      />

    </div>
  );
}
