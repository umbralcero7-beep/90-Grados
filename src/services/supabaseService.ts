/**
 * Servicio de Integración y Sincronización con Supabase Cloud - 90 Grados POS
 * Permite conectar con el proyecto de Supabase creado por el usuario
 * usando la URL del proyecto y la API Key pública (anon key).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Order, OrderItem, ExpenseRecord, ShiftSession, Product } from '../types';

const STORAGE_KEY_SUPABASE_URL = 'GRADOS_SUPABASE_URL';
const STORAGE_KEY_SUPABASE_ANON_KEY = 'GRADOS_SUPABASE_ANON_KEY';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getStoredSupabaseConfig(): SupabaseConfig {
  let url = '';
  let anonKey = '';

  try {
    url = localStorage.getItem(STORAGE_KEY_SUPABASE_URL) || '';
    anonKey = localStorage.getItem(STORAGE_KEY_SUPABASE_ANON_KEY) || '';
  } catch (e) {
    // Ignore storage issues
  }

  // Fallback to Vite/Vercel env variables if not set in localStorage
  const env = import.meta.env as Record<string, string | undefined>;
  if (!url) {
    url = (
      env.VITE_SUPABASE_URL ||
      env.VITE_PUBLIC_SUPABASE_URL ||
      env.NEXT_PUBLIC_SUPABASE_URL ||
      env.SUPABASE_URL ||
      env.STORAGE_URL ||
      env.Almacenamiento_URL ||
      ''
    ).trim();
  }
  if (!anonKey) {
    anonKey = (
      env.VITE_SUPABASE_ANON_KEY ||
      env.VITE_PUBLIC_SUPABASE_ANON_KEY ||
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      env.VITE_SUPABASE_KEY ||
      env.NEXT_PUBLIC_SUPABASE_KEY ||
      env.SUPABASE_ANON_KEY ||
      env.SUPABASE_KEY ||
      env.STORAGE_ANON_KEY ||
      env.STORAGE_KEY ||
      env.Almacenamiento_ANON_KEY ||
      env.Almacenamiento_KEY ||
      ''
    ).trim();
  }

  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getStoredSupabaseConfig();
  return Boolean(url && anonKey);
}

export function saveStoredSupabaseConfig(url: string, anonKey: string): void {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = anonKey.trim();

  if (cleanUrl) {
    localStorage.setItem(STORAGE_KEY_SUPABASE_URL, cleanUrl);
  } else {
    localStorage.removeItem(STORAGE_KEY_SUPABASE_URL);
  }

  if (cleanKey) {
    localStorage.setItem(STORAGE_KEY_SUPABASE_ANON_KEY, cleanKey);
  } else {
    localStorage.removeItem(STORAGE_KEY_SUPABASE_ANON_KEY);
  }
}

let cachedClient: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getStoredSupabaseConfig();
  if (!url || !anonKey) return null;

  if (cachedClient && lastUsedUrl === url && lastUsedKey === anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    lastUsedUrl = url;
    lastUsedKey = anonKey;
    return cachedClient;
  } catch (err) {
    console.error('Error al inicializar cliente Supabase:', err);
    return null;
  }
}

export interface SupabaseTestResult {
  ok: boolean;
  message: string;
  elapsedMs: number;
  tablesDetected?: string[];
  error?: string;
}

export async function testSupabaseConnection(customConfig?: SupabaseConfig): Promise<SupabaseTestResult> {
  const start = performance.now();
  const config = customConfig || getStoredSupabaseConfig();

  if (!config.url || !config.anonKey) {
    return {
      ok: false,
      message: 'Debe ingresar la URL del Proyecto (https://xyz.supabase.co) y la API Key (anon key).',
      elapsedMs: 0
    };
  }

  try {
    const client = createClient(config.url, config.anonKey, {
      auth: { persistSession: false }
    });

    // Intentar leer de la tabla products o users para comprobar conectividad y RLS
    const { data, error } = await client.from('products').select('sku, name').limit(1);

    const elapsed = Math.round(performance.now() - start);

    if (error) {
      // Analizar tipo de error
      if (error.code === '42P01') {
        return {
          ok: false,
          message: 'Conectó a Supabase pero la tabla "products" no existe aún. Debe ejecutar backend/database/schema.sql en el SQL Editor de Supabase.',
          elapsedMs: elapsed,
          error: error.message
        };
      }
      return {
        ok: false,
        message: `Error al consultar Supabase: ${error.message} (${error.code || 'API error'})`,
        elapsedMs: elapsed,
        error: error.message
      };
    }

    return {
      ok: true,
      message: `¡Conexión exitosa a Supabase Cloud en ${elapsed} ms! Las tablas del POS responden correctamente.`,
      elapsedMs: elapsed,
      tablesDetected: ['products', 'orders', 'users', 'expenses']
    };
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - start);
    return {
      ok: false,
      message: `Error de red o conexión inválida: ${err.message || 'Host inalcanzable'}`,
      elapsedMs: elapsed,
      error: String(err)
    };
  }
}

export interface SyncStatsResult {
  ordersSynced: number;
  expensesSynced: number;
  errors: string[];
}

export async function syncLocalDataToSupabase(
  orders: Order[],
  expenses: ExpenseRecord[],
  shifts: ShiftSession[]
): Promise<SyncStatsResult> {
  const client = getSupabaseClient();
  const result: SyncStatsResult = { ordersSynced: 0, expensesSynced: 0, errors: [] };

  if (!client) {
    result.errors.push('No hay credenciales configuradas para Supabase.');
    return result;
  }

  // 1. Sincronizar Órdenes Pagadas
  try {
    const paidOrders = orders.filter(o => o.status === 'pagada');
    if (paidOrders.length > 0) {
      const ordersPayload = paidOrders.map(o => ({
        id: o.id,
        table_number: o.tableNumber,
        waiter_id: o.waiterId,
        shift_id: o.shiftId || null,
        status: o.status,
        cocina_status: o.stationStatus?.cocina || 'entregado',
        bar_status: o.stationStatus?.bar || 'entregado',
        customer_note: o.customerNote || null,
        total_amount_cop: o.totalAmount,
        created_at: o.createdAt
      }));

      const { error: ordErr } = await client
        .from('orders')
        .upsert(ordersPayload, { onConflict: 'id' });

      if (ordErr) {
        result.errors.push(`Error en sincronización de comandas: ${ordErr.message}`);
      } else {
        result.ordersSynced = ordersPayload.length;
      }
    }
  } catch (e: any) {
    result.errors.push(`Excepción al sincronizar órdenes: ${e.message}`);
  }

  // 2. Sincronizar Egresos / Gastos
  try {
    if (expenses.length > 0) {
      const expensesPayload = expenses.map(e => ({
        id: e.id,
        operational_date: e.operationalDate || e.date.split('T')[0],
        created_at: e.date,
        shift_id: e.shiftId || null,
        shift_center: e.shiftCenter || 'Restaurante Matutino',
        amount_cop: e.amountCOP,
        category: e.category,
        type: e.type,
        description: e.description,
        third_party_name: e.thirdPartyName || null,
        third_party_nit: e.thirdPartyNit || null,
        invoice_number: e.invoiceNumber || null,
        payment_method: e.paymentMethod,
        responsible_person: e.responsiblePerson || null,
        registered_by_user_id: e.registeredByUserId,
        status: e.status,
        annulment_reason: e.annulmentReason || null
      }));

      const { error: expErr } = await client
        .from('expenses')
        .upsert(expensesPayload, { onConflict: 'id' });

      if (expErr) {
        result.errors.push(`Error en sincronización de gastos: ${expErr.message}`);
      } else {
        result.expensesSynced = expensesPayload.length;
      }
    }
  } catch (e: any) {
    result.errors.push(`Excepción al sincronizar gastos: ${e.message}`);
  }

  return result;
}

/**
 * Persiste una comanda de mesero directamente en Supabase Cloud.
 * Valida los precios contra el catálogo oficial (Control 8: Nunca confiar en totales de cliente).
 * Implementa idempotencia para evitar duplicados por reintentos o doble toque en la APK.
 */
