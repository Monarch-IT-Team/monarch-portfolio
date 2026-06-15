const { app, BrowserWindow, ipcMain, shell, session } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: true,
    title: 'Monarch Portfolio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      webSecurity: false,
    }
  })

  mainWindow.setMenuBarVisibility(false)

  // Handle new windows opened by webview or links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open external links in default browser or allow them inside?
    // Let's allow them inside the app
    return { action: 'allow' }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  // Grant permissions for microphone and media
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'audioCapture']
    if (allowedPermissions.includes(permission)) {
      callback(true)
    } else {
      callback(false)
    }
  })

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const allowedPermissions = ['media', 'audioCapture']
    return allowedPermissions.includes(permission)
  })

  // Remove X-Frame-Options to allow embedding external sites in iframe
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders }
    
    // Remove headers that block iframe embedding
    delete responseHeaders['x-frame-options']
    delete responseHeaders['X-Frame-Options']
    delete responseHeaders['content-security-policy']
    delete responseHeaders['Content-Security-Policy']

    callback({ cancel: false, responseHeaders })
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('launch-monarch-ai', async () => {
  // Use run_dev.bat as the user requested "the app itself" which is run via this script
  const child = spawn('cmd.exe', ['/C', 'start', 'cmd.exe', '/K', 'run_dev.bat'], {
    detached: true,
    stdio: 'ignore',
    cwd: 'D:\\Programmer\\Projects\\Monarch-AI'
  })
  child.unref()
  return { success: true, method: 'bat' }
})
