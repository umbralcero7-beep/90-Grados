import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { formatCOP, formatDateTimeBogota } from '../utils/format';
import { 
  Crown, 
  TrendingUp, 
  DollarSign, 
  Receipt, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Filter, 
  Calendar, 
  User, 
  Wine, 
  UtensilsCrossed, 
  Download, 
  Printer, 
  ShieldCheck, 
  ArrowUpDown, 
  RotateCcw,
  Boxes,
  HelpCircle,
  FileSpreadsheet,
  Search,
  Eye,
  Info
} from 'lucide-react';
import { OperationalShiftType } from '../types';

export const OwnerDashboard: React.FC = () => {
  const { 
    currentUser, 
    orders, 
    shiftHistory, 
    currentShift, 
    savedShiftReports, 
    products, 
    allUsers, 
    auditLogs, 
    expenses,
    hasUserActionPermission
  } = useApp();

  // Permission check
  const hasAccess = currentUser.role === 'administrador' || hasUserActionPermission('owner_dashboard', 'consultar');

  // Filters
  const [dateRange, setDateRange] = useState<'hoy' | 'semana' | 'mes' | 'todos'>('mes');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<'todos' | 'diurno_restaurante' | 'nocturno_discoteca'>('todos');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('todos');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('todos');
  const [selectedAuditAction, setSelectedAuditAction] = useState<string>('todos');
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'resumen' | 'turnos' | 'productos' | 'caja' | 'auditoria'>('resumen');

  // If unauthorized
  if (!hasAccess) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center bg-[#0B0D18]">
        <div className="max-w-md w-full p-8 rounded-3xl bg-[#0E1120] border-2 border-[#7C170D] text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-[#7C170D]/20 border border-[#7C170D] flex items-center justify-center mx-auto text-[#EBE1D5]">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-black text-white">Acceso Restringido al Dueño</h2>
          <p className="text-xs text-[#A6AFCA] leading-relaxed">
            Este módulo contiene información financiera confidencial, arqueos de caja y auditoría de personal. Solo el Propietario o usuarios autorizados con el permiso explícito pueden ingresar.
          </p>
          <div className="p-3 rounded-xl bg-[#151946] border border-[#EBE1D5]/20 text-[11px] text-[#EBE1D5] font-mono">
            Usuario actual: @{currentUser.username} ({currentUser.role})
          </div>
        </div>
      </div>
    );
  }

  // Categories list
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => set.add(p.category));
    return Array.from(set);
  }, [products]);

  // Filtered orders dataset
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // Date filter
      if (dateRange !== 'todos' && o.createdAt) {
        const orderDate = new Date(o.createdAt);
        const now = new Date();
        const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
        if (dateRange === 'hoy' && diffDays > 1) return false;
        if (dateRange === 'semana' && diffDays > 7) return false;
        if (dateRange === 'mes' && diffDays > 30) return false;
      }

      // Shift type filter
      if (selectedShiftFilter !== 'todos') {
        const shift = [...(shiftHistory || []), currentShift].find(s => s?.id === o.shiftId);
        if (shift && shift.operationalType && shift.operationalType !== selectedShiftFilter) {
          return false;
        }
      }

      // User/Waiter filter
      if (selectedUserFilter !== 'todos') {
        if (o.waiterId !== selectedUserFilter) return false;
      }

      // Category filter
      if (selectedCategoryFilter !== 'todos') {
        const hasCategory = o.items.some(it => {
          const prod = products.find(p => p.id === it.productId);
          return prod?.category === selectedCategoryFilter;
        });
        if (!hasCategory) return false;
      }

      return true;
    });
  }, [orders, dateRange, selectedShiftFilter, selectedUserFilter, selectedCategoryFilter, shiftHistory, currentShift, products]);

  // Aggregate Metrics based on real filtered orders
  const metrics = useMemo(() => {
    const paidOrders = filteredOrders.filter(o => o.status === 'pagada');
    const cancelledOrders = filteredOrders.filter(o => o.status === 'cancelada');

    let totalGrossSales = 0;
    let cashSales = 0;
    let electronicSales = 0;
    const paymentMethodsMap: Record<string, number> = { efectivo: 0, nequi: 0, daviplata: 0, tarjeta: 0, otro: 0 };
    const categorySalesMap: Record<string, number> = {};
    const productSalesMap: Record<string, { name: string; quantity: number; totalCOP: number }> = {};
    const waiterSalesMap: Record<string, { name: string; orders: number; totalCOP: number }> = {};
    const tableSalesMap: Record<string, { orders: number; totalCOP: number }> = {};

    paidOrders.forEach(ord => {
      totalGrossSales += ord.totalAmount;

      // Table metrics
      const tbl = ord.tableNumber || 'Sin mesa';
      if (!tableSalesMap[tbl]) tableSalesMap[tbl] = { orders: 0, totalCOP: 0 };
      tableSalesMap[tbl].orders += 1;
      tableSalesMap[tbl].totalCOP += ord.totalAmount;

      // Waiter metrics
      const wId = ord.waiterId || 'desconocido';
      const wName = ord.waiterName || 'Personal';
      if (!waiterSalesMap[wId]) waiterSalesMap[wId] = { name: wName, orders: 0, totalCOP: 0 };
      waiterSalesMap[wId].orders += 1;
      waiterSalesMap[wId].totalCOP += ord.totalAmount;

      // Payments
      if (ord.payment) {
        cashSales += Math.max(ord.payment.receivedCash - ord.payment.changeGiven, 0);
        ord.payment.methods.forEach(m => {
          paymentMethodsMap[m.method] = (paymentMethodsMap[m.method] || 0) + m.amount;
          if (m.method !== 'efectivo') {
            electronicSales += m.amount;
          }
        });
      }

      // Products & Categories
      ord.items.forEach(it => {
        const prod = products.find(p => p.id === it.productId);
        const cat = prod?.category || 'General';
        const subtotal = it.price * it.quantity;

        categorySalesMap[cat] = (categorySalesMap[cat] || 0) + subtotal;

        if (!productSalesMap[it.productId]) {
          productSalesMap[it.productId] = { name: it.productName, quantity: 0, totalCOP: 0 };
        }
        productSalesMap[it.productId].quantity += it.quantity;
        productSalesMap[it.productId].totalCOP += subtotal;
      });
    });

    // Cancelled / Annulled metrics
    let totalCancelledAmount = 0;
    cancelledOrders.forEach(o => {
      totalCancelledAmount += o.totalAmount;
    });

    // Dead stock (products with 0 sales in filtered orders)
    const deadStock = products.filter(p => !productSalesMap[p.id]);

    // Top selling sorted
    const topProducts = Object.values(productSalesMap).sort((a, b) => b.quantity - a.quantity);

    // Diurno vs Nocturno comparison
    const allShifts = [...(shiftHistory || [])];
    if (currentShift) allShifts.push(currentShift);

    const diurnoShifts = allShifts.filter(s => s.operationalType === 'diurno_restaurante' || s.center === 'Restaurante Matutino');
    const nocturnoShifts = allShifts.filter(s => s.operationalType === 'nocturno_discoteca' || s.center === 'Bar Nocturno');

    const diurnoSales = diurnoShifts.reduce((acc, s) => acc + (s.totalSalesTotal || 0), 0);
    const nocturnoSales = nocturnoShifts.reduce((acc, s) => acc + (s.totalSalesTotal || 0), 0);

    // Cash differences (sobrantes y faltantes)
    let totalDifferences = 0;
    let totalInitialFunds = 0;
    allShifts.forEach(s => {
      totalDifferences += (s.cashDifference || 0);
      totalInitialFunds += (s.initialFund || 0);
    });

    return {
      totalOrders: filteredOrders.length,
      paidOrdersCount: paidOrders.length,
      cancelledOrdersCount: cancelledOrders.length,
      totalGrossSales,
      totalCancelledAmount,
      cashSales,
      electronicSales,
      paymentMethodsMap,
      categorySalesMap,
      topProducts,
      deadStock,
      waiterSalesMap,
      tableSalesMap,
      diurnoSales,
      nocturnoSales,
      diurnoShiftsCount: diurnoShifts.length,
      nocturnoShiftsCount: nocturnoShifts.length,
      totalDifferences,
      totalInitialFunds,
    };
  }, [filteredOrders, products, shiftHistory, currentShift]);

  // Chart Data: Turnos Comparison
  const shiftComparisonData = useMemo(() => {
    return [
      {
        tipo: 'Diurno (Restaurante)',
        ventasCOP: metrics.diurnoSales,
        turnos: metrics.diurnoShiftsCount,
        color: '#151946'
      },
      {
        tipo: 'Nocturno (Discoteca)',
        ventasCOP: metrics.nocturnoSales,
        turnos: metrics.nocturnoShiftsCount,
        color: '#7C170D'
      }
    ];
  }, [metrics]);

  // Chart Data: Categories
  const categoryChartData = useMemo(() => {
    return Object.entries(metrics.categorySalesMap).map(([name, total]) => ({
      name,
      total,
    })).sort((a, b) => b.total - a.total).slice(0, 7);
  }, [metrics]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (selectedUserFilter !== 'todos' && log.userId !== selectedUserFilter) return false;
      if (selectedAuditAction !== 'todos' && !log.action.includes(selectedAuditAction)) return false;
      if (auditSearchQuery.trim()) {
        const q = auditSearchQuery.toLowerCase();
        const matchesDetails = log.details.toLowerCase().includes(q);
        const matchesEntity = log.entity.toLowerCase().includes(q);
        const matchesUser = log.userName.toLowerCase().includes(q);
        if (!matchesDetails && !matchesEntity && !matchesUser) return false;
      }
      return true;
    });
  }, [auditLogs, selectedUserFilter, selectedAuditAction, auditSearchQuery]);

  // Safe Export to CSV
  const exportDashboardCSV = () => {
    const rows = [
      ['INFORME GERENCIAL - PANEL DEL DUEÑO 90 GRADOS'],
      ['FECHA_GENERACION', formatDateTimeBogota(new Date().toISOString())],
      ['GENERADO_POR', `@${currentUser.username} (${currentUser.fullName})`],
      ['RANGO_FECHAS', dateRange],
      ['FILTRO_TURNO', selectedShiftFilter],
      [''],
      ['RESUMEN FINANCIERO'],
      ['VENTAS_BRUTAS_TOTALES_COP', metrics.totalGrossSales.toString()],
      ['VENTAS_EFECTIVO_COP', metrics.cashSales.toString()],
      ['VENTAS_ELECTRONICAS_COP', metrics.electronicSales.toString()],
      ['ANULACIONES_CANCELACIONES_COP', metrics.totalCancelledAmount.toString()],
      ['CANTIDAD_ORDENES_PAGADAS', metrics.paidOrdersCount.toString()],
      ['CANTIDAD_ORDENES_CANCELADAS', metrics.cancelledOrdersCount.toString()],
      ['DIFERENCIA_ARQUEOS_CAJA_COP', metrics.totalDifferences.toString()],
      [''],
      ['COMPARATIVA DE TURNOS'],
      ['TURNO_DIURNO_RESTAURANTE_COP', metrics.diurnoSales.toString()],
      ['TURNO_NOCTURNO_DISCOTECA_COP', metrics.nocturnoSales.toString()],
      [''],
      ['TOP PRODUCTOS VENDIDOS'],
      ['PRODUCTO', 'CANTIDAD_VENDIDA', 'TOTAL_COP'],
      ...metrics.topProducts.map(p => [p.name, p.quantity.toString(), p.totalCOP.toString()]),
      [''],
      ['PRODUCTOS SIN MOVIMIENTO (DEAD STOCK)'],
      ['PRODUCTO', 'CATEGORIA', 'PRECIO_COP'],
      ...metrics.deadStock.map(p => [p.name, p.category, p.price.toString()]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Panel_Dueno_90Grados_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-[#0B0D18] text-[#EBE1D5] overflow-y-auto">
      
      {/* Top Banner Header with Institutional Deep Anchor to Oxide Crimson Gradient */}
      <div className="p-4 sm:p-6 border-b border-[#EBE1D5]/20 bg-gradient-to-r from-[#151946] via-[#211B3E] to-[#7C170D] flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0D1024] border-2 border-[#7C170D] flex items-center justify-center text-[#EBE1D5] shadow-xl">
            <Crown className="w-6 h-6 text-[#EBE1D5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Panel Exclusivo del Dueño
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#7C170D] border border-[#EBE1D5]/30 text-white">
                Gerencia
              </span>
            </div>
            <p className="text-xs text-[#EBE1D5]/80 mt-0.5">
              Restaurante & Bar 90 Grados · Visión consolidada con datos reales auditados
            </p>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-[#0E1120] hover:bg-[#151946] border border-[#EBE1D5]/20 text-[#EBE1D5] text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow transition-all active:scale-95"
            title="Imprimir resumen ejecutivo"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>

          <button
            onClick={exportDashboardCSV}
            className="px-4 py-2 rounded-xl bg-[#7C170D] hover:bg-[#961D12] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg border border-[#EBE1D5]/30 transition-all active:scale-95"
            title="Exportar reporte gerencial a CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3 sm:p-4 bg-[#0E1120] border-b border-[#EBE1D5]/15 flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-xl text-xs overflow-x-auto">
          {[
            { id: 'resumen', label: 'Resumen & Ventas', icon: TrendingUp },
            { id: 'turnos', label: 'Diurno vs Nocturno', icon: Wine },
            { id: 'productos', label: 'Productos & Stock', icon: Boxes },
            { id: 'caja', label: 'Caja & Arqueos', icon: DollarSign },
            { id: 'auditoria', label: 'Historial Personal', icon: ShieldCheck },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
                  isActive 
                    ? 'bg-[#151946] border-[#EBE1D5]/50 text-[#EBE1D5] shadow-sm' 
                    : 'border-transparent text-[#A6AFCA] hover:text-[#EBE1D5]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Global Multi-Filter Selectors */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Date Filter */}
          <div className="flex items-center gap-1 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-xl px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#A6AFCA]" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="bg-transparent text-[#EBE1D5] font-semibold focus:outline-none cursor-pointer"
            >
              <option value="hoy" className="bg-[#0B0D18]">Hoy</option>
              <option value="semana" className="bg-[#0B0D18]">Últimos 7 días</option>
              <option value="mes" className="bg-[#0B0D18]">Últimos 30 días</option>
              <option value="todos" className="bg-[#0B0D18]">Histórico total</option>
            </select>
          </div>

          {/* Shift Type Filter */}
          <div className="flex items-center gap-1 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-xl px-2.5 py-1.5">
            <Clock className="w-3.5 h-3.5 text-[#A6AFCA]" />
            <select
              value={selectedShiftFilter}
              onChange={(e) => setSelectedShiftFilter(e.target.value as any)}
              className="bg-transparent text-[#EBE1D5] font-semibold focus:outline-none cursor-pointer"
            >
              <option value="todos" className="bg-[#0B0D18]">Todos los turnos</option>
              <option value="diurno_restaurante" className="bg-[#0B0D18]">Diurno (Restaurante)</option>
              <option value="nocturno_discoteca" className="bg-[#0B0D18]">Nocturno (Discoteca)</option>
            </select>
          </div>

          {/* Employee Filter */}
          <div className="flex items-center gap-1 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-xl px-2.5 py-1.5">
            <User className="w-3.5 h-3.5 text-[#A6AFCA]" />
            <select
              value={selectedUserFilter}
              onChange={(e) => setSelectedUserFilter(e.target.value)}
              className="bg-transparent text-[#EBE1D5] font-semibold focus:outline-none cursor-pointer max-w-[120px]"
            >
              <option value="todos" className="bg-[#0B0D18]">Todo el personal</option>
              {allUsers.map(u => (
                <option key={u.id} value={u.id} className="bg-[#0B0D18]">
                  @{u.username}
                </option>
              ))}
            </select>
          </div>
        </div>

      </div>

      {/* Main Content Viewport */}
      <div className="p-4 sm:p-6 space-y-6">

        {/* ============================================================== */}
        {/* TAB 1: RESUMEN EJECUTIVO & VENTAS                              */}
        {/* ============================================================== */}
        {activeTab === 'resumen' && (
          <div className="space-y-6 animate-in fade-in">
            
            {/* Top KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="p-4 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-1 shadow">
                <div className="flex items-center justify-between text-xs text-[#A6AFCA]">
                  <span>Ventas Brutas Pagadas</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-2xl font-black text-white font-mono tabular-nums">
                  {formatCOP(metrics.totalGrossSales)}
                </p>
                <span className="text-[11px] text-emerald-400 font-mono">
                  {metrics.paidOrdersCount} pedidos cobrados con éxito
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-1 shadow">
                <div className="flex items-center justify-between text-xs text-[#A6AFCA]">
                  <span>Efectivo en Gaveta</span>
                  <Receipt className="w-4 h-4 text-cyan-400" />
                </div>
                <p className="text-2xl font-black text-white font-mono tabular-nums">
                  {formatCOP(metrics.cashSales)}
                </p>
                <span className="text-[11px] text-[#A6AFCA] font-mono">
                  Digital: {formatCOP(metrics.electronicSales)}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-1 shadow">
                <div className="flex items-center justify-between text-xs text-[#A6AFCA]">
                  <span>Anulaciones & Cancelaciones</span>
                  <XCircle className="w-4 h-4 text-red-400" />
                </div>
                <p className="text-2xl font-black text-red-300 font-mono tabular-nums">
                  {formatCOP(metrics.totalCancelledAmount)}
                </p>
                <span className="text-[11px] text-red-400 font-mono">
                  {metrics.cancelledOrdersCount} órdenes anuladas
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-1 shadow">
                <div className="flex items-center justify-between text-xs text-[#A6AFCA]">
                  <span>Diferencia Neta de Caja</span>
                  <ArrowUpDown className="w-4 h-4 text-[#EBE1D5]" />
                </div>
                <p className={`text-2xl font-black font-mono tabular-nums ${
                  metrics.totalDifferences === 0 
                    ? 'text-emerald-400' 
                    : metrics.totalDifferences > 0 ? 'text-cyan-400' : 'text-red-400'
                }`}>
                  {metrics.totalDifferences > 0 ? `+${formatCOP(metrics.totalDifferences)}` : formatCOP(metrics.totalDifferences)}
                </p>
                <span className="text-[11px] text-[#A6AFCA]">
                  {metrics.totalDifferences === 0 ? 'Arqueos exactos sin faltante' : metrics.totalDifferences > 0 ? 'Sobrante en cierres' : 'Faltante en cierres'}
                </span>
              </div>

            </div>

            {/* Sales by Category & Payment Methods Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Category Breakdown Chart */}
              <div className="lg:col-span-7 p-5 rounded-3xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base">Ventas por Categoría de Producto</h3>
                    <p className="text-xs text-[#A6AFCA]">Distribución de ingresos según platos y bebidas de la carta.</p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 font-bold">Datos Reales</span>
                </div>

                {categoryChartData.length > 0 ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#23294C" horizontal={false} />
                        <XAxis type="number" stroke="#8890A6" tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" stroke="#EBE1D5" tick={{ fontSize: 11 }} width={90} />
                        <Tooltip 
                          formatter={(value: any) => [formatCOP(Number(value)), 'Venta COP']}
                          contentStyle={{ backgroundColor: '#0B0D18', borderColor: '#7C170D', borderRadius: '12px' }}
                        />
                        <Bar dataKey="total" fill="#151946" stroke="#EBE1D5" strokeWidth={1} radius={[0, 6, 6, 0]}>
                          {categoryChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#151946' : '#7C170D'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-[#A6AFCA]">
                    No se registran ventas para los filtros seleccionados.
                  </div>
                )}
              </div>

              {/* Payment Methods Breakdown */}
              <div className="lg:col-span-5 p-5 rounded-3xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-4">
                <div>
                  <h3 className="font-bold text-white text-base">Medios de Pago Utilizados</h3>
                  <p className="text-xs text-[#A6AFCA]">Efectivo contado vs transferencias y datáfono.</p>
                </div>

                <div className="space-y-3 pt-2">
                  {[
                    { method: 'Efectivo en Caja', amount: metrics.paymentMethodsMap.efectivo || 0, color: 'bg-emerald-500' },
                    { method: 'Nequi', amount: metrics.paymentMethodsMap.nequi || 0, color: 'bg-purple-500' },
                    { method: 'Daviplata', amount: metrics.paymentMethodsMap.daviplata || 0, color: 'bg-red-500' },
                    { method: 'Tarjeta Débito/Crédito', amount: metrics.paymentMethodsMap.tarjeta || 0, color: 'bg-cyan-500' },
                    { method: 'Otro Medio', amount: metrics.paymentMethodsMap.otro || 0, color: 'bg-amber-500' },
                  ].map((item, idx) => {
                    const pct = metrics.totalGrossSales > 0 ? ((item.amount / metrics.totalGrossSales) * 100).toFixed(1) : '0';
                    return (
                      <div key={idx} className="p-3 rounded-xl bg-[#0B0D18] border border-[#EBE1D5]/15 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-3 h-3 rounded-full ${item.color}`} />
                          <span className="text-xs font-semibold text-white">{item.method}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-[#EBE1D5] font-mono block">
                            {formatCOP(item.amount)}
                          </span>
                          <span className="text-[10px] text-[#A6AFCA] font-mono">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Sales by Waiter & Table Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Waiter Ranking */}
              <div className="p-5 rounded-3xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-3">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <User className="w-4 h-4 text-[#EBE1D5]" />
                  <span>Ventas por Mesero / Operador</span>
                </h3>
                <div className="space-y-2">
                  {Object.entries(metrics.waiterSalesMap).length > 0 ? (
                    Object.entries(metrics.waiterSalesMap).map(([id, w]) => (
                      <div key={id} className="p-2.5 rounded-xl bg-[#0B0D18] border border-[#EBE1D5]/15 flex items-center justify-between text-xs">
                        <div>
                          <strong className="text-white block">{w.name}</strong>
                          <span className="text-[11px] text-[#A6AFCA] font-mono">{w.orders} comandas cerradas</span>
                        </div>
                        <span className="font-bold font-mono text-[#EBE1D5] text-sm">
                          {formatCOP(w.totalCOP)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#A6AFCA]">Sin datos de personal para este rango.</p>
                  )}
                </div>
              </div>

              {/* Table Performance */}
              <div className="p-5 rounded-3xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-3">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-[#EBE1D5]" />
                  <span>Rotación y Ventas por Mesa / Barra</span>
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {Object.entries(metrics.tableSalesMap).length > 0 ? (
                    Object.entries(metrics.tableSalesMap).map(([tbl, data]) => (
                      <div key={tbl} className="p-2.5 rounded-xl bg-[#0B0D18] border border-[#EBE1D5]/15 flex items-center justify-between text-xs">
                        <div>
                          <strong className="text-white block">{tbl}</strong>
                          <span className="text-[11px] text-[#A6AFCA] font-mono">{data.orders} rotaciones de cuenta</span>
                        </div>
                        <span className="font-bold font-mono text-[#EBE1D5] text-sm">
                          {formatCOP(data.totalCOP)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#A6AFCA]">Sin datos de mesas para este rango.</p>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: SEPARACIÓN Y COMPARATIVA DIURNO VS NOCTURNO            */}
        {/* ============================================================== */}
        {activeTab === 'turnos' && (
          <div className="space-y-6 animate-in fade-in">
            
            <div className="p-5 rounded-3xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">
                    <Wine className="w-5 h-5 text-[#7C170D]" />
                    <span>Comparativa: Turno Diurno (Restaurante) vs Turno Nocturno (Discoteca)</span>
                  </h3>
                  <p className="text-xs text-[#A6AFCA]">
                    Operaciones estrictamente separadas según el tipo seleccionado, garantizando que el consumo de licores no se confunda con la carta de cocina.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#151946] border border-[#EBE1D5]/30 text-[#EBE1D5]">
                  Regla de Negocio
                </span>
              </div>

              {/* Comparative Visual Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                
                {/* Diurno Card */}
                <div className="p-5 rounded-2xl bg-[#151946]/40 border-2 border-[#151946] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UtensilsCrossed className="w-5 h-5 text-amber-400" />
                      <h4 className="font-bold text-white text-base">Operación Diurna · Restaurante</h4>
                    </div>
                    <span className="text-xs font-mono text-[#A6AFCA]">{metrics.diurnoShiftsCount} turnos</span>
                  </div>

                  <p className="text-xs text-[#A6AFCA]">
                    Especializado en sopas del día, platos a la carta, cortes de carne al carbón, pescados y bebidas de almuerzo.
                  </p>

                  <div className="p-4 rounded-xl bg-[#0B0D18] border border-[#EBE1D5]/15 space-y-1">
                    <span className="text-xs text-[#A6AFCA] uppercase font-mono">Facturación Diurna Consolidada:</span>
                    <p className="text-2xl font-black text-white font-mono">{formatCOP(metrics.diurnoSales)}</p>
                  </div>
                </div>

                {/* Nocturno Card */}
                <div className="p-5 rounded-2xl bg-[#7C170D]/20 border-2 border-[#7C170D] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wine className="w-5 h-5 text-red-400" />
                      <h4 className="font-bold text-white text-base">Operación Nocturna · Discoteca</h4>
                    </div>
                    <span className="text-xs font-mono text-[#A6AFCA]">{metrics.nocturnoShiftsCount} turnos</span>
                  </div>

                  <p className="text-xs text-[#A6AFCA]">
                    Especializado en venta de licores por botella y media, cervezas nacionales e importadas, cócteles y picadas nocturnas.
                  </p>

                  <div className="p-4 rounded-xl bg-[#0B0D18] border border-[#EBE1D5]/15 space-y-1">
                    <span className="text-xs text-[#A6AFCA] uppercase font-mono">Facturación Nocturna Consolidada:</span>
                    <p className="text-2xl font-black text-white font-mono">{formatCOP(metrics.nocturnoSales)}</p>
                  </div>
                </div>

              </div>

              {/* Recharts Bar Chart */}
              <div className="h-64 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shiftComparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#23294C" vertical={false} />
                    <XAxis dataKey="tipo" stroke="#EBE1D5" />
                    <YAxis stroke="#8890A6" tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(val: any) => [formatCOP(Number(val)), 'Total Facturado']}
                      contentStyle={{ backgroundColor: '#0B0D18', borderColor: '#7C170D', borderRadius: '12px' }}
                    />
                    <Bar dataKey="ventasCOP" radius={[8, 8, 0, 0]}>
                      {shiftComparisonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

            </div>

            {/* List of Automatically Generated Shift Reports */}
            <div className="p-5 rounded-3xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-base">Reportes Automáticos de Cierre Archivados</h3>
                  <p className="text-xs text-[#A6AFCA]">Paquetes generados de forma inmutable al cerrar cada turno.</p>
                </div>
                <span className="text-xs font-mono font-bold text-[#EBE1D5]">
                  {savedShiftReports.length} reportes archivados
                </span>
              </div>

              {savedShiftReports.length > 0 ? (
                <div className="space-y-3">
                  {savedShiftReports.map((bundle) => (
                    <div key={bundle.id} className="p-4 rounded-2xl bg-[#0B0D18] border border-[#EBE1D5]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            bundle.operationalType === 'nocturno_discoteca'
                              ? 'bg-[#7C170D]/40 text-red-200 border border-[#7C170D]'
                              : 'bg-[#151946] text-[#EBE1D5] border border-[#EBE1D5]/30'
                          }`}>
                            {bundle.operationalType === 'nocturno_discoteca' ? 'Nocturno (Discoteca)' : 'Diurno (Restaurante)'}
                          </span>
                          <span className="text-xs font-bold text-white">{bundle.shiftCenter}</span>
                          <span className="text-[11px] text-[#A6AFCA] font-mono">· Cierre #{bundle.corteZ.fiscalZNumber}</span>
                        </div>
                        <p className="text-xs text-[#A6AFCA]">
                          Cerrado por: <strong className="text-[#EBE1D5]">@{bundle.closedByUserName}</strong> el {formatDateTimeBogota(bundle.closedAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right font-mono">
                          <span className="text-xs text-[#A6AFCA] block">Ventas Turno:</span>
                          <strong className="text-base text-white">{formatCOP(bundle.salesDetailed.totalGross)}</strong>
                        </div>

                        <div className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                          bundle.cashSummary.cashDifference === 0 
                            ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40' 
                            : bundle.cashSummary.cashDifference > 0 
                              ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/40' 
                              : 'bg-red-950/40 text-red-300 border-red-500/40'
                        }`}>
                          Dif: {bundle.cashSummary.cashDifference > 0 ? `+${bundle.cashSummary.cashDifference}` : bundle.cashSummary.cashDifference}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-[#A6AFCA] bg-[#0B0D18] rounded-2xl border border-[#EBE1D5]/10">
                  Aún no se han completado cierres automáticos en esta sesión. Al cerrar un turno en el módulo de Caja, el paquete aparecerá aquí automáticamente.
                </div>
              )}
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: PRODUCTOS TOP & PRODUCTOS SIN MOVIMIENTO (DEAD STOCK)   */}
        {/* ============================================================== */}
        {activeTab === 'productos' && (
          <div className="space-y-6 animate-in fade-in">
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Best-selling products */}
              <div className="p-5 rounded-3xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base">Productos Más Vendidos</h3>
                    <p className="text-xs text-[#A6AFCA]">Clasificados por unidades solicitadas en comandas pagadas.</p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 font-bold">Top Ventas</span>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {metrics.topProducts.length > 0 ? (
                    metrics.topProducts.map((p, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-[#0B0D18] border border-[#EBE1D5]/15 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-[#151946] border border-[#EBE1D5]/20 flex items-center justify-center font-bold text-xs text-white">
                            {idx + 1}
                          </span>
                          <div>
                            <strong className="text-white block">{p.name}</strong>
                            <span className="text-[11px] text-[#A6AFCA] font-mono">{p.quantity} unidades despachadas</span>
                          </div>
                        </div>
                        <span className="font-bold font-mono text-white text-sm">
                          {formatCOP(p.totalCOP)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#A6AFCA]">No hay ventas registradas en el período seleccionado.</p>
                  )}
                </div>
              </div>

              {/* Dead stock (0 movement) */}
              <div className="p-5 rounded-3xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Productos Sin Movimiento (Dead Stock)</span>
                    </h3>
                    <p className="text-xs text-[#A6AFCA]">Ítems de la carta que no han tenido ninguna venta en este período.</p>
                  </div>
                  <span className="text-xs font-mono text-amber-400 font-bold">
                    {metrics.deadStock.length} sin rotación
                  </span>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {metrics.deadStock.length > 0 ? (
                    metrics.deadStock.map((p) => (
                      <div key={p.id} className="p-3 rounded-xl bg-[#0B0D18] border border-amber-500/20 flex items-center justify-between text-xs">
                        <div>
                          <strong className="text-white block">{p.name}</strong>
                          <span className="text-[11px] text-[#A6AFCA] font-mono">
                            {p.category} · {p.station === 'cocina' ? 'Cocina' : 'Bar'}
                          </span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="text-xs text-amber-300 font-bold block">{formatCOP(p.price)}</span>
                          <span className="text-[10px] text-amber-400/80">0 ventas</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-emerald-400">¡Excelente! Todos los productos de la carta registran ventas.</p>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: CAJA, ARQUEOS Y FONDO INICIAL                           */}
        {/* ============================================================== */}
        {activeTab === 'caja' && (
          <div className="space-y-6 animate-in fade-in">
            
            <div className="p-5 rounded-3xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-4">
              <div>
                <h3 className="font-bold text-white text-lg">Historial de Fondos Iniciales y Arqueos de Caja</h3>
                <p className="text-xs text-[#A6AFCA]">
                  Verificación de base de caja al abrir, efectivo esperado frente a efectivo contado y cálculo estricto de discrepancias.
                </p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[#EBE1D5]/20">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#151946] border-b border-[#EBE1D5]/20 text-[#EBE1D5] uppercase text-[11px]">
                    <tr>
                      <th className="p-3 font-sans">Turno & Centro</th>
                      <th className="p-3 font-sans">Apertura</th>
                      <th className="p-3 font-sans">Cierre</th>
                      <th className="p-3 text-right">Fondo Inicial</th>
                      <th className="p-3 text-right">Efectivo Esperado</th>
                      <th className="p-3 text-right">Efectivo Contado</th>
                      <th className="p-3 text-right">Diferencia</th>
                      <th className="p-3 font-sans">Responsable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EBE1D5]/10">
                    {[...(shiftHistory || [])].map((s) => (
                      <tr key={s.id} className="hover:bg-[#151946]/20">
                        <td className="p-3 font-sans font-bold text-white">
                          {s.center}
                          <span className="block text-[10px] text-[#A6AFCA] font-normal font-mono">{s.operationalType}</span>
                        </td>
                        <td className="p-3 text-[#A6AFCA]">{formatDateTimeBogota(s.openedAt)}</td>
                        <td className="p-3 text-[#A6AFCA]">{s.closedAt ? formatDateTimeBogota(s.closedAt) : 'En curso'}</td>
                        <td className="p-3 text-right text-white font-bold">{formatCOP(s.initialFund)}</td>
                        <td className="p-3 text-right text-white">{formatCOP(s.expectedCash)}</td>
                        <td className="p-3 text-right text-white">{s.countedCash ? formatCOP(s.countedCash) : 'Pendiente'}</td>
                        <td className="p-3 text-right font-bold">
                          {s.cashDifference === 0 ? (
                            <span className="text-emerald-400">0</span>
                          ) : s.cashDifference > 0 ? (
                            <span className="text-cyan-400">+{formatCOP(s.cashDifference)}</span>
                          ) : (
                            <span className="text-red-400">{formatCOP(s.cashDifference)}</span>
                          )}
                        </td>
                        <td className="p-3 font-sans text-[#EBE1D5]">@{s.closedByUserName || s.openedByUserName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: HISTORIAL AUDITABLE POR EMPLEADO (AUDIT TRAIL)          */}
        {/* ============================================================== */}
        {activeTab === 'auditoria' && (
          <div className="space-y-6 animate-in fade-in">
            
            <div className="p-5 rounded-3xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span>Registro Inmutable de Movimientos del Personal</span>
                  </h3>
                  <p className="text-xs text-[#A6AFCA]">
                    Trazabilidad de inicio de sesión, aperturas/cierres de caja, ventas, anulaciones, ajustes de inventario y cambios de permisos.
                  </p>
                </div>

                {/* Audit Action Filter */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#A6AFCA] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={auditSearchQuery}
                      onChange={(e) => setAuditSearchQuery(e.target.value)}
                      placeholder="Buscar por detalle..."
                      className="pl-8 pr-3 py-1.5 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-xl text-xs text-white placeholder-[#71788E] focus:outline-none focus:border-[#7C170D]"
                    />
                  </div>

                  <select
                    value={selectedAuditAction}
                    onChange={(e) => setSelectedAuditAction(e.target.value)}
                    className="px-3 py-1.5 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-xl text-xs text-[#EBE1D5] focus:outline-none cursor-pointer"
                  >
                    <option value="todos">Todas las acciones</option>
                    <option value="INICIO_SESION">Inicios de sesión</option>
                    <option value="TURNO">Turnos & Caja</option>
                    <option value="PAGO">Pagos & Ventas</option>
                    <option value="ANULADA">Anulaciones</option>
                    <option value="PERMISOS">Permisos</option>
                    <option value="INVENTARIO">Inventario</option>
                  </select>
                </div>
              </div>

              {/* Immutable Events List */}
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {filteredAuditLogs.map((log) => (
                  <div key={log.id} className="p-3.5 rounded-2xl bg-[#0B0D18] border border-[#EBE1D5]/15 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-[#151946] border border-[#EBE1D5]/30 text-[#EBE1D5]">
                          {log.action}
                        </span>
                        <strong className="text-white">{log.entity}</strong>
                        <span className="text-[11px] font-mono text-[#A6AFCA]">· {formatDateTimeBogota(log.timestamp)}</span>
                      </div>
                      <p className="text-[#A6AFCA]">{log.details}</p>
                      {log.reason && (
                        <p className="text-[11px] text-amber-300 italic">Motivo: {log.reason}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {log.valueCOP !== undefined && log.valueCOP > 0 && (
                        <span className="font-mono font-bold text-white text-sm">
                          {formatCOP(log.valueCOP)}
                        </span>
                      )}
                      <div className="text-right">
                        <span className="text-xs font-semibold text-[#EBE1D5] block">@{log.userName}</span>
                        {log.shiftId && <span className="text-[10px] text-[#A6AFCA] font-mono">Turno: {log.shiftId}</span>}
                      </div>
                    </div>
                  </div>
                ))}

                {filteredAuditLogs.length === 0 && (
                  <div className="p-8 text-center text-xs text-[#A6AFCA]">
                    No se encontraron registros de auditoría para los filtros aplicados.
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-[#0B0D18] border border-[#EBE1D5]/15 flex items-center justify-between text-[11px] text-[#A6AFCA]">
                <span>Garantía de Integridad: Los eventos de auditoría no pueden ser alterados ni eliminados desde la interfaz.</span>
                <span className="font-mono text-emerald-400 font-bold">✓ Audit Trail Seguro</span>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
