import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Product, ProductCategory, OrderItem, Order, PaymentRecord } from '../types';
import { formatCOP, formatDateTimeBogota } from '../utils/format';
import { printCustomerReceipt80mm } from '../utils/thermalPrinter';
import { DailySalesChart } from './DailySalesChart';
import { CashPaymentModal } from './CashPaymentModal';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  UtensilsCrossed, 
  Wine, 
  CreditCard, 
  Send, 
  Clock, 
  Check, 
  AlertCircle, 
  Sparkles, 
  Layers, 
  ChevronRight, 
  ChevronLeft, 
  Receipt, 
  BookOpen, 
  Banknote, 
  Zap, 
  RotateCcw, 
  Printer, 
  Smartphone, 
  CheckCircle2, 
  Users, 
  Store,
  BarChart3,
  X,
  MoreVertical
} from 'lucide-react';
import { getProductImageUrl } from '../utils/productImages';

const CATEGORIES: ProductCategory[] = [
  'Comidas Rápidas',
  'Picadas',
  'Carnes',
  'Platos en Salsa',
  'Pescados',
  'Aves',
  'Desayunos',
  'Jugos Naturales',
  'Cervezas',
  'Licores',
  'Bebidas Frías'
];

const TABLES = [
  'Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4', 'Mesa 5', 'Mesa 6',
  'Terraza 1', 'Terraza 2', 'Terraza 3',
  'Barra 1', 'Barra 2', 'Barra 3',
  'Para Llevar / Domicilio'
];

type BillDenomination = 10000 | 20000 | 50000 | 100000;

