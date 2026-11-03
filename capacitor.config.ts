// ==============================================================================
// Capacitor Configuration - 90 Grados POS Android App
// ==============================================================================

export interface CapacitorServerConfig {
  cleartext?: boolean;
  androidScheme?: string;
  url?: string;
}

export interface CapacitorAndroidConfig {
  allowMixedContent?: boolean;
  captureInput?: boolean;
  webContentsDebuggingEnabled?: boolean;
}

export interface AppCapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: CapacitorServerConfig;
  android?: CapacitorAndroidConfig;
}

const config: AppCapacitorConfig = {
  appId: 'com.noventagrados.pos',
  appName: '90 Grados POS',
  webDir: 'dist',
  server: {
    // Permite tráfico HTTP en la red LAN privada del restaurante
    cleartext: true,
    androidScheme: 'http'
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false
  }
};

export default config;
