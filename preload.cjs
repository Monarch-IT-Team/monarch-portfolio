const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  launchMonarchAI: () => ipcRenderer.invoke('launch-monarch-ai')
})
