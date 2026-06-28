const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initDatabase } = require('./database.cjs');
const { setupIpcHandlers } = require('./ipcHandlers.cjs');
const { autoBackup } = require('./services/backupService.cjs');
const { info } = require('./services/logService.cjs');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Initialize Database and Setup IPC Handlers
async function initializeApp() {
  try {
    await autoBackup();       // Phase 5: best-effort daily backup before any migrations
    await initDatabase();
    setupIpcHandlers();
    info('main', 'Application Started', { version: app.getVersion(), isDev });
  } catch (err) {
    const { dialog } = require('electron');
    console.error('Failed to initialize application:', err);
    dialog.showErrorBox(
      'Initialization Error',
      `The application failed to start correctly:\n\n${err.message}\n\nPlease contact support if this persists.`
    );
    app.quit();
  }
}

// initializeApp(); // Moved inside app.whenReady for better control

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Don't show the window until it's ready
    backgroundColor: '#ffffff', // Set a background color to prevent white flash
    icon: path.join(__dirname, '../build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    title: 'Dhanalakshmi Textiles Billing System',
  });

  // Show the window when it's ready to be displayed
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
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

app.whenReady().then(async () => {
  // Initialize database and IPC handlers BEFORE creating the window
  await initializeApp();
  
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
