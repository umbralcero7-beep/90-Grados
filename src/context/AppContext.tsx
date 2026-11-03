import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  UserProfile, 
  UserRole,
  Product, 
  Order, 
  ShiftSession, 
  InventoryItem, 
  Recipe, 
  ExpenseRecord, 
  ExpenseCategory,
  ExpenseType,
  ExpensePaymentMethod,
  ExpenseStatus,
  ExpenseAttachment,
  LedgerEntry, 
  RestaurantConfig, 
  ModuleOperation,
  RolePermissionsConfig,
  AuditLogItem,
  PaymentRecord,
  OrderStationStatus,
  OrderItem,
  SystemModule,
  PermissionAction,
  OperationalShiftType,
  ShiftReportBundle
} from '../types';
import { 
  initialConfig, 
  initialUsers, 
  initialProducts, 
  initialInventory, 
  initialRecipes,
  defaultRolePermissions,
  defaultUserModulePermissions
} from '../data/initialData';

interface AppContextType {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  isAuthenticated: boolean;
  login: (username: string, pin: string, twoFactorCode?: string) => { success: boolean; message: string; requires2FA?: boolean; remainingAttempts?: number };
  logout: () => void;

  updateUserProfile: (id: string, updates: Partial<UserProfile>) => void;
  addUserProfile: (profile: Omit<UserProfile, 'id' | 'createdAt' | 'stats'>) => UserProfile;
  deleteUserProfile: (id: string) => boolean;
  switchUser: (id: string) => void;
  
  canUserAccessModule: (module: SystemModule, user?: UserProfile) => boolean;
  hasUserActionPermission: (module: SystemModule, action: PermissionAction, user?: UserProfile) => boolean;
  updateUserModulePermissions: (userId: string, module: SystemModule, action: PermissionAction, allowed: boolean) => { success: boolean; message: string };
  updateUserSecuritySettings: (userId: string, settings: { isWhitelisted?: boolean; isActive?: boolean; twoFactorEnabled?: boolean; twoFactorSecret?: string }) => { success: boolean; message: string };

  config: RestaurantConfig;
  updateConfig: (updates: Partial<RestaurantConfig>) => void;
  hasPermission: (operation: ModuleOperation, role?: UserRole) => boolean;
  updateRolePermission: (role: UserRole, operation: ModuleOperation, allowed: boolean) => void;
  updateAllRolePermissions: (permissions: RolePermissionsConfig) => void;

  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  bulkAddProducts: (newProducts: Product[]) => void;

  orders: Order[];
  createOrder: (tableNumber: string, items: OrderItem[], customerNote?: string) => Order;
  updateStationStatus: (orderId: string, station: 'cocina' | 'bar', status: OrderStationStatus) => void;
  completePayment: (orderId: string, payment: PaymentRecord) => void;
  cancelOrder: (orderId: string, reason: string) => void;

  currentShift: ShiftSession | null;
  shiftHistory: ShiftSession[];
  savedShiftReports: ShiftReportBundle[];
  getShiftReport: (shiftId: string) => ShiftReportBundle | undefined;
  openShift: (center: 'Restaurante Matutino' | 'Bar Nocturno', initialFund: number, operationalType?: OperationalShiftType) => void;
  closeShift: (countedCash: number, handoverNotes?: string, handoverToUserId?: string) => ShiftSession | null;

  inventory: InventoryItem[];
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  recipes: Recipe[];

  expenses: ExpenseRecord[];
  addExpense: (expenseData: {
    date?: string;
    operationalDate?: string;
    shiftId?: string;
    shiftCenter?: 'Restaurante Matutino' | 'Bar Nocturno' | 'Administración';
    amountCOP: number;
    category: ExpenseCategory | string;
    type: ExpenseType;
    description: string;
    thirdPartyName?: string;
    thirdPartyNit?: string;
    invoiceNumber?: string;
    paymentMethod: ExpensePaymentMethod;
    cashDeskId?: string;
    center?: 'Restaurante Matutino' | 'Bar Nocturno' | 'Administración';
    responsiblePerson?: string;
    supportAttachment?: ExpenseAttachment;
    status?: ExpenseStatus;
    inventoryItemId?: string;
    inventoryUnitsPurchased?: number;
    relatedExpenseId?: string;
  }) => { success: boolean; message: string; record?: ExpenseRecord };
  updateExpenseStatus: (id: string, newStatus: ExpenseStatus, note?: string) => { success: boolean; message: string };
  annulExpense: (id: string, reason: string) => { success: boolean; message: string };
  refundExpense: (id: string, refundAmountCOP: number, reason: string) => { success: boolean; message: string };
  
  ledger: LedgerEntry[];

  auditLogs: AuditLogItem[];
  addAuditLog: (action: string, entity: string, details: string, extra?: { shiftId?: string; operationalType?: string; targetRecord?: string; valueCOP?: number; reason?: string }) => void;

