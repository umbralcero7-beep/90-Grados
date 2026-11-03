import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  ExpenseRecord, 
  ExpenseType, 
  ExpenseStatus, 
  ExpenseCategory, 
  ExpensePaymentMethod,
  ExpenseAttachment,
  LedgerEntry 
} from '../types';
import { formatCOP, formatDateTimeBogota } from '../utils/format';
import { 
  BookOpen, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Download, 
  Printer, 
  AlertCircle, 
  Calendar,
  Layers,
  Building,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  ShieldAlert,
  ArrowRightLeft,
  Briefcase,
  ShoppingBag,
  HelpCircle,
  Search,
  Filter,
  Eye,
  Paperclip,
  Check,
  X,
  FileCheck,
  ChevronRight,
  ShieldCheck,
  Sliders,
  PieChart
} from 'lucide-react';

export const GastosLibroMayor: React.FC = () => {
  const { 
    expenses, 
    addExpense, 
    updateExpenseStatus, 
    annulExpense, 
    refundExpense,
    ledger, 
    currentUser, 
    currentShift, 
    orders, 
    inventory,
    config,
    updateConfig,
    hasPermission 
  } = useApp();

  // Active top tab
  const [activeTab, setActiveTab] = useState<'gastos' | 'diferenciacion' | 'reportes' | 'aprobaciones' | 'asientos' | 'politicas'>('gastos');

  // Search and filters for expenses
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('todos');
  const [centerFilter, setCenterFilter] = useState<string>('todos');
  const [dateRangeFilter, setDateRangeFilter] = useState<'todos' | 'hoy' | 'ultimos_7' | 'este_mes'>('todos');

  // Registration modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expType, setExpType] = useState<ExpenseType>('gasto_operativo');
  const [expCategory, setExpCategory] = useState<ExpenseCategory | string>('Servicios Públicos');
  const [expAmount, setExpAmount] = useState<number>(50000);
  const [expDesc, setExpDesc] = useState('');
  const [expThirdParty, setExpThirdParty] = useState('');
  const [expThirdPartyNit, setExpThirdPartyNit] = useState('');
  const [expInvoiceNum, setExpInvoiceNum] = useState('');
  const [expPaymentMethod, setExpPaymentMethod] = useState<ExpensePaymentMethod>('efectivo_caja');
  const [expCenter, setExpCenter] = useState<'Restaurante Matutino' | 'Bar Nocturno' | 'Administración'>('Restaurante Matutino');
  const [expResponsible, setExpResponsible] = useState(currentUser.fullName);
  const [expOperationalDate, setExpOperationalDate] = useState(new Date().toISOString().split('T')[0]);
  const [expInventoryItemId, setExpInventoryItemId] = useState<string>('');
  const [expInventoryUnits, setExpInventoryUnits] = useState<number>(0);
  const [expAttachment, setExpAttachment] = useState<ExpenseAttachment | undefined>(undefined);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [formFeedback, setFormFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Annulment modal state
  const [showAnnulModal, setShowAnnulModal] = useState(false);
  const [expenseToAnnul, setExpenseToAnnul] = useState<ExpenseRecord | null>(null);
  const [annulmentReason, setAnnulmentReason] = useState('');
  const [annulError, setAnnulError] = useState<string | null>(null);

  // Voucher / Receipt view modal
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherExpense, setVoucherExpense] = useState<ExpenseRecord | null>(null);

  // Audit history modal
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditExpense, setAuditExpense] = useState<ExpenseRecord | null>(null);

  // File upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Role permissions checks based on centralized AppContext configuration
  const isAdmin = currentUser.role === 'administrador';
  const canRegisterExpenses = hasPermission('registrar_gastos');
  const canApproveExpenses = hasPermission('aprobar_pagos');
  const canViewReports = hasPermission('ver_reportes');

  // Categories list
  const standardCategories: ExpenseCategory[] = [
    'Servicios Públicos',
    'Arriendo & Local',
    'Nómina & Turnos',
    'Transporte & Acarreos',
    'Mantenimiento',
    'Suministros & Aseo',
    'Comisiones & Pasarelas',
    'Impuestos & Tasas',
    'Costo de Insumos',
    'Aporte de Capital',
    'Retiro de Capital',
    'Transferencia entre Cajas',
    'Otro Egreso',
  ];

  // Handle file selection with type and size restriction (Max 2MB, PDF/Images only)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const maxSizeBytes = 2 * 1024 * 1024; // 2 MB

    if (!allowedTypes.includes(file.type)) {
      setAttachmentError('Formato no permitido. Solo se aceptan archivos PDF, JPG, PNG o WEBP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > maxSizeBytes) {
      setAttachmentError(`El archivo pesa ${(file.size / (1024 * 1024)).toFixed(2)} MB. El límite máximo permitido es 2.0 MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setExpAttachment({
        fileName: file.name,
        fileType: file.type,
        fileSizeKB: Math.round(file.size / 1024),
        dataUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  // Submit expense registration
  const handleRegisterExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setFormFeedback(null);

    if (expAmount <= 0) {
      setFormFeedback({ type: 'error', message: 'El valor debe ser mayor a cero en enteros COP.' });
      return;
    }

    if (!expDesc.trim()) {
      setFormFeedback({ type: 'error', message: 'La descripción del movimiento es obligatoria.' });
      return;
    }

    const result = addExpense({
      date: new Date().toISOString(),
      operationalDate: expOperationalDate,
      shiftId: currentShift ? currentShift.id : undefined,
      shiftCenter: expCenter,
      amountCOP: Math.round(expAmount),
      category: expCategory,
      type: expType,
      description: expDesc.trim(),
      thirdPartyName: expThirdParty.trim() || undefined,
      thirdPartyNit: expThirdPartyNit.trim() || undefined,
      invoiceNumber: expInvoiceNum.trim() || undefined,
      paymentMethod: expPaymentMethod,
      cashDeskId: expPaymentMethod === 'efectivo_caja' ? (currentShift?.center || 'Caja Salón') : 'Bancolombia / Electrónico',
      center: expCenter,
      responsiblePerson: expResponsible.trim() || currentUser.fullName,
      supportAttachment: expAttachment,
      inventoryItemId: expType === 'compra_inventario' && expInventoryItemId ? expInventoryItemId : undefined,
      inventoryUnitsPurchased: expType === 'compra_inventario' && expInventoryUnits > 0 ? expInventoryUnits : undefined,
    });

    if (result.success) {
      setShowExpenseModal(false);
      resetExpenseForm();
    } else {
      setFormFeedback({ type: 'error', message: result.message });
    }
  };

  const resetExpenseForm = () => {
    setExpAmount(50000);
    setExpDesc('');
    setExpThirdParty('');
    setExpThirdPartyNit('');
    setExpInvoiceNum('');
    setExpInventoryItemId('');
    setExpInventoryUnits(0);
    setExpAttachment(undefined);
    setAttachmentError(null);
    setFormFeedback(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Annulment submission (strictly audited, never silent deletion)
  const handleConfirmAnnulment = (e: React.FormEvent) => {
    e.preventDefault();
    setAnnulError(null);

    if (!expenseToAnnul) return;
    if (!annulmentReason.trim() || annulmentReason.trim().length < 5) {
      setAnnulError('Debe ingresar un motivo de anulación justificado (mínimo 5 caracteres).');
      return;
    }

    const res = annulExpense(expenseToAnnul.id, annulmentReason.trim());
    if (res.success) {
      setShowAnnulModal(false);
      setExpenseToAnnul(null);
      setAnnulmentReason('');
    } else {
      setAnnulError(res.message);
    }
  };

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      // Text search
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchDesc = exp.description?.toLowerCase().includes(q);
        const matchThird = exp.thirdPartyName?.toLowerCase().includes(q);
        const matchNit = exp.thirdPartyNit?.toLowerCase().includes(q);
        const matchInvoice = exp.invoiceNumber?.toLowerCase().includes(q);
        const matchUser = exp.registeredByUserName?.toLowerCase().includes(q);
        if (!matchDesc && !matchThird && !matchNit && !matchInvoice && !matchUser) return false;
      }

      // Type filter
      if (typeFilter !== 'todos' && exp.type !== typeFilter) return false;

      // Category filter
      if (categoryFilter !== 'todos' && exp.category !== categoryFilter) return false;

      // Status filter
      if (statusFilter !== 'todos' && exp.status !== statusFilter) return false;

      // Payment method filter
      if (paymentMethodFilter !== 'todos' && exp.paymentMethod !== paymentMethodFilter) return false;

      // Center filter
      if (centerFilter !== 'todos' && exp.center !== centerFilter) return false;

      // Date range filter
      if (dateRangeFilter !== 'todos') {
        const todayStr = new Date().toISOString().split('T')[0];
        const expDate = exp.operationalDate || exp.date.split('T')[0];

        if (dateRangeFilter === 'hoy' && expDate !== todayStr) return false;
        if (dateRangeFilter === 'ultimos_7') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (new Date(expDate) < sevenDaysAgo) return false;
        }
        if (dateRangeFilter === 'este_mes') {
          const currentMonth = todayStr.substring(0, 7);
          if (!expDate.startsWith(currentMonth)) return false;
        }
      }

      return true;
    });
  }, [expenses, searchTerm, typeFilter, categoryFilter, statusFilter, paymentMethodFilter, centerFilter, dateRangeFilter]);

  // Aggregate metrics calculation (strictly separating operational expenses, inventory, owner capital, withdrawals, transfers)
  const metrics = useMemo(() => {
    const completedOrders = orders.filter(o => o.status === 'pagada');
    const totalSalesCOP = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    // Active (non-annulled) expenses
    const validExpenses = expenses.filter(e => e.status !== 'anulado');

    const operational = validExpenses.filter(e => e.type === 'gasto_operativo');
    const operationalCOP = operational.reduce((sum, e) => sum + e.amountCOP, 0);

    const inventoryPurchases = validExpenses.filter(e => e.type === 'compra_inventario');
    const inventoryCOP = inventoryPurchases.reduce((sum, e) => sum + e.amountCOP, 0);

    const investments = validExpenses.filter(e => e.type === 'inversion_dueno');
    const investmentsCOP = investments.reduce((sum, e) => sum + e.amountCOP, 0);

    const withdrawals = validExpenses.filter(e => e.type === 'retiro_dueno');
    const withdrawalsCOP = withdrawals.reduce((sum, e) => sum + e.amountCOP, 0);

    const transfers = validExpenses.filter(e => e.type === 'transferencia_cajas');
    const transfersCOP = transfers.reduce((sum, e) => sum + e.amountCOP, 0);

    const pendingApproval = expenses.filter(e => e.status === 'pendiente_aprobacion');
    const pendingApprovalCOP = pendingApproval.reduce((sum, e) => sum + e.amountCOP, 0);

    const cashExpenses = validExpenses.filter(e => e.paymentMethod === 'efectivo_caja');
    const cashExpensesCOP = cashExpenses.reduce((sum, e) => sum + e.amountCOP, 0);

    const bankExpenses = validExpenses.filter(e => e.paymentMethod !== 'efectivo_caja');
    const bankExpensesCOP = bankExpenses.reduce((sum, e) => sum + e.amountCOP, 0);

    // Theoretical Cost of Goods Sold (~38% of sales)
    const estimatedCOGS = Math.round(totalSalesCOP * 0.38);

    // Net Operating Result = Sales - COGS - Operational Expenses (Excludes capital inputs/outputs)
    const netOperatingResult = totalSalesCOP - estimatedCOGS - operationalCOP;

    return {
      totalSalesCOP,
      operationalCOP,
      inventoryCOP,
      investmentsCOP,
      withdrawalsCOP,
      transfersCOP,
      pendingApprovalCount: pendingApproval.length,
      pendingApprovalCOP,
      cashExpensesCOP,
      bankExpensesCOP,
      estimatedCOGS,
      netOperatingResult,
      totalGeneralEgressCOP: operationalCOP + inventoryCOP + withdrawalsCOP,
    };
  }, [expenses, orders]);

  // Breakdown by category
  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    expenses
      .filter(e => e.status !== 'anulado' && e.type === 'gasto_operativo')
      .forEach(e => {
        map[e.category] = (map[e.category] || 0) + e.amountCOP;
      });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  // CSV Export utility
  const handleExportCSV = () => {
    const headers = [
      'ID Egreso',
      'Fecha Registro',
      'Fecha Operativa',
      'Turno',
      'Centro/Sede',
      'Tipo de Movimiento',
      'Categoría',
      'Descripción',
      'Tercero / Proveedor',
      'NIT / Cédula',
      'Nº Factura/Soporte',
      'Valor COP',
      'Medio de Pago',
      'Caja Origen',
      'Responsable',
      'Registrado Por',
      'Estado',
      'Aprobado Por',
      'Fecha Aprobación',
      'Motivo Anulación',
    ];

    const rows = filteredExpenses.map(e => [
      e.id,
      e.date,
      e.operationalDate || '',
      e.shiftId || 'N/A',
      e.center || '',
      e.type,
      e.category,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      `"${(e.thirdPartyName || 'N/A').replace(/"/g, '""')}"`,
      e.thirdPartyNit || 'N/A',
      e.invoiceNumber || 'N/A',
      e.amountCOP,
      e.paymentMethod,
      e.cashDeskId || '',
      e.responsiblePerson || '',
      e.registeredByUserName,
      e.status,
      e.approvedByUserName || 'N/A',
      e.approvedAt || 'N/A',
      `"${(e.annulmentReason || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `control_gastos_90_grados_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for badge colors
  const getStatusBadge = (status: ExpenseStatus) => {
    switch (status) {
      case 'aprobado':
      case 'pagado':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> {status === 'aprobado' ? 'Aprobado' : 'Pagado'}
          </span>
        );
      case 'pendiente_aprobacion':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#7C170D]/30 text-[#EBE1D5] border border-[#7C170D]/60 animate-pulse">
            <Clock className="w-3 h-3 text-[#EBE1D5]" /> Pendiente Aprobación
          </span>
        );
      case 'anulado':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-950/40 text-red-400 border border-red-500/30 line-through">
            <XCircle className="w-3 h-3" /> Anulado
          </span>
        );
      case 'borrador':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#151946]/50 text-[#EBE1D5] border border-[#EBE1D5]/20">
            <FileText className="w-3 h-3 text-[#EBE1D5]" /> Borrador
          </span>
        );
      case 'reembolsado':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-950/40 text-cyan-400 border border-cyan-500/30">
            <ArrowRightLeft className="w-3 h-3" /> Reembolsado
          </span>
        );
    }
  };

  const getTypeBadge = (type: ExpenseType) => {
    switch (type) {
      case 'gasto_operativo':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-950/40 text-red-300 border border-red-800/40">Gasto Operativo</span>;
      case 'compra_inventario':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-orange-950/40 text-orange-300 border border-orange-800/40">Compra Inventario</span>;
      case 'inversion_dueno':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/40 text-cyan-300 border border-cyan-800/40">Aporte Dueño (Capital)</span>;
      case 'retiro_dueno':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-950/40 text-purple-300 border border-purple-800/40">Retiro Dueño</span>;
      case 'transferencia_cajas':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-950/40 text-blue-300 border border-blue-800/40">Traslado de Caja</span>;
      case 'devolucion_reembolso':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-teal-950/40 text-teal-300 border border-teal-800/40">Devolución / Reembolso</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-[#0B0D18] text-[#EBE1D5] overflow-hidden">
      
      {/* MODULE HEADER */}
      <div className="p-4 sm:p-5 border-b border-[#EBE1D5]/20 header-brand-gradient shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#151946] border border-[#EBE1D5]/20 flex items-center justify-center text-[#EBE1D5] shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">Control de Gastos & Libro Mayor</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#7C170D] text-white border border-[#EBE1D5]/30">
                90 Grados
              </span>
            </div>
            <p className="text-xs text-[#A6AFCA] mt-0.5">
              Gestión de egresos con trazabilidad contable, auditoría por rol y separación estricta de capital y compras.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg bg-[#151946] hover:bg-[#151946]/80 border border-[#EBE1D5]/20 text-[#EBE1D5] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exportar datos autorizados en formato CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#EBE1D5]" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => {
              if (!canRegisterExpenses) {
                alert(`El rol activo (@${currentUser.username} - ${currentUser.role}) no tiene el permiso "registrar_gastos" habilitado en la Configuración.`);
                return;
              }
              resetExpenseForm();
              setShowExpenseModal(true);
            }}
            disabled={!canRegisterExpenses}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md border ${
              canRegisterExpenses 
                ? 'bg-[#7C170D] hover:bg-[#961D12] text-white border-[#EBE1D5]/30 active:scale-95' 
                : 'bg-[#151946]/40 text-[#A6AFCA] cursor-not-allowed border-[#EBE1D5]/10'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Movimiento</span>
          </button>
        </div>
      </div>

      {/* NAVIGATION SUB-TABS */}
      <div className="px-4 sm:px-6 border-b border-[#EBE1D5]/20 bg-[#0E1120] shrink-0 flex items-center gap-1.5 overflow-x-auto text-xs py-2 scrollbar-thin">
        <button
          onClick={() => setActiveTab('gastos')}
          className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border ${
            activeTab === 'gastos' ? 'bg-[#7C170D] text-white shadow border-[#EBE1D5]/30' : 'text-[#EBE1D5] hover:text-white hover:bg-[#151946] border-transparent'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Egresos & Movimientos ({expenses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('aprobaciones')}
          className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border ${
            activeTab === 'aprobaciones' ? 'bg-[#7C170D] text-white shadow border-[#EBE1D5]/30' : 'text-[#EBE1D5] hover:text-white hover:bg-[#151946] border-transparent'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pendientes de Aprobación</span>
          {metrics.pendingApprovalCount > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              activeTab === 'aprobaciones' ? 'bg-[#0B0D18] text-[#EBE1D5]' : 'bg-[#7C170D] text-white'
            }`}>
              {metrics.pendingApprovalCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('diferenciacion')}
          className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border ${
            activeTab === 'diferenciacion' ? 'bg-[#7C170D] text-white shadow border-[#EBE1D5]/30' : 'text-[#EBE1D5] hover:text-white hover:bg-[#151946] border-transparent'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Diferenciación de Movimientos</span>
        </button>

        <button
          onClick={() => setActiveTab('reportes')}
          className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border ${
            activeTab === 'reportes' ? 'bg-[#7C170D] text-white shadow border-[#EBE1D5]/30' : 'text-[#EBE1D5] hover:text-white hover:bg-[#151946] border-transparent'
          }`}
        >
          <PieChart className="w-3.5 h-3.5" />
          <span>Reportes & Conciliación</span>
        </button>

        <button
          onClick={() => setActiveTab('asientos')}
          className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border ${
            activeTab === 'asientos' ? 'bg-[#7C170D] text-white shadow border-[#EBE1D5]/30' : 'text-[#EBE1D5] hover:text-white hover:bg-[#151946] border-transparent'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Libro Mayor ({ledger.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('politicas')}
          className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border ${
            activeTab === 'politicas' ? 'bg-[#7C170D] text-white shadow border-[#EBE1D5]/30' : 'text-[#EBE1D5] hover:text-white hover:bg-[#151946] border-transparent'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Políticas & Permisos</span>
        </button>
      </div>

      {/* MAIN VIEW CONTENT CONTAINER */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

        {/* TAB 1: REGISTRO Y LISTADO DE GASTOS */}
        {activeTab === 'gastos' && (
          <div className="max-w-7xl mx-auto space-y-5">
            
            {/* Top KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20">
                <span className="text-[11px] text-[#A6AFCA] uppercase font-semibold block mb-0.5">Gastos Operativos</span>
                <span className="text-xl font-bold font-mono text-red-400 tabular-nums">{formatCOP(metrics.operationalCOP)}</span>
                <p className="text-[10px] text-[#A6AFCA] mt-1">Servicios, arriendo, nómina</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20">
                <span className="text-[11px] text-[#A6AFCA] uppercase font-semibold block mb-0.5">Compras Inventario</span>
                <span className="text-xl font-bold font-mono text-orange-400 tabular-nums">{formatCOP(metrics.inventoryCOP)}</span>
                <p className="text-[10px] text-[#A6AFCA] mt-1">Insumos para la venta</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20">
                <span className="text-[11px] text-[#A6AFCA] uppercase font-semibold block mb-0.5">Aportes del Dueño</span>
                <span className="text-xl font-bold font-mono text-cyan-400 tabular-nums">+{formatCOP(metrics.investmentsCOP)}</span>
                <p className="text-[10px] text-cyan-400/80 mt-1">Capital (No es venta)</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20">
                <span className="text-[11px] text-[#A6AFCA] uppercase font-semibold block mb-0.5">Retiros del Dueño</span>
                <span className="text-xl font-bold font-mono text-purple-400 tabular-nums">-{formatCOP(metrics.withdrawalsCOP)}</span>
                <p className="text-[10px] text-[#A6AFCA] mt-1">Salida de capital propio</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0E1120] border border-[#7C170D]/50 col-span-2 lg:col-span-1">
                <span className="text-[11px] text-[#EBE1D5] uppercase font-semibold block mb-0.5 flex items-center justify-between">
                  <span>Por Aprobar</span>
                  <span className="text-[10px] bg-[#7C170D] text-white px-1.5 py-0.2 rounded font-mono font-bold">
                    {metrics.pendingApprovalCount}
                  </span>
                </span>
                <span className="text-xl font-bold font-mono text-[#EBE1D5] tabular-nums">{formatCOP(metrics.pendingApprovalCOP)}</span>
                <p className="text-[10px] text-[#A6AFCA] mt-1">&ge; COP {formatCOP(config.approvalThresholdCOP || 200000)}</p>
              </div>
            </div>

            {/* Filter toolbar */}
            <div className="p-3.5 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-3">
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#71788E] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por descripción, tercero, NIT, factura o usuario..."
                    className="w-full pl-9 pr-3 py-1.5 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-xs text-white placeholder-[#71788E] focus:outline-none focus:border-[#7C170D]"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')} 
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A6AFCA] hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto text-xs shrink-0">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-[#EBE1D5] text-xs focus:outline-none focus:border-[#7C170D]"
                  >
                    <option value="todos">Todos los tipos</option>
                    <option value="gasto_operativo">Gasto Operativo</option>
                    <option value="compra_inventario">Compra Inventario</option>
                    <option value="inversion_dueno">Aporte Dueño</option>
                    <option value="retiro_dueno">Retiro Dueño</option>
                    <option value="transferencia_cajas">Traslado Cajas</option>
                    <option value="devolucion_reembolso">Reembolso</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-[#EBE1D5] text-xs focus:outline-none focus:border-[#7C170D]"
                  >
                    <option value="todos">Todos los estados</option>
                    <option value="pendiente_aprobacion">Pendiente Aprobación</option>
                    <option value="aprobado">Aprobado</option>
                    <option value="pagado">Pagado</option>
                    <option value="borrador">Borrador</option>
                    <option value="anulado">Anulado</option>
                    <option value="reembolsado">Reembolsado</option>
                  </select>

                  <select
                    value={paymentMethodFilter}
                    onChange={(e) => setPaymentMethodFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-[#EBE1D5] text-xs focus:outline-none focus:border-[#7C170D]"
                  >
                    <option value="todos">Todos los medios</option>
                    <option value="efectivo_caja">Efectivo de Caja</option>
                    <option value="cuenta_bancaria">Transferencia Bancaria</option>
                    <option value="nequi">Nequi / Daviplata</option>
                    <option value="tarjeta">Tarjeta Débito/Crédito</option>
                  </select>

                  <select
                    value={dateRangeFilter}
                    onChange={(e) => setDateRangeFilter(e.target.value as any)}
                    className="px-2.5 py-1.5 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-[#EBE1D5] text-xs focus:outline-none focus:border-[#7C170D]"
                  >
                    <option value="todos">Cualquier fecha</option>
                    <option value="hoy">Hoy</option>
                    <option value="ultimos_7">Últimos 7 días</option>
                    <option value="este_mes">Este mes</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Expenses Table */}
            <div className="rounded-xl border border-[#EBE1D5]/20 bg-[#0E1120] overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#151946] border-b border-[#EBE1D5]/20 text-[#EBE1D5] uppercase font-semibold">
                    <tr>
                      <th className="p-3">Fecha / Turno</th>
                      <th className="p-3">Tipo / Categoría</th>
                      <th className="p-3">Descripción & Soporte</th>
                      <th className="p-3">Tercero / Proveedor</th>
                      <th className="p-3">Medio de Pago</th>
                      <th className="p-3">Registrado Por</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-right">Valor COP</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EBE1D5]/10">
                    {filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-[#71788E]">
                          No se encontraron egresos con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      filteredExpenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-[#151946]/20 transition-colors">
                          <td className="p-3 font-mono text-[#A6AFCA] whitespace-nowrap">
                            <div>{exp.operationalDate || exp.date.split('T')[0]}</div>
                            <span className="text-[10px] text-[#71788E] block">
                              {exp.center || 'Restaurante'} {exp.shiftId ? `· #${exp.shiftId.slice(-4)}` : ''}
                            </span>
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <div className="mb-1">{getTypeBadge(exp.type)}</div>
                            <span className="font-semibold text-white block text-xs">{exp.category}</span>
                          </td>

                          <td className="p-3 max-w-xs">
                            <p className="font-medium text-[#EBE1D5] line-clamp-2">{exp.description}</p>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-[#A6AFCA]">
                              {exp.invoiceNumber && (
                                <span className="font-mono text-[#A6AFCA]">Fac: {exp.invoiceNumber}</span>
                              )}
                              {exp.supportAttachment && (
                                <span className="inline-flex items-center gap-1 text-[#EBE1D5] font-mono text-[10px] bg-[#151946] px-1 rounded border border-[#EBE1D5]/20">
                                  <Paperclip className="w-2.5 h-2.5" />
                                  <span>{exp.supportAttachment.fileName}</span>
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="p-3">
                            <span className="font-medium text-[#EBE1D5] block">{exp.thirdPartyName || 'N/A'}</span>
                            {exp.thirdPartyNit && (
                              <span className="text-[10px] font-mono text-[#71788E]">NIT: {exp.thirdPartyNit}</span>
                            )}
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <span className="font-mono text-[#EBE1D5] block capitalize">
                              {exp.paymentMethod.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] text-[#71788E] block">{exp.cashDeskId || 'Caja Salón'}</span>
                          </td>

                          <td className="p-3 whitespace-nowrap font-mono text-[#A6AFCA]">
                            <div>@{exp.registeredByUserName.split(' ')[0]}</div>
                            <span className="text-[10px] text-[#71788E] block">{exp.responsiblePerson || ''}</span>
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            {getStatusBadge(exp.status)}
                          </td>

                          <td className="p-3 text-right font-mono font-bold text-white whitespace-nowrap tabular-nums text-sm">
                            {formatCOP(exp.amountCOP)}
                          </td>

                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              {/* Voucher button */}
                              <button
                                onClick={() => {
                                  setVoucherExpense(exp);
                                  setShowVoucherModal(true);
                                }}
                                title="Ver / Imprimir Comprobante de Egreso"
                                className="p-1.5 rounded-lg bg-[#0B0D18] hover:bg-[#151946] text-[#EBE1D5] hover:text-white border border-[#EBE1D5]/20 cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {/* Audit trail */}
                              <button
                                onClick={() => {
                                  setAuditExpense(exp);
                                  setShowAuditModal(true);
                                }}
                                title="Ver Historial de Auditoría y Trazabilidad"
                                className="p-1.5 rounded-lg bg-[#0B0D18] hover:bg-[#151946] text-[#EBE1D5] hover:text-white border border-[#EBE1D5]/20 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Approval action if pending */}
                              {exp.status === 'pendiente_aprobacion' && canApproveExpenses && (
                                <button
                                  onClick={() => {
                                    if (confirm(`¿Aprobar formalmente el egreso de ${formatCOP(exp.amountCOP)} para "${exp.description}"?`)) {
                                      updateExpenseStatus(exp.id, 'aprobado', `Aprobado formalmente por @${currentUser.username} (${currentUser.role})`);
                                    }
                                  }}
                                  title="Aprobar Egreso (Permiso 'aprobar_pagos')"
                                  className="p-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Annulment button (never silent delete) */}
                              {exp.status !== 'anulado' && (isAdmin || exp.registeredByUserId === currentUser.id) && (
                                <button
                                  onClick={() => {
                                    setExpenseToAnnul(exp);
                                    setAnnulmentReason('');
                                    setAnnulError(null);
                                    setShowAnnulModal(true);
                                  }}
                                  title="Anular Movimiento (Exige justificación auditada)"
                                  className="p-1.5 rounded-lg bg-[#0B0D18] hover:bg-red-950/60 text-[#A6AFCA] hover:text-red-400 border border-[#EBE1D5]/20 hover:border-red-800 cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: DIFERENCIACIÓN DE MOVIMIENTOS & CAPITAL */}
        {activeTab === 'diferenciacion' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="p-4 rounded-xl bg-[#151946]/50 border border-[#EBE1D5]/20 text-xs text-[#EBE1D5] flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#EBE1D5] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white text-sm">Constitución Contable del Restaurante-Bar 90 Grados:</p>
                <p className="mt-1 text-[#EBE1D5]/80 leading-relaxed">
                  Para garantizar la salud financiera y la veracidad de los balances, cada peso que sale o entra al negocio debe estar estrictamente clasificado. 
                  <strong> Los aportes del dueño NUNCA son ventas, y los retiros del dueño NUNCA son gastos operativos.</strong>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Card 1: Gasto Operativo */}
              <div className="p-5 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-8 rounded-lg bg-[#7C170D]/20 border border-[#7C170D]/40 text-[#EBE1D5] flex items-center justify-center font-bold">
                      1
                    </span>
                    <h3 className="font-bold text-base text-white">Gasto Operativo</h3>
                  </div>
                  <p className="text-xs text-[#A6AFCA] leading-relaxed mb-3">
                    Egresos necesarios para el funcionamiento regular del local que se consumen en el periodo (arriendo, energía eléctrica, gas propano, agua, nómina, mantenimiento de parrillas, aseo y desechables).
                  </p>
                  <div className="p-3 bg-[#0B0D18] rounded-lg text-xs space-y-1 border border-[#EBE1D5]/10">
                    <div className="flex justify-between text-[#EBE1D5]">
                      <span>Total periodo:</span>
                      <strong className="font-mono text-red-400">{formatCOP(metrics.operationalCOP)}</strong>
                    </div>
                    <div className="text-[11px] text-[#71788E]">Impacto: Resta de la utilidad operacional del negocio.</div>
                  </div>
                </div>
              </div>

              {/* Card 2: Compra de Inventario */}
              <div className="p-5 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-300 flex items-center justify-center font-bold">
                      2
                    </span>
                    <h3 className="font-bold text-base text-white">Compra de Inventario</h3>
                  </div>
                  <p className="text-xs text-[#A6AFCA] leading-relaxed mb-3">
                    Adquisición de carnes, licores, cervezas y verduras destinadas a la transformación y venta. <strong>No es gasto directo</strong>: ingresa al activo de inventarios y se costea al momento de despachar las órdenes (escandallos).
                  </p>
                  <div className="p-3 bg-[#0B0D18] rounded-lg text-xs space-y-1 border border-[#EBE1D5]/10">
                    <div className="flex justify-between text-[#EBE1D5]">
                      <span>Total compras registradas:</span>
                      <strong className="font-mono text-orange-400">{formatCOP(metrics.inventoryCOP)}</strong>
                    </div>
                    <div className="text-[11px] text-[#71788E]">Integración: Incrementa el stock de insumos sin duplicar costo.</div>
                  </div>
                </div>
              </div>

              {/* Card 3: Inversión / Aporte del Dueño */}
              <div className="p-5 rounded-2xl bg-[#0E1120] border border-cyan-500/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center font-bold">
                      3
                    </span>
                    <h3 className="font-bold text-base text-white">Inversión o Aporte del Dueño</h3>
                  </div>
                  <p className="text-xs text-[#A6AFCA] leading-relaxed mb-3">
                    Inyecciones de capital personal del socio para comprar activos, remodelaciones o cubrir baches de flujo de caja. <strong>JAMÁS se debe registrar como venta</strong> ni inflar el ingreso operacional.
                  </p>
                  <div className="p-3 bg-[#0B0D18] rounded-lg text-xs space-y-1 border border-[#EBE1D5]/10">
                    <div className="flex justify-between text-[#EBE1D5]">
                      <span>Aportes registrados:</span>
                      <strong className="font-mono text-cyan-400">+{formatCOP(metrics.investmentsCOP)}</strong>
                    </div>
                    <div className="text-[11px] text-cyan-400/80">Cuenta patrimonial: 310505 - Capital Social.</div>
                  </div>
                </div>
              </div>

              {/* Card 4: Retiro del Dueño */}
              <div className="p-5 rounded-2xl bg-[#0E1120] border border-purple-500/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center font-bold">
                      4
                    </span>
                    <h3 className="font-bold text-base text-white">Retiro de Capital del Dueño</h3>
                  </div>
                  <p className="text-xs text-[#A6AFCA] leading-relaxed mb-3">
                    Dinero extraído de la caja o banco para uso personal del dueño o anticipo de dividendos. <strong>NO es un gasto deducible</strong> ni debe disminuir artificialmente la ganancia comercial del restaurante.
                  </p>
                  <div className="p-3 bg-[#0B0D18] rounded-lg text-xs space-y-1 border border-[#EBE1D5]/10">
                    <div className="flex justify-between text-[#EBE1D5]">
                      <span>Retiros registrados:</span>
                      <strong className="font-mono text-purple-400">-{formatCOP(metrics.withdrawalsCOP)}</strong>
                    </div>
                    <div className="text-[11px] text-[#71788E]">Cuenta patrimonial: 310515 - Retiros de Utilidades.</div>
                  </div>
                </div>
              </div>

              {/* Card 5: Movimiento entre Cajas */}
              <div className="p-5 rounded-2xl bg-[#0E1120] border border-blue-500/30 flex flex-col justify-between md:col-span-2">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold">
                      5
                    </span>
                    <h3 className="font-bold text-base text-white">Movimiento entre Cajas o Cuentas (Traslados)</h3>
                  </div>
                  <p className="text-xs text-[#A6AFCA] leading-relaxed mb-3">
                    Traslados de efectivo desde la Caja General hacia la Caja Menor de la Barra de Cócteles, o consignaciones desde la caja al banco. Son movimientos neutrales que <strong>no constituyen ni gasto ni ingreso</strong>.
                  </p>
                  <div className="p-3 bg-[#0B0D18] rounded-lg text-xs space-y-1 border border-[#EBE1D5]/10">
                    <div className="flex justify-between text-[#EBE1D5]">
                      <span>Volumen de traslados:</span>
                      <strong className="font-mono text-blue-400">{formatCOP(metrics.transfersCOP)}</strong>
                    </div>
                    <div className="text-[11px] text-[#71788E]">Cero impacto en el estado de resultados.</div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: REPORTES & CONCILIACIÓN */}
        {activeTab === 'reportes' && (
          !canViewReports ? (
            <div className="max-w-xl mx-auto my-12 p-8 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-2xl bg-[#7C170D]/20 border border-[#7C170D]/50 flex items-center justify-center text-[#EBE1D5] mx-auto">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Acceso a Reportes Financieros Restringido</h3>
                <p className="text-xs text-[#A6AFCA] mt-1 leading-relaxed">
                  El rol activo (<strong className="text-white capitalize">{currentUser.role}</strong>) no tiene habilitada la operación <span className="font-mono text-[#EBE1D5] font-semibold">ver_reportes</span>.
                </p>
                <p className="text-[11px] text-[#71788E] mt-2">
                  Un usuario Administrador puede autorizar esta vista desde la sección de Configuración en la matriz de "Permisos por Rol".
                </p>
              </div>
            </div>
          ) : (
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* Cash vs Profit Warning */}
            <div className="p-4 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20 text-xs text-[#EBE1D5] space-y-2">
              <div className="flex items-center gap-2 text-[#EBE1D5] font-bold text-sm">
                <ShieldAlert className="w-4 h-4 text-[#7C170D]" />
                <span>Conciliación de Egresos vs Flujo Real de Caja</span>
              </div>
              <p className="text-[#A6AFCA] leading-relaxed">
                El dinero en efectivo retirado de la caja registradora debe conciliarse directamente con el arqueo del turno. Los pagos efectuados mediante transferencia bancaria se concilian en la cuenta bancaria sin descalzar la gaveta de la cajera.
              </p>
            </div>

            {/* Income & Expense Reconciliation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Category Breakdown */}
              <div className="p-5 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-4">
                <h3 className="font-bold text-sm text-white flex items-center justify-between">
                  <span>Gastos Operativos por Categoría</span>
                  <span className="font-mono text-xs text-red-400">{formatCOP(metrics.operationalCOP)}</span>
                </h3>

                <div className="space-y-3">
                  {categoryTotals.length === 0 ? (
                    <p className="text-xs text-[#71788E]">No hay gastos operativos registrados.</p>
                  ) : (
                    categoryTotals.map(([cat, total]) => {
                      const pct = metrics.operationalCOP > 0 ? (total / metrics.operationalCOP) * 100 : 0;
                      return (
                        <div key={cat} className="space-y-1 text-xs">
                          <div className="flex justify-between text-[#EBE1D5]">
                            <span>{cat}</span>
                            <span className="font-mono font-bold text-white">
                              {formatCOP(total)} ({pct.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-[#0B0D18] rounded-full overflow-hidden border border-[#EBE1D5]/10">
                            <div className="h-full bg-[#7C170D] rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Payment Methods Breakdown */}
              <div className="p-5 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-4">
                <h3 className="font-bold text-sm text-white flex items-center justify-between">
                  <span>Egresos por Medio de Pago</span>
                  <span className="font-mono text-xs text-[#A6AFCA]">Total: {formatCOP(metrics.cashExpensesCOP + metrics.bankExpensesCOP)}</span>
                </h3>

                <div className="space-y-3">
                  <div className="p-3 bg-[#0B0D18] rounded-xl border border-[#EBE1D5]/15 space-y-1 text-xs">
                    <div className="flex justify-between items-center text-[#EBE1D5] font-bold">
                      <span>Efectivo de Caja (Gaveta de Turno)</span>
                      <span className="font-mono text-sm">{formatCOP(metrics.cashExpensesCOP)}</span>
                    </div>
                    <p className="text-[11px] text-[#A6AFCA]">
                      Resta del efectivo esperado del turno correspondiente y queda registrado en el libro de caja.
                    </p>
                  </div>

                  <div className="p-3 bg-[#0B0D18] rounded-xl border border-[#EBE1D5]/15 space-y-1 text-xs">
                    <div className="flex justify-between items-center text-cyan-300 font-bold">
                      <span>Bancos / Transferencia / Nequi</span>
                      <span className="font-mono text-sm">{formatCOP(metrics.bankExpensesCOP)}</span>
                    </div>
                    <p className="text-[11px] text-[#A6AFCA]">
                      Conciliado contra extracto de Bancolombia. No afecta el arqueo físico de la gaveta.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#EBE1D5]/15 flex justify-between items-center text-xs">
                  <span className="text-[#A6AFCA]">Total egresos del periodo:</span>
                  <span className="font-mono font-bold text-base text-white">{formatCOP(metrics.totalGeneralEgressCOP)}</span>
                </div>
              </div>

            </div>

            {/* Operating Statement Summary */}
            <div className="p-6 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-4">
              <h3 className="text-base font-bold text-white">Estado de Resultados Operacional (Estimado 90 Grados)</h3>
              
              <div className="divide-y divide-[#EBE1D5]/10 text-xs">
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-[#EBE1D5] font-medium">1. Ingresos por Ventas Facturadas (Carta & Bar)</span>
                  <span className="font-mono font-bold text-white text-sm">{formatCOP(metrics.totalSalesCOP)}</span>
                </div>

                <div className="py-2.5 flex justify-between items-center text-orange-400">
                  <span>(-) Costo de Mercancía Vendida Estimado (~38% según escandallos)</span>
                  <span className="font-mono font-bold text-sm">-{formatCOP(metrics.estimatedCOGS)}</span>
                </div>

                <div className="py-2.5 flex justify-between items-center text-red-400">
                  <span>(-) Gastos Operativos Totales (Servicios, Nómina, Arriendo, Aseo)</span>
                  <span className="font-mono font-bold text-sm">-{formatCOP(metrics.operationalCOP)}</span>
                </div>

                <div className="py-3 flex justify-between items-center font-black text-sm border-t-2 border-[#EBE1D5]/20">
                  <span className="text-white">= RESULTADO OPERACIONAL ESTIMADO DEL PERIODO</span>
                  <span className={`font-mono text-base ${metrics.netOperatingResult >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCOP(metrics.netOperatingResult)}
                  </span>
                </div>

                <div className="pt-4 pb-1 text-[11px] text-[#A6AFCA] uppercase font-semibold">
                  Partidas Patrimoniales (No alteran la utilidad de la carta):
                </div>

                <div className="py-2 flex justify-between items-center text-cyan-300">
                  <span>(+) Inversiones de Capital del Dueño</span>
                  <span className="font-mono font-bold">+{formatCOP(metrics.investmentsCOP)}</span>
                </div>

                <div className="py-2 flex justify-between items-center text-purple-300">
                  <span>(-) Retiros de Utilidades por el Dueño</span>
                  <span className="font-mono font-bold">-{formatCOP(metrics.withdrawalsCOP)}</span>
                </div>
              </div>
            </div>

          </div>
          )
        )}

        {/* TAB 4: PENDIENTES DE APROBACIÓN */}
        {activeTab === 'aprobaciones' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="p-4 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#EBE1D5]">Egresos Pendientes de Aprobación</h3>
                <p className="text-xs text-[#A6AFCA]">
                  Movimientos que superan el umbral configurado de <strong className="text-[#EBE1D5] font-mono">{formatCOP(config.approvalThresholdCOP || 200000)}</strong> o que requieren revisión de Gerencia.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#7C170D]/25 text-[#EBE1D5] border border-[#7C170D]/50 font-mono">
                {metrics.pendingApprovalCount} requerimientos
              </span>
            </div>

            {expenses.filter(e => e.status === 'pendiente_aprobacion').length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-[#EBE1D5]/20 bg-[#0E1120] space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="text-base font-bold text-[#EBE1D5]">Todo al día</h4>
                <p className="text-xs text-[#A6AFCA] max-w-md mx-auto">
                  No hay gastos pendientes de aprobación. Todos los egresos registrados están aprobados o pagados.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {expenses
                  .filter(e => e.status === 'pendiente_aprobacion')
                  .map(exp => (
                    <div key={exp.id} className="p-4 rounded-xl bg-[#0E1120] border border-[#7C170D]/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getTypeBadge(exp.type)}
                          <span className="font-bold text-[#EBE1D5] text-sm">{exp.category}</span>
                          <span className="text-xs font-mono text-[#A6AFCA]">· {exp.operationalDate}</span>
                        </div>
                        <p className="text-xs text-[#EBE1D5]">{exp.description}</p>
                        <div className="flex items-center gap-3 text-[11px] text-[#A6AFCA] font-mono">
                          <span>Tercero: {exp.thirdPartyName || 'N/A'}</span>
                          <span>Medio: {exp.paymentMethod}</span>
                          <span>Registrado por: @{exp.registeredByUserName}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                        <span className="text-lg font-mono font-black text-[#EBE1D5] tabular-nums">
                          {formatCOP(exp.amountCOP)}
                        </span>

                        <div className="flex items-center gap-2">
                          {canApproveExpenses ? (
                            <>
                              <button
                                onClick={() => {
                                  updateExpenseStatus(exp.id, 'aprobado', `Aprobado por @${currentUser.username} (${currentUser.role})`);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-[#EBE1D5] text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" /> Aprobar
                              </button>

                              <button
                                onClick={() => {
                                  setExpenseToAnnul(exp);
                                  setAnnulmentReason('');
                                  setAnnulError(null);
                                  setShowAnnulModal(true);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#151946] hover:bg-[#7C170D] text-[#EBE1D5] border border-[#EBE1D5]/20 hover:border-[#7C170D] text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <X className="w-3.5 h-3.5" /> Rechazar
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-[#A6AFCA] italic">
                              Requiere permiso 'aprobar_pagos'
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: LIBRO MAYOR (PARTIDA DOBLE) */}
        {activeTab === 'asientos' && (
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="p-4 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#EBE1D5]">Libro Mayor y Asientos de Partida Doble</h3>
                <p className="text-xs text-[#A6AFCA]">
                  Plan Único de Cuentas (PUC) colombiano. Cada débito está emparejado con su contrapartida exacta de crédito.
                </p>
              </div>
              <span className="text-xs font-mono text-[#A6AFCA]">Total Asientos: {ledger.length}</span>
            </div>

            <div className="rounded-xl border border-[#EBE1D5]/20 bg-[#0E1120] overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#151946] border-b border-[#EBE1D5]/20 text-[#EBE1D5]/80 uppercase">
                    <tr>
                      <th className="p-3 font-sans">Fecha</th>
                      <th className="p-3 font-sans">Concepto Contable</th>
                      <th className="p-3">Cuenta Débito (+)</th>
                      <th className="p-3">Cuenta Crédito (-)</th>
                      <th className="p-3 font-sans">Responsable</th>
                      <th className="p-3 text-right">Monto COP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EBE1D5]/10">
                    {ledger.map((l) => (
                      <tr key={l.id} className="hover:bg-[#151946]/30">
                        <td className="p-3 text-[#A6AFCA]">{l.date}</td>
                        <td className="p-3 font-sans font-medium text-[#EBE1D5]">{l.concept}</td>
                        <td className="p-3 text-emerald-400">{l.debitAccount}</td>
                        <td className="p-3 text-rose-400">{l.creditAccount}</td>
                        <td className="p-3 font-sans text-[#A6AFCA]">{l.user}</td>
                        <td className="p-3 text-right font-bold text-[#EBE1D5] tabular-nums font-mono">
                          {formatCOP(l.amountCOP)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: POLÍTICAS & CONFIGURACIÓN */}
        {activeTab === 'politicas' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="p-5 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#151946] border border-[#EBE1D5]/20 flex items-center justify-center text-[#EBE1D5]">
                  <Sliders className="w-5 h-5 text-[#EBE1D5]" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#EBE1D5]">Reglas y Políticas de Control de Gastos</h3>
                  <p className="text-xs text-[#A6AFCA]">Configuración gerencial aplicable al restaurante 90 Grados.</p>
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-[#EBE1D5]/15 text-xs">
                
                {/* Approval threshold config */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#151946]/30 rounded-xl border border-[#EBE1D5]/15">
                  <div>
                    <h4 className="font-bold text-[#EBE1D5] text-sm">Umbral de Aprobación Obligatoria</h4>
                    <p className="text-[#A6AFCA] mt-0.5">
                      Los egresos registrados por cajeros o contabilidad que igualen o superen este valor requerirán aprobación obligatoria de un Administrador.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[#A6AFCA]">$ COP</span>
                    <input
                      type="number"
                      step="50000"
                      min="50000"
                      disabled={!isAdmin}
                      value={config.approvalThresholdCOP || 200000}
                      onChange={(e) => {
                        const val = Math.max(Number(e.target.value), 0);
                        updateConfig({ approvalThresholdCOP: val });
                      }}
                      className="w-36 px-3 py-1.5 bg-[#0B0D18] border border-[#EBE1D5]/25 rounded-lg text-[#EBE1D5] font-mono font-bold text-right focus:border-[#7C170D] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Waiter permission switch */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#151946]/30 rounded-xl border border-[#EBE1D5]/15">
                  <div>
                    <h4 className="font-bold text-[#EBE1D5] text-sm">Permitir Registro de Gastos a Meseros</h4>
                    <p className="text-[#A6AFCA] mt-0.5">
                      Por defecto bloqueado según las directrices de seguridad. Solo habilítelo si el administrador autoriza a meseros para compras de urgencia.
                    </p>
                  </div>
                  <button
                    disabled={!isAdmin}
                    onClick={() => {
                      updateConfig({ allowWaitersToRegisterExpenses: !config.allowWaitersToRegisterExpenses });
                    }}
                    className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer shrink-0 ${
                      config.allowWaitersToRegisterExpenses
                        ? 'bg-[#7C170D] text-[#EBE1D5] shadow-sm'
                        : 'bg-[#151946] text-[#A6AFCA] hover:text-[#EBE1D5] border border-[#EBE1D5]/20'
                    }`}
                  >
                    {config.allowWaitersToRegisterExpenses ? 'Permitido (Meseros Autorizados)' : 'Restringido (Solo Caja / Gerencia)'}
                  </button>
                </div>

                {/* Anti-silent deletion notice */}
                <div className="p-4 bg-[#151946]/30 rounded-xl border border-[#EBE1D5]/15 space-y-1">
                  <h4 className="font-bold text-[#EBE1D5] text-sm flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#EBE1D5]" />
                    <span>Política de Cero Borrado Silencioso (Auditoría Estricta)</span>
                  </h4>
                  <p className="text-[#A6AFCA] leading-relaxed">
                    Ningún movimiento aprobado o pagado puede eliminarse físicamente de la base de datos. Cualquier corrección debe realizarse mediante el botón de <strong className="text-[#EBE1D5]">Anulación Auditada</strong>, el cual exige justificación, registra la identidad del usuario y genera el respectivo contra-asiento de reverso contable.
                  </p>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>

      {/* MODAL 1: REGISTRO DE GASTO / MOVIMIENTO */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#121524] border border-[#EBE1D5]/20 rounded-2xl w-full max-w-xl p-6 space-y-4 text-xs my-8 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-[#EBE1D5]/15 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Registrar Movimiento / Egreso</h3>
                <p className="text-[11px] text-[#A6AFCA]">
                  Responsable: <strong className="text-[#EBE1D5] font-mono">@{currentUser.username}</strong> ({currentUser.role})
                </p>
              </div>
              <button 
                onClick={() => setShowExpenseModal(false)}
                className="p-1 rounded-lg text-[#A6AFCA] hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formFeedback && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                formFeedback.type === 'error' ? 'bg-[#7C170D]/30 border border-[#7C170D]/60 text-red-300' : 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
              }`}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleRegisterExpense} className="space-y-4">
              
              {/* Type and Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#EBE1D5] mb-1 font-semibold">Tipo de Movimiento *</label>
                  <select
                    value={expType}
                    onChange={(e) => {
                      const val = e.target.value as ExpenseType;
                      setExpType(val);
                      if (val === 'inversion_dueno') setExpCategory('Aporte de Capital');
                      else if (val === 'retiro_dueno') setExpCategory('Retiro de Capital');
                      else if (val === 'compra_inventario') setExpCategory('Costo de Insumos');
                      else if (val === 'transferencia_cajas') setExpCategory('Transferencia entre Cajas');
                      else setExpCategory('Servicios Públicos');
                    }}
                    className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white focus:outline-none focus:border-[#7C170D]"
                  >
                    <option value="gasto_operativo">Gasto Operativo (Servicios, Nómina, Arriendo)</option>
                    <option value="compra_inventario">Compra de Inventario (Insumos para venta)</option>
                    <option value="inversion_dueno">Inversión / Aporte del Dueño (Capital)</option>
                    <option value="retiro_dueno">Retiro de Capital del Dueño</option>
                    <option value="transferencia_cajas">Traslado entre Cajas o Cuentas</option>
                    <option value="devolucion_reembolso">Devolución / Reembolso</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#EBE1D5] mb-1 font-semibold">Categoría *</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white focus:outline-none focus:border-[#7C170D]"
                  >
                    {standardCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount and Operational Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#EBE1D5] mb-1 font-semibold">Valor en COP (Entero) *</label>
                  <input
                    type="number"
                    step="1000"
                    min="1"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(Math.round(Number(e.target.value)))}
                    className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white font-mono text-sm font-bold focus:outline-none focus:border-[#7C170D]"
                  />
                  {expAmount >= (config.approvalThresholdCOP || 200000) && !isAdmin && (
                    <span className="text-[10px] text-[#EBE1D5] block mt-1">
                      &ge; COP {formatCOP(config.approvalThresholdCOP || 200000)}: Quedará pendiente de aprobación
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[#EBE1D5] mb-1 font-semibold">Fecha Operativa *</label>
                  <input
                    type="date"
                    required
                    value={expOperationalDate}
                    onChange={(e) => setExpOperationalDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[#7C170D]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[#EBE1D5] mb-1 font-semibold">Descripción / Concepto *</label>
                <input
                  type="text"
                  required
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="ej. Pago servicio de energía Enel Codensa / Compra 10 kg de Chatas"
                  className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white placeholder-[#71788E] focus:outline-none focus:border-[#7C170D]"
                />
              </div>

              {/* Third party and NIT */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[#EBE1D5] mb-1 font-semibold">Proveedor o Tercero</label>
                  <input
                    type="text"
                    value={expThirdParty}
                    onChange={(e) => setExpThirdParty(e.target.value)}
                    placeholder="ej. Distribuidora Carnes del Llano"
                    className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white focus:outline-none focus:border-[#7C170D]"
                  />
                </div>
                <div>
                  <label className="block text-[#EBE1D5] mb-1 font-semibold">NIT o Cédula</label>
                  <input
                    type="text"
                    value={expThirdPartyNit}
                    onChange={(e) => setExpThirdPartyNit(e.target.value)}
                    placeholder="900.123.456-7"
                    className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white font-mono focus:outline-none focus:border-[#7C170D]"
                  />
                </div>
              </div>

              {/* Invoice Number and Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#EBE1D5] mb-1 font-semibold">Nº Factura / Soporte</label>
                  <input
                    type="text"
                    value={expInvoiceNum}
                    onChange={(e) => setExpInvoiceNum(e.target.value)}
                    placeholder="ej. FAC-4819"
                    className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white font-mono focus:outline-none focus:border-[#7C170D]"
                  />
                </div>

                <div>
                  <label className="block text-[#EBE1D5] mb-1 font-semibold">Medio de Pago *</label>
                  <select
                    value={expPaymentMethod}
                    onChange={(e) => setExpPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white focus:outline-none focus:border-[#7C170D]"
                  >
                    <option value="efectivo_caja">Efectivo de Caja (Resta de gaveta)</option>
                    <option value="cuenta_bancaria">Transferencia Bancaria</option>
                    <option value="nequi">Nequi / Daviplata</option>
                    <option value="tarjeta">Tarjeta Débito / Crédito</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#EBE1D5] mb-1 font-semibold">Centro / Sede</label>
                  <select
                    value={expCenter}
                    onChange={(e) => setExpCenter(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white focus:outline-none focus:border-[#7C170D]"
                  >
                    <option value="Restaurante Matutino">Restaurante Matutino</option>
                    <option value="Bar Nocturno">Bar Nocturno</option>
                    <option value="Administración">Administración</option>
                  </select>
                </div>
              </div>

              {/* Inventory link if compra_inventario */}
              {expType === 'compra_inventario' && (
                <div className="p-3 bg-[#0B0D18] border border-[#7C170D]/40 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-[#EBE1D5] font-bold">
                    <ShoppingBag className="w-4 h-4 text-[#7C170D]" />
                    <span>Vincular con Insumo de Bodega (Sin duplicar costo)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[#A6AFCA] text-[11px] mb-1">Insumo del Catálogo</label>
                      <select
                        value={expInventoryItemId}
                        onChange={(e) => setExpInventoryItemId(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-white focus:outline-none focus:border-[#7C170D]"
                      >
                        <option value="">Seleccione insumo (opcional)...</option>
                        {inventory.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.purchaseUnit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[#A6AFCA] text-[11px] mb-1">Cantidad a Ingresar al Stock</label>
                      <input
                        type="number"
                        min="0"
                        value={expInventoryUnits}
                        onChange={(e) => setExpInventoryUnits(Number(e.target.value))}
                        placeholder="Ej. 10"
                        className="w-full px-2.5 py-1.5 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-white font-mono focus:outline-none focus:border-[#7C170D]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Attachment field with file size and type restriction */}
              <div>
                <label className="block text-[#EBE1D5] mb-1 font-semibold">Adjuntar Soporte o Factura (PDF / Imagen, Máx 2MB)</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="w-full text-xs text-[#A6AFCA] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#151946] file:text-[#EBE1D5] hover:file:bg-[#7C170D] cursor-pointer"
                />
                {attachmentError && (
                  <p className="text-red-400 text-[11px] mt-1">{attachmentError}</p>
                )}
                {expAttachment && (
                  <p className="text-emerald-400 text-[11px] mt-1 font-mono">
                    ✓ Archivo cargado: {expAttachment.fileName} ({expAttachment.fileSizeKB} KB)
                  </p>
                )}
              </div>

              {/* Form buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EBE1D5]/15">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 rounded-lg text-[#A6AFCA] hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#7C170D] hover:bg-[#961D12] text-white font-bold cursor-pointer transition-colors shadow-md border border-[#EBE1D5]/30"
                >
                  Registrar Movimiento
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ANULACIÓN AUDITADA (NUNCA BORRADO SILENCIOSO) */}
      {showAnnulModal && expenseToAnnul && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#121524] border border-[#7C170D]/50 rounded-2xl w-full max-w-md p-6 space-y-4 text-xs shadow-2xl">
            <div className="flex items-center gap-3 text-[#7C170D]">
              <ShieldAlert className="w-6 h-6 text-[#EBE1D5]" />
              <div>
                <h3 className="text-base font-bold text-white">Anulación Formal de Egreso</h3>
                <p className="text-[11px] text-[#A6AFCA] font-mono">Egreso ID: {expenseToAnnul.id}</p>
              </div>
            </div>

            <div className="p-3 bg-[#0B0D18] rounded-xl border border-[#EBE1D5]/20 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#A6AFCA]">Concepto:</span>
                <span className="text-white font-medium">{expenseToAnnul.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A6AFCA]">Monto:</span>
                <span className="font-mono font-bold text-white">{formatCOP(expenseToAnnul.amountCOP)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A6AFCA]">Medio de Pago:</span>
                <span className="text-[#EBE1D5]">{expenseToAnnul.paymentMethod}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmAnnulment} className="space-y-3">
              <div>
                <label className="block text-[#EBE1D5] mb-1 font-semibold">
                  Motivo o Justificación Obligatoria de la Anulación *
                </label>
                <textarea
                  rows={3}
                  required
                  value={annulmentReason}
                  onChange={(e) => setAnnulmentReason(e.target.value)}
                  placeholder="Explique detalladamente por qué se anula este egreso (ej. Comprobante duplicado, error en factura, devolución de mercancía)..."
                  className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white placeholder-[#71788E] text-xs focus:outline-none focus:border-[#7C170D]"
                />
                {annulError && <p className="text-red-400 text-[11px] mt-1">{annulError}</p>}
              </div>

              <div className="p-3 rounded-lg bg-[#7C170D]/20 border border-[#7C170D]/40 text-[11px] text-[#EBE1D5] leading-relaxed">
                <strong>Efecto del Reverso:</strong> El registro permanecerá en el sistema con estado <em>Anulado</em>, se generará un asiento de reverso contable y se restituirá el saldo en caja si fue pagado en efectivo.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EBE1D5]/15">
                <button
                  type="button"
                  onClick={() => setShowAnnulModal(false)}
                  className="px-4 py-2 text-[#A6AFCA] hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#7C170D] hover:bg-[#961D12] text-white font-bold rounded-lg cursor-pointer transition-colors border border-[#EBE1D5]/30 shadow-md"
                >
                  Confirmar Anulación Auditada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: COMPROBANTE DE EGRESO (VOUCHER IMPRIMIBLE) */}
      {showVoucherModal && voucherExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white text-stone-900 rounded-2xl w-full max-w-lg p-6 space-y-4 my-8 shadow-2xl print:m-0 print:p-0">
            
            {/* Voucher Header */}
            <div className="text-center border-b pb-4 border-stone-200">
              <h3 className="text-lg font-black tracking-wider uppercase text-stone-900">
                {config.businessName || '90 GRADOS RESTAURANTE & BAR'}
              </h3>
              <p className="text-xs text-stone-600">NIT: {config.nit || '901.458.729-3'} · {config.municipality || 'Cota, Cundinamarca'}</p>
              <p className="text-xs text-stone-500">{config.address || 'Calle Principal Km 2 Vía Siberia'} · Tel: {config.phone || '313 276 41 50'}</p>
              
              <div className="mt-3 inline-block px-3 py-1 bg-stone-100 rounded-md border border-stone-300">
                <span className="text-xs font-mono font-bold text-stone-800">COMPROBANTE DE EGRESO Nº {voucherExpense.id.toUpperCase()}</span>
              </div>
            </div>

            {/* Voucher Details */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-stone-500 font-semibold">Fecha y Hora:</span>
                <span className="font-mono text-stone-800">{formatDateTimeBogota(voucherExpense.date)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-stone-500 font-semibold">Fecha Operativa:</span>
                <span className="font-mono text-stone-800">{voucherExpense.operationalDate}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-stone-500 font-semibold">Beneficiario / Tercero:</span>
                <span className="font-bold text-stone-900">{voucherExpense.thirdPartyName || 'N/A'}</span>
              </div>
              {voucherExpense.thirdPartyNit && (
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500 font-semibold">NIT / Cédula:</span>
                  <span className="font-mono text-stone-800">{voucherExpense.thirdPartyNit}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-stone-500 font-semibold">Concepto / Descripción:</span>
                <span className="font-medium text-stone-800 max-w-xs text-right">{voucherExpense.description}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-stone-500 font-semibold">Categoría & Tipo:</span>
                <span className="text-stone-800">{voucherExpense.category} ({voucherExpense.type})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-stone-500 font-semibold">Medio de Pago:</span>
                <span className="capitalize font-mono text-stone-800">{voucherExpense.paymentMethod.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between py-2 border-b-2 border-stone-300 items-center">
                <span className="text-sm font-bold text-stone-900">VALOR PAGADO:</span>
                <span className="text-lg font-mono font-black text-stone-950">{formatCOP(voucherExpense.amountCOP)}</span>
              </div>
            </div>

            {/* Signature fields */}
            <div className="grid grid-cols-3 gap-3 pt-6 text-[10px] text-center text-stone-600">
              <div className="border-t border-stone-400 pt-1">
                <span className="font-bold block">Elaborado Por</span>
                <span className="text-stone-500 font-mono">@{voucherExpense.registeredByUserName}</span>
              </div>
              <div className="border-t border-stone-400 pt-1">
                <span className="font-bold block">Aprobado Por</span>
                <span className="text-stone-500 font-mono">
                  {voucherExpense.approvedByUserName ? `@${voucherExpense.approvedByUserName}` : 'Gerencia 90°'}
                </span>
              </div>
              <div className="border-t border-stone-400 pt-1">
                <span className="font-bold block">Recibido Conforme</span>
                <span className="text-stone-500">C.C. / Firma</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-200 print:hidden">
              <button
                type="button"
                onClick={() => setShowVoucherModal(false)}
                className="px-4 py-2 rounded-lg text-stone-600 hover:text-stone-900 text-xs font-semibold cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-[#7C170D] hover:bg-[#7C170D]/80 text-[#EBE1D5] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition-colors"
              >
                <Printer className="w-4 h-4" /> Imprimir Comprobante
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 4: AUDITORÍA Y TRAZABILIDAD */}
      {showAuditModal && auditExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0E1120] border border-[#EBE1D5]/20 rounded-2xl w-full max-w-lg p-6 space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EBE1D5]/15 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#EBE1D5]">Trazabilidad y Auditoría</h3>
                <p className="text-[11px] text-[#A6AFCA] font-mono">Egreso ID: {auditExpense.id}</p>
              </div>
              <button 
                onClick={() => setShowAuditModal(false)}
                className="p-1 rounded-lg text-[#A6AFCA] hover:text-[#EBE1D5] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {auditExpense.auditHistory && auditExpense.auditHistory.length > 0 ? (
                auditExpense.auditHistory.map((item, idx) => (
                  <div key={idx} className="p-3 bg-[#0B0D18] rounded-xl border border-[#EBE1D5]/15 space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-mono text-[#EBE1D5] font-bold">{item.action}</span>
                      <span className="text-[#A6AFCA] font-mono">{formatDateTimeBogota(item.timestamp)}</span>
                    </div>
                    <p className="text-[#A6AFCA]">{item.note || 'Sin observaciones registradas'}</p>
                    <div className="text-[10px] text-[#8890A6] flex justify-between pt-1">
                      <span>Usuario: @{item.userName}</span>
                      {item.newStatus && <span>Estado resultante: {item.newStatus}</span>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[#A6AFCA] text-center py-4">No hay registros adicionales de auditoría.</p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#EBE1D5]/15">
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-2 rounded-lg bg-[#151946] text-[#EBE1D5] hover:bg-[#7C170D] text-xs font-semibold cursor-pointer transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