export const POSTerminal: React.FC = () => {
  const { 
    currentUser, 
    products, 
    orders, 
    createOrder, 
    completePayment,
    currentShift,
    config
  } = useApp();

  // Mode: 'mesas' (Traditional Table / Comanda Service) vs 'venta_rapida' (Counter / Express Sale)
  const [saleMode, setSaleMode] = useState<'mesas' | 'venta_rapida'>('mesas');
  
  // Right panel view: 'ticket' (Comanda & Items) vs 'cobro' (Direct Cash & Card Checkout)
  const [rightPanelTab, setRightPanelTab] = useState<'ticket' | 'cobro'>('ticket');

  // Mobile layout switcher: 'catalog' (dishes list) vs 'panel' (ticket & cashier dock)
  const [mobileView, setMobileView] = useState<'catalog' | 'panel'>('catalog');

  // Modal state for Recharts daily sales chart
  const [isSalesChartModalOpen, setIsSalesChartModalOpen] = useState(false);

  // Overlay Modal state for Payment & Cobro
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [modalTargetOrder, setModalTargetOrder] = useState<Order | null>(null);

  // Quick sale counter for unique table designation
  const [quickSaleIndex, setQuickSaleIndex] = useState(1);

  // Selected table
  const [selectedTable, setSelectedTable] = useState<string>('Mesa 1');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'Todas' | 'Rapidos'>('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Ticket items currently being composed
  const [ticketItems, setTicketItems] = useState<OrderItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');

  // Selected open order to charge (if charging an existing table order)
  const [orderToChargeId, setOrderToChargeId] = useState<string | null>(null);

  // Cash calculation state inside the separated right payment panel
  const [billCounts, setBillCounts] = useState<Record<BillDenomination, number>>({
    10000: 0,
    20000: 0,
    50000: 0,
    100000: 0,
  });
  const [splitMethod, setSplitMethod] = useState<'ninguno' | 'nequi' | 'daviplata' | 'tarjeta'>('ninguno');
  const [splitElectronicAmount, setSplitElectronicAmount] = useState<number>(0);
  const [completedPayment, setCompletedPayment] = useState<{ order: Order; payment: PaymentRecord } | null>(null);

  // Reference for horizontal scrolling of the categories submenu
  const categoriesScrollRef = useRef<HTMLDivElement>(null);

  // Active open orders
  const openOrders = orders.filter(o => o.status === 'abierta');

  // Find order being charged if an existing order was picked
  const existingOrderToCharge = orderToChargeId 
    ? orders.find(o => o.id === orderToChargeId) || null 
    : null;

  // Filter products (Keep unavailable products so they show as Agotado in the catalog)
  const filteredProducts = products.filter(p => {
    // Turn restrictions (Bar shift vs Restaurant)
    if (currentShift?.center === 'Bar Nocturno' && p.allowedShifts === 'matutino') {
      return false;
    }
    if (selectedCategory === 'Rapidos') {
      // Fast high-rotation items: Beers, Fast Food, Cold Drinks
      return ['Cervezas', 'Bebidas Frías', 'Comidas Rápidas', 'Jugos Naturales'].includes(p.category);
    }
    const matchesCat = selectedCategory === 'Todas' || p.category === selectedCategory;
    const matchesQuery = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesQuery;
  });

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoriesScrollRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      categoriesScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const addToTicket = (product: Product) => {
    if (!product.available) {
      return; // Block adding unavailable/agotado items
    }
    setTicketItems(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          price: product.price,
          quantity: 1,
          station: product.station,
        }
      ];
    });
  };

  const updateQuantity = (index: number, delta: number) => {
    setTicketItems(prev => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      }
      updated[index] = { ...updated[index], quantity: newQty };
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setTicketItems(prev => prev.filter((_, i) => i !== index));
  };

  const addModifierToItem = (index: number, modifier: string) => {
    setTicketItems(prev => {
      const updated = [...prev];
      const current = updated[index].notes || '';
      updated[index].notes = current ? `${current}, ${modifier}` : modifier;
      return updated;
    });
  };

  const resetBills = () => {
    setBillCounts({ 10000: 0, 20000: 0, 50000: 0, 100000: 0 });
    setSplitMethod('ninguno');
    setSplitElectronicAmount(0);
  };

  const ticketTotal = ticketItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Determine current active total for payment panel
  const totalDue = existingOrderToCharge ? existingOrderToCharge.totalAmount : ticketTotal;

  // Bill arithmetic
  const cashReceived = (billCounts[10000] * 10000) +
                       (billCounts[20000] * 20000) +
                       (billCounts[50000] * 50000) +
                       (billCounts[100000] * 100000);

  const pendingForCash = Math.max(totalDue - splitElectronicAmount, 0);
  const changeToGive = Math.max(cashReceived - pendingForCash, 0);
  const cashStillPending = Math.max(pendingForCash - cashReceived, 0);

  const canConfirmPayment = totalDue > 0 && cashStillPending === 0 && (cashReceived + splitElectronicAmount >= totalDue);

  const handleSendOrderToKDS = async () => {
    if (ticketItems.length === 0) return;
    const destination = saleMode === 'venta_rapida' ? `Venta Rápida #${quickSaleIndex}` : selectedTable;
    await createOrder(destination, ticketItems, orderNotes);
    setTicketItems([]);
    setOrderNotes('');
    if (saleMode === 'venta_rapida') {
      setQuickSaleIndex(prev => prev + 1);
    }
  };

  // Immediate 1-click Express Cash Payment for Venta Rápida
  const handleQuickSaleExactCash = async () => {
    if (ticketItems.length === 0) return;
    const destination = `Venta Rápida #${quickSaleIndex}`;
    const newOrder = await createOrder(destination, ticketItems, orderNotes || 'Venta Rápida Mostrador');
    
    const paymentRecord: PaymentRecord = {
      id: `pay-${Date.now()}`,
      totalDue: newOrder.totalAmount,
      receivedCash: newOrder.totalAmount,
      cashDenominations: { 10000: 0, 20000: 0, 50000: 0, 100000: 0 },
      changeGiven: 0,
      remainingBalance: 0,
      methods: [{ method: 'efectivo', amount: newOrder.totalAmount }],
      cashierId: currentUser.id,
      cashierName: currentUser.fullName,
      paidAt: new Date().toISOString(),
    };

    completePayment(newOrder.id, paymentRecord);
    setCompletedPayment({ order: { ...newOrder, status: 'pagada' }, payment: paymentRecord });
    setTicketItems([]);
    setOrderNotes('');
    setQuickSaleIndex(prev => prev + 1);
    resetBills();
    setRightPanelTab('cobro');
  };

  const handleCompleteCurrentPayment = async () => {
    if (!canConfirmPayment) return;

    let targetOrder: Order;
    const destination = saleMode === 'venta_rapida' ? `Venta Rápida #${quickSaleIndex}` : selectedTable;

    if (existingOrderToCharge) {
      targetOrder = existingOrderToCharge;
    } else {
      if (ticketItems.length === 0) return;
      targetOrder = await createOrder(destination, ticketItems, orderNotes || 'Cobro directo en caja');
      setTicketItems([]);
      setOrderNotes('');
      if (saleMode === 'venta_rapida') {
        setQuickSaleIndex(prev => prev + 1);
      }
    }

    const methods: PaymentRecord['methods'] = [];
    if (cashReceived > 0) {
      methods.push({ method: 'efectivo', amount: Math.min(cashReceived, pendingForCash) });
    }
    if (splitMethod !== 'ninguno' && splitElectronicAmount > 0) {
      methods.push({ method: splitMethod, amount: splitElectronicAmount });
    }

    const paymentRecord: PaymentRecord = {
      id: `pay-${Date.now()}`,
      totalDue,
      receivedCash: cashReceived,
      cashDenominations: { ...billCounts },
      changeGiven: changeToGive,
      remainingBalance: cashStillPending,
      methods,
      cashierId: currentUser.id,
      cashierName: currentUser.fullName,
      paidAt: new Date().toISOString(),
    };

    completePayment(targetOrder.id, paymentRecord);
    setCompletedPayment({ order: { ...targetOrder, status: 'pagada' }, payment: paymentRecord });
    setOrderToChargeId(null);
    resetBills();
  };

  const handleSetExactCashBills = () => {
    // Fill bills using highest denominations first for the total
    let remaining = pendingForCash;
    const newCounts: Record<BillDenomination, number> = { 10000: 0, 20000: 0, 50000: 0, 100000: 0 };
    
    // Nearest clean multiple of 10,000 COP
    const target = Math.ceil(remaining / 10000) * 10000;
    let temp = target;

    while (temp >= 100000) {
      newCounts[100000]++;
      temp -= 100000;
    }
    while (temp >= 50000) {
      newCounts[50000]++;
      temp -= 50000;
    }
    while (temp >= 20000) {
      newCounts[20000]++;
      temp -= 20000;
    }
    while (temp >= 10000) {
      newCounts[10000]++;
      temp -= 10000;
    }

    setBillCounts(newCounts);
  };

  const handlePrint80mm = () => {
    if (completedPayment) {
      printCustomerReceipt80mm(completedPayment.order, completedPayment.payment, config);
    }
  };

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row h-full overflow-hidden bg-[#000100] text-[#F4F1F1] relative">
      
      {/* =========================================================================
          LEFT / CENTER: Product Catalog, Mode Header & Scrollable Category Sub-menu
         ========================================================================= */}
      <div className={`flex-1 min-h-0 flex flex-col min-w-0 bg-[#000100] overflow-hidden ${mobileView === 'panel' ? 'hidden lg:flex' : 'flex'}`}>
        
        {/* Top Control Bar: Mode Toggle (Mesas vs Venta Rápida), Table Selector, Sales Chart & Cashier */}
        <div className="p-3 bg-[#010102] border-b border-[#4B3438] flex flex-wrap items-center justify-between gap-3 shrink-0 z-20 shadow-sm">
          
          {/* Venta Rápida vs Mesas Mode Selector */}
          <div className="flex items-center gap-1 p-1 bg-[#000100] border border-[#4B3438] rounded-xl shrink-0">
            <button
              onClick={() => {
                setSaleMode('mesas');
                setSelectedTable('Mesa 1');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                saleMode === 'mesas'
                  ? 'bg-[#200607] border border-[#C53747] text-white shadow-sm font-extrabold'
                  : 'text-[#C4C0C5] hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-[#C53747]" />
              <span>Mesas / Salón</span>
            </button>

            <button
              onClick={() => {
                setSaleMode('venta_rapida');
                setSelectedTable(`Venta Rápida #${quickSaleIndex}`);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                saleMode === 'venta_rapida'
                  ? 'bg-[#200607] border border-[#C53747] text-white shadow-sm font-extrabold ring-1 ring-[#C53747]/40'
                  : 'text-[#C4C0C5] hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-[#C53747] fill-current" />
              <span>⚡ Venta Rápida</span>
            </button>
          </div>

          {/* Destination / Table selection */}
          <div className="flex items-center gap-2 flex-wrap">
            {saleMode === 'mesas' ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#C4C0C5] whitespace-nowrap font-mono">
                  MESA:
                </span>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-[#000100] border border-[#4B3438] text-xs font-bold text-white focus:outline-none focus:border-[#C53747] cursor-pointer"
                >
                  {TABLES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#000100] border border-[#4B3438] text-[#F4F1F1] text-xs font-bold">
                <Store className="w-4 h-4 text-[#C53747]" />
                <span>Mostrador Directo</span>
                <span className="px-2 py-0.5 rounded bg-[#010102] text-[#F4F1F1] font-mono text-[11px] border border-[#4B3438]">
                  #VR-{quickSaleIndex}
                </span>
              </div>
            )}

            {/* Quick Recharts Daily Sales Button */}
            <button
              onClick={() => setIsSalesChartModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#000100] border border-[#4B3438] text-[#F4F1F1] hover:bg-[#200607] hover:border-[#666992] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Ver gráfico de ventas diarias"
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#666992]" />
              <span className="hidden sm:inline">Gráfica Ventas</span>
            </button>

            {/* Cashier badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#000100] border border-[#4B3438] text-xs text-[#C4C0C5]">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Cajero: <strong className="text-white font-mono">@{currentUser.username}</strong></span>
            </div>
          </div>
        </div>

        {/* Full-width Search Bar */}
        <div className="px-3 py-2 bg-[#010102] border-b border-[#4B3438]">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-[#666992] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar plato o bebida..."
              className="w-full pl-10 pr-4 py-2 bg-[#000100] border border-[#4B3438] rounded-xl text-xs text-white placeholder-[#666992] focus:outline-none focus:border-[#C53747] transition-colors"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* =====================================================================
            SUB-MENU DE CATEGORÍAS (STRICTLY PINNED TO PREVENT COVERING CARDS)
           ===================================================================== */}
        <div className="relative border-b border-[#4B3438] bg-[#010102] flex items-center px-2 py-2 shrink-0 z-10 shadow-sm">
          {/* Scroll Left Button */}
          <button
            onClick={() => scrollCategories('left')}
            className="p-1.5 text-[#C4C0C5] hover:text-white bg-[#000100] hover:bg-[#200607] border border-[#4B3438] rounded-lg shrink-0 transition-colors cursor-pointer mr-1.5"
            title="Desplazar submenú a la izquierda"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* The Scrollable Sub-menu Container */}
          <div 
            ref={categoriesScrollRef}
            className="flex-1 flex items-center gap-2 overflow-x-auto scroll-smooth py-0.5 px-1 no-scrollbar select-none"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#4B3438 #010102'
            }}
          >
            {/* Quick Fast-Sale items filter */}
            <button
              onClick={() => setSelectedCategory('Rapidos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                selectedCategory === 'Rapidos'
                  ? 'bg-[#200607] border border-[#C53747] text-white shadow-sm font-extrabold ring-1 ring-[#C53747]/40'
                  : 'bg-[#000100] border border-[#4B3438] text-[#C4C0C5] hover:text-white hover:border-[#666992]'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-[#C53747] fill-current" />
              <span>⚡ Rápidos & Bebidas ({products.filter(p => ['Cervezas', 'Bebidas Frías', 'Comidas Rápidas', 'Jugos Naturales'].includes(p.category)).length})</span>
            </button>

            {/* Dishes categories */}
            {CATEGORIES.map(cat => {
              const count = products.filter(p => p.category === cat).length;
              if (count === 0) return null;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-[#200607] border border-[#C53747] text-white font-bold shadow-sm'
                      : 'bg-[#000100] border border-[#4B3438] text-[#C4C0C5] hover:text-white hover:border-[#666992]'
                  }`}
                >
                  {cat === 'Cervezas' || cat === 'Licores' || cat === 'Jugos Naturales' ? (
                    <Wine className="w-3.5 h-3.5 text-[#666992]" />
                  ) : (
                    <UtensilsCrossed className="w-3.5 h-3.5 text-[#666992]" />
                  )}
                  <span>{cat}</span>
                  <span className="font-mono text-[10px] opacity-75">
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          <button
            onClick={() => scrollCategories('right')}
            className="p-1.5 text-[#C4C0C5] hover:text-white bg-[#000100] hover:bg-[#200607] border border-[#4B3438] rounded-lg shrink-0 transition-colors cursor-pointer ml-1.5"
            title="Desplazar submenú a la derecha"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* =====================================================================
            PRODUCT CARDS GRID WITH FOOD PHOTOGRAPHY & HIGH ACCESSIBILITY
           ===================================================================== */}
        <div className="flex-1 min-h-0 w-full overflow-y-auto overscroll-contain p-3 sm:p-4 focus:outline-none">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 content-start pb-4">
            {filteredProducts.map(product => {
              const isAvailable = product.available;
              const imageUrl = getProductImageUrl(product.sku, product.category, product.name);

              return (
                <div
                  key={product.id}
                  className={`rounded-xl overflow-hidden border transition-all duration-200 flex flex-col justify-between group shadow-sm ${
                    isAvailable 
                      ? 'bg-[#010102] border-[#4B3438] hover:border-[#666992] hover:bg-[#08080c]' 
                      : 'bg-[#010102]/60 border-red-950/40 opacity-50 select-none'
                  }`}
                >
                  {/* Product Image with Category / Station Badge & Strict Uniform Aspect Ratio */}
                  <div className="h-32 sm:h-36 w-full relative overflow-hidden bg-[#000100] shrink-0">
                    <img 
                      src={imageUrl} 
                      alt={product.name}
                      className={`w-full h-full object-cover transition-transform duration-300 ${
                        isAvailable ? 'group-hover:scale-105' : 'grayscale'
                      }`}
                      loading="lazy"
                    />
                    
                    {/* Top right station or Agotado badge */}
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      {!isAvailable ? (
                        <span className="text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider bg-red-950/95 text-red-200 border border-red-800 shadow">
                          Agotado
                        </span>
                      ) : (
                        <span className="text-[9px] px-2 py-0.5 rounded uppercase font-bold tracking-wider bg-[#000100]/85 text-[#F4F1F1] border border-[#4B3438] shadow backdrop-blur-sm">
                          {product.station}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Product Details (Full Title Legible, No Awkward Truncations) */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className={`text-xs sm:text-sm font-bold line-clamp-2 leading-snug transition-colors ${
                        isAvailable ? 'text-[#F4F1F1] group-hover:text-white' : 'text-stone-500 line-through'
                      }`}>
                        {product.name}
                      </h4>

                      <p className="text-[11px] text-[#C4C0C5] line-clamp-2 mt-1 leading-relaxed">
                        {product.description || product.category}
                      </p>
                    </div>

                    {/* Price and Touch-Optimized "+ Agregar" Button */}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#4B3438]/60">
                      <span className={`text-xs sm:text-sm font-bold font-mono tabular-nums ${isAvailable ? 'text-white' : 'text-stone-500'}`}>
                        {formatCOP(product.price)}
                      </span>

                      <button
                        onClick={() => {
                          if (!isAvailable) return;
                          addToTicket(product);
                        }}
                        disabled={!isAvailable}
                        title={!isAvailable ? `${product.name} está Agotado` : `Agregar ${product.name} a la comanda`}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm ${
                          isAvailable 
                            ? 'bg-[#000100] hover:bg-[#200607] text-[#F4F1F1] border border-[#4B3438] hover:border-[#C53747] active:scale-95 cursor-pointer' 
                            : 'bg-[#010102] text-stone-600 border border-[#4B3438]/30 cursor-not-allowed'
                        }`}
                      >
                        {isAvailable ? (
                          <>
                            <Plus className="w-3.5 h-3.5 text-[#C53747]" />
                            <span>Agregar</span>
                          </>
                        ) : (
                          <span>Agotado</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Open Accounts Quick Bar (Strictly Pinned) */}
        {saleMode === 'mesas' && openOrders.length > 0 && (
          <div className="p-2.5 bg-[#010102] border-t border-[#4B3438] flex items-center gap-2 overflow-x-auto text-xs shrink-0 z-10 shadow-sm">
            <span className="text-[#C4C0C5] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1.5 font-mono">
              <Clock className="w-3.5 h-3.5 text-[#666992]" /> CUENTAS ACTIVAS:
            </span>
            {openOrders.map(ord => (
              <button
                key={ord.id}
                onClick={() => {
                  setOrderToChargeId(ord.id);
                  setRightPanelTab('cobro');
                  resetBills();
                  setMobileView('panel');
                }}
                className={`px-3 py-1 rounded-lg border text-xs transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                  orderToChargeId === ord.id
                    ? 'bg-[#200607] border-[#C53747] text-white font-bold'
                    : 'bg-[#000100] border-[#4B3438] hover:border-[#666992] text-[#F4F1F1]'
                }`}
              >
                <span className="font-bold">{ord.tableNumber}</span>
                <span className="text-white font-mono tabular-nums">{formatCOP(ord.totalAmount)}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  Cobrar
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Mobile Quick Action Dock Bar to access Comanda/Cobro on narrow screens without page scroll */}
        <div className="lg:hidden p-2.5 bg-[#010102] border-t border-[#4B3438] flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#C4C0C5] font-bold">{saleMode === 'venta_rapida' ? 'Venta Rápida' : selectedTable}:</span>
            <span className="text-sm font-black text-white font-mono">{formatCOP(ticketTotal)}</span>
            <span className="text-[11px] text-[#C4C0C5] font-mono">({ticketItems.length} platos)</span>
          </div>
          <button
            onClick={() => setMobileView('panel')}
            className="py-1.5 px-3 rounded-xl bg-[#C53747] hover:bg-[#d84354] text-white font-black text-xs flex items-center gap-1.5 shadow cursor-pointer transition-transform active:scale-95 border border-white/20"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Ver Cobro / Comanda</span>
          </button>
        </div>

      </div>

      {/* =========================================================================
          RIGHT: PANEL DE COBRO Y COMANDA SEPARADO (SEPARATED WORKSTATION DOCK)
         ========================================================================= */}
      <div className={`w-full lg:w-[410px] xl:w-[450px] p-2.5 sm:p-3 shrink-0 h-full flex flex-col min-h-0 overflow-hidden bg-[#000100] ${mobileView === 'catalog' ? 'hidden lg:flex' : 'flex'}`}>
        
        <div className="bg-[#010102] border border-[#4B3438] rounded-2xl shadow-2xl flex flex-col h-full min-h-0 overflow-hidden">
          
          {/* Separated Panel Header */}
          <div className="p-3 border-b border-[#4B3438] bg-[#010102] shrink-0">
            
            {/* Mobile return button */}
            <div className="lg:hidden pb-2 mb-2 border-b border-[#4B3438] flex items-center justify-between">
              <button
                onClick={() => setMobileView('catalog')}
                className="text-xs font-bold text-[#C4C0C5] hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-[#666992]" />
                <span>← Volver al Catálogo</span>
              </button>
              <span className="text-[11px] text-[#666992] font-mono">{ticketItems.length} platos</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C53747] animate-pulse" />
                <h3 className="font-black text-white text-xs sm:text-sm uppercase tracking-wider font-mono">
                  PANEL DE COBRO & CAJA
                </h3>
              </div>

              {/* Active destination badge */}
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border border-[#4B3438] bg-[#200607] text-white">
                {saleMode === 'venta_rapida' ? (
                  <>
                    <Zap className="w-3 h-3 fill-current text-[#C53747]" />
                    VR #{quickSaleIndex}
                  </>
                ) : (
                  selectedTable
                )}
              </span>
            </div>
          </div>

          {/* Sub-tabs inside the Separated Panel: Comanda vs Cobro Directo */}
          <div className="flex items-center justify-between p-1.5 bg-[#010102] border-b border-[#4B3438] shrink-0">
            <div className="flex items-center gap-1.5 flex-1">
              <button
                onClick={() => {
                  setRightPanelTab('ticket');
                  setOrderToChargeId(null);
                }}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  rightPanelTab === 'ticket' && !orderToChargeId
                    ? 'bg-[#C53747] text-white border-[#C53747] shadow-sm'
                    : 'text-[#666992] hover:text-white bg-[#000100] border-[#4B3438]'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Comanda ({ticketItems.length})</span>
              </button>

              <button
                onClick={() => {
                  setRightPanelTab('cobro');
                  resetBills();
                }}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  rightPanelTab === 'cobro' || orderToChargeId
                    ? 'bg-[#C53747] text-white border-[#C53747] shadow-sm font-extrabold'
                    : 'text-[#666992] hover:text-white bg-[#000100] border-[#4B3438]'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Panel de Cobro</span>
              </button>
            </div>

            <button 
              className="p-1.5 text-[#666992] hover:text-white rounded-lg hover:bg-[#200607] cursor-pointer"
              title="Opciones de comanda"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* =====================================================================
              TAB 1: COMANDA / PEDIDO ACTUAL
             ===================================================================== */}
          {rightPanelTab === 'ticket' && !orderToChargeId && (
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              
              {/* Ticket Items List */}
              <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
                {ticketItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#666992]">
                    <div className="w-16 h-16 rounded-full border border-[#4B3438] flex items-center justify-center text-[#666992] mb-3 bg-[#000100]">
                      <UtensilsCrossed className="w-8 h-8 text-[#666992] stroke-1" />
                    </div>
                    <p className="text-sm font-bold text-white">Comanda vacía</p>
                    <p className="text-xs mt-1 text-[#C4C0C5] max-w-[220px] leading-relaxed">
                      Toca platos o bebidas del menú para agregarlos a la comanda.
                    </p>
                  </div>
                ) : (
                  ticketItems.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="p-2.5 rounded-xl bg-[#000100] hover:bg-[#200607]/30 border border-[#4B3438] transition-colors flex flex-col gap-1.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${item.station === 'cocina' ? 'bg-[#C53747]' : 'bg-[#666992]'}`} />
                            <h5 className="text-xs font-bold text-white truncate">{item.productName}</h5>
                          </div>
                          <span className="text-[11px] text-[#C4C0C5] font-mono">
                            {formatCOP(item.price)} c/u
                          </span>
                        </div>

                        {/* Qty controls */}
                        <div className="flex items-center gap-1 bg-[#010102] border border-[#4B3438] rounded-lg p-0.5">
                          <button
                            onClick={() => updateQuantity(idx, -1)}
                            className="w-5 h-5 flex items-center justify-center text-[#666992] hover:text-white rounded hover:bg-[#200607]"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-mono font-bold text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(idx, 1)}
                            className="w-5 h-5 flex items-center justify-center text-[#666992] hover:text-white rounded hover:bg-[#200607]"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Subtotal and quick notes */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-[#4B3438]/60">
                        <div className="flex-1 mr-2">
                          {item.notes ? (
                            <span className="text-[#C4C0C5] italic text-[11px] block truncate font-medium">
                              Nota: {item.notes}
                            </span>
                          ) : (
                            <div className="flex gap-1 overflow-x-auto py-0.5">
                              {item.station === 'cocina' ? (
                                <>
                                  <button
                                    onClick={() => addModifierToItem(idx, 'Término 3/4')}
                                    className="text-[9px] px-1.5 py-0.5 rounded bg-[#200607] border border-[#4B3438] text-[#C4C0C5] hover:text-white whitespace-nowrap"
                                  >
                                    + 3/4
                                  </button>
                                  <button
                                    onClick={() => addModifierToItem(idx, 'Sin cebolla')}
                                    className="text-[9px] px-1.5 py-0.5 rounded bg-[#200607] border border-[#4B3438] text-[#C4C0C5] hover:text-white whitespace-nowrap"
                                  >
                                    + Sin ceb.
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => addModifierToItem(idx, 'Con hielo')}
                                    className="text-[9px] px-1.5 py-0.5 rounded bg-[#200607] border border-[#4B3438] text-[#C4C0C5] hover:text-white whitespace-nowrap"
                                  >
                                    + Hielo
                                  </button>
                                  <button
                                    onClick={() => addModifierToItem(idx, 'Helada')}
                                    className="text-[9px] px-1.5 py-0.5 rounded bg-[#200607] border border-[#4B3438] text-[#C4C0C5] hover:text-white whitespace-nowrap"
                                  >
                                    + Helada
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white font-mono tabular-nums shrink-0 text-xs">
                            {formatCOP(item.price * item.quantity)}
                          </span>
                          <button
                            onClick={() => removeItem(idx)}
                            className="text-[#666992] hover:text-[#C53747] p-0.5 transition-colors cursor-pointer"
                            title="Eliminar ítem"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Ticket Footer & Actions */}
              <div className="p-3.5 bg-[#010102] border-t border-[#4B3438] space-y-3 shrink-0">
                
                {/* Note input */}
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Instrucción general comanda..."
                  className="w-full px-3 py-2 bg-[#000100] border border-[#4B3438] rounded-xl text-xs text-white placeholder-[#666992] focus:outline-none focus:border-[#C53747] transition-colors"
                />

                {/* Subtotal Display - Prominent and High-Contrast */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#000100] border border-[#4B3438] shadow-inner">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-[#666992] tracking-wider font-mono">TOTAL COMANDA:</span>
                    <span className="text-[11px] text-[#C4C0C5]">
                      {ticketItems.reduce((acc, i) => acc + i.quantity, 0)} {ticketItems.length === 1 ? 'producto' : 'productos'}
                    </span>
                  </div>
                  <span className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums tracking-tight">
                    {formatCOP(ticketTotal)}
                  </span>
                </div>

                {/* Venta Rápida Direct 1-Click Cash Action */}
                {saleMode === 'venta_rapida' && ticketItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleQuickSaleExactCash}
                    className="w-full py-2.5 px-3 rounded-xl font-black text-xs bg-[#200607] hover:bg-[#320a0d] border border-[#C53747]/60 text-white flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-98"
                  >
                    <Zap className="w-4 h-4 fill-current text-[#C53747]" />
                    <span>⚡ COBRO RÁPIDO EXACTO ({formatCOP(ticketTotal)})</span>
                  </button>
                )}

                {/* Standard Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={ticketItems.length === 0}
                    onClick={handleSendOrderToKDS}
                    className={`py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md ${
                      ticketItems.length > 0
                        ? 'bg-[#000100] hover:bg-[#200607] text-[#C4C0C5] hover:text-white border border-[#4B3438] cursor-pointer'
                        : 'bg-[#000100]/60 text-[#666992]/60 border border-[#4B3438]/40 cursor-not-allowed'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5 text-[#666992]" />
                    <span>Enviar a KDS</span>
                  </button>

                  <button
                    type="button"
                    disabled={ticketItems.length === 0}
                    onClick={() => {
                      setModalTargetOrder(null);
                      setIsPaymentModalOpen(true);
                    }}
                    className={`py-3 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xl ${
                      ticketItems.length > 0
                        ? 'bg-[#C53747] hover:bg-[#d84354] text-white cursor-pointer active:scale-95 shadow-lg border border-red-400/40 ring-1 ring-red-400/30'
                        : 'bg-[#200607]/40 text-[#666992] border border-[#4B3438] cursor-not-allowed opacity-60'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Pasar al Cobro</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* =====================================================================
              TAB 2: PANEL DE COBRO EN EFECTIVO & ELECTRÓNICO (STANDALONE DOCK)
             ===================================================================== */}
          {(rightPanelTab === 'cobro' || orderToChargeId) && (
            <div className="flex-1 flex flex-col justify-between overflow-y-auto p-3 space-y-3">
              
              {/* Target Order Indicator */}
              <div className="p-2.5 rounded-xl bg-[#000100] border border-[#4B3438] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#666992]">Cobrando Cuenta:</span>
                  <h4 className="text-sm font-black text-white">
                    {existingOrderToCharge ? existingOrderToCharge.tableNumber : (
                      saleMode === 'venta_rapida' ? `Venta Rápida #${quickSaleIndex}` : selectedTable
                    )}
                  </h4>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-[#666992]">Total a Pagar:</span>
                  <div className="text-base font-black text-white font-mono tabular-nums">
                    {formatCOP(totalDue)}
                  </div>
                </div>
              </div>

              {/* Success Notification if Payment Just Completed */}
              {completedPayment && (
                <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>¡Pago Registrado Exitosamente!</span>
                  </div>
                  <p className="text-[11px] text-emerald-300/90">
                    Comprobante generado para {completedPayment.order.tableNumber}.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handlePrint80mm}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-[#C53747] hover:bg-[#d84354] text-white font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-xs shadow-md"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimir Ticket 80mm
                    </button>
                    <button
                      onClick={() => setCompletedPayment(null)}
                      className="py-1.5 px-3 rounded-lg bg-[#000100] border border-[#4B3438] text-[#C4C0C5] hover:text-white text-xs cursor-pointer"
                    >
                      Listo
                    </button>
                  </div>
                </div>
              )}

              {/* Colombian Cash Denominations Section: $10k, $20k, $50k, $100k */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Banknote className="w-3.5 h-3.5 text-[#C53747]" /> Billetes en Efectivo
                  </label>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleSetExactCashBills}
                      className="text-[10px] px-2 py-0.5 rounded bg-[#200607] border border-[#4B3438] text-[#C4C0C5] font-bold hover:text-white hover:border-[#666992] transition-colors cursor-pointer"
                    >
                      Pagar Exacto
                    </button>
                    <button
                      onClick={resetBills}
                      className="text-[10px] text-[#666992] hover:text-white transition-colors"
                      title="Reiniciar conteo de billetes"
                    >
                      Reiniciar
                    </button>
                  </div>
                </div>

                {/* 4 Strict Colombian Denomination Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {([10000, 20000, 50000, 100000] as BillDenomination[]).map(denom => {
                    const count = billCounts[denom];
                    return (
                      <div 
                        key={denom} 
                        className="p-2 rounded-xl bg-[#000100] border border-[#4B3438] flex items-center justify-between gap-1 shadow-sm"
                      >
                        <button
                          onClick={() => setBillCounts(prev => ({ ...prev, [denom]: prev[denom] + 1 }))}
                          className="flex-1 text-left cursor-pointer group"
                        >
                          <div className="text-[10px] text-[#666992] font-bold group-hover:text-white">
                            Billete
                          </div>
                          <div className="text-xs font-black text-white font-mono">
                            {formatCOP(denom)}
                          </div>
                        </button>

                        <div className="flex items-center gap-1">
                          {count > 0 && (
                            <button
                              onClick={() => setBillCounts(prev => ({ ...prev, [denom]: Math.max(prev[denom] - 1, 0) }))}
                              className="w-5 h-5 rounded bg-[#200607] text-[#C4C0C5] hover:text-white flex items-center justify-center text-xs"
                            >
                              -
                            </button>
                          )}
                          <span className={`w-5 text-center text-xs font-mono font-bold ${count > 0 ? 'text-[#C53747]' : 'text-[#666992]'}`}>
                            {count}
                          </span>
                          <button
                            onClick={() => setBillCounts(prev => ({ ...prev, [denom]: prev[denom] + 1 }))}
                            className="w-5 h-5 rounded bg-[#200607] text-white hover:bg-[#320a0d] flex items-center justify-center text-xs border border-[#4B3438]"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Split Electronic Payment (Nequi / Daviplata / Tarjeta) */}
              <div className="p-2.5 rounded-xl bg-[#000100] border border-[#4B3438] space-y-2">
                <span className="text-[11px] font-bold text-[#666992] uppercase tracking-wider block font-mono">
                  Pago Mixto / Transferencia:
                </span>
                
                <div className="grid grid-cols-4 gap-1 text-[11px]">
                  {(['ninguno', 'nequi', 'daviplata', 'tarjeta'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => {
                        setSplitMethod(m);
                        if (m === 'ninguno') setSplitElectronicAmount(0);
                        else if (splitElectronicAmount === 0) setSplitElectronicAmount(Math.round(totalDue / 2));
                      }}
                      className={`py-1 px-1 rounded-lg font-bold capitalize transition-all cursor-pointer text-center truncate ${
                        splitMethod === m
                          ? 'bg-[#C53747] border border-[#C53747] text-white font-black'
                          : 'bg-[#010102] border border-[#4B3438] text-[#666992] hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {splitMethod !== 'ninguno' && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-[#C4C0C5] shrink-0 font-mono">Monto {splitMethod}:</span>
                    <input
                      type="number"
                      value={splitElectronicAmount || ''}
                      onChange={(e) => setSplitElectronicAmount(Math.min(Number(e.target.value) || 0, totalDue))}
                      className="w-full px-2 py-1 bg-[#010102] border border-[#4B3438] rounded text-xs font-mono text-white text-right font-bold focus:outline-none focus:border-[#C53747]"
                    />
                  </div>
                )}
              </div>

              {/* Calculation Summary Box (Strict arithmetic) */}
              <div className="p-3 rounded-xl bg-[#000100] border border-[#4B3438] space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-[#C4C0C5]">
                  <span>Efectivo Recibido:</span>
                  <span className="font-bold text-white">{formatCOP(cashReceived)}</span>
                </div>

                {splitMethod !== 'ninguno' && splitElectronicAmount > 0 && (
                  <div className="flex justify-between text-[#C4C0C5]">
                    <span className="capitalize">{splitMethod}:</span>
                    <span className="font-bold text-[#666992]">{formatCOP(splitElectronicAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-[#C4C0C5] border-t border-[#4B3438] pt-1">
                  <span>Total Cubierto:</span>
                  <span className="font-bold text-white">{formatCOP(cashReceived + splitElectronicAmount)}</span>
                </div>

                {/* Vuelto vs Saldo Faltante */}
                {cashStillPending > 0 ? (
                  <div className="flex justify-between text-rose-400 font-bold bg-rose-950/40 p-1.5 rounded-lg border border-rose-900/50 mt-1">
                    <span>Faltante por Pagar:</span>
                    <span className="text-sm">{formatCOP(cashStillPending)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-emerald-400 font-black bg-emerald-950/60 p-2 rounded-lg border border-emerald-800/60 mt-1 text-sm">
                    <span>VUELTO A ENTREGAR:</span>
                    <span className="text-base text-emerald-300 font-black">{formatCOP(changeToGive)}</span>
                  </div>
                )}
              </div>

              {/* Confirm & Close Cash Payment Button */}
              <div className="pt-1">
                <button
                  type="button"
                  disabled={!canConfirmPayment}
                  onClick={handleCompleteCurrentPayment}
                  className={`w-full py-3 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer ${
                    canConfirmPayment
                      ? 'bg-[#C53747] hover:bg-[#d84354] text-white active:scale-98 shadow-md'
                      : 'bg-[#000100] text-[#666992]/60 border border-[#4B3438] cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>CONFIRMAR Y CERRAR COBRO</span>
                </button>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* Modal Dialog for Recharts Daily Sales Analytics */}
      {isSalesChartModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
          <div className="relative w-full max-w-4xl bg-[#200607] rounded-2xl border border-[#4B3438] shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col text-[#F4F1F1]">
            <div className="flex items-center justify-between p-4 border-b border-[#4B3438] bg-[#010102] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#200607] text-[#C53747] flex items-center justify-center border border-[#4B3438]">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base">
                    Estadísticas & Ventas Diarias (Recharts)
                  </h3>
                  <span className="text-[11px] text-[#C4C0C5]">Restaurante-Bar 90 Grados · Visualización de Datos</span>
                </div>
              </div>

              <button
                onClick={() => setIsSalesChartModalOpen(false)}
                className="p-1.5 rounded-xl text-[#C4C0C5] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Cerrar gráfica"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <DailySalesChart />
            </div>
          </div>
        </div>
      )}

      {/* Official Modal Overlay for Pasar al Cobro */}
      {isPaymentModalOpen && (
        <CashPaymentModal
          order={modalTargetOrder}
          draftData={modalTargetOrder ? undefined : {
            tableNumber: saleMode === 'venta_rapida' ? `Venta Rápida #${quickSaleIndex}` : selectedTable,
            items: ticketItems,
            customerNote: orderNotes
          }}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setModalTargetOrder(null);
          }}
          onPaymentSuccess={() => {
            setIsPaymentModalOpen(false);
            setModalTargetOrder(null);
            setTicketItems([]);
            setOrderNotes('');
            setOrderToChargeId(null);
            if (saleMode === 'venta_rapida') {
              setQuickSaleIndex(prev => prev + 1);
            }
          }}
        />
      )}

    </div>
  );
};
