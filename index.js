const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const remoteMain = require('@electron/remote/main');
const packageJson = require('./package.json');

// Initialize @electron/remote
remoteMain.initialize();

// Initialize store variable
let store;
// Async function to initialize the store
async function initStore() {
  if (!store) {
    const Store = await import('electron-store');
    store = new Store.default();
    return store;
  }
  return store;
}

// Initialize store immediately
initStore();

let mainWindow;

async function createWindow() {
  // Ensure store is initialized
  await initStore();
  
  // Get stored window bounds or use defaults
  const windowBounds = store.get('windowBounds', {
    width: 350,
    height: 550,
    x: undefined,
    y: undefined
  });
  
  // Get display dimensions
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  
  // Make sure the window is always visible on screen
  // In case display resolution changed or multi-monitor setup changed
  let x = windowBounds.x;
  let y = windowBounds.y;
  
  // If position is undefined or would place the window offscreen, center it
  if (x === undefined || y === undefined || x < 0 || y < 0 || 
      x > screenWidth - 100 || y > screenHeight - 100) {
    x = Math.floor((screenWidth - windowBounds.width) / 2);
    y = Math.floor((screenHeight - windowBounds.height) / 2);
  }

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    x: x,
    y: y,
    minWidth: 350,
    minHeight: 550,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/hcalculator-logo.ico'),
    // Make the window look modern with these options
    frame: false,
    titleBarStyle: 'hidden',
    transparent: false,
    backgroundColor: '#f5f5f5'
  });

  // Enable @electron/remote for this window
  remoteMain.enable(mainWindow.webContents);

  // Load the index.html of the app
  mainWindow.loadFile('index.html');

  // Open the DevTools in development
  // mainWindow.webContents.openDevTools();

  // Save window position and size when it changes (debounced)
  let saveBoundsTimeout;
  const saveBounds = () => {
    if (saveBoundsTimeout) clearTimeout(saveBoundsTimeout);
    saveBoundsTimeout = setTimeout(async () => {
      if (!mainWindow.isDestroyed()) {
        await initStore();
        const bounds = mainWindow.getBounds();
        store.set('windowBounds', bounds);
      }
    }, 500);
  };

  // Save bounds when window is moved or resized
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);

  // Save window position and size before closing
  mainWindow.on('close', async () => {
    if (!mainWindow.isDestroyed()) {
      await initStore();
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', bounds);
    }
  });

  // Emitted when the window is closed
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
  
  // When window is ready, send event to the renderer to blur the cogwheel
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('window-ready');
  });
  
  // Restore always-on-top state if it was set
  const preferences = store.get('preferences', {});
  if (preferences.keepOnTop) {
    mainWindow.setAlwaysOnTop(true);
  }
}

// Check for version flag
const argv = process.argv.slice(2);
if (argv.includes('--version') || argv.includes('-v')) {
  console.log(`HCalculator v${packageJson.version}`);
  app.exit(0);
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', async function () {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Log any unhandled exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// IPC handlers for history operations
ipcMain.handle('save-calculation', async (event, calculation) => {
  await initStore();
  const history = store.get('calculationHistory', []);
  history.unshift(calculation); // Add new calculation at the beginning
  
  // Keep only the last 100 calculations to prevent excessive storage
  const limitedHistory = history.slice(0, 100);
  store.set('calculationHistory', limitedHistory);
  
  return limitedHistory;
});

ipcMain.handle('get-calculation-history', async () => {
  await initStore();
  return store.get('calculationHistory', []);
});

ipcMain.handle('clear-history', async () => {
  await initStore();
  store.set('calculationHistory', []);
  return [];
});

ipcMain.handle('delete-history-item', async (event, index) => {
  await initStore();
  const history = store.get('calculationHistory', []);
  
  // Check if the index is valid
  if (index >= 0 && index < history.length) {
    // Remove the item at the specified index
    history.splice(index, 1);
    store.set('calculationHistory', history);
  }
  
  return history;
});

// IPC handlers for preferences
ipcMain.handle('save-preferences', async (event, preferences) => {
  await initStore();
  store.set('preferences', preferences);
  
  // If keepOnTop preference changes, update the window
  if (mainWindow && preferences.keepOnTop !== undefined) {
    mainWindow.setAlwaysOnTop(preferences.keepOnTop);
  }
  
  return preferences;
});

ipcMain.handle('get-preferences', async () => {
  await initStore();
  return store.get('preferences', {
    darkTheme: false,
    useSeparator: true,
    historyPinned: false,
    keepOnTop: false
  });
});

// Handle always on top setting
ipcMain.handle('set-always-on-top', async (event, value) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(value);
    return value;
  }
  return false;
});

// Handler to get app version
ipcMain.handle('get-app-version', () => {
  return packageJson.version;
}); 