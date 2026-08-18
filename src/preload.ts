import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('saves', {
  getStatus: () => ipcRenderer.invoke('saves:getStatus'),
  selectProfile: (id: string) => ipcRenderer.invoke('saves:selectProfile', id),
  pickReplacementFiles: () => ipcRenderer.invoke('saves:pickReplacementFiles'),
  pickReplacementFolder: () => ipcRenderer.invoke('saves:pickReplacementFolder'),
  replace: (files: Array<{ name: string; path: string; size: number }>) =>
    ipcRenderer.invoke('saves:replace', files),
  backupNow: () => ipcRenderer.invoke('saves:backupNow'),
  restoreBackup: (id: string) => ipcRenderer.invoke('saves:restoreBackup', id),
  openPath: (target: string) => ipcRenderer.invoke('saves:openPath', target),
  resolveNames: () => ipcRenderer.invoke('saves:resolveNames'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  onMaximized: (cb: (maximized: boolean) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, maximized: boolean) => cb(maximized)
    ipcRenderer.on('window:maximized', listener)
    return () => ipcRenderer.removeListener('window:maximized', listener)
  }
})
