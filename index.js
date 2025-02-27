const { app, BrowserWindow, ipcMain, screen, shell, dialog } = require('electron');
const path = require('path');
const remoteMain = require('@electron/remote/main');
const packageJson = require('./package.json');
const fs = require('fs');
const Store = require('electron-store');

// Enable application-wide error logging
function logError(type, error) {
  const errorMsg = `[${type}] ${error?.stack || error}`;
  console.error(errorMsg);
  
  // In production, write to log file
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, 'error.log');
    fs.appendFileSync(logFile, `${new Date().toISOString()} - ${errorMsg}\n`);
  } catch (e) {
    console.error('Failed to write to log file:', e);
  }
}

// Set application ID for Windows taskbar icon - use hardcoded value to prevent errors
const appId = 'com.adam.hcalculator';
app.setAppUserModelId(appId);

// Initialize @electron/remote
try {
  remoteMain.initialize();
} catch (error) {
  logError('Remote Init', error);
  dialog.showErrorBox('Initialization Error', 
    'Failed to initialize @electron/remote. Error: ' + error.message);
}

// Initialize store variable
let store;
// Function to initialize the store (changed from async to sync)
function initStore() {
  try {
    if (!store) {
      // Configure store with proper options for portable mode
      const options = {
        name: 'hcalculator-config',
        fileExtension: 'json',
        clearInvalidConfig: true, // Clear if config is corrupt
        encryptionKey: 'hcalculator2025' // Basic encryption for user data
      };
      
      // Check if running in portable mode - if app is in a writable location
      try {
        const appPath = app.getAppPath();
        const portablePath = path.join(appPath, '..', 'HCalculatorData');
        
        // Check if we can write to a directory next to the executable
        try {
          if (!fs.existsSync(portablePath)) {
            fs.mkdirSync(portablePath, { recursive: true });
          }
          
          // Test file write
          const testFile = path.join(portablePath, 'test.txt');
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          
          // We can write here, so use it as the data path
          options.cwd = portablePath;
          console.log('Using portable configuration path:', portablePath);
        } catch (writeError) {
          console.log('Cannot write to portable location, using user data path');
          // Continue with default user data path
        }
      } catch (pathError) {
        console.log('Error checking portable path:', pathError);
        // Continue with default user data path
      }
      
      store = new Store(options);
      return store;
    }
    return store;
  } catch (error) {
    logError('Store Init', error);
    dialog.showErrorBox('Store Initialization Error', 
      'Failed to initialize the data store. Error: ' + error.message);
    return { get: () => ({}), set: () => {} }; // Return dummy store to prevent crashes
  }
}

// Initialize store immediately (changed from async to sync)
try {
  initStore();
} catch (err) {
  logError('Initial Store Load', err);
}

let mainWindow;

async function createWindow() {
  try {
    // Ensure store is initialized (no need for await now)
    initStore();
    
    // Get stored window bounds or use defaults
    let windowBounds = { width: 350, height: 550, x: undefined, y: undefined };
    try {
      windowBounds = store.get('windowBounds', windowBounds);
    } catch (error) {
      logError('Get Window Bounds', error);
    }
    
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
      // Remove the icon path temporarily to see if it's causing the issue
      // icon: path.resolve(__dirname, 'assets/hcalculator-logo.ico'),
      // Make the window look modern with these options
      frame: false,
      titleBarStyle: 'hidden',
      transparent: false,
      backgroundColor: '#f5f5f5'
    });

    try {
      // Enable @electron/remote for this window
      remoteMain.enable(mainWindow.webContents);
    } catch (error) {
      logError('Remote Enable', error);
    }

    // Load the index.html of the app
    try {
      mainWindow.loadFile('index.html');
    } catch (error) {
      logError('Load HTML', error);
      dialog.showErrorBox('Load Error', 
        'Failed to load the application interface. Error: ' + error.message);
    }

    // Open the DevTools in development
    // Comment out for production builds
    // mainWindow.webContents.openDevTools();

    // Save window position and size when it changes (debounced)
    let saveBoundsTimeout;
    const saveBounds = () => {
      if (saveBoundsTimeout) clearTimeout(saveBoundsTimeout);
      saveBoundsTimeout = setTimeout(async () => {
        try {
          if (!mainWindow.isDestroyed()) {
            const bounds = mainWindow.getBounds();
            store.set('windowBounds', bounds);
          }
        } catch (error) {
          logError('Save Bounds', error);
        }
      }, 500);
    };

    // Save bounds when window is moved or resized
    mainWindow.on('resize', saveBounds);
    mainWindow.on('move', saveBounds);

    // Save window position and size before closing
    mainWindow.on('close', async () => {
      try {
        if (!mainWindow.isDestroyed()) {
          const bounds = mainWindow.getBounds();
          store.set('windowBounds', bounds);
        }
      } catch (error) {
        logError('Close Save Bounds', error);
      }
    });

    // Emitted when the window is closed
    mainWindow.on('closed', function () {
      mainWindow = null;
    });
    
    // When window is ready, send event to the renderer to blur the cogwheel
    mainWindow.webContents.on('did-finish-load', () => {
      try {
        mainWindow.webContents.send('window-ready');
        
        // Load preferences after window is ready
        try {
          const preferences = store.get('preferences', {});
          if (preferences.keepOnTop) {
            mainWindow.setAlwaysOnTop(true);
          }
        } catch (error) {
          logError('Load Preferences', error);
        }
      } catch (error) {
        logError('Window Ready', error);
      }
    });
  } catch (error) {
    logError('Create Window', error);
    dialog.showErrorBox('Application Error', 
      'Failed to create application window. Error: ' + error.message);
    app.quit();
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
  try {
    await createWindow();

    app.on('activate', async function () {
      if (BrowserWindow.getAllWindows().length === 0) await createWindow();
    });
  } catch (error) {
    logError('App Ready', error);
    dialog.showErrorBox('Startup Error', 
      'Failed to start the application. Error: ' + error.message);
    app.quit();
  }
}).catch(error => {
  logError('App Init', error);
  dialog.showErrorBox('Initialization Error', 
    'Failed to initialize the application. Error: ' + error.message);
  app.quit();
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Log any unhandled exceptions
process.on('uncaughtException', (error) => {
  logError('Uncaught Exception', error);
  if (mainWindow) {
    dialog.showErrorBox('Application Error', 
      'An unexpected error occurred. Error: ' + error.message);
  }
});

// Log unhandled Promise rejections
process.on('unhandledRejection', (reason) => {
  logError('Unhandled Rejection', reason);
});

// IPC handlers for history operations
ipcMain.handle('save-calculation', async (event, calculation) => {
  const history = store.get('calculationHistory', []);
  history.unshift(calculation); // Add new calculation at the beginning
  
  // Keep only the last 100 calculations to prevent excessive storage
  const limitedHistory = history.slice(0, 100);
  store.set('calculationHistory', limitedHistory);
  
  return limitedHistory;
});

ipcMain.handle('get-calculation-history', async () => {
  return store.get('calculationHistory', []);
});

ipcMain.handle('clear-history', async () => {
  store.set('calculationHistory', []);
  return [];
});

ipcMain.handle('delete-history-item', async (event, index) => {
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
  store.set('preferences', preferences);
  
  // If keepOnTop preference changes, update the window
  if (mainWindow && preferences.keepOnTop !== undefined) {
    mainWindow.setAlwaysOnTop(preferences.keepOnTop);
  }
  
  return preferences;
});

ipcMain.handle('get-preferences', async () => {
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

// Handler to open external links
ipcMain.handle('open-external-link', async (event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
}); 