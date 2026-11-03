import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { OrderStationStatus } from '../types';
import { formatTimeBogota } from '../utils/format';
import { 
  UtensilsCrossed, 
  Wine, 
  Clock, 
  CheckCircle2, 
  Flame, 
  ChefHat, 
  Bell, 
  Layers,
  Filter
} from 'lucide-react';

export const KDSKitchenBar: React.FC = () => {
  const { orders, updateStationStatus, currentUser } = useApp();
  const [stationFilter, setStationFilter] = useState<'all' | 'cocina' | 'bar'>('all');

  // Filter only active orders that have items for that station and are not fully delivered
  const activeOrders = orders.filter(o => {
    if (o.status === 'cancelada') return false;
    
    // Check if kitchen still has work
    const hasKitchenItems = o.items.some(i => i.station === 'cocina');
    const kitchenPending = hasKitchenItems && o.stationStatus.cocina !== 'entregado';

    // Check if bar still has work
    const hasBarItems = o.items.some(i => i.station === 'bar');
    const barPending = hasBarItems && o.stationStatus.bar !== 'entregado';

    if (stationFilter === 'cocina') return kitchenPending;
    if (stationFilter === 'bar') return barPending;
    return kitchenPending || barPending;
  });

  const getElapsedMinutes = (createdAt: string) => {
    const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return Math.max(elapsed, 0);
  };

  const getNextStatus = (current: OrderStationStatus): OrderStationStatus => {
    switch (current) {
      case 'recibido': return 'en_preparacion';
      case 'en_preparacion': return 'listo';
      case 'listo': return 'entregado';
      default: return 'entregado';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-[#0B0D18] text-[#EBE1D5] overflow-hidden">
      
      {/* KDS Header */}
      <div className="p-4 border-b border-[#EBE1D5]/20 header-brand-gradient flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0D1024] border border-[#7C170D] flex items-center justify-center text-[#EBE1D5] shadow-md">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Pantalla KDS Cocina & Bar
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                {activeOrders.length} activas
              </span>
            </h2>
            <p className="text-xs text-[#A6AFCA]">
              Despacho en tiempo real para 90 Grados · Operador: <strong className="text-[#EBE1D5]">@{currentUser.username}</strong>
            </p>
          </div>
        </div>

        {/* Station Filter Toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-xl">
          <button
            onClick={() => setStationFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer border ${
              stationFilter === 'all'
                ? 'bg-[#151946] border-[#EBE1D5]/50 text-[#EBE1D5] shadow-sm font-bold'
                : 'border-transparent text-[#A6AFCA] hover:text-white'
            }`}
          >
            Todas las Estaciones
          </button>
          <button
            onClick={() => setStationFilter('cocina')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 border ${
              stationFilter === 'cocina'
                ? 'bg-[#7C170D] border-[#EBE1D5]/40 text-white shadow-sm font-bold'
                : 'border-transparent text-[#A6AFCA] hover:text-white'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            Solo Cocina
          </button>
          <button
            onClick={() => setStationFilter('bar')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 border ${
              stationFilter === 'bar'
                ? 'bg-[#151946] border-[#EBE1D5]/40 text-[#EBE1D5] shadow-sm font-bold'
                : 'border-transparent text-[#A6AFCA] hover:text-white'
            }`}
          >
            <Wine className="w-3.5 h-3.5" />
            Solo Bar
          </button>
        </div>
      </div>

      {/* Comandas Grid */}
      <div className="flex-1 p-4 overflow-y-auto">
        {activeOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#71788E]">
            <CheckCircle2 className="w-16 h-16 stroke-1 text-emerald-500/50 mb-3" />
            <h3 className="text-lg font-bold text-[#EBE1D5]">¡Todas las comandas están al día!</h3>
            <p className="text-xs text-[#8890A6] mt-1 max-w-sm">
              No hay pedidos pendientes en la estación seleccionada. Los nuevos pedidos tomados por los meseros aparecerán aquí al instante.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeOrders.map(order => {
              const minutes = getElapsedMinutes(order.createdAt);
              const isUrgent = minutes > 20;
              const isWarning = minutes > 12 && minutes <= 20;

              const kitchenItems = order.items.filter(i => i.station === 'cocina');
              const barItems = order.items.filter(i => i.station === 'bar');

              return (
                <div 
                  key={order.id} 
                  className={`rounded-2xl border flex flex-col justify-between overflow-hidden shadow-xl transition-all ${
                    isUrgent
                      ? 'border-[#7C170D] bg-[#121524] ring-2 ring-[#7C170D]/40'
                      : isWarning
                        ? 'border-amber-500/60 bg-[#121524]'
                        : 'border-[#EBE1D5]/20 bg-[#121524]'
                  }`}
                >
                  {/* Comanda Card Top */}
                  <div>
                    <div className="p-3.5 bg-[#0E1120] border-b border-[#EBE1D5]/15 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-extrabold text-white">
                            {order.tableNumber}
                          </span>
                          <span className="text-xs font-mono text-[#A6AFCA]">
                            #{order.orderNumber}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#A6AFCA] mt-0.5">
                          <span>Mesero:</span>
                          <strong className="text-[#EBE1D5]">@{order.waiterName.split(' ')[0]}</strong>
                        </div>
                      </div>

                      {/* Time timer badge */}
                      <div className={`px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-mono font-bold border ${
                        isUrgent 
                          ? 'bg-[#7C170D] text-[#EBE1D5] border-[#7C170D] animate-pulse shadow-sm shadow-[#7C170D]/40' 
                          : isWarning
                            ? 'bg-[#7C170D]/40 text-[#EBE1D5] border-[#7C170D]/60'
                            : 'bg-[#151946] text-[#EBE1D5] border-[#EBE1D5]/20'
                      }`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{minutes} min</span>
                      </div>
                    </div>

                    {/* Customer or table general note */}
                    {order.customerNote && (
                      <div className="px-3.5 py-1.5 bg-[#151946]/50 border-b border-[#EBE1D5]/20 text-[11px] text-[#EBE1D5] italic font-medium">
                        Nota: {order.customerNote}
                      </div>
                    )}

                    {/* Items Section */}
                    <div className="p-3.5 space-y-3">
                      
                      {/* Kitchen Section Items */}
                      {(stationFilter === 'all' || stationFilter === 'cocina') && kitchenItems.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-[#EBE1D5]/15 text-[11px] font-bold text-[#EBE1D5] uppercase tracking-wider">
                            <span className="flex items-center gap-1 text-[#E11D48]">
                              <UtensilsCrossed className="w-3 h-3" /> Cocina ({kitchenItems.length})
                            </span>
                            <span className="capitalize font-mono text-[10px] text-[#A6AFCA]">
                              Estado: {order.stationStatus.cocina.replace('_', ' ')}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {kitchenItems.map((item, idx) => (
                              <div key={idx} className="p-2 rounded-lg bg-[#0E1120] border border-[#EBE1D5]/15">
                                <div className="flex items-start justify-between">
                                  <span className="text-xs font-bold text-white">
                                    <span className="text-[#E11D48] font-mono text-sm mr-1.5">{item.quantity}x</span>
                                    {item.productName}
                                  </span>
                                </div>
                                {item.notes && (
                                  <p className="text-[11px] text-[#EBE1D5]/90 font-medium mt-0.5 italic">
                                    ★ {item.notes}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Bar Section Items */}
                      {(stationFilter === 'all' || stationFilter === 'bar') && barItems.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-[#EBE1D5]/15 text-[11px] font-bold text-[#EBE1D5] uppercase tracking-wider">
                            <span className="flex items-center gap-1 text-cyan-400">
                              <Wine className="w-3 h-3" /> Bar & Bebidas ({barItems.length})
                            </span>
                            <span className="capitalize font-mono text-[10px] text-[#A6AFCA]">
                              Estado: {order.stationStatus.bar.replace('_', ' ')}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {barItems.map((item, idx) => (
                              <div key={idx} className="p-2 rounded-lg bg-[#0E1120] border border-[#EBE1D5]/15">
                                <div className="flex items-start justify-between">
                                  <span className="text-xs font-bold text-white">
                                    <span className="text-cyan-400 font-mono text-sm mr-1.5">{item.quantity}x</span>
                                    {item.productName}
                                  </span>
                                </div>
                                {item.notes && (
                                  <p className="text-[11px] text-cyan-300 font-medium mt-0.5 italic">
                                    ★ {item.notes}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>

                  {/* Actions / Status advancing buttons */}
                  <div className="p-3 bg-[#0E1120] border-t border-[#EBE1D5]/15 flex flex-col gap-2">
                    
                    {/* Kitchen Advance Button */}
                    {(stationFilter === 'all' || stationFilter === 'cocina') && kitchenItems.length > 0 && order.stationStatus.cocina !== 'entregado' && (
                      <button
                        onClick={() => updateStationStatus(order.id, 'cocina', getNextStatus(order.stationStatus.cocina))}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                          order.stationStatus.cocina === 'recibido'
                            ? 'bg-[#7C170D] hover:bg-[#961D12] text-white border-[#EBE1D5]/30'
                            : order.stationStatus.cocina === 'en_preparacion'
                              ? 'bg-[#151946] hover:bg-[#1E235E] text-[#EBE1D5] border-[#EBE1D5]/40'
                              : 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-500/40'
                        }`}
                      >
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                        Cocina: {
                          order.stationStatus.cocina === 'recibido' ? 'Empezar Preparación' :
                          order.stationStatus.cocina === 'en_preparacion' ? 'Marcar como Listo' : 'Marcar como Entregado'
                        }
                      </button>
                    )}

                    {/* Bar Advance Button */}
                    {(stationFilter === 'all' || stationFilter === 'bar') && barItems.length > 0 && order.stationStatus.bar !== 'entregado' && (
                      <button
                        onClick={() => updateStationStatus(order.id, 'bar', getNextStatus(order.stationStatus.bar))}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                          order.stationStatus.bar === 'recibido'
                            ? 'bg-[#151946] hover:bg-[#1E235E] text-[#EBE1D5] border-[#EBE1D5]/30'
                            : order.stationStatus.bar === 'en_preparacion'
                              ? 'bg-cyan-700 hover:bg-cyan-600 text-white border-cyan-500/40'
                              : 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-500/40'
                        }`}
                      >
                        <Wine className="w-3.5 h-3.5" />
                        Bar: {
                          order.stationStatus.bar === 'recibido' ? 'Servir Bebidas' :
                          order.stationStatus.bar === 'en_preparacion' ? 'Bebidas Listas' : 'Marcar como Entregado'
                        }
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
