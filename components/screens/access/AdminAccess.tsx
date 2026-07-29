'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminAccessProps {
  onBack: () => void;
  onSuccess: () => void;
  correctPassword?: string;
}

export default function AdminAccess({ onBack, onSuccess, correctPassword = '1234' }: AdminAccessProps) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const appendDigit = (digit: string) => {
    setErrorMsg(null);
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
    }
  };

  const deleteDigit = () => {
    setErrorMsg(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const toggleVisibility = () => {
    setShowPin((prev) => !prev);
  };

  const handleAccess = () => {
    if (pin === correctPassword) {
      onSuccess();
    } else {
      setErrorMsg('Senha incorreta! Tente novamente.');
      // Vibration simulation
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(100);
      }
    }
  };

  const handleForgotPassword = () => {
    alert(`Dica: A senha padrão de fábrica do administrador é "${correctPassword}".`);
  };

  return (
    <div id="admin-access-screen" className="min-h-screen bg-surface text-on-surface flex flex-col items-center justify-between w-full max-w-md mx-auto px-6 py-4">
      
      {/* Top App Bar */}
      <header className="w-full flex items-center justify-start h-14">
        <button 
          id="btn-back-access"
          onClick={onBack}
          aria-label="Voltar"
          className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors active:scale-90"
        >
          <span className="material-symbols-outlined text-on-surface text-2xl">arrow_back</span>
        </button>
      </header>

      {/* Main Form Content */}
      <main className="flex-1 w-full flex flex-col items-center justify-center py-4">
        
        {/* Logo and Greeting */}
        <div className="flex flex-col items-center gap-3 text-center mb-8">
          <div className="w-20 h-20 bg-primary-container/20 rounded-3xl flex items-center justify-center shadow-inner">
            <span className="material-symbols-outlined text-primary text-[48px]" style={{ fontVariationSettings: "'wght' 300" }}>ac_unit</span>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">Acesso Restrito</h1>
            <p className="text-sm text-on-surface-variant max-w-[280px] mx-auto leading-relaxed">
              Digite a senha de administrador para acessar o painel de controle.
            </p>
          </div>
        </div>

        {/* Input Pin Field */}
        <div className="w-full max-w-[300px] mb-6">
          <div className="relative flex items-center group">
            <span className="material-symbols-outlined absolute left-4 text-outline group-focus-within:text-primary">lock</span>
            <input 
              id="password-input"
              className="w-full h-14 pl-12 pr-12 bg-surface border border-outline rounded-2xl text-center text-xl font-bold tracking-[6px] focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-outline-variant/60"
              placeholder={showPin ? "" : "••••••"}
              value={showPin ? pin : "•".repeat(pin.length)}
              readOnly
              type="text"
            />
            <button 
              id="btn-toggle-pin-visibility"
              aria-label="Mostrar senha"
              className="absolute right-4 text-outline hover:text-on-surface transition-colors focus:outline-none"
              onClick={toggleVisibility}
            >
              <span className="material-symbols-outlined">{showPin ? "visibility_off" : "visibility"}</span>
            </button>
          </div>
          
          <AnimatePresence>
            {errorMsg && (
              <motion.p 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-error text-center mt-2 font-medium"
              >
                {errorMsg}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Numeric Keypad Grid */}
        <div className="w-full max-w-[320px] grid grid-cols-3 gap-y-4 gap-x-6 mb-8">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              id={`btn-keypad-${digit}`}
              className="w-16 h-16 mx-auto rounded-full bg-surface-container flex items-center justify-center text-xl font-semibold text-on-surface active:bg-surface-container-highest active:scale-90 transition-all shadow-sm hover:bg-surface-container-high"
              onClick={() => appendDigit(digit)}
            >
              {digit}
            </button>
          ))}
          
          {/* Row 4 */}
          <div className="w-16 h-16 mx-auto flex items-center justify-center opacity-30">
            <span className="material-symbols-outlined text-outline">more_horiz</span>
          </div>
          <button
            id="btn-keypad-0"
            className="w-16 h-16 mx-auto rounded-full bg-surface-container flex items-center justify-center text-xl font-semibold text-on-surface active:bg-surface-container-highest active:scale-90 transition-all shadow-sm hover:bg-surface-container-high"
            onClick={() => appendDigit('0')}
          >
            0
          </button>
          <button
            id="btn-keypad-backspace"
            className="w-16 h-16 mx-auto rounded-full bg-surface-container/60 flex items-center justify-center text-on-surface active:bg-surface-container-highest active:scale-90 transition-all shadow-sm hover:bg-surface-container-high"
            onClick={deleteDigit}
            aria-label="Apagar dígito"
          >
            <span className="material-symbols-outlined">backspace</span>
          </button>
        </div>

        {/* Access Button Controls */}
        <div className="w-full max-w-[300px] space-y-4">
          <button 
            id="btn-access-admin"
            className="w-full h-14 bg-primary text-on-primary rounded-full font-semibold text-sm flex items-center justify-center gap-2 shadow-md hover:brightness-110 active:scale-95 transition-all"
            onClick={handleAccess}
            disabled={pin.length === 0}
          >
            Acessar Painel
            <span className="material-symbols-outlined text-xl">arrow_forward</span>
          </button>
          
          <div className="flex justify-center">
            <button 
              id="btn-forgot-password"
              className="text-primary text-xs font-semibold px-4 py-2 rounded-lg hover:bg-primary/5 transition-colors focus:outline-none"
              onClick={handleForgotPassword}
            >
              Esqueci a senha
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}
