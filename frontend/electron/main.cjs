const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow = null;
let backendProcess = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Backend server configuration
const BACKEND_PORT = 5000;
const FRONTEND_PORT = 3000;

// Get the correct backend path based on whether app is packaged
function getBackendPath() {
  if (isDev) {
    return path.join(__dirname, '../../backend');
  } else {
    // In production, backend is in resources/backend
    return path.join(process.resourcesPath, 'backend');
  }
}

const BACKEND_PATH = getBackendPath();
const BACKEND_SCRIPT = path.join(BACKEND_PATH, 'server.js');

function startBackendServer() {
  // Check if backend directory exists
  if (!fs.existsSync(BACKEND_SCRIPT)) {
    console.error('Backend server not found at:', BACKEND_SCRIPT);
    console.error('Looking in:', BACKEND_PATH);
    return;
  }

  console.log('Starting backend server from:', BACKEND_SCRIPT);
  
  // Prepare environment variables
  const backendEnv = {
    ...process.env,
    PORT: BACKEND_PORT.toString(),
    NODE_ENV: isDev ? 'development' : 'production',
    DB_PATH: path.join(app.getPath('userData'), 'sumitask.db'),
  };

  // Start backend server
  backendProcess = spawn('node', [BACKEND_SCRIPT], {
    cwd: BACKEND_PATH,
    env: backendEnv,
    stdio: isDev ? 'inherit' : 'ignore', // Hide console in production
    windowsHide: true, // Hide console window on Windows
  });

  backendProcess.on('error', (error) => {
    console.error('Failed to start backend server:', error);
  });

  backendProcess.on('exit', (code) => {
    console.log(`Backend server exited with code ${code}`);
  });

  // Give backend some time to start
  return new Promise((resolve) => {
    setTimeout(resolve, 1000);
  });
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
    },
    icon: path.join(__dirname, '../public/vite.svg'),
    show: true, // Show immediately
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);
    
    // If dev server is not ready, wait a bit and reload
    mainWindow.webContents.on('did-fail-load', () => {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);
        }
      }, 1000);
    });
  } else {
    // In production, load from built files
    // In packaged app: electron files are in resources/app/electron/
    // and dist files are in resources/app/dist/
    const indexPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'app', 'dist', 'index.html')
      : path.join(__dirname, '../dist/index.html');
    console.log('Loading index.html from:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.origin !== `http://localhost:${FRONTEND_PORT}` && 
        parsedUrl.origin !== `http://localhost:${BACKEND_PORT}` &&
        !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Function to restart backend server
function restartBackendServer() {
  console.log('Restarting backend server...');
  
  // Kill existing backend process
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  
  // Wait a bit before restarting
  return new Promise((resolve) => {
    setTimeout(async () => {
      await startBackendServer();
      resolve();
    }, 1000);
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  // Register IPC handler for backend restart
  ipcMain.handle('restart-backend', async () => {
    try {
      await restartBackendServer();
      return { success: true, message: 'Backend restarted successfully' };
    } catch (error) {
      console.error('Failed to restart backend:', error);
      return { success: false, message: error.message };
    }
  });

  // Always start backend server (both dev and production)
  await startBackendServer();

  createWindow();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    // Stop backend server
    if (backendProcess) {
      backendProcess.kill();
      backendProcess = null;
    }
    app.quit();
  }
});

// Cleanup on app quit
app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

