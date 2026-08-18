import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
import { ReplacementFile, SaveSwapService } from './saveSwapService'

let win: BrowserWindow | null = null
const saves = new SaveSwapService()

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '../assets/icon.ico')
  win = new BrowserWindow({
    width: 820,
    height: 640,
    minWidth: 700,
    minHeight: 540,
    backgroundColor: '#00000000',
    frame: false,
    transparent: true,
    roundedCorners: false,
    hasShadow: true,
    autoHideMenuBar: true,
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.loadFile(path.join(__dirname, '../renderer/index.html'))
  win.once('ready-to-show', () => win?.show())
  win.on('maximize', () => win?.webContents.send('window:maximized', true))
  win.on('unmaximize', () => win?.webContents.send('window:maximized', false))
  win.on('closed', () => {
    win = null
  })
}

app.whenReady().then(() => {
  ipcMain.handle('saves:getStatus', () => saves.getStatus())
  ipcMain.handle('saves:resolveNames', () => saves.getStatus({ remoteNames: true }))
  ipcMain.handle('saves:selectProfile', async (_e, id: string) => {
    saves.selectProfile(id)
    return saves.getStatus()
  })
  ipcMain.handle('saves:pickReplacementFiles', () => saves.pickReplacementFiles(win))
  ipcMain.handle('saves:pickReplacementFolder', () => saves.pickReplacementFolder(win))
  ipcMain.handle('saves:replace', (_e, files: ReplacementFile[]) => saves.replaceSaves(files))
  ipcMain.handle('saves:backupNow', () => saves.backupNow())
  ipcMain.handle('saves:restoreBackup', (_e, id: string) => saves.restoreBackup(id).then(() => ({ ok: true })))
  ipcMain.handle('saves:openPath', (_e, target: string) => saves.openPath(target))
  ipcMain.handle('window:minimize', () => win?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.handle('window:close', () => win?.close())
  createWindow()
})

app.on('window-all-closed', () => app.quit())