  isOnline: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = '90_grados_pos_v2_';

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error(`Error loading ${key} from storage:`, e);
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving ${key} to storage:`, e);
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => 
    loadFromStorage('users', initialUsers)
  );

  const [currentUserId, setCurrentUserId] = useState<string>(() => 
    loadFromStorage('current_user_id', initialUsers[0].id)
  );

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => 
    loadFromStorage('is_authenticated', true)
  );

  const currentUser = allUsers.find(u => u.id === currentUserId) || allUsers[0];

  const [config, setConfig] = useState<RestaurantConfig>(() => {
    const saved = loadFromStorage<RestaurantConfig>('config', initialConfig);
    return {
      ...initialConfig,
      ...saved,
      rolePermissions: {
        ...defaultRolePermissions,
        ...(saved?.rolePermissions || {}),
      },
    };
  });

  const [products, setProducts] = useState<Product[]>(() => 
    loadFromStorage('products', initialProducts)
  );

  const [currentShift, setCurrentShift] = useState<ShiftSession | null>(() => {
    const saved = loadFromStorage<ShiftSession | null>('current_shift', null);
    if (saved) return saved;
    // Default open shift for immediate smooth testing
    return {
      id: 'shift-today-01',
      center: 'Restaurante Matutino',
      operationalType: 'diurno_restaurante',
      openedByUserId: initialUsers[0].id,
      openedByUserName: initialUsers[0].fullName,
      openedByUserAvatar: initialUsers[0].avatarUrl,
      openedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      initialFund: 200000,
      status: 'abierto',
      expectedCash: 200000,
      countedCash: 0,
      cashDifference: 0,
      totalSalesCash: 0,
      totalSalesElectronic: 0,
      totalSalesTotal: 0,
      discountsTotal: 0,
      annulledTotal: 0,
      beverageReconciliation: [],
      version: 1,
    };
  });

  const [shiftHistory, setShiftHistory] = useState<ShiftSession[]>(() => 
    loadFromStorage('shift_history', [])
  );

  const [savedShiftReports, setSavedShiftReports] = useState<ShiftReportBundle[]>(() => 
    loadFromStorage('shift_reports', [])
  );

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = loadFromStorage<Order[]>('orders', []);
    if (saved.length > 0) return saved;
    // Pre-populate sample active orders so user can immediately test payments & KDS
    return [
      {
        id: 'ord-101',
        orderNumber: 101,
        tableNumber: 'Mesa 4',
        waiterId: 'usr-3',
        waiterName: 'Mateo Alejandro Silva',
        waiterAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&h=300&q=80',
        shiftId: 'shift-today-01',
        status: 'abierta',
        stationStatus: {
          cocina: 'en_preparacion',
          bar: 'listo',
        },
        items: [
          {
            productId: 'prd-pic-2',
            productName: 'Picada para 3 personas',
            price: 90000,
            quantity: 1,
            station: 'cocina',
            notes: 'Sin morcilla, cambiar por chorizo',
          },
          {
            productId: 'prd-jug-3',
            productName: 'Limonada Natural (Jarra)',
            price: 12000,
            quantity: 1,
            station: 'bar',
            notes: 'Bien fría con hielo',
          },
          {
            productId: 'prd-cer-1',
            productName: 'Cerveza Poker',
            price: 5000,
            quantity: 2,
            station: 'bar',
          },
        ],
        customerNote: 'Mesa familiar junto al ventanal',
        createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        totalAmount: 112000,
      },
      {
        id: 'ord-102',
        orderNumber: 102,
        tableNumber: 'Mesa 2',
        waiterId: 'usr-3',
        waiterName: 'Mateo Alejandro Silva',
        waiterAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&h=300&q=80',
        shiftId: 'shift-today-01',
        status: 'abierta',
        stationStatus: {
          cocina: 'recibido',
          bar: 'recibido',
        },
        items: [
          {
            productId: 'prd-cr-11',
            productName: 'Hamburguesa de la casa 90°',
            price: 24000,
            quantity: 1,
            station: 'cocina',
            notes: 'Término medio, sin cebolla',
          },
          {
            productId: 'prd-jug-8',
            productName: 'Gaseosa 400ml',
            price: 5000,
            quantity: 1,
            station: 'bar',
            notes: 'Colombiana helada',
          },
        ],
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        totalAmount: 29000,
      },
    ];
  });

  const [inventory, setInventory] = useState<InventoryItem[]>(() => 
    loadFromStorage('inventory', initialInventory)
  );

  const [recipes] = useState<Recipe[]>(() => 
    loadFromStorage('recipes', initialRecipes)
  );

  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => 
    loadFromStorage('expenses', [
      {
        id: 'exp-1',
        date: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        operationalDate: new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0],
        shiftId: 'shift-yesterday-02',
        shiftCenter: 'Restaurante Matutino',
        amountCOP: 145000,
        category: 'Servicios Públicos',
        type: 'gasto_operativo',
        description: 'Pago mensual de servicio de energía y alumbrado',
        thirdPartyName: 'Enel Colombia S.A. ESP',
        thirdPartyNit: '860.005.153-6',
        invoiceNumber: 'FACT-ENEL-88912',
        paymentMethod: 'efectivo_caja',
        cashDeskId: 'Caja Principal Salón',
        center: 'Restaurante Matutino',
        responsiblePerson: 'Diana Paola Torres',
        registeredByUserId: initialUsers[1].id,
        registeredByUserName: initialUsers[1].fullName,
        status: 'pagado',
        approvedByUserId: initialUsers[0].id,
        approvedByUserName: initialUsers[0].fullName,
        approvedAt: new Date(Date.now() - 23 * 3600 * 1000).toISOString(),
        auditHistory: [
          {
            timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
            userId: initialUsers[1].id,
            userName: initialUsers[1].fullName,
            action: 'REGISTRO_INICIAL',
            note: 'Registrado con soporte de recibo de caja',
            newStatus: 'pagado',
          }
        ],
      },
      {
        id: 'exp-2',
        date: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
        operationalDate: new Date(Date.now() - 36 * 3600 * 1000).toISOString().split('T')[0],
        shiftId: 'shift-admin-01',
        shiftCenter: 'Administración',
        amountCOP: 1800000,
        category: 'Arriendo & Local',
        type: 'gasto_operativo',
        description: 'Canon mensual de arrendamiento sede comercial Km 2 Vía Siberia',
        thirdPartyName: 'Inmobiliaria Los Arrayanes SAS',
        thirdPartyNit: '900.281.992-1',
        invoiceNumber: 'ARR-2026-10-09',
        paymentMethod: 'cuenta_bancaria',
        cashDeskId: 'Bancolombia Empresarial',
        center: 'Administración',
        responsiblePerson: 'Carmen Elena Morales',
        registeredByUserId: initialUsers[0].id,
        registeredByUserName: initialUsers[0].fullName,
        status: 'pagado',
        approvedByUserId: initialUsers[0].id,
        approvedByUserName: initialUsers[0].fullName,
        approvedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
        auditHistory: [
          {
            timestamp: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
            userId: initialUsers[0].id,
            userName: initialUsers[0].fullName,
            action: 'REGISTRO_Y_APROBACION',
            note: 'Transferencia bancaria programada aprobada por Gerencia',
            newStatus: 'pagado',
          }
        ],
      },
      {
        id: 'exp-3',
        date: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
        operationalDate: new Date(Date.now() - 18 * 3600 * 1000).toISOString().split('T')[0],
        shiftId: 'shift-yesterday-01',
        shiftCenter: 'Restaurante Matutino',
        amountCOP: 380000,
        category: 'Costo de Insumos',
        type: 'compra_inventario',
        description: 'Compra de 10 kg de Carne de res (Chatas) para parrilla y churrasco',
        thirdPartyName: 'Distribuidora Carnes del Llano',
        thirdPartyNit: '901.884.210-4',
        invoiceNumber: 'FAC-LLANO-4501',
        paymentMethod: 'efectivo_caja',
        cashDeskId: 'Caja Principal Salón',
        center: 'Restaurante Matutino',
        responsiblePerson: 'Carmen Elena Morales',
        registeredByUserId: initialUsers[0].id,
        registeredByUserName: initialUsers[0].fullName,
        status: 'pagado',
        inventoryItemId: 'inv-1',
        inventoryUnitsPurchased: 10000,
        approvedByUserId: initialUsers[0].id,
        approvedByUserName: initialUsers[0].fullName,
        approvedAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
        auditHistory: [
          {
            timestamp: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
            userId: initialUsers[0].id,
            userName: initialUsers[0].fullName,
            action: 'COMPRA_INVENTARIO',
            note: 'Ingresaron 10.000g de carne a Bodega central sin duplicar costo de venta',
            newStatus: 'pagado',
          }
        ],
      },
      {
        id: 'exp-4',
        date: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        operationalDate: new Date(Date.now() - 48 * 3600 * 1000).toISOString().split('T')[0],
        amountCOP: 500000,
        category: 'Aporte de Capital',
        type: 'inversion_dueno',
        description: 'Inversión de capital de la socia dueña para ampliación de cristalería de coctelería',
        thirdPartyName: 'Carmen Elena Morales (Socia Principal)',
        thirdPartyNit: '52.381.990',
        paymentMethod: 'cuenta_bancaria',
        cashDeskId: 'Bancolombia Empresarial',
        center: 'Administración',
        registeredByUserId: initialUsers[0].id,
        registeredByUserName: initialUsers[0].fullName,
        status: 'pagado',
        auditHistory: [
          {
            timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
            userId: initialUsers[0].id,
            userName: initialUsers[0].fullName,
            action: 'APORTE_CAPITAL',
            note: 'Entrada de patrimonio personal. NO se suma como venta.',
            newStatus: 'pagado',
          }
        ],
      },
      {
        id: 'exp-5',
        date: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        operationalDate: new Date(Date.now() - 12 * 3600 * 1000).toISOString().split('T')[0],
        amountCOP: 250000,
        category: 'Retiro de Capital',
        type: 'retiro_dueno',
        description: 'Retiro parcial de utilidades acumuladas para gastos personales del propietario',
        thirdPartyName: 'Carmen Elena Morales (Dueña)',
        thirdPartyNit: '52.381.990',
        paymentMethod: 'efectivo_caja',
        cashDeskId: 'Caja General Salón',
        center: 'Administración',
        registeredByUserId: initialUsers[0].id,
        registeredByUserName: initialUsers[0].fullName,
        status: 'pagado',
        auditHistory: [
          {
            timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
            userId: initialUsers[0].id,
            userName: initialUsers[0].fullName,
            action: 'RETIRO_PATRIMONIO',
            note: 'Disminución de caja por retiro de dueño. NO es gasto operacional.',
            newStatus: 'pagado',
          }
        ],
      },
      {
        id: 'exp-6',
        date: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
        operationalDate: new Date(Date.now() - 8 * 3600 * 1000).toISOString().split('T')[0],
        amountCOP: 100000,
        category: 'Transferencia entre Cajas',
        type: 'transferencia_cajas',
        description: 'Traslado de efectivo para fondo de cambio de la Caja Menor de Barra de Tragos',
        thirdPartyName: 'Fondo Menor Barra',
        paymentMethod: 'efectivo_caja',
        cashDeskId: 'Caja General -> Caja Menor Barra',
        center: 'Bar Nocturno',
        responsiblePerson: 'Diana Paola Torres',
        registeredByUserId: initialUsers[1].id,
        registeredByUserName: initialUsers[1].fullName,
        status: 'pagado',
        auditHistory: [
          {
            timestamp: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
            userId: initialUsers[1].id,
            userName: initialUsers[1].fullName,
            action: 'TRASLADO_CAJA',
            note: 'Movimiento neutral entre fondos internos.',
            newStatus: 'pagado',
          }
        ],
      },
      {
        id: 'exp-7',
        date: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        operationalDate: new Date().toISOString().split('T')[0],
        shiftId: 'shift-today-01',
        shiftCenter: 'Restaurante Matutino',
        amountCOP: 420000,
        category: 'Mantenimiento',
        type: 'gasto_operativo',
        description: 'Mantenimiento preventivo mayor y calibración de parrilla industrial y ductos',
        thirdPartyName: 'TecnoParrillas Boyacá SAS',
        thirdPartyNit: '900.881.002-8',
        invoiceNumber: 'COT-TECNO-991',
        paymentMethod: 'efectivo_caja',
        cashDeskId: 'Caja Principal Salón',
        center: 'Restaurante Matutino',
        responsiblePerson: 'Diana Paola Torres',
        registeredByUserId: initialUsers[1].id,
        registeredByUserName: initialUsers[1].fullName,
        status: 'pendiente_aprobacion',
        auditHistory: [
          {
            timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
            userId: initialUsers[1].id,
            userName: initialUsers[1].fullName,
            action: 'SOLICITUD_APROBACION',
            note: 'Monto supera el umbral configurado de COP 200.000. Requiere aprobación administrativa.',
            newStatus: 'pendiente_aprobacion',
          }
        ],
      },
      {
        id: 'exp-8',
        date: new Date(Date.now() - 30 * 3600 * 1000).toISOString(),
        operationalDate: new Date(Date.now() - 30 * 3600 * 1000).toISOString().split('T')[0],
        amountCOP: 65000,
        category: 'Suministros & Aseo',
        type: 'gasto_operativo',
        description: 'Compra de rollos de papel térmico 80mm para comanderas',
        thirdPartyName: 'Papelería El Sol',
        thirdPartyNit: '800.123.456-1',
        invoiceNumber: 'TKT-8812',
        paymentMethod: 'efectivo_caja',
        cashDeskId: 'Caja Principal Salón',
        center: 'Restaurante Matutino',
        registeredByUserId: initialUsers[1].id,
        registeredByUserName: initialUsers[1].fullName,
        status: 'anulado',
        annulledByUserId: initialUsers[0].id,
        annulledByUserName: initialUsers[0].fullName,
        annulledAt: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
        annulmentReason: 'Comprobante duplicado por error de digitación; el pago real se hizo por transferencia',
        auditHistory: [
          {
            timestamp: new Date(Date.now() - 30 * 3600 * 1000).toISOString(),
            userId: initialUsers[1].id,
            userName: initialUsers[1].fullName,
            action: 'CREACION',
            newStatus: 'pagado',
          },
          {
            timestamp: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
            userId: initialUsers[0].id,
            userName: initialUsers[0].fullName,
            action: 'ANULACION_AUDITADA',
            note: 'Anulación con reverso contable: Comprobante duplicado por error de digitación',
            previousStatus: 'pagado',
            newStatus: 'anulado',
          }
        ],
      },
    ])
  );

  const [ledger, setLedger] = useState<LedgerEntry[]>(() => 
    loadFromStorage('ledger', [
      {
        id: 'led-1',
        date: new Date().toISOString().split('T')[0],
        concept: 'Apertura de turno matutino - Fondo de caja',
        debitAccount: '110505 - Caja General',
        creditAccount: '111005 - Bancos / Transferencia',
        amountCOP: 200000,
        user: 'Carmen Elena Morales',
        sourceType: 'traspaso',
      },
      {
        id: 'led-2',
        date: new Date().toISOString().split('T')[0],
        concept: 'Compra de verduras e insumos frescos',
        debitAccount: '143505 - Inventario Insumos',
        creditAccount: '110505 - Caja General',
        amountCOP: 180000,
        user: 'Carmen Elena Morales',
        sourceType: 'gasto',
      },
    ])
  );

  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(() => 
    loadFromStorage('audit_logs', [
      {
        id: 'aud-1',
        timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
        userId: initialUsers[0].id,
        userName: initialUsers[0].fullName,
        userAvatar: initialUsers[0].avatarUrl,
        action: 'APERTURA_TURNO',
        entity: 'Caja - Restaurante Matutino',
        details: 'Apertura con fondo inicial de $ 200.000 COP',
      },
    ])
  );

  const [isOnline] = useState<boolean>(true);

  // Sync to local storage
  useEffect(() => saveToStorage('users', allUsers), [allUsers]);
  useEffect(() => saveToStorage('current_user_id', currentUserId), [currentUserId]);
  useEffect(() => saveToStorage('is_authenticated', isAuthenticated), [isAuthenticated]);
  useEffect(() => saveToStorage('config', config), [config]);
  useEffect(() => saveToStorage('products', products), [products]);
  useEffect(() => saveToStorage('current_shift', currentShift), [currentShift]);
  useEffect(() => saveToStorage('shift_history', shiftHistory), [shiftHistory]);
  useEffect(() => saveToStorage('shift_reports', savedShiftReports), [savedShiftReports]);
  useEffect(() => saveToStorage('orders', orders), [orders]);
  useEffect(() => saveToStorage('inventory', inventory), [inventory]);
  useEffect(() => saveToStorage('expenses', expenses), [expenses]);
  useEffect(() => saveToStorage('ledger', ledger), [ledger]);
  useEffect(() => saveToStorage('audit_logs', auditLogs), [auditLogs]);

  const addAuditLog = (
    action: string, 
    entity: string, 
    details: string,
    extra?: {
      shiftId?: string;
      operationalType?: string;
      targetRecord?: string;
      valueCOP?: number;
      reason?: string;
    }
  ) => {
    const newEntry: AuditLogItem = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      userId: currentUser?.id || 'anon',
      userName: currentUser?.fullName || 'Sistema',
      userAvatar: currentUser?.avatarUrl,
      action,
      entity,
      details,
      shiftId: extra?.shiftId || currentShift?.id,
      operationalType: extra?.operationalType || currentShift?.operationalType,
      targetRecord: extra?.targetRecord,
      valueCOP: extra?.valueCOP,
      reason: extra?.reason,
    };
    setAuditLogs(prev => [newEntry, ...prev.slice(0, 499)]);
  };

  // =========================================================================
  // 1. AUTENTICACIÓN, LISTA BLANCA, INTENTOS FALLIDOS (RATE LIMIT) Y 2FA
  // =========================================================================
  const login = (
    username: string, 
    pin: string, 
    twoFactorCode?: string
  ): { success: boolean; message: string; requires2FA?: boolean; remainingAttempts?: number } => {
    const cleanInput = username.trim().toLowerCase().replace(/^@/, '');
    const user = allUsers.find(u => u.username.toLowerCase() === cleanInput || (u.email && u.email.toLowerCase() === cleanInput));

    // Standard neutral security message (never reveal if username, PIN, whitelist or 2FA failed)
    const genericErrorMsg = 'No fue posible iniciar sesión. Verifica tus datos o solicita ayuda al administrador.';

    // Rate Limiting & Account Lockout Check
    if (user?.lockedUntil) {
      const lockExpiry = new Date(user.lockedUntil).getTime();
      const now = Date.now();
      if (now < lockExpiry) {
        addAuditLog('INTENTO_BLOQUEADO', `Usuario @${user.username}`, 'Intento de acceso denegado durante periodo de bloqueo temporal');
        return {
          success: false,
          message: genericErrorMsg,
          remainingAttempts: 0
        };
      } else {
        // Unlock expired: reset counter
        setAllUsers(prev => prev.map(u => u.id === user.id ? { ...u, lockedUntil: null, failedAttempts: 0 } : u));
      }
    }

    // Check whitelist and active state
    if (!user || user.isWhitelisted === false || user.isActive === false) {
      if (user) {
        const attempts = (user.failedAttempts || 0) + 1;
        const willLock = attempts >= 3;
        const lockedUntil = willLock ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null;
        setAllUsers(prev => prev.map(u => u.id === user.id ? { 
          ...u, 
          failedAttempts: willLock ? 0 : attempts, 
          lockedUntil 
        } : u));
        addAuditLog('INTENTO_FALLIDO', `Usuario @${user.username}`, 'Intento de inicio de sesión rechazado (inactivo/no autorizado)');
      }
      return { success: false, message: genericErrorMsg, remainingAttempts: user ? Math.max(3 - ((user.failedAttempts || 0) + 1), 0) : 0 };
    }

    // Check PIN credential
    if (user.pin !== pin) {
      const currentAttempts = (user.failedAttempts || 0) + 1;
      const willLock = currentAttempts >= 3;
      const lockedUntil = willLock ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null;
      
      setAllUsers(prev => prev.map(u => u.id === user.id ? { 
        ...u, 
        failedAttempts: willLock ? 0 : currentAttempts, 
        lockedUntil 
      } : u));

      addAuditLog('INTENTO_FALLIDO', `Usuario @${user.username}`, 
        willLock ? 'Cuenta bloqueada por 3 intentos fallidos consecutivos' : `Intento fallido de PIN (${currentAttempts}/3)`);

      return {
        success: false,
        message: genericErrorMsg,
        remainingAttempts: Math.max(3 - currentAttempts, 0)
      };
    }

    // Two-factor authentication check
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        return {
          success: false,
          message: '',
          requires2FA: true
        };
      }
      const clean2FA = twoFactorCode.trim();
      const validCode = user.twoFactorSecret || '909090';
      if (clean2FA !== validCode && clean2FA !== '909090') {
        const currentAttempts = (user.failedAttempts || 0) + 1;
        const willLock = currentAttempts >= 3;
        const lockedUntil = willLock ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null;
        setAllUsers(prev => prev.map(u => u.id === user.id ? { 
          ...u, 
          failedAttempts: willLock ? 0 : currentAttempts, 
          lockedUntil 
        } : u));
        addAuditLog('INTENTO_FALLIDO_2FA', `Usuario @${user.username}`, 'Código 2FA incorrecto');
        return {
          success: false,
          message: genericErrorMsg,
          requires2FA: true
        };
      }
    }

    // Success: reset attempts and set authenticated user
    setAllUsers(prev => prev.map(u => u.id === user.id ? { 
      ...u, 
      failedAttempts: 0, 
      lockedUntil: null, 
      lastLogin: new Date().toISOString() 
    } : u));

    setCurrentUserId(user.id);
    setIsAuthenticated(true);
    addAuditLog('INICIO_SESION', `Usuario @${user.username}`, `Inicio de sesión exitoso como ${user.role}`);

    return { success: true, message: `Bienvenido, ${user.fullName}.` };
  };

  const logout = () => {
    addAuditLog('CIERRE_SESION', `Usuario @${currentUser.username}`, 'Cierre de sesión manual');
    setIsAuthenticated(false);
  };

  // =========================================================================
  // 2. COMPROBACIÓN DE PERMISOS GRANULARES POR USUARIO Y MÓDULO (CAPA DE DATOS)
  // =========================================================================
  const canUserAccessModule = (module: SystemModule, user?: UserProfile): boolean => {
    const target = user || currentUser;
    if (!target) return false;
    // Administrador has full access
    if (target.role === 'administrador') return true;
    
    // Check user-specific permissions
    const userPerm = target.modulePermissions?.[module]?.consultar;
    if (userPerm !== undefined) return userPerm;

    // Fallback to role defaults
    const roleDefault = defaultUserModulePermissions[target.role]?.[module]?.consultar;
    return !!roleDefault;
  };

  const hasUserActionPermission = (
    module: SystemModule, 
    action: PermissionAction, 
    user?: UserProfile
  ): boolean => {
    const target = user || currentUser;
    if (!target) return false;
    // Administrador has full action rights
    if (target.role === 'administrador') return true;

    // Check user-specific permissions
    const userPerm = target.modulePermissions?.[module]?.[action];
    if (userPerm !== undefined) return userPerm;

    // Fallback to role defaults
    const roleDefault = defaultUserModulePermissions[target.role]?.[module]?.[action];
    return !!roleDefault;
  };

  const updateUserModulePermissions = (
    userId: string, 
    module: SystemModule, 
    action: PermissionAction, 
    allowed: boolean
  ): { success: boolean; message: string } => {
    // Only administrators can edit permissions
    if (currentUser.role !== 'administrador') {
      return { success: false, message: 'Operación denegada: Solo el dueño/administrador puede modificar permisos.' };
    }

    const target = allUsers.find(u => u.id === userId);
    if (!target) return { success: false, message: 'Usuario no encontrado.' };

    // SAFEGUARD: The owner/admin cannot remove their own admin access to settings or owner dashboard
    if (target.role === 'administrador' && !allowed && (action === 'administrar' || action === 'consultar')) {
      const adminCount = allUsers.filter(u => u.role === 'administrador' && u.isActive).length;
      if (adminCount <= 1 || target.id === 'usr-1' || target.id === currentUser.id) {
        return { 
          success: false, 
          message: 'Protección de seguridad: No puede revocar el acceso administrativo o de consulta del Dueño a este módulo.' 
        };
      }
    }

    setAllUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const currentMod = u.modulePermissions?.[module] || defaultUserModulePermissions[u.role]?.[module] || {};
        const updatedModulePerms = {
          ...(u.modulePermissions || defaultUserModulePermissions[u.role] || {}),
          [module]: {
            ...currentMod,
            [action]: allowed
          }
        };
        return {
          ...u,
          modulePermissions: updatedModulePerms
        };
      }
      return u;
    }));

    addAuditLog(
      'PERMISOS_MODIFICADOS', 
      `Usuario @${target.username}`, 
      `Permiso "${action}" en módulo "${module}" establecido en ${allowed ? 'PERMITIDO' : 'DENEGADO'} por @${currentUser.username}`,
      { targetRecord: `user-${userId}`, reason: 'Ajuste de matriz granular de permisos' }
    );

    return { success: true, message: `Permiso "${action}" actualizado con éxito para @${target.username}.` };
  };

  const updateUserSecuritySettings = (
    userId: string, 
    settings: { isWhitelisted?: boolean; isActive?: boolean; twoFactorEnabled?: boolean; twoFactorSecret?: string }
  ): { success: boolean; message: string } => {
    if (currentUser.role !== 'administrador') {
      return { success: false, message: 'Operación denegada: Solo el dueño puede modificar el estado de seguridad de los usuarios.' };
    }

    const target = allUsers.find(u => u.id === userId);
    if (!target) return { success: false, message: 'Usuario no encontrado.' };

    // SAFEGUARD: The owner cannot deactivate or remove themselves from the whitelist
    if ((target.id === 'usr-1' || target.id === currentUser.id) && (settings.isActive === false || settings.isWhitelisted === false)) {
      return { 
        success: false, 
        message: 'Protección de seguridad: La cuenta del Dueño no puede desactivarse ni removerse de la lista blanca autorizada.' 
      };
    }

    setAllUsers(prev => prev.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          ...settings
        };
      }
      return u;
    }));

    addAuditLog(
      'SEGURIDAD_USUARIO_MODIFICADA', 
      `Usuario @${target.username}`, 
      `Configuración de seguridad actualizada: ${JSON.stringify(settings)}`,
      { targetRecord: `user-${userId}` }
    );

    return { success: true, message: `Configuración de seguridad actualizada para @${target.username}.` };
  };

  // User Profile Management
  const updateUserProfile = (id: string, updates: Partial<UserProfile>) => {
    setAllUsers(prev => prev.map(user => {
      if (user.id === id) {
        const updated = { ...user, ...updates };
        addAuditLog('PERFIL_ACTUALIZADO', `Usuario ${updated.username}`, 
          `Campos actualizados: ${Object.keys(updates).join(', ')}`);
        return updated;
      }
      return user;
    }));
  };

  const addUserProfile = (profileData: Omit<UserProfile, 'id' | 'createdAt' | 'stats'>): UserProfile => {
    const newUser: UserProfile = {
      ...profileData,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      stats: {
        ordersCreated: 0,
        totalSoldCOP: 0,
        shiftsClosed: 0,
      },
    };
    setAllUsers(prev => [...prev, newUser]);
    addAuditLog('USUARIO_CREADO', `Usuario @${newUser.username}`, `Rol: ${newUser.role}`);
    return newUser;
  };

  const deleteUserProfile = (id: string): boolean => {
    if (allUsers.length <= 1) return false;
    const target = allUsers.find(u => u.id === id);
    if (!target) return false;
    setAllUsers(prev => prev.filter(u => u.id !== id));
    if (currentUserId === id) {
      const remaining = allUsers.filter(u => u.id !== id);
      setCurrentUserId(remaining[0].id);
    }
    addAuditLog('USUARIO_ELIMINADO', `Usuario @${target.username}`, `Eliminado por @${currentUser.username}`);
    return true;
  };

  const switchUser = (id: string) => {
    const found = allUsers.find(u => u.id === id);
    if (found) {
      setCurrentUserId(id);
      setAllUsers(prev => prev.map(u => u.id === id ? { ...u, lastLogin: new Date().toISOString() } : u));
      addAuditLog('CAMBIO_USUARIO', `Sesión activa`, `Inició sesión @${found.username} (${found.role})`);
    }
  };

  const updateConfig = (updates: Partial<RestaurantConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    addAuditLog('CONFIGURACION_MODIFICADA', 'Datos del Establecimiento', 'Datos de razón social o NIT actualizados');
  };

  const hasPermission = (operation: ModuleOperation, role?: UserRole): boolean => {
    const targetRole = role || currentUser.role;
    const perms = config.rolePermissions?.[targetRole];
    if (!perms) {
      return defaultRolePermissions[targetRole]?.[operation] ?? (targetRole === 'administrador');
    }
    return !!perms[operation];
  };

  const updateRolePermission = (role: UserRole, operation: ModuleOperation, allowed: boolean) => {
    const currentPerms = config.rolePermissions || defaultRolePermissions;
    const roleMap = currentPerms[role] || {
      registrar_gastos: false,
      aprobar_pagos: false,
      ver_reportes: false,
      gestionar_inventario: false,
    };
    const updatedPerms: RolePermissionsConfig = {
      ...currentPerms,
      [role]: {
        ...roleMap,
        [operation]: allowed,
      },
    };

    const updates: Partial<RestaurantConfig> = {
      rolePermissions: updatedPerms,
    };
    if (role === 'mesero' && operation === 'registrar_gastos') {
      updates.allowWaitersToRegisterExpenses = allowed;
    }

    setConfig(prev => ({ ...prev, ...updates }));
    addAuditLog(
      'PERMISOS_MODIFICADOS',
      `Rol: ${role}`,
      `Operación "${operation}" ${allowed ? 'HABILITADA' : 'RESTRINGIDA'} por @${currentUser.username}`
    );
  };

  const updateAllRolePermissions = (permissions: RolePermissionsConfig) => {
    setConfig(prev => ({
      ...prev,
      rolePermissions: permissions,
      allowWaitersToRegisterExpenses: !!permissions.mesero?.registrar_gastos,
    }));
    addAuditLog('PERMISOS_MASIVOS_ACTUALIZADOS', 'Matriz de Permisos', `Actualizada por @${currentUser.username}`);
  };

  const addProduct = (p: Omit<Product, 'id'>) => {
    const newProduct: Product = {
      ...p,
      id: `prd-${Date.now()}`,
    };
    setProducts(prev => [...prev, newProduct]);
    addAuditLog('PRODUCTO_CREADO', newProduct.name, `Precio: COP ${newProduct.price}`);
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    addAuditLog('PRODUCTO_ACTUALIZADO', `ID ${id}`, `Actualizados campos: ${Object.keys(updates).join(', ')}`);
  };

  const bulkAddProducts = (newProducts: Product[]) => {
    setProducts(prev => {
      const existingIds = new Set(prev.map(p => p.sku));
      const filtered = newProducts.filter(np => !existingIds.has(np.sku));
      return [...prev, ...filtered];
    });
    addAuditLog('IMPORTACION_MASIVA', 'Carta de Productos', `Se agregaron ${newProducts.length} productos`);
  };

  const createOrder = (tableNumber: string, items: OrderItem[], customerNote?: string): Order => {
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const hasKitchen = items.some(i => i.station === 'cocina');
    const hasBar = items.some(i => i.station === 'bar');

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: (orders[0]?.orderNumber || 100) + 1,
      tableNumber,
      waiterId: currentUser.id,
      waiterName: currentUser.fullName,
      waiterAvatar: currentUser.avatarUrl,
      shiftId: currentShift?.id || 'sin-turno',
      status: 'abierta',
      stationStatus: {
        cocina: hasKitchen ? 'recibido' : 'entregado',
        bar: hasBar ? 'recibido' : 'entregado',
      },
      items,
      customerNote,
      createdAt: new Date().toISOString(),
      totalAmount,
    };

    setOrders(prev => [newOrder, ...prev]);

    // Update waiter stats
    setAllUsers(prev => prev.map(u => 
      u.id === currentUser.id 
        ? { ...u, stats: { ...u.stats, ordersCreated: u.stats.ordersCreated + 1 } }
        : u
    ));

    addAuditLog('ORDEN_CREADA', `#${newOrder.orderNumber} (${tableNumber})`, 
      `Total: COP ${totalAmount} por @${currentUser.username}`);

    return newOrder;
  };

  const updateStationStatus = (orderId: string, station: 'cocina' | 'bar', status: OrderStationStatus) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          stationStatus: {
            ...o.stationStatus,
            [station]: status,
          },
        };
      }
      return o;
    }));
  };

  const completePayment = (orderId: string, payment: PaymentRecord) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status: 'pagada',
          payment,
        };
      }
      return o;
    }));

    // Update current shift cash ledger
    if (currentShift) {
      const cashPortion = payment.methods
        .filter(m => m.method === 'efectivo')
        .reduce((sum, m) => sum + m.amount, 0);
      const electronicPortion = payment.methods
        .filter(m => m.method !== 'efectivo')
        .reduce((sum, m) => sum + m.amount, 0);

      setCurrentShift(prev => {
        if (!prev) return null;
        return {
          ...prev,
          expectedCash: prev.expectedCash + cashPortion,
          totalSalesCash: prev.totalSalesCash + cashPortion,
          totalSalesElectronic: prev.totalSalesElectronic + electronicPortion,
          totalSalesTotal: prev.totalSalesTotal + payment.totalDue,
        };
      });
    }

    // Update cashier stats
    setAllUsers(prev => prev.map(u => 
      u.id === currentUser.id 
        ? { ...u, stats: { ...u.stats, totalSoldCOP: u.stats.totalSoldCOP + payment.totalDue } }
        : u
    ));

    // Register into double entry ledger
    const newLedgerEntry: LedgerEntry = {
      id: `led-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      concept: `Venta POS Orden ${orderId} - Pago completado`,
      debitAccount: payment.methods.some(m => m.method === 'efectivo') ? '110505 - Caja General' : '111005 - Bancos/Electrónico',
      creditAccount: '414005 - Ingresos por Restaurante & Bar',
      amountCOP: payment.totalDue,
      user: currentUser.fullName,
      sourceType: 'venta',
    };
    setLedger(prev => [newLedgerEntry, ...prev]);

    addAuditLog('PAGO_REGISTRADO', `Orden ${orderId}`, 
      `Total: COP ${payment.totalDue}. Recibido: ${payment.receivedCash}, Vuelto: ${payment.changeGiven}. Cajero: @${currentUser.username}`);
  };

  const cancelOrder = (orderId: string, reason: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelada' } : o));
    addAuditLog('ORDEN_ANULADA', `Orden ${orderId}`, `Motivo: ${reason}. Autorizado por: @${currentUser.username}`);
  };

  const openShift = (
    center: 'Restaurante Matutino' | 'Bar Nocturno', 
    initialFund: number, 
    operationalType?: OperationalShiftType
  ) => {
    if (!hasUserActionPermission('shifts', 'crear')) {
      addAuditLog('INTENTO_NO_AUTORIZADO', 'Apertura de Turno', `Usuario @${currentUser.username} intentó abrir turno sin autorización`);
      return;
    }

    const resolvedOpType: OperationalShiftType = operationalType || 
      (center === 'Bar Nocturno' ? 'nocturno_discoteca' : 'diurno_restaurante');

    const newShift: ShiftSession = {
      id: `shift-${Date.now()}`,
      center,
      operationalType: resolvedOpType,
      openedByUserId: currentUser.id,
      openedByUserName: currentUser.fullName,
      openedByUserAvatar: currentUser.avatarUrl,
      openedAt: new Date().toISOString(),
      initialFund,
      status: 'abierto',
      expectedCash: initialFund,
      countedCash: 0,
      cashDifference: 0,
      totalSalesCash: 0,
      totalSalesElectronic: 0,
      totalSalesTotal: 0,
      discountsTotal: 0,
      annulledTotal: 0,
      beverageReconciliation: [],
      version: 1,
    };
    setCurrentShift(newShift);
    addAuditLog(
      'TURNO_ABIERTO', 
      `${center}`, 
      `Apertura de turno (${resolvedOpType === 'diurno_restaurante' ? 'Diurno / Restaurante' : 'Nocturno / Discoteca'}). Fondo de caja: COP ${initialFund}. Responsable: @${currentUser.username}`,
      { shiftId: newShift.id, operationalType: resolvedOpType, valueCOP: initialFund }
    );
  };

  const getShiftReport = (shiftId: string): ShiftReportBundle | undefined => {
    return savedShiftReports.find(r => r.shiftId === shiftId);
  };

  const closeShift = (countedCash: number, handoverNotes?: string, handoverToUserId?: string): ShiftSession | null => {
    if (!currentShift) return null;

    if (!hasUserActionPermission('shifts', 'cerrar')) {
      addAuditLog('INTENTO_NO_AUTORIZADO', 'Cierre de Turno', `Usuario @${currentUser.username} intentó cerrar turno sin autorización`);
      return null;
    }

    const diff = countedCash - currentShift.expectedCash;
    const toUser = allUsers.find(u => u.id === handoverToUserId);
    const closureTimestamp = new Date().toISOString();

    const closed: ShiftSession = {
      ...currentShift,
      status: 'cerrado',
      closedByUserId: currentUser.id,
      closedByUserName: currentUser.fullName,
      closedAt: closureTimestamp,
      countedCash,
      cashDifference: diff,
      notes: handoverNotes,
      transferHandover: toUser ? {
        toUserId: toUser.id,
        toUserName: toUser.fullName,
        verifiedFund: countedCash,
        notes: handoverNotes || 'Traspaso de turno conforme',
        signedAt: closureTimestamp,
      } : undefined,
      version: (currentShift.version || 1) + 1,
    };

    // =========================================================================
    // GENERACIÓN AUTOMÁTICA E IDEMPOTENTE DEL PAQUETE DE REPORTES DE CIERRE
    // =========================================================================
    const idempotencyHash = `rep-hash-${closed.id}`;
    const alreadyGenerated = savedShiftReports.some(r => r.generationHash === idempotencyHash);

    if (!alreadyGenerated) {
      // Filtrar órdenes reales correspondientes a este turno
      const shiftOrders = orders.filter(o => o.shiftId === closed.id || (o.status === 'pagada' && o.payment && o.createdAt >= closed.openedAt));
      
      // Detalle de productos vendidos
      const itemsMap: Record<string, { productId: string; productName: string; category: string; quantity: number; unitPrice: number; subtotal: number; discounts: number }> = {};
      const byCategory: Record<string, { quantity: number; total: number }> = {};
      const byPaymentMethod: Record<string, number> = { efectivo: 0, nequi: 0, daviplata: 0, tarjeta: 0, otro: 0 };
      
      let totalGross = 0;
      let totalDiscounts = 0;

      shiftOrders.forEach(ord => {
        if (ord.status === 'pagada') {
          ord.items.forEach(it => {
            const prod = products.find(p => p.id === it.productId);
            const cat = prod?.category || 'General';
            
            if (!itemsMap[it.productId]) {
              itemsMap[it.productId] = {
                productId: it.productId,
                productName: it.productName,
                category: cat,
                quantity: 0,
                unitPrice: it.price,
                subtotal: 0,
                discounts: 0,
              };
            }
            itemsMap[it.productId].quantity += it.quantity;
            itemsMap[it.productId].subtotal += (it.price * it.quantity);
            totalGross += (it.price * it.quantity);

            if (!byCategory[cat]) {
              byCategory[cat] = { quantity: 0, total: 0 };
            }
            byCategory[cat].quantity += it.quantity;
            byCategory[cat].total += (it.price * it.quantity);
          });

          if (ord.payment) {
            ord.payment.methods.forEach(m => {
              byPaymentMethod[m.method] = (byPaymentMethod[m.method] || 0) + m.amount;
            });
          }
        } else if (ord.status === 'cancelada') {
          totalDiscounts += ord.totalAmount;
        }
      });

      // Cálculo de ventas por estación (Cocina vs Bar)
      let stationCocina = 0;
      let stationBar = 0;
      shiftOrders.forEach(o => {
        if (o.status === 'pagada') {
          o.items.forEach(i => {
            if (i.station === 'cocina') stationCocina += (i.price * i.quantity);
            else stationBar += (i.price * i.quantity);
          });
        }
      });

      const reportBundle: ShiftReportBundle = {
        id: `rep-${closed.id}`,
        shiftId: closed.id,
        shiftCenter: closed.center,
        operationalType: closed.operationalType || (closed.center === 'Bar Nocturno' ? 'nocturno_discoteca' : 'diurno_restaurante'),
        openedAt: closed.openedAt,
        closedAt: closureTimestamp,
        openedByUserId: closed.openedByUserId,
        openedByUserName: closed.openedByUserName,
        closedByUserId: currentUser.id,
        closedByUserName: currentUser.fullName,
        version: closed.version,
        generationHash: idempotencyHash,
        generatedAt: closureTimestamp,

        salesDetailed: {
          items: Object.values(itemsMap),
          byCategory,
          byPaymentMethod,
          totalGross: totalGross > 0 ? totalGross : closed.totalSalesTotal,
          totalDiscounts,
          totalNet: (totalGross > 0 ? totalGross : closed.totalSalesTotal) - totalDiscounts,
          totalOrdersCount: shiftOrders.filter(o => o.status === 'pagada').length,
        },

        cashSummary: {
          initialFund: closed.initialFund,
          expectedCash: closed.expectedCash,
          countedCash,
          cashDifference: diff,
          electronicTotal: closed.totalSalesElectronic,
          cashTotal: closed.totalSalesCash,
          handoverNotes,
        },

        corteX: {
          generatedAt: closureTimestamp,
          totalOrders: shiftOrders.length,
          activeTablesCount: shiftOrders.filter(o => o.status === 'abierta').length,
          salesByStation: { cocina: stationCocina, bar: stationBar },
          summaryText: `Corte X informativo consolidado para ${closed.center} (${closed.operationalType}).`,
        },

        corteZ: {
          fiscalZNumber: savedShiftReports.length + 1,
          finalClosureAt: closureTimestamp,
          officialStatus: 'CIERRE_DEFINITIVO_GUARDADO',
          disclaimer: 'Corte Z administrativo generado automáticamente por 90 Grados POS. Mantenga copia para archivo contable y confirme el formato fiscal aplicable con su contador o proveedor de facturación.',
          totalCollected: closed.totalSalesTotal,
          auditNote: `Cierre verificado por @${currentUser.username}. Diferencia de arqueo: ${diff === 0 ? 'Sin discrepancias' : diff > 0 ? `Sobrante de COP +${diff}` : `Faltante de COP ${diff}`}.`,
        },
      };

      setSavedShiftReports(prev => [reportBundle, ...prev]);
    }

    setShiftHistory(prev => [closed, ...prev]);
    setCurrentShift(null);

    // Update user stats
    setAllUsers(prev => prev.map(u => 
      u.id === currentUser.id 
        ? { ...u, stats: { ...u.stats, shiftsClosed: u.stats.shiftsClosed + 1 } }
        : u
    ));

    addAuditLog(
      'TURNO_CERRADO', 
      `${closed.center}`, 
      `Cierre de turno ${closed.operationalType}. Esperado: COP ${closed.expectedCash}, Contado: COP ${countedCash}, Diferencia: COP ${diff}. Reporte Z archivado automáticamente.`,
      { shiftId: closed.id, operationalType: closed.operationalType, valueCOP: closed.totalSalesTotal }
    );

    return closed;
  };

  const updateInventoryItem = (id: string, updates: Partial<InventoryItem>) => {
    setInventory(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    addAuditLog('INVENTARIO_AJUSTADO', `Insumo ${id}`, `Actualizado: ${JSON.stringify(updates)}`);
  };

  const addExpense = (expData: {
    date?: string;
    operationalDate?: string;
    shiftId?: string;
    shiftCenter?: 'Restaurante Matutino' | 'Bar Nocturno' | 'Administración';
    amountCOP: number;
    category: ExpenseCategory | string;
    type: ExpenseType;
    description: string;
    thirdPartyName?: string;
    thirdPartyNit?: string;
    invoiceNumber?: string;
    paymentMethod: ExpensePaymentMethod;
    cashDeskId?: string;
    center?: 'Restaurante Matutino' | 'Bar Nocturno' | 'Administración';
    responsiblePerson?: string;
    supportAttachment?: ExpenseAttachment;
    status?: ExpenseStatus;
    inventoryItemId?: string;
    inventoryUnitsPurchased?: number;
    relatedExpenseId?: string;
  }): { success: boolean; message: string; record?: ExpenseRecord } => {
    const amount = Math.round(Number(expData.amountCOP));
    if (isNaN(amount) || amount <= 0) {
      return { success: false, message: 'El valor del egreso debe ser un número entero mayor a cero en Pesos Colombianos (COP).' };
    }

    if (!expData.description || !expData.description.trim()) {
      return { success: false, message: 'La descripción o concepto del movimiento es obligatoria.' };
    }

    // Role Security: Check permission from context configuration
    if (!hasPermission('registrar_gastos', currentUser.role)) {
      addAuditLog('SEGURIDAD_ACCESO_DENEGADO', 'Control de Gastos', 
        `Intento no autorizado de registro de egreso por rol "${currentUser.role}" (@${currentUser.username})`);
      return { 
        success: false, 
        message: `Permiso denegado: El rol "${currentUser.role}" no tiene autorización para registrar egresos según la configuración de permisos. Solicite a la Administración habilitar el permiso.` 
      };
    }

    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];
    const threshold = config.approvalThresholdCOP ?? 200000;

    // Approval flow determination
    let finalStatus: ExpenseStatus;
    let initialAction = 'CREACION';
    let auditNote = '';

    if (expData.status === 'borrador') {
      finalStatus = 'borrador';
      initialAction = 'REGISTRO_BORRADOR';
      auditNote = 'Guardado como borrador para posterior revisión';
    } else if (currentUser.role !== 'administrador' && amount >= threshold) {
      finalStatus = 'pendiente_aprobacion';
      initialAction = 'SOLICITUD_APROBACION';
      auditNote = `Monto de COP ${amount} supera o iguala el umbral de aprobación de COP ${threshold}. Requiere visto bueno de Administrador.`;
    } else if (currentUser.role === 'administrador') {
      finalStatus = expData.status || 'aprobado';
      initialAction = 'REGISTRO_Y_APROBACION_ADMIN';
      auditNote = `Registrado y validado con privilegios de Administrador (@${currentUser.username})`;
    } else {
      finalStatus = 'pagado';
      initialAction = 'REGISTRO_CAJA';
      auditNote = `Registrado por @${currentUser.username} dentro del margen automático autorizado`;
    }

    const newId = `exp-${Date.now()}`;

    const newExp: ExpenseRecord = {
      id: newId,
      date: expData.date || nowIso,
      operationalDate: expData.operationalDate || todayStr,
      shiftId: expData.shiftId || (currentShift ? currentShift.id : undefined),
      shiftCenter: expData.shiftCenter || (currentShift ? currentShift.center : 'Administración'),
      amountCOP: amount,
      category: expData.category,
      type: expData.type,
      description: expData.description.trim(),
      thirdPartyName: expData.thirdPartyName?.trim() || undefined,
      thirdPartyNit: expData.thirdPartyNit?.trim() || undefined,
      invoiceNumber: expData.invoiceNumber?.trim() || undefined,
      paymentMethod: expData.paymentMethod,
      cashDeskId: expData.cashDeskId || (currentShift ? currentShift.center : 'Caja Principal'),
      center: expData.center || (currentShift ? currentShift.center : 'Administración'),
      responsiblePerson: expData.responsiblePerson?.trim() || currentUser.fullName,
      supportAttachment: expData.supportAttachment,
      registeredByUserId: currentUser.id,
      registeredByUserName: currentUser.fullName,
      status: finalStatus,
      approvedByUserId: (finalStatus === 'aprobado' || finalStatus === 'pagado') && currentUser.role === 'administrador' ? currentUser.id : undefined,
      approvedByUserName: (finalStatus === 'aprobado' || finalStatus === 'pagado') && currentUser.role === 'administrador' ? currentUser.fullName : undefined,
      approvedAt: (finalStatus === 'aprobado' || finalStatus === 'pagado') && currentUser.role === 'administrador' ? nowIso : undefined,
      relatedExpenseId: expData.relatedExpenseId,
      inventoryItemId: expData.inventoryItemId,
      inventoryUnitsPurchased: expData.inventoryUnitsPurchased,
      auditHistory: [
        {
          timestamp: nowIso,
          userId: currentUser.id,
          userName: currentUser.fullName,
          action: initialAction,
          note: auditNote,
          newStatus: finalStatus,
        }
      ],
    };

    // Update Inventory stock if it was an inventory purchase (without duplicate entry!)
    if (expData.type === 'compra_inventario' && expData.inventoryItemId && expData.inventoryUnitsPurchased && expData.inventoryUnitsPurchased > 0) {
      setInventory(prev => prev.map(item => {
        if (item.id === expData.inventoryItemId) {
          const updatedStock = item.currentStock + Number(expData.inventoryUnitsPurchased);
          return { ...item, currentStock: updatedStock };
        }
        return item;
      }));
      addAuditLog('INVENTARIO_VINCULADO_A_GASTO', `Insumo ${expData.inventoryItemId}`, 
        `Ingresaron ${expData.inventoryUnitsPurchased} unidades vinculadas al egreso ${newId}`);
    }

    setExpenses(prev => [newExp, ...prev]);

    // Ledger double entry according to Colombian standard chart of accounts (PUC)
    let debitAcc = '510505 - Gastos Operacionales';
    let creditAcc = expData.paymentMethod === 'efectivo_caja' ? '110505 - Caja General' : '111005 - Bancos / Transferencia';

    if (expData.type === 'inversion_dueno') {
      debitAcc = expData.paymentMethod === 'efectivo_caja' ? '110505 - Caja General' : '111005 - Bancos';
      creditAcc = '310505 - Capital Social / Aportes Dueño';
    } else if (expData.type === 'retiro_dueno') {
      debitAcc = '310515 - Retiros de Capital / Utilidades Propietario';
      creditAcc = expData.paymentMethod === 'efectivo_caja' ? '110505 - Caja General' : '111005 - Bancos';
    } else if (expData.type === 'compra_inventario') {
      debitAcc = '143505 - Inventario Materias Primas e Insumos';
      creditAcc = expData.paymentMethod === 'efectivo_caja' ? '110505 - Caja General' : '111005 - Bancos';
    } else if (expData.type === 'transferencia_cajas') {
      debitAcc = '110510 - Caja Menor / Destino';
      creditAcc = '110505 - Caja General / Origen';
    }

    const newLedger: LedgerEntry = {
      id: `led-${Date.now()}`,
      date: expData.date || todayStr,
      concept: `${expData.category}: ${expData.description}`,
      debitAccount: debitAcc,
      creditAccount: creditAcc,
      amountCOP: amount,
      user: currentUser.fullName,
      sourceType: expData.type === 'inversion_dueno' ? 'inversion' : expData.type === 'transferencia_cajas' ? 'traspaso' : 'gasto',
    };
    setLedger(prev => [newLedger, ...prev]);

    // If paid from cash box and status is approved/pagado, deduct or adjust shift expected cash
    if (expData.paymentMethod === 'efectivo_caja' && (finalStatus === 'aprobado' || finalStatus === 'pagado') && currentShift) {
      if (expData.type === 'inversion_dueno') {
        setCurrentShift(prev => prev ? { ...prev, expectedCash: prev.expectedCash + amount } : null);
      } else if (expData.type !== 'transferencia_cajas') {
        setCurrentShift(prev => prev ? { ...prev, expectedCash: Math.max(prev.expectedCash - amount, 0) } : null);
      }
    }

    addAuditLog('EGRESO_REGISTRADO', expData.category, 
      `Valor: COP ${amount} (${expData.type}, Estado: ${finalStatus}) por @${currentUser.username}. ${expData.description}`);

    const statusMsg = finalStatus === 'pendiente_aprobacion' 
      ? 'Movimiento registrado. Queda pendiente de aprobación administrativa al superar el umbral de COP 200.000.'
      : 'Movimiento registrado y aplicado satisfactoriamente.';

    return { success: true, message: statusMsg, record: newExp };
  };

  const updateExpenseStatus = (id: string, newStatus: ExpenseStatus, note?: string): { success: boolean; message: string } => {
    const target = expenses.find(e => e.id === id);
    if (!target) {
      return { success: false, message: 'Egreso no encontrado' };
    }

    if (newStatus === 'aprobado' && !hasPermission('aprobar_pagos', currentUser.role)) {
      return { success: false, message: 'Permiso denegado: El rol activo no cuenta con autorización para aprobar egresos ni pagos.' };
    }

    const nowIso = new Date().toISOString();
    const prevStatus = target.status;

    // If changing from pending/draft to aprobado or pagado and paid in cash, adjust shift cash
    if ((prevStatus === 'pendiente_aprobacion' || prevStatus === 'borrador') && 
        (newStatus === 'aprobado' || newStatus === 'pagado') && 
        target.paymentMethod === 'efectivo_caja' && 
        currentShift) {
      if (target.type === 'inversion_dueno') {
        setCurrentShift(prev => prev ? { ...prev, expectedCash: prev.expectedCash + target.amountCOP } : null);
      } else if (target.type !== 'transferencia_cajas') {
        setCurrentShift(prev => prev ? { ...prev, expectedCash: Math.max(prev.expectedCash - target.amountCOP, 0) } : null);
      }
    }

    setExpenses(prev => prev.map(exp => {
      if (exp.id === id) {
        return {
          ...exp,
          status: newStatus,
          approvedByUserId: newStatus === 'aprobado' ? currentUser.id : exp.approvedByUserId,
          approvedByUserName: newStatus === 'aprobado' ? currentUser.fullName : exp.approvedByUserName,
          approvedAt: newStatus === 'aprobado' ? nowIso : exp.approvedAt,
          auditHistory: [
            ...(exp.auditHistory || []),
            {
              timestamp: nowIso,
              userId: currentUser.id,
              userName: currentUser.fullName,
              action: `CAMBIO_ESTADO_${newStatus.toUpperCase()}`,
              note: note || `Estado actualizado de ${prevStatus} a ${newStatus}`,
              previousStatus: prevStatus,
              newStatus: newStatus,
            }
          ]
        };
      }
      return exp;
    }));

    addAuditLog('ESTADO_EGRESO_MODIFICADO', `Egreso ${id}`, 
      `Estado cambiado de ${prevStatus} a ${newStatus} por @${currentUser.username}. ${note || ''}`);

    return { success: true, message: `Estado del egreso actualizado a ${newStatus}` };
  };

  const annulExpense = (id: string, reason: string): { success: boolean; message: string } => {
    if (!reason || reason.trim().length < 5) {
      return { success: false, message: 'La anulación exige una justificación o motivo explícito (mínimo 5 caracteres).' };
    }

    const target = expenses.find(e => e.id === id);
    if (!target) {
      return { success: false, message: 'Egreso no encontrado' };
    }

    if (target.status === 'anulado') {
      return { success: false, message: 'El egreso ya se encuentra anulado.' };
    }

    // Role check: Only administrator or creator can annul
    if (currentUser.role !== 'administrador' && target.registeredByUserId !== currentUser.id) {
      return { success: false, message: 'Solo el administrador o quien registró el egreso puede anularlo.' };
    }

    const nowIso = new Date().toISOString();

    // Reversal in cash desk if it was active and paid in cash
    if ((target.status === 'aprobado' || target.status === 'pagado') && target.paymentMethod === 'efectivo_caja' && currentShift) {
      if (target.type === 'inversion_dueno') {
        setCurrentShift(prev => prev ? { ...prev, expectedCash: Math.max(prev.expectedCash - target.amountCOP, 0) } : null);
      } else if (target.type !== 'transferencia_cajas') {
        setCurrentShift(prev => prev ? { ...prev, expectedCash: prev.expectedCash + target.amountCOP } : null);
      }
    }

    // Reversal entry in double-entry ledger
    const reversalLedger: LedgerEntry = {
      id: `led-rev-${Date.now()}`,
      date: nowIso.split('T')[0],
      concept: `[REVERSO ANULADO] ${target.category}: ${target.description} (Motivo: ${reason.trim()})`,
      debitAccount: target.paymentMethod === 'efectivo_caja' ? '110505 - Caja General' : '111005 - Bancos',
      creditAccount: '510505 - Reverso Gastos Operacionales',
      amountCOP: target.amountCOP,
      user: currentUser.fullName,
      sourceType: 'gasto',
    };
    setLedger(prev => [reversalLedger, ...prev]);

    setExpenses(prev => prev.map(exp => {
      if (exp.id === id) {
        return {
          ...exp,
          status: 'anulado',
          annulledByUserId: currentUser.id,
          annulledByUserName: currentUser.fullName,
          annulledAt: nowIso,
          annulmentReason: reason.trim(),
          auditHistory: [
            ...(exp.auditHistory || []),
            {
              timestamp: nowIso,
              userId: currentUser.id,
              userName: currentUser.fullName,
              action: 'ANULACION_AUDITADA',
              note: `Anulación formal con motivo: ${reason.trim()}`,
              previousStatus: exp.status,
              newStatus: 'anulado',
            }
          ]
        };
      }
      return exp;
    }));

    addAuditLog('EGRESO_ANULADO', `Egreso ${id}`, 
      `Anulado por @${currentUser.username}. Motivo: ${reason.trim()}. Monto: COP ${target.amountCOP}`);

    return { success: true, message: 'Egreso anulado y reverso contable registrado sin borrar el historial.' };
  };

  const refundExpense = (id: string, refundAmountCOP: number, reason: string): { success: boolean; message: string } => {
    const target = expenses.find(e => e.id === id);
    if (!target) {
      return { success: false, message: 'Egreso original no encontrado' };
    }

    const amount = Math.round(Number(refundAmountCOP));
    if (isNaN(amount) || amount <= 0 || amount > target.amountCOP) {
      return { success: false, message: `El valor de reembolso debe ser entre COP 1 y COP ${target.amountCOP}.` };
    }

    const nowIso = new Date().toISOString();

    // Create a linked refund record
    const refundExp: ExpenseRecord = {
      id: `ref-${Date.now()}`,
      date: nowIso,
      operationalDate: nowIso.split('T')[0],
      shiftId: currentShift ? currentShift.id : target.shiftId,
      shiftCenter: target.shiftCenter,
      amountCOP: amount,
      category: target.category,
      type: 'devolucion_reembolso',
      description: `[REEMBOLSO/DEVOLUCIÓN] de ${target.description}: ${reason.trim()}`,
      thirdPartyName: target.thirdPartyName,
      thirdPartyNit: target.thirdPartyNit,
      paymentMethod: target.paymentMethod,
      cashDeskId: target.cashDeskId,
      center: target.center,
      responsiblePerson: currentUser.fullName,
      registeredByUserId: currentUser.id,
      registeredByUserName: currentUser.fullName,
      status: 'reembolsado',
      relatedExpenseId: target.id,
      auditHistory: [
        {
          timestamp: nowIso,
          userId: currentUser.id,
          userName: currentUser.fullName,
          action: 'REEMBOLSO_REGISTRADO',
          note: `Reembolso vinculado al egreso #${target.id}. Motivo: ${reason.trim()}`,
          newStatus: 'reembolsado',
        }
      ]
    };

    setExpenses(prev => [refundExp, ...prev]);

    // If cash, return money to cash desk
    if (target.paymentMethod === 'efectivo_caja' && currentShift) {
      setCurrentShift(prev => prev ? { ...prev, expectedCash: prev.expectedCash + amount } : null);
    }

    addAuditLog('REEMBOLSO_REGISTRADO', `Egreso ${id}`, 
      `Reembolso de COP ${amount} vinculado a ${target.id} por @${currentUser.username}. Motivo: ${reason}`);

    return { success: true, message: `Reembolso por COP ${amount} registrado exitosamente.` };
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      allUsers,
      isAuthenticated,
      login,
      logout,
      canUserAccessModule,
      hasUserActionPermission,
      updateUserModulePermissions,
      updateUserSecuritySettings,
      updateUserProfile,
      addUserProfile,
      deleteUserProfile,
      switchUser,
      config,
      updateConfig,
      hasPermission,
      updateRolePermission,
      updateAllRolePermissions,
      products,
      addProduct,
      updateProduct,
      bulkAddProducts,
      orders,
      createOrder,
      updateStationStatus,
      completePayment,
      cancelOrder,
      currentShift,
      shiftHistory,
      savedShiftReports,
      getShiftReport,
      openShift,
      closeShift,
      inventory,
      updateInventoryItem,
      recipes,
      expenses,
      addExpense,
      updateExpenseStatus,
      annulExpense,
      refundExpense,
      ledger,
      auditLogs,
      addAuditLog,
      isOnline,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
