export type UserRole = 
  | 'administrador'
  | 'cajero'
  | 'mesero'
  | 'cocina_bar'
  | 'inventario_contabilidad';

export type SystemModule = 
  | 'pos' 
  | 'waiter' 
  | 'kds' 
  | 'shifts' 
  | 'inventory' 
  | 'ledger' 
  | 'settings' 
  | 'preflight' 
  | 'owner_dashboard';

export type PermissionAction = 
  | 'consultar' 
  | 'crear' 
  | 'editar' 
  | 'anular' 
  | 'cerrar' 
  | 'administrar';

export type ModuleActionPermissions = Record<PermissionAction, boolean>;
export type UserModulePermissions = Partial<Record<SystemModule, Partial<Record<PermissionAction, boolean>>>>;

export interface UserProfile {
  id: string;
  username: string; // e.g. "carmen_gerente" (handle formatted as @carmen_gerente)
  fullName: string;
  avatarUrl: string; // Base64 data URL or preset asset
  bio: string; // Short bio description
  role: UserRole;
  pinHash: string; // PBKDF2-HMAC-SHA256 derived hash
  pinSalt: string; // 16-byte cryptographic salt in hex
  pin?: never; // Plaintext PINs prohibited from client model
  phone: string;
  email: string;
  assignedShift: 'matutino' | 'nocturno' | 'ambos';
  assignedSede?: string; // Sede asignada (ej: 'sede_cota_principal')
  emergencyContact?: string;
  createdAt: string;
  lastLogin: string;
  
  // Security & Whitelist Controls
  isWhitelisted: boolean;
  isActive: boolean;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  failedAttempts?: number;
  lockedUntil?: string | null;
  modulePermissions?: UserModulePermissions;

  stats: {
    ordersCreated: number;
    totalSoldCOP: number;
    shiftsClosed: number;
  };
}

export type ProductCategory = 
  | 'Comidas Rápidas'
  | 'Picadas'
  | 'Carnes'
  | 'Platos en Salsa'
  | 'Pescados'
  | 'Aves'
  | 'Desayunos'
  | 'Jugos Naturales'
  | 'Cervezas'
  | 'Licores'
  | 'Bebidas Frías';

export type Station = 'cocina' | 'bar';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  price: number; // Integer in COP
  station: Station;
  available: boolean;
  unit: string; // e.g. "unidad", "porción", "botella", "media"
  description?: string;
  taxRate?: number; // e.g. 0 or 8% impoconsumo
  allowedShifts: 'todos' | 'matutino' | 'nocturno';
  recipeId?: string;
  estimatedCost?: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  station: Station;
  notes?: string;
  modifiers?: string[];
}

export type OrderStationStatus = 'recibido' | 'en_preparacion' | 'listo' | 'entregado';

export interface Order {
  id: string;
  orderNumber: number;
  tableNumber: string; // "Mesa 1", "Barra 3", "Terraza 2", "Para Llevar"
  waiterId: string;
  waiterName: string;
  waiterAvatar?: string;
  shiftId: string;
  status: 'abierta' | 'en_pago' | 'pagada' | 'cancelada';
  stationStatus: {
    cocina: OrderStationStatus;
    bar: OrderStationStatus;
  };
  items: OrderItem[];
  customerNote?: string;
  createdAt: string; // ISO string
  totalAmount: number; // Integer in COP
  sedeId?: string; // Sede / branch identifier
  idempotencyKey?: string; // Prevents duplicated orders on network retries
  payment?: PaymentRecord;
}

export interface PaymentRecord {
  id: string;
  totalDue: number;
  receivedCash: number;
  cashDenominations: {
    10000: number;
    20000: number;
    50000: number;
    100000: number;
  };
  changeGiven: number; // max(receivedCash - totalDue, 0)
  remainingBalance: number; // max(totalDue - receivedCash, 0)
  methods: Array<{
    method: 'efectivo' | 'transferencia' | 'datafono' | 'nequi' | 'daviplata' | 'tarjeta' | 'otro';
    amount: number;
    reference?: string;
    verified?: boolean;
  }>;
  cashierId: string;
  cashierName: string;
  paidAt: string;
}

export type OperationalShiftType = 'diurno_restaurante' | 'nocturno_discoteca';

