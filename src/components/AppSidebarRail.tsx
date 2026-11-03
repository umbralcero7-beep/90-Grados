import React from 'react';
import { 
  Store, 
  UtensilsCrossed, 
  ChefHat, 
  Receipt, 
  Boxes, 
  FileSpreadsheet, 
  Sliders, 
  Cpu,
  Crown
} from 'lucide-react';
import { MainView } from './AppSidebar';
import { useApp } from '../context/AppContext';

interface AppSidebarRailProps {
  activeView: MainView;
  onSelectView: (view: MainView) => void;
}

export const AppSidebarRail: React.FC<AppSidebarRailProps> = ({ 
  activeView, 
  onSelectView 
}) => {
  const { canUserAccessModule } = useApp();

  const allItems: Array<{
    id: MainView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tooltip: string;
  }> = [
    { id: 'owner_dashboard', label: 'Dueño', icon: Crown, tooltip: 'Panel Exclusivo del Dueño & Auditoría' },
    { id: 'pos', label: 'Mesas', icon: Store, tooltip: 'Caja & Punto de Venta (Mesas)' },
    { id: 'waiter', label: 'Meseros', icon: UtensilsCrossed, tooltip: 'Comandero Móvil de Meseros' },
    { id: 'kds', label: 'Cocina', icon: ChefHat, tooltip: 'Pantalla de Cocina & Bar (KDS)' },
    { id: 'shifts', label: 'Caja', icon: Receipt, tooltip: 'Caja, Turnos & Cortes X/Z' },
    { id: 'inventory', label: 'Stock', icon: Boxes, tooltip: 'Inventario & Costos' },
    { id: 'ledger', label: 'Gastos', icon: FileSpreadsheet, tooltip: 'Gastos & Libro Mayor' },
    { id: 'settings', label: 'Ajustes', icon: Sliders, tooltip: 'Configuración & Permisos de Rol' },
    { id: 'preflight', label: 'Estado', icon: Cpu, tooltip: 'Diagnóstico Preflight & Docker' },
  ];

  const visibleItems = allItems.filter(item => canUserAccessModule(item.id));

  return (
    <aside 
      className="w-16 sm:w-18 shrink-0 sidebar-unified-gradient border-r border-[#4B3438] flex flex-col items-center py-3 select-none z-30 shadow-2xl"
      aria-label="Barra lateral de navegación"
    >
      <nav className="w-full flex flex-col items-center gap-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              title={item.tooltip}
              aria-label={item.tooltip}
              className={`
                w-12 sm:w-14 h-13 rounded-xl flex flex-col items-center justify-center gap-1
                transition-all duration-150 cursor-pointer group relative
                ${isActive 
                  ? 'bg-[#200607] border border-[#C53747] text-white shadow-lg shadow-black/50 font-bold ring-1 ring-[#C53747]/60' 
                  : 'text-[#C4C0C5] hover:text-white hover:bg-[#200607]/70 border border-transparent hover:border-[#4B3438]'
                }
              `}
            >
              <Icon 
                className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                  isActive ? 'text-[#C53747]' : 'text-[#666992] group-hover:text-white'
                }`} 
              />
              <span className={`text-[10px] tracking-tight leading-none ${isActive ? 'text-white font-bold' : 'text-[#C4C0C5] group-hover:text-white'}`}>
                {item.label}
              </span>

              {/* Active left indicator pill */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r bg-[#C53747] border-r border-white/40" />
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
