import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { 
  User, 
  ChevronRight, 
  Sparkles, 
  LogOut, 
  Check, 
  Wifi, 
  Clock,
  ShieldCheck,
  Sliders,
  Search,
  X,
  Menu,
  ChevronLeft,
  Store,
  UtensilsCrossed,
  ChefHat,
  Receipt,
  Boxes,
  FileSpreadsheet,
  Cpu,
  AlertCircle,
  Crown
} from 'lucide-react';

export type MainView = 'pos' | 'waiter' | 'kds' | 'shifts' | 'inventory' | 'ledger' | 'settings' | 'preflight' | 'owner_dashboard';

interface AppSidebarProps {
  activeView: MainView;
  onSelectView: (view: MainView) => void;
  onOpenProfile: (tab?: 'profile' | 'directory' | 'create') => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ 
  activeView, 
  onSelectView, 
  onOpenProfile 
}) => {
  const { currentUser, allUsers, switchUser, currentShift, isOnline, config, canUserAccessModule, logout } = useApp();
  
  // UI States
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  // Refs for positioning and click-outside
  const userButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [menuCoords, setMenuCoords] = useState<{ left: number; top: number; bottom: number } | null>(null);

  // Calculate position for the portal dropdown when opened
  const updateMenuPosition = () => {
    if (!userButtonRef.current) return;
    const rect = userButtonRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      // On mobile, position near bottom center or right
      setMenuCoords({
        left: Math.max(16, Math.min(rect.left, window.innerWidth - 340)),
        top: Math.max(16, rect.top - 460),
        bottom: window.innerHeight - rect.bottom
      });
    } else {
      // On desktop left sidebar, position directly to the right of the button
      const left = isCollapsed ? rect.right + 12 : rect.right + 14;
      // Position vertically aligned with the button's bottom, clamped to viewport
      const top = Math.max(16, Math.min(rect.top - 200, window.innerHeight - 520));
      setMenuCoords({
        left: Math.min(left, window.innerWidth - 360),
        top,
        bottom: window.innerHeight - rect.bottom
      });
    }
  };

  useEffect(() => {
    if (dropdownOpen) {
      updateMenuPosition();
      const handleResize = () => updateMenuPosition();
      const handleScroll = () => updateMenuPosition();
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, [dropdownOpen, isCollapsed]);

  // Click outside and ESC key to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(target) &&
        userButtonRef.current && 
        !userButtonRef.current.contains(target)
      ) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dropdownOpen) {
          setDropdownOpen(false);
          userButtonRef.current?.focus();
        } else if (isMobileOpen) {
          setIsMobileOpen(false);
        }
      }
    };

    if (dropdownOpen || isMobileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen, isMobileOpen]);

  // Filter users for quick switcher
  const filteredUsers = allUsers.filter(u => 
    u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const allNavItems: Array<{
    id: MainView;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }> = [
    { id: 'owner_dashboard', label: 'Panel del Dueño', shortLabel: 'Dueño', icon: Crown },
    { id: 'pos', label: 'Caja & POS', shortLabel: 'POS', icon: Store },
    { id: 'waiter', label: 'Comandero Meseros', shortLabel: 'Meseros', icon: UtensilsCrossed },
    { id: 'kds', label: 'Cocina & Bar (KDS)', shortLabel: 'KDS', icon: ChefHat },
    { id: 'shifts', label: 'Caja, Turnos & Cortes', shortLabel: 'Turnos', icon: Receipt },
    { id: 'inventory', label: 'Inventario & Costos', shortLabel: 'Inventario', icon: Boxes },
    { id: 'ledger', label: 'Gastos & Libro Mayor', shortLabel: 'Gastos', icon: FileSpreadsheet },
    { id: 'settings', label: 'Configuración & Permisos', shortLabel: 'Config', icon: Sliders },
    { id: 'preflight', label: 'Diagnóstico Preflight', shortLabel: 'Preflight', icon: Cpu },
  ];

  const navItems = allNavItems.filter(item => canUserAccessModule(item.id));

  const handleSelectNav = (view: MainView) => {
    onSelectView(view);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* ============================================================== */}
      {/* MOBILE COMPACT TOPBAR (< md)                                    */}
      {/* Shows hamburger, 90 Grados title, shift badge, user avatar      */}
      {/* ============================================================== */}
      <header className="md:hidden sticky top-0 z-40 bg-[#0B0D18] border-b border-[#EBE1D5]/20 text-[#EBE1D5] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileOpen(true)}
            aria-label="Abrir menú de navegación lateral"
            className="p-2 -ml-1 text-[#EBE1D5]/80 hover:text-white rounded-lg hover:bg-[#151946]/50 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0D1024] border border-[#7C170D] flex items-center justify-center p-0.5 shadow-md">
              <img src="/favicon.svg" alt="90°" className="w-full h-full object-contain" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-white">90 Grados</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {currentShift ? (
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{currentShift.center.split(' ')[0]}</span>
            </span>
          ) : (
            <button 
              onClick={() => onSelectView('shifts')}
              className="text-[11px] text-[#EBE1D5] bg-[#7C170D]/40 border border-[#7C170D] px-2 py-0.5 rounded-md font-semibold cursor-pointer"
            >
              Abrir Turno
            </button>
          )}

          <button
            onClick={() => {
              setDropdownOpen(prev => !prev);
              setUserSearchQuery('');
            }}
            className="w-8 h-8 rounded-full border border-[#7C170D] overflow-hidden bg-[#151946] cursor-pointer"
            aria-label="Abrir menú de usuario"
          >
            <img 
              src={currentUser.avatarUrl} 
              alt={currentUser.fullName}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/src/assets/images/avatar_chef_patron_1792183524504.jpg';
              }}
            />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Backdrop Overlay */}
      {isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-50 transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* ============================================================== */}
      {/* PRIMARY LEFT SIDEBAR PANEL                                      */}
      {/* Persistent on md+, Drawer on mobile                             */}
      {/* ============================================================== */}
      <aside 
        className={`
          fixed md:static inset-y-0 left-0 z-50 md:z-30
          flex flex-col sidebar-unified-gradient border-r border-[#EBE1D5]/20 text-[#EBE1D5]
          transition-all duration-300 ease-in-out select-none shadow-2xl
          ${isMobileOpen ? 'translate-x-0 w-72 shadow-2xl' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-20' : 'md:w-64 xl:w-72'}
        `}
      >
        {/* Top Header Section of Left Panel: Brand & Shift Info */}
        <div className="p-4 border-b border-[#EBE1D5]/15 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => handleSelectNav('pos')}
              className="flex items-center gap-2.5 text-left group cursor-pointer overflow-hidden"
              title="90 Grados Gastrobar POS"
            >
              <div className="w-9 h-9 rounded-xl bg-[#0D1024] border-2 border-[#7C170D] flex items-center justify-center p-1 shadow-md shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
                <img src="/favicon.svg" alt="90° POS" className="w-full h-full object-contain" />
              </div>
              
              {!isCollapsed && (
                <div className="truncate">
                  <span className="text-base font-extrabold tracking-tight text-[#EBE1D5] block group-hover:text-white transition-colors">
                    90 Grados
                  </span>
                  <span className="text-[10px] text-[#A6AFCA] block -mt-0.5 tracking-wider uppercase font-semibold">
                    Gastrobar POS
                  </span>
                </div>
              )}
            </button>

            {/* Mobile close button */}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="md:hidden p-1.5 text-[#EBE1D5]/70 hover:text-[#EBE1D5] rounded-lg hover:bg-[#151946]/60 cursor-pointer"
              aria-label="Cerrar panel"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Desktop collapse / expand button */}
            <button
              onClick={() => setIsCollapsed(prev => !prev)}
              className="hidden md:flex p-1.5 text-[#EBE1D5]/70 hover:text-[#EBE1D5] hover:bg-[#151946]/60 rounded-lg transition-colors cursor-pointer"
              title={isCollapsed ? 'Expandir panel lateral' : 'Colapsar panel lateral'}
              aria-label={isCollapsed ? 'Expandir panel lateral' : 'Colapsar panel lateral'}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Operational Shift Pill (Full or Mini) */}
          {!isCollapsed ? (
            <div className="rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20 p-2.5 flex items-center justify-between gap-2 shadow-inner">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${currentShift ? 'bg-emerald-500 animate-pulse' : 'bg-[#7C170D]'}`} />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-white truncate leading-tight">
                    {currentShift ? currentShift.center : 'Sin turno activo'}
                  </p>
                  <p className="text-[10px] text-[#A6AFCA] font-mono leading-none mt-0.5 truncate">
                    {currentShift ? `Abierto: @${currentShift.openedByUserName.split(' ')[0]}` : 'Caja cerrada'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleSelectNav('shifts')}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer shrink-0 border ${
                  currentShift 
                    ? 'bg-[#151946] hover:bg-[#1C2258] text-[#EBE1D5] border-[#EBE1D5]/20' 
                    : 'bg-[#7C170D] hover:bg-[#961D12] text-white border-[#EBE1D5]/30'
                }`}
              >
                {currentShift ? 'Cortes' : 'Abrir'}
              </button>
            </div>
          ) : (
            <div 
              onClick={() => handleSelectNav('shifts')}
              className="flex justify-center cursor-pointer"
              title={currentShift ? `Turno activo: ${currentShift.center}` : 'Caja sin abrir (Haga clic para abrir)'}
            >
              <span className={`w-3 h-3 rounded-full ${currentShift ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-[#7C170D]'}`} />
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* Navigation Items (Vertical List)                              */}
        {/* ============================================================== */}
        <nav className="flex-1 overflow-y-auto overscroll-contain py-3 px-2 sm:px-3 space-y-1.5 scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleSelectNav(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs
                  transition-all duration-150 cursor-pointer group text-left relative
                  ${isActive 
                    ? 'bg-[#121524] text-[#EBE1D5] font-bold border border-[#EBE1D5]/50 shadow-md ring-1 ring-[#7C170D]/60' 
                    : 'text-[#EBE1D5]/70 hover:text-white hover:bg-[#121524]/60'
                  }
                  ${isCollapsed ? 'justify-center px-0' : ''}
                `}
              >
                <Icon className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-105 ${isActive ? 'text-[#EBE1D5]' : 'text-[#A6AFCA] group-hover:text-white'}`} />
                
                {!isCollapsed && (
                  <span className="truncate flex-1 tracking-tight">
                    {item.label}
                  </span>
                )}

                {/* Subtle active indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r bg-[#7C170D] border-r border-[#EBE1D5]/40" />
                )}
              </button>
            );
          })}
        </nav>

        {/* System Online / Diagnostics pill */}
        {!isCollapsed && (
          <div className="px-4 py-2 border-t border-[#EBE1D5]/15 flex items-center justify-between text-[11px] text-[#A6AFCA]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Red Local Activa</span>
            </span>
            <span className="font-mono text-[10px] text-[#A6AFCA]/70">v2.5 Local</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* BOTTOM USER PROFILE CARD & QUICK SWITCHER TRIGGER              */}
        {/* Guaranteed to be visible, fully accessible, high z-index      */}
        {/* ============================================================== */}
        <div className="p-3 border-t border-[#EBE1D5]/15 bg-[#0B0D18]/90 shrink-0">
          <button
            ref={userButtonRef}
            onClick={() => {
              setDropdownOpen(prev => !prev);
              setUserSearchQuery('');
            }}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
            title="Abrir menú de usuario y cambio de rol"
            className={`
              w-full flex items-center gap-2.5 p-2 rounded-xl transition-all cursor-pointer group text-left
              ${dropdownOpen 
                ? 'bg-[#151946] border border-[#7C170D] ring-2 ring-[#7C170D]/40 shadow-lg' 
                : 'hover:bg-[#121524] border border-[#EBE1D5]/20'
              }
              ${isCollapsed ? 'justify-center p-1.5' : ''}
            `}
          >
            <div className="relative shrink-0">
              <img 
                src={currentUser.avatarUrl} 
                alt={currentUser.fullName}
                className="w-9 h-9 rounded-full object-cover border border-[#7C170D] bg-[#0E1120] shadow"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/src/assets/images/avatar_chef_patron_1792183524504.jpg';
                }}
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0B0D18]" />
            </div>

            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate leading-tight group-hover:text-[#EBE1D5] transition-colors">
                  {currentUser.fullName}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-mono text-[#EBE1D5] capitalize">
                    {currentUser.role.replace('_', ' ')}
                  </span>
                  <span className="text-stone-600">·</span>
                  <span className="text-[10px] text-[#A6AFCA] font-mono truncate">
                    @{currentUser.username}
                  </span>
                </div>
              </div>
            )}

            {!isCollapsed && (
              <ChevronRight className={`w-4 h-4 text-[#A6AFCA] group-hover:text-white transition-transform ${dropdownOpen ? 'rotate-90 text-[#EBE1D5]' : ''}`} />
            )}
          </button>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* PORTAL USER MENU DROPDOWN                                      */}
      {/* Renders at document.body with fixed positioning & z-[99999]     */}
      {/* NEVER clipped by overflow:hidden, parent margins or tables!     */}
      {/* ============================================================== */}
      {dropdownOpen && menuCoords && createPortal(
        <div
          ref={dropdownRef}
          role="menu"
          aria-orientation="vertical"
          aria-label="Menú de perfil y cambio de usuario"
          className="fixed rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 shadow-2xl p-3 z-[99999] w-80 sm:w-88 max-w-[calc(100vw-2rem)] text-[#EBE1D5] divide-y divide-[#EBE1D5]/15 animate-in fade-in zoom-in-95"
          style={{
            left: `${menuCoords.left}px`,
            top: `${menuCoords.top}px`,
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(235, 225, 213, 0.15)',
            maxHeight: 'calc(100vh - 2rem)',
            overflowY: 'auto'
          }}
        >
          {/* Active Profile Header */}
          <div className="pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#EBE1D5]">
                Usuario Activo
              </span>
              <button
                onClick={() => setDropdownOpen(false)}
                className="text-[#A6AFCA] hover:text-white p-1 rounded hover:bg-white/10 cursor-pointer"
                title="Cerrar menú (ESC)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <img 
                  src={currentUser.avatarUrl} 
                  alt={currentUser.fullName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#7C170D] shadow"
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0E1120]" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {currentUser.fullName}
                </p>
                <p className="text-[11px] font-mono text-[#EBE1D5] mt-0.5">
                  @{currentUser.username}
                </p>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#7C170D]/20 border border-[#7C170D]/60 text-[#EBE1D5]">
                    {currentUser.role.replace('_', ' ')}
                  </span>
                  {currentUser.role === 'administrador' && (
                    <span className="text-[10px] text-emerald-400 font-medium">
                      Control Total
                    </span>
                  )}
                </div>
              </div>
            </div>

            {currentUser.bio && (
              <p className="text-[11px] text-[#EBE1D5]/90 mt-2.5 line-clamp-2 italic bg-[#0B0D18] p-2 rounded-lg border border-[#EBE1D5]/15">
                "{currentUser.bio}"
              </p>
            )}

            {/* Primary Profile Actions */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  onOpenProfile('profile');
                }}
                className="py-2 px-3 rounded-xl bg-[#7C170D] text-white text-xs font-bold hover:bg-[#961D12] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 border border-[#EBE1D5]/30"
              >
                <User className="w-3.5 h-3.5" />
                <span>Mi Perfil</span>
              </button>

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }}
                className="py-2 px-3 rounded-xl bg-[#7C170D]/20 hover:bg-[#7C170D]/40 text-[#EBE1D5] hover:text-white border border-[#7C170D]/50 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>

          {/* Quick Switch section with Search */}
          <div className="py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A6AFCA]">
                Cambiar de Usuario ({allUsers.length})
              </span>
              <span className="text-[10px] font-mono text-[#A6AFCA]/70">
                ESC para salir
              </span>
            </div>

            {/* Search filter for staff */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#71788E] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, usuario o rol..."
                className="w-full pl-8 pr-7 py-1.5 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-xs text-white placeholder-[#71788E] focus:outline-none focus:border-[#7C170D]"
              />
              {userSearchQuery && (
                <button
                  onClick={() => setUserSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            
            {/* Scrollable list of users */}
            <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5 scrollbar-thin">
              {filteredUsers.length === 0 ? (
                <p className="text-center py-3 text-xs text-[#71788E]">
                  No hay usuarios con "{userSearchQuery}"
                </p>
              ) : (
                filteredUsers.map((u) => {
                  const active = u.id === currentUser.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => {
                        switchUser(u.id);
                        setDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                        active 
                          ? 'bg-[#151946] border border-[#7C170D] text-white font-semibold' 
                          : 'hover:bg-[#151946]/50 border border-transparent text-[#EBE1D5]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img 
                          src={u.avatarUrl} 
                          alt={u.fullName}
                          className="w-7 h-7 rounded-full object-cover border border-[#EBE1D5]/30 shrink-0"
                        />
                        <div className="truncate">
                          <span className="text-white block truncate font-medium">{u.fullName}</span>
                          <div className="flex items-center gap-1.5 text-[10px] text-[#A6AFCA] font-mono">
                            <span>@{u.username}</span>
                            <span>·</span>
                            <span className="capitalize">{u.role.replace('_', ' ')}</span>
                          </div>
                        </div>
                      </div>
                      {active && (
                        <span className="px-1.5 py-0.5 rounded bg-[#7C170D] text-white text-[10px] font-bold shrink-0">
                          Activo
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick shortcuts to Settings & Directory */}
          <div className="pt-2 space-y-1">
            <button
              onClick={() => {
                setDropdownOpen(false);
                handleSelectNav('settings');
              }}
              className="w-full py-2 px-2.5 rounded-lg hover:bg-[#151946] text-xs text-[#EBE1D5] hover:text-white transition-colors flex items-center gap-2 cursor-pointer font-semibold"
            >
              <Sliders className="w-3.5 h-3.5 text-[#EBE1D5]" /> 
              <span>Configuración & Permisos por Rol</span>
            </button>
            <button
              onClick={() => {
                setDropdownOpen(false);
                onOpenProfile('directory');
              }}
              className="w-full py-2 px-2.5 rounded-lg hover:bg-[#151946] text-xs text-[#A6AFCA] hover:text-white transition-colors flex items-center gap-2 cursor-pointer font-medium"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#A6AFCA]" /> 
              <span>Directorio del Personal (90 Grados)</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
