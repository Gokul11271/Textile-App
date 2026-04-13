const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initDatabase } = require('./database.cjs');
const { setupIpcHandlers } = require('./ipcHandlers.cjs');
const { autoBackup } = require('./services/backupService.cjs');
const { info } = require('./services/logService.cjs');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Initialize Database and Setup IPC Handlers
async function initializeApp() {
  autoBackup();       // Phase 5: best-effort daily backup before any migrations
  await initDatabase();
  setupIpcHandlers();
  info('main', 'Application Started', { version: app.getVersion(), isDev });
}

initializeApp().catch(err => {
  console.error('Failed to initialize application:', err);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    title: 'Dhanalakshmi Textiles Billing System',
  });

  // Set CSP header if not in development to address Electron security warnings
  if (!isDev) {
    const { session } = require('electron');
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';"]
        }
      });
    });
  }

  if (isDev) {
    win.loadURL('http://localhost:5183');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
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

// IPC Handlers for database will go here
ipcMain.handle('ping', () => 'pong');