export interface ShiftSession {
  id: string;
  center: 'Restaurante Matutino' | 'Bar Nocturno';
  operationalType: OperationalShiftType;
  openedByUserId: string;
  openedByUserName: string;
  openedByUserAvatar?: string;
  openedAt: string;
  initialFund: number; // Fondo inicial de caja (saldo de caja, NO venta)
  status: 'abierto' | 'cerrado';
  closedByUserId?: string;
  closedByUserName?: string;
  closedAt?: string;
  
  // Cash calculations based on caja ledger
  expectedCash: number;
  countedCash: number;
  cashDifference: number; // countedCash - expectedCash (sobrante o faltante)
  
  // Sales breakdown
  totalSalesCash: number;
  totalSalesElectronic: number;
  totalSalesTotal: number;
  discountsTotal: number;
  annulledTotal: number;
  
  // Beverages reconciliation at shift close
  beverageReconciliation: BeverageShiftCount[];
  
  // Handover handover to next shift
  transferHandover?: {
    toUserId: string;
    toUserName: string;
    verifiedFund: number;
    notes: string;
    signedAt: string;
  };
  notes?: string;
  version: number;
}

export interface BeverageShiftCount {
  productId: string;
  productName: string;
  location: 'Bodega' | 'Restaurante' | 'Bar';
  initialCount: number;
  entries: number;
  transfersIn: number;
  transfersOut: number;
  theoreticalSold: number;
  authorizedWaste: number;
  expectedCount: number; // initial + entries + transfersIn - transfersOut - theoreticalSold - waste
  physicalCount: number;
  difference: number; // physicalCount - expectedCount
  comment?: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: 'Cárnicos' | 'Verduras & Frutas' | 'Abarrotes' | 'Licores & Cervezas' | 'Desechables';
  purchaseUnit: string; // e.g. "Caja x 30", "Kilogramo", "Garrafa"
  recipeUnit: string; // e.g. "Unidad", "Gramo", "Mililitro"
  conversionRatio: number; // 1 purchaseUnit = X recipeUnit (e.g. 1 Kilo = 1000 Gramos)
  currentStock: number; // in recipeUnits
  minStock: number;
  unitCostCOP: number; // cost per recipeUnit
  location: 'Bodega' | 'Restaurante' | 'Bar';
}

export interface RecipeIngredient {
  inventoryItemId: string;
  ingredientName: string;
  quantityInRecipeUnit: number;
  unitCost: number;
  subtotalCost: number;
}

export interface Recipe {
  id: string;
  productId: string;
  productName: string;
  servings: number;
  wastePercentage: number;
  ingredients: RecipeIngredient[];
  theoreticalCostCOP: number;
  salePriceCOP: number;
  theoreticalMarginPercentage: number;
  lastUpdated: string;
}

export type ExpenseCategory = 
  | 'Servicios Públicos' 
  | 'Arriendo & Local' 
  | 'Nómina & Turnos' 
  | 'Transporte & Acarreos' 
  | 'Mantenimiento' 
  | 'Suministros & Aseo' 
  | 'Comisiones & Pasarelas' 
  | 'Impuestos & Tasas' 
  | 'Costo de Insumos' 
  | 'Aporte de Capital' 
  | 'Retiro de Capital' 
  | 'Transferencia entre Cajas' 
  | 'Otro Egreso';

export type ExpenseType = 
  | 'gasto_operativo' 
  | 'compra_inventario' 
  | 'inversion_dueno' 
  | 'retiro_dueno' 
  | 'transferencia_cajas' 
  | 'devolucion_reembolso';

export type ExpensePaymentMethod = 
  | 'efectivo_caja' 
  | 'cuenta_bancaria' 
  | 'nequi' 
  | 'tarjeta' 
  | 'otro';

export type ExpenseStatus = 
  | 'borrador' 
  | 'pendiente_aprobacion' 
  | 'aprobado' 
  | 'pagado' 
  | 'anulado' 
  | 'reembolsado';

export interface ExpenseAttachment {
  fileName: string;
  fileType: string;
  fileSizeKB: number;
  dataUrl?: string;
}

export interface ExpenseAuditTrail {
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  note?: string;
  previousStatus?: ExpenseStatus;
  newStatus?: ExpenseStatus;
}

