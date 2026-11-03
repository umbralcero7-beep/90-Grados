import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole, ModuleOperation, RolePermissionsConfig, SystemModule, PermissionAction } from '../types';
import { defaultRolePermissions } from '../data/initialData';
import { formatCOP, formatDateTimeBogota } from '../utils/format';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Sliders, 
  Check, 
  X, 
  Users, 
  DollarSign, 
  FileText, 
  Boxes, 
  FileCheck, 
  RotateCcw, 
  Building, 
  Save, 
  Info,
  Lock,
  Unlock,
  AlertCircle,
  Eye,
  CheckCircle2,
  ChevronRight,
  KeyRound,
  Crown,
  UserCheck,
  Globe,
  Wifi,
  Percent,
  Download,
  Upload,
  FileSpreadsheet,
  Coins,
  Database,
  Cloud,
  RefreshCw
} from 'lucide-react';
import { getApiBaseUrl, setApiBaseUrl, resetApiBaseUrl, testApiConnectivity, ConnectivityTestResult } from '../config/apiConfig';
import { parseCartaFromCsvClient, downloadCartaCsvTemplate, CartaDraftReportUI } from '../utils/cartaDraftExtractor';
import { 
  getStoredSupabaseConfig, 
  saveStoredSupabaseConfig, 
  testSupabaseConnection, 
  syncLocalDataToSupabase, 
  SupabaseTestResult, 
  SyncStatsResult 
} from '../services/supabaseService';

interface OperationMetadata {
  id: ModuleOperation;
  title: string;
  module: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  riskLevel: 'bajo' | 'medio' | 'alto';
}

const OPERATIONS: OperationMetadata[] = [
  {
    id: 'registrar_gastos',
    title: 'Registrar Gastos',
    module: 'Control de Gastos & Caja',
    icon: DollarSign,
    description: 'Permite registrar egresos operativos, compras de insumos y adelantos desde el punto de venta o administración.',
    riskLevel: 'medio',
  },
  {
    id: 'aprobar_pagos',
    title: 'Aprobar Pagos',
    module: 'Control de Gastos & Gerencia',
    icon: FileCheck,
    description: 'Autoriza egresos que superan el umbral o que están pendientes de validación para descuento en caja.',
    riskLevel: 'alto',
  },
  {
    id: 'ver_reportes',
    title: 'Ver Reportes',
    module: 'Finanzas & Analítica',
    icon: FileText,
    description: 'Acceso a estados de resultados, gráficos de facturación diaria, costos teóricos y comparativas de caja.',
    riskLevel: 'medio',
  },
  {
    id: 'gestionar_inventario',
    title: 'Gestionar Inventario',
    module: 'Inventario & Escandallos',
    icon: Boxes,
    description: 'Edición de stock físico de bodega y barra, ajustes de mermas y actualización de recetas/costos.',
    riskLevel: 'alto',
  },
];

const ROLES_TO_DISPLAY: Array<{ role: UserRole; label: string; badge: string; color: string }> = [
  { 
    role: 'administrador', 
    label: 'Administrador', 
    badge: 'Gerencia General', 
    color: 'border-[#7C170D]/60 bg-[#7C170D]/20 text-[#EBE1D5]' 
  },
  { 
    role: 'cajero', 
    label: 'Cajero(a)', 
    badge: 'Caja & Cobros', 
    color: 'border-[#151946] bg-[#151946]/50 text-[#EBE1D5]' 
  },
  { 
    role: 'mesero', 
    label: 'Mesero(a)', 
    badge: 'Salón & Terraza', 
    color: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' 
  },
  { 
    role: 'inventario_contabilidad', 
    label: 'Inventario / Contabilidad', 
    badge: 'Costos & Bodega', 
    color: 'border-[#151946] bg-[#151946]/70 text-[#EBE1D5]' 
  },
  { 
    role: 'cocina_bar', 
    label: 'Cocina & Bar (KDS)', 
    badge: 'Producción KDS', 
    color: 'border-[#EBE1D5]/20 bg-[#0E1120] text-[#A6AFCA]' 
  },
];

