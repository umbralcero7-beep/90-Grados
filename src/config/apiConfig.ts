/**
 * Configuración Unificada de Conexión a la API - Sistema POS 90 Grados
 * Compartida de forma idéntica entre:
 * 1. Navegador Web (Salón / Caja)
 * 2. Aplicación Windows con Electron (All-in-One)
 * 3. Aplicación Android con Capacitor / Tablets de meseros
 * 
 * Regla de seguridad: Cero IPs inventadas o hardcodeadas.
 * Jerarquía de resolución:
 * 1. Preferencia local persistida en localStorage ('GRADOS_API_URL')
 * 2. Inyección dinámica en runtime (window.APP_CONFIG?.apiUrl)
 * 3. Variable de entorno Vite (VITE_API_BASE_URL)
 * 4. Fallback estándar local seguro (http://localhost:8000)
 */

declare global {
  interface Window {
    APP_CONFIG?: {
      apiUrl?: string;
      stationName?: string;
    };
  }
}

const STORAGE_KEY_API_URL = 'GRADOS_API_URL';
const DEFAULT_FALLBACK_URL = 'http://localhost:8000';

export function getApiBaseUrl(): string {
  // 1. Configuración guardada en dispositivo por el usuario/técnico
  try {
    const custom = localStorage.getItem(STORAGE_KEY_API_URL);
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, '');
    }
  } catch (e) {
    // LocalStorage no disponible (SSR o sandbox estricto)
  }

  // 2. Inyección de runtime en Electron o contenedor
  if (typeof window !== 'undefined' && window.APP_CONFIG?.apiUrl) {
    return window.APP_CONFIG.apiUrl.trim().replace(/\/+$/, '');
  }

  // 3. Variable de entorno de compilación Vite
  if (import.meta.env.VITE_API_BASE_URL) {
    return (import.meta.env.VITE_API_BASE_URL as string).trim().replace(/\/+$/, '');
  }

  // 4. Fallback estándar de servidor local en All-in-One
  return DEFAULT_FALLBACK_URL;
}

export function setApiBaseUrl(newUrl: string): void {
  const cleanUrl = newUrl.trim().replace(/\/+$/, '');
  if (!cleanUrl) {
    localStorage.removeItem(STORAGE_KEY_API_URL);
    return;
  }
  
  // Validar formato de URL básica
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    throw new Error("La URL de la API debe comenzar con 'http://' o 'https://'");
  }

  localStorage.setItem(STORAGE_KEY_API_URL, cleanUrl);
}

export function resetApiBaseUrl(): void {
  localStorage.removeItem(STORAGE_KEY_API_URL);
}

export interface ConnectivityTestResult {
  ok: boolean;
  status: 'online' | 'unreachable' | 'error';
  message: string;
  urlTested: string;
  elapsedMs: number;
  serverInfo?: {
    service: string;
    version: string;
    timezone: string;
  };
}

export async function testApiConnectivity(targetUrl?: string): Promise<ConnectivityTestResult> {
  const url = (targetUrl || getApiBaseUrl()).replace(/\/+$/, '');
  const endpoint = `${url}/api/health`;
  const start = performance.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 segundos timeout

    const resp = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const elapsed = Math.round(performance.now() - start);

    if (resp.ok) {
      const data = await resp.json();
      return {
        ok: true,
        status: 'online',
        message: `Conexión exitosa con la API de 90 Grados en ${elapsed} ms.`,
        urlTested: url,
        elapsedMs: elapsed,
        serverInfo: {
          service: data.service || '90 Grados POS API',
          version: data.version || '1.0.0',
          timezone: data.timezone || 'America/Bogota'
        }
      };
    } else {
      return {
        ok: false,
        status: 'error',
        message: `El servidor respondió con código HTTP ${resp.status} (${resp.statusText}).`,
        urlTested: url,
        elapsedMs: elapsed
      };
    }
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - start);
    let msg = 'No se pudo establecer conexión con el servidor.';
    if (err.name === 'AbortError') {
      msg = 'Tiempo de espera agotado (4000 ms). Verifique si el servidor FastAPI está iniciado en ese puerto.';
    } else if (err.message) {
      msg = `Error de red o conexión rechazada: ${err.message}`;
    }
    return {
      ok: false,
      status: 'unreachable',
      message: msg,
      urlTested: url,
      elapsedMs: elapsed
    };
  }
}