export interface ExpenseRecord {
  id: string;
  date: string; // ISO datetime
  operationalDate: string; // YYYY-MM-DD
  shiftId?: string;
  shiftCenter?: 'Restaurante Matutino' | 'Bar Nocturno' | 'Administración';
  amountCOP: number;
  category: ExpenseCategory | string;
  type: ExpenseType;
  description: string;
  thirdPartyName?: string; // Proveedor o beneficiario
  thirdPartyNit?: string; // NIT o Cédula
  invoiceNumber?: string; // Factura o soporte
  paymentMethod: ExpensePaymentMethod;
  cashDeskId?: string; // Caja o punto
  center?: 'Restaurante Matutino' | 'Bar Nocturno' | 'Administración';
  responsiblePerson?: string;
  supportAttachment?: ExpenseAttachment;
  registeredByUserId: string;
  registeredByUserName: string;
  status: ExpenseStatus;
  approvedByUserId?: string;
  approvedByUserName?: string;
  approvedAt?: string;
  annulledByUserId?: string;
  annulledByUserName?: string;
  annulledAt?: string;
  annulmentReason?: string;
  relatedExpenseId?: string;
  inventoryItemId?: string;
  inventoryUnitsPurchased?: number;
  auditHistory?: ExpenseAuditTrail[];
}

export interface LedgerEntry {
  id: string;
  date: string;
  concept: string;
  debitAccount: string;
  creditAccount: string;
  amountCOP: number;
  user: string;
  sourceType: 'venta' | 'gasto' | 'inversion' | 'merma' | 'traspaso';
}

export type ModuleOperation = 
  | 'registrar_gastos'
  | 'aprobar_pagos'
  | 'ver_reportes'
  | 'gestionar_inventario';

export interface RolePermissionsMap {
  registrar_gastos: boolean;
  aprobar_pagos: boolean;
  ver_reportes: boolean;
  gestionar_inventario: boolean;
}

export type RolePermissionsConfig = Record<UserRole, RolePermissionsMap>;

export interface RestaurantConfig {
  businessName: string; // Razón Social (configurable)
  nit: string; // NIT (configurable)
  municipality: string; // Municipio en Cundinamarca (configurable)
  address: string;
  phone: string;
  currency: string; // 'COP'
  locale: string; // 'es-CO'
  timezone: string; // 'America/Bogota'
  approvalThresholdCOP?: number; // Monto a partir del cual se exige aprobación (default 200.000 COP)
  allowWaitersToRegisterExpenses?: boolean; // Por defecto FALSE
  customExpenseCategories?: string[];
  customPaymentMethods?: string[];
  rolePermissions?: RolePermissionsConfig; // Matriz administrativa de permisos por rol
}

export interface ShiftReportBundle {
  id: string; // unique idempotent id e.g. "rep-bundle-shift-12345"
  shiftId: string;
  shiftCenter: 'Restaurante Matutino' | 'Bar Nocturno';
  operationalType: OperationalShiftType;
  openedAt: string;
  closedAt: string;
  openedByUserId: string;
  openedByUserName: string;
  closedByUserId: string;
  closedByUserName: string;
  version: number;
  generationHash: string; // idempotency key
  generatedAt: string;

  salesDetailed: {
    items: Array<{
      productId: string;
      productName: string;
      category: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      discounts: number;
    }>;
    byCategory: Record<string, { quantity: number; total: number }>;
    byPaymentMethod: Record<string, number>;
    totalGross: number;
    totalDiscounts: number;
    totalNet: number;
    totalOrdersCount: number;
  };

  cashSummary: {
    initialFund: number;
    expectedCash: number;
    countedCash: number;
    cashDifference: number; // positive = sobrante, negative = faltante
    electronicTotal: number;
    cashTotal: number;
    handoverNotes?: string;
  };

  corteX: {
    generatedAt: string;
    totalOrders: number;
    activeTablesCount: number;
    salesByStation: { cocina: number; bar: number };
    summaryText: string;
  };

  corteZ: {
    fiscalZNumber: number;
    finalClosureAt: string;
    officialStatus: string;
    disclaimer: string;
    totalCollected: number;
    auditNote: string;
  };
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  action: string;
  entity: string;
  details: string;
  shiftId?: string;
  operationalType?: OperationalShiftType | string;
  targetRecord?: string;
  valueCOP?: number;
  reason?: string;
}
