import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Product, ProductCategory, OrderItem, Order } from '../types';
import { formatCOP, formatDateTimeBogota } from '../utils/format';
import { 
  UtensilsCrossed, 
  Wine, 
  Plus, 
  Minus, 
  Trash2, 
  Send, 
  Clock, 
  Check, 
  AlertCircle, 
  Search, 
  ChevronRight, 
  ArrowLeft, 
  Bell, 
  CheckCircle2, 
  Users, 
  Sparkles, 
  Coffee, 
  Flame, 
  FileText,
  BadgeAlert,
  ChevronLeft,
  Loader2
} from 'lucide-react';

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

interface TableConfig {
  id: string;
  name: string;
  zone: 'salon' | 'terraza' | 'barra' | 'llevar';
  capacity: number;
}

const RESTAURANT_TABLES: TableConfig[] = [
  { id: 't-1', name: 'Mesa 1', zone: 'salon', capacity: 4 },
  { id: 't-2', name: 'Mesa 2', zone: 'salon', capacity: 4 },
  { id: 't-3', name: 'Mesa 3', zone: 'salon', capacity: 6 },
  { id: 't-4', name: 'Mesa 4', zone: 'salon', capacity: 4 },
  { id: 't-5', name: 'Mesa 5', zone: 'salon', capacity: 8 },
  { id: 't-6', name: 'Mesa 6', zone: 'salon', capacity: 2 },
  { id: 't-t1', name: 'Terraza 1', zone: 'terraza', capacity: 4 },
  { id: 't-t2', name: 'Terraza 2', zone: 'terraza', capacity: 4 },
  { id: 't-t3', name: 'Terraza 3', zone: 'terraza', capacity: 6 },
  { id: 't-b1', name: 'Barra 1', zone: 'barra', capacity: 2 },
  { id: 't-b2', name: 'Barra 2', zone: 'barra', capacity: 2 },
  { id: 't-b3', name: 'Barra 3', zone: 'barra', capacity: 2 },
  { id: 't-dl', name: 'Para Llevar / Domicilio', zone: 'llevar', capacity: 1 },
];

