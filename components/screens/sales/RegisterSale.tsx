'use client';

import React, { useState, useMemo } from 'react';
import { PaymentMethod, Movement } from '../../../core/entities/movement';
import { calculateDiscount } from '../../../core/usecases/applyDiscount';
import { motion, AnimatePresence } from 'motion/react';
import ReceiptModal from '../../common/ReceiptModal';

interface RegisterSaleProps {
  onBack: () => void;
  defaultUnitPrice: number;
  currentStock: number;
  requireAdminPIN: boolean;
  adminPIN: string;
  onRegister: (data: {
    type: 'venda';
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    paymentMethod: PaymentMethod;
    discount?: {
      valorOriginal: number;
      valorConcedido: number;
      valorFinal: number;
      percentual: number;
      autorizadoPor: string;
    };
    observation?: string;
  }) => { success: boolean; message: string; movement?: Movement };
}

export default function RegisterSale({
  onBack,
  defaultUnitPrice,
  currentStock,
  requireAdminPIN,
  adminPIN,
  onRegister,
}: RegisterSaleProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('dinheiro');
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  
  // Discount input fields
  const [discountType, setDiscountType] = useState<'unitPrice' | 'totalAmount'>('totalAmount');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinVerified, setAdminPinVerified] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Observations
  const [observation, setObservation] = useState('');
  const [receiptMovement, setReceiptMovement] = useState<Movement | null>(null);

  // Handle quantity changes
  const increment = () => setQuantity((q) => q + 1);
  const decrement = () => setQuantity((q) => (q > 1 ? q - 1 : q));

  // Compute prices with discount if applicable
  const discountDetails = useMemo(() => {
    if (!showDiscountForm || discountValue <= 0) return null;
    
    return calculateDiscount({
      quantity,
      originalUnitPrice: defaultUnitPrice,
      discountType,
      value: discountValue,
      authorizedBy: authorizedBy || 'Frentista',
    });
  }, [showDiscountForm, discountValue, discountType, quantity, defaultUnitPrice, authorizedBy]);

  const finalTotalPrice = useMemo(() => {
    if (discountDetails) {
      return discountDetails.valorFinal;
    }
    return quantity * defaultUnitPrice;
  }, [quantity, defaultUnitPrice, discountDetails]);

  // Handle verify admin PIN
  const handleVerifyPIN = () => {
    if (adminPinInput === adminPIN) {
      setAdminPinVerified(true);
      setPinError(null);
    } else {
      setPinError('PIN incorreto!');
      if (typeof window !== 'undefined' && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }
  };

  // Submit sale
  const handleSubmit = () => {
    const payload: any = {
      type: 'venda',
      quantity,
      unitPrice: defaultUnitPrice,
      totalPrice: finalTotalPrice,
      paymentMethod: selectedMethod,
      observation: observation.trim() || undefined,
    };

    if (discountDetails) {
      payload.discount = {
        valorOriginal: discountDetails.valorOriginal,
        valorConcedido: discountDetails.valorConcedido,
        valorFinal: discountDetails.valorFinal,
        percentual: discountDetails.percentual,
        autorizadoPor: authorizedBy || 'Frentista',
      };
    }

    const result = onRegister(payload);
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
  };

  return (
    <div id="register-sale-screen" className="min-h-screen bg-surface text-on-surface flex flex-col w-full max-w-md mx-auto">
      
      {/* Header Top Bar */}
      <header className="bg-surface-container-lowest flex justify-between items-center w-full px-5 py-2 h-14 sticky top-0 z-50 border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center gap-2">
          <button 
            id="btn-back-sale"
            onClick={onBack}
            className="material-symbols-outlined text-primary p-2 hover:bg-surface-variant rounded-full transition-colors active:scale-95"
          >
            arrow_back
          </button>
          <h1 className="font-bold text-lg text-primary">Registrar Venda</h1>
        </div>
        <div className="flex items-center gap-1 text-primary text-sm font-semibold bg-primary-container/20 px-3 py-1.5 rounded-full">
          <span className="material-symbols-outlined text-sm">inventory_2</span>
          <span>Estoque: {currentStock} un</span>
        </div>
      </header>

      {/* Main Form Fields */}
      <main className="flex-1 px-5 py-6 flex flex-col gap-6 overflow-y-auto pb-28">
        
        {/* Quantity Card Selection */}
        <section className="flex flex-col items-center gap-3">
          <h2 className="text-on-surface-variant font-semibold text-xs tracking-wider uppercase">Quantidade</h2>
          <div className="flex items-center justify-between w-full bg-surface-container rounded-3xl p-4 shadow-inner">
            <button 
              id="btn-decrement-qty"
              className="w-14 h-14 flex items-center justify-center bg-white border border-outline-variant/30 text-primary rounded-2xl active:scale-90 transition-transform shadow-sm"
              onClick={decrement}
            >
              <span className="material-symbols-outlined text-2xl font-bold">remove</span>
            </button>
            <div className="flex flex-col items-center">
              <span id="qty-display" className="text-4xl font-extrabold text-primary tabular-nums">{quantity}</span>
              <span className="text-xs text-on-surface-variant font-medium">sacos de gelo</span>
            </div>
            <button 
              id="btn-increment-qty"
              className="w-14 h-14 flex items-center justify-center bg-white border border-outline-variant/30 text-primary rounded-2xl active:scale-90 transition-transform shadow-sm"
              onClick={increment}
            >
              <span className="material-symbols-outlined text-2xl font-bold">add</span>
            </button>
          </div>
        </section>

        {/* Payment Methods Cards */}
        <section className="flex flex-col gap-3">
          <h2 className="text-on-surface-variant font-semibold text-xs tracking-wider uppercase">Forma de Pagamento</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'credito', label: 'C. Crédito', icon: 'credit_card' },
              { id: 'debito', label: 'C. Débito', icon: 'payments' },
              { id: 'pix', label: 'Pix Maq.', icon: 'qr_code_2' },
              { id: 'pix_cnpj', label: 'Pix CNPJ', icon: 'domain' },
              { id: 'dinheiro', label: 'Dinheiro', icon: 'payments' },
            ].map((method) => {
              const active = selectedMethod === method.id;
              return (
                <button
                  key={method.id}
                  id={`btn-payment-${method.id}`}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all active:scale-95 ${
                    active 
                      ? 'border-primary bg-primary-fixed text-on-primary-fixed font-semibold shadow-sm' 
                      : 'border-outline-variant/50 bg-surface-container-low text-on-surface hover:bg-surface-container'
                  }`}
                  onClick={() => setSelectedMethod(method.id as PaymentMethod)}
                >
                  <span className={`material-symbols-outlined text-2xl ${active ? 'text-primary' : 'text-outline'}`}>
                    {method.icon}
                  </span>
                  <span className="text-xs text-center leading-tight">{method.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Pricing & Discount Card Section */}
        <section className="bg-surface-container-high rounded-3xl p-5 flex flex-col gap-4 border border-outline-variant/30 shadow-sm">
          <div className="flex justify-between items-center text-sm">
            <span className="text-on-surface-variant font-medium">Valor Unitário</span>
            <span className="font-semibold text-on-surface">R$ {defaultUnitPrice.toFixed(2).replace('.', ',')}</span>
          </div>
          
          {discountDetails && (
            <div className="flex justify-between items-center text-xs text-tertiary font-semibold bg-tertiary-fixed/30 p-2.5 rounded-xl">
              <span>Desconto ({discountDetails.percentual}%):</span>
              <span>- R$ {discountDetails.valorConcedido.toFixed(2).replace('.', ',')}</span>
            </div>
          )}

          <div className="h-px bg-outline-variant/40"></div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-on-surface-variant">Valor Total</span>
            <span id="total-display" className="text-2xl font-black text-primary">
              R$ {finalTotalPrice.toFixed(2).replace('.', ',')}
            </span>
          </div>

          {/* Trigger Toggle Discount Input fields */}
          <button
            id="btn-toggle-discount"
            className="self-start flex items-center gap-1 px-3 py-1.5 rounded-full text-secondary font-semibold text-xs hover:bg-secondary-container/20 active:scale-95 transition-all"
            onClick={() => setShowDiscountForm(!showDiscountForm)}
          >
            <span className="material-symbols-outlined text-sm">{showDiscountForm ? 'close' : 'sell'}</span>
            {showDiscountForm ? 'Cancelar Desconto' : 'Aplicar Desconto Autorizado'}
          </button>

          {/* Expanded discount controls */}
          <AnimatePresence>
            {showDiscountForm && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-4 pt-2 border-t border-outline-variant/20"
              >
                {/* Mode Select */}
                <div className="flex rounded-lg bg-surface p-1 border border-outline-variant/30">
                  <button
                    id="btn-discount-mode-total"
                    type="button"
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      discountType === 'totalAmount' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                    }`}
                    onClick={() => { setDiscountType('totalAmount'); setDiscountValue(0); }}
                  >
                    Valor Fixo (R$)
                  </button>
                  <button
                    id="btn-discount-mode-unit"
                    type="button"
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      discountType === 'unitPrice' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                    }`}
                    onClick={() => { setDiscountType('unitPrice'); setDiscountValue(defaultUnitPrice); }}
                  >
                    Novo Unitário (R$)
                  </button>
                </div>

                {/* Input Value */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant">
                    {discountType === 'totalAmount' ? 'Valor do Desconto Total (R$)' : 'Preço Unitário com Desconto (R$)'}
                  </label>
                  <input
                    id="discount-value-input"
                    type="number"
                    step="0.01"
                    min="0"
                    max={discountType === 'totalAmount' ? quantity * defaultUnitPrice : defaultUnitPrice}
                    className="w-full h-11 px-3 bg-white border border-outline-variant rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="0"
                    value={discountValue === 0 ? '' : discountValue}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setDiscountValue(Math.max(0, val));
                    }}
                  />
                </div>

                {/* Authorizer input */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant">Operador / Supervisor que autorizou <span className="font-normal opacity-70">(opcional)</span></label>
                  <input
                    id="discount-authorizer-input"
                    type="text"
                    className="w-full h-11 px-3 bg-white border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Ex: Supervisor Geral / Frentista"
                    value={authorizedBy}
                    onChange={(e) => setAuthorizedBy(e.target.value)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Optional observations field */}
        <section className="space-y-2">
          <h2 className="text-on-surface-variant font-semibold text-xs tracking-wider uppercase">Observação <span className="lowercase font-normal opacity-70">(opcional)</span></h2>
          <textarea
            id="sale-observation-input"
            className="w-full bg-white border-2 border-outline-variant/40 rounded-2xl p-3.5 text-sm focus:border-primary focus:ring-0 placeholder:text-outline-variant transition-colors"
            placeholder="Digite detalhes extras sobre a venda..."
            rows={2}
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
          />
        </section>

      </main>

      {/* Floating Action footer button */}
      <footer className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-background via-background to-transparent pt-8 z-40">
        <div className="max-w-md mx-auto">
          <button 
            id="btn-submit-sale"
            className="w-full h-14 bg-primary text-on-primary rounded-full font-bold shadow-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all text-sm uppercase tracking-wider"
            onClick={handleSubmit}
          >
            <span className="material-symbols-outlined">check_circle</span>
            Confirmar Venda
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
