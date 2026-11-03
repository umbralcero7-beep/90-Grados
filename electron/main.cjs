// ==============================================================================
// 90 Grados POS - Wrapper de Escritorio Windows 11 (Electron)
// Restaurante-Bar 90 Grados · Cundinamarca, Colombia
// Diseñado para ejecución en All-in-One de Caja / Supervisor
// ==============================================================================

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 700,
    title: '90 Grados POS - Terminal All-in-One',
    backgroundColor: '#000100',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  // Maximizar por defecto en el equipo All-in-One de caja
  mainWindow.maximize();

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev && process.env.DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