export const WaiterModule: React.FC = () => {
  const { 
    currentUser, 
    products, 
    orders, 
    createOrder, 
    currentShift,
    allUsers,
    switchUser
  } = useApp();

  // Mode: 'map' (Salón Map & Active Tables) vs 'order' (Taking Comanda)
  const [viewMode, setViewMode] = useState<'map' | 'order'>('map');
  const [selectedTable, setSelectedTable] = useState<string>('Mesa 1');
  const [selectedZone, setSelectedZone] = useState<'todos' | 'salon' | 'terraza' | 'barra'>('todos');
  
  // Waiter Filter: 'all' vs 'mine'
  const [filterMine, setFilterMine] = useState<boolean>(false);

  // In-progress ticket for the selected table
  const [ticketItems, setTicketItems] = useState<OrderItem[]>([]);
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'Todas'>('Todas');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Feedback alerts
  const [sentSuccessMessage, setSentSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [accountRequestedTables, setAccountRequestedTables] = useState<Record<string, boolean>>({});

  // Active open orders
  const openOrders = orders.filter(o => o.status === 'abierta');

  // Filter products for waiter menu
  const filteredProducts = products.filter(p => {
    if (!p.available) return false;
    // Turn restrictions (Bar shift vs Restaurant)
    if (currentShift?.center === 'Bar Nocturno' && p.allowedShifts === 'matutino') {
      return false;
    }
    const matchesCat = selectedCategory === 'Todas' || p.category === selectedCategory;
    const matchesQuery = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesQuery;
  });

  const getTableOrder = (tableName: string): Order | undefined => {
    return openOrders.find(o => o.tableNumber === tableName);
  };

  const handleOpenTable = (tableName: string) => {
    setSelectedTable(tableName);
    const existingOrder = getTableOrder(tableName);
    // If table already has an order, clear draft items so waiter can add a new round or view status
    setTicketItems([]);
    setOrderNotes('');
    setViewMode('order');
  };

  const addToTicket = (product: Product) => {
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

  const ticketTotal = ticketItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Send Order to Kitchen & Bar without touching Caja (Online with Supabase and Idempotency)
  const handleSendComanda = async () => {
    if (ticketItems.length === 0 || isSubmitting) return;

    // Idempotency key to guarantee no double orders on touch tap or connection retries
    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const createdOrder = await createOrder(
        selectedTable, 
        ticketItems, 
        orderNotes,
        {
          idempotencyKey,
          sedeId: currentUser.assignedSede || 'sede-principal'
        }
      );
      
      setSentSuccessMessage(`¡Comanda #${createdOrder.orderNumber} confirmada y enviada para ${selectedTable}!`);
      setTimeout(() => setSentSuccessMessage(null), 4000);

      // ONLY clear ticket and return to map AFTER confirmed persistence
      setTicketItems([]);
      setOrderNotes('');
      setViewMode('map');
    } catch (err: any) {
      console.error('Error al enviar la comanda:', err);
      setErrorMessage(err.message || 'No se pudo registrar la comanda. Por favor intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Request Customer Pre-Bill from Cashier
  const handleRequestCheckFromCashier = (tableName: string) => {
    setAccountRequestedTables(prev => ({ ...prev, [tableName]: true }));
    setSentSuccessMessage(`Cuenta solicitada a Caja para ${tableName}. La cajera preparará la factura.`);
    setTimeout(() => setSentSuccessMessage(null), 4000);
  };

  // Filtered tables for Salon View
  const displayedTables = RESTAURANT_TABLES.filter(table => {
    if (selectedZone !== 'todos' && table.zone !== selectedZone) return false;
    if (filterMine) {
      const existing = getTableOrder(table.name);
      return existing && existing.waiterId === currentUser.id;
    }
    return true;
  });

  const activeExistingOrder = getTableOrder(selectedTable);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-[#0B0D18] text-[#EBE1D5]">
      
      {/* =========================================================================
          TOP BANNER: MÓDULO EXCLUSIVO PARA MESEROS (ZERO CAJA / SERVICIO EN MESA)
         ========================================================================= */}
      <div className="px-4 py-2.5 header-brand-gradient border-b border-[#EBE1D5]/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        {/* Left: Waiter Identity & Role Badge */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0D1024] border border-[#7C170D] flex items-center justify-center text-[#EBE1D5] shrink-0 shadow-md">
            <UtensilsCrossed className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                Comandero Móvil · Meseros
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold uppercase">
                Servicio Exclusivo Salón
              </span>
            </div>

            <p className="text-xs text-[#A6AFCA] flex items-center gap-1.5 mt-0.5">
              <span>Mesero a cargo:</span>
              <strong className="text-[#EBE1D5] font-mono">@{currentUser.username}</strong>
              <span className="text-stone-600">·</span>
              <span className="text-[#EBE1D5]">{currentUser.fullName}</span>
            </p>
          </div>
        </div>

        {/* Center / Right: Switch between Waiters if needed & Mode Toggle */}
        <div className="flex items-center gap-2">
          
          {/* Quick Waiter Switcher */}
          <div className="hidden sm:flex items-center gap-1.5 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg p-1 text-xs">
            <span className="text-[11px] text-[#A6AFCA] px-1 font-semibold">Cambiar Mesero:</span>
            {allUsers.filter(u => u.role === 'mesero' || u.role === 'administrador').slice(0, 3).map(u => (
              <button
                key={u.id}
                onClick={() => switchUser(u.id)}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  u.id === currentUser.id 
                    ? 'bg-[#151946] border border-[#EBE1D5]/40 text-[#EBE1D5] shadow' 
                    : 'text-[#A6AFCA] hover:text-white hover:bg-[#151946]/40'
                }`}
              >
                @{u.username}
              </button>
            ))}
          </div>

          {/* View Mode Toggle Button */}
          {viewMode === 'order' && (
            <button
              onClick={() => setViewMode('map')}
              className="px-3 py-1.5 rounded-xl bg-[#121524] hover:bg-[#151946] text-[#EBE1D5] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-[#EBE1D5]/30 shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al Salón</span>
            </button>
          )}

        </div>

      </div>

      {/* Floating Success Notification */}
      {sentSuccessMessage && (
        <div className="bg-emerald-600 text-white font-black text-xs px-4 py-2 flex items-center justify-center gap-2 shadow-lg animate-in slide-in-from-top-2 border-b border-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          <span>{sentSuccessMessage}</span>
        </div>
      )}

      {/* =========================================================================
          VIEW 1: PLANO INTERACTIVO DE SALÓN Y MESAS
         ========================================================================= */}
      {viewMode === 'map' && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4">
          
          {/* Controls Bar: Zones and Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121524] p-3 rounded-2xl border border-[#EBE1D5]/20 shadow-md">
            
            {/* Zone Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              <span className="text-[#A6AFCA] font-semibold uppercase tracking-wider text-[11px] mr-1">
                Zonas:
              </span>
              {[
                { id: 'todos', label: 'Todas las Mesas' },
                { id: 'salon', label: 'Salón Principal' },
                { id: 'terraza', label: 'Terraza' },
                { id: 'barra', label: 'Barra' },
              ].map(z => (
                <button
                  key={z.id}
                  onClick={() => setSelectedZone(z.id as any)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap border ${
                    selectedZone === z.id
                      ? 'bg-[#151946] border-[#EBE1D5]/50 text-[#EBE1D5] shadow-sm'
                      : 'bg-[#0E1120] text-[#A6AFCA] hover:text-[#EBE1D5] border-[#EBE1D5]/15 hover:bg-[#151946]/30'
                  }`}
                >
                  {z.label}
                </button>
              ))}
            </div>

            {/* Waiter Filter Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterMine(!filterMine)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  filterMine
                    ? 'bg-[#7C170D] text-white border-[#EBE1D5]/50 ring-1 ring-[#7C170D]/40 shadow-sm'
                    : 'bg-[#0E1120] text-[#A6AFCA] hover:text-[#EBE1D5] border-[#EBE1D5]/15 hover:bg-[#151946]/30'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Solo Mis Mesas (@{currentUser.username})</span>
              </button>
            </div>

          </div>

          {/* Table Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedTables.map(table => {
              const activeOrder = getTableOrder(table.name);
              const isOccupied = !!activeOrder;
              const isAccountRequested = accountRequestedTables[table.name];
              const isMyTable = activeOrder?.waiterId === currentUser.id;

              return (
                <div
                  key={table.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between shadow-lg relative ${
                    isAccountRequested
                      ? 'bg-[#151946] border-2 border-cyan-400 ring-2 ring-cyan-500/30'
                      : isOccupied
                        ? 'bg-[#121524] border-[#7C170D] ring-1 ring-[#7C170D]/40'
                        : 'bg-[#121524] border-[#EBE1D5]/20 hover:border-[#EBE1D5]/40 hover:bg-[#15192c]'
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-white">{table.name}</h3>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#0E1120] border border-[#EBE1D5]/15 text-[#A6AFCA] capitalize">
                            {table.zone}
                          </span>
                        </div>
                        <span className="text-xs text-[#8890A6]">Capacidad: {table.capacity} personas</span>
                      </div>

                      {/* Status Badge */}
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide flex items-center gap-1 border ${
                        isAccountRequested
                          ? 'bg-[#151946] text-[#EBE1D5] border-[#EBE1D5]/40'
                          : isOccupied
                            ? 'bg-[#7C170D]/30 border-[#7C170D] text-red-200'
                            : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isAccountRequested ? 'bg-[#EBE1D5]' : isOccupied ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'
                        }`} />
                        {isAccountRequested ? 'Cuenta Pedida' : isOccupied ? 'Ocupada' : 'Libre'}
                      </span>
                    </div>

                    {/* Active Order Details if Occupied */}
                    {activeOrder && (
                      <div className="p-2.5 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/15 space-y-1.5 my-2 text-xs">
                        <div className="flex justify-between items-center text-[#A6AFCA]">
                          <span>Comanda #{activeOrder.orderNumber}:</span>
                          <span className="font-bold text-[#EBE1D5] font-mono">
                            {formatCOP(activeOrder.totalAmount)}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-[#A6AFCA]">Atiende:</span>
                          <span className={`font-mono font-bold ${isMyTable ? 'text-emerald-400' : 'text-[#EBE1D5]'}`}>
                            {isMyTable ? '⭐ Tú (@' + currentUser.username + ')' : activeOrder.waiterName.split(' ')[0]}
                          </span>
                        </div>

                        {/* Station Status pills */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-bold ${
                            activeOrder.stationStatus.cocina === 'listo'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-[#7C170D]/40 text-[#EBE1D5] border border-[#7C170D]'
                          }`}>
                            Cocina: {activeOrder.stationStatus.cocina}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-bold ${
                            activeOrder.stationStatus.bar === 'listo'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-[#151946] text-[#EBE1D5] border border-[#2D3560]'
                          }`}>
                            Bar: {activeOrder.stationStatus.bar}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-[#EBE1D5]/15 space-y-2 mt-2">
                    
                    {/* Primary action */}
                    <button
                      onClick={() => handleOpenTable(table.name)}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer border ${
                        isOccupied
                          ? 'bg-[#151946] hover:bg-[#1c225a] text-[#EBE1D5] border-[#EBE1D5]/30'
                          : 'bg-[#7C170D] hover:bg-[#961D12] text-white border-[#EBE1D5]/30 font-black'
                      }`}
                    >
                      {isOccupied ? (
                        <>
                          <Plus className="w-3.5 h-3.5 text-[#EBE1D5]" />
                          <span>Adicionar a la Mesa</span>
                        </>
                      ) : (
                        <>
                          <UtensilsCrossed className="w-3.5 h-3.5" />
                          <span>Abrir Comanda</span>
                        </>
                      )}
                    </button>

                    {/* Request Pre-bill action if occupied */}
                    {isOccupied && (
                      <button
                        onClick={() => handleRequestCheckFromCashier(table.name)}
                        className={`w-full py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                          isAccountRequested
                            ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/60'
                            : 'bg-[#0E1120] text-[#A6AFCA] hover:text-white border-[#EBE1D5]/15 hover:bg-[#151946]'
                        }`}
                      >
                        <Bell className="w-3 h-3 text-cyan-400" />
                        <span>{isAccountRequested ? 'Cuenta ya avisada a Caja' : 'Pedir Cuenta a Caja'}</span>
                      </button>
                    )}

                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* =========================================================================
          VIEW 2: COMANDERO TÁCTIL (TOMA DE PEDIDOS EXCLUSIVA PARA MESEROS)
         ========================================================================= */}
      {viewMode === 'order' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#0B0D18]">
          
          {/* Left / Center: Catalog & Category Navigation */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#0B0D18] overflow-hidden border-r border-[#EBE1D5]/20">
            
            {/* Header: Table and Search */}
            <div className="p-3 border-b border-[#EBE1D5]/20 bg-[#121524] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('map')}
                  className="p-1.5 rounded-lg bg-[#0E1120] border border-[#EBE1D5]/20 text-[#EBE1D5] hover:text-white hover:bg-[#151946] cursor-pointer"
                  title="Volver"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white">{selectedTable}</span>
                    {activeExistingOrder && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#151946] text-[#EBE1D5] border border-[#EBE1D5]/30 font-bold">
                        Comanda Activa #{activeExistingOrder.orderNumber}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#A6AFCA]">Selecciona platos o bebidas para agregar a la orden</span>
                </div>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 text-[#71788E] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar en la carta..."
                  className="w-full pl-9 pr-3 py-1.5 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-sm text-white placeholder-[#71788E] focus:outline-none focus:border-[#7C170D]"
                />
              </div>
            </div>

            {/* Category Submenu */}
            <div className="px-3 py-2 border-b border-[#EBE1D5]/15 bg-[#0B0D18] flex items-center gap-1.5 overflow-x-auto shrink-0 text-xs">
              <button
                onClick={() => setSelectedCategory('Todas')}
                className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  selectedCategory === 'Todas'
                    ? 'bg-[#151946] border-[#EBE1D5]/50 text-[#EBE1D5] shadow-sm'
                    : 'text-[#A6AFCA] hover:text-white hover:bg-[#151946]/30 bg-[#0E1120] border-[#EBE1D5]/15'
                }`}
              >
                Todas ({products.length})
              </button>

              {CATEGORIES.map(cat => {
                const count = products.filter(p => p.category === cat).length;
                if (count === 0) return null;
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-[#151946] border-[#EBE1D5]/50 text-[#EBE1D5] shadow-sm'
                        : 'text-[#A6AFCA] hover:text-white hover:bg-[#151946]/30 bg-[#0E1120] border-[#EBE1D5]/15'
                    }`}
                  >
                    {cat === 'Cervezas' || cat === 'Licores' || cat === 'Jugos Naturales' ? (
                      <Wine className="w-3.5 h-3.5 opacity-80" />
                    ) : (
                      <UtensilsCrossed className="w-3.5 h-3.5 opacity-80" />
                    )}
                    <span>{cat}</span>
                    <span className="opacity-70 font-mono text-[10px]">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Dishes Catalog Grid */}
            <div className="flex-1 p-3 sm:p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToTicket(product)}
                  className="p-3 rounded-xl bg-[#121524] border border-[#EBE1D5]/20 hover:border-[#EBE1D5]/40 hover:bg-[#15192c] text-left flex flex-col justify-between transition-all group cursor-pointer shadow-sm active:scale-98"
                >
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <h4 className="text-xs font-bold text-[#EBE1D5] group-hover:text-white transition-colors line-clamp-1">
                        {product.name}
                      </h4>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-semibold shrink-0 border ${
                        product.station === 'cocina' 
                          ? 'bg-[#7C170D]/40 text-[#EBE1D5] border-[#7C170D]/60' 
                          : 'bg-[#151946] text-[#EBE1D5] border-[#2D3560]'
                      }`}>
                        {product.station}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#A6AFCA] line-clamp-2 mt-0.5">
                      {product.description || product.category}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#EBE1D5]/15">
                    <span className="text-xs font-bold text-[#EBE1D5] font-mono">
                      {formatCOP(product.price)}
                    </span>
                    <span className="w-5 h-5 rounded bg-[#0E1120] text-[#EBE1D5] group-hover:bg-[#7C170D] group-hover:text-white flex items-center justify-center transition-colors border border-[#EBE1D5]/20">
                      <Plus className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              ))}
            </div>

          </div>

          {/* Right: Waiter Ticket Drawer (Comanda Exclusiva) */}
          <div className="w-full lg:w-96 bg-[#121524] flex flex-col justify-between shrink-0 border-t lg:border-t-0 border-[#EBE1D5]/20">
            
            {/* Header of Drawer */}
            <div className="p-3 border-b border-[#EBE1D5]/20 panel-header-gradient flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-white text-sm">Nueva Comanda</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-[#151946] border border-[#EBE1D5]/30 text-white font-bold">
                    {selectedTable}
                  </span>
                </div>
                <p className="text-[11px] text-[#A6AFCA] mt-0.5">
                  Mesero: <strong className="text-[#EBE1D5] font-mono">@{currentUser.username}</strong>
                </p>
              </div>

              {ticketItems.length > 0 && (
                <button
                  onClick={() => setTicketItems([])}
                  className="text-xs text-[#A6AFCA] hover:text-red-400 transition-colors cursor-pointer"
                >
                  Vaciar
                </button>
              )}
            </div>

            {/* Items list */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2">
              {/* If there is an existing order on this table, show existing items as reference */}
              {activeExistingOrder && activeExistingOrder.items.length > 0 && (
                <div className="p-2.5 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/15 text-xs mb-3">
                  <span className="text-[10px] font-bold text-[#A6AFCA] uppercase tracking-wider block mb-1">
                    Ya Ordenado Previamente ({activeExistingOrder.items.length} platos):
                  </span>
                  <div className="space-y-1 text-[#EBE1D5]">
                    {activeExistingOrder.items.map((it, i) => (
                      <div key={i} className="flex justify-between text-[11px]">
                        <span>{it.quantity}x {it.productName}</span>
                        <span className="text-[#A6AFCA] font-mono">{formatCOP(it.price * it.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ticketItems.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-[#71788E]">
                  <UtensilsCrossed className="w-10 h-10 stroke-1 mb-2 text-[#71788E]" />
                  <p className="text-xs font-semibold text-[#EBE1D5]">Sin nuevos platos agregados</p>
                  <p className="text-[11px] mt-1 text-[#8890A6]">
                    Toca productos a la izquierda para armar la nueva comanda de la mesa {selectedTable}.
                  </p>
                </div>
              ) : (
                ticketItems.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="p-2.5 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/15 flex flex-col gap-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${item.station === 'cocina' ? 'bg-[#7C170D]' : 'bg-[#151946]'}`} />
                          <h5 className="text-xs font-bold text-white truncate">{item.productName}</h5>
                        </div>
                        <span className="text-[10px] text-[#A6AFCA] font-mono">
                          {formatCOP(item.price)}
                        </span>
                      </div>

                      {/* Qty controls */}
                      <div className="flex items-center gap-1 bg-[#080A16] border border-[#EBE1D5]/20 rounded-lg p-0.5">
                        <button
                          onClick={() => updateQuantity(idx, -1)}
                          className="w-5 h-5 flex items-center justify-center text-[#A6AFCA] hover:text-white rounded hover:bg-[#151946]"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-4 text-center text-xs font-mono font-bold text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(idx, 1)}
                          className="w-5 h-5 flex items-center justify-center text-[#A6AFCA] hover:text-white rounded hover:bg-[#151946]"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Modifiers & Notes */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-[#EBE1D5]/15">
                      <div className="flex-1 mr-2">
                        {item.notes ? (
                          <span className="text-[#EBE1D5]/90 italic text-[10px] block truncate font-medium">
                            Nota: {item.notes}
                          </span>
                        ) : (
                          <div className="flex gap-1 overflow-x-auto py-0.5">
                            {item.station === 'cocina' ? (
                              <>
                                <button
                                  onClick={() => addModifierToItem(idx, 'Término 3/4')}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-[#151946] text-[#EBE1D5] hover:text-white whitespace-nowrap"
                                >
                                  + 3/4
                                </button>
                                <button
                                  onClick={() => addModifierToItem(idx, 'Sin cebolla')}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-[#151946] text-[#EBE1D5] hover:text-white whitespace-nowrap"
                                >
                                  + Sin ceb.
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => addModifierToItem(idx, 'Con hielo')}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-[#151946] text-[#EBE1D5] hover:text-white whitespace-nowrap"
                                >
                                  + Hielo
                                </button>
                                <button
                                  onClick={() => addModifierToItem(idx, 'Bien helada')}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-[#151946] text-[#EBE1D5] hover:text-white whitespace-nowrap"
                                >
                                  + Helada
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <span className="font-bold text-[#EBE1D5] font-mono tabular-nums shrink-0 text-xs">
                        {formatCOP(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer with Comanda Action ONLY (Zero Caja / Zero Cobro) */}
            <div className="p-3 bg-[#0E1120] border-t border-[#EBE1D5]/20 space-y-2.5 shrink-0">
              
              <input
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Instrucción general para Cocina/Bar..."
                className="w-full px-3 py-1.5 bg-[#080A16] border border-[#EBE1D5]/20 rounded-lg text-xs text-white placeholder-[#71788E] focus:outline-none focus:border-[#7C170D]"
              />

              {errorMessage && (
                <div className="p-2 rounded-lg bg-red-950/70 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span className="flex-1">{errorMessage}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs uppercase font-semibold text-[#A6AFCA]">Total Nueva Comanda:</span>
                <span className="text-lg font-black text-white font-mono tabular-nums">
                  {formatCOP(ticketTotal)}
                </span>
              </div>

              {/* Exclusive Action Button: Enviar a Cocina & Bar con protección contra doble clic */}
              <button
                type="button"
                disabled={ticketItems.length === 0 || isSubmitting}
                onClick={handleSendComanda}
                className={`w-full py-3 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-xl border ${
                  ticketItems.length > 0 && !isSubmitting
                    ? 'bg-[#7C170D] hover:bg-[#961D12] text-white border-[#EBE1D5]/40 cursor-pointer active:scale-98 shadow-md'
                    : 'bg-[#121524] text-[#474F68] border-[#EBE1D5]/10 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>ENVIANDO Y CONFIRMANDO...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>ENVIAR COMANDA A COCINA Y BAR</span>
                  </>
                )}
              </button>

              <p className="text-[10px] text-center text-[#71788E] pt-0.5">
                🔒 El cobro y facturación se efectúa en la estación de Caja.
              </p>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
