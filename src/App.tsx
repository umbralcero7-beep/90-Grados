/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppHeader } from './components/AppHeader';
import { AppSidebarRail } from './components/AppSidebarRail';
import { POSTerminal } from './components/POSTerminal';
import { WaiterModule } from './components/WaiterModule';
import { KDSKitchenBar } from './components/KDSKitchenBar';
import { ShiftsAndCaja } from './components/ShiftsAndCaja';
import { InventoryAndEscandallos } from './components/InventoryAndEscandallos';
import { GastosLibroMayor } from './components/GastosLibroMayor';
import { AdminConfigView } from './components/AdminConfigView';
import { LocalPreflightAndScripts } from './components/LocalPreflightAndScripts';
import { UserProfileModal } from './components/UserProfileModal';
import { DailySalesChart } from './components/DailySalesChart';
import { MainView } from './components/AppSidebar';
import { LoginScreen } from './components/LoginScreen';
import { OwnerDashboard } from './components/OwnerDashboard';
import { BarChart3, X, ShieldAlert, ArrowRight } from 'lucide-react';

function MainApp() {
  const { currentUser, isAuthenticated, canUserAccessModule } = useApp();
  const [activeView, setActiveView] = useState<MainView>(() => {
    return currentUser.role === 'mesero' ? 'waiter' : 'pos';
  });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'directory' | 'create'>('profile');
  const [isSalesChartOpen, setIsSalesChartOpen] = useState(false);

  // If user is not authenticated, render LoginScreen
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const handleOpenProfile = (tab: 'profile' | 'directory' | 'create' = 'profile') => {
    setProfileModalTab(tab);
    setIsProfileModalOpen(true);
  };

  // Strict rule: Mesero can ONLY access the waiter module (toma de pedidos, no cobro)
  React.useEffect(() => {
    if (currentUser.role === 'mesero' && activeView !== 'waiter') {
      setActiveView('waiter');
    }
  }, [currentUser.role, activeView]);

  const handleSelectView = (view: MainView) => {
    if (currentUser.role === 'mesero') {
      setActiveView('waiter');
      return;
    }
    setActiveView(view);
  };

  const isViewAuthorized = currentUser.role === 'mesero' 
    ? activeView === 'waiter' 
    : canUserAccessModule(activeView);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--g90-bg)] text-[var(--g90-text)] flex flex-col font-sans selection:bg-[var(--g90-action)] selection:text-white">
      
      {/* Top Application Header (Brand, Sales Chart Shortcut, User Dropdown) */}
      <AppHeader 
        onOpenSalesChart={() => setIsSalesChartOpen(true)}
        onOpenProfile={handleOpenProfile}
        onSelectView={handleSelectView}
      />

      {/* Main Workspace: Left Icon Rail + Active Module */}
      <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-row">
        
        {/* Left Icon Rail Navigation Sidebar */}
        <AppSidebarRail 
          activeView={activeView}
          onSelectView={handleSelectView}
        />

        {/* Active Module Viewport */}
        <main className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col bg-[var(--g90-bg)]">
          {!isViewAuthorized ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="max-w-md w-full p-8 rounded-2xl bg-[#200607] border border-[#4B3438] text-center shadow-2xl space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-[#C53747]/20 border border-[#C53747]/60 flex items-center justify-center text-[#C53747] mx-auto">
                  <ShieldAlert className="w-8 h-8 text-[#C53747]" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Módulo Restringido</h3>
                  <p className="text-xs text-[#C4C0C5] mt-2 leading-relaxed">
                    Tu usuario (<strong className="text-white">@{currentUser.username}</strong>) no tiene autorización del dueño para consultar o acceder al módulo <strong className="font-mono text-white">"{activeView}"</strong>.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      const fallback = (['pos', 'waiter', 'kds', 'shifts', 'inventory', 'ledger'] as MainView[])
                        .find(m => canUserAccessModule(m));
                      if (fallback) setActiveView(fallback);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#010102] hover:bg-[#200607] text-[#F4F1F1] font-bold text-xs inline-flex items-center gap-2 border border-[#4B3438] cursor-pointer shadow-md transition-colors"
                  >
                    <span>Ir a un módulo permitido</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {activeView === 'pos' && <POSTerminal />}
              {activeView === 'waiter' && <WaiterModule />}
              {activeView === 'kds' && <KDSKitchenBar />}
              {activeView === 'shifts' && <ShiftsAndCaja />}
              {activeView === 'inventory' && <InventoryAndEscandallos />}
              {activeView === 'ledger' && <GastosLibroMayor />}
              {activeView === 'settings' && <AdminConfigView />}
              {activeView === 'preflight' && <LocalPreflightAndScripts />}
              {activeView === 'owner_dashboard' && <OwnerDashboard />}
            </>
          )}
        </main>
      </div>

      {/* User Profile System Modal */}
      <UserProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        defaultTab={profileModalTab}
      />

      {/* Global Daily Sales Analytics Modal (Recharts) */}
      {isSalesChartOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
          <div className="relative w-full max-w-4xl bg-[#200607] rounded-2xl border border-[#4B3438] shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#4B3438] bg-[#010102] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#200607] text-[#C53747] flex items-center justify-center border border-[#4B3438]">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base">
                    Estadísticas & Gráfica de Ventas Diarias
                  </h3>
                  <span className="text-[11px] text-[#C4C0C5]">90 Grados Gastrobar · Visualización Recharts</span>
                </div>
              </div>

              <button
                onClick={() => setIsSalesChartOpen(false)}
                className="p-1.5 rounded-xl text-[#C4C0C5] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Cerrar gráfica"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#000100]">
              <DailySalesChart />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