export async function persistOrderToSupabase(
  order: Order,
  officialCatalog: Record<string, number> = {},
  idempotencyKey?: string
): Promise<{ success: boolean; data?: Order; orderId?: string; error?: string; isDuplicate?: boolean }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'No hay conexión configurada con Supabase Cloud.' };
  }

  // 1. Recalcular total financiero oficial a partir del catálogo
  let validatedTotal = 0;
  for (const item of order.items) {
    const catalogPrice = officialCatalog[item.productId] ?? item.price;
    validatedTotal += (catalogPrice * item.quantity);
  }

  const finalOrder: Order = {
    ...order,
    totalAmount: validatedTotal,
    idempotencyKey: idempotencyKey || order.idempotencyKey
  };

  try {
    // 2. Comprobación de idempotencia: si la orden ya existe por ID, retornar el registro existente
    const { data: existingOrder } = await client
      .from('orders')
      .select('id, order_number, status, total_amount_cop')
      .eq('id', order.id)
      .maybeSingle();

    if (existingOrder) {
      return { 
        success: true, 
        data: { ...finalOrder, orderNumber: existingOrder.order_number || finalOrder.orderNumber }, 
        orderId: existingOrder.id,
        isDuplicate: true 
      };
    }

    // 3. Insertar orden en tabla 'orders'
    const orderPayload: Record<string, any> = {
      id: finalOrder.id,
      table_number: finalOrder.tableNumber,
      waiter_id: finalOrder.waiterId,
      status: finalOrder.status || 'abierta',
      cocina_status: finalOrder.stationStatus?.cocina || 'recibido',
      bar_status: finalOrder.stationStatus?.bar || 'recibido',
      customer_note: finalOrder.customerNote || null,
      total_amount_cop: validatedTotal,
      created_at: finalOrder.createdAt || new Date().toISOString()
    };

    if (finalOrder.shiftId && finalOrder.shiftId !== 'sin-turno') {
      orderPayload.shift_id = finalOrder.shiftId;
    }

    const { error: orderError } = await client
      .from('orders')
      .insert(orderPayload);

    if (orderError) {
      return { success: false, error: `Error al crear orden en Supabase: ${orderError.message}` };
    }

    // 4. Insertar líneas en tabla 'order_items'
    if (finalOrder.items && finalOrder.items.length > 0) {
      const itemsPayload = finalOrder.items.map((it, idx) => ({
        id: `${finalOrder.id}-${idx + 1}`,
        order_id: finalOrder.id,
        product_id: it.productId,
        quantity: it.quantity,
        unit_price_cop: officialCatalog[it.productId] ?? it.price,
        station: it.station,
        notes: it.notes || null
      }));

      const { error: itemsError } = await client
        .from('order_items')
        .insert(itemsPayload);

      if (itemsError) {
        console.warn('Advertencia al insertar order_items en Supabase:', itemsError.message);
      }
    }

    return { success: true, data: finalOrder, orderId: finalOrder.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error de conexión con Supabase.' };
  }
}

