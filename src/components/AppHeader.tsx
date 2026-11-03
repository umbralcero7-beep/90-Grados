import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { 
  BarChart3, 
  Moon, 
  ChevronDown, 
  User, 
  LogOut, 
  Search, 
  X, 
  Sliders, 
  Sparkles,
  UtensilsCrossed,
  Check
} from 'lucide-react';

interface AppHeaderProps {
  onOpenSalesChart: () => void;
  onOpenProfile: (tab?: 'profile' | 'directory' | 'create') => void;
  onSelectView?: (view: any) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ 
  onOpenSalesChart, 
  onOpenProfile,
  onSelectView
}) => {
  const { currentUser, allUsers, switchUser, currentShift, logout } = useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  const userButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ right: number; top: number } | null>(null);

  // Calculate dynamic position for the user menu dropdown
  const updateMenuPosition = () => {
    if (!userButtonRef.current) return;
    const rect = userButtonRef.current.getBoundingClientRect();
    const right = Math.max(12, window.innerWidth - rect.right);
    const top = rect.bottom + 8;
    setMenuPosition({ right, top });
  };

  useEffect(() => {
    if (dropdownOpen) {
      updateMenuPosition();
      const handleResize = () => updateMenuPosition();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [dropdownOpen]);

  // Click outside and ESC key to close
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
      if (e.key === 'Escape' && dropdownOpen) {
        setDropdownOpen(false);
        userButtonRef.current?.focus();
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

  // Filter staff list
  const filteredUsers = allUsers.filter(u => 
    u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  // Avatar initials fallback
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="w-full shrink-0 z-40 bg-[#200607] border-b border-[#4B3438] text-[#F4F1F1] select-none header-brand-gradient">
      <div className="w-full px-3 sm:px-5 h-14 flex items-center justify-between gap-3">
        
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          {/* 90° Gastro Bar Brand Emblem */}
          <div className="w-10 h-10 rounded-xl bg-[#000100] border border-[#4B3438] flex items-center justify-center text-[#F4F1F1] shadow-md shrink-0 overflow-hidden p-0.5">
            <img 
              src="/assets/aistudio/FullLogo_dd4cd38a.jpg" 
              alt="90 Grados Gastro Bar" 
              className="w-full h-full object-cover rounded-lg"
              onError={(e) => {
                // Fallback to cutlery icon if image fails
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <UtensilsCrossed className="w-4 h-4 text-[#F4F1F1] hidden" />
          </div>

          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-lg font-black tracking-tight text-white font-sans">
                90 Grados
              </span>
              <span className="text-lg font-black tracking-tight text-[#C53747]">
                POS
              </span>
            </div>
            <span className="text-[9px] uppercase tracking-widest text-[#C4C0C5] font-semibold block mt-0.5 font-mono">
              SABORES QUE CONECTAN
            </span>
          </div>

          {/* Operational Shift Status Indicator */}
          {currentShift ? (
            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-[#C4C0C5] bg-[#010102] border border-[#4B3438] px-2.5 py-1 rounded-full ml-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{currentShift.center}</span>
            </span>
          ) : (
            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-[#F4F1F1] bg-[#C53747]/20 border border-[#C53747]/40 px-2.5 py-1 rounded-full ml-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F4F1F1]/60" />
              <span>Caja sin abrir</span>
            </span>
          )}
        </div>

        {/* Right: Quick Tools & User Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Gráfica Ventas Button */}
          <button
            onClick={onOpenSalesChart}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#F4F1F1] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Ver gráfica analítica de ventas diarias"
          >
            <BarChart3 className="w-4 h-4 text-[#C53747]" />
            <span className="hidden sm:inline">Gráfica Ventas</span>
          </button>

          {/* Dark Mode Icon */}
          <div 
            className="p-1.5 text-[#C4C0C5] hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="Modo Oscuro Operativo Activo"
          >
            <Moon className="w-4 h-4" />
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-white/15" />

          {/* User Profile Pill Trigger */}
          <div className="relative">
            <button
              ref={userButtonRef}
              onClick={() => {
                setDropdownOpen(prev => !prev);
                setUserSearchQuery('');
              }}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              title="Abrir menú de usuario"
              className={`flex items-center gap-2.5 px-2.5 py-1 rounded-full border transition-all cursor-pointer group ${
                dropdownOpen 
                  ? 'bg-[#010102] border-[#C53747] ring-2 ring-[#C53747]/30' 
                  : 'bg-[#010102] border-[#4B3438] hover:border-[#C53747]/60'
              }`}
            >
              {/* Avatar circle with Initials or photo */}
              <div className="w-7 h-7 rounded-full bg-[#200607] border border-[#C53747] flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden shadow-sm">
                {currentUser.avatarUrl && !currentUser.avatarUrl.includes('placeholder') ? (
                  <img 
                    src={currentUser.avatarUrl} 
                    alt={currentUser.fullName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span>{getInitials(currentUser.fullName)}</span>
                )}
              </div>

              {/* User text labels */}
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-white leading-tight group-hover:text-[#EBE1D5] transition-colors truncate max-w-[130px]">
                  {currentUser.fullName}
                </p>
                <p className="text-[10px] text-[#A6AFCA] capitalize leading-none mt-0.5">
                  {currentUser.role.replace('_', ' ')}
                </p>
              </div>

              <ChevronDown className={`w-3.5 h-3.5 text-[#A6AFCA] group-hover:text-white transition-transform duration-200 ${dropdownOpen ? 'rotate-180 text-white' : ''}`} />
            </button>
          </div>

        </div>

      </div>

      {/* =================================================================== */}
      {/* PORTAL USER MENU DROPDOWN                                           */}
      {/* Renders right below button aligned to the right, inside the window! */}
      {/* =================================================================== */}
      {dropdownOpen && menuPosition && createPortal(
        <div
          ref={dropdownRef}
          role="menu"
          aria-orientation="vertical"
          aria-label="Menú de perfil y cambio de usuario"
          className="fixed rounded-2xl bg-[#010102] border border-[#4B3438] shadow-2xl p-3 z-[99999] w-80 max-w-[calc(100vw-1.5rem)] text-[#F4F1F1] divide-y divide-[#4B3438] animate-in fade-in zoom-in-95"
          style={{
            right: `${menuPosition.right}px`,
            top: `${menuPosition.top}px`,
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(75, 52, 56, 0.4)',
            maxHeight: 'calc(100vh - 5rem)',
            overflowY: 'auto'
          }}
        >
          {/* Active Profile Info */}
          <div className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#200607] border-2 border-[#C53747] flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden shadow">
                {currentUser.avatarUrl && !currentUser.avatarUrl.includes('placeholder') ? (
                  <img 
                    src={currentUser.avatarUrl} 
                    alt={currentUser.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{getInitials(currentUser.fullName)}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {currentUser.fullName}
                </p>
                <p className="text-[11px] font-mono text-[#C4C0C5] mt-0.5">
                  @{currentUser.username}
                </p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#200607] border border-[#4B3438] text-[#F4F1F1]">
                  {currentUser.role.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Quick Actions: Mi perfil & Cerrar sesión */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  onOpenProfile('profile');
                }}
                className="py-1.5 px-2.5 rounded-lg bg-[#200607] hover:bg-[#2b0b0d] text-[#F4F1F1] text-xs font-bold border border-[#4B3438] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <User className="w-3.5 h-3.5 text-[#C53747]" />
                <span>Mi perfil</span>
              </button>

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }}
                className="py-1.5 px-2.5 rounded-lg bg-[#C53747]/20 hover:bg-[#C53747]/30 text-white border border-[#C53747]/60 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5 text-[#C53747]" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>

          {/* Quick User Switcher Section */}
          <div className="py-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A6AFCA]">
                Cambiar de Usuario ({allUsers.length})
              </span>
              <span className="text-[10px] font-mono text-stone-500">
                ESC para salir
              </span>
            </div>

            {/* Search filter for staff */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#A6AFCA] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o rol..."
                className="w-full pl-8 pr-7 py-1.5 bg-[#080A16] border border-[#23294C] rounded-lg text-xs text-white placeholder-[#71788E] focus:outline-none focus:border-[#7C170D]"
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

            {/* List of staff members */}
            <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5 scrollbar-thin">
              {filteredUsers.map((u) => {
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
                        ? 'bg-[#151946] border border-[#2D3560] text-white font-semibold' 
                        : 'hover:bg-[#151946]/40 border border-transparent text-[#A6AFCA]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-[#151946] border border-[#2D3560] flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden">
                        {u.avatarUrl && !u.avatarUrl.includes('placeholder') ? (
                          <img src={u.avatarUrl} alt={u.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <span>{getInitials(u.fullName)}</span>
                        )}
                      </div>
                      <div className="truncate">
                        <span className="text-white block truncate font-medium">{u.fullName}</span>
                        <span className="text-[10px] text-[#A6AFCA] capitalize">@{u.username} · {u.role}</span>
                      </div>
                    </div>

                    {active && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold shrink-0">
                        Activo
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Links */}
          <div className="pt-2 space-y-1">
            {onSelectView && (
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  onSelectView('settings');
                }}
                className="w-full py-1.5 px-2.5 rounded-lg hover:bg-[#151946]/50 text-xs text-[#EBE1D5] transition-colors flex items-center gap-2 cursor-pointer font-medium"
              >
                <Sliders className="w-3.5 h-3.5 text-[#EBE1D5]" />
                <span>Configuración de Permisos</span>
              </button>
            )}
            <button
              onClick={() => {
                setDropdownOpen(false);
                onOpenProfile('directory');
              }}
              className="w-full py-1.5 px-2.5 rounded-lg hover:bg-[#151946]/50 text-xs text-[#A6AFCA] hover:text-white transition-colors flex items-center gap-2 cursor-pointer font-medium"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#A6AFCA]" />
              <span>Directorio del Personal</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};
