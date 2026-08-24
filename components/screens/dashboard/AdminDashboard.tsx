'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Movement, PaymentMethod, LossReason } from '../../../core/entities/movement';
import { Attendant } from '../../../core/entities/attendant';
import { SystemSettings } from '../../../core/entities/settings';
import { exportToExcel } from '../../../services/export/excelExporter';
import { exportToPDF } from '../../../services/export/pdfExporter';
import { exportToCSV } from '../../../services/export/csvExporter';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { exportDatabaseBackupToFile, importDatabaseBackupFromFile } from '../../../services/persistence/backupManager';
import { isSupabaseConfigured } from '../../../lib/supabaseClient';
import { supabaseStorageService } from '../../../services/persistence/SupabaseStorageImpl';
import ReceiptModal from '../../common/ReceiptModal';
import { getLocalDateString, isSameLocalDate } from '../../../lib/utils';

interface AdminDashboardProps {
  onBack: () => void;
  movements: Movement[];
  attendants: Attendant[];
  settings: SystemSettings;
  currentStock: number;
  stats: any;
  onUpdateSettings: (settings: SystemSettings) => void;
  onAddAttendant: (name: string) => void;
  onUpdateAttendant: (attendant: Attendant) => void;
  onDeleteAttendant?: (id: string) => void;
  onRemoveMovement: (id: string) => void;
  onCancelMovement?: (id: string, reason?: string) => { success: boolean; message: string };
  onUncancelMovement?: (id: string) => { success: boolean; message: string };
  onAddMovement: (data: any) => any; // To register administrative production or operations
  onResetAllData: () => void;
  onExportBackup?: () => Promise<{ success: boolean; method: string; filename: string }>;
  onImportBackup?: (file: File) => Promise<{ success: boolean; movementsCount?: number; attendantsCount?: number; error?: string }>;
  lastBackupTime?: string | null;
}

type TabType = 'dashboard' | 'history' | 'attendants' | 'settings';

