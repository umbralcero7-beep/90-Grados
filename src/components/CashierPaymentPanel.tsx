import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Order, PaymentRecord } from '../types';
import { formatCOP, formatDateTimeBogota } from '../utils/format';
import { printCustomerReceipt80mm } from '../utils/thermalPrinter';
import { 
  Banknote, 
  CheckCircle2, 
  RotateCcw, 
  Printer, 
  Smartphone, 
  CreditCard, 
  Clock, 
  UtensilsCrossed, 
  Receipt, 
  ArrowLeft, 
  User, 
  Check, 
  AlertCircle 
} from 'lucide-react';

interface CashierPaymentPanelProps {
  initialOrderId?: string | null;
  onBackToMenu: () => void;
}

type BillDenomination = 10000 | 20000 | 50000 | 100000;

export const CashierPaymentPanel: React.FC<CashierPaymentPanelProps> = ({ 
  initialOrderId, 
  onBackToMenu 
}) => {
  const { 
    currentUser, 
    orders, 
    config, 
    completePayment, 
    currentShift 
  } = useApp();

  // Find open orders
  const openOrders = orders.filter(o => o.status === 'abierta');

  // Currently selected order to charge
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    initialOrderId || openOrders[0]?.id || null
  );

  // Bill counts state
  const [billCounts, setBillCounts] = useState<Record<BillDenomination, number>>({
    10000: 0,
    20000: 0,
    50000: 0,
    100000: 0,
  });

  // Split payment state
  const [splitMethod, setSplitMethod] = useState<'ninguno' | 'nequi' | 'daviplata' | 'tarjeta'>('ninguno');
  const [splitElectronicAmount, setSplitElectronicAmount] = useState<number>(0);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedPayment, setCompletedPayment] = useState<PaymentRecord | null>(null);
  const [lastPaidOrder, setLastPaidOrder] = useState<Order | null>(null);

  // Sync when initialOrderId changes
  useEffect(() => {
    if (initialOrderId) {
      setSelectedOrderId(initialOrderId);
      setCompletedPayment(null);
      resetBills();
    }
  }, [initialOrderId]);

  const selectedOrder = orders.find(o => o.id === selectedOrderId) || null;

  const totalDue = selectedOrder ? selectedOrder.totalAmount : 0;

  // Calculate cash received using integer arithmetic
  const cashReceived = (billCounts[10000] * 10000) +
                       (billCounts[20000] * 20000) +
                       (billCounts[50000] * 50000) +
                       (billCounts[100000] * 100000);

  const pendingForCash = Math.max(totalDue - splitElectronicAmount, 0);

  // Exact formulas from Section 5:
  // vuelto = max(efectivo_recibido - saldo_pendiente, 0)
  // saldo_pendiente_tras_abono = max(saldo_pendiente - efectivo_recibido, 0)
  const changeToGive = Math.max(cashReceived - pendingForCash, 0);
  const cashStillPending = Math.max(pendingForCash - cashReceived, 0);

  const canConfirm = selectedOrder !== null && cashStillPending === 0 && (cashReceived + splitElectronicAmount >= totalDue);

  const addBill = (denom: BillDenomination) => {
    setBillCounts(prev => ({ ...prev, [denom]: prev[denom] + 1 }));
  };

  const removeBill = (denom: BillDenomination) => {
    setBillCounts(prev => ({ ...prev, [denom]: Math.max(prev[denom] - 1, 0) }));
  };

  const resetBills = () => {
    setBillCounts({
      10000: 0,
      20000: 0,
      50000: 0,
      100000: 0,
    });
    setSplitElectronicAmount(0);
    setSplitMethod('ninguno');
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setCompletedPayment(null);
    setLastPaidOrder(null);
    resetBills();
  };

  const handleConfirmPayment = () => {
    if (!selectedOrder || !canConfirm || isSubmitting) return;

    setIsSubmitting(true);

    const methods: PaymentRecord['methods'] = [];
    if (cashReceived > 0) {
      methods.push({ method: 'efectivo', amount: Math.min(cashReceived, pendingForCash) });
    }
    if (splitElectronicAmount > 0 && splitMethod !== 'ninguno') {
      methods.push({ method: splitMethod, amount: splitElectronicAmount });
    }

    const record: PaymentRecord = {
      id: `pay-${Date.now()}`,
      totalDue,
      receivedCash: cashReceived,
      cashDenominations: { ...billCounts },
      changeGiven: changeToGive,
      remainingBalance: 0,
      methods,
      cashierId: currentUser.id,
      cashierName: currentUser.fullName,
      paidAt: new Date().toISOString(),
    };

    completePayment(selectedOrder.id, record);
    setLastPaidOrder(selectedOrder);
    setCompletedPayment(record);
    setIsSubmitting(false);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-[#0B0D18] text-[#EBE1D5] overflow-hidden">
      
      {/* Top Header of the Payment Panel */}
      <div className="p-4 border-b border-[#EBE1D5]/20 header-brand-gradient flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMenu}
            className="p-2 rounded-xl bg-[#0D1024] hover:bg-[#151946] border border-[#EBE1D5]/20 text-[#EBE1D5] transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0"
            title="Volver a la carta del restaurante"
          >
            <ArrowLeft className="w-4 h-4 text-[#EBE1D5]" />
            <span>Volver a la Carta</span>
          </button>

          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Panel Separado de Cobro & Caja</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                {openOrders.length} cuentas pendientes
              </span>
            </h2>
            <div className="flex items-center gap-2 text-xs text-[#A6AFCA]">
              <span>Cajero en turno:</span>
              <strong className="text-[#EBE1D5] font-mono">@{currentUser.username}</strong>
              <span aria-hidden="true">·</span>
              <span>{currentShift ? currentShift.center : 'Sin turno abierto'}</span>
            </div>
          </div>
        </div>

        {/* Quick Shift Cash info */}
        {currentShift && (
          <div className="hidden md:flex items-center gap-3 text-xs">
            <div className="p-2 px-3 rounded-lg bg-[#0E1120] border border-[#EBE1D5]/20 text-right">
              <span className="text-[#A6AFCA] block text-[10px] uppercase font-semibold">Efectivo en Gaveta:</span>
              <span className="font-mono font-bold text-white tabular-nums text-sm">
                {formatCOP(currentShift.expectedCash)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Two-Column Workstation */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT COLUMN: Open Accounts / Tables Rack */}
        <div className="w-full lg:w-80 bg-[#0E1120] border-r border-[#EBE1D5]/20 flex flex-col shrink-0">
          <div className="p-3.5 border-b border-[#EBE1D5]/15 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#EBE1D5] flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#7C170D]" /> Cuentas por Cobrar
            </span>
            <span className="text-xs font-mono text-[#A6AFCA]">{openOrders.length} mesas</span>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-2">
            {openOrders.length === 0 ? (
              <div className="p-6 text-center text-[#71788E] text-xs">
                <Receipt className="w-10 h-10 stroke-1 mx-auto mb-2 text-[#71788E]" />
                <p className="font-semibold text-[#EBE1D5]">No hay cuentas abiertas</p>
                <p className="mt-1 text-[#A6AFCA]">Todas las órdenes han sido canceladas o cobradas.</p>
                <button
                  onClick={onBackToMenu}
                  className="mt-4 px-3.5 py-1.5 bg-[#7C170D] hover:bg-[#961D12] text-white rounded-lg text-xs font-bold cursor-pointer border border-[#EBE1D5]/30 transition-all shadow-md"
                >
                  Ir a la Carta a Pedir
                </button>
              </div>
            ) : (
              openOrders.map(ord => {
                const isSelected = ord.id === selectedOrderId;
                return (
                  <button
                    key={ord.id}
                    onClick={() => handleSelectOrder(ord.id)}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 shadow-sm ${
                      isSelected
                        ? 'bg-[#151946] border-[#7C170D] ring-1 ring-[#7C170D]/50 text-white'
                        : 'bg-[#121524] border-[#EBE1D5]/20 hover:border-[#EBE1D5]/40 text-[#EBE1D5]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{ord.tableNumber}</span>
                      <span className="text-sm font-extrabold text-white font-mono tabular-nums">
                        {formatCOP(ord.totalAmount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#A6AFCA]">
                      <span>Orden #{ord.orderNumber}</span>
                      <span>{ord.items.length} platos/bebidas</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[#A6AFCA]/70 pt-1 border-t border-[#EBE1D5]/10">
                      <span>Mesero: @{ord.waiterName.split(' ')[0]}</span>
                      <span>{formatDateTimeBogota(ord.createdAt).split(',')[1]}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Dedicated Cash Payment Station */}
        <div className="flex-1 bg-[#0B0D18] p-4 sm:p-6 overflow-y-auto flex flex-col justify-between">
          
          {completedPayment && lastPaidOrder ? (
            /* Completed Payment Receipt View */
            <div className="max-w-md mx-auto w-full p-6 rounded-2xl bg-[#121524] border border-[#EBE1D5]/20 shadow-2xl text-center space-y-5 animate-in fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-black text-white">¡Pago Registrado Exitosamente!</h3>
                <p className="text-xs text-[#A6AFCA] mt-1">
                  Comprobante interno emitido en caja de 90 Grados
                </p>
              </div>

              {/* Printable Ticket Receipt */}
              <div className="p-5 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20 text-left font-mono text-xs space-y-2 text-[#EBE1D5]">
                <div className="text-center pb-2 border-b border-[#EBE1D5]/15">
                  <p className="font-bold text-white text-sm">{config.businessName}</p>
                  <p className="text-[11px] text-[#A6AFCA]">NIT: {config.nit}</p>
                  <p className="text-[11px] text-[#A6AFCA]">{config.municipality} · Tel: {config.phone}</p>
                </div>

                <div className="flex justify-between text-[#A6AFCA]">
                  <span>Orden #{lastPaidOrder.orderNumber}</span>
                  <span>{lastPaidOrder.tableNumber}</span>
                </div>
                <div className="flex justify-between text-[#A6AFCA]">
                  <span>Fecha:</span>
                  <span>{formatDateTimeBogota(completedPayment.paidAt)}</span>
                </div>
                <div className="flex justify-between text-[#A6AFCA]">
                  <span>Cajero:</span>
                  <span>@{currentUser.username} ({currentUser.fullName.split(' ')[0]})</span>
                </div>

                <div className="border-t border-[#EBE1D5]/15 pt-2 space-y-1">
                  {lastPaidOrder.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="truncate max-w-[200px]">{it.quantity}x {it.productName}</span>
                      <span>{formatCOP(it.price * it.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#EBE1D5]/15 pt-2 space-y-1">
                  <div className="flex justify-between text-white font-bold">
                    <span>TOTAL PAGADO:</span>
                    <span>{formatCOP(completedPayment.totalDue)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400">
                    <span>Efectivo Recibido:</span>
                    <span>{formatCOP(completedPayment.receivedCash)}</span>
                  </div>
                  <div className="flex justify-between text-[#EBE1D5] font-bold">
                    <span>VUELTO / CAMBIO:</span>
                    <span>{formatCOP(completedPayment.changeGiven)}</span>
                  </div>
                </div>

                <div className="text-center pt-2 text-[10px] text-[#A6AFCA] border-t border-[#EBE1D5]/15">
                  ¡Gracias por su visita a 90 Grados!
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => printCustomerReceipt80mm(lastPaidOrder, completedPayment, config)}
                  className="px-4 py-2.5 rounded-xl bg-[#151946] hover:bg-[#1E235E] text-[#EBE1D5] text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md border border-[#EBE1D5]/30"
                >
                  <Printer className="w-4 h-4 text-[#EBE1D5]" />
                  Imprimir Térmica (80mm)
                </button>
                <button
                  type="button"
                  onClick={onBackToMenu}
                  className="px-5 py-2.5 rounded-xl bg-[#7C170D] hover:bg-[#961D12] text-white text-xs font-bold cursor-pointer border border-[#EBE1D5]/30 shadow-md"
                >
                  Regresar a la Carta
                </button>
              </div>
            </div>
          ) : selectedOrder ? (
            /* Active Order Cash Payment Station */
            <div className="max-w-2xl mx-auto w-full space-y-6">
              
              {/* Order Header Card */}
              <div className="p-4 rounded-2xl bg-[#121524] border border-[#EBE1D5]/20 flex items-center justify-between shadow-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-white">{selectedOrder.tableNumber}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded bg-[#0E1120] border border-[#EBE1D5]/20 font-mono text-[#EBE1D5]">
                      Orden #{selectedOrder.orderNumber}
                    </span>
                  </div>
                  <p className="text-xs text-[#A6AFCA] mt-0.5">
                    Mesero: <strong className="text-white">@{selectedOrder.waiterName.split(' ')[0]}</strong> · {selectedOrder.items.length} productos
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs uppercase font-semibold text-[#A6AFCA] block">Total Cuenta:</span>
                  <span className="text-2xl font-black text-white font-mono tabular-nums">
                    {formatCOP(totalDue)}
                  </span>
                </div>
              </div>

              {/* Account Balance and Change Counters */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-[#121524] border border-[#EBE1D5]/20 text-center shadow-md">
                  <span className="text-xs uppercase font-semibold tracking-wider text-[#A6AFCA] block mb-1">
                    Efectivo Recibido en Gaveta
                  </span>
                  <span className="text-2xl font-black text-white font-mono tabular-nums">
                    {formatCOP(cashReceived)}
                  </span>
                  <p className="text-[11px] text-[#A6AFCA]/70 mt-1">Suma acumulada de billetes</p>
                </div>

                <div className={`p-4 rounded-xl border text-center transition-all shadow-md ${
                  cashStillPending === 0 
                    ? 'bg-emerald-950/30 border-emerald-500/50' 
                    : 'bg-[#151946]/40 border-[#7C170D]/40'
                }`}>
                  <span className="text-xs uppercase font-semibold tracking-wider block mb-1 text-[#A6AFCA]">
                    {cashStillPending === 0 ? 'Vuelto Exacto a Entregar' : 'Saldo Aún Pendiente'}
                  </span>
                  {cashStillPending === 0 ? (
                    <span className="text-2xl font-black text-emerald-400 font-mono tabular-nums">
                      {formatCOP(changeToGive)}
                    </span>
                  ) : (
                    <span className="text-2xl font-black text-[#EBE1D5] font-mono tabular-nums">
                      {formatCOP(cashStillPending)}
                    </span>
                  )}
                  <p className="text-[11px] text-[#A6AFCA]/80 mt-1">
                    {cashStillPending === 0 ? 'Devueltas calculadas' : 'Falta dinero para cubrir la cuenta'}
                  </p>
                </div>
              </div>

              {/* Mixed / Split Payment (Nequi / Daviplata / Tarjeta) */}
              <div className="p-3.5 rounded-xl bg-[#121524] border border-[#EBE1D5]/20 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#EBE1D5] flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400" /> Pago Mixto / Electrónico:
                  </span>
                  <select
                    value={splitMethod}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setSplitMethod(val);
                      if (val === 'ninguno') setSplitElectronicAmount(0);
                    }}
                    className="bg-[#0E1120] border border-[#EBE1D5]/20 text-xs text-[#EBE1D5] rounded px-2.5 py-1.5 focus:border-[#7C170D] focus:outline-none"
                  >
                    <option value="ninguno">100% Efectivo en Caja</option>
                    <option value="nequi">Parte por Nequi</option>
                    <option value="daviplata">Parte por Daviplata</option>
                    <option value="tarjeta">Parte con Tarjeta / Datáfono</option>
                  </select>
                </div>

                {splitMethod !== 'ninguno' && (
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-xs text-[#A6AFCA] whitespace-nowrap">Monto transferido:</label>
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      max={totalDue}
                      value={splitElectronicAmount || ''}
                      onChange={(e) => setSplitElectronicAmount(Math.min(Number(e.target.value) || 0, totalDue))}
                      className="w-full px-3 py-1.5 bg-[#0E1120] border border-[#EBE1D5]/25 rounded text-sm text-white font-mono focus:border-[#7C170D] focus:outline-none"
                      placeholder="ej. 20000"
                    />
                    <span className="text-xs text-[#A6AFCA] whitespace-nowrap">
                      Resta en efectivo: <strong className="text-white">{formatCOP(pendingForCash)}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Mandatory 4 Bill Selection Buttons (Section 5) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#EBE1D5] flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-[#7C170D]" />
                    Billetes en Efectivo COP (Toca para agregar unidad)
                  </label>
                  {cashReceived > 0 && (
                    <button
                      onClick={resetBills}
                      className="text-xs text-[#A6AFCA] hover:text-red-400 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" /> Reiniciar Billetes
                    </button>
                  )}
                </div>

                {/* EXACT 4 BILL BUTTONS ($10.000, $20.000, $50.000, $100.000 COP) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([10000, 20000, 50000, 100000] as BillDenomination[]).map((denom) => {
                    const count = billCounts[denom];
                    const styles: Record<BillDenomination, string> = {
                      10000: 'border-[#7C170D]/60 hover:border-[#7C170D] bg-[#7C170D]/20 text-[#EBE1D5]',
                      20000: 'border-[#151946] hover:border-[#2D3560] bg-[#151946]/50 text-[#EBE1D5]',
                      50000: 'border-[#3B4584]/60 hover:border-[#3B4584] bg-[#3B4584]/25 text-[#EBE1D5]',
                      100000: 'border-emerald-600/40 hover:border-emerald-500 bg-emerald-950/30 text-emerald-200',
                    };

                    return (
                      <div key={denom} className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => addBill(denom)}
                          className={`h-24 rounded-2xl border flex flex-col items-center justify-center p-3 transition-all cursor-pointer shadow-md select-none ${styles[denom]}`}
                        >
                          <span className="text-lg font-black font-mono">
                            {formatCOP(denom)}
                          </span>
                          <span className="text-[10px] text-[#A6AFCA] mt-1">
                            Tocar para añadir
                          </span>
                        </button>

                        <div className="flex items-center justify-between mt-1.5 px-1.5">
                          <span className="text-xs text-[#A6AFCA] font-mono font-bold">
                            {count > 0 ? `${count} unidad(es)` : '0'}
                          </span>
                          {count > 0 && (
                            <button
                              type="button"
                              onClick={() => removeBill(denom)}
                              className="text-[11px] text-red-400 hover:text-red-300 font-bold px-2 py-0.5 rounded bg-[#0E1120] border border-[#EBE1D5]/20 cursor-pointer"
                              title="Restar un billete"
                            >
                              -1
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-[#EBE1D5]/15">
                <button
                  type="button"
                  onClick={onBackToMenu}
                  className="px-4 py-2.5 rounded-xl text-[#A6AFCA] hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Regresar a la Carta
                </button>

                <button
                  type="button"
                  disabled={!canConfirm || isSubmitting}
                  onClick={handleConfirmPayment}
                  className={`px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-xl cursor-pointer ${
                    canConfirm && !isSubmitting
                      ? 'bg-[#7C170D] hover:bg-[#961D12] text-white border border-[#EBE1D5]/30'
                      : 'bg-[#151946]/50 text-[#71788E] cursor-not-allowed border border-[#EBE1D5]/10'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {canConfirm ? `Confirmar Pago en Caja (${formatCOP(totalDue)})` : 'Dinero Insuficiente'}
                </button>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#71788E]">
              <Receipt className="w-16 h-16 stroke-1 text-[#71788E] mb-3" />
              <h3 className="text-base font-bold text-[#EBE1D5]">Selecciona una mesa de la izquierda para cobrar</h3>
              <p className="text-xs text-[#A6AFCA] mt-1 max-w-sm">
                O haz clic en el botón superior para regresar a la carta y tomar nuevos pedidos.
              </p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
