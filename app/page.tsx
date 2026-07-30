'use client';

import React, { useState } from 'react';
import { useIceApp } from '../hooks/useIceApp';
import AdminAccess from '../components/screens/access/AdminAccess';
import RegisterSale from '../components/screens/sales/RegisterSale';
import RegisterLoss from '../components/screens/losses/RegisterLoss';
import AdminDashboard from '../components/screens/dashboard/AdminDashboard';
import { Movement } from '../core/entities/movement';
import ReceiptModal from '../components/common/ReceiptModal';
import { motion, AnimatePresence } from 'motion/react';
import { isSameLocalDate, getLocalDateString } from '../lib/utils';

type ScreenRoute = 'home' | 'sale' | 'loss' | 'access' | 'admin_dashboard';

export default function Home() {
  const {
    movements,
    attendants,
    activeAttendants,
    settings,
    currentStock,
    connectionState,
    isSyncing,
    isSupabaseActive,
    activeAttendant,
    setActiveAttendant,
    isAdminLoggedIn,
    setIsAdminLoggedIn,
    inconsistencyAlert,
    registerMovement,
    registerAdminMovement,
    removeMovement,
    cancelMovement,
    uncancelMovement,
    updateMovement,
    addAttendant,
    updateAttendant,
    saveSettings,
    resetAllData,
    exportBackup,
    importBackup,
    lastBackupTime,
    dashboardStats,
  } = useIceApp();

  // Screen state routing
  const [currentRoute, setCurrentRoute] = useState<ScreenRoute>('home');

  // Dialog/Modal for registering Courtesies quickly on home screen
  const [showCourtesyModal, setShowCourtesyModal] = useState(false);
  const [courtesyQty, setCourtesyQty] = useState(1);
  const [courtesyRecipient, setCourtesyRecipient] = useState('');
  const [courtesyObs, setCourtesyObs] = useState('');

  // Dialog/Modal for registering quick Production directly from home screen
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [productionQty, setProductionQty] = useState(10);
  const [productionObs, setProductionObs] = useState('');
  const [isProductionUnlocked, setIsProductionUnlocked] = useState(false);
  const [productionPin, setProductionPin] = useState('');
  const [productionPinError, setProductionPinError] = useState<string | null>(null);

  // Handle production pin entry
  const handleProductionPinDigit = (digit: string) => {
    setProductionPinError(null);
    const newPin = productionPin + digit;
    const correctPin = '1974'; // Password specifically requested for registering production
    
    if (newPin.length <= correctPin.length) {
      setProductionPin(newPin);
      
      if (newPin === correctPin) {
        // Correct pin! Unlock production form
        setTimeout(() => {
          setIsProductionUnlocked(true);
          setProductionPin('');
        }, 200);
      } else if (newPin.length === correctPin.length) {
        // Wrong pin!
        setTimeout(() => {
          setProductionPinError('Senha incorreta!');
          setProductionPin('');
        }, 200);
      }
    }
  };

  const handleProductionPinDelete = () => {
    setProductionPinError(null);
    setProductionPin(prev => prev.slice(0, -1));
  };

  // Dialog/Modal to quickly switch active frentista
  const [showAttendantSelector, setShowAttendantSelector] = useState(false);

  // Date filter for recent movements
  const [selectedMovementDate, setSelectedMovementDate] = useState<string>('');

  // Thermal Receipt Printing State
  const [printedMovement, setPrintedMovement] = useState<Movement | null>(null);

  // Handle register courtesy submission
  const handleRegisterCourtesy = (e: React.FormEvent) => {
    e.preventDefault();
    if (courtesyQty <= 0) {
      alert('Selecione uma quantidade válida.');
      return;
    }
    if (!courtesyRecipient.trim()) {
      alert('O campo "Cortesia concedida para" é de preenchimento obrigatório.');
      return;
    }

    const result = registerMovement({
      type: 'cortesia',
      quantity: courtesyQty,
      courtesyRecipient: courtesyRecipient.trim(),
      observation: courtesyObs.trim() || undefined,
    });

    if (result.success) {
      if (result.movement) {
        setPrintedMovement(result.movement);
      } else {
        alert(result.message);
      }
      // Reset form & close modal
      setCourtesyQty(1);
      setCourtesyRecipient('');
      setCourtesyObs('');
      setShowCourtesyModal(false);
    } else {
      alert(result.message);
    }
  };

  // Handle register production submission
  const handleRegisterProductionHome = (e: React.FormEvent) => {
    e.preventDefault();
    if (productionQty <= 0) {
      alert('Quantidade deve ser maior que zero.');
      return;
    }

    const result = registerMovement({
      type: 'producao',
      quantity: productionQty,
      observation: productionObs.trim() || undefined,
    });

    if (result.success) {
      if (result.movement) {
        setPrintedMovement(result.movement);
      } else {
        alert(result.message);
      }
      setProductionQty(10);
      setProductionObs('');
      setShowProductionModal(false);
    } else {
      alert(result.message);
    }
  };

  if (!settings) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">sync</span>
        <p className="text-sm text-on-surface-variant font-semibold">Carregando Controle de Gelo...</p>
      </div>
    );
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen font-sans">
      <AnimatePresence mode="wait">
        
        {/* ROUTE 1: WORKBENCH HOME SCREEN */}
        {currentRoute === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col max-w-md mx-auto relative pb-28"
          >
            {/* Top Navigation Area Bar */}
            <header className="bg-surface-container-lowest dark:bg-surface-dim flex justify-between items-center w-full px-5 py-3 h-16 sticky top-0 z-40 border-b border-outline-variant/20 shadow-sm">
              <div className="flex items-center gap-2.5">
                {/* Active operator picker button */}
                <button
                  id="btn-active-attendant-picker"
                  onClick={() => setShowAttendantSelector(true)}
                  className="flex items-center gap-2 hover:bg-surface-variant/40 p-1.5 rounded-full transition-colors active:scale-95"
                >
                  {activeAttendant?.avatarUrl ? (
                    <img
                      src={activeAttendant.avatarUrl}
                      alt={activeAttendant.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-primary"
                    />
                  ) : (
                    <span className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm">
                      {activeAttendant ? activeAttendant.name.slice(0, 2).toUpperCase() : 'F'}
                    </span>
                  )}
                  <div className="text-left">
                    <p className="text-[10px] text-outline font-extrabold uppercase tracking-wide">Frentista Ativo</p>
                    <p className="text-xs font-bold text-primary max-w-[80px] truncate">{activeAttendant?.name || 'Selecione'}</p>
                  </div>
                  <span className="material-symbols-outlined text-outline text-lg">expand_more</span>
                </button>
              </div>

              <div className="text-center flex flex-col items-center">
                <h1 className="font-bold text-sm tracking-wide text-primary">Controle de Gelo</h1>
                <p className="text-[9px] text-outline font-extrabold uppercase">{settings?.gasStationName || 'Auto Posto Tropical'}</p>
              </div>

              {/* Status and Cloud Indicator */}
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  isSupabaseActive ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-primary-container/20 text-primary'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isSyncing ? 'bg-amber-500 animate-ping' : isSupabaseActive ? 'bg-emerald-600 animate-pulse' : 'bg-tertiary'}`}></span>
                  <span>{isSyncing ? 'Sincronizando...' : isSupabaseActive ? 'Supabase Web' : 'Sincronizado'}</span>
                </div>
              </div>
            </header>

            {/* Inconsistency Alerts Header Banner */}
            {inconsistencyAlert && (
              <div className="bg-error-container/85 text-on-error-container px-5 py-3 text-xs font-semibold flex items-center gap-2 border-b border-error/10">
                <span className="material-symbols-outlined text-error text-lg">warning</span>
                <span className="flex-1 leading-normal">{inconsistencyAlert}</span>
              </div>
            )}

            {/* Main Workbench Body Scroll area */}
            <main className="flex-1 px-5 py-5 flex flex-col gap-6 overflow-y-auto">
              
              {/* Filter / Date picker visual row */}
              <div className="flex gap-2">
                <div className="flex-1 h-12 bg-surface-container rounded-2xl flex items-center gap-2 px-4 shadow-sm">
                  <span className="material-symbols-outlined text-primary text-lg">calendar_today</span>
                  <span className="text-xs font-bold text-on-surface">Hoje, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span>
                </div>
                
                {/* Reset or Refresh indicator */}
                <button
                  id="btn-sync-simulation"
                  onClick={() => alert('Sincronização manual completada! Fila de registros locais limpa.')}
                  className="w-12 h-12 bg-surface-container hover:bg-surface-container-high rounded-2xl flex items-center justify-center text-primary active:scale-95 transition-all shadow-sm"
                  title="Forçar Sincronização com Firebase"
                >
                  <span className={`material-symbols-outlined text-lg ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
                </button>

                {/* Restricted Panel trigger */}
                <button
                  id="btn-trigger-access"
                  onClick={() => setCurrentRoute('access')}
                  className="w-12 h-12 bg-primary text-on-primary rounded-2xl flex items-center justify-center active:scale-95 transition-all shadow-md"
                  title="Acessar Painel Administrador"
                >
                  <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                </button>
              </div>

              {/* Today summary Cards */}
              <div className="grid grid-cols-2 gap-3.5">
                
                <div className="bg-white border border-outline-variant/30 rounded-3xl p-4.5 shadow-sm flex flex-col justify-between h-28 relative overflow-hidden">
                  <p className="text-[10px] text-tertiary font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">payments</span>
                    Vendas Hoje
                  </p>
                  <h3 className="text-xl font-black text-on-surface mt-2">
                    R$ {dashboardStats.today.salesValue.toFixed(2).replace('.', ',')}
                  </h3>
                  <span className="text-[9px] text-outline font-medium">{dashboardStats.today.salesVolume} sacos vendidos</span>
                </div>

                <div className="bg-white border border-outline-variant/30 rounded-3xl p-4.5 shadow-sm flex flex-col justify-between h-28 relative overflow-hidden">
                  <p className="text-[10px] text-secondary font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">redeem</span>
                    Cortesias
                  </p>
                  <h3 className="text-xl font-black text-on-surface mt-2">
                    {dashboardStats.today.courtesyVolume} sacos
                  </h3>
                  <span className="text-[9px] text-outline font-medium">valor total: R$ 0,00</span>
                </div>

              </div>

              {/* Quick Stock Status Bar Indicator */}
              <div className="bg-surface-container rounded-3xl p-4 border border-outline-variant/20 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-xl">inventory_2</span>
                  <div>
                    <p className="text-[9px] text-outline font-bold uppercase">Estoque em Tempo Real</p>
                    <p className="text-xs font-extrabold text-on-surface">{currentStock} sacos de gelo disponíveis</p>
                  </div>
                </div>
                {/* warning banner */}
                {currentStock < (settings.minimumStockAlert ?? 15) && (
                  <span className="text-[9px] font-extrabold bg-error-container text-error px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">
                    Repor!
                  </span>
                )}
              </div>

              {/* SECTION: FRENTISTAS TEAM OVERVIEW */}
              <section className="space-y-3">
                <div className="flex justify-between items-center">
                  <h2 className="text-xs font-extrabold text-outline uppercase tracking-wider">Vendas por Frentista</h2>
                  <span className="text-[10px] font-bold text-primary cursor-pointer hover:underline" onClick={() => alert('Para gerenciar frentistas, acesse o Painel Administrativo.')}>Ver Equipe</span>
                </div>

                <div className="bg-white border border-outline-variant/20 rounded-3xl p-4 shadow-sm divide-y divide-outline-variant/15 max-h-56 overflow-y-auto">
                  {activeAttendants.map((att) => {
                    // Compute frentista metrics
                    const sales = movements
                      .filter((m) => m.attendantId === att.id && m.type === 'venda' && isSameLocalDate(m.date, m.timestamp));
                    const count = sales.reduce((acc, m) => acc + (m.quantity || 0), 0);
                    const val = sales.reduce((acc, m) => acc + (m.totalPrice || 0), 0);

                    return (
                      <div key={att.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-2.5">
                          <span className="h-8 w-8 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-bold text-xs uppercase">
                            {att.name.slice(0, 2)}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-on-surface">{att.name}</p>
                            <p className="text-[9px] text-outline font-semibold">{count} sacos vendidos hoje</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-xs font-extrabold text-on-surface">R$ {val.toFixed(2).replace('.', ',')}</p>
                          <span className="text-[8px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full uppercase">CONCLUÍDO</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* SECTION: RECENT MOVEMENTS */}
              <section className="space-y-3">
                <div className="flex justify-between items-center">
                  <h2 className="text-xs font-extrabold text-outline uppercase tracking-wider">Movimentações Recentes</h2>
                  <span className="text-[10px] font-bold text-primary cursor-pointer hover:underline" onClick={() => alert('O histórico completo com filtros detalhados está disponível no Painel Administrativo.')}>Ver Tudo</span>
                </div>

                {/* Seletor de data para o frentista visualizar histórico */}
                <div className="bg-white border border-outline-variant/25 rounded-2xl p-3 shadow-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">calendar_month</span>
                    <span className="text-xs font-bold text-on-surface-variant">Filtrar por Dia</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="input-frentista-date-filter"
                      type="date"
                      className="bg-surface-container hover:bg-surface-container-high transition-colors text-xs font-extrabold text-primary rounded-xl px-3 py-2 cursor-pointer border border-outline-variant/20 focus:outline-none"
                      value={selectedMovementDate}
                      onChange={(e) => setSelectedMovementDate(e.target.value)}
                    />
                    {selectedMovementDate && (
                      <button
                        id="btn-clear-frentista-date"
                        onClick={() => setSelectedMovementDate('')}
                        className="w-8 h-8 flex items-center justify-center bg-error/10 hover:bg-error/15 text-error rounded-xl active:scale-95 transition-all"
                        title="Ver Recentes"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5">
                  {(() => {
                    const filtered = selectedMovementDate
                      ? movements.filter((m) => isSameLocalDate(m.date, m.timestamp, selectedMovementDate))
                      : movements.slice(0, 4);

                    if (filtered.length === 0) {
                      return (
                        <div className="bg-white border border-outline-variant/30 rounded-2xl p-6 shadow-sm text-center">
                          <span className="material-symbols-outlined text-outline text-3xl mb-1">history</span>
                          <p className="text-xs font-bold text-on-surface-variant">Nenhuma movimentação registrada</p>
                          <p className="text-[10px] text-outline mt-0.5">Não há lançamentos de vendas, perdas, cortesia ou produção no dia {selectedMovementDate.split('-').reverse().join('/')}.</p>
                        </div>
                      );
                    }

                    return filtered.map((m) => {
                      const iconMap = {
                        venda: { icon: 'shopping_bag', color: 'bg-primary-container text-on-primary-container', label: 'Venda' },
                        producao: { icon: 'restart_alt', color: 'bg-purple-100 text-purple-800', label: 'Produção' },
                        cortesia: { icon: 'redeem', color: 'bg-emerald-100 text-emerald-800', label: 'Cortesia' },
                        perda: { icon: 'release_alert', color: 'bg-red-100 text-red-800', label: 'Perda / Avaria' }
                      }[m.type];

                      return (
                        <div key={m.id} className="bg-white border border-outline-variant/30 rounded-2xl p-3.5 shadow-sm flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconMap.color} shadow-inner`}>
                              <span className="material-symbols-outlined text-lg">{iconMap.icon}</span>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-on-surface">
                                {m.attendantName}: {iconMap.label} #{m.id.split('-')[1] || m.id}
                              </p>
                              <p className="text-[9px] text-outline font-medium">
                                {!isSameLocalDate(m.date, m.timestamp) ? `${m.date.split('-').reverse().join('/')} ` : 'Hoje '} às {m.time} • {m.quantity} sacos {m.paymentMethod ? `• ${m.paymentMethod.toUpperCase()}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPrintedMovement(m)}
                              className="w-8 h-8 rounded-lg bg-surface-container hover:bg-primary/10 hover:text-primary text-outline flex items-center justify-center transition-colors"
                              title="Imprimir Comprovante"
                            >
                              <span className="material-symbols-outlined text-sm">print</span>
                            </button>

                            <span className={`text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              m.type === 'venda' ? 'bg-primary-container/40 text-primary' : m.type === 'cortesia' ? 'bg-emerald-100 text-emerald-800' : m.type === 'perda' ? 'bg-red-100 text-red-800' : 'bg-purple-100 text-purple-800'
                            }`}>
                              {m.type}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </section>

            </main>

            {/* Bottom Primary Thumb workbench Action Bar bar */}
            <footer className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-background via-background to-transparent pt-10 z-40">
              <div className="max-w-md mx-auto grid grid-cols-4 gap-2.5 items-center bg-white/95 backdrop-blur-md p-3 rounded-full shadow-xl border border-outline-variant/30">
                
                {/* 1. Register Sale Pill */}
                <button
                  id="btn-shortcut-sale"
                  className="col-span-2 h-14 bg-primary text-on-primary rounded-full font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md text-xs uppercase tracking-wider"
                  onClick={() => setCurrentRoute('sale')}
                >
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  Venda
                </button>

                {/* 2. Quick Cortesia */}
                <button
                  id="btn-shortcut-courtesy"
                  className="h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full flex flex-col items-center justify-center active:scale-95 transition-all shadow-sm"
                  onClick={() => setShowCourtesyModal(true)}
                  title="Registrar Cortesia"
                >
                  <span className="material-symbols-outlined text-lg">redeem</span>
                  <span className="text-[8px] font-bold uppercase mt-0.5">Cortesia</span>
                </button>

                {/* 3. Register Loss */}
                <button
                  id="btn-shortcut-loss"
                  className="h-14 bg-error hover:brightness-110 text-white rounded-full flex flex-col items-center justify-center active:scale-95 transition-all shadow-sm"
                  onClick={() => setCurrentRoute('loss')}
                  title="Registrar Perda"
                >
                  <span className="material-symbols-outlined text-lg">release_alert</span>
                  <span className="text-[8px] font-bold uppercase mt-0.5">Perda</span>
                </button>

              </div>
              
              {/* Floating Plus button for direct Production Refill directly on Workbench */}
              <button
                id="btn-shortcut-production"
                className="absolute right-6 -top-12 w-11 h-11 bg-purple-600 hover:bg-purple-700 text-white rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-lg z-50 border-2 border-white"
                onClick={() => {
                  setIsProductionUnlocked(false);
                  setProductionPin('');
                  setProductionPinError(null);
                  setShowProductionModal(true);
                }}
                title="Registrar Produção rápida"
              >
                <span className="material-symbols-outlined text-lg">add</span>
              </button>
            </footer>

            {/* MODAL 1: CORTESIA QUICK FORM POPUP */}
            <AnimatePresence>
              {showCourtesyModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white w-full max-w-sm rounded-3xl p-5 border border-outline-variant/30 shadow-2xl space-y-4"
                  >
                    <div className="flex justify-between items-center border-b border-outline-variant/20 pb-2">
                      <h3 className="font-bold text-base text-primary flex items-center gap-1.5">
                        <span className="material-symbols-outlined">redeem</span>
                        Registrar Cortesia
                      </h3>
                      <button
                        id="btn-close-courtesy-modal"
                        className="material-symbols-outlined text-outline p-1 hover:bg-surface-variant rounded-full"
                        onClick={() => setShowCourtesyModal(false)}
                      >
                        close
                      </button>
                    </div>

                    <form onSubmit={handleRegisterCourtesy} className="space-y-4">
                      
                      {/* Qtd Selector */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-on-surface-variant uppercase">Quantidade de Sacos</label>
                        <div className="flex justify-between items-center bg-surface-container rounded-2xl p-2.5">
                          <button
                            id="btn-modal-courtesy-dec"
                            type="button"
                            className="w-10 h-10 bg-white border border-outline-variant rounded-xl flex items-center justify-center active:scale-90"
                            onClick={() => setCourtesyQty(q => q > 1 ? q - 1 : 1)}
                          >
                            -
                          </button>
                          <span id="courtesy-qty-display" className="font-extrabold text-xl text-primary">{courtesyQty} sacos</span>
                          <button
                            id="btn-modal-courtesy-inc"
                            type="button"
                            className="w-10 h-10 bg-white border border-outline-variant rounded-xl flex items-center justify-center active:scale-90"
                            onClick={() => setCourtesyQty(q => q + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Recipient Input (Obligatory) */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-on-surface-variant uppercase flex justify-between">
                          <span>Entregue Para</span>
                          <span className="text-[10px] text-error">Obrigatório</span>
                        </label>
                        <input
                          id="courtesy-recipient-input"
                          type="text"
                          required
                          className="w-full h-11 px-3 bg-surface-container border border-outline-variant/30 rounded-xl text-sm font-semibold focus:outline-none"
                          placeholder="Ex: Motorista Caminhão Placa ABC-123"
                          value={courtesyRecipient}
                          onChange={(e) => setCourtesyRecipient(e.target.value)}
                        />
                      </div>

                      {/* Observation */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-on-surface-variant uppercase">Observações Opcionais</label>
                        <textarea
                          id="courtesy-obs-input"
                          className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-3 text-sm"
                          placeholder="Motivo ou observações da entrega..."
                          rows={2}
                          value={courtesyObs}
                          onChange={(e) => setCourtesyObs(e.target.value)}
                        />
                      </div>

                      <button
                        id="btn-submit-courtesy"
                        type="submit"
                        className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-bold text-xs uppercase tracking-wider shadow-md"
                      >
                        Salvar e Atualizar Estoque
                      </button>

                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* MODAL 2: PRODUCTION QUICK FORM POPUP */}
            <AnimatePresence>
              {showProductionModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white w-full max-w-sm rounded-3xl p-5 border border-outline-variant/30 shadow-2xl space-y-4"
                  >
                    <div className="flex justify-between items-center border-b border-outline-variant/20 pb-2">
                      <h3 className="font-bold text-base text-purple-700 flex items-center gap-1.5">
                        <span className="material-symbols-outlined">restart_alt</span>
                        {isProductionUnlocked ? 'Registrar Produção' : 'Autorizar Acesso'}
                      </h3>
                      <button
                        id="btn-close-production-modal"
                        className="material-symbols-outlined text-outline p-1 hover:bg-surface-variant rounded-full"
                        onClick={() => setShowProductionModal(false)}
                      >
                        close
                      </button>
                    </div>

                    {!isProductionUnlocked ? (
                      <div className="flex flex-col items-center gap-2 py-1">
                        <div className="w-12 h-12 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center mb-1 shadow-inner">
                          <span className="material-symbols-outlined text-xl">security</span>
                        </div>
                        <p className="text-xs font-bold text-on-surface uppercase tracking-wide text-center">Senha de Produção</p>
                        <p className="text-[10px] text-outline text-center px-4 leading-normal">
                          Digite a senha de registro de produção para abastecer o estoque.
                        </p>

                        {/* Display Dots */}
                        <div className="flex justify-center gap-3.5 my-3">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-3 h-3 rounded-full border-2 transition-all duration-150 ${
                                i < productionPin.length
                                  ? 'bg-purple-600 border-purple-600 scale-110'
                                  : 'border-outline-variant/60 bg-transparent'
                              }`}
                            />
                          ))}
                        </div>

                        {productionPinError && (
                          <p className="text-xs font-bold text-error animate-bounce mb-1">{productionPinError}</p>
                        )}

                        {/* Keypad Grid */}
                        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[210px] mt-1">
                          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                            <button
                              key={digit}
                              type="button"
                              className="w-11 h-11 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-sm font-bold text-on-surface active:scale-90 transition-all shadow-sm"
                              onClick={() => handleProductionPinDigit(digit)}
                            >
                              {digit}
                            </button>
                          ))}
                          <div className="w-11 h-11 flex items-center justify-center text-outline opacity-25 text-xs">
                            •••
                          </div>
                          <button
                            type="button"
                            className="w-11 h-11 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-sm font-bold text-on-surface active:scale-90 transition-all shadow-sm"
                            onClick={() => handleProductionPinDigit('0')}
                          >
                            0
                          </button>
                          <button
                            type="button"
                            className="w-11 h-11 rounded-full bg-surface-container/60 hover:bg-surface-container-high flex items-center justify-center text-on-surface active:scale-90 transition-all shadow-sm"
                            onClick={handleProductionPinDelete}
                          >
                            <span className="material-symbols-outlined text-base">backspace</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleRegisterProductionHome} className="space-y-4">
                        
                        {/* Qtd Selector */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-on-surface-variant uppercase">Quantidade de Sacos Produzidos</label>
                          <div className="flex justify-between items-center bg-surface-container rounded-2xl p-2.5">
                            <button
                              id="btn-modal-prod-dec"
                              type="button"
                              className="w-10 h-10 bg-white border border-outline-variant rounded-xl flex items-center justify-center active:scale-90"
                              onClick={() => setProductionQty(q => q > 1 ? q - 1 : 1)}
                            >
                              -
                            </button>
                            <span id="production-qty-display" className="font-extrabold text-xl text-purple-700">{productionQty} sacos</span>
                            <button
                              id="btn-modal-prod-inc"
                              type="button"
                              className="w-10 h-10 bg-white border border-outline-variant rounded-xl flex items-center justify-center active:scale-90"
                              onClick={() => setProductionQty(q => q + 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Observation */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-on-surface-variant uppercase">Observações Opcionais</label>
                          <textarea
                            id="production-obs-input"
                            className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-3 text-sm"
                            placeholder="Ex: Carga matinal regular..."
                            rows={2}
                            value={productionObs}
                            onChange={(e) => setProductionObs(e.target.value)}
                          />
                        </div>

                        <button
                          id="btn-submit-production"
                          type="submit"
                          className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-bold text-xs uppercase tracking-wider shadow-md"
                        >
                          Adicionar ao Estoque
                        </button>

                      </form>
                    )}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* MODAL 3: ACTIVE ATTENDANT PICKER POPUP */}
            <AnimatePresence>
              {showAttendantSelector && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white w-full max-w-sm rounded-3xl p-5 border border-outline-variant/30 shadow-2xl space-y-4"
                  >
                    <div className="flex justify-between items-center border-b border-outline-variant/20 pb-2">
                      <h3 className="font-bold text-base text-primary flex items-center gap-1.5">
                        <span className="material-symbols-outlined">group</span>
                        Selecionar Frentista Ativo
                      </h3>
                      <button
                        id="btn-close-attendant-modal"
                        className="material-symbols-outlined text-outline p-1 hover:bg-surface-variant rounded-full"
                        onClick={() => setShowAttendantSelector(false)}
                      >
                        close
                      </button>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {activeAttendants.map((att) => {
                        const active = activeAttendant?.id === att.id;
                        return (
                          <button
                            key={att.id}
                            id={`btn-select-att-${att.id}`}
                            className={`w-full p-3 rounded-2xl flex items-center justify-between border transition-all ${
                              active 
                                ? 'border-primary bg-primary-fixed text-on-primary-fixed font-bold' 
                                : 'border-outline-variant bg-white text-on-surface hover:bg-surface-container-low'
                            }`}
                            onClick={() => {
                              setActiveAttendant(att);
                              setShowAttendantSelector(false);
                            }}
                          >
                            <span className="text-sm">{att.name}</span>
                            {active && <span className="material-symbols-outlined text-primary text-lg">check_circle</span>}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </motion.div>
        )}

        {/* ROUTE 2: REGISTER SALE SCREEN */}
        {currentRoute === 'sale' && (
          <motion.div
            key="sale"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <RegisterSale
              onBack={() => setCurrentRoute('home')}
              defaultUnitPrice={settings.defaultIceBagPrice}
              currentStock={currentStock}
              requireAdminPIN={settings.requireAdminForDiscount}
              adminPIN={settings.adminPassword || '102035'}
              onRegister={(data) => {
                const result = registerMovement(data);
                return result;
              }}
            />
          </motion.div>
        )}

        {/* ROUTE 3: REGISTER LOSS SCREEN */}
        {currentRoute === 'loss' && (
          <motion.div
            key="loss"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <RegisterLoss
              onBack={() => setCurrentRoute('home')}
              currentStock={currentStock}
              requireObservation={settings.requireObservationForLoss}
              onRegister={(data) => {
                const result = registerMovement(data);
                return result;
              }}
            />
          </motion.div>
        )}

        {/* ROUTE 4: ADMIN ACCESS KEYPAD */}
        {currentRoute === 'access' && (
          <motion.div
            key="access"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <AdminAccess
              correctPassword={settings.adminPassword || '102035'}
              onBack={() => setCurrentRoute('home')}
              onSuccess={() => {
                setIsAdminLoggedIn(true);
                setCurrentRoute('admin_dashboard');
              }}
            />
          </motion.div>
        )}

        {/* ROUTE 5: ADMIN DASHBOARD AND CONFIG PANEL */}
        {currentRoute === 'admin_dashboard' && (
          <motion.div
            key="admin_dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AdminDashboard
              onBack={() => {
                setIsAdminLoggedIn(false);
                setCurrentRoute('home');
              }}
              movements={movements}
              attendants={attendants}
              settings={settings}
              currentStock={currentStock}
              stats={dashboardStats}
              onUpdateSettings={saveSettings}
              onAddAttendant={addAttendant}
              onUpdateAttendant={updateAttendant}
              onRemoveMovement={removeMovement}
              onCancelMovement={cancelMovement}
              onUncancelMovement={uncancelMovement}
              onResetAllData={resetAllData}
              onExportBackup={exportBackup}
              onImportBackup={importBackup}
              lastBackupTime={lastBackupTime}
              onAddMovement={(data) => {
                const result = registerAdminMovement(data);
                return result;
              }}
            />
          </motion.div>
        )}

      </AnimatePresence>

      {/* Global Thermal Receipt Modal */}
      <ReceiptModal 
        movement={printedMovement} 
        onClose={() => setPrintedMovement(null)} 
        stationName={settings?.gasStationName || 'Auto Posto Tropical'}
      />
    </div>
  );
}