export default function AdminDashboard({
  onBack,
  movements,
  attendants,
  settings,
  currentStock,
  stats,
  onUpdateSettings,
  onAddAttendant,
  onUpdateAttendant,
  onDeleteAttendant,
  onRemoveMovement,
  onCancelMovement,
  onUncancelMovement,
  onAddMovement,
  onResetAllData,
  onExportBackup,
  onImportBackup,
  lastBackupTime,
}: AdminDashboardProps) {

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isMounted, setIsMounted] = useState(false);
  const [printedMovement, setPrintedMovement] = useState<Movement | null>(null);

  interface SystemNotification {
    id: string;
    type: 'warning' | 'danger' | 'info';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
  }

  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        new Notification('🔔 Alertas de Estoque Ativados', {
          body: 'Você receberá avisos sobre o estoque mínimo do posto!',
        });
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const alertType = currentStock <= 10 
      ? 'danger' 
      : currentStock <= settings.minimumStockAlert 
        ? 'warning' 
        : null;

    if (!alertType) return;

    const alertId = `stock-${alertType}-${currentStock}`;

    const timer = setTimeout(() => {
      setNotifications(prev => {
        if (prev.some(n => n.id === alertId)) return prev;

        const newAlert: SystemNotification = {
          id: alertId,
          type: alertType,
          title: alertType === 'danger' ? '⚠️ Estoque Crítico!' : '⚠️ Alerta de Estoque Baixo',
          message: alertType === 'danger'
            ? `O estoque atual atingiu apenas ${currentStock} sacos de gelo, abaixo do limite crítico de segurança de 10 unidades. Reabasteça com urgência!`
            : `O estoque atual de ${currentStock} sacos está abaixo do limite mínimo configurado de ${settings.minimumStockAlert} sacos.`,
          timestamp: new Date(),
          read: false,
        };

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(newAlert.title, {
            body: alertType === 'danger'
              ? `Apenas ${currentStock} sacos de gelo restantes no posto!`
              : `Estoque atual (${currentStock} sacos) abaixo de ${settings.minimumStockAlert} unidades.`
          });
        }

        return [newAlert, ...prev];
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [currentStock, settings.minimumStockAlert]);

  // Compute sales volume for the last 7 days
  const last7DaysSales = useMemo(() => {
    interface DaySales {
      date: string;
      label: string;
      vendas: number;
    }
    const days: DaySales[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${date}`; // YYYY-MM-DD format
      
      const day = String(d.getDate()).padStart(2, '0');
      const monthLabel = String(d.getMonth() + 1).padStart(2, '0');
      const label = `${day}/${monthLabel}`;

      days.push({
        date: dateStr,
        label,
        vendas: 0,
      });
    }

    // Populate sales count from movements
    movements.forEach((m) => {
      if (m.type === 'venda') {
        const match = days.find((d) => d.date === m.date);
        if (match) {
          match.vendas += m.quantity;
        }
      }
    });

    return days;
  }, [movements]);

  // Compute stock levels for the last 7 days
  const last7DaysStock = useMemo(() => {
    interface DayStock {
      date: string;
      label: string;
      estoque: number;
    }
    const days: DayStock[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${date}`; // YYYY-MM-DD
      
      const day = String(d.getDate()).padStart(2, '0');
      const monthLabel = String(d.getMonth() + 1).padStart(2, '0');
      const label = `${day}/${monthLabel}`;

      days.push({
        date: dateStr,
        label,
        estoque: 0,
      });
    }

    // For each of the last 7 days, compute cumulative stock up to that day
    days.forEach((dayObj) => {
      let stock = settings.initialStock;
      movements.forEach((m) => {
        if (m.date <= dayObj.date) {
          switch (m.type) {
            case 'producao':
              stock += m.quantity;
              break;
            case 'venda':
            case 'cortesia':
            case 'perda':
              stock -= m.quantity;
              break;
          }
        }
      });
      dayObj.estoque = Math.max(0, stock);
    });

    return days;
  }, [movements, settings.initialStock]);

  // History filtering states
  const [filterStatus, setFilterStatus] = useState<string>('todos'); // 'todos' | 'ativos' | 'cancelados'
  const [filterType, setFilterType] = useState<string>('todos');
  const [filterAttendant, setFilterAttendant] = useState<string>('todos');
  const [filterPayment, setFilterPayment] = useState<string>('todos');
  const [filterPeriod, setFilterPeriod] = useState<string>('todos');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Cancellation modal states
  const [cancelModalMovement, setCancelModalMovement] = useState<Movement | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('Desistência do cliente');

  // PDF Report Generation states
  const [reportPeriod, setReportPeriod] = useState<string>('todos');
  const [reportStartDate, setReportStartDate] = useState<string>('');
  const [reportEndDate, setReportEndDate] = useState<string>('');

  // Attendant adding form state
  const [newAttendantName, setNewAttendantName] = useState('');

  // Production registry inside Admin Dashboard
  const [adminProdQty, setAdminProdQty] = useState<number>(10);
  const [adminProdObs, setAdminProdObs] = useState('');

  // Manual sale adjustment states
  const [adjDate, setAdjDate] = useState<string>(() => getLocalDateString());
  const [adjQty, setAdjQty] = useState<number>(1);
  const [adjValue, setAdjValue] = useState<number>(settings.defaultIceBagPrice);
  const [adjPayment, setAdjPayment] = useState<PaymentMethod>('pix');
  const [adjObs, setAdjObs] = useState<string>('');
  const [isAdjValueManual, setIsAdjValueManual] = useState<boolean>(false);

  const handleQtyChange = (qty: number) => {
    const validQty = Math.max(1, qty);
    setAdjQty(validQty);
    if (!isAdjValueManual) {
      setAdjValue(parseFloat((validQty * settings.defaultIceBagPrice).toFixed(2)));
    }
  };

  // Settings editing state
  const [settingsForm, setSettingsForm] = useState<SystemSettings>({
    ...settings,
    initialStock: currentStock,
  });

  // Sync settings form when currentStock changes
  const [syncedStock, setSyncedStock] = useState(currentStock);
  if (syncedStock !== currentStock) {
    setSyncedStock(currentStock);
    setSettingsForm((prev) => ({ ...prev, initialStock: currentStock }));
  }

  // Senior Administrator Validation States
  const [showSeniorValidationModal, setShowSeniorValidationModal] = useState(false);
  const [seniorPasswordInput, setSeniorPasswordInput] = useState('');
  const [seniorError, setSeniorError] = useState<string | null>(null);

  // Supabase Database Integration state
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [supabaseSyncMessage, setSupabaseSyncMessage] = useState<string | null>(null);
  const isDbActive = isSupabaseConfigured();

  // Local Database & Google Drive Backup Modal state
  const [showLocalDbModal, setShowLocalDbModal] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isResetConfirming, setIsResetConfirming] = useState(false);

  const handleSyncToSupabase = async () => {
    setIsSyncingSupabase(true);
    setSupabaseSyncMessage(null);
    try {
      const res = await supabaseStorageService.syncLocalDataToSupabase();
      if (res.success) {
        setSupabaseSyncMessage(`Sucesso! ${res.syncedCount} lançamentos sincronizados com o Supabase.`);
      } else {
        setSupabaseSyncMessage('Aviso: Verifique a configuração das chaves do Supabase em .env.example');
      }
    } catch (err: any) {
      setSupabaseSyncMessage('Erro na sincronização: ' + (err.message || 'Falha de conexão'));
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const handleTriggerExportBackup = async () => {
    setIsExportingBackup(true);
    setBackupFeedback(null);
    try {
      const res = onExportBackup ? await onExportBackup() : await exportDatabaseBackupToFile();
      if (res.success) {
        setBackupFeedback({
          type: 'success',
          message: `Backup do banco salvo com sucesso em "${res.filename}"! Se a pasta selecionada for do Google Drive, a sincronização é automática.`,
        });
      } else if (res.method !== 'canceled') {
        setBackupFeedback({
          type: 'error',
          message: 'Não foi possível gerar a cópia do banco local.',
        });
      }
    } catch (err: any) {
      setBackupFeedback({
        type: 'error',
        message: 'Erro ao exportar banco: ' + (err.message || 'Erro desconhecido'),
      });
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleTriggerImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('ATENÇÃO: Importar este arquivo de backup irá substituir o banco de dados atual no computador do posto. Deseja prosseguir?')) {
      e.target.value = '';
      return;
    }

    setIsImportingBackup(true);
    setBackupFeedback(null);
    try {
      const res = onImportBackup ? await onImportBackup(file) : await importDatabaseBackupFromFile(file);
      if (res.success) {
        setBackupFeedback({
          type: 'success',
          message: `Banco de dados restaurado com sucesso! ${res.movementsCount || 0} lançamentos e ${res.attendantsCount || 0} frentistas importados.`,
        });
      } else {
        setBackupFeedback({
          type: 'error',
          message: res.error || 'Falha ao ler arquivo de backup.',
        });
      }
    } catch (err: any) {
      setBackupFeedback({
        type: 'error',
        message: 'Erro ao restaurar banco: ' + (err.message || 'Formato inválido'),
      });
    } finally {
      setIsImportingBackup(false);
      e.target.value = '';
    }
  };


  const handleApprovePasswordSenior = () => {
    setShowSeniorValidationModal(true);
    setSeniorPasswordInput('');
    setSeniorError(null);
  };

  const handleConfirmSeniorValidation = () => {
    const seniorPassword = settings.adminPassword || '102035';
    if (seniorPasswordInput === seniorPassword) {
      const updated = {
        ...settings,
        adminPassword: settings.pendingAdminPassword,
        pendingAdminPassword: undefined
      };
      onUpdateSettings(updated);
      setSettingsForm(updated);
      setShowSeniorValidationModal(false);
      alert('✅ Validação do Administrador Sênior bem-sucedida! A nova senha foi ativada e já está em funcionamento.');
    } else {
      setSeniorError('Senha do Administrador Sênior incorreta!');
    }
  };

  const handleRejectPasswordSenior = () => {
    if (confirm('Deseja rejeitar o cadastro da nova senha e manter a senha atual?')) {
      const updated = {
        ...settings,
        pendingAdminPassword: undefined
      };
      onUpdateSettings(updated);
      setSettingsForm(updated);
      alert('Cadastro de nova senha rejeitado com sucesso.');
    }
  };

  // Handle settings save
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newPasswordProposal = settingsForm.adminPassword;
    const currentActivePassword = settings.adminPassword;
    
    const updatedSettings = { ...settingsForm };
    
    if (newPasswordProposal !== currentActivePassword) {
      // Password has changed! Place it as pending and restore current active password
      updatedSettings.pendingAdminPassword = newPasswordProposal;
      updatedSettings.adminPassword = currentActivePassword;
      
      // Keep state in sync with active password showing, but with pending set
      setSettingsForm(prev => ({
        ...prev,
        adminPassword: currentActivePassword,
        pendingAdminPassword: newPasswordProposal
      }));
      
      onUpdateSettings(updatedSettings);
      alert('⚠️ Cadastro de nova senha efetuado! Mas atenção: ela só passará a funcionar após a sua validação como Administrador Sênior (senha anterior do Admin).');
    } else {
      // Normal settings save without password change
      onUpdateSettings(updatedSettings);
      alert('Configurações administrativas salvas com sucesso!');
    }
  };

  // Handle frentista submission
  const handleAddAttendant = (e: React.FormEvent) => {
    e.preventDefault();
    const nameToSave = newAttendantName.trim();
    if (!nameToSave) return;
    onAddAttendant(nameToSave);
    setNewAttendantName('');
    alert(`Frentista "${nameToSave}" cadastrado e salvo com sucesso!`);
  };

  // Register production from dashboard directly
  const handleRegisterProduction = () => {
    if (adminProdQty <= 0) {
      alert('Selecione uma quantidade maior que zero.');
      return;
    }
    const result = onAddMovement({
      type: 'producao',
      quantity: adminProdQty,
      observation: adminProdObs.trim() || 'Produção registrada pelo Administrador',
    });
    if (result.success) {
      if (result.movement) {
        setPrintedMovement(result.movement);
      } else {
        alert('Produção registrada e adicionada ao estoque!');
      }
      setAdminProdQty(10);
      setAdminProdObs('');
    } else {
      alert(result.message);
    }
  };

  // Register manual sale adjustment
  const handleManualSaleAdjustment = () => {
    if (adjQty <= 0) {
      alert('Selecione uma quantidade maior que zero.');
      return;
    }
    if (adjValue < 0) {
      alert('O valor da venda não pode ser negativo.');
      return;
    }
    if (!adjDate) {
      alert('Selecione uma data para o lançamento.');
      return;
    }

    // Since this is a manual sale, unit price is adjValue / adjQty
    const unitPrice = adjQty > 0 ? parseFloat((adjValue / adjQty).toFixed(2)) : 0;

    const result = onAddMovement({
      type: 'venda',
      quantity: adjQty,
      totalPrice: adjValue,
      unitPrice: unitPrice,
      paymentMethod: adjPayment,
      date: adjDate,
      observation: adjObs.trim() || 'Ajuste manual de venda via Painel Administrativo',
    });

    if (result.success) {
      if (result.movement) {
        setPrintedMovement(result.movement);
      } else {
        alert('✅ Ajuste de venda registrado com sucesso! O estoque foi atualizado.');
      }
      // Reset state
      setAdjQty(1);
      setAdjValue(settings.defaultIceBagPrice);
      setAdjPayment('pix');
      setAdjObs('');
      setIsAdjValueManual(false);
      setAdjDate(new Date().toISOString().split('T')[0]);
    } else {
      alert(result.message);
    }
  };

  // Filter history movements
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      // 0. Filter by Status (Ativos vs Cancelados)
      const isCanceled = m.isCanceled || m.status === 'cancelado';
      if (filterStatus === 'ativos' && isCanceled) return false;
      if (filterStatus === 'cancelados' && !isCanceled) return false;

      // 1. Filter by Movement Type
      if (filterType !== 'todos' && m.type !== filterType) return false;
      
      // 2. Filter by Attendant
      if (filterAttendant !== 'todos' && m.attendantId !== filterAttendant) return false;
      
      // 3. Filter by Payment Method
      if (filterPayment !== 'todos' && m.paymentMethod !== filterPayment) return false;
      
      // 4. Filter by Period (Date calculations)
      const movDate = new Date(m.date);
      const today = new Date();
      today.setHours(0,0,0,0);
      
      if (filterPeriod === 'dia') {
        const todayStr = getLocalDateString();
        if (!isSameLocalDate(m.date, m.timestamp, todayStr)) return false;
      } else if (filterPeriod === 'semana') {
        const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (movDate < oneWeekAgo) return false;
      } else if (filterPeriod === 'mes') {
        const oneMonthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        if (movDate < oneMonthAgo) return false;
      } else if (filterPeriod === 'personalizado') {
        if (filterStartDate && m.date < filterStartDate) return false;
        if (filterEndDate && m.date > filterEndDate) return false;
      }

      // 5. Filter by Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = m.attendantName.toLowerCase().includes(query);
        const matchesId = m.id.toLowerCase().includes(query);
        const matchesRecipient = m.courtesyRecipient?.toLowerCase().includes(query) || false;
        const matchesObs = m.observation?.toLowerCase().includes(query) || false;
        const matchesCancelReason = m.cancelReason?.toLowerCase().includes(query) || false;
        return matchesName || matchesId || matchesRecipient || matchesObs || matchesCancelReason;
      }

      return true;
    });
  }, [movements, filterStatus, filterType, filterAttendant, filterPayment, filterPeriod, filterStartDate, filterEndDate, searchQuery]);

  // Export handlers
  const handleExportExcel = () => {
    exportToExcel(filteredMovements);
  };

  const handleExportPDF = () => {
    let totalSales = 0;
    let salesVolume = 0;
    let totalLosses = 0;
    let totalProduction = 0;
    let totalCourtesy = 0;
    let totalCanceled = 0;
    let totalCanceledValue = 0;

    filteredMovements.forEach((m) => {
      const isCanceled = m.isCanceled || m.status === 'cancelado';
      if (isCanceled) {
        totalCanceled++;
        totalCanceledValue += m.totalPrice || 0;
        return;
      }

      if (m.type === 'venda') {
        totalSales += m.totalPrice || 0;
        salesVolume += m.quantity;
      } else if (m.type === 'perda') {
        totalLosses += m.quantity;
      } else if (m.type === 'producao') {
        totalProduction += m.quantity;
      } else if (m.type === 'cortesia') {
        totalCourtesy += m.quantity;
      }
    });

    exportToPDF(filteredMovements, {
      currentStock,
      totalSales,
      salesVolume,
      totalLosses,
      totalProduction,
      totalCourtesy,
      totalCanceled,
      totalCanceledValue,
    });
  };

  const handleGeneratePeriodPDF = () => {
    const filtered = movements.filter((m) => {
      const movDate = m.date; // YYYY-MM-DD
      const today = new Date();
      today.setHours(0,0,0,0);
      const todayStr = getLocalDateString();

      if (reportPeriod === 'dia') {
        return isSameLocalDate(m.date, m.timestamp, todayStr);
      } else if (reportPeriod === 'semana') {
        const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];
        return movDate >= oneWeekAgoStr;
      } else if (reportPeriod === 'mes') {
        const oneMonthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0];
        return movDate >= oneMonthAgoStr;
      } else if (reportPeriod === 'personalizado') {
        if (reportStartDate && movDate < reportStartDate) return false;
        if (reportEndDate && movDate > reportEndDate) return false;
        return true;
      }
      return true; // todos
    });

    if (filtered.length === 0) {
      alert('Nenhuma movimentação encontrada para o período selecionado.');
      return;
    }

    let totalSales = 0;
    let salesVolume = 0;
    let totalLosses = 0;
    let totalProduction = 0;
    let totalCourtesy = 0;
    let totalCanceled = 0;
    let totalCanceledValue = 0;

    filtered.forEach((m) => {
      const isCanceled = m.isCanceled || m.status === 'cancelado';
      if (isCanceled) {
        totalCanceled++;
        totalCanceledValue += m.totalPrice || 0;
        return;
      }

      if (m.type === 'venda') {
        totalSales += m.totalPrice || 0;
        salesVolume += m.quantity;
      } else if (m.type === 'perda') {
        totalLosses += m.quantity;
      } else if (m.type === 'producao') {
        totalProduction += m.quantity;
      } else if (m.type === 'cortesia') {
        totalCourtesy += m.quantity;
      }
    });

    exportToPDF(filtered, {
      currentStock,
      totalSales,
      salesVolume,
      totalLosses,
      totalProduction,
      totalCourtesy,
      totalCanceled,
      totalCanceledValue,
    });
  };

  const handleExportCSV = () => {
    exportToCSV(filteredMovements);
  };

  return (
    <div id="admin-dashboard" className="min-h-screen bg-background text-on-background flex flex-col w-full max-w-4xl mx-auto px-4 py-3">
      
      {/* Top Admin Header Bar */}
      <header className="flex justify-between items-center py-3 border-b border-outline-variant/30">
        <div className="flex items-center gap-3">
          <button
            id="btn-back-dashboard"
            onClick={onBack}
            className="material-symbols-outlined text-primary p-2 hover:bg-surface-variant rounded-full active:scale-95 transition-transform"
          >
            arrow_back
          </button>
          <div>
            <h1 className="text-xl font-bold text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined font-light">admin_panel_settings</span>
              Painel Administrativo
            </h1>
            <p className="text-xs text-on-surface-variant font-medium">{settings.gasStationName}</p>
          </div>
        </div>
        
        {/* Notification Center Trigger */}
        <div className="flex items-center gap-3 relative">
          <button
            id="btn-notification-center"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2 rounded-full hover:bg-surface-variant active:scale-95 transition-all text-on-surface-variant flex items-center justify-center"
            title="Centro de Notificações"
          >
            <span className="material-symbols-outlined text-2xl">notifications</span>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="absolute top-1.5 right-1.5 h-4 w-4 bg-red-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center animate-bounce">
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </button>

          {/* Supabase Database Status indicator button */}
          <button
            id="btn-supabase-status"
            type="button"
            onClick={() => setShowSupabaseModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-all border shadow-2xs ${
              isDbActive
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
            }`}
            title="Clique para ver o status da conexão Supabase"
          >
            <span className={`h-2 w-2 rounded-full ${isDbActive ? 'bg-emerald-600 animate-pulse' : 'bg-amber-500'}`} />
            <span className="hidden sm:inline">{isDbActive ? 'Supabase Conectado' : 'Configurar Supabase'}</span>
            <span className="material-symbols-outlined text-xs text-emerald-700">cloud</span>
          </button>

          {/* Sync / Online Status indicator */}
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${currentStock <= 10 ? 'bg-error animate-pulse' : 'bg-tertiary'}`}></div>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider hidden sm:inline">
              {currentStock <= 10 ? 'Estoque Baixo!' : 'Estoque Saudável'}
            </span>
          </div>

          <AnimatePresence>
            {isNotificationsOpen && (
              <>
                {/* Backdrop to close */}
                <div 
                  className="fixed inset-0 z-40 bg-transparent" 
                  onClick={() => setIsNotificationsOpen(false)}
                />
                
                <motion.div
                  id="notification-dropdown"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-12 w-80 sm:w-96 bg-white border border-outline-variant/50 rounded-3xl shadow-2xl p-4 z-50 flex flex-col max-h-[450px] overflow-hidden text-on-surface"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-xl">notifications</span>
                      <h4 className="font-extrabold text-xs uppercase tracking-wider text-on-surface">Centro de Notificações</h4>
                    </div>
                    {notifications.length > 0 && (
                      <button 
                        onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                        className="text-[10px] text-primary hover:underline font-bold"
                      >
                        Ler todas
                      </button>
                    )}
                  </div>

                  {/* Desktop permissions prompt */}
                  {notificationPermission === 'default' && (
                    <div className="bg-primary/5 rounded-2xl p-3 mb-3 border border-primary/10 flex flex-col gap-2">
                      <p className="text-[10px] text-on-surface-variant leading-relaxed">
                        Deseja receber alertas automáticos de estoque na área de trabalho mesmo com o painel em segundo plano?
                      </p>
                      <button 
                        onClick={requestNotificationPermission}
                        className="text-[10px] self-start font-bold bg-primary text-on-primary px-3 py-1.5 rounded-lg active:scale-95 transition-all flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[10px]">campaign</span>
                        Ativar Notificações Desktop
                      </button>
                    </div>
                  )}

                  {/* Notifications list */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[250px] pr-1">
                    {notifications.length === 0 ? (
                      <div className="py-8 flex flex-col items-center justify-center text-center text-outline gap-2">
                        <span className="material-symbols-outlined text-3xl opacity-40">notifications_off</span>
                        <p className="text-xs">Nenhuma notificação ativa no momento.</p>
                        <p className="text-[10px] opacity-80">O monitoramento de estoque automático está ativo.</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={`p-3 rounded-2xl border transition-all relative ${
                            n.read ? 'bg-surface/50 border-outline-variant/10 opacity-75' : 'bg-surface border-outline-variant/30 shadow-xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold text-on-surface leading-tight pr-4">{n.title}</span>
                            <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                              n.type === 'danger' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {n.type === 'danger' ? 'Crítico' : 'Alerta'}
                            </span>
                          </div>
                          <p className="text-[10px] text-on-surface-variant leading-relaxed mt-1">{n.message}</p>
                          <div className="flex justify-between items-center mt-2 pt-1 border-t border-outline-variant/10 text-[8px] text-outline">
                            <span>{n.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            {!n.read && (
                              <button 
                                onClick={() => setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item))}
                                className="text-primary hover:underline font-bold"
                              >
                                Marcar como lido
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {notifications.length > 0 && (
                    <div className="pt-3 border-t border-outline-variant/20 mt-3 flex justify-between items-center text-[10px]">
                      <button 
                        onClick={() => setNotifications([])}
                        className="text-error hover:underline font-bold"
                      >
                        Limpar histórico
                      </button>
                      <span className="text-outline font-medium">Total: {notifications.length}</span>
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Navigation Admin Tabs */}
      <nav className="flex justify-between p-1 bg-surface-container rounded-2xl my-4">
        {[
          { id: 'dashboard', label: 'Indicadores', icon: 'monitoring' },
          { id: 'history', label: 'Histórico', icon: 'history' },
          { id: 'attendants', label: 'Frentistas', icon: 'group' },
          { id: 'settings', label: 'Ajustes', icon: 'settings' },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-admin-${tab.id}`}
              className={`flex-1 py-3 px-1 rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all ${
                active 
                  ? 'bg-primary text-on-primary shadow-sm scale-[1.02]' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              onClick={() => setActiveTab(tab.id as TabType)}
            >
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              <span className="hidden xs:inline">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Area based on Active Tab */}
      <main className="flex-1 pb-10">
        
        {/* 1. INDICATORS / DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* Quick Stats Grid Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl p-5 shadow-sm relative overflow-hidden">
                <span className="material-symbols-outlined text-primary text-2xl absolute right-4 top-4">inventory_2</span>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Estoque Atual</p>
                <h3 className="text-3xl font-black text-primary mt-2">{currentStock}</h3>
                <p className="text-[10px] text-outline mt-1">sacos em estoque</p>
              </div>

              <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl p-5 shadow-sm relative overflow-hidden">
                <span className="material-symbols-outlined text-tertiary text-2xl absolute right-4 top-4">payments</span>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Vendas Hoje</p>
                <h3 className="text-3xl font-black text-tertiary mt-2">R$ {stats.today.salesValue.toFixed(2).replace('.', ',')}</h3>
                <p className="text-[10px] text-outline mt-1">{stats.today.salesCount} vendas realizadas</p>
              </div>

              <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl p-5 shadow-sm relative overflow-hidden">
                <span className="material-symbols-outlined text-secondary text-2xl absolute right-4 top-4">sell</span>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Sacos Vendidos</p>
                <h3 className="text-3xl font-black text-secondary mt-2">{stats.today.salesVolume}</h3>
                <p className="text-[10px] text-outline mt-1">sacos entregues hoje</p>
              </div>

              <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl p-5 shadow-sm relative overflow-hidden">
                <span className="material-symbols-outlined text-error text-2xl absolute right-4 top-4">release_alert</span>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Perdas Hoje</p>
                <h3 className="text-3xl font-black text-error mt-2">{stats.today.lossVolume}</h3>
                <p className="text-[10px] text-outline mt-1">unidades perdidas</p>
              </div>

            </div>

            {/* Inconsistencies Alert Box banner */}
            {currentStock < 0 && (
              <div className="bg-error-container text-on-error-container p-4 rounded-3xl border border-error/20 flex gap-3 items-start">
                <span className="material-symbols-outlined text-error">warning</span>
                <div>
                  <h4 className="font-bold text-sm">Alerta de Inconsistência Crítica!</h4>
                  <p className="text-xs opacity-90 mt-1">O estoque calculado resultou em valor negativo. Verifique as movimentações pendentes.</p>
                </div>
              </div>
            )}

            {/* Low stock Warning Alert Box banner */}
            {currentStock <= settings.minimumStockAlert && currentStock >= 0 && (
              <div className={`p-4 rounded-3xl border flex gap-3 items-start transition-all ${
                currentStock <= 10 
                  ? 'bg-red-50 text-red-900 border-red-200' 
                  : 'bg-amber-50 text-amber-950 border-amber-200'
              }`}>
                <span className="material-symbols-outlined text-lg">
                  {currentStock <= 10 ? 'error' : 'warning'}
                </span>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-sm">
                      {currentStock <= 10 ? '⚠️ Alerta de Estoque Crítico!' : '⚠️ Alerta de Estoque Baixo!'}
                    </h4>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border self-start ${
                      currentStock <= 10 
                        ? 'bg-red-100 border-red-300 text-red-800' 
                        : 'bg-amber-100 border-amber-300 text-amber-800'
                    }`}>
                      {currentStock <= 10 ? 'Crítico' : 'Alerta'}
                    </span>
                  </div>
                  <p className="text-xs opacity-90 mt-1">
                    {currentStock <= 10 
                      ? `O estoque atual de gelo é de apenas ${currentStock} sacos, que é menor ou igual ao limite crítico de segurança de 10 unidades. Por favor, reabasteça o estoque imediatamente.`
                      : `O estoque atual de gelo é de ${currentStock} sacos, abaixo do limite de alerta configurado de ${settings.minimumStockAlert} sacos.`}
                  </p>
                </div>
              </div>
            )}

            {/* Production and Admin Stock Refill Form */}
            <div className="bg-surface-container-high rounded-3xl p-5 border border-outline-variant/30 shadow-sm">
              <h3 className="text-sm font-extrabold text-primary flex items-center gap-1.5 uppercase mb-4">
                <span className="material-symbols-outlined">restart_alt</span>
                Reabastecer / Registrar Produção de Gelo
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant">Quantidade Produzida (sacos)</label>
                  <input
                    id="admin-prod-qty-input"
                    type="number"
                    min="1"
                    className="w-full h-11 px-3 bg-white border border-outline-variant rounded-xl text-sm font-semibold"
                    placeholder="0"
                    value={adminProdQty === 0 ? '' : adminProdQty}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                      setAdminProdQty(val);
                    }}
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant">Observação Opcional</label>
                  <input
                    id="admin-prod-obs-input"
                    type="text"
                    className="w-full h-11 px-3 bg-white border border-outline-variant rounded-xl text-sm"
                    placeholder="Ex: Refil diário padrão"
                    value={adminProdObs}
                    onChange={(e) => setAdminProdObs(e.target.value)}
                  />
                </div>

                <button
                  id="btn-register-prod-admin"
                  type="button"
                  className="h-11 bg-primary text-on-primary text-xs font-bold rounded-xl active:scale-95 transition-all shadow-sm"
                  onClick={handleRegisterProduction}
                >
                  Registrar Produção
                </button>
              </div>
            </div>

            {/* Manual Sale Adjustment Form */}
            <div className="bg-surface-container-high rounded-3xl p-5 border border-outline-variant/30 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">sell</span>
                <h3 className="text-sm font-extrabold text-primary uppercase">
                  🛍️ Ajuste Manual de Vendas (Correção de Estoque)
                </h3>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Adicione um lançamento manual de venda para corrigir o nível de estoque e faturamento do posto, sem a necessidade de passar pelo fluxo de atendimento do frentista.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
                {/* Data */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant block">Data do Ajuste</label>
                  <input
                    id="admin-adj-date-input"
                    type="date"
                    required
                    className="w-full h-11 px-3 bg-white border border-outline-variant rounded-xl text-xs font-semibold focus:outline-none"
                    value={adjDate}
                    onChange={(e) => setAdjDate(e.target.value)}
                  />
                </div>

                {/* Quantidade */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant block">Quantidade (sacos)</label>
                  <input
                    id="admin-adj-qty-input"
                    type="number"
                    min="1"
                    required
                    className="w-full h-11 px-3 bg-white border border-outline-variant rounded-xl text-xs font-semibold focus:outline-none"
                    placeholder="0"
                    value={adjQty === 0 ? '' : adjQty}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                      handleQtyChange(val);
                    }}
                  />
                </div>

                {/* Valor Total */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant block">Valor Total (R$)</label>
                  <input
                    id="admin-adj-value-input"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="w-full h-11 px-3 bg-white border border-outline-variant rounded-xl text-xs font-semibold focus:outline-none"
                    placeholder="0.00"
                    value={adjValue === 0 ? '' : adjValue}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setAdjValue(val);
                      setIsAdjValueManual(true);
                    }}
                  />
                </div>

                {/* Meio de Pagamento */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant block">Meio de Pagamento</label>
                  <select
                    id="admin-adj-payment-select"
                    className="w-full h-11 px-2 bg-white border border-outline-variant rounded-xl text-xs font-semibold focus:outline-none"
                    value={adjPayment}
                    onChange={(e) => setAdjPayment(e.target.value as PaymentMethod)}
                  >
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="credito">Cartão de Crédito</option>
                    <option value="debito">Cartão de Débito</option>
                    <option value="pix_cnpj">PIX CNPJ</option>
                  </select>
                </div>

                {/* Observação */}
                <div className="space-y-1 lg:col-span-1 sm:col-span-2 md:col-span-3">
                  <label className="text-[11px] font-bold text-on-surface-variant block">Observação / Motivo</label>
                  <input
                    id="admin-adj-obs-input"
                    type="text"
                    placeholder="Ex: Correção de inventário"
                    className="w-full h-11 px-3 bg-white border border-outline-variant rounded-xl text-xs focus:outline-none"
                    value={adjObs}
                    onChange={(e) => setAdjObs(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  id="btn-register-sale-adjustment"
                  type="button"
                  onClick={handleManualSaleAdjustment}
                  className="px-5 h-11 bg-primary hover:bg-primary/95 text-on-primary text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm w-full sm:w-auto"
                >
                  <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                  Lançar Ajuste de Venda
                </button>
              </div>
            </div>

            {/* PDF Report Generation Card */}
            <div id="pdf-report-generator-card" className="bg-white border border-outline-variant/30 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-primary flex items-center gap-1.5 uppercase">
                <span className="material-symbols-outlined text-red-600">picture_as_pdf</span>
                Gerar Relatório PDF por Período
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Selecione o filtro de data desejado para gerar e baixar um arquivo PDF contendo o resumo consolidado do estoque, vendas, cortesias, perdas e o histórico detalhado de movimentações.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant">Filtro de Data (Período)</label>
                  <select
                    id="report-period-select"
                    className="w-full h-11 px-2.5 bg-surface-container rounded-xl text-xs font-semibold focus:outline-none"
                    value={reportPeriod}
                    onChange={(e) => {
                      setReportPeriod(e.target.value);
                      if (e.target.value !== 'personalizado') {
                        setReportStartDate('');
                        setReportEndDate('');
                      }
                    }}
                  >
                    <option value="todos">Todo o histórico</option>
                    <option value="dia">Hoje apenas</option>
                    <option value="semana">Últimos 7 dias</option>
                    <option value="mes">Últimos 30 dias</option>
                    <option value="personalizado">Período personalizado...</option>
                  </select>
                </div>

                {reportPeriod === 'personalizado' ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-on-surface-variant">Data Inicial</label>
                      <input
                        id="report-start-date-input"
                        type="date"
                        className="w-full h-11 px-3 bg-surface-container rounded-xl text-xs font-semibold focus:outline-none"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-on-surface-variant">Data Final</label>
                      <input
                        id="report-end-date-input"
                        type="date"
                        className="w-full h-11 px-3 bg-surface-container rounded-xl text-xs font-semibold focus:outline-none"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-2 text-xs text-outline leading-tight self-center pb-2">
                    {reportPeriod === 'todos' && 'Inclui todos os registros desde o início das operações.'}
                    {reportPeriod === 'dia' && 'Relatório focado estritamente no dia de hoje.'}
                    {reportPeriod === 'semana' && 'Consolidado correspondente aos últimos 7 dias.'}
                    {reportPeriod === 'mes' && 'Consolidado correspondente aos últimos 30 dias.'}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  id="btn-generate-report-pdf"
                  type="button"
                  onClick={handleGeneratePeriodPDF}
                  className="px-6 h-11 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
                >
                  <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                  Gerar e Baixar Relatório PDF
                </button>
              </div>
            </div>

            {/* Chart: Daily Sales Volume Evolution (Last 7 Days) */}
            <div id="chart-sales-evolution" className="bg-white border border-outline-variant/30 rounded-3xl p-5 shadow-sm">
              <h4 className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-purple-600">show_chart</span>
                Evolução do Volume de Vendas Diárias (Últimos 7 dias)
              </h4>
              
              <div className="h-56 w-full mt-2">
                {isMounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={last7DaysSales} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis 
                        dataKey="label" 
                        stroke="#9ca3af" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        dy={6}
                      />
                      <YAxis 
                        stroke="#9ca3af" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        dx={-4}
                        allowDecimals={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#ffffff', 
                          borderRadius: '16px', 
                          border: '1px solid #e5e7eb',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                        labelStyle={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}
                        itemStyle={{ fontSize: '11px', color: '#7c3aed', padding: '2px 0' }}
                        formatter={(value: any) => [`${value} sacos`, 'Quantidade Vendida']}
                        labelFormatter={(label) => `Dia: ${label}`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="vendas" 
                        stroke="#7c3aed" 
                        strokeWidth={3} 
                        activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }} 
                        dot={{ r: 4, fill: '#7c3aed', strokeWidth: 0 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full bg-surface-container/30 animate-pulse rounded-2xl flex items-center justify-center text-xs text-outline">
                    Carregando gráfico...
                  </div>
                )}
              </div>
              <p className="text-[10px] text-on-surface-variant text-center mt-3 font-medium">
                Volume acumulado de vendas por dia (em número de sacos de gelo entregues).
              </p>
            </div>

            {/* Custom Interactive SVG charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Chart A: Stock flow evolution */}
              <div id="chart-stock-levels" className="bg-white border border-outline-variant/30 rounded-3xl p-5 shadow-sm">
                <h4 className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-4 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-primary">trending_up</span>
                  Nível de Estoque ao Fim do Dia (Últimos 7 dias)
                </h4>
                
                <div className="h-44 w-full mt-2">
                  {isMounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={last7DaysStock} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                        <XAxis 
                          dataKey="label" 
                          stroke="#9ca3af" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          dy={6}
                        />
                        <YAxis 
                          stroke="#9ca3af" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          dx={-4}
                          allowDecimals={false}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#ffffff', 
                            borderRadius: '16px', 
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                          labelStyle={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}
                          itemStyle={{ fontSize: '11px', color: '#00488d', padding: '2px 0' }}
                          formatter={(value: any) => [`${value} sacos`, 'Estoque Disponível']}
                          labelFormatter={(label) => `Dia: ${label}`}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="estoque" 
                          stroke="#00488d" 
                          strokeWidth={3} 
                          activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }} 
                          dot={{ r: 4, fill: '#00488d', strokeWidth: 0 }} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full bg-surface-container/30 animate-pulse rounded-2xl flex items-center justify-center text-xs text-outline">
                      Carregando gráfico...
                    </div>
                  )}
                </div>
                
                <p className="text-[10px] text-on-surface-variant text-center mt-3 font-medium">Fórmula em tempo real: Estoque = {settings.initialStock} (Inicial) + {stats.totals.productionVolume} (Prod) - {stats.totals.salesVolume} (Vendas) - {stats.totals.courtesyVolume} (Cortesias) - {stats.totals.lossVolume} (Perdas)</p>
              </div>

              {/* Chart B: Payment Methods distribution */}
              <div className="bg-white border border-outline-variant/30 rounded-3xl p-5 shadow-sm">
                <h4 className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-4 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">pie_chart</span>
                  Distribuição por Forma de Pagamento (Faturamento total)
                </h4>
                
                <div className="space-y-3">
                  {[
                    { id: 'credito', label: 'Cartão de Crédito', color: 'bg-primary' },
                    { id: 'debito', label: 'Cartão de Débito', color: 'bg-secondary' },
                    { id: 'pix', label: 'Pix Maquininha', color: 'bg-tertiary' },
                    { id: 'pix_cnpj', label: 'Pix CNPJ Direto', color: 'bg-surface-tint' },
                    { id: 'dinheiro', label: 'Dinheiro em espécie', color: 'bg-outline' },
                  ].map((item) => {
                    const value = stats.paymentMethods[item.id]?.value || 0;
                    const pct = stats.totals.salesValue > 0 ? (value / stats.totals.salesValue) * 100 : 0;
                    
                    return (
                      <div key={item.id} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-on-surface-variant flex items-center gap-1.5">
                            <span className={`h-2.5 w-2.5 rounded-full ${item.color}`}></span>
                            {item.label}
                          </span>
                          <span>R$ {value.toFixed(2).replace('.', ',')} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                          <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Rank dos frentistas (Leaderboard list) */}
            <div className="bg-white border border-outline-variant/30 rounded-3xl p-5 shadow-sm">
              <h4 className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">stars</span>
                Ranking de Vendas dos Frentistas
              </h4>
              
              <div className="space-y-3">
                {stats.attendantRanking.length === 0 ? (
                  <p className="text-xs text-outline text-center py-4">Nenhuma venda registrada ainda no sistema.</p>
                ) : (
                  stats.attendantRanking.map((rank: any, index: number) => {
                    return (
                      <div key={rank.name} className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-2xl">
                        <div className="flex items-center gap-3">
                          <span className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-xs ${
                            index === 0 ? 'bg-yellow-400 text-yellow-900' : index === 1 ? 'bg-slate-300 text-slate-800' : 'bg-surface-container text-outline'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="text-sm font-semibold">{rank.name}</span>
                        </div>
                        
                        <div className="text-right text-xs">
                          <p className="font-bold text-primary">R$ {rank.sales.toFixed(2).replace('.', ',')}</p>
                          <p className="text-[10px] text-outline font-medium">{rank.quantity} sacos vendidos</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        )}

        {/* 2. HISTORY TAB WITH MULTI FILTER ENGINE */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            
            {/* Filter Drawer and Controls */}
            <div className="bg-white border border-outline-variant/30 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-primary flex items-center gap-1.5 uppercase">
                <span className="material-symbols-outlined">filter_list</span>
                Filtros e Parâmetros de Consulta
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                
                {/* 0. Filter by Status */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant">Status</label>
                  <select
                    id="filter-status-select"
                    className="w-full h-10 px-2 bg-surface-container rounded-xl text-xs font-semibold focus:outline-none"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="todos">Todos (Ativos + Cancelados)</option>
                    <option value="ativos">Somente Ativos</option>
                    <option value="cancelados">Somente Cancelados</option>
                  </select>
                </div>

                {/* 1. Filter by Movement Type */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant">Tipo</label>
                  <select
                    id="filter-type-select"
                    className="w-full h-10 px-2 bg-surface-container rounded-xl text-xs font-semibold focus:outline-none"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <option value="todos">Todos os lançamentos</option>
                    <option value="venda">Vendas</option>
                    <option value="producao">Produções de Estoque</option>
                    <option value="cortesia">Cortesias</option>
                    <option value="perda">Perdas / Avarias</option>
                  </select>
                </div>

                {/* 2. Filter by Frentista */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant">Frentista</label>
                  <select
                    id="filter-attendant-select"
                    className="w-full h-10 px-2 bg-surface-container rounded-xl text-xs font-semibold focus:outline-none"
                    value={filterAttendant}
                    onChange={(e) => setFilterAttendant(e.target.value)}
                  >
                    <option value="todos">Todos os frentistas</option>
                    {attendants.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Filter by Payment Method */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant">Pagamento</label>
                  <select
                    id="filter-payment-select"
                    className="w-full h-10 px-2 bg-surface-container rounded-xl text-xs font-semibold focus:outline-none"
                    value={filterPayment}
                    onChange={(e) => setFilterPayment(e.target.value)}
                  >
                    <option value="todos">Todas as formas</option>
                    <option value="credito">Cartão de Crédito</option>
                    <option value="debito">Cartão de Débito</option>
                    <option value="pix">Pix Maquininha</option>
                    <option value="pix_cnpj">Pix CNPJ Direto</option>
                    <option value="dinheiro">Dinheiro</option>
                  </select>
                </div>

                {/* 4. Filter by Period */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant">Período</label>
                  <select
                    id="filter-period-select"
                    className="w-full h-10 px-2 bg-surface-container rounded-xl text-xs font-semibold focus:outline-none"
                    value={filterPeriod}
                    onChange={(e) => {
                      setFilterPeriod(e.target.value);
                      if (e.target.value !== 'personalizado') {
                        setFilterStartDate('');
                        setFilterEndDate('');
                      }
                    }}
                  >
                    <option value="todos">Todo o histórico</option>
                    <option value="dia">Hoje apenas</option>
                    <option value="semana">Últimos 7 dias</option>
                    <option value="mes">Últimos 30 dias</option>
                    <option value="personalizado">Período personalizado...</option>
                  </select>
                </div>

              </div>

              {filterPeriod === 'personalizado' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-dashed border-outline-variant/30">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface-variant">Data Inicial (Filtro Personalizado)</label>
                    <input
                      id="filter-start-date-input"
                      type="date"
                      className="w-full h-10 px-3 bg-surface-container rounded-xl text-xs font-semibold focus:outline-none font-mono"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface-variant">Data Final (Filtro Personalizado)</label>
                    <input
                      id="filter-end-date-input"
                      type="date"
                      className="w-full h-10 px-3 bg-surface-container rounded-xl text-xs font-semibold focus:outline-none font-mono"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Text Search Box */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-sm text-outline">search</span>
                <input
                  id="history-search-input"
                  type="text"
                  className="w-full h-10 pl-9 pr-4 bg-surface-container rounded-xl text-xs"
                  placeholder="Pesquisar por ID, nome do frentista, beneficiário da cortesia..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Actions for Exports */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-outline-variant/20">
                <button
                  id="btn-export-excel"
                  className="flex-1 h-11 bg-primary-container text-on-primary-container font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  onClick={handleExportExcel}
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Exportar Excel
                </button>
                <button
                  id="btn-export-csv"
                  className="flex-1 h-11 bg-purple-100 hover:bg-purple-150 text-purple-800 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  onClick={handleExportCSV}
                >
                  <span className="material-symbols-outlined text-sm">table_view</span>
                  Exportar CSV
                </button>
                <button
                  id="btn-export-pdf"
                  className="flex-1 h-11 bg-secondary-container text-on-secondary-container font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  onClick={handleExportPDF}
                >
                  <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                  Exportar PDF
                </button>
              </div>

            </div>

            {/* List of Movements */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">
                Registros Filtrados ({filteredMovements.length})
              </h3>

              {filteredMovements.length === 0 ? (
                <div className="bg-white border border-outline-variant/30 rounded-3xl p-8 text-center">
                  <span className="material-symbols-outlined text-4xl text-outline mb-2">find_in_page</span>
                  <p className="text-xs text-outline font-medium">Nenhum registro encontrado para os filtros selecionados.</p>
                </div>
              ) : (
                filteredMovements.map((m) => {
                  const isCanceled = m.isCanceled || m.status === 'cancelado';
                  
                  // Label configs
                  const badgeColor = isCanceled
                    ? 'bg-red-100 text-red-900 border border-red-300'
                    : {
                        venda: m.discount ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800',
                        producao: 'bg-purple-100 text-purple-800',
                        cortesia: 'bg-emerald-100 text-emerald-800',
                        perda: 'bg-red-100 text-red-800'
                      }[m.type];

                  const typeLabel = isCanceled
                    ? 'CANCELADO'
                    : {
                        venda: m.discount ? 'Venda com desconto' : 'Venda',
                        producao: 'Produção',
                        cortesia: 'Cortesia',
                        perda: 'Perda'
                      }[m.type];

                  const detailsText = m.type === 'venda'
                    ? `Forma de Pgto: ${m.paymentMethod?.toUpperCase()} | Valor unitário: R$ ${m.unitPrice?.toFixed(2)}`
                    : m.type === 'cortesia'
                    ? `Cortesia entregue para: ${m.courtesyRecipient}`
                    : m.type === 'perda'
                    ? `Motivo: ${m.lossReason}`
                    : 'Ajuste de estoque';

                  return (
                    <div
                      key={m.id}
                      className={`rounded-2xl p-4 shadow-sm flex flex-col gap-3 relative transition-all ${
                        isCanceled
                          ? 'bg-red-50/30 border border-red-200 opacity-90'
                          : 'bg-white border border-outline-variant/30'
                      }`}
                    >
                      {/* Cancellation Banner inside card */}
                      {isCanceled && (
                        <div className="bg-red-100/80 border border-red-200 text-red-900 rounded-xl p-2.5 text-xs font-semibold flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-red-700 text-base">block</span>
                            <div>
                              <p className="font-extrabold uppercase text-[10px] text-red-800 tracking-wider">Lançamento Cancelado</p>
                              <p className="text-[11px] text-red-900 font-medium">Motivo: {m.cancelReason || 'Cancelamento registrado'}</p>
                            </div>
                          </div>
                          {m.canceledAt && (
                            <span className="text-[10px] text-red-700 font-mono">
                              {new Date(m.canceledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${isCanceled ? 'text-red-700 line-through' : 'text-primary'}`}>{m.id}</span>
                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${badgeColor}`}>
                              {typeLabel}
                            </span>
                          </div>
                          
                          <p className={`text-xs font-semibold mt-1 ${isCanceled ? 'text-neutral-600' : 'text-on-surface'}`}>Frentista: {m.attendantName}</p>
                          <p className="text-[10px] text-outline font-medium">{m.date} - às {m.time}</p>
                        </div>
                        
                        {/* Financial representation */}
                        <div className="text-right">
                          <p className={`text-xs font-bold ${isCanceled ? 'text-neutral-400 line-through' : 'text-outline'}`}>
                            Qtd: {m.quantity} sacos
                          </p>
                          {m.type === 'venda' && (
                            <p className={`text-sm font-black mt-0.5 ${isCanceled ? 'text-neutral-400 line-through' : 'text-primary'}`}>
                              R$ {m.totalPrice?.toFixed(2).replace('.', ',')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="bg-surface-container-low p-2 rounded-xl text-[11px] text-on-surface-variant font-medium">
                        {detailsText}
                        {m.observation && <p className="mt-1 text-outline font-normal">Obs: {m.observation}</p>}
                        {m.discount && (
                          <p className="mt-1 text-tertiary font-bold">
                            Desconto concedido: R$ {m.discount.valorConcedido.toFixed(2)} ({m.discount.percentual}%) - Auto: {m.discount.autorizadoPor}
                          </p>
                        )}
                      </div>

                      {/* Admin correction and cancellation actions */}
                      <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant/10 pt-2">
                        <button
                          type="button"
                          id={`btn-print-receipt-${m.id}`}
                          className="text-[11px] bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold flex items-center gap-1 px-3 py-1.5 rounded-xl active:scale-95 transition-all shadow-xs"
                          onClick={() => setPrintedMovement(m)}
                          title="Imprimir Comprovante/Recibo em impressora fiscal"
                        >
                          <span className="material-symbols-outlined text-sm">print</span>
                          Imprimir Recibo
                        </button>

                        {isCanceled ? (
                          <>
                            {onUncancelMovement && (
                              <button
                                id={`btn-uncancel-${m.id}`}
                                className="text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1 px-3 py-1.5 rounded-xl active:scale-95 transition-all shadow-xs"
                                onClick={() => {
                                  if (confirm(`Deseja reativar o lançamento #${m.id}?`)) {
                                    const res = onUncancelMovement(m.id);
                                    alert(res.message);
                                  }
                                }}
                              >
                                <span className="material-symbols-outlined text-sm">settings_backup_restore</span>
                                Reativar Lançamento
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            id={`btn-cancel-${m.id}`}
                            className="text-[11px] bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 font-bold flex items-center gap-1 px-3 py-1.5 rounded-xl active:scale-95 transition-all shadow-xs"
                            onClick={() => {
                              setCancelModalMovement(m);
                              setCancelReasonInput('Desistência do cliente');
                            }}
                          >
                            <span className="material-symbols-outlined text-sm">block</span>
                            Cancelar Venda / Lançamento
                          </button>
                        )}

                        <button
                          id={`btn-correct-delete-${m.id}`}
                          className="text-[11px] text-error font-semibold flex items-center gap-1 px-2.5 py-1.5 hover:bg-error-container/20 rounded-xl active:scale-95 transition-all"
                          onClick={() => {
                            if (confirm('Tem certeza de que deseja EXCLUIR DEFINITIVAMENTE este registro da base de dados?')) {
                              onRemoveMovement(m.id);
                              alert('Registro excluído permanentemente.');
                            }
                          }}
                          title="Excluir do sistema"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          Excluir
                        </button>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* 3. ATTENDANTS CADASTRE TAB */}
        {activeTab === 'attendants' && (
          <div className="space-y-6">
            
            {/* Cadastre Form */}
            <form onSubmit={handleAddAttendant} className="bg-white border border-outline-variant/30 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-primary flex items-center gap-1.5 uppercase">
                <span className="material-symbols-outlined">person_add</span>
                Cadastrar Novo Frentista
              </h3>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant">Nome Completo</label>
                <div className="flex gap-2">
                  <input
                    id="new-attendant-name-input"
                    type="text"
                    required
                    className="flex-1 h-11 px-3 bg-surface-container rounded-xl text-sm focus:outline-none"
                    placeholder="Nome do frentista"
                    value={newAttendantName}
                    onChange={(e) => setNewAttendantName(e.target.value)}
                  />
                  <button
                    id="btn-add-attendant"
                    type="submit"
                    className="h-11 px-5 bg-primary text-on-primary text-xs font-bold rounded-xl active:scale-95 transition-all"
                  >
                    Cadastrar
                  </button>
                </div>
              </div>
            </form>

            {/* List of Attendants */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">
                Frentistas Cadastrados ({attendants.length})
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {attendants.map((a) => (
                  <div key={a.id} className="bg-white border border-outline-variant/30 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {a.avatarUrl ? (
                        <img src={a.avatarUrl} alt={a.name} className="h-10 w-10 rounded-full object-cover border border-primary-fixed" />
                      ) : (
                        <span className="h-10 w-10 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-bold text-sm">
                          {a.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      
                      <div>
                        <p className="text-sm font-semibold">{a.name}</p>
                        <p className="text-[10px] text-outline">Cadastrado em: {new Date(a.createdAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Active/Inactive Toggle */}
                      <button
                        id={`btn-toggle-attendant-${a.id}`}
                        type="button"
                        className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
                          a.isActive 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-red-100 text-red-800'
                        }`}
                        onClick={() => {
                          onUpdateAttendant({
                            ...a,
                            isActive: !a.isActive,
                          });
                          alert(`Frentista ${a.name} foi ${!a.isActive ? 'ATIVADO' : 'DESATIVADO'} com sucesso.`);
                        }}
                      >
                        {a.isActive ? 'Ativo' : 'Inativo'}
                      </button>

                      {/* Delete Button */}
                      {onDeleteAttendant && (
                        <button
                          id={`btn-delete-attendant-${a.id}`}
                          type="button"
                          title="Excluir frentista"
                          className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          onClick={() => {
                            if (window.confirm(`Deseja realmente excluir o cadastro do frentista "${a.name}"?`)) {
                              onDeleteAttendant(a.id);
                              alert(`Frentista "${a.name}" foi removido com sucesso.`);
                            }
                          }}
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* 4. SETTINGS CONFIG TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <form onSubmit={handleSaveSettings} className="bg-white border border-outline-variant/30 rounded-3xl p-5 shadow-sm space-y-6">
            <h3 className="text-sm font-extrabold text-primary flex items-center gap-1.5 uppercase">
              <span className="material-symbols-outlined">settings_suggest</span>
              Configurações Gerais do Sistema
            </h3>

            {settings.pendingAdminPassword && (
              <div id="pending-password-card" className="bg-amber-50 border border-amber-200 rounded-3xl p-5 space-y-3.5">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-600 text-2xl">security</span>
                  <div className="space-y-1">
                    <h4 className="text-sm font-extrabold text-amber-950 uppercase tracking-wide">
                      ⚠️ Cadastro de Senha Pendente de Validação Sênior
                    </h4>
                    <p className="text-xs text-amber-900 leading-relaxed">
                      Uma nova senha de administrador foi cadastrada e está aguardando liberação. No momento, o sistema ainda exige a senha anterior para login e permissões de frentista.
                    </p>
                    <p className="text-xs text-amber-950 font-extrabold mt-1">
                      Nova senha proposta: <span className="bg-amber-200 px-2.5 py-0.5 rounded-lg font-mono text-xs">{settings.pendingAdminPassword}</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    id="btn-approve-password-senior"
                    type="button"
                    onClick={handleApprovePasswordSenior}
                    className="px-4 h-10 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">verified_user</span>
                    Validar como Admin Sênior
                  </button>
                  
                  <button
                    id="btn-reject-password-senior"
                    type="button"
                    onClick={handleRejectPasswordSenior}
                    className="px-4 h-10 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">cancel</span>
                    Rejeitar Alteração
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant">Nome do Posto de Combustíveis</label>
                <input
                  id="settings-station-name-input"
                  type="text"
                  required
                  className="w-full h-11 px-3 bg-surface-container rounded-xl text-sm"
                  value={settingsForm.gasStationName}
                  onChange={(e) => setSettingsForm({ ...settingsForm, gasStationName: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant">Preço Padrão do Saco de Gelo (R$)</label>
                <input
                  id="settings-default-price-input"
                  type="number"
                  step="0.01"
                  required
                  className="w-full h-11 px-3 bg-surface-container rounded-xl text-sm font-semibold"
                  placeholder="0.00"
                  value={settingsForm.defaultIceBagPrice === 0 ? '' : settingsForm.defaultIceBagPrice}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                    setSettingsForm({ ...settingsForm, defaultIceBagPrice: val });
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant">Estoque Atual do Posto (Sacos de Gelo)</label>
                <p className="text-[10px] text-outline font-medium">Informe a quantidade real em estoque. O sistema ajusta automaticamente para refletir o valor exato inserido.</p>
                <input
                  id="settings-initial-stock-input"
                  type="number"
                  required
                  className="w-full h-11 px-3 bg-surface-container rounded-xl text-sm font-bold text-primary"
                  placeholder="0"
                  value={settingsForm.initialStock === 0 ? '' : settingsForm.initialStock}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                    setSettingsForm({ ...settingsForm, initialStock: val });
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant">Senha do Administrador (PIN Numérico)</label>
                <input
                  id="settings-admin-password-input"
                  type="text"
                  maxLength={6}
                  required
                  className="w-full h-11 px-3 bg-surface-container rounded-xl text-sm font-bold tracking-[4px]"
                  value={settingsForm.adminPassword}
                  onChange={(e) => setSettingsForm({ ...settingsForm, adminPassword: e.target.value })}
                />
              </div>

            </div>

            {/* Regras de Negócio do Posto */}
            <div className="space-y-4 pt-4 border-t border-outline-variant/20">
              <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">gavel</span>
                Regras de Negócio Ativas
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant">Estoque Mínimo p/ Alerta (Sacos)</label>
                  <input
                    id="settings-min-stock-alert-input"
                    type="number"
                    min="1"
                    required
                    className="w-full h-11 px-3 bg-surface-container rounded-xl text-sm font-semibold"
                    placeholder="0"
                    value={settingsForm.minimumStockAlert === 0 ? '' : (settingsForm.minimumStockAlert ?? 15)}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                      setSettingsForm({ ...settingsForm, minimumStockAlert: val });
                    }}
                  />
                  <p className="text-[10px] text-outline">Ativa o alerta visual de reposição urgente.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant">Desconto Máximo Permitido (%)</label>
                  <input
                    id="settings-max-discount-pct-input"
                    type="number"
                    min="0"
                    max="100"
                    required
                    className="w-full h-11 px-3 bg-surface-container rounded-xl text-sm font-semibold"
                    placeholder="0"
                    value={settingsForm.maxDiscountPercentage === 0 ? '' : (settingsForm.maxDiscountPercentage ?? 50)}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                      setSettingsForm({ ...settingsForm, maxDiscountPercentage: Math.min(100, Math.max(0, val)) });
                    }}
                  />
                  <p className="text-[10px] text-outline">Bloqueia descontos abusivos ou incorretos.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant">Limite de Sacos p/ Operação</label>
                  <input
                    id="settings-max-bags-sale-input"
                    type="number"
                    min="1"
                    required
                    className="w-full h-11 px-3 bg-surface-container rounded-xl text-sm font-semibold"
                    placeholder="0"
                    value={settingsForm.maxBagsPerSale === 0 ? '' : (settingsForm.maxBagsPerSale ?? 100)}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                      setSettingsForm({ ...settingsForm, maxBagsPerSale: val });
                    }}
                  />
                  <p className="text-[10px] text-outline">Quantidade máxima por lançamento individual.</p>
                </div>
              </div>

              <label className="flex items-center gap-3 bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/20 cursor-pointer">
                <input
                  id="settings-require-loss-obs-toggle"
                  type="checkbox"
                  className="h-5 w-5 text-primary rounded border-outline focus:ring-primary"
                  checked={settingsForm.requireObservationForLoss ?? true}
                  onChange={(e) => setSettingsForm({ ...settingsForm, requireObservationForLoss: e.target.checked })}
                />
                <div>
                  <span className="text-xs font-bold text-on-surface">Exigir justificativa por escrito no lançamento de Perdas</span>
                  <p className="text-[10px] text-outline mt-0.5">Torna o campo de observação obrigatório para frentistas justificarem as perdas.</p>
                </div>
              </label>
            </div>

            {/* Permission checklist toggles */}
            <div className="space-y-3 pt-4 border-t border-outline-variant/20">
              <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Permissões e Segurança</h4>
              
              <label className="flex items-center gap-3 bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/20 cursor-pointer">
                <input
                  id="settings-require-admin-discount-toggle"
                  type="checkbox"
                  className="h-5 w-5 text-primary rounded border-outline focus:ring-primary"
                  checked={settingsForm.requireAdminForDiscount}
                  onChange={(e) => setSettingsForm({ ...settingsForm, requireAdminForDiscount: e.target.checked })}
                />
                <div>
                  <span className="text-xs font-bold text-on-surface">Exigir senha de administrador para conceder descontos</span>
                  <p className="text-[10px] text-outline mt-0.5">Se ativo, frentistas precisarão da senha do administrador para aplicar reduções de preço.</p>
                </div>
              </label>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant">Backup Automático em Nuvem</label>
                <select
                  id="settings-backup-select"
                  className="w-full h-11 px-3 bg-surface-container rounded-xl text-xs font-semibold focus:outline-none"
                  value={settingsForm.backupFrequency}
                  onChange={(e) => setSettingsForm({ ...settingsForm, backupFrequency: e.target.value as any })}
                >
                  <option value="diario">Diário (Recomendado)</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensal">Mensal</option>
                  <option value="desativado">Desativado</option>
                </select>
              </div>

            </div>

            <button
              id="btn-save-settings"
              type="submit"
              className="w-full h-14 bg-primary text-on-primary rounded-full font-bold shadow-md hover:brightness-110 active:scale-95 transition-all text-sm uppercase tracking-wider"
            >
              Salvar Configurações
            </button>

            </form>

            {/* Supabase Cloud Database & Web Integration Card */}
            <div className="bg-emerald-50/90 border border-emerald-300 rounded-3xl p-5 space-y-4 shadow-sm text-emerald-950">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-2xl">cloud_sync</span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold uppercase tracking-wide text-emerald-950 flex items-center gap-1.5">
                    🌐 Banco de Dados Supabase (Nuvem & Web)
                  </h4>
                  <p className="text-xs leading-relaxed text-emerald-900/90">
                    Sincronização em tempo real das vendas, estoques e relatórios na nuvem Supabase. Permite acesso seguro e simultâneo por múltiplos navegadores ou dispositivos do posto.
                  </p>
                  <p className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">info</span>
                    Status Conexão: {isDbActive ? '🟢 Conectado e Ativo' : '🟡 Aguardando Chaves do Supabase (.env.example)'}
                  </p>
                </div>
              </div>

              {supabaseSyncMessage && (
                <div className="p-3 bg-white border border-emerald-300 rounded-2xl text-xs font-bold text-emerald-900 shadow-2xs">
                  {supabaseSyncMessage}
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  id="btn-settings-sync-supabase"
                  type="button"
                  onClick={handleSyncToSupabase}
                  disabled={isSyncingSupabase}
                  className="flex-1 h-11 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-xs active:scale-95 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">sync</span>
                  {isSyncingSupabase ? 'Sincronizando com Nuvem...' : 'Forçar Sincronização Supabase'}
                </button>

                <button
                  id="btn-settings-open-supabase-modal"
                  type="button"
                  onClick={() => setShowSupabaseModal(true)}
                  className="flex-1 h-11 bg-white border border-emerald-300 hover:bg-emerald-100/60 text-emerald-900 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-xs active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">settings</span>
                  Verificar Chaves e Status
                </button>
              </div>
            </div>

            {/* Local Database Backup & Drive Export Card */}
            <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl p-5 space-y-4 text-on-surface">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-surface-container text-on-surface-variant flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-2xl">file_download</span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold uppercase tracking-wide text-on-surface flex items-center gap-1.5">
                    💾 Cópia de Segurança do Banco de Dados (.JSON)
                  </h4>
                  <p className="text-xs leading-relaxed text-on-surface-variant">
                    Gere um arquivo de dump do banco para guardar como backup local ou mover dados entre instâncias do sistema.
                  </p>
                  {lastBackupTime && (
                    <p className="text-[11px] font-bold text-primary mt-1">
                      Último backup gerado em: {new Date(lastBackupTime).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>

              {backupFeedback && (
                <div className={`p-3 rounded-2xl text-xs font-bold ${
                  backupFeedback.type === 'success' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-red-100 text-red-900 border border-red-300'
                }`}>
                  {backupFeedback.message}
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  id="btn-settings-export-backup"
                  type="button"
                  onClick={handleTriggerExportBackup}
                  disabled={isExportingBackup}
                  className="flex-1 h-11 bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/30 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-xs active:scale-95 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  {isExportingBackup ? 'Gerando Cópia...' : 'Baixar Cópia do Banco (.JSON)'}
                </button>

                <label className="flex-1 h-11 bg-white border border-outline-variant/30 hover:bg-surface-container text-on-surface rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95">
                  <span className="material-symbols-outlined text-sm">upload_file</span>
                  {isImportingBackup ? 'Restaurando...' : 'Restaurar Banco de Arquivo'}
                  <input
                    type="file"
                    accept=".json,.db,.json"
                    onChange={handleTriggerImportBackup}
                    disabled={isImportingBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Diagnostic/Reset Parameters Card */}
            <div id="test-reset-card" className="bg-red-50 border border-red-200 rounded-3xl p-5 space-y-3.5">
              {!isResetConfirming ? (
                <>
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-red-600 text-2xl">restart_alt</span>
                    <div className="space-y-1">
                      <h4 className="text-sm font-extrabold text-red-950 uppercase tracking-wide">
                        🔄 Resetar Sistema & Limpar Dados (Ambiente de Testes)
                      </h4>
                      <p className="text-xs text-red-950 leading-relaxed">
                        Esta ação apagará de forma definitiva todo o histórico de lançamentos, redefinirá as configurações do posto de combustíveis para o padrão e colocará o <strong>estoque inicial em 0</strong>.
                      </p>
                      <p className="text-xs text-red-900 leading-relaxed">
                        Ideal para limpar o banco de dados antes de registrar um novo lote de produção e realizar testes simulados limpos.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      id="btn-trigger-reset-system"
                      type="button"
                      onClick={() => setIsResetConfirming(true)}
                      className="px-5 h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">delete_forever</span>
                      Zerar Todos os Parâmetros (0 Estoque)
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-red-700 text-3xl animate-bounce">warning</span>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-red-700 uppercase tracking-wide">
                        ⚠️ ATENÇÃO: VOCÊ TEM CERTEZA?
                      </h4>
                      <p className="text-xs text-red-950 font-bold leading-relaxed">
                        Esta ação é definitiva, irreversível e apagará TODO o histórico de lançamentos do posto de gelo. O estoque atual e inicial serão redefinidos para ZERO (0).
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2 border-t border-red-200">
                    <button
                      id="btn-cancel-reset"
                      type="button"
                      onClick={() => setIsResetConfirming(false)}
                      className="px-4 h-11 bg-white hover:bg-red-100 text-red-900 border border-red-300 rounded-xl text-xs font-bold active:scale-95 transition-all shadow-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      id="btn-confirm-reset-all"
                      type="button"
                      onClick={() => {
                        onResetAllData();
                        setIsResetConfirming(false);
                        onBack();
                      }}
                      className="px-5 h-11 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md"
                    >
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Sim, Resetar Tudo e Zerar o Estoque!
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* Senior Administrator Password Verification Modal */}
      <AnimatePresence>
        {showSeniorValidationModal && (
          <div id="senior-validation-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-3xl p-6 border border-outline-variant/30 shadow-2xl space-y-4 text-on-surface"
            >
              <div className="flex justify-between items-center border-b border-outline-variant/20 pb-2">
                <h3 className="font-extrabold text-sm text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined">security</span>
                  Validação do Admin Sênior
                </h3>
                <button
                  id="btn-close-senior-modal"
                  type="button"
                  onClick={() => setShowSeniorValidationModal(false)}
                  className="material-symbols-outlined text-outline p-1 hover:bg-surface-variant rounded-full"
                >
                  close
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Para autorizar a ativação da nova senha <span className="font-mono font-bold">({settings.pendingAdminPassword})</span>, digite a sua senha atual de <strong>Administrador Sênior</strong>:
                </p>

                <div className="space-y-1">
                  <input
                    id="senior-password-auth-input"
                    type="password"
                    maxLength={10}
                    className="w-full h-12 px-3 bg-surface-container rounded-xl text-center text-lg font-bold tracking-[6px] focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="••••••"
                    value={seniorPasswordInput}
                    onChange={(e) => {
                      setSeniorError(null);
                      setSeniorPasswordInput(e.target.value);
                    }}
                  />
                  {seniorError && (
                    <p className="text-xs text-error font-semibold text-center">{seniorError}</p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    id="btn-cancel-senior-validation"
                    type="button"
                    onClick={() => setShowSeniorValidationModal(false)}
                    className="flex-1 h-11 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    id="btn-confirm-senior-validation"
                    type="button"
                    onClick={handleConfirmSeniorValidation}
                    className="flex-1 h-11 bg-primary text-on-primary rounded-xl text-xs font-bold shadow-sm"
                  >
                    Confirmar Validação
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cancel Movement Modal */}
      <AnimatePresence>
        {cancelModalMovement && (
          <div id="cancel-movement-overlay" className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl p-6 border border-outline-variant/30 shadow-2xl space-y-4 text-on-surface"
            >
              <div className="flex justify-between items-center border-b border-outline-variant/20 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-red-100 text-red-800 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">block</span>
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-on-surface uppercase tracking-wider">
                      Cancelar Lançamento #{cancelModalMovement.id}
                    </h3>
                    <p className="text-[10px] text-outline font-semibold">
                      O registro será marcado como cancelado nos relatórios.
                    </p>
                  </div>
                </div>
                <button
                  id="btn-close-cancel-modal"
                  type="button"
                  onClick={() => setCancelModalMovement(null)}
                  className="material-symbols-outlined text-outline p-1 hover:bg-surface-container rounded-full"
                >
                  close
                </button>
              </div>

              {/* Transaction Summary Card */}
              <div className="bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/20 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-outline font-medium">Frentista:</span>
                  <span className="font-extrabold text-on-surface">{cancelModalMovement.attendantName}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-outline font-medium">Operação:</span>
                  <span className="font-extrabold text-primary uppercase">{cancelModalMovement.type}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-outline font-medium">Quantidade:</span>
                  <span className="font-extrabold text-on-surface">{cancelModalMovement.quantity} sacos</span>
                </div>
                {cancelModalMovement.type === 'venda' && (
                  <div className="flex justify-between items-center text-xs border-t border-outline-variant/15 pt-1.5">
                    <span className="text-outline font-bold">Valor do Estorno:</span>
                    <span className="font-black text-red-700 text-sm">
                      R$ {cancelModalMovement.totalPrice?.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                )}
              </div>

              {/* Reason Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                  Motivo do Cancelamento <span className="text-red-600">*</span>
                </label>

                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                  {[
                    'Desistência do cliente',
                    'Erro de digitação',
                    'Devolução do gelo',
                    'Forma de pgto errada',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCancelReasonInput(preset)}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        cancelReasonInput === preset
                          ? 'bg-red-50 border-red-500 text-red-900 font-extrabold shadow-xs'
                          : 'bg-surface-container/60 border-outline-variant/20 text-on-surface hover:bg-surface-container'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <textarea
                  id="input-cancel-reason-text"
                  rows={2}
                  className="w-full p-3 bg-surface-container rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500 border border-outline-variant/20"
                  placeholder="Escreva ou edite o motivo detalhado do cancelamento..."
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                />
              </div>

              <div className="bg-blue-50/60 border border-blue-200/60 p-2.5 rounded-xl text-[11px] text-blue-900 font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-700 text-base">info</span>
                <span>
                  Ao confirmar, o estoque e totais serão recalculados e o cancelamento constará no relatório em PDF/Excel.
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  id="btn-abort-cancel"
                  type="button"
                  onClick={() => setCancelModalMovement(null)}
                  className="flex-1 h-11 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-bold text-on-surface transition-all"
                >
                  Voltar / Manter
                </button>
                <button
                  id="btn-confirm-cancel-movement"
                  type="button"
                  onClick={() => {
                    if (!onCancelMovement) {
                      alert('Ação indisponível.');
                      return;
                    }
                    const res = onCancelMovement(cancelModalMovement.id, cancelReasonInput);
                    alert(res.message);
                    setCancelModalMovement(null);
                  }}
                  className="flex-1 h-11 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md"
                >
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Confirmar Cancelamento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Supabase Integration Info Modal */}
      <AnimatePresence>
        {showSupabaseModal && (
          <div id="supabase-modal-overlay" className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl p-6 border border-outline-variant/30 shadow-2xl space-y-4 text-on-surface max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-outline-variant/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                    isDbActive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    <span className="material-symbols-outlined text-2xl">cloud_sync</span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-on-surface uppercase tracking-wider">
                      Integração Banco de Dados Supabase
                    </h3>
                    <p className="text-[11px] text-outline font-semibold">
                      {isDbActive ? 'Conexão ativa e sincronizada!' : 'Configuração em .env.example / .env.local'}
                    </p>
                  </div>
                </div>
                <button
                  id="btn-close-supabase-modal"
                  type="button"
                  onClick={() => setShowSupabaseModal(false)}
                  className="material-symbols-outlined text-outline p-1 hover:bg-surface-container rounded-full"
                >
                  close
                </button>
              </div>

              {/* Status Banner */}
              <div className={`p-4 rounded-2xl border text-xs ${
                isDbActive
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/80 border-amber-200 text-amber-950'
              }`}>
                <div className="flex items-center gap-2 font-bold text-sm mb-1">
                  <span className="material-symbols-outlined">
                    {isDbActive ? 'check_circle' : 'cloud_off'}
                  </span>
                  <span>{isDbActive ? 'Supabase Conectado!' : 'Aguardando Inserção das Chaves no .env.local ou Secrets'}</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {isDbActive
                    ? 'Todos os lançamentos, frentistas, estoques e configurações são sincronizados em tempo real no seu banco de dados PostgreSQL do Supabase.'
                    : 'O sistema já possui o SDK e todo o código de rotas web pronto. Insira NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para ativar o salvamento remoto definitivo.'}
                </p>
              </div>

              {/* Env Vars Reference */}
              <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 space-y-2">
                <h4 className="text-xs font-black uppercase text-outline tracking-wider">Variáveis de Ambiente (.env.example)</h4>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="p-2 bg-white rounded-xl border border-outline-variant/15 flex justify-between items-center">
                    <span>NEXT_PUBLIC_SUPABASE_URL</span>
                    <span className="text-[10px] font-sans font-bold px-2 py-0.5 rounded-full bg-surface-container text-outline">Público</span>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-outline-variant/15 flex justify-between items-center">
                    <span>NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
                    <span className="text-[10px] font-sans font-bold px-2 py-0.5 rounded-full bg-surface-container text-outline">Público</span>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-outline-variant/15 flex justify-between items-center">
                    <span>SUPABASE_SERVICE_ROLE_KEY</span>
                    <span className="text-[10px] font-sans font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">Secreto (Servidor)</span>
                  </div>
                </div>
              </div>

              {/* SQL Schema Notice */}
              <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-2xl text-xs text-blue-950 space-y-1">
                <p className="font-extrabold flex items-center gap-1.5 text-blue-900">
                  <span className="material-symbols-outlined text-sm">terminal</span>
                  Script SQL do Banco Supabase
                </p>
                <p className="text-[11px] text-blue-900/90">
                  O arquivo <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[10px]">supabase/schema.sql</code> cria todas as tabelas (movements, attendants, settings) e ativa o RLS.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/supabase/status');
                      const json = await res.json();
                      alert(json.message || json.error || 'Status verificado com sucesso');
                    } catch (e: any) {
                      alert('Erro ao testar API do Supabase: ' + e.message);
                    }
                  }}
                  className="flex-1 h-11 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-extrabold text-on-surface transition-all flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">network_check</span>
                  Testar Conexão
                </button>
                <button
                  type="button"
                  onClick={() => setShowSupabaseModal(false)}
                  className="flex-1 h-11 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-extrabold transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Local Database & Google Drive Backup Modal */}
      <AnimatePresence>
        {showLocalDbModal && (
          <div id="local-db-modal-overlay" className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl p-6 border border-outline-variant/30 shadow-2xl space-y-4 text-on-surface max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-outline-variant/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                    <span className="material-symbols-outlined text-2xl">database</span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-on-surface uppercase tracking-wider">
                      Banco de Dados Local & Google Drive
                    </h3>
                    <p className="text-[11px] text-emerald-700 font-bold">
                      🟢 Operação 100% Offline e Independente
                    </p>
                  </div>
                </div>
                <button
                  id="btn-close-local-db-modal"
                  type="button"
                  onClick={() => setShowLocalDbModal(false)}
                  className="material-symbols-outlined text-outline p-1 hover:bg-surface-container rounded-full"
                >
                  close
                </button>
              </div>

              {/* Status Banner */}
              <div className="p-4 rounded-2xl border bg-emerald-50/80 border-emerald-200 text-emerald-950 space-y-1">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <span className="material-symbols-outlined text-emerald-700">check_circle</span>
                  <span>Sistema Rodando Localmente no Computador</span>
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-900/90">
                  Todas as vendas, perdas, cortesias, cadastro de frentistas e estoque são mantidos em armazenamento local direto no computador do posto. Não depende de sinal de internet nem servidores na nuvem.
                </p>
              </div>

              {/* Google Drive Backup Instructions */}
              <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 space-y-2.5">
                <h4 className="text-xs font-black uppercase text-on-surface tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-base">cloud_sync</span>
                  Como Funciona o Backup no Google Drive?
                </h4>
                <ol className="list-decimal list-inside text-xs space-y-2 text-on-surface-variant leading-relaxed">
                  <li>
                    Clique no botão <strong>&quot;Salvar Cópia do Banco&quot;</strong> abaixo.
                  </li>
                  <li>
                    Escolha como local de salvamento a sua pasta do <strong>Google Drive para Desktop</strong> no computador (ex: <code className="bg-surface-container px-1 rounded text-[10px] font-mono">G:\Meu Drive\Backups_Gelo\</code>).
                  </li>
                  <li>
                    O arquivo <code className="bg-surface-container px-1 rounded text-[10px] font-mono">backup_gelo_*.json</code> será salvo e o Google Drive enviará uma cópia de segurança para a nuvem em segundo plano!
                  </li>
                </ol>
                {lastBackupTime && (
                  <p className="text-[11px] font-bold text-emerald-800 pt-1">
                    🕒 Última cópia gerada: {new Date(lastBackupTime).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>

              {backupFeedback && (
                <div className={`p-3 rounded-2xl text-xs font-bold ${
                  backupFeedback.type === 'success' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-red-100 text-red-900 border border-red-300'
                }`}>
                  {backupFeedback.message}
                </div>
              )}

              <div className="space-y-2 pt-1">
                <button
                  id="btn-export-db-file"
                  type="button"
                  onClick={handleTriggerExportBackup}
                  disabled={isExportingBackup}
                  className="w-full h-12 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  {isExportingBackup ? 'Gerando Cópia de Segurança...' : 'Salvar Cópia do Banco (Google Drive)'}
                </button>

                <label className="w-full h-12 bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/30 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95">
                  <span className="material-symbols-outlined text-base">upload_file</span>
                  {isImportingBackup ? 'Restaurando Banco...' : 'Restaurar Banco de Dados de Arquivo'}
                  <input
                    type="file"
                    accept=".json,.db,.json"
                    onChange={handleTriggerImportBackup}
                    disabled={isImportingBackup}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex justify-end pt-2 border-t border-outline-variant/15">
                <button
                  id="btn-close-local-db-modal-bottom"
                  type="button"
                  onClick={() => setShowLocalDbModal(false)}
                  className="px-6 h-10 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-extrabold transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Thermal Receipt Modal */}
      <ReceiptModal 
        movement={printedMovement} 
        stationName={settings?.gasStationName || 'Auto Posto Tropical'}
        onClose={() => setPrintedMovement(null)} 
      />

    </div>
  );
}
