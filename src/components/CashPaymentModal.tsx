import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Order, OrderItem, PaymentRecord } from '../types';
import { formatCOP, formatDateTimeBogota } from '../utils/format';
import { printCustomerReceipt80mm } from '../utils/thermalPrinter';
import { 
  Banknote, 
  CheckCircle2, 
  X, 
  RotateCcw, 
  Printer, 
  AlertTriangle, 
  CreditCard, 
  Smartphone,
  ShieldCheck,
  Receipt,
  FileCheck,
  Plus,
  Minus,
  AlertCircle
} from 'lucide-react';

export type PaymentMethodTab = 'efectivo' | 'transferencia' | 'datafono';

export interface DraftOrderData {
  tableNumber: string;
  items: OrderItem[];
  customerNote?: string;
}

interface CashPaymentModalProps {
  order?: Order | null;
  draftData?: DraftOrderData | null;
  onClose: () => void;
  onPaymentSuccess?: (order?: Order) => void;
}

type BillDenomination = 10000 | 20000 | 50000 | 100000;

export const CashPaymentModal: React.FC<CashPaymentModalProps> = ({ 
  order, 
  draftData, 
  onClose, 
  onPaymentSuccess 
}) => {
  const { currentUser, config, createOrder, completePayment } = useApp();

  // Active method tab: Efectivo, Transferencia, Datáfono
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodTab>('efectivo');

  // Colombian cash bill counters: strictly 10.000, 20.000, 50.000, 100.000 COP
  const [billCounts, setBillCounts] = useState<Record<BillDenomination, number>>({
    10000: 0,
    20000: 0,
    50000: 0,
    100000: 0,
  });

  // Manual cash adjustment / direct entry (for flexible numeric entry alongside quick buttons)
  const [manualCashInput, setManualCashInput] = useState<string>('');

  // Transferencia & Datáfono verification states
  const [transferPlatform, setTransferPlatform] = useState<string>('Nequi');
  const [transferReference, setTransferReference] = useState<string>('');
  const [transferVerified, setTransferVerified] = useState<boolean>(false);

  const [cardNetwork, setCardNetwork] = useState<string>('Débito');
  const [datafonoVoucher, setDatafonoVoucher] = useState<string>('');
  const [datafonoVerified, setDatafonoVerified] = useState<boolean>(false);

  // Operational security & idempotency
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedPaymentOrder, setCompletedPaymentOrder] = useState<Order | null>(null);
  const [completedRecord, setCompletedRecord] = useState<PaymentRecord | null>(null);

  // Determine items, reference and total to pay
  const items: OrderItem[] = order ? order.items : (draftData?.items || []);
  const referenceName = order ? order.tableNumber : (draftData?.tableNumber || 'Mesa Sin Asignar');
  const totalDue = order 
    ? order.totalAmount 
    : items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Role permissions check: ONLY 'cajero' and 'administrador' can confirm payments
  const isRoleAuthorized = currentUser.role === 'cajero' || currentUser.role === 'administrador';

  // Calculate cash from bill counters + manual direct input
  const billsTotal = (billCounts[10000] * 10000) +
                     (billCounts[20000] * 20000) +
                     (billCounts[50000] * 50000) +
                     (billCounts[100000] * 100000);

  const parsedManualInput = manualCashInput.trim() !== '' ? Math.max(parseInt(manualCashInput.replace(/\D/g, ''), 10) || 0, 0) : 0;
  
  // Total cash received
  const cashReceived = billsTotal + parsedManualInput;

  // Calculation formulas:
  // vuelto = efectivo recibido - total de la cuenta
  const rawChange = cashReceived - totalDue;
  const changeToGive = Math.max(rawChange, 0);
  const cashDeficit = Math.max(totalDue - cashReceived, 0);

  // Validation according to selected method
  const isOrderEmptyOrInvalid = totalDue <= 0 || items.length === 0;
  const isOrderAlreadyPaidOrCancelled = order ? (order.status === 'pagada' || order.status === 'cancelada') : false;

  let canConfirm = false;
  if (isRoleAuthorized && !isOrderEmptyOrInvalid && !isOrderAlreadyPaidOrCancelled && !isProcessing) {
    if (selectedMethod === 'efectivo') {
      canConfirm = cashReceived >= totalDue;
    } else if (selectedMethod === 'transferencia') {
      canConfirm = transferVerified;
    } else if (selectedMethod === 'datafono') {
      canConfirm = datafonoVerified;
    }
  }

  // Cash denomination handlers
  const handleAddBill = (denom: BillDenomination) => {
    setBillCounts(prev => ({
      ...prev,
      [denom]: prev[denom] + 1,
    }));
  };

  const handleSubtractBill = (denom: BillDenomination) => {
    setBillCounts(prev => ({
      ...prev,
      [denom]: Math.max(prev[denom] - 1, 0),
    }));
  };

  const handleExactCash = () => {
    // Fill exact cash using greedy denomination calculation
    let remainder = totalDue;
    const count100k = Math.floor(remainder / 100000);
    remainder %= 100000;
    const count50k = Math.floor(remainder / 50000);
    remainder %= 50000;
    const count20k = Math.floor(remainder / 20000);
    remainder %= 20000;
    const count10k = Math.floor(remainder / 10000);
    remainder %= 10000;

    setBillCounts({
      100000: count100k,
      50000: count50k,
      20000: count20k,
      10000: count10k,
    });
    setManualCashInput(remainder > 0 ? remainder.toString() : '');
  };

  // "Limpiar" button only resets the entered cash in the modal, NOT comanda or orders
  const handleClearCashOnly = () => {
    setBillCounts({
      10000: 0,
      20000: 0,
      50000: 0,
      100000: 0,
    });
    setManualCashInput('');
  };

  // Handle final payment submission
  const handleConfirmPayment = () => {
    if (!canConfirm || isProcessing) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);

      // 1. Resolve or create order
      let targetOrder = order;
      if (!targetOrder && draftData) {
        targetOrder = createOrder(draftData.tableNumber, draftData.items, draftData.customerNote);
      }

      if (!targetOrder) {
        throw new Error('No se pudo identificar la comanda a cobrar.');
      }

      // 2. Prepare payment record methods
      const methods: PaymentRecord['methods'] = [];
      let finalReceivedCash = 0;
      let finalChangeGiven = 0;

      if (selectedMethod === 'efectivo') {
        finalReceivedCash = cashReceived;
        finalChangeGiven = changeToGive;
        methods.push({
          method: 'efectivo',
          amount: totalDue,
          verified: true,
        });
      } else if (selectedMethod === 'transferencia') {
        finalReceivedCash = 0;
        finalChangeGiven = 0;
        methods.push({
          method: 'transferencia',
          amount: totalDue,
          reference: `${transferPlatform}: ${transferReference || 'S/N'}`,
          verified: true,
        });
      } else if (selectedMethod === 'datafono') {
        finalReceivedCash = 0;
        finalChangeGiven = 0;
        methods.push({
          method: 'datafono',
          amount: totalDue,
          reference: `${cardNetwork} - Voucher: ${datafonoVoucher || 'S/N'}`,
          verified: true,
        });
      }

      const paymentRecord: PaymentRecord = {
        id: `pay-${Date.now()}`,
        totalDue,
        receivedCash: finalReceivedCash,
        cashDenominations: { ...billCounts },
        changeGiven: finalChangeGiven,
        remainingBalance: 0,
        methods,
        cashierId: currentUser.id,
        cashierName: currentUser.fullName,
        paidAt: new Date().toISOString(),
      };

      // 3. Complete payment in system
      completePayment(targetOrder.id, paymentRecord);

      // 4. Save state for receipt display
      const updatedOrder: Order = {
        ...targetOrder,
        status: 'pagada',
        payment: paymentRecord,
      };

      setCompletedPaymentOrder(updatedOrder);
      setCompletedRecord(paymentRecord);
      setIsProcessing(false);

      if (onPaymentSuccess) {
        onPaymentSuccess(updatedOrder);
      }
    } catch (err: unknown) {
      console.error('Error al procesar cobro:', err);
      setIsProcessing(false);
      setErrorMessage(err instanceof Error ? err.message : 'Error inesperado al procesar el cobro.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#010102] border border-[#4B3438] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl text-[#F4F1F1] flex flex-col max-h-[92vh]">
        
        {/* =====================================================================
            MODAL HEADER: Brand Identity & Active Order Reference
           ===================================================================== */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#4B3438] bg-[#200607] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#000100] border border-[#4B3438] flex items-center justify-center p-0.5 shadow-inner overflow-hidden">
              <img 
                src="/assets/aistudio/FullLogo_dd4cd38a.jpg" 
                alt="90 Grados Gastro Bar" 
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[#C53747]/20 text-[#C53747] border border-[#C53747]/40">
                  90 Grados POS
                </span>
                <span className="text-xs text-[#C4C0C5] font-mono">
                  {order ? `Orden #${order.orderNumber}` : 'Comanda en Proceso'}
                </span>
              </div>
              <h2 className="text-lg font-black text-white tracking-tight">
                Módulo de Cobro — {referenceName}
              </h2>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-[#C4C0C5] hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar modal de cobro (conserva la comanda)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* =====================================================================
            MODAL BODY: Responsive Content
           ===================================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-[#C53747]/20 border border-[#C53747] text-[#F4F1F1] flex items-center gap-3 text-xs">
              <AlertTriangle className="w-5 h-5 text-[#C53747] shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Security / Role Restriction Banner */}
          {!isRoleAuthorized && (
            <div className="p-4 rounded-xl bg-[#200607] border border-[#C53747]/80 text-[#F4F1F1] space-y-2">
              <div className="flex items-center gap-2 text-[#C53747] font-bold text-xs uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Acceso Restringido — Rol No Autorizado</span>
              </div>
              <p className="text-xs text-[#C4C0C5] leading-relaxed">
                Tu usuario actual (<span className="text-white font-semibold">@{currentUser.username}</span>, rol <span className="text-white font-mono uppercase">{currentUser.role}</span>) no tiene permisos de cajero para confirmar ni registrar transacciones de pago.
              </p>
              <p className="text-[11px] text-[#666992] border-t border-[#4B3438] pt-2">
                Nota técnica: La interfaz bloquea la confirmación. En producción, la seguridad debe ser respaldada por autorización en el backend.
              </p>
            </div>
          )}

          {/* Invalid or Empty Order Warning */}
          {isOrderEmptyOrInvalid && (
            <div className="p-3.5 rounded-xl bg-[#200607] border border-[#4B3438] text-[#C4C0C5] text-xs text-center">
              No es posible cobrar una cuenta vacía o sin productos. Agrega ítems a la comanda antes de continuar.
            </div>
          )}

          {/* Already Paid / Cancelled Warning */}
          {isOrderAlreadyPaidOrCancelled && (
            <div className="p-3.5 rounded-xl bg-[#200607] border border-[#C53747] text-[#C53747] text-xs text-center font-bold">
              Esta orden ya se encuentra registrada como {order?.status.toUpperCase()}. No se permiten cobros duplicados.
            </div>
          )}

          {!completedPaymentOrder ? (
            <>
              {/* Reference & Item Breakdown (Scrollable if long) */}
              <div className="p-3.5 rounded-xl bg-[#200607] border border-[#4B3438] space-y-2">
                <div className="flex items-center justify-between text-xs border-b border-[#4B3438] pb-2">
                  <span className="font-bold text-[#C4C0C5] uppercase tracking-wider font-mono">
                    Detalle de Cuenta ({items.length} {items.length === 1 ? 'producto' : 'productos'})
                  </span>
                  <span className="text-xs text-[#666992] font-semibold">
                    Cajero(a): @{currentUser.username}
                  </span>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-xs">
                  {items.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between py-0.5">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono font-bold text-[#C53747]">{it.quantity}x</span>
                        <span className="truncate text-white">{it.productName}</span>
                      </div>
                      <span className="font-mono text-[#F4F1F1] shrink-0 tabular-nums">
                        {formatCOP(it.price * it.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#4B3438]">
                  <span className="text-xs uppercase font-black text-[#C4C0C5] tracking-wider">
                    TOTAL DE LA CUENTA:
                  </span>
                  <span className="text-2xl font-black text-white font-mono tabular-nums">
                    {formatCOP(totalDue)}
                  </span>
                </div>
              </div>

              {/* =====================================================================
                  PAYMENT METHODS: 3 Visible and Differentiated Options
                 ===================================================================== */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-[#C4C0C5] uppercase tracking-wider block font-mono">
                  Método de Pago:
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {/* 1. Efectivo */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('efectivo')}
                    className={`py-3 px-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      selectedMethod === 'efectivo'
                        ? 'bg-[#C53747] text-white border-white/40 shadow-lg'
                        : 'bg-[#200607] text-[#C4C0C5] border-[#4B3438] hover:border-[#666992] hover:text-white'
                    }`}
                  >
                    <Banknote className="w-5 h-5" />
                    <span className="text-xs font-bold">1. Efectivo</span>
                  </button>

                  {/* 2. Transferencia */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('transferencia')}
                    className={`py-3 px-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      selectedMethod === 'transferencia'
                        ? 'bg-[#C53747] text-white border-white/40 shadow-lg'
                        : 'bg-[#200607] text-[#C4C0C5] border-[#4B3438] hover:border-[#666992] hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-5 h-5" />
                    <span className="text-xs font-bold">2. Transferencia</span>
                  </button>

                  {/* 3. Datáfono */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('datafono')}
                    className={`py-3 px-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      selectedMethod === 'datafono'
                        ? 'bg-[#C53747] text-white border-white/40 shadow-lg'
                        : 'bg-[#200607] text-[#C4C0C5] border-[#4B3438] hover:border-[#666992] hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span className="text-xs font-bold">3. Datáfono</span>
                  </button>
                </div>
              </div>

              {/* =====================================================================
                  METHOD 1: EFECTIVO COP CALCULATION & QUICK BILL SELECTION
                 ===================================================================== */}
              {selectedMethod === 'efectivo' && (
                <div className="space-y-4 animate-in fade-in">
                  
                  {/* Bill Selection Controls */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#F4F1F1] flex items-center gap-1.5 uppercase font-mono">
                        <Banknote className="w-4 h-4 text-[#C53747]" /> Billetes en Efectivo COP
                      </span>
                      
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleExactCash}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-[#200607] border border-[#666992] text-white font-bold hover:bg-[#666992]/30 transition-colors cursor-pointer"
                        >
                          Pagar Exacto
                        </button>
                        <button
                          type="button"
                          onClick={handleClearCashOnly}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-[#010102] border border-[#4B3438] text-[#C4C0C5] hover:text-white hover:border-[#C53747] transition-colors cursor-pointer flex items-center gap-1"
                          title="Reinicia solo el efectivo digitado en el modal"
                        >
                          <RotateCcw className="w-3 h-3" /> Limpiar
                        </button>
                      </div>
                    </div>

                    {/* 4 Bill Denominations: $10.000, $20.000, $50.000, $100.000 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {([10000, 20000, 50000, 100000] as BillDenomination[]).map(denom => {
                        const count = billCounts[denom];
                        return (
                          <div
                            key={denom}
                            className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
                              count > 0 
                                ? 'bg-[#200607] border-[#C53747]' 
                                : 'bg-[#010102] border-[#4B3438]'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleAddBill(denom)}
                              className="text-left cursor-pointer group"
                              title={`Toca para sumar un billete de ${formatCOP(denom)}`}
                            >
                              <div className="text-[10px] text-[#C4C0C5] uppercase font-bold group-hover:text-white">
                                Billete
                              </div>
                              <div className="text-sm font-black text-white font-mono mt-0.5">
                                {formatCOP(denom)}
                              </div>
                            </button>

                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#4B3438]">
                              <button
                                type="button"
                                onClick={() => handleSubtractBill(denom)}
                                disabled={count === 0}
                                className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs transition-colors ${
                                  count > 0 
                                    ? 'bg-[#200607] text-[#C4C0C5] hover:text-white border border-[#4B3438] cursor-pointer' 
                                    : 'opacity-30 cursor-not-allowed'
                                }`}
                              >
                                <Minus className="w-3 h-3" />
                              </button>

                              <span className={`text-xs font-mono font-bold ${count > 0 ? 'text-white' : 'text-[#666992]'}`}>
                                {count}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleAddBill(denom)}
                                className="w-6 h-6 rounded-lg bg-[#C53747] text-white hover:bg-[#d84354] flex items-center justify-center text-xs cursor-pointer shadow-sm"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Manual Entry for Exact Digits or Corrections */}
                  <div className="p-3 rounded-xl bg-[#200607] border border-[#4B3438] flex items-center justify-between gap-3 text-xs">
                    <span className="text-[#C4C0C5] font-medium shrink-0">
                      Entrada numérica manual (ajuste libre):
                    </span>
                    <div className="flex items-center gap-2 max-w-[200px]">
                      <span className="text-[#666992] font-mono">$</span>
                      <input
                        type="text"
                        value={manualCashInput}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setManualCashInput(val);
                        }}
                        placeholder="0"
                        className="w-full px-3 py-1.5 bg-[#010102] border border-[#4B3438] rounded-lg text-right font-mono text-sm font-bold text-white focus:outline-none focus:border-[#C53747]"
                      />
                    </div>
                  </div>

                  {/* Cash Summary Banner & Automatic Change Calculation */}
                  <div className="p-4 rounded-xl bg-[#200607] border border-[#4B3438] space-y-2.5 font-mono">
                    <div className="flex justify-between items-center text-xs text-[#C4C0C5]">
                      <span>Efectivo Total Recibido:</span>
                      <span className="text-lg font-black text-white tabular-nums">
                        {formatCOP(cashReceived)}
                      </span>
                    </div>

                    <div className="border-t border-[#4B3438] pt-2">
                      {/* Vuelto Calculation States */}
                      {cashReceived < totalDue ? (
                        <div className="flex justify-between items-center bg-rose-950/40 p-2.5 rounded-lg border border-rose-900/60 text-rose-300">
                          <span className="text-xs font-bold">Faltante por recibir:</span>
                          <span className="text-base font-black tabular-nums">
                            {formatCOP(cashDeficit)}
                          </span>
                        </div>
                      ) : cashReceived === totalDue ? (
                        <div className="flex justify-between items-center bg-emerald-950/50 p-2.5 rounded-lg border border-emerald-800/60 text-emerald-300">
                          <span className="text-xs font-bold">Pago exacto:</span>
                          <span className="text-sm font-black">
                            Vuelto $0 COP
                          </span>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center bg-emerald-950/70 p-3 rounded-lg border border-emerald-600/70 text-emerald-300 shadow-md">
                          <span className="text-xs font-black uppercase tracking-wider text-emerald-200">
                            VUELTO A ENTREGAR:
                          </span>
                          <span className="text-xl font-black text-emerald-300 tabular-nums">
                            {formatCOP(changeToGive)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* =====================================================================
                  METHOD 2: TRANSFERENCIA BANCARIA (VERIFICACIÓN EXPLICITA)
                 ===================================================================== */}
              {selectedMethod === 'transferencia' && (
                <div className="p-4 rounded-xl bg-[#200607] border border-[#4B3438] space-y-4 animate-in fade-in">
                  <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider font-mono">
                    <Smartphone className="w-4 h-4 text-[#666992]" /> Verificación de Transferencia Electrónica
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[#C4C0C5] block mb-1">Plataforma / Banco:</label>
                      <select
                        value={transferPlatform}
                        onChange={(e) => setTransferPlatform(e.target.value)}
                        className="w-full px-3 py-2 bg-[#010102] border border-[#4B3438] rounded-lg text-white font-semibold focus:outline-none focus:border-[#C53747]"
                      >
                        <option value="Nequi">Nequi</option>
                        <option value="Daviplata">Daviplata</option>
                        <option value="Bancolombia QR">Bancolombia QR</option>
                        <option value="Transfiya">Transfiya</option>
                        <option value="Otra Cuenta">Otra Cuenta Corriente/Ahorros</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[#C4C0C5] block mb-1">Referencia / Comprobante #:</label>
                      <input
                        type="text"
                        value={transferReference}
                        onChange={(e) => setTransferReference(e.target.value)}
                        placeholder="Ej. M123894"
                        className="w-full px-3 py-2 bg-[#010102] border border-[#4B3438] rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[#C53747]"
                      />
                    </div>
                  </div>

                  {/* Explicit Cashier Checkbox */}
                  <div className="p-3 rounded-lg bg-[#010102] border border-[#4B3438] space-y-2">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={transferVerified}
                        onChange={(e) => setTransferVerified(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-[#C53747] border-[#4B3438] focus:ring-0 focus:outline-none cursor-pointer"
                      />
                      <span className="text-xs text-[#F4F1F1] leading-snug">
                        <strong className="text-white">Confirmo explícitamente:</strong> He verificado en el dispositivo o aplicación bancaria la acreditación exacta de <strong className="text-[#C53747] font-mono">{formatCOP(totalDue)}</strong>.
                      </span>
                    </label>

                    <p className="text-[11px] text-[#C4C0C5] pl-6.5">
                      ⚠️ La selección de este método no implica verificación bancaria automática. El cajero es responsable de constatar el comprobante.
                    </p>
                  </div>
                </div>
              )}

              {/* =====================================================================
                  METHOD 3: DATÁFONO / TARJETA (VERIFICACIÓN EXPLICITA DE VOUCHER)
                 ===================================================================== */}
              {selectedMethod === 'datafono' && (
                <div className="p-4 rounded-xl bg-[#200607] border border-[#4B3438] space-y-4 animate-in fade-in">
                  <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider font-mono">
                    <CreditCard className="w-4 h-4 text-[#666992]" /> Verificación de Pago por Datáfono
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[#C4C0C5] block mb-1">Tipo de Tarjeta:</label>
                      <select
                        value={cardNetwork}
                        onChange={(e) => setCardNetwork(e.target.value)}
                        className="w-full px-3 py-2 bg-[#010102] border border-[#4B3438] rounded-lg text-white font-semibold focus:outline-none focus:border-[#C53747]"
                      >
                        <option value="Débito Maestro/Visa">Tarjeta Débito</option>
                        <option value="Crédito Visa/Mastercard">Tarjeta Crédito</option>
                        <option value="Contactless / Billetera">Contactless / Apple Pay</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[#C4C0C5] block mb-1">Nº Aprobación / Voucher:</label>
                      <input
                        type="text"
                        value={datafonoVoucher}
                        onChange={(e) => setDatafonoVoucher(e.target.value)}
                        placeholder="Ej. APR-9981"
                        className="w-full px-3 py-2 bg-[#010102] border border-[#4B3438] rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[#C53747]"
                      />
                    </div>
                  </div>

                  {/* Explicit Cashier Checkbox */}
                  <div className="p-3 rounded-lg bg-[#010102] border border-[#4B3438] space-y-2">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={datafonoVerified}
                        onChange={(e) => setDatafonoVerified(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-[#C53747] border-[#4B3438] focus:ring-0 focus:outline-none cursor-pointer"
                      />
                      <span className="text-xs text-[#F4F1F1] leading-snug">
                        <strong className="text-white">Confirmo explícitamente:</strong> El datáfono físico imprimió el comprobante de aprobación por el total de <strong className="text-[#C53747] font-mono">{formatCOP(totalDue)}</strong>.
                      </span>
                    </label>

                    <p className="text-[11px] text-[#C4C0C5] pl-6.5">
                      ⚠️ El sistema no tiene pasarela bancaria automatizada directa. El cajero debe constatar el voucher físico emitido por la terminal.
                    </p>
                  </div>
                </div>
              )}

              {/* =====================================================================
                  ACTION BAR: CONFIRM BUTTON & CANCEL
                 ===================================================================== */}
              <div className="flex items-center justify-between pt-3 border-t border-[#4B3438]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#C4C0C5] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Volver / Cancelar
                </button>

                <button
                  type="button"
                  disabled={!canConfirm || isProcessing}
                  onClick={handleConfirmPayment}
                  className={`px-6 py-3 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all shadow-xl cursor-pointer ${
                    canConfirm && !isProcessing
                      ? 'bg-[#C53747] hover:bg-[#d84354] text-white active:scale-98 shadow-md border border-white/20'
                      : 'bg-[#200607] text-[#666992] border border-[#4B3438] cursor-not-allowed opacity-60'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Procesando pago...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {selectedMethod === 'efectivo' && cashReceived < totalDue
                          ? `Falta Dinero (${formatCOP(cashDeficit)})`
                          : `Confirmar Pago (${formatCOP(totalDue)})`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* =====================================================================
                POST-PAYMENT CONFIRMATION & THERMAL RECEIPT VIEW
               ===================================================================== */
            <div className="p-4 sm:p-6 space-y-6 text-center animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-xl">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-black text-white">¡Cobro Registrado con Éxito!</h3>
                <p className="text-xs text-[#C4C0C5] mt-1">
                  Transacción registrada en caja y libro mayor · {config.businessName}
                </p>
              </div>

              {/* Printable Ticket Preview */}
              {completedRecord && (
                <div className="p-4 rounded-xl bg-[#200607] border border-[#4B3438] text-left font-mono text-xs space-y-2 max-w-sm mx-auto shadow-inner text-[#F4F1F1]">
                  <div className="text-center pb-2 border-b border-[#4B3438]">
                    <p className="font-bold text-white text-sm">{config.businessName}</p>
                    <p className="text-[11px] text-[#C4C0C5]">NIT: {config.nit}</p>
                    <p className="text-[11px] text-[#C4C0C5]">{config.municipality} · Tel: {config.phone}</p>
                  </div>

                  <div className="flex justify-between text-[#C4C0C5]">
                    <span>Orden #{completedPaymentOrder.orderNumber}</span>
                    <span>{completedPaymentOrder.tableNumber}</span>
                  </div>
                  <div className="flex justify-between text-[#C4C0C5]">
                    <span>Fecha:</span>
                    <span>{formatDateTimeBogota(completedRecord.paidAt)}</span>
                  </div>
                  <div className="flex justify-between text-[#C4C0C5]">
                    <span>Cajero(a):</span>
                    <span>@{currentUser.username}</span>
                  </div>

                  <div className="border-t border-[#4B3438] pt-2 space-y-1">
                    {completedPaymentOrder.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="truncate max-w-[180px]">{it.quantity}x {it.productName}</span>
                        <span>{formatCOP(it.price * it.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-[#4B3438] pt-2 space-y-1">
                    <div className="flex justify-between text-white font-bold">
                      <span>TOTAL COBRADO:</span>
                      <span>{formatCOP(completedRecord.totalDue)}</span>
                    </div>

                    {completedRecord.receivedCash > 0 && (
                      <div className="flex justify-between text-[#C4C0C5]">
                        <span>Efectivo Recibido:</span>
                        <span>{formatCOP(completedRecord.receivedCash)}</span>
                      </div>
                    )}

                    {completedRecord.changeGiven > 0 && (
                      <div className="flex justify-between text-emerald-400 font-bold">
                        <span>VUELTO ENTREGADO:</span>
                        <span>{formatCOP(completedRecord.changeGiven)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-[#666992] pt-1">
                      <span>Método:</span>
                      <span className="capitalize">{completedRecord.methods[0]?.method || 'Efectivo'}</span>
                    </div>
                  </div>

                  <div className="text-center pt-3 text-[10px] text-[#C4C0C5] border-t border-[#4B3438]">
                    ¡Gracias por su visita a 90 Grados!
                  </div>
                </div>
              )}

              {/* Receipt Action Buttons */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (completedPaymentOrder && completedRecord) {
                      printCustomerReceipt80mm(completedPaymentOrder, completedRecord, config);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#200607] hover:bg-[#2b0b0d] text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md border border-[#4B3438]"
                >
                  <Printer className="w-4 h-4 text-[#C53747]" />
                  <span>Imprimir Ticket (80mm)</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-[#C53747] hover:bg-[#d84354] text-white text-xs font-bold cursor-pointer border border-white/20 shadow-md"
                >
                  Finalizar y Cerrar
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
