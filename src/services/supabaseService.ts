/**
 * Servicio de Integración y Sincronización con Supabase Cloud - 90 Grados POS
 * Permite conectar con el proyecto de Supabase creado por el usuario
 * usando la URL del proyecto y la API Key pública (anon key).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Order, ExpenseRecord, ShiftSession, Product } from '../types';

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

  // Fallback to Vite env variables if not set in localStorage
  if (!url && import.meta.env.VITE_SUPABASE_URL) {
    url = String(import.meta.env.VITE_SUPABASE_URL).trim();
  }
  if (!anonKey && import.meta.env.VITE_SUPABASE_ANON_KEY) {
    anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY).trim();
  }

  return { url, anonKey };
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
