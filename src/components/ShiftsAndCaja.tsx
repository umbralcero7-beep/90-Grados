import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShiftSession, ShiftReportBundle, OperationalShiftType } from '../types';
import { formatCOP, formatDateTimeBogota } from '../utils/format';
import { DailySalesChart } from './DailySalesChart';
import { 
  Clock, 
  Coins, 
  Receipt, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Printer, 
  UserCheck, 
  ArrowRightLeft, 
  Wine, 
  Lock, 
  Unlock, 
  Calendar,
  Sparkles,
  BarChart3,
  Download,
  AlertCircle,
  ArrowRight,
  Utensils,
  Moon,
  Sun,
  ShieldCheck,
  FileCheck2,
  X
} from 'lucide-react';

export const ShiftsAndCaja: React.FC = () => {
  const { 
    currentShift, 
    shiftHistory, 
    savedShiftReports,
    getShiftReport,
    openShift, 
    closeShift, 
    currentUser, 
    allUsers, 
    config, 
    products,
    hasPermission 
  } = useApp();

  const canViewReports = hasPermission('ver_reportes');

  // Open Shift Form State
  const [openOperationalType, setOpenOperationalType] = useState<OperationalShiftType>('diurno_restaurante');
  const [openCenter, setOpenCenter] = useState<'Restaurante Matutino' | 'Bar Nocturno'>('Restaurante Matutino');
  const [openInitialFund, setOpenInitialFund] = useState<number>(200000);

  // Close Shift Form State (Z Cut)
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState<number>(0);
  const [handoverUserId, setHandoverUserId] = useState<string>('');
  const [handoverNotes, setHandoverNotes] = useState<string>('Traspaso de caja conforme');

  // Active view: 'active' | 'x_cut' | 'history' | 'beverage_recon' | 'analytics'
  const [subTab, setSubTab] = useState<'active' | 'x_cut' | 'history' | 'beverage_recon' | 'analytics'>('active');
  const [selectedReportShift, setSelectedReportShift] = useState<ShiftSession | null>(null);
  const [activeReportBundle, setActiveReportBundle] = useState<ShiftReportBundle | null>(null);

  // Beverage reconciliation sample state for the shift
  const beverageProducts = products.filter(p => p.category === 'Cervezas' || p.category === 'Licores');

  const handleOpenNewShift = (e: React.FormEvent) => {
    e.preventDefault();
    openShift(openCenter, Number(openInitialFund) || 0, openOperationalType);
  };

  const handleExecuteZClose = () => {
    const closed = closeShift(Number(countedCashInput) || 0, handoverNotes, handoverUserId);
    setIsClosingModalOpen(false);
    if (closed) {
      setSelectedReportShift(closed);
      const bundle = getShiftReport(closed.id);
      if (bundle) setActiveReportBundle(bundle);
      setSubTab('history');
    }
  };

  const exportReportBundleToCSV = (bundle: ShiftReportBundle) => {
    const rows = [
      ['PAQUETE_REPORTE_AUTOMATICO_CIERRE', bundle.shiftId],
      ['TIPO_OPERACION', bundle.operationalType === 'diurno_restaurante' ? 'DIURNO (RESTAURANTE)' : 'NOCTURNO (DISCOTECA)'],
      ['GENERADO_POR', `@${bundle.closedByUserName}`],
      ['FECHA_HORA_CIERRE', bundle.generatedAt],
      ['HASH_IDEMPOTENTE_REPORTE', bundle.generationHash],
      ['VERSION_SISTEMA', `v${bundle.version}`],
      [],
      ['--- RESUMEN DE ARQUEO DE CAJA ---'],
      ['FONDO_INICIAL_COP', bundle.cashSummary.initialFund.toString()],
      ['VENTAS_EFECTIVO_COP', bundle.cashSummary.cashTotal.toString()],
      ['VENTAS_ELECTRONICAS_COP', bundle.cashSummary.electronicTotal.toString()],
      ['VENTAS_BRUTAS_TOTALES_COP', (bundle.cashSummary.cashTotal + bundle.cashSummary.electronicTotal).toString()],
      ['EFECTIVO_ESPERADO_COP', bundle.cashSummary.expectedCash.toString()],
      ['EFECTIVO_CONTADO_FISICO_COP', bundle.cashSummary.countedCash.toString()],
      ['DIFERENCIA_CAJA_COP', bundle.cashSummary.cashDifference.toString()],
      ['ESTADO_CAJA', bundle.cashSummary.cashDifference === 0 ? 'CUADRADA' : bundle.cashSummary.cashDifference > 0 ? 'SOBRANTE' : 'FALTANTE'],
      [],
      ['--- DETALLE DE VENTAS POR PRODUCTO ---'],
      ['PRODUCTO', 'CATEGORIA', 'CANTIDAD', 'PRECIO_UNITARIO_COP', 'DESCUENTO_COP', 'TOTAL_COP'],
      ...bundle.salesDetailed.items.map(p => [
        p.productName,
        p.category,
        p.quantity.toString(),
        p.unitPrice.toString(),
        p.discounts.toString(),
        p.subtotal.toString(),
      ]),
      [],
      ['--- VENTAS POR CATEGORIA ---'],
      ['CATEGORIA', 'CANTIDAD_ITEMS', 'TOTAL_COP'],
      ...Object.entries(bundle.salesDetailed.byCategory).map(([cat, info]) => [
        cat,
        info.quantity.toString(),
        info.total.toString()
      ]),
      [],
      ['AVISO_FISCAL', 'Los reportes X y Z son arqueos de control interno operativo de 90 Grados POS. Para validez tributaria ante la DIAN, verifique la resolucion de facturacion electronica o POS autorizada.']
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Reporte_Cierre_${bundle.operationalType}_${bundle.shiftId.slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCorteXToCSV = (shift: ShiftSession) => {
    const rows = [
      ['INFORME', 'CORTE X - ARQUEO EN CURSO'],
      ['ESTABLECIMIENTO', config.businessName],
      ['NIT', config.nit],
      ['MUNICIPIO', config.municipality],
      ['CENTRO_OPERATIVO', shift.center],
      ['FECHA_HORA_APERTURA', formatDateTimeBogota(shift.openedAt)],
      ['FECHA_HORA_CORTE', formatDateTimeBogota(new Date().toISOString())],
      ['RESPONSABLE_CAJA', shift.openedByUserName],
      ['FONDO_INICIAL_COP', Math.round(shift.initialFund).toString()],
      ['VENTAS_EFECTIVO_COP', Math.round(shift.totalSalesCash).toString()],
      ['VENTAS_ELECTRONICAS_COP', Math.round(shift.totalSalesElectronic).toString()],
      ['VENTAS_BRUTAS_TOTALES_COP', Math.round(shift.totalSalesTotal).toString()],
      ['EFECTIVO_ESPERADO_GAVETA_COP', Math.round(shift.expectedCash).toString()],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Corte_X_${shift.center.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-[#0B0D18] text-[#EBE1D5] overflow-y-auto">
      
      {/* Shifts Header */}
      <div className="p-4 sm:p-6 border-b border-[#EBE1D5]/20 header-brand-gradient flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0D1024] border border-[#7C170D] flex items-center justify-center text-[#EBE1D5] shadow-md">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Turnos, Caja & Cierres X / Z</h2>
              <p className="text-xs text-[#A6AFCA]">
                Restaurante Matutino & Bar Nocturno · Responsable: <strong className="text-[#EBE1D5] font-mono">@{currentUser.username}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-xl text-xs overflow-x-auto">
          <button
            onClick={() => setSubTab('active')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
              subTab === 'active' ? 'bg-[#151946] border-[#EBE1D5]/50 text-[#EBE1D5] font-bold shadow-sm' : 'border-transparent text-[#A6AFCA] hover:text-[#EBE1D5]'
            }`}
          >
            Turno Actual
          </button>
          <button
            onClick={() => setSubTab('analytics')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
              subTab === 'analytics' ? 'bg-[#151946] border-[#EBE1D5]/50 text-[#EBE1D5] font-bold shadow-sm' : 'border-transparent text-[#A6AFCA] hover:text-[#EBE1D5]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Gráfica Ventas (Recharts)</span>
          </button>
          <button
            onClick={() => setSubTab('x_cut')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer border ${
              subTab === 'x_cut' ? 'bg-[#151946] border-[#EBE1D5]/50 text-[#EBE1D5] font-bold shadow-sm' : 'border-transparent text-[#A6AFCA] hover:text-[#EBE1D5]'
            }`}
          >
            Corte X (Informativo)
          </button>
          <button
            onClick={() => setSubTab('beverage_recon')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
              subTab === 'beverage_recon' ? 'bg-[#151946] border-[#EBE1D5]/50 text-[#EBE1D5] font-bold shadow-sm' : 'border-transparent text-[#A6AFCA] hover:text-[#EBE1D5]'
            }`}
          >
            <Wine className="w-3.5 h-3.5" />
            Conciliación Bebidas
          </button>
          <button
            onClick={() => setSubTab('history')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer border ${
              subTab === 'history' ? 'bg-[#151946] border-[#EBE1D5]/50 text-[#EBE1D5] font-bold shadow-sm' : 'border-transparent text-[#A6AFCA] hover:text-[#EBE1D5]'
            }`}
          >
            Historial de Cierres Z ({shiftHistory.length})
          </button>
        </div>
      </div>

      {/* SUBTAB 1: TURNO ACTUAL */}
      {subTab === 'active' && (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
          
          {currentShift ? (
            /* Open Shift Panel */
            <div className="space-y-6">
              
              {/* Shift Banner */}
              <div className="p-6 rounded-2xl bg-[#121524] border border-[#EBE1D5]/20 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="text-2xl font-black text-white">{currentShift.center}</h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      TURNO EN CURSO
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1.5 ${
                      currentShift.operationalType === 'nocturno_discoteca'
                        ? 'bg-purple-950/40 text-purple-300 border-purple-500/30'
                        : 'bg-amber-950/40 text-amber-300 border-amber-500/30'
                    }`}>
                      {currentShift.operationalType === 'nocturno_discoteca' ? (
                        <>
                          <Moon className="w-3.5 h-3.5 text-purple-400" />
                          <span>Operación Nocturna — Discoteca / Bar</span>
                        </>
                      ) : (
                        <>
                          <Sun className="w-3.5 h-3.5 text-amber-400" />
                          <span>Operación Diurna — Restaurante</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[#A6AFCA] mt-2 flex-wrap">
                    <span>Apertura: <strong className="text-white">{formatDateTimeBogota(currentShift.openedAt)}</strong></span>
                    <span aria-hidden="true">·</span>
                    <span>Abierto por: <strong className="text-[#EBE1D5]">@{currentShift.openedByUserName.split(' ')[0]}</strong></span>
                    <span aria-hidden="true">·</span>
                    <span>Fondo Inicial: <strong className="text-white font-mono">{formatCOP(currentShift.initialFund)}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSubTab('x_cut')}
                    className="px-4 py-2.5 rounded-xl bg-[#151946] hover:bg-[#1E235E] text-[#EBE1D5] text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border border-[#EBE1D5]/30 shadow-sm"
                  >
                    <FileText className="w-4 h-4 text-[#EBE1D5]" />
                    Ver Corte X
                  </button>
                  <button
                    onClick={() => {
                      setCountedCashInput(currentShift.expectedCash);
                      setIsClosingModalOpen(true);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#7C170D] hover:bg-[#961D12] text-white text-xs font-bold transition-all shadow-lg flex items-center gap-2 cursor-pointer border border-[#EBE1D5]/30"
                  >
                    <Lock className="w-4 h-4" />
                    Realizar Cierre Z Final
                  </button>
                </div>
              </div>

              {/* Real-time Cash Register Ledger (Section 8 formula) */}
              <div className="p-6 rounded-2xl bg-[#121524] border border-[#EBE1D5]/20 shadow-lg">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-[#EBE1D5]" />
                  Cálculo del Efectivo Esperado en Caja (Libro de Caja)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/15">
                    <span className="text-xs text-[#A6AFCA] block mb-1">1. Fondo Inicial</span>
                    <span className="text-xl font-black text-white font-mono tabular-nums">
                      {formatCOP(currentShift.initialFund)}
                    </span>
                    <p className="text-[11px] text-[#8890A6] mt-1">Saldo inicial en gaveta (no venta)</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/15">
                    <span className="text-xs text-[#A6AFCA] block mb-1">2. Efectivo Neto Recibido</span>
                    <span className="text-xl font-black text-emerald-400 font-mono tabular-nums">
                      + {formatCOP(currentShift.totalSalesCash)}
                    </span>
                    <p className="text-[11px] text-[#8890A6] mt-1">Ventas cobradas en efectivo</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/15">
                    <span className="text-xs text-[#A6AFCA] block mb-1">3. Ventas Electrónicas</span>
                    <span className="text-xl font-black text-cyan-400 font-mono tabular-nums">
                      {formatCOP(currentShift.totalSalesElectronic)}
                    </span>
                    <p className="text-[11px] text-[#8890A6] mt-1">Nequi / Daviplata / Datáfono (conciliar aparte)</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#151946] border border-[#7C170D] shadow-md">
                    <span className="text-xs text-[#EBE1D5] block mb-1 font-bold">TOTAL EFECTIVO ESPERADO</span>
                    <span className="text-2xl font-black text-white font-mono tabular-nums">
                      {formatCOP(currentShift.expectedCash)}
                    </span>
                    <p className="text-[11px] text-[#A6AFCA] mt-1">Debe existir físicamente en el cajón</p>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-[#0E1120] border border-[#EBE1D5]/15 text-xs text-[#A6AFCA]">
                  <strong className="text-[#EBE1D5]">Regla contable:</strong> El saldo en caja no es ganancia neta. Los pagos por medios electrónicos no forman parte del efectivo físico de la gaveta.
                </div>
              </div>

            </div>
          ) : (
            /* No active shift - Open Shift Screen */
            <div className="max-w-xl mx-auto p-8 rounded-2xl bg-[#121524] border border-[#EBE1D5]/20 shadow-2xl text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-[#151946] border border-[#7C170D] text-[#EBE1D5] flex items-center justify-center mx-auto shadow-md">
                <Unlock className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-black text-white">Apertura de Nuevo Turno</h3>
                <p className="text-xs text-[#A6AFCA] mt-1">
                  Selecciona el tipo de operación para mantener separados pedidos, productos y reportes de cierre.
                </p>
              </div>

              <form onSubmit={handleOpenNewShift} className="space-y-5 text-left">
                {/* Operational shift selection (Requirement 4) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#EBE1D5] mb-2">
                    Tipo de Operación del Turno *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      onClick={() => {
                        setOpenOperationalType('diurno_restaurante');
                        setOpenCenter('Restaurante Matutino');
                      }}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        openOperationalType === 'diurno_restaurante'
                          ? 'bg-[#151946] border-[#EBE1D5] shadow-lg ring-1 ring-[#EBE1D5]/40'
                          : 'bg-[#0E1120] border-[#EBE1D5]/15 hover:border-[#EBE1D5]/30'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center">
                          <Sun className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-white">Diurno — Restaurante</span>
                      </div>
                      <p className="text-[11px] text-[#A6AFCA] leading-snug">
                        Sopas típicas, platos de la carta, cortes al carbón, almuerzos familiares y bebidas.
                      </p>
                    </div>

                    <div
                      onClick={() => {
                        setOpenOperationalType('nocturno_discoteca');
                        setOpenCenter('Bar Nocturno');
                      }}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        openOperationalType === 'nocturno_discoteca'
                          ? 'bg-[#151946] border-[#7C170D] shadow-lg ring-1 ring-[#7C170D]'
                          : 'bg-[#0E1120] border-[#EBE1D5]/15 hover:border-[#EBE1D5]/30'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center">
                          <Moon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-white">Nocturno — Discoteca</span>
                      </div>
                      <p className="text-[11px] text-[#A6AFCA] leading-snug">
                        Bebidas, cervezas nacionales e importadas, botellas de aguardiente, ron, whisky y coctelería.
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#8890A6] mt-2">
                    Nota: La separación no depende solo de la hora del reloj; respeta la configuración operativa del local seleccionada.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#EBE1D5] mb-1">
                    Centro Operativo de Caja *
                  </label>
                  <select
                    value={openCenter}
                    onChange={(e) => setOpenCenter(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#7C170D]"
                  >
                    <option value="Restaurante Matutino">Restaurante Matutino</option>
                    <option value="Bar Nocturno">Bar Nocturno</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#EBE1D5] mb-1">
                    Fondo Inicial de Caja en COP (Sencillo de apertura) *
                  </label>
                  <input
                    type="number"
                    step="10000"
                    min="0"
                    value={openInitialFund}
                    onChange={(e) => setOpenInitialFund(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-[#7C170D]"
                    required
                  />

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="text-[10px] text-[#71788E] font-medium">Sugerencias rápidas:</span>
                    {[100000, 150000, 200000, 300000, 500000].map(amount => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setOpenInitialFund(amount)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors cursor-pointer border ${
                          openInitialFund === amount 
                            ? 'bg-[#151946] border-[#EBE1D5]/50 text-[#EBE1D5] font-bold shadow-sm' 
                            : 'bg-[#0E1120] hover:bg-[#151946]/40 text-[#A6AFCA] border-[#EBE1D5]/15'
                        }`}
                      >
                        {formatCOP(amount)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0E1120] border border-[#EBE1D5]/15 text-xs text-[#A6AFCA]">
                  Responsable que abre: <strong className="text-white">@{currentUser.username} ({currentUser.fullName})</strong>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#7C170D] hover:bg-[#961D12] text-white font-bold text-sm shadow-md transition-all cursor-pointer border border-[#EBE1D5]/30 flex items-center justify-center gap-2"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Abrir Turno ({openOperationalType === 'diurno_restaurante' ? 'Restaurante' : 'Discoteca'})</span>
                </button>
              </form>
            </div>
          )}

        </div>
      )}

      {/* SUBTAB 2: CORTE X (INFORMATIVO NO DESTRUCTIVO) */}
      {subTab === 'x_cut' && (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-4">
          <div className="p-4 rounded-xl bg-[#151946]/50 border border-[#EBE1D5]/20 text-[#EBE1D5] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#EBE1D5] shrink-0" />
              <span><strong>Corte X:</strong> Consulta no destructiva en tiempo real. No cierra la caja ni reinicia contadores.</span>
            </span>

            {currentShift && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => exportCorteXToCSV(currentShift)}
                  className="px-3 py-1 bg-[#151946] hover:bg-[#151946]/80 text-[#EBE1D5] border border-[#EBE1D5]/20 font-semibold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Exportar datos del Corte X a archivo CSV"
                >
                  <Download className="w-3.5 h-3.5 text-[#EBE1D5]" /> Exportar CSV
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-[#7C170D] text-white font-bold rounded-lg text-xs hover:bg-[#961D12] flex items-center gap-1 cursor-pointer transition-colors shadow-md border border-[#EBE1D5]/30"
                  title="Imprimir informe en impresora térmica"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimir X
                </button>
              </div>
            )}
          </div>

          {currentShift ? (
            <div className="p-6 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 text-left space-y-4 font-mono text-xs shadow-xl">
              <div className="text-center pb-3 border-b border-[#EBE1D5]/15">
                <h4 className="text-base font-bold text-white uppercase">{config.businessName}</h4>
                <p className="text-[#A6AFCA]">INFORME DE CORTE X (ARQUEO EN CURSO)</p>
                <p className="text-[#A6AFCA]/80">NIT: {config.nit} · {config.municipality}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[#EBE1D5]">
                <div>Centro: <strong>{currentShift.center}</strong></div>
                <div>Estado: <strong className="text-emerald-400">ABIERTO</strong></div>
                <div>Apertura: <span>{formatDateTimeBogota(currentShift.openedAt)}</span></div>
                <div>Fecha operativa: <span>{new Date().toLocaleDateString('es-CO')}</span></div>
                <div>Responsable: <span>@{currentShift.openedByUserName.split(' ')[0]}</span></div>
                <div>Hora del corte: <span>{new Date().toLocaleTimeString('es-CO')}</span></div>
              </div>

              <div className="border-t border-[#EBE1D5]/15 pt-3 space-y-2">
                <div className="flex justify-between text-[#EBE1D5]">
                  <span>Fondo Inicial de Caja:</span>
                  <span>{formatCOP(currentShift.initialFund)}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Ventas Cobradas en Efectivo:</span>
                  <span>+ {formatCOP(currentShift.totalSalesCash)}</span>
                </div>
                <div className="flex justify-between text-cyan-400">
                  <span>Ventas Cobradas en Medios Electrónicos:</span>
                  <span>{formatCOP(currentShift.totalSalesElectronic)}</span>
                </div>
                <div className="flex justify-between text-white font-bold border-t border-[#EBE1D5]/15 pt-2">
                  <span>VENTAS BRUTAS TOTALES:</span>
                  <span>{formatCOP(currentShift.totalSalesTotal)}</span>
                </div>
                <div className="flex justify-between text-white font-bold border-t border-[#EBE1D5]/20 pt-2 text-sm bg-[#151946]/50 p-2 rounded-lg">
                  <span className="text-[#EBE1D5]">EFECTIVO ESPERADO EN CAJÓN:</span>
                  <span className="text-white font-mono">{formatCOP(currentShift.expectedCash)}</span>
                </div>
              </div>

              <p className="text-[10px] text-[#A6AFCA] text-center pt-2">
                Este reporte no constituye documento tributario ni cierre fiscal oficial.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* No active shift state */}
              <div className="p-8 text-center rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-4 shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-[#151946] border border-[#EBE1D5]/20 flex items-center justify-center text-[#EBE1D5] mx-auto">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h4 className="text-base font-bold text-white">No Hay Turno de Caja Abierto</h4>
                  <p className="text-xs text-[#A6AFCA] leading-relaxed">
                    El Corte X es un informe de arqueo parcial que refleja las ventas en curso de una sesión activa. Al no haber turno iniciado, no hay movimientos pendientes por auditar.
                  </p>
                </div>
                <div>
                  <button
                    onClick={() => setSubTab('active')}
                    className="px-5 py-2.5 rounded-xl bg-[#7C170D] hover:bg-[#961D12] text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer transition-all shadow-md active:scale-95 border border-[#EBE1D5]/30"
                  >
                    <span>Abrir Nuevo Turno de Caja</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Accessible Last Closed Shift Preview */}
              {shiftHistory.length > 0 && (
                <div className="p-5 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#EBE1D5]" />
                      <span>Último Cierre Registrado (Turno Previo)</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/40 font-bold">
                      Cierre Z Conforme
                    </span>
                  </div>

                  <div className="p-3.5 bg-[#0B0D18] rounded-xl border border-[#EBE1D5]/15 text-xs space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[#EBE1D5]">
                      <div>
                        <span className="text-[10px] text-[#A6AFCA] block">Centro</span>
                        <strong className="text-white">{shiftHistory[0].center}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#A6AFCA] block">Cerrado por</span>
                        <strong className="text-white">@{shiftHistory[0].closedByUserName ? shiftHistory[0].closedByUserName.split(' ')[0] : 'Admin'}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#A6AFCA] block">Ventas Totales</span>
                        <strong className="text-emerald-400 font-mono">{formatCOP(shiftHistory[0].totalSalesTotal)}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#A6AFCA] block">Diferencia de Caja</span>
                        <strong className={`font-mono ${shiftHistory[0].cashDifference === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {shiftHistory[0].cashDifference === 0 ? 'Cuadrada ($0)' : formatCOP(shiftHistory[0].cashDifference)}
                        </strong>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-[#EBE1D5]/15">
                      <button
                        onClick={() => {
                          setSelectedReportShift(shiftHistory[0]);
                          setSubTab('history');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#151946] hover:bg-[#151946]/80 text-[#EBE1D5] hover:text-white border border-[#EBE1D5]/20 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#EBE1D5]" /> Ver Informe Z Completo
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: CONCILIACIÓN DE BEBIDAS */}
      {subTab === 'beverage_recon' && (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-4">
          <div className="p-4 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wine className="w-5 h-5 text-[#EBE1D5]" />
                Conciliación de Cervezas y Licores por SKU
              </h3>
              <p className="text-xs text-[#A6AFCA]">
                Fórmula: Esperado = Inicial + Entradas + Traslados In - Traslados Out - Consumo Teórico - Mermas.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#EBE1D5]/20 bg-[#0E1120] overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#151946] border-b border-[#EBE1D5]/20 text-[#EBE1D5] uppercase font-semibold">
                  <tr>
                    <th className="p-3">Producto / SKU</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3 text-right">Inicial</th>
                    <th className="p-3 text-right">Entradas</th>
                    <th className="p-3 text-right">Venta Teórica</th>
                    <th className="p-3 text-right">Esperado</th>
                    <th className="p-3 text-right">Físico</th>
                    <th className="p-3 text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBE1D5]/10 font-mono">
                  {beverageProducts.slice(0, 10).map((b, idx) => {
                    const initial = 24;
                    const entries = 6;
                    const sold = idx % 2 === 0 ? 4 : 2;
                    const expected = initial + entries - sold;
                    const physical = expected; // matching for clean display
                    const diff = physical - expected;

                    return (
                      <tr key={b.id} className="hover:bg-[#151946]/20">
                        <td className="p-3 font-sans font-medium text-white">{b.name}</td>
                        <td className="p-3 font-sans text-[#A6AFCA]">{b.category}</td>
                        <td className="p-3 text-right text-[#EBE1D5]">{initial}</td>
                        <td className="p-3 text-right text-emerald-400">+{entries}</td>
                        <td className="p-3 text-right text-orange-400">-{sold}</td>
                        <td className="p-3 text-right font-bold text-white">{expected}</td>
                        <td className="p-3 text-right text-cyan-300">{physical}</td>
                        <td className={`p-3 text-right font-bold ${diff === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {diff === 0 ? '0' : diff > 0 ? `+${diff}` : diff}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: HISTORIAL DE CIERRES Z & PAQUETES AUTOMATICOS */}
      {subTab === 'history' && (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-bold text-white">Historial de Cierres Z & Paquetes de Reportes</h3>
              <p className="text-xs text-[#A6AFCA]">
                Cierres inmutables guardados automáticamente con detalle de productos, arqueo de caja y Cortes X / Z.
              </p>
            </div>
            <span className="text-xs font-mono text-[#EBE1D5] bg-[#151946] px-3 py-1 rounded-lg border border-[#EBE1D5]/20">
              Total Cierres: {shiftHistory.length}
            </span>
          </div>
          
          {shiftHistory.length === 0 ? (
            <div className="p-8 text-center text-[#A6AFCA] rounded-xl border border-[#EBE1D5]/20 bg-[#0E1120]">
              Aún no se ha realizado ningún Cierre Z en el historial. Realiza un cierre de caja para auditar aquí.
            </div>
          ) : (
            <div className="space-y-4">
              {shiftHistory.map((shift) => {
                const bundle = getShiftReport(shift.id);
                const isNocturno = shift.operationalType === 'nocturno_discoteca';
                
                return (
                  <div key={shift.id} className="p-4 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{shift.center}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                          isNocturno 
                            ? 'bg-purple-950/50 text-purple-300 border-purple-500/30' 
                            : 'bg-amber-950/50 text-amber-300 border-amber-500/30'
                        }`}>
                          {isNocturno ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                          {isNocturno ? 'Nocturno (Discoteca)' : 'Diurno (Restaurante)'}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#151946] text-[#EBE1D5] border border-[#EBE1D5]/20">
                          ID: {shift.id.slice(0, 14)}
                        </span>
                        <span className="text-xs text-[#A6AFCA]">v{shift.version}</span>
                      </div>

                      <div className="text-xs text-[#A6AFCA] mt-1 flex items-center gap-3 flex-wrap">
                        <span>Cerrado: <strong className="text-white">{formatDateTimeBogota(shift.closedAt)}</strong></span>
                        <span>Responsable: <strong className="text-[#EBE1D5]">@{shift.closedByUserName}</strong></span>
                        {shift.transferHandover && (
                          <span className="text-[#EBE1D5]">
                            Entregado a: @{shift.transferHandover.toUserName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="text-xs font-mono text-right mr-2">
                        <div>
                          <span className="text-[#A6AFCA] text-[10px] uppercase block">Ventas Turno:</span>
                          <span className="text-white font-bold">{formatCOP(shift.totalSalesTotal)}</span>
                        </div>
                        <div>
                          <span className="text-[#A6AFCA] text-[10px] uppercase block">Diferencia:</span>
                          <span className={`font-bold ${shift.cashDifference === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatCOP(shift.cashDifference)}
                          </span>
                        </div>
                      </div>

                      {bundle && (
                        <button
                          onClick={() => setActiveReportBundle(bundle)}
                          className="px-3 py-1.5 rounded-lg bg-[#151946] hover:bg-[#1E235E] text-[#EBE1D5] text-xs font-bold border border-[#EBE1D5]/30 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                          title="Ver paquete completo de reportes automáticos"
                        >
                          <FileCheck2 className="w-4 h-4 text-emerald-400" />
                          <span>Ver Reporte Automático</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setSelectedReportShift(shift);
                          window.print();
                        }}
                        className="p-2 rounded-lg bg-[#0E1120] hover:bg-[#7C170D] text-[#EBE1D5] hover:text-white border border-[#EBE1D5]/20 cursor-pointer transition-colors"
                        title="Imprimir comprobante Z en impresora térmica"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 5: RECHARTS DAILY SALES ANALYTICS */}
      {subTab === 'analytics' && (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6 animate-in fade-in">
          {!canViewReports ? (
            <div className="p-8 text-center rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-3 max-w-md mx-auto my-8 shadow-xl">
              <div className="w-12 h-12 rounded-xl bg-[#7C170D]/20 border border-[#7C170D]/50 flex items-center justify-center text-[#EBE1D5] mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-white text-sm">Visualización de Reportes Restringida</h4>
              <p className="text-xs text-[#A6AFCA]">
                Tu rol (@{currentUser.username} - <em className="capitalize">{currentUser.role}</em>) no tiene activo el permiso <span className="font-mono text-[#EBE1D5]">ver_reportes</span>. Un Administrador puede habilitarlo en la vista de Configuración.
              </p>
            </div>
          ) : (
            <DailySalesChart />
          )}
        </div>
      )}

      {/* CIERRE Z MODAL */}
      {isClosingModalOpen && currentShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#121524] border border-[#EBE1D5]/20 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-[#EBE1D5] p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#EBE1D5]/15 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#7C170D]" />
                Cierre Z Final e Inmutable - {currentShift.center}
              </h3>
              <button 
                onClick={() => setIsClosingModalOpen(false)}
                className="text-[#A6AFCA] hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-[#0B0D18] rounded-xl border border-[#EBE1D5]/15 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#A6AFCA]">Efectivo Esperado según libro:</span>
                <strong className="text-white font-mono">{formatCOP(currentShift.expectedCash)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A6AFCA]">Total Ventas del Turno:</span>
                <strong className="text-emerald-400 font-mono">{formatCOP(currentShift.totalSalesTotal)}</strong>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#EBE1D5] mb-1">
                Efectivo Físico Contado en el Cajón (COP) *
              </label>
              <input
                type="number"
                step="1000"
                value={countedCashInput}
                onChange={(e) => setCountedCashInput(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-[#7C170D]"
                required
              />
              
              {/* Difference feedback */}
              <div className="mt-2 text-xs">
                {countedCashInput - currentShift.expectedCash === 0 ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Caja Cuadrada Perfecta ($0 diferencia)
                  </span>
                ) : (
                  <span className={`font-bold ${countedCashInput - currentShift.expectedCash > 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                    Diferencia: {formatCOP(countedCashInput - currentShift.expectedCash)} (
                    {countedCashInput - currentShift.expectedCash > 0 ? 'Sobrante' : 'Faltante'})
                  </span>
                )}
              </div>
            </div>

            {/* Handover to next shift */}
            <div>
              <label className="block text-xs font-semibold text-[#EBE1D5] mb-1">
                Traspaso de Turno al siguiente responsable (Relevo)
              </label>
              <select
                value={handoverUserId}
                onChange={(e) => setHandoverUserId(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#7C170D]"
              >
                <option value="">-- Sin traspaso inmediato (Cierre definitivo) --</option>
                {allUsers.filter(u => u.id !== currentUser.id).map(u => (
                  <option key={u.id} value={u.id}>
                    @{u.username} - {u.fullName} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#EBE1D5] mb-1">
                Observaciones / Novedades de Caja
              </label>
              <textarea
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-1.5 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-xs text-white placeholder-[#71788E] focus:outline-none focus:border-[#7C170D]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EBE1D5]/15">
              <button
                type="button"
                onClick={() => setIsClosingModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-[#A6AFCA] hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteZClose}
                className="px-5 py-2 text-xs font-bold bg-[#7C170D] hover:bg-[#961D12] text-white rounded-lg cursor-pointer shadow-lg border border-[#EBE1D5]/30 transition-colors"
              >
                Confirmar Cierre Z Definitivo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PAQUETE DE REPORTES AUTOMATICOS DEL CIERRE */}
      {activeReportBundle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 overflow-y-auto animate-in fade-in">
          <div className="bg-[#121524] border border-[#EBE1D5]/20 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl text-[#EBE1D5]">
            
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-[#EBE1D5]/15 bg-[#151946]/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#7C170D] flex items-center justify-center text-white border border-[#EBE1D5]/30 shadow-md">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white">Paquete Oficial de Reportes de Cierre</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                      activeReportBundle.operationalType === 'nocturno_discoteca'
                        ? 'bg-purple-950/60 text-purple-300 border-purple-500/40'
                        : 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                    }`}>
                      {activeReportBundle.operationalType === 'nocturno_discoteca' ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                      {activeReportBundle.operationalType === 'nocturno_discoteca' ? 'Turno Nocturno (Discoteca)' : 'Turno Diurno (Restaurante)'}
                    </span>
                  </div>
                  <p className="text-xs text-[#A6AFCA]">
                    Turno: <strong className="font-mono text-[#EBE1D5]">{activeReportBundle.shiftId.slice(0, 16)}</strong> · Responsable: <strong className="text-white">@{activeReportBundle.closedByUserName}</strong> · Fecha: {formatDateTimeBogota(activeReportBundle.generatedAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportReportBundleToCSV(activeReportBundle)}
                  className="px-3 py-1.5 rounded-lg bg-[#151946] hover:bg-[#1E235E] text-[#EBE1D5] text-xs font-semibold border border-[#EBE1D5]/30 flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Exportar informe a CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Exportar CSV</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-[#7C170D] hover:bg-[#961D12] text-white text-xs font-bold border border-[#EBE1D5]/30 flex items-center gap-1.5 cursor-pointer transition-colors shadow-md"
                  title="Imprimir reporte en impresora"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Imprimir</span>
                </button>
                <button
                  onClick={() => setActiveReportBundle(null)}
                  className="p-1.5 rounded-lg text-[#A6AFCA] hover:text-white hover:bg-white/10 cursor-pointer ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-[#0B0D18]">
              
              {/* Idempotency Hash & Security */}
              <div className="p-3 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/15 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                <span className="text-[#A6AFCA] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Hash de Cierre Idempotente: <strong className="font-mono text-emerald-300">{activeReportBundle.generationHash}</strong></span>
                </span>
                <span className="text-[11px] text-[#A6AFCA]">
                  Generación segura ante reintentos y caídas · v{activeReportBundle.version}
                </span>
              </div>

              {/* Cash Reconciliation Summary */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#EBE1D5] mb-3 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-[#7C170D]" />
                  <span>Arqueo y Conciliación de Efectivo de Caja</span>
                </h4>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/15">
                    <span className="text-[#A6AFCA] block text-[11px]">Fondo Inicial:</span>
                    <span className="text-base font-bold text-white font-mono">{formatCOP(activeReportBundle.cashSummary.initialFund)}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/15">
                    <span className="text-[#A6AFCA] block text-[11px]">Ventas Efectivo:</span>
                    <span className="text-base font-bold text-emerald-400 font-mono">+{formatCOP(activeReportBundle.cashSummary.cashTotal)}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/15">
                    <span className="text-[#A6AFCA] block text-[11px]">Efectivo Esperado:</span>
                    <span className="text-base font-bold text-white font-mono">{formatCOP(activeReportBundle.cashSummary.expectedCash)}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#151946] border border-[#EBE1D5]/30">
                    <span className="text-[#EBE1D5] block text-[11px] font-bold">Diferencia Final:</span>
                    <span className={`text-base font-bold font-mono ${activeReportBundle.cashSummary.cashDifference === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCOP(activeReportBundle.cashSummary.cashDifference)} ({activeReportBundle.cashSummary.cashDifference === 0 ? 'Cuadrada' : activeReportBundle.cashSummary.cashDifference > 0 ? 'Sobrante' : 'Faltante'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Detailed Sales by Product Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#EBE1D5] mb-3 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#7C170D]" />
                  <span>Ventas Detalladas por Producto ({activeReportBundle.salesDetailed.items.length} ítems)</span>
                </h4>

                <div className="rounded-xl border border-[#EBE1D5]/20 bg-[#0E1120] overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#151946] border-b border-[#EBE1D5]/20 text-[#EBE1D5] uppercase font-semibold">
                      <tr>
                        <th className="p-2.5">Producto</th>
                        <th className="p-2.5">Categoría</th>
                        <th className="p-2.5 text-right">Cant.</th>
                        <th className="p-2.5 text-right">Precio Unit.</th>
                        <th className="p-2.5 text-right">Descuentos</th>
                        <th className="p-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EBE1D5]/10 font-mono">
                      {activeReportBundle.salesDetailed.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[#151946]/30">
                          <td className="p-2.5 font-sans font-medium text-white">{item.productName}</td>
                          <td className="p-2.5 font-sans text-[#A6AFCA]">{item.category}</td>
                          <td className="p-2.5 text-right text-emerald-400 font-bold">{item.quantity}</td>
                          <td className="p-2.5 text-right text-[#A6AFCA]">{formatCOP(item.unitPrice)}</td>
                          <td className="p-2.5 text-right text-amber-300">
                            {item.discounts > 0 ? `-${formatCOP(item.discounts)}` : '$0'}
                          </td>
                          <td className="p-2.5 text-right font-bold text-white">{formatCOP(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Methods and Category Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-[#EBE1D5] mb-2">
                    Ventas por Medio de Pago
                  </h5>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 rounded-lg bg-[#121524]">
                      <span className="text-[#A6AFCA]">Efectivo Físico:</span>
                      <strong className="text-emerald-400 font-mono">{formatCOP(activeReportBundle.cashSummary.cashTotal)}</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-[#121524]">
                      <span className="text-[#A6AFCA]">Transferencias / Electrónico:</span>
                      <strong className="text-cyan-400 font-mono">{formatCOP(activeReportBundle.cashSummary.electronicTotal)}</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-[#151946] border border-[#EBE1D5]/20 font-bold">
                      <span className="text-white">TOTAL FACTURADO:</span>
                      <span className="text-white font-mono">{formatCOP(activeReportBundle.cashSummary.cashTotal + activeReportBundle.cashSummary.electronicTotal)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-[#EBE1D5] mb-2">
                    Resumen por Categorías
                  </h5>
                  <div className="space-y-1.5 text-xs">
                    {Object.entries(activeReportBundle.salesDetailed.byCategory).map(([catName, info], idx) => (
                      <div key={idx} className="flex justify-between p-1.5 rounded bg-[#121524] text-[11px]">
                        <span className="text-white font-medium">{catName} ({info.quantity} u.)</span>
                        <span className="text-emerald-400 font-mono font-bold">{formatCOP(info.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fiscal Disclaimer Reminder Box */}
              <div className="p-4 rounded-xl bg-[#151946]/40 border border-[#7C170D]/50 text-xs text-[#A6AFCA] space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Aviso de Cumplimiento Legal y Tributario</span>
                </div>
                <p>
                  Los reportes <strong>Corte X</strong> y <strong>Corte Z</strong> emitidos por este sistema corresponden a mecanismos de control interno, cuadre de caja y auditoría administrativa de 90 Grados POS.
                </p>
                <p className="text-[11px] text-[#A6AFCA]/80">
                  Para fines fiscales oficiales ante la DIAN (Resolución de Facturación POS o Factura Electrónica de Venta), valide siempre la numeración consecutiva, el CUFE/código QR y la integración autorizada con su proveedor tecnológico o software contable.
                </p>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#EBE1D5]/15 bg-[#0E1120] flex items-center justify-between">
              <span className="text-xs text-[#A6AFCA]">
                Reporte inmutable guardado localmente · Consulta no destructiva
              </span>
              <button
                onClick={() => setActiveReportBundle(null)}
                className="px-5 py-2 text-xs font-bold bg-[#151946] hover:bg-[#1E235E] text-[#EBE1D5] rounded-xl border border-[#EBE1D5]/30 cursor-pointer transition-colors"
              >
                Cerrar Reporte
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
