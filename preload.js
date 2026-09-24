const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getStore: () => ipcRenderer.invoke('store:get'),
  addGame: (payload) => ipcRenderer.invoke('games:add', payload),
  updateGame: (id, updates) => ipcRenderer.invoke('games:update', id, updates),
  deleteGame: (id) => ipcRenderer.invoke('games:delete', id),
  launchGame: (id) => ipcRenderer.invoke('games:launch', id),
  updateSettings: (updates) => ipcRenderer.invoke('settings:update', updates),
  pickExecutable: () => ipcRenderer.invoke('dialog:pickExecutable'),
  pickImage: () => ipcRenderer.invoke('dialog:pickImage'),
  showInFolder: (targetPath) => ipcRenderer.invoke('shell:showInFolder', targetPath),
  pathExists: (targetPath) => ipcRenderer.invoke('fs:exists', targetPath),

  getEmulation: () => ipcRenderer.invoke('emulation:get'),
  updateRetroarchPath: (p) => ipcRenderer.invoke('emulation:updateRetroarch', p),
  saveConsoles: (consoles) => ipcRenderer.invoke('emulation:saveConsoles', consoles),
  listCores: () => ipcRenderer.invoke('emulation:listCores'),
  scanConsole: (profile) => ipcRenderer.invoke('emulation:scanConsole', profile),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  pickCoreFile: () => ipcRenderer.invoke('dialog:pickCoreFile'),

  autoFetchCovers: (ids) => ipcRenderer.invoke('covers:autoFetch', ids ? { ids } : {}),
});
