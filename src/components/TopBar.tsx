import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  User, 
  ChevronDown, 
  Sparkles, 
  LogOut, 
  Check, 
  Wifi, 
  WifiOff, 
  Clock,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Search,
  X
} from 'lucide-react';

interface TopBarProps {
  activeView: 'pos' | 'waiter' | 'kds' | 'shifts' | 'inventory' | 'ledger' | 'settings' | 'preflight';
  onSelectView: (view: 'pos' | 'waiter' | 'kds' | 'shifts' | 'inventory' | 'ledger' | 'settings' | 'preflight') => void;
  onOpenProfile: (tab?: 'profile' | 'directory' | 'create') => void;
}

export const TopBar: React.FC<TopBarProps> = ({ activeView, onSelectView, onOpenProfile }) => {
  const { currentUser, allUsers, switchUser, currentShift, isOnline } = useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && 
        !buttonRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  // Filter users for quick switcher
  const filteredUsers = allUsers.filter(u => 
    u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  return (
    <header className="sticky top-0 z-50 bg-[#0B0D18] backdrop-blur-md border-b border-[#EBE1D5]/20 text-[#EBE1D5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-6 h-16">
        
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => onSelectView('pos')} 
            className="text-xl font-extrabold tracking-tight text-white hover:text-[#EBE1D5] transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
          >
            <span className="w-8 h-8 rounded-lg bg-[#0D1024] border border-[#7C170D] text-[#EBE1D5] font-black flex items-center justify-center text-sm shadow-md">
              90°
            </span>
            <span>90 Grados</span>
          </button>
          
          {/* Subtle Shift indicator */}
          {currentShift ? (
            <span className="hidden lg:inline-flex items-center gap-1.5 text-xs text-[#A6AFCA] bg-[#0E1120] border border-[#EBE1D5]/20 px-2.5 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>{currentShift.center}</span>
            </span>
          ) : (
            <span className="hidden lg:inline-flex items-center gap-1.5 text-xs text-[#EBE1D5] bg-[#7C170D]/30 border border-[#7C170D] px-2.5 py-1 rounded-md">
              <span>Caja sin abrir</span>
            </span>
          )}
        </div>

        {/* Zone 2: Navigation links */}
        <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-[#A6AFCA]">
          <button
            onClick={() => onSelectView('pos')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              activeView === 'pos' 
                ? 'text-[#EBE1D5] font-bold border-b-2 border-[#7C170D]' 
                : 'hover:text-white'
            }`}
          >
            Caja & POS
          </button>

          <button
            onClick={() => onSelectView('waiter')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeView === 'waiter' 
                ? 'text-[#EBE1D5] font-bold border-b-2 border-[#7C170D]' 
                : 'hover:text-white'
            }`}
          >
            <span>🍽️ Comandero Meseros</span>
          </button>

          <button
            onClick={() => onSelectView('kds')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              activeView === 'kds' 
                ? 'text-[#EBE1D5] font-bold border-b-2 border-[#7C170D]' 
                : 'hover:text-white'
            }`}
          >
            Cocina & Bar (KDS)
          </button>

          <button
            onClick={() => onSelectView('shifts')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              activeView === 'shifts' 
                ? 'text-[#EBE1D5] font-bold border-b-2 border-[#7C170D]' 
                : 'hover:text-white'
            }`}
          >
            Caja & Turnos
          </button>

          <button
            onClick={() => onSelectView('inventory')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              activeView === 'inventory' 
                ? 'text-[#EBE1D5] font-bold border-b-2 border-[#7C170D]' 
                : 'hover:text-white'
            }`}
          >
            Inventario & Costos
          </button>

          <button
            onClick={() => onSelectView('ledger')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              activeView === 'ledger' 
                ? 'text-[#EBE1D5] font-bold border-b-2 border-[#7C170D]' 
                : 'hover:text-white'
            }`}
          >
            Control de Gastos & Libro
          </button>

          <button
            onClick={() => onSelectView('settings')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeView === 'settings' 
                ? 'text-[#EBE1D5] font-bold border-b-2 border-[#7C170D]' 
                : 'hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Configuración</span>
          </button>

          <button
            onClick={() => onSelectView('preflight')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 text-xs text-[#A6AFCA] hover:text-[#EBE1D5] cursor-pointer ${
              activeView === 'preflight' ? 'text-[#EBE1D5] font-bold border-b-2 border-[#7C170D]' : ''
            }`}
          >
            Preflight / Docker
          </button>
        </nav>

        {/* Zone 3: 1 primary action - User Profile & Switcher */}
        <div className="relative shrink-0">
          <button
            ref={buttonRef}
            onClick={() => {
              setDropdownOpen(prev => !prev);
              setUserSearchQuery('');
            }}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
            title="Abrir menú de usuario y cambio de rol"
            className={`flex items-center gap-2.5 p-1.5 pl-2 pr-3 rounded-full bg-[#0E1120] border transition-all cursor-pointer group select-none ${
              dropdownOpen 
                ? 'border-[#7C170D] bg-[#151946] ring-2 ring-[#7C170D]/30' 
                : 'border-[#EBE1D5]/20 hover:border-[#7C170D]/60 hover:bg-[#151946]'
            }`}
          >
            <div className="relative shrink-0">
              <img 
                src={currentUser.avatarUrl} 
                alt={currentUser.fullName}
                className="w-8 h-8 rounded-full object-cover border border-[#7C170D] bg-[#0E1120]"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/src/assets/images/avatar_chef_patron_1792183524504.jpg';
                }}
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0B0D18]" />
            </div>

            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-white group-hover:text-[#EBE1D5] transition-colors leading-none truncate max-w-[120px]">
                {currentUser.fullName.split(' ')[0]}
              </div>
              <div className="text-[10px] font-mono text-[#A6AFCA] mt-0.5 leading-none capitalize">
                {currentUser.role.replace('_', ' ')}
              </div>
            </div>

            <ChevronDown className={`w-3.5 h-3.5 text-[#A6AFCA] group-hover:text-white transition-transform duration-200 ${dropdownOpen ? 'rotate-180 text-white' : ''}`} />
          </button>

          {/* Quick User Dropdown - Strictly Opens Inward (right-0) with z-[100] */}
          {dropdownOpen && (
            <div 
              ref={dropdownRef}
              role="menu"
              aria-orientation="vertical"
              className="absolute right-0 top-full mt-2 w-80 sm:w-88 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 shadow-2xl p-3 z-[100] animate-in fade-in zoom-in-95 origin-top-right text-[#EBE1D5] divide-y divide-[#EBE1D5]/15"
              style={{
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(235, 225, 213, 0.1)'
              }}
            >
              {/* Profile Card Header (Active User) */}
              <div className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img 
                      src={currentUser.avatarUrl} 
                      alt={currentUser.fullName}
                      className="w-11 h-11 rounded-full object-cover border-2 border-[#7C170D] shadow"
                    />
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0E1120]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate leading-tight">{currentUser.fullName}</p>
                    <p className="text-[11px] font-mono text-[#EBE1D5] mt-0.5">@{currentUser.username}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#151946] border border-[#EBE1D5]/20 text-[#EBE1D5]">
                      Rol: {currentUser.role.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {currentUser.bio && (
                  <p className="text-[11px] text-[#A6AFCA] mt-2 line-clamp-2 italic bg-[#0B0D18] p-2 rounded-lg border border-[#EBE1D5]/15">
                    "{currentUser.bio}"
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenProfile('profile');
                    }}
                    className="py-1.5 px-2.5 rounded-lg bg-[#7C170D] text-white text-xs font-bold hover:bg-[#961D12] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 border border-[#EBE1D5]/30"
                  >
                    <User className="w-3.5 h-3.5" /> Mi Perfil
                  </button>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      const otherUser = allUsers.find(u => u.id !== currentUser.id) || allUsers[0];
                      switchUser(otherUser.id);
                    }}
                    className="py-1.5 px-2.5 rounded-lg bg-[#0B0D18] hover:bg-[#151946] text-[#EBE1D5] hover:text-white border border-[#EBE1D5]/20 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
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
                    placeholder="Filtrar por nombre o rol..."
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
                <div className="space-y-1 max-h-44 overflow-y-auto pr-0.5 scrollbar-thin">
                  {filteredUsers.length === 0 ? (
                    <p className="text-center py-3 text-xs text-[#71788E]">No hay usuarios con "{userSearchQuery}"</p>
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
                              className="w-7 h-7 rounded-full object-cover border border-[#EBE1D5]/20 shrink-0"
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

              {/* System Navigation actions */}
              <div className="pt-2 space-y-1">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onSelectView('settings');
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
                  <span>Directorio y Gestión de Equipo</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex items-center justify-around border-t border-[#EBE1D5]/15 bg-[#0B0D18] px-2 py-2 text-xs overflow-x-auto gap-2">
        <button
          onClick={() => onSelectView('pos')}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap ${activeView === 'pos' ? 'bg-[#7C170D] text-white font-bold' : 'text-[#A6AFCA]'}`}
        >
          Caja/POS
        </button>
        <button
          onClick={() => onSelectView('waiter')}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap ${activeView === 'waiter' ? 'bg-[#7C170D] text-white font-bold' : 'text-[#A6AFCA]'}`}
        >
          Meseros
        </button>
        <button
          onClick={() => onSelectView('kds')}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap ${activeView === 'kds' ? 'bg-[#7C170D] text-white font-bold' : 'text-[#A6AFCA]'}`}
        >
          Cocina/Bar
        </button>
        <button
          onClick={() => onSelectView('shifts')}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap ${activeView === 'shifts' ? 'bg-[#7C170D] text-white font-bold' : 'text-[#A6AFCA]'}`}
        >
          Turnos
        </button>
        <button
          onClick={() => onSelectView('inventory')}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap ${activeView === 'inventory' ? 'bg-[#7C170D] text-white font-bold' : 'text-[#A6AFCA]'}`}
        >
          Inventario
        </button>
        <button
          onClick={() => onSelectView('ledger')}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap ${activeView === 'ledger' ? 'bg-[#7C170D] text-white font-bold' : 'text-[#A6AFCA]'}`}
        >
          Gastos & Libro
        </button>
        <button
          onClick={() => onSelectView('settings')}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap ${activeView === 'settings' ? 'bg-[#7C170D] text-white font-bold' : 'text-[#A6AFCA]'}`}
        >
          Configuración
        </button>
      </div>
    </header>
  );
};
