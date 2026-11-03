// ==============================================================================
// 90 Grados POS - Preload Script Seguro para Electron
// Expone configuración de entorno sin comprometer nodeIntegration
// ==============================================================================

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('ELECTRON_ENV', {
  isElectron: true,
  platform: process.platform,
  version: process.versions.electron
});