export const AdminConfigView: React.FC = () => {
  const { 
    currentUser, 
    allUsers,
    config, 
    updateConfig, 
    updateRolePermission, 
    updateAllRolePermissions, 
    updateUserModulePermissions,
    updateUserSecuritySettings,
    auditLogs,
    orders,
    shiftHistory,
    currentShift,
    expenses
  } = useApp();

  const isAdmin = currentUser.role === 'administrador';
  const currentPermissions: RolePermissionsConfig = config.rolePermissions || defaultRolePermissions;

  // Pilot API URL State
  const [apiUrlInput, setApiUrlInput] = useState<string>(() => getApiBaseUrl());
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<ConnectivityTestResult | null>(null);

  // Supabase Cloud State
  const [supabaseConfig, setSupabaseConfigState] = useState(() => getStoredSupabaseConfig());
  const [supabaseUrlInput, setSupabaseUrlInput] = useState<string>(() => getStoredSupabaseConfig().url);
  const [supabaseAnonKeyInput, setSupabaseAnonKeyInput] = useState<string>(() => getStoredSupabaseConfig().anonKey);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<SupabaseTestResult | null>(null);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [supabaseSyncResult, setSupabaseSyncResult] = useState<SyncStatsResult | null>(null);

  // Pilot Waiter Commission State
  const closedShifts = [...(shiftHistory || [])].filter(s => s.status === 'cerrado');
  const [selectedShiftId, setSelectedShiftId] = useState<string>(() => closedShifts[0]?.id || '');
  const [commissionRate, setCommissionRate] = useState<number>(5.0); // Configurable percentage
  const [commissionNotes, setCommissionNotes] = useState<string>('Liquidación comisiones post-cierre');

  // Pilot Carta Draft State
  const [draftCsvText, setDraftCsvText] = useState<string>('');
  const [draftReport, setDraftReport] = useState<CartaDraftReportUI | null>(null);

  // Granular user selector state (Requirement 1)
  const [selectedUserId, setSelectedUserId] = useState<string>(() => allUsers[0]?.id || currentUser.id);
  const selectedUser = allUsers.find(u => u.id === selectedUserId) || currentUser;

  // Local state for configuration inputs
  const [thresholdInput, setThresholdInput] = useState<number>(config.approvalThresholdCOP || 200000);
  const [businessName, setBusinessName] = useState(config.businessName || '90 Grados Restaurante & Bar');
  const [nit, setNit] = useState(config.nit || '901.458.729-3');
  const [municipality, setMunicipality] = useState(config.municipality || 'Cota, Cundinamarca');
  const [address, setAddress] = useState(config.address || 'Calle Principal Km 2 Vía Siberia');
  const [phone, setPhone] = useState(config.phone || '313 276 41 50');

  // Notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Role simulator state
  const [simulatedRole, setSimulatedRole] = useState<UserRole>('cajero');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleToggleUserAction = (module: SystemModule, action: PermissionAction) => {
    if (!isAdmin) {
      showToast('Solo el Dueño/Administrador puede modificar permisos por usuario.');
      return;
    }

    // Owner protection safeguard
    if (selectedUser.role === 'administrador' && module === 'owner_dashboard' && action === 'administrar') {
      showToast('Protección del Dueño: El administrador no puede revocar su propio acceso al Panel del Dueño.');
      return;
    }
    if (selectedUser.role === 'administrador' && module === 'settings' && action === 'administrar') {
      showToast('Protección del Dueño: El administrador no puede revocar su propio acceso a Configuración.');
      return;
    }

    const currentMod = selectedUser.modulePermissions?.[module] || {
      consultar: false,
      crear: false,
      editar: false,
      anular: false,
      cerrar: false,
      administrar: false
    };

    const newStatus = !currentMod[action];
    updateUserModulePermissions(selectedUser.id, module, action, newStatus);

    showToast(`Permiso [${action}] en módulo "${module}" ${newStatus ? 'CONCEDIDO' : 'REVOCADO'} a @${selectedUser.username}`);
  };

  const handleToggleUserWhitelist = () => {
    if (!isAdmin) return;
    if (selectedUser.role === 'administrador') {
      showToast('Protección del Dueño: No se puede retirar al administrador de la lista blanca.');
      return;
    }
    const nextVal = !selectedUser.isWhitelisted;
    updateUserSecuritySettings(selectedUser.id, { isWhitelisted: nextVal });
    showToast(`Usuario @${selectedUser.username} ${nextVal ? 'AGREGADO a' : 'RETIRADO de'} la lista blanca`);
  };

  const handleToggleUserActive = () => {
    if (!isAdmin) return;
    if (selectedUser.role === 'administrador') {
      showToast('Protección del Dueño: La cuenta del administrador no puede ser desactivada.');
      return;
    }
    const nextVal = !selectedUser.isActive;
    updateUserSecuritySettings(selectedUser.id, { isActive: nextVal });
    showToast(`Cuenta de @${selectedUser.username} ${nextVal ? 'ACTIVADA' : 'SUSPENDIDA'}`);
  };

  const handleToggleUserTwoFactor = () => {
    if (!isAdmin) return;
    const nextVal = !selectedUser.twoFactorEnabled;
    updateUserSecuritySettings(selectedUser.id, { 
      twoFactorEnabled: nextVal,
      twoFactorSecret: nextVal ? (selectedUser.twoFactorSecret || '909090') : undefined 
    });
    showToast(`2FA para @${selectedUser.username} ${nextVal ? 'ACTIVADO' : 'DESACTIVADO'}`);
  };

  const handleToggle = (role: UserRole, operation: ModuleOperation) => {
    if (!isAdmin) {
      alert('Solo los usuarios con rol de Administrador pueden modificar los permisos.');
      return;
    }

    const currentStatus = !!currentPermissions[role]?.[operation];
    const newStatus = !currentStatus;

    updateRolePermission(role, operation, newStatus);
    showToast(`Permiso "${operation.replace('_', ' ')}" para ${role} ${newStatus ? 'HABILITADO' : 'RESTRINGIDO'}`);
  };

  // Preset policies
  const handleApplyPreset = (preset: 'default' | 'strict' | 'flexible') => {
    if (!isAdmin) return;

    let targetConfig: RolePermissionsConfig;

    if (preset === 'default') {
      targetConfig = defaultRolePermissions;
      showToast('Políticas estándar de 90 Grados restauradas.');
    } else if (preset === 'strict') {
      targetConfig = {
        administrador: {
          registrar_gastos: true,
          aprobar_pagos: true,
          ver_reportes: true,
          gestionar_inventario: true,
        },
        cajero: {
          registrar_gastos: false,
          aprobar_pagos: false,
          ver_reportes: false,
          gestionar_inventario: false,
        },
        mesero: {
          registrar_gastos: false,
          aprobar_pagos: false,
          ver_reportes: false,
          gestionar_inventario: false,
        },
        cocina_bar: {
          registrar_gastos: false,
          aprobar_pagos: false,
          ver_reportes: false,
          gestionar_inventario: false,
        },
        inventario_contabilidad: {
          registrar_gastos: true,
          aprobar_pagos: false,
          ver_reportes: false,
          gestionar_inventario: true,
        },
      };
      showToast('Modo de Alta Seguridad aplicado: Solo Administrador autoriza operaciones.');
    } else {
      // Flexible
      targetConfig = {
        administrador: {
          registrar_gastos: true,
          aprobar_pagos: true,
          ver_reportes: true,
          gestionar_inventario: true,
        },
        cajero: {
          registrar_gastos: true,
          aprobar_pagos: false,
          ver_reportes: true,
          gestionar_inventario: true,
        },
        mesero: {
          registrar_gastos: true,
          aprobar_pagos: false,
          ver_reportes: false,
          gestionar_inventario: false,
        },
        cocina_bar: {
          registrar_gastos: false,
          aprobar_pagos: false,
          ver_reportes: false,
          gestionar_inventario: false,
        },
        inventario_contabilidad: {
          registrar_gastos: true,
          aprobar_pagos: true,
          ver_reportes: true,
          gestionar_inventario: true,
        },
      };
      showToast('Modo Operativo Flexible aplicado.');
    }

    updateAllRolePermissions(targetConfig);
  };

  const handleSaveCompanyDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    updateConfig({
      businessName,
      nit,
      municipality,
      address,
      phone,
      approvalThresholdCOP: Number(thresholdInput) || 200000,
    });

    showToast('Datos del establecimiento y umbral de aprobación guardados en el contexto.');
  };

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setApiBaseUrl(apiUrlInput);
      showToast(`URL de API guardada: ${apiUrlInput}`);
    } catch (err: any) {
      showToast(err.message || 'Error al guardar URL de API');
    }
  };

  const handleTestApi = async () => {
    setIsTestingApi(true);
    setApiTestResult(null);
    try {
      const res = await testApiConnectivity(apiUrlInput);
      setApiTestResult(res);
      if (res.ok) {
        showToast(`Conexión exitosa (${res.elapsedMs} ms)`);
      } else {
        showToast(`Alerta de conectividad: ${res.message}`);
      }
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleResetApiUrl = () => {
    resetApiBaseUrl();
    const fallback = getApiBaseUrl();
    setApiUrlInput(fallback);
    setApiTestResult(null);
    showToast(`URL restablecida al valor por defecto: ${fallback}`);
  };

  const handleSaveSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredSupabaseConfig(supabaseUrlInput, supabaseAnonKeyInput);
    setSupabaseConfigState({ url: supabaseUrlInput, anonKey: supabaseAnonKeyInput });
    showToast('Configuración de Supabase Cloud guardada.');
  };

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    setSupabaseTestResult(null);
    try {
      const res = await testSupabaseConnection({
        url: supabaseUrlInput,
        anonKey: supabaseAnonKeyInput
      });
      setSupabaseTestResult(res);
      if (res.ok) {
        showToast(`Conectado a Supabase exitosamente (${res.elapsedMs} ms)`);
      } else {
        showToast(`Alerta Supabase: ${res.message}`);
      }
    } catch (err: any) {
      setSupabaseTestResult({
        ok: false,
        message: err.message || 'Error al conectar con Supabase',
        elapsedMs: 0
      });
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handleSyncSupabase = async () => {
    setIsSyncingSupabase(true);
    setSupabaseSyncResult(null);
    try {
      saveStoredSupabaseConfig(supabaseUrlInput, supabaseAnonKeyInput);
      setSupabaseConfigState({ url: supabaseUrlInput, anonKey: supabaseAnonKeyInput });
      const stats = await syncLocalDataToSupabase(orders, expenses, shiftHistory);
      setSupabaseSyncResult(stats);
      if (stats.errors.length === 0) {
        showToast(`Sincronización completada: ${stats.ordersSynced} comandas, ${stats.expensesSynced} gastos.`);
      } else {
        showToast(`Sincronización parcial con ${stats.errors.length} observaciones.`);
      }
    } catch (err: any) {
      setSupabaseSyncResult({
        ordersSynced: 0,
        expensesSynced: 0,
        errors: [err.message || 'Error en sincronización']
      });
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const handleParseDraftCsv = () => {
    if (!draftCsvText.trim()) {
      showToast('Ingrese o pegue el contenido CSV del borrador de carta.');
      return;
    }
    const report = parseCartaFromCsvClient(draftCsvText, 'carta_borrador_admin.csv');
    setDraftReport(report);
    showToast(`Borrador procesado: ${report.totalItems} productos (${report.itemsConAdvertencia} advertencias)`);
  };

  // Waiter commission calculation for the selected closed shift
  const selectedClosedShift = closedShifts.find(s => s.id === selectedShiftId) || closedShifts[0];
  const shiftOrders = orders.filter(o => o.shiftId === selectedClosedShift?.id && o.status === 'pagada');

  const waitersSalesMap = React.useMemo(() => {
    const map: Record<string, { waiterName: string; ordersCount: number; grossSalesCOP: number; netSalesCOP: number }> = {};
    shiftOrders.forEach(ord => {
      const wId = ord.waiterId || 'desconocido';
      const wName = ord.waiterName || 'Mesero';
      if (!map[wId]) {
        map[wId] = { waiterName: wName, ordersCount: 0, grossSalesCOP: 0, netSalesCOP: 0 };
      }
      map[wId].ordersCount += 1;
      map[wId].grossSalesCOP += ord.totalAmount;
      map[wId].netSalesCOP += ord.totalAmount;
    });
    return map;
  }, [shiftOrders]);

  const commissionCalculations = React.useMemo(() => {
    return Object.entries(waitersSalesMap).map(([waiterId, data]) => {
      const commissionAmountCOP = Math.round(data.netSalesCOP * (Number(commissionRate || 0) / 100));
      return {
        waiterId,
        waiterName: data.waiterName,
        ordersCount: data.ordersCount,
        netSalesCOP: data.netSalesCOP,
        commissionPercentage: Number(commissionRate || 0),
        commissionAmountCOP,
        notes: commissionNotes
      };
    });
  }, [waitersSalesMap, commissionRate, commissionNotes]);

  const totalCommissionsCOP = commissionCalculations.reduce((sum, w) => sum + w.commissionAmountCOP, 0);
  const totalSalesBaseCOP = commissionCalculations.reduce((sum, w) => sum + w.netSalesCOP, 0);

  const handleExportCommissionsCSV = () => {
    if (!selectedClosedShift) {
      showToast('Seleccione un turno cerrado para exportar comisiones.');
      return;
    }
    const rows = [
      ['LIQUIDACION_COMISIONES_MESEROS_POST_CIERRE', selectedClosedShift.id],
      ['CENTRO_OPERATIVO', selectedClosedShift.center],
      ['FECHA_CIERRE', selectedClosedShift.closedAt || selectedClosedShift.openedAt],
      ['PORCENTAJE_COMISION_CONFIGURADO', `${commissionRate}%`],
      ['TOTAL_VENTAS_BASE_COP', totalSalesBaseCOP.toString()],
      ['TOTAL_COMISIONES_LIQUIDADAS_COP', totalCommissionsCOP.toString()],
      ['NOTAS_AUDITORIA', commissionNotes],
      [],
      ['ID_MESERO', 'NOMBRE_MESERO', 'ORDENES_ATENDIDAS', 'VENTAS_NETAS_COP', 'PORCENTAJE', 'COMISION_COP'],
      ...commissionCalculations.map(c => [
        c.waiterId,
        c.waiterName,
        c.ordersCount.toString(),
        c.netSalesCOP.toString(),
        `${c.commissionPercentage}%`,
        c.commissionAmountCOP.toString()
      ])
    ];
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Liquidacion_Comisiones_${selectedClosedShift.id.slice(0, 8)}_${commissionRate}pct.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Liquidación de comisiones exportada en CSV.');
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-[#0B0D18] text-[#EBE1D5] overflow-y-auto">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#0E1120] border border-[#7C170D] text-[#EBE1D5] px-4 py-2.5 rounded-xl shadow-2xl text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-4 sm:p-6 border-b border-[#EBE1D5]/20 header-brand-gradient shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#151946] border border-[#EBE1D5]/20 flex items-center justify-center text-[#EBE1D5] shrink-0">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Configuración Administrativa & Permisos por Rol
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#7C170D] text-white border border-[#EBE1D5]/30">
                Almacenado en Contexto
              </span>
            </div>
            <p className="text-xs text-[#A6AFCA] mt-0.5">
              Defina con precisión qué roles tienen autorización para registrar gastos, aprobar pagos, consultar reportes y administrar inventario.
            </p>
          </div>
        </div>

        {/* Current user badge */}
        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#0E1120] border border-[#EBE1D5]/20 text-xs shrink-0">
          <div className="relative">
            <img 
              src={currentUser.avatarUrl} 
              alt={currentUser.fullName}
              className="w-8 h-8 rounded-full object-cover border border-[#7C170D]"
            />
            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-[#0B0D18] ${
              isAdmin ? 'bg-emerald-500' : 'bg-[#7C170D]'
            }`} />
          </div>
          <div>
            <div className="font-bold text-white flex items-center gap-1.5">
              <span>@{currentUser.username}</span>
              {isAdmin ? (
                <span className="text-[10px] text-emerald-400 font-mono">(Admin)</span>
              ) : (
                <span className="text-[10px] text-[#A6AFCA] font-mono">(Solo Consulta)</span>
              )}
            </div>
            <p className="text-[10px] text-[#A6AFCA] capitalize">{currentUser.role.replace('_', ' ')}</p>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">

        {/* Admin security alert if not admin */}
        {!isAdmin && (
          <div className="p-4 rounded-xl bg-[#7C170D]/20 border border-[#7C170D]/50 text-[#EBE1D5] text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#EBE1D5] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Modo de Consulta (Acceso Restringido):</p>
              <p className="mt-1 text-[#A6AFCA]">
                Ha iniciado sesión como <strong>@{currentUser.username}</strong> con rol de <em>{currentUser.role}</em>. Solo los usuarios con rol de <strong>Administrador</strong> (ej. @carmen_gerente) pueden alterar la matriz de permisos y configuraciones del establecimiento.
              </p>
            </div>
          </div>
        )}

        {/* SECTION 1: PERMISSIONS MATRIX (CORE USER REQUEST) */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EBE1D5]/15 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#EBE1D5]" />
                <h3 className="text-base font-bold text-white">Matriz de Operaciones Permitidas por Rol</h3>
              </div>
              <p className="text-xs text-[#A6AFCA] mt-1">
                Active o desactive los interruptores para autorizar en tiempo real las operaciones en cada módulo del restaurante-bar.
              </p>
            </div>

            {/* Presets buttons */}
            {isAdmin && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-[#A6AFCA] font-semibold mr-1">Preajustes:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('default')}
                  className="px-2.5 py-1 bg-[#151946] hover:bg-[#151946]/80 border border-[#EBE1D5]/20 text-[#EBE1D5] hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Estándar
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('strict')}
                  className="px-2.5 py-1 bg-[#151946] hover:bg-[#7C170D]/40 border border-[#EBE1D5]/20 hover:border-[#7C170D] text-[#EBE1D5] hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Estricto
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('flexible')}
                  className="px-2.5 py-1 bg-[#151946] hover:bg-emerald-950/60 border border-[#EBE1D5]/20 hover:border-emerald-700 text-[#EBE1D5] hover:text-emerald-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Flexible
                </button>
              </div>
            )}
          </div>

          {/* Responsive Table of Permissions */}
          <div className="overflow-x-auto rounded-xl border border-[#EBE1D5]/20">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#151946] border-b border-[#EBE1D5]/20 text-[#EBE1D5] uppercase text-[11px]">
                  <th className="p-3.5 min-w-[260px]">Operación / Módulo</th>
                  {ROLES_TO_DISPLAY.map(r => (
                    <th key={r.role} className="p-3.5 text-center min-w-[130px]">
                      <div className="font-bold text-white capitalize">{r.label}</div>
                      <span className={`inline-block mt-0.5 px-1.5 py-0.2 text-[9px] rounded font-mono border ${r.color}`}>
                        {r.badge}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBE1D5]/10">
                {OPERATIONS.map((op) => {
                  const Icon = op.icon;
                  return (
                    <tr key={op.id} className="hover:bg-[#151946]/20 transition-colors">
                      {/* Operation details */}
                      <td className="p-3.5">
                        <div className="flex items-start gap-2.5">
                          <div className="p-2 rounded-lg bg-[#151946] border border-[#EBE1D5]/20 text-[#EBE1D5] shrink-0 mt-0.5">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{op.title}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#0B0D18] text-[#A6AFCA] border border-[#EBE1D5]/15">
                                {op.module}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#A6AFCA] mt-0.5 leading-relaxed">
                              {op.description}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role Checkboxes / Toggles */}
                      {ROLES_TO_DISPLAY.map(r => {
                        const isAllowed = !!currentPermissions[r.role]?.[op.id];
                        const isDisabled = !isAdmin;

                        return (
                          <td key={r.role} className="p-3.5 text-center align-middle">
                            <button
                              type="button"
                              onClick={() => handleToggle(r.role, op.id)}
                              disabled={isDisabled}
                              title={
                                isDisabled 
                                  ? 'Solo administradores pueden cambiar permisos'
                                  : `Clic para ${isAllowed ? 'restringir' : 'permitir'} ${op.title} para ${r.label}`
                              }
                              className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                                isDisabled ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'
                              } ${
                                isAllowed
                                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
                                  : 'bg-[#0B0D18] border-[#EBE1D5]/20 text-[#A6AFCA] hover:border-[#7C170D] hover:text-white'
                              }`}
                            >
                              {isAllowed ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Permitido</span>
                                </>
                              ) : (
                                <>
                                  <X className="w-3.5 h-3.5 text-[#A6AFCA] group-hover:text-white" />
                                  <span>Bloqueado</span>
                                </>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-[#151946]/40 rounded-xl border border-[#EBE1D5]/20 text-xs text-[#A6AFCA] flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-1.5">
              <Info className="w-4 h-4 text-[#EBE1D5] shrink-0" />
              <span>Los cambios realizados se sincronizan en memoria y en almacenamiento local de forma inmediata.</span>
            </span>
            <span className="font-mono text-[11px] text-[#A6AFCA]">
              Estado: <strong className="text-emerald-400">Contexto Sincronizado</strong>
            </span>
          </div>
        </div>

        {/* SECTION 2: ROLE SIMULATOR & POLICY EXPLANATION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Permissions Simulator */}
          <div className="p-5 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#EBE1D5]" />
              <h3 className="font-bold text-sm text-white">Simulador de Acceso en Tiempo Real</h3>
            </div>
            <p className="text-xs text-[#A6AFCA]">
              Seleccione un rol para previsualizar exactamente qué operaciones tiene habilitadas actualmente:
            </p>

            <select
              value={simulatedRole}
              onChange={(e) => setSimulatedRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white text-xs font-semibold focus:outline-none focus:border-[#7C170D]"
            >
              <option value="administrador">Rol: Administrador / Dueño</option>
              <option value="cajero">Rol: Cajero(a)</option>
              <option value="mesero">Rol: Mesero(a) de Salón</option>
              <option value="inventario_contabilidad">Rol: Inventario & Contabilidad</option>
              <option value="cocina_bar">Rol: Cocina & Bar (KDS)</option>
            </select>

            <div className="space-y-2 pt-1">
              {OPERATIONS.map((op) => {
                const allowed = !!currentPermissions[simulatedRole]?.[op.id];
                return (
                  <div 
                    key={op.id}
                    className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                      allowed 
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-[#EBE1D5]' 
                        : 'bg-[#0B0D18] border-[#EBE1D5]/15 text-[#A6AFCA]'
                    }`}
                  >
                    <span className="font-medium">{op.title}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      allowed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-[#A6AFCA]'
                    }`}>
                      {allowed ? 'HABILITADO' : 'RESTRINGIDO'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gastos Approval & General Settings Form */}
          <div className="p-5 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-4 lg:col-span-2">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-[#EBE1D5]" />
              <h3 className="font-bold text-sm text-white">Parámetros Operativos del Establecimiento</h3>
            </div>
            <p className="text-xs text-[#A6AFCA]">
              Ajuste el umbral de aprobación para caja y los datos fiscales que figuran en las comandas y comprobantes de egreso:
            </p>

            <form onSubmit={handleSaveCompanyDetails} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#EBE1D5] font-semibold mb-1">Razón Social</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white focus:outline-none focus:border-[#7C170D]"
                  />
                </div>

                <div>
                  <label className="block text-[#EBE1D5] font-semibold mb-1">NIT / Identificación Fiscal</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={nit}
                    onChange={(e) => setNit(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white font-mono focus:outline-none focus:border-[#7C170D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#EBE1D5] font-semibold mb-1">Municipio</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={municipality}
                    onChange={(e) => setMunicipality(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white focus:outline-none focus:border-[#7C170D]"
                  />
                </div>

                <div>
                  <label className="block text-[#EBE1D5] font-semibold mb-1">Dirección</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white focus:outline-none focus:border-[#7C170D]"
                  />
                </div>

                <div>
                  <label className="block text-[#EBE1D5] font-semibold mb-1">Teléfono</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white font-mono focus:outline-none focus:border-[#7C170D]"
                  />
                </div>
              </div>

              {/* Threshold for mandatory expense approvals */}
              <div className="p-3.5 bg-[#0B0D18] rounded-xl border border-[#EBE1D5]/20 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-white text-xs">Umbral de Aprobación de Egresos en Caja</h4>
                    <p className="text-[11px] text-[#A6AFCA] mt-0.5">
                      Cualquier egreso mayor o igual a este monto exigirá autorización de Gerencia antes de descontarse de la gaveta.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[#EBE1D5]">$ COP</span>
                    <input
                      type="number"
                      step="50000"
                      min="50000"
                      disabled={!isAdmin}
                      value={thresholdInput}
                      onChange={(e) => setThresholdInput(Number(e.target.value))}
                      className="w-32 px-3 py-1.5 bg-[#0E1120] border border-[#EBE1D5]/20 rounded-lg text-white font-mono font-bold text-right focus:outline-none focus:border-[#7C170D]"
                    />
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#7C170D] hover:bg-[#961D12] text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-md border border-[#EBE1D5]/30 transition-all active:scale-95"
                  >
                    <Save className="w-4 h-4" /> Guardar Parámetros de Establecimiento
                  </button>
                </div>
              )}
            </form>
          </div>

        </div>

        {/* PILOT SECTION A: LOCAL API CONNECTION (SHARED ACROSS ELECTRON & ANDROID) */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EBE1D5]/15 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#151946] border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Conexión API Local & Dispositivos LAN (Windows 11 / Android)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 font-mono">
                    Autoridad de Datos
                  </span>
                </h3>
                <p className="text-xs text-[#A6AFCA] mt-0.5">
                  URL central donde corre el servicio backend FastAPI (puerto 8000). Compartida por la app Electron en el All-in-One y las tablets Android de meseros.
                </p>
              </div>
            </div>

            <span className="text-xs font-mono text-[#A6AFCA]">
              Local-First LAN
            </span>
          </div>

          <form onSubmit={handleSaveApiUrl} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#EBE1D5] mb-1">
                URL del Servidor API Local:
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={apiUrlInput}
                  onChange={(e) => setApiUrlInput(e.target.value)}
                  placeholder="http://localhost:8000 o http://192.168.1.X:8000"
                  className="flex-1 px-3.5 py-2 rounded-xl bg-[#0B0D18] border border-[#EBE1D5]/20 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={handleTestApi}
                  disabled={isTestingApi}
                  className="px-4 py-2 rounded-xl bg-[#151946] hover:bg-[#1f2560] text-cyan-300 border border-cyan-500/40 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shrink-0"
                >
                  <Wifi className={`w-3.5 h-3.5 ${isTestingApi ? 'animate-pulse' : ''}`} />
                  <span>{isTestingApi ? 'Probando...' : 'Probar Conexión'}</span>
                </button>
                {isAdmin && (
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#7C170D] hover:bg-[#961D12] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar URL</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetApiUrl}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#A6AFCA] hover:text-white border border-white/10 text-xs cursor-pointer shrink-0"
                  title="Restablecer al valor por defecto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Test result display */}
            {apiTestResult && (
              <div className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                apiTestResult.ok 
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' 
                  : 'bg-[#7C170D]/20 border-[#7C170D]/60 text-red-200'
              }`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    {apiTestResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                    <span>{apiTestResult.message}</span>
                  </div>
                  {apiTestResult.serverInfo && (
                    <p className="text-[11px] font-mono opacity-80">
                      Servicio: {apiTestResult.serverInfo.service} v{apiTestResult.serverInfo.version} · Zona Horaria: {apiTestResult.serverInfo.timezone}
                    </p>
                  )}
                </div>
                <span className="font-mono text-[10px] uppercase font-bold shrink-0 px-2 py-0.5 rounded bg-black/40">
                  {apiTestResult.elapsedMs} ms
                </span>
              </div>
            )}

            <p className="text-[11px] text-[#A6AFCA] leading-relaxed">
              💡 <em>Guía de red local:</em> En el equipo All-in-One de caja use <code className="text-white">http://localhost:8000</code>. En tablets de meseros conectadas a la misma red Wi-Fi privada, use la IP LAN de la máquina de caja (ej. <code className="text-white">http://192.168.1.150:8000</code>).
            </p>
          </form>
        </div>

        {/* PILOT SECTION A.2: SUPABASE CLOUD (POSTGRESQL & VERCEL SYNC) */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EBE1D5]/15 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#151946] border border-emerald-500/40 flex items-center justify-center text-emerald-300">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Conexión Supabase Cloud (PostgreSQL Remoto & Despliegue Web)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 font-mono">
                    Cloud Sync
                  </span>
                </h3>
                <p className="text-xs text-[#A6AFCA] mt-0.5">
                  Conecte su base de datos PostgreSQL hospedada en Supabase para sincronizar ventas, gastos e inventario hacia la nube y respaldar los turnos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono border ${
                supabaseConfig.url && supabaseConfig.anonKey
                  ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-950/50 text-amber-300 border-amber-500/40'
              }`}>
                <Cloud className="w-3 h-3" />
                {supabaseConfig.url ? 'Configurado' : 'Pendiente Configuración'}
              </span>
            </div>
          </div>

          <form onSubmit={handleSaveSupabase} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#EBE1D5] mb-1">
                  URL del Proyecto Supabase:
                </label>
                <input
                  type="text"
                  value={supabaseUrlInput}
                  onChange={(e) => setSupabaseUrlInput(e.target.value)}
                  placeholder="https://xyzabcdefghijklm.supabase.co"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0B0D18] border border-[#EBE1D5]/20 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                />
                <span className="text-[10px] text-[#A6AFCA] mt-1 block">
                  Encuéntrelo en: <em>Supabase Dashboard → Project Settings → Configuration → API → Project URL</em>
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#EBE1D5] mb-1">
                  API Key Pública (anon key):
                </label>
                <input
                  type="password"
                  value={supabaseAnonKeyInput}
                  onChange={(e) => setSupabaseAnonKeyInput(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0B0D18] border border-[#EBE1D5]/20 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                />
                <span className="text-[10px] text-[#A6AFCA] mt-1 block">
                  Encuéntrelo en: <em>Supabase Dashboard → Project Settings → Configuration → API → Project API keys (anon public)</em>
                </span>
              </div>
            </div>

            {/* Test and Sync Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestSupabase}
                disabled={isTestingSupabase}
                className="px-4 py-2 rounded-xl bg-[#151946] hover:bg-[#1f2560] text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Wifi className={`w-3.5 h-3.5 ${isTestingSupabase ? 'animate-pulse' : ''}`} />
                <span>{isTestingSupabase ? 'Verificando...' : 'Probar Conexión Supabase'}</span>
              </button>

              {isAdmin && (
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#7C170D] hover:bg-[#961D12] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Claves</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSyncSupabase}
                disabled={isSyncingSupabase || !supabaseUrlInput}
                className="px-4 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-200 border border-emerald-500/50 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm ml-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSupabase ? 'animate-spin' : ''}`} />
                <span>{isSyncingSupabase ? 'Sincronizando...' : 'Sincronizar Comandas y Gastos a Supabase'}</span>
              </button>
            </div>

            {/* Supabase Test Result Box */}
            {supabaseTestResult && (
              <div className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                supabaseTestResult.ok 
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' 
                  : 'bg-[#7C170D]/20 border-[#7C170D]/60 text-red-200'
              }`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    {supabaseTestResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                    <span>{supabaseTestResult.message}</span>
                  </div>
                  {supabaseTestResult.tablesDetected && (
                    <p className="text-[11px] font-mono opacity-80">
                      Tablas verificadas en el esquema: {supabaseTestResult.tablesDetected.join(', ')}
                    </p>
                  )}
                </div>
                <span className="font-mono text-[10px] uppercase font-bold shrink-0 px-2 py-0.5 rounded bg-black/40">
                  {supabaseTestResult.elapsedMs} ms
                </span>
              </div>
            )}

            {/* Supabase Sync Result Box */}
            {supabaseSyncResult && (
              <div className={`p-3 rounded-xl border text-xs ${
                supabaseSyncResult.errors.length === 0
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold">Resultado de Sincronización a la Nube:</span>
                  <span className="font-mono text-[10px]">
                    {supabaseSyncResult.ordersSynced} comandas | {supabaseSyncResult.expensesSynced} egresos
                  </span>
                </div>
                {supabaseSyncResult.errors.length > 0 && (
                  <ul className="list-disc pl-4 text-[11px] text-red-300 mt-1 space-y-0.5">
                    {supabaseSyncResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Explanatory banner for user creation of Supabase */}
            <div className="p-3.5 rounded-xl bg-[#0B0D18] border border-[#EBE1D5]/15 text-xs text-[#A6AFCA] space-y-1.5 leading-relaxed">
              <p className="font-semibold text-white flex items-center gap-1.5">
                <Info className="w-4 h-4 text-emerald-400" />
                <span>¿Cómo activar su base de datos Supabase en 3 sencillos pasos?</span>
              </p>
              <ol className="list-decimal pl-5 space-y-1 text-[11px]">
                <li>Cree una cuenta gratuita en <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline font-mono">supabase.com</a> y haga clic en <strong>"New Project"</strong>.</li>
                <li>En el menú lateral de Supabase, ingrese a <strong>SQL Editor</strong>, cree una nueva consulta y pegue el contenido del archivo <code className="text-white bg-black/40 px-1 py-0.5 rounded">backend/database/schema.sql</code> (o <code className="text-white bg-black/40 px-1 py-0.5 rounded">entrega_piloto_90grados/supabase_schema.sql</code>). Presione <strong>Run</strong>.</li>
                <li>Vaya a <strong>Project Settings → API</strong>, copie la <strong>Project URL</strong> y la <strong>anon public key</strong>, péguelas en este formulario y haga clic en <strong>"Probar Conexión Supabase"</strong>.</li>
              </ol>
            </div>
          </form>
        </div>

        {/* PILOT SECTION B: WAITER COMMISSION CALCULATION POST-SHIFT */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EBE1D5]/15 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#151946] border border-amber-500/40 flex items-center justify-center text-amber-300">
                <Percent className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Liquidación de Comisiones de Meseros (Post-Cierre de Turno)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-500/30 font-mono">
                    Auditable
                  </span>
                </h3>
                <p className="text-xs text-[#A6AFCA] mt-0.5">
                  Cálculo auditable por mesero con porcentaje configurable sobre ventas netas. Bloqueado en turnos abiertos.
                </p>
              </div>
            </div>

            {closedShifts.length > 0 && (
              <button
                type="button"
                onClick={handleExportCommissionsCSV}
                className="px-3.5 py-1.5 rounded-xl bg-[#151946] hover:bg-[#1f2560] border border-[#EBE1D5]/30 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow transition-all"
              >
                <Download className="w-3.5 h-3.5 text-amber-300" />
                <span>Exportar Liquidación CSV</span>
              </button>
            )}
          </div>

          {closedShifts.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#0B0D18] border border-[#EBE1D5]/10 text-center text-xs text-[#A6AFCA]">
              <AlertCircle className="w-6 h-6 text-amber-400 mx-auto mb-1.5" />
              <p className="font-semibold text-white">No hay turnos cerrados disponibles para liquidación.</p>
              <p className="mt-0.5">
                La comisión de meseros solo puede calcularse una vez ejecutado el Cierre Z del turno de caja.
              </p>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#EBE1D5] font-semibold mb-1">Turno Cerrado a Liquidar:</label>
                  <select
                    value={selectedShiftId}
                    onChange={(e) => setSelectedShiftId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                  >
                    {closedShifts.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.center} ({formatDateTimeBogota(s.closedAt || s.openedAt).split(',')[0]}) - {formatCOP(s.totalSalesTotal || 0)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#EBE1D5] font-semibold mb-1">Porcentaje de Comisión Configurable (%):</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      disabled={!isAdmin}
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(Math.max(0, Math.min(100, Number(e.target.value))))}
                      className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white font-mono font-bold text-right text-xs focus:outline-none focus:border-amber-400"
                    />
                    <span className="text-[#EBE1D5] font-bold">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[#EBE1D5] font-semibold mb-1">Nota de Auditoría:</label>
                  <input
                    type="text"
                    value={commissionNotes}
                    onChange={(e) => setCommissionNotes(e.target.value)}
                    placeholder="Ej. Cierre fin de semana sin incidencias"
                    className="w-full px-3 py-2 bg-[#0B0D18] border border-[#EBE1D5]/20 rounded-lg text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Commission Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-[#0B0D18] rounded-xl border border-[#EBE1D5]/15">
                <div>
                  <span className="text-[10px] text-[#A6AFCA] block uppercase">Ventas Base Netas</span>
                  <span className="font-mono font-bold text-white text-sm">{formatCOP(totalSalesBaseCOP)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#A6AFCA] block uppercase">Comisión Total ({commissionRate}%)</span>
                  <span className="font-mono font-bold text-amber-300 text-sm">{formatCOP(totalCommissionsCOP)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#A6AFCA] block uppercase">Meseros Activos</span>
                  <span className="font-mono font-bold text-white text-sm">{commissionCalculations.length}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#A6AFCA] block uppercase">Estado del Turno</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">Cerrado (Corte Z)</span>
                </div>
              </div>

              {/* Table of Attributed Waiters */}
              <div className="overflow-x-auto rounded-xl border border-[#EBE1D5]/20">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#151946] border-b border-[#EBE1D5]/20 text-[#EBE1D5] uppercase font-semibold">
                    <tr>
                      <th className="p-3">Mesero(a)</th>
                      <th className="p-3 text-center">Comandas Atendidas</th>
                      <th className="p-3 text-right">Ventas Netas COP</th>
                      <th className="p-3 text-center">% Aplicado</th>
                      <th className="p-3 text-right">Comisión a Liquidar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EBE1D5]/10">
                    {commissionCalculations.map((w) => (
                      <tr key={w.waiterId} className="hover:bg-[#151946]/20 transition-colors">
                        <td className="p-3 font-semibold text-white">{w.waiterName}</td>
                        <td className="p-3 text-center font-mono">{w.ordersCount}</td>
                        <td className="p-3 text-right font-mono">{formatCOP(w.netSalesCOP)}</td>
                        <td className="p-3 text-center font-mono text-amber-300 font-bold">{w.commissionPercentage}%</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-400">{formatCOP(w.commissionAmountCOP)}</td>
                      </tr>
                    ))}
                    {commissionCalculations.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-[#A6AFCA]">
                          No se registraron ventas pagadas atribuidas a meseros en este turno.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* PILOT SECTION C: CARTA DRAFT REVIEW (PDF / CSV IMPORT) */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EBE1D5]/15 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#151946] border border-purple-500/40 flex items-center justify-center text-purple-300">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Importación & Revisión de Borrador de Carta (PDF / CSV)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-500/30 font-mono">
                    Modo Borrador
                  </span>
                </h3>
                <p className="text-xs text-[#A6AFCA] mt-0.5">
                  Procesamiento en borrador con validación humana antes de publicar productos a la carta activa del restaurante.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={downloadCartaCsvTemplate}
              className="px-3.5 py-1.5 rounded-xl bg-[#151946] hover:bg-[#1f2560] border border-purple-500/40 text-purple-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow transition-all"
            >
              <Download className="w-3.5 h-3.5 text-purple-300" />
              <span>Descargar Plantilla CSV Oficial</span>
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-[#EBE1D5]">Pegar o Editar Filas CSV del Borrador:</label>
                <button
                  type="button"
                  onClick={() => {
                    const sample = [
                      'Nombre del Producto,Categoría,Precio COP,Descripción / Acompañamientos,Unidad de Venta,Estación',
                      '"Picada Especial 90 Grados","Picadas","45000","Carne res cerdo chicharron y papa criolla","porción","cocina"',
                      '"Cerveza Club Colombia","Cervezas","7000","Botella 330ml fría","unidad","bar"',
                      '"Combo Parrillero Familiar","Picadas","65000 / 95000","Variante de precio detectada","combo","cocina"',
                      '"Plato del Día Temporal","Carnes","Consultar","Precio no definido","plato","cocina"'
                    ].join('\n');
                    setDraftCsvText(sample);
                  }}
                  className="text-[11px] text-purple-300 hover:underline cursor-pointer"
                >
                  Cargar Ejemplo con Advertencias
                </button>
              </div>
              <textarea
                rows={4}
                value={draftCsvText}
                onChange={(e) => setDraftCsvText(e.target.value)}
                placeholder="Nombre del Producto, Categoría, Precio COP, Descripción, Unidad, Estación..."
                className="w-full p-3 rounded-xl bg-[#0B0D18] border border-[#EBE1D5]/20 text-white font-mono text-[11px] focus:outline-none focus:border-purple-400"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleParseDraftCsv}
                className="px-4 py-2 rounded-xl bg-purple-900/60 hover:bg-purple-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-purple-500/40 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Inspeccionar Borrador para Revisión Humana</span>
              </button>
            </div>

            {/* Draft Report Inspection Table */}
            {draftReport && (
              <div className="space-y-3 pt-2">
                <div className="p-3 rounded-xl bg-[#0B0D18] border border-purple-500/30 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-bold text-white text-xs block">{draftReport.mensajeAuditoria}</span>
                    <span className="text-[11px] text-[#A6AFCA]">
                      Total extraídos: <strong>{draftReport.totalItems}</strong> · Con advertencias: <strong className="text-amber-400">{draftReport.itemsConAdvertencia}</strong> · Claros: <strong className="text-emerald-400">{draftReport.itemsClaros}</strong>
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-amber-950/60 border border-amber-500/50 text-amber-300 font-mono text-[10px] font-bold">
                    🔒 Bloqueado para Auto-Publicación
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#EBE1D5]/20 max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#151946] border-b border-[#EBE1D5]/20 text-[#EBE1D5] uppercase font-semibold sticky top-0">
                      <tr>
                        <th className="p-2.5">SKU Sugerido</th>
                        <th className="p-2.5">Producto</th>
                        <th className="p-2.5">Categoría</th>
                        <th className="p-2.5 text-right">Precio COP</th>
                        <th className="p-2.5 text-center">Estación</th>
                        <th className="p-2.5">Estado / Advertencias</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EBE1D5]/10">
                      {draftReport.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-[#151946]/20 transition-colors">
                          <td className="p-2.5 font-mono text-[#A6AFCA]">{it.skuSugerido}</td>
                          <td className="p-2.5 font-semibold text-white">{it.nombre}</td>
                          <td className="p-2.5 text-[#A6AFCA]">{it.categoria}</td>
                          <td className="p-2.5 text-right font-mono font-bold">
                            {it.precioCOP !== null ? formatCOP(it.precioCOP) : <span className="text-red-400">Sin precio</span>}
                          </td>
                          <td className="p-2.5 text-center uppercase font-mono text-[10px]">{it.estacion}</td>
                          <td className="p-2.5">
                            {it.advertencias.length > 0 ? (
                              <div className="space-y-0.5">
                                {it.advertencias.map((w, wIdx) => (
                                  <span key={wIdx} className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-500/30 mr-1">
                                    ⚠️ {w}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-emerald-400 text-[11px] font-semibold flex items-center gap-1">
                                <Check className="w-3 h-3" /> Datos válidos
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: GRANULAR USER PERMISSIONS & SECURITY MATRIX (OWNER CONTROL) */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EBE1D5]/15 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#151946] border border-[#7C170D] flex items-center justify-center text-[#EBE1D5]">
                <Shield className="w-5 h-5 text-[#EBE1D5]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Asignación de Permisos por Usuario & Módulo</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#7C170D] text-white font-mono uppercase">Control del Dueño</span>
                </h3>
                <p className="text-xs text-[#A6AFCA] mt-0.5">
                  Configure accesos individuales distinguiendo consultar de crear, editar, anular, cerrar o administrar.
                </p>
              </div>
            </div>

            {selectedUser.role === 'administrador' && (
              <span className="text-[11px] px-3 py-1 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-300 flex items-center gap-1.5 font-medium">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>Protección activa: El dueño no puede auto-revocarse</span>
              </span>
            )}
          </div>

          {/* User selection pills */}
          <div>
            <label className="block text-xs font-semibold text-[#EBE1D5] uppercase tracking-wider mb-2">
              Seleccionar Usuario a Configurar ({allUsers.length} en plantilla):
            </label>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {allUsers.map((u) => {
                const isSelected = u.id === selectedUser.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUserId(u.id)}
                    className={`p-2 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-[#151946] border-[#EBE1D5] shadow-md ring-1 ring-[#EBE1D5]/40'
                        : 'bg-[#0B0D18] border-[#EBE1D5]/15 hover:border-[#EBE1D5]/30 text-[#A6AFCA]'
                    }`}
                  >
                    <img 
                      src={u.avatarUrl} 
                      alt={u.fullName} 
                      className="w-7 h-7 rounded-full object-cover border border-[#EBE1D5]/20" 
                    />
                    <div className="text-left">
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        <span>@{u.username}</span>
                        {u.role === 'administrador' && <Crown className="w-3 h-3 text-amber-400" />}
                      </div>
                      <span className="text-[10px] text-[#A6AFCA] capitalize">{u.role.replace('_', ' ')}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* User Security & Whitelist Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-[#0B0D18] border border-[#EBE1D5]/15">
            {/* Whitelist Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0E1120] border border-[#EBE1D5]/10">
              <div>
                <span className="text-xs font-bold text-white block">Lista Blanca</span>
                <span className="text-[10px] text-[#A6AFCA]">
                  {selectedUser.isWhitelisted ? 'Autorizado para ingresar' : 'Acceso denegado en login'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleUserWhitelist}
                disabled={!isAdmin || selectedUser.role === 'administrador'}
                className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                  selectedUser.isWhitelisted
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                    : 'bg-red-950/60 text-red-300 border-red-500/40'
                } ${selectedUser.role === 'administrador' ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {selectedUser.isWhitelisted ? 'En Lista Blanca' : 'Bloqueado'}
              </button>
            </div>

            {/* Account Active Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0E1120] border border-[#EBE1D5]/10">
              <div>
                <span className="text-xs font-bold text-white block">Estado de Cuenta</span>
                <span className="text-[10px] text-[#A6AFCA]">
                  {selectedUser.isActive ? 'Cuenta operativa activa' : 'Cuenta suspendida'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleUserActive}
                disabled={!isAdmin || selectedUser.role === 'administrador'}
                className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                  selectedUser.isActive
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                    : 'bg-red-950/60 text-red-300 border-red-500/40'
                } ${selectedUser.role === 'administrador' ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {selectedUser.isActive ? 'Activo' : 'Suspendido'}
              </button>
            </div>

            {/* 2FA Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0E1120] border border-[#EBE1D5]/10">
              <div>
                <span className="text-xs font-bold text-white block">Verificación 2FA</span>
                <span className="text-[10px] text-[#A6AFCA]">
                  {selectedUser.twoFactorEnabled 
                    ? `Código PIN: ${selectedUser.twoFactorSecret || '909090'}` 
                    : 'Sin segundo factor'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleUserTwoFactor}
                disabled={!isAdmin}
                className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                  selectedUser.twoFactorEnabled
                    ? 'bg-[#151946] text-[#EBE1D5] border-[#EBE1D5]/40'
                    : 'bg-white/5 text-[#A6AFCA] border-white/10'
                }`}
              >
                {selectedUser.twoFactorEnabled ? '2FA Activo' : 'Inactivo'}
              </button>
            </div>
          </div>

          {/* Granular Module & Action Table */}
          <div className="rounded-xl border border-[#EBE1D5]/20 bg-[#0B0D18] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#151946] border-b border-[#EBE1D5]/20 text-[#EBE1D5] uppercase font-semibold">
                  <tr>
                    <th className="p-3">Módulo del Sistema</th>
                    <th className="p-3 text-center">Consultar</th>
                    <th className="p-3 text-center">Crear</th>
                    <th className="p-3 text-center">Editar</th>
                    <th className="p-3 text-center">Anular</th>
                    <th className="p-3 text-center">Cerrar</th>
                    <th className="p-3 text-center">Administrar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBE1D5]/10">
                  {([
                    { id: 'owner_dashboard' as SystemModule, name: 'Panel del Dueño', isExclusive: true },
                    { id: 'pos' as SystemModule, name: 'Terminal POS (Caja)', isExclusive: false },
                    { id: 'waiter' as SystemModule, name: 'Módulo de Meseros', isExclusive: false },
                    { id: 'kds' as SystemModule, name: 'KDS Cocina & Bar', isExclusive: false },
                    { id: 'shifts' as SystemModule, name: 'Turnos, Caja & Cierres', isExclusive: false },
                    { id: 'inventory' as SystemModule, name: 'Inventario & Recetas', isExclusive: false },
                    { id: 'ledger' as SystemModule, name: 'Gastos & Libro Mayor', isExclusive: false },
                    { id: 'settings' as SystemModule, name: 'Configuración del Sistema', isExclusive: false },
                  ]).map((mod) => {
                    const perms = selectedUser.modulePermissions?.[mod.id] || {
                      consultar: false,
                      crear: false,
                      editar: false,
                      anular: false,
                      cerrar: false,
                      administrar: false
                    };

                    const isOwnerProtectedAdmin = selectedUser.role === 'administrador' && 
                      (mod.id === 'owner_dashboard' || mod.id === 'settings');

                    return (
                      <tr key={mod.id} className="hover:bg-[#151946]/20 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{mod.name}</span>
                            {mod.isExclusive && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#7C170D] text-white">
                                Exclusivo
                              </span>
                            )}
                          </div>
                        </td>
                        {(['consultar', 'crear', 'editar', 'anular', 'cerrar', 'administrar'] as PermissionAction[]).map((action) => {
                          const isAllowed = !!perms[action];
                          const isActionProtected = isOwnerProtectedAdmin && (action === 'administrar' || action === 'consultar');

                          return (
                            <td key={action} className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleUserAction(mod.id, action)}
                                disabled={!isAdmin || isActionProtected}
                                title={isActionProtected ? 'Protección del dueño: no se puede revocar' : `Alternar ${action} en ${mod.name}`}
                                className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all cursor-pointer ${
                                  isAllowed
                                    ? 'bg-[#151946] border border-[#EBE1D5]/40 text-emerald-400 font-bold shadow-sm'
                                    : 'bg-[#0E1120] border border-[#EBE1D5]/10 text-[#A6AFCA]/40 hover:text-[#A6AFCA]'
                                } ${isActionProtected ? 'opacity-80 ring-1 ring-amber-500/50 cursor-not-allowed' : ''}`}
                              >
                                {isAllowed ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* SECTION 3: RECENT AUDIT TRAIL OF PERMISSION MODIFICATIONS */}
        <div className="p-5 rounded-2xl bg-[#0E1120] border border-[#EBE1D5]/20 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#EBE1D5]" />
              <span>Auditoría Reciente de Cambios de Permisos y Configuración</span>
            </h3>
            <span className="text-[11px] text-[#A6AFCA] font-mono">
              Trazabilidad Inmutable
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {auditLogs
              .filter(l => l.action.includes('PERMISO') || l.action.includes('CONFIG') || l.action.includes('SEGURIDAD'))
              .slice(0, 10)
              .map(log => (
                <div key={log.id} className="p-2.5 rounded-lg bg-[#0B0D18] border border-[#EBE1D5]/15 flex items-center justify-between text-xs gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#EBE1D5] text-[11px]">{log.action}</span>
                      <span className="text-white font-medium truncate">{log.entity}</span>
                    </div>
                    <p className="text-[11px] text-[#A6AFCA] mt-0.5">{log.details}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-[#A6AFCA] font-mono block">
                      {formatDateTimeBogota(log.timestamp)}
                    </span>
                    <span className="text-[10px] text-[#EBE1D5] font-mono">
                      @{log.userName.split(' ')[0]}
                    </span>
                  </div>
                </div>
              ))}
            {auditLogs.filter(l => l.action.includes('PERMISO') || l.action.includes('CONFIG') || l.action.includes('SEGURIDAD')).length === 0 && (
              <p className="text-xs text-[#A6AFCA] text-center py-4">No hay cambios recientes de permisos registrados.</p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