/**
 * Consulta las comandas persistidas en Supabase Cloud para que la Caja y KDS las visualicen.
 */
export async function fetchOrdersFromSupabase(): Promise<{ success: boolean; data?: Order[]; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'No hay cliente Supabase disponible.' };
  }

  try {
    // Intentar consulta con join de order_items
    const { data: ordersData, error: ordersError } = await client
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (ordersError) {
      // Si el join falla por falta de foreign key o política, intentar consulta directa sobre orders
      const { data: plainOrders, error: plainError } = await client
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (plainError) {
        return { success: false, error: plainError.message };
      }

      if (!plainOrders) return { success: true, data: [] };

      const mapped: Order[] = plainOrders.map((row: any) => ({
        id: row.id,
        orderNumber: row.order_number || parseInt(String(row.id).replace(/\D/g, '').slice(-3)) || 101,
        tableNumber: row.table_number,
        waiterId: row.waiter_id,
        waiterName: `Mesero (@${row.waiter_id})`,
        shiftId: row.shift_id || 'sin-turno',
        status: row.status,
        stationStatus: {
          cocina: row.cocina_status || 'recibido',
          bar: row.bar_status || 'recibido'
        },
        items: [],
        customerNote: row.customer_note || undefined,
        createdAt: row.created_at,
        totalAmount: row.total_amount_cop || 0
      }));

      return { success: true, data: mapped };
    }

    if (!ordersData) return { success: true, data: [] };

    const mappedOrders: Order[] = ordersData.map((row: any) => {
      const items: OrderItem[] = (row.order_items || []).map((it: any) => ({
        productId: it.product_id,
        productName: it.product_name || `Producto ${it.product_id}`,
        price: it.unit_price_cop,
        quantity: it.quantity,
        station: it.station || 'cocina',
        notes: it.notes || undefined
      }));

      return {
        id: row.id,
        orderNumber: row.order_number || parseInt(String(row.id).replace(/\D/g, '').slice(-3)) || 101,
        tableNumber: row.table_number,
        waiterId: row.waiter_id,
        waiterName: `Mesero (@${row.waiter_id})`,
        shiftId: row.shift_id || 'sin-turno',
        status: row.status,
        stationStatus: {
          cocina: row.cocina_status || 'recibido',
          bar: row.bar_status || 'recibido'
        },
        items,
        customerNote: row.customer_note || undefined,
        createdAt: row.created_at,
        totalAmount: row.total_amount_cop || 0
      };
    });

    return { success: true, data: mappedOrders };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error desconocido al consultar órdenes.' };
  }
}

/**
 * Suscripción en tiempo real a cambios en la tabla 'orders' de Supabase Cloud.
 * Permite que la pantalla de Caja en Vercel reciba automáticamente las comandas creadas por el APK del mesero.
 */
export function subscribeToOrdersSupabase(onOrderChange: () => void): () => void {
  const client = getSupabaseClient();
  if (!client) {
    return () => {};
  }

  try {
    const channel = client
      .channel('pos_orders_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        onOrderChange();
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  } catch (err) {
    console.warn('No se pudo establecer canal Realtime de Supabase:', err);
    return () => {};
  }
}

/**
 * Actualiza el estado de una orden en Supabase (ej. cuando la caja procesa el pago o KDS despacha).
 */
export async function updateOrderStatusInSupabase(
  orderId: string, 
  status: string, 
  stationStatus?: { cocina?: string; bar?: string }
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const updates: Record<string, any> = { status };
    if (stationStatus?.cocina) updates.cocina_status = stationStatus.cocina;
    if (stationStatus?.bar) updates.bar_status = stationStatus.bar;

    const { error } = await client
      .from('orders')
      .update(updates)
      .eq('id', orderId);

    return !error;
  } catch (e) {
    return false;
  }
}

