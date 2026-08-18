import { BrowserWindow, dialog, OpenDialogOptions, shell } from 'electron'
import { exec, execFile } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs-extra'
import * as os from 'os'
import * as path from 'path'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const PROFILE_ID = /^[0-9a-f-]{8,}$/i
const GAME_NAMES: Record<string, string> = {
  '1843': 'Steam',
  '635': 'Ubisoft',
  '3279': 'Ubisoft',
  '359550': 'Steam'
}
const R6_PROCS = ['RainbowSix.exe', 'RainbowSixGame.exe', 'r6_launcher.exe']

export interface SaveFileInfo {
  name: string
  path: string
  size: number
  modifiedAt: string
}

export interface SaveFolderInfo {
  gameId: string
  label: string
  path: string
  files: SaveFileInfo[]
  modifiedAt: string
}

export interface ProfileInfo {
  profileId: string
  username?: string
  nameOnPlatform?: string
  source: 'launcher-log' | 'savegames' | 'documents' | 'manual'
  lastActiveAt?: string
  documentsPath?: string
  saveRoot?: string
}

export interface BackupInfo {
  id: string
  createdAt: string
  profileId: string
  gameId: string
  folderLabel: string
  path: string
  fileCount: number
}

export interface ReplacementFile {
  name: string
  path: string
  size: number
}

export interface SaveSwapStatus {
  gameRunning: boolean
  launcherDir: string | null
  savegamesRoot: string | null
  activeProfile: ProfileInfo | null
  profiles: ProfileInfo[]
  activeFolder: SaveFolderInfo | null
  folders: SaveFolderInfo[]
  otherProfiles: OtherProfileSaves[]
  backups: BackupInfo[]
}

export interface OtherProfileSaves {
  profileId: string
  username?: string
  nameOnPlatform?: string
  lastActiveAt?: string
  folders: SaveFolderInfo[]
}

type NameHit = { username: string; nameOnPlatform: string }

export class SaveSwapService {
  private launcherDir: string | null = null
  private selectedProfileId: string | null = null
  private readonly backupsRoot: string
  private readonly namesPath: string
  private names = new Map<string, NameHit | null>()

  constructor(userDataPath?: string) {
    const root = userDataPath || path.join(os.homedir(), '.r6-save-swapper')
    this.backupsRoot = path.join(root, 'save-backups')
    this.namesPath = path.join(root, 'profile-names.json')
    this.loadNames()
  }

  async getStatus(opts?: { remoteNames?: boolean }): Promise<SaveSwapStatus> {
    const launcherDir = await this.findLauncher()
    const savegamesRoot = launcherDir ? path.join(launcherDir, 'savegames') : null
    const gameRunning = await this.gameRunning()
    const profiles = await this.findProfiles(savegamesRoot, opts?.remoteNames === true)
    const activeProfile = this.activeProfile(profiles)
    const folders = activeProfile?.saveRoot ? await this.listFolders(activeProfile.saveRoot) : []
    const activeFolder = this.activeFolder(folders)
    const backups = await this.listBackups(activeProfile?.profileId)
    const otherProfiles: OtherProfileSaves[] = []
    for (const profile of profiles) {
      if (!activeProfile || profile.profileId === activeProfile.profileId) continue
      const profileFolders = profile.saveRoot ? await this.listFolders(profile.saveRoot) : []
      otherProfiles.push({
        profileId: profile.profileId,
        username: profile.username,
        nameOnPlatform: profile.nameOnPlatform,
        lastActiveAt: profile.lastActiveAt,
        folders: profileFolders
      })
    }
    otherProfiles.sort((a, b) => {
      const aFiles = a.folders.reduce((n, f) => n + f.files.length, 0)
      const bFiles = b.folders.reduce((n, f) => n + f.files.length, 0)
      if (bFiles !== aFiles) return bFiles - aFiles
      return (b.lastActiveAt ? +new Date(b.lastActiveAt) : 0) - (a.lastActiveAt ? +new Date(a.lastActiveAt) : 0)
    })
    const saveRootOk = savegamesRoot && (await fs.pathExists(savegamesRoot))
    return {
      gameRunning,
      launcherDir,
      savegamesRoot: saveRootOk ? savegamesRoot : null,
      activeProfile,
      profiles,
      activeFolder,
      folders,
      otherProfiles,
      backups
    }
  }

  selectProfile(profileId: string) {
    this.selectedProfileId = profileId
  }

  async pickReplacementFiles(parent?: BrowserWindow | null) {
    return this.pick(parent, {
      title: 'Select replacement R6 save files',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'R6 Save Files', extensions: ['save'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
  }

  async pickReplacementFolder(parent?: BrowserWindow | null) {
    const result = await this.openDialog(parent, {
      title: 'Select a folder of replacement R6 saves',
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths.length) return []
    const folder = result.filePaths[0]
    const saves: string[] = []
    for (const name of await fs.readdir(folder)) {
      const full = path.join(folder, name)
      try {
        if ((await fs.stat(full)).isFile() && name.toLowerCase().endsWith('.save')) saves.push(full)
      } catch {}
    }
    return this.describe(saves)
  }

  async replaceSaves(files: ReplacementFile[]) {
    if (!files.length) throw new Error('No replacement files selected')
    if (await this.gameRunning()) throw new Error('Close Siege before replacing saves')
    const status = await this.getStatus()
    if (!status.activeFolder) throw new Error('No R6 save folder for this profile')
    const backup = await this.backupFolder(status.activeFolder, status.activeProfile?.profileId)
    const copied: string[] = []
    try {
      await fs.ensureDir(status.activeFolder.path)
      for (const file of files) {
        await fs.copy(file.path, path.join(status.activeFolder.path, file.name), { overwrite: true })
        copied.push(file.name)
      }
    } catch (err) {
      this.rethrowWrite(err)
    }
    return { backup, copied }
  }

  async backupNow() {
    const status = await this.getStatus()
    if (!status.activeFolder) throw new Error('No R6 save folder to back up')
    return this.backupFolder(status.activeFolder, status.activeProfile?.profileId)
  }

  async restoreBackup(backupId: string) {
    if (await this.gameRunning()) throw new Error('Close Siege before restoring a backup')
    const backup = (await this.listBackups()).find((b) => b.id === backupId)
    if (!backup) throw new Error('Backup not found')
    const dest = (await this.getStatus()).activeFolder?.path
    if (!dest) throw new Error('No R6 save folder to restore into')
    const saves = (await fs.readdir(backup.path)).filter((n) => n.toLowerCase().endsWith('.save'))
    if (!saves.length) throw new Error('Backup has no .save files')
    try {
      await fs.ensureDir(dest)
      for (const name of saves) {
        await fs.copy(path.join(backup.path, name), path.join(dest, name), { overwrite: true })
      }
    } catch (err) {
      this.rethrowWrite(err)
    }
  }

  async openPath(target: string) {
    if (!target) throw new Error('No path to open')
    if (!(await fs.pathExists(target))) throw new Error('That folder no longer exists')
    await shell.openPath(target)
  }

  private async pick(parent: BrowserWindow | null | undefined, options: OpenDialogOptions) {
    const result = await this.openDialog(parent, options)
    if (result.canceled || !result.filePaths.length) return []
    return this.describe(result.filePaths)
  }

  private openDialog(parent: BrowserWindow | null | undefined, options: OpenDialogOptions) {
    return parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options)
  }

  private rethrowWrite(error: unknown): never {
    const code = (error as { code?: string })?.code
    if (code === 'EPERM' || code === 'EACCES') {
      throw new Error('Need admin rights to write Ubisoft savegames')
    }
    throw error
  }

  private async backupFolder(folder: SaveFolderInfo, profileId?: string): Promise<BackupInfo> {
    const createdAt = new Date()
    const stamp = this.stamp(createdAt)
    const id = `${profileId || 'unknown'}_${folder.gameId}_${stamp}`
    const dest = path.join(this.backupsRoot, profileId || 'unknown', stamp)
    await fs.ensureDir(dest)
    for (const file of folder.files) {
      await fs.copy(file.path, path.join(dest, file.name), { overwrite: true })
    }
    const meta: BackupInfo = {
      id,
      createdAt: createdAt.toISOString(),
      profileId: profileId || 'unknown',
      gameId: folder.gameId,
      folderLabel: folder.label,
      path: dest,
      fileCount: folder.files.length
    }
    await fs.writeJson(path.join(dest, 'backup.json'), meta, { spaces: 2 })
    return meta
  }

  private async listBackups(profileId?: string): Promise<BackupInfo[]> {
    const root = profileId ? path.join(this.backupsRoot, profileId) : this.backupsRoot
    if (!(await fs.pathExists(root))) return []
    const backups: BackupInfo[] = []
    const scanRoots = profileId
      ? [root]
      : (await fs.readdir(root)).map((entry) => path.join(root, entry))

    for (const scanRoot of scanRoots) {
      try {
        if (!(await fs.stat(scanRoot)).isDirectory()) continue
        for (const entry of await fs.readdir(scanRoot)) {
          const full = path.join(scanRoot, entry)
          const metaPath = path.join(full, 'backup.json')
          try {
            if (await fs.pathExists(metaPath)) {
              backups.push(await fs.readJson(metaPath))
              continue
            }
            const files = (await fs.readdir(full)).filter((n) => n.toLowerCase().endsWith('.save'))
            if (!files.length) continue
            const st = await fs.stat(full)
            backups.push({
              id: `${path.basename(path.dirname(full))}_${entry}`,
              createdAt: st.mtime.toISOString(),
              profileId: path.basename(path.dirname(full)),
              gameId: 'unknown',
              folderLabel: 'Backup',
              path: full,
              fileCount: files.length
            })
          } catch {}
        }
      } catch {}
    }

    return backups.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  }

  private async findProfiles(savegamesRoot: string | null, remoteNames: boolean) {
    const byId = new Map<string, ProfileInfo>()
    const docs = [
      path.join(os.homedir(), 'Documents', 'My Games', 'Rainbow Six - Siege'),
      path.join(os.homedir(), 'OneDrive', 'Documents', 'My Games', 'Rainbow Six - Siege')
    ]

    for (const docsRoot of docs) {
      if (!(await fs.pathExists(docsRoot))) continue
      for (const entry of await fs.readdir(docsRoot)) {
        if (!UUID.test(entry)) continue
        const documentsPath = path.join(docsRoot, entry)
        try {
          const st = await fs.stat(documentsPath)
          if (!st.isDirectory()) continue
          byId.set(entry.toLowerCase(), {
            profileId: entry.toLowerCase(),
            source: 'documents',
            lastActiveAt: st.mtime.toISOString(),
            documentsPath
          })
        } catch {}
      }
    }

    if (savegamesRoot && (await fs.pathExists(savegamesRoot))) {
      for (const entry of await fs.readdir(savegamesRoot)) {
        if (!PROFILE_ID.test(entry)) continue
        const saveRoot = path.join(savegamesRoot, entry)
        try {
          const st = await fs.stat(saveRoot)
          if (!st.isDirectory()) continue
          const folders = await this.listFolders(saveRoot)
          const id = entry.toLowerCase()
          const existing = byId.get(id)
          byId.set(id, {
            profileId: id,
            source: folders[0] ? 'savegames' : existing?.source || 'savegames',
            lastActiveAt: folders[0]?.modifiedAt || st.mtime.toISOString(),
            documentsPath: existing?.documentsPath,
            saveRoot,
            username: existing?.username,
            nameOnPlatform: existing?.nameOnPlatform
          })
        } catch {}
      }
    }

    const launcherUserId = await this.launcherUserId()
    if (launcherUserId) {
      const existing = byId.get(launcherUserId)
      if (existing) {
        existing.source = 'launcher-log'
      } else {
        byId.set(launcherUserId, {
          profileId: launcherUserId,
          source: 'launcher-log',
          saveRoot: savegamesRoot ? path.join(savegamesRoot, launcherUserId) : undefined
        })
      }
    }

    const profiles = [...byId.values()]
    for (const profile of profiles) {
      const cached = this.names.get(profile.profileId.toLowerCase())
      if (cached) {
        profile.username = cached.username
        profile.nameOnPlatform = cached.nameOnPlatform
      }
    }

    if (remoteNames) {
      await Promise.all(
        profiles.map(async (profile) => {
          if (profile.nameOnPlatform) return
          const hit = await this.lookupName(profile.profileId)
          if (hit) {
            profile.username = hit.username
            profile.nameOnPlatform = hit.nameOnPlatform
          }
        })
      )
    }

    return profiles.sort((a, b) => {
      return (b.lastActiveAt ? +new Date(b.lastActiveAt) : 0) - (a.lastActiveAt ? +new Date(a.lastActiveAt) : 0)
    })
  }

  private activeProfile(profiles: ProfileInfo[]) {
    if (!profiles.length) return null
    if (this.selectedProfileId) {
      const selected = profiles.find(
        (p) => p.profileId.toLowerCase() === this.selectedProfileId?.toLowerCase()
      )
      if (selected) return { ...selected, source: 'manual' as const }
    }
    const fromLog = profiles.find((p) => p.source === 'launcher-log')
    return fromLog?.saveRoot ? fromLog : profiles[0]
  }

  private activeFolder(folders: SaveFolderInfo[]) {
    if (!folders.length) return null
    return folders[0]
  }

  private async listFolders(saveRoot: string): Promise<SaveFolderInfo[]> {
    if (!(await fs.pathExists(saveRoot))) return []
    const folders: SaveFolderInfo[] = []
    for (const entry of await fs.readdir(saveRoot)) {
      const folderPath = path.join(saveRoot, entry)
      try {
        const st = await fs.stat(folderPath)
        if (!st.isDirectory()) continue
        const files = await this.listSaves(folderPath)
        if (!files.length && !GAME_NAMES[entry]) continue
        const newest = files.reduce((n, f) => Math.max(n, +new Date(f.modifiedAt)), st.mtime.getTime())
        folders.push({
          gameId: entry,
          label: GAME_NAMES[entry] || `Game ${entry}`,
          path: folderPath,
          files,
          modifiedAt: new Date(newest).toISOString()
        })
      } catch {}
    }
    return folders.sort((a, b) => +new Date(b.modifiedAt) - +new Date(a.modifiedAt))
  }

  private async listSaves(folderPath: string): Promise<SaveFileInfo[]> {
    const files: SaveFileInfo[] = []
    for (const name of await fs.readdir(folderPath)) {
      if (!name.toLowerCase().endsWith('.save')) continue
      const filePath = path.join(folderPath, name)
      try {
        const st = await fs.stat(filePath)
        if (!st.isFile()) continue
        files.push({ name, path: filePath, size: st.size, modifiedAt: st.mtime.toISOString() })
      } catch {}
    }
    return files.sort((a, b) => +new Date(b.modifiedAt) - +new Date(a.modifiedAt))
  }

  private async describe(filePaths: string[]): Promise<ReplacementFile[]> {
    const files: ReplacementFile[] = []
    for (const filePath of filePaths) {
      files.push({ name: path.basename(filePath), path: filePath, size: (await fs.stat(filePath)).size })
    }
    return files
  }

  private async findLauncher() {
    if (this.launcherDir) return this.launcherDir
    const candidates = [
      'C:/Program Files (x86)/Ubisoft/Ubisoft Game Launcher',
      'C:/Program Files/Ubisoft/Ubisoft Game Launcher'
    ]
    try {
      const { stdout } = await execAsync(
        'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher" /v InstallDir'
      )
      const match = stdout.match(/InstallDir\s+REG_SZ\s+(.+)/)
      if (match) candidates.unshift(match[1].trim().replace(/\\+$/, ''))
    } catch {}
    for (const dir of candidates) {
      if (await fs.pathExists(dir)) {
        this.launcherDir = dir
        return dir
      }
    }
    return null
  }

  private async launcherUserId() {
    try {
      const installDir = await this.findLauncher()
      if (!installDir) return null
      const logPath = path.join(installDir, 'logs', 'launcher_log.txt')
      if (!(await fs.pathExists(logPath))) return null
      const matches = (await fs.readFile(logPath, 'utf8')).match(/User:\s*([0-9a-f-]{36})/gi)
      if (!matches?.length) return null
      const uuid = matches[matches.length - 1].replace(/User:\s*/i, '').toLowerCase()
      return UUID.test(uuid) ? uuid : null
    } catch {
      return null
    }
  }

  private async lookupName(userId: string): Promise<NameHit | null> {
    const id = userId.toLowerCase()
    if (this.names.has(id)) return this.names.get(id) ?? null
    const hit = await this.fromStatsCc(id)
    if (hit) {
      this.names.set(id, hit)
      this.saveNames()
    }
    return hit
  }

  private loadNames() {
    try {
      if (!fs.existsSync(this.namesPath)) return
      const saved = fs.readJsonSync(this.namesPath) as Record<string, NameHit>
      for (const [id, value] of Object.entries(saved || {})) {
        const name = value?.nameOnPlatform || value?.username
        if (!name) continue
        this.names.set(id.toLowerCase(), { nameOnPlatform: name, username: value.username || name })
      }
    } catch {}
  }

  private saveNames() {
    try {
      const payload: Record<string, NameHit> = {}
      for (const [id, value] of this.names.entries()) {
        if (value) payload[id] = value
      }
      fs.ensureDirSync(path.dirname(this.namesPath))
      fs.writeJsonSync(this.namesPath, payload, { spaces: 2 })
    } catch {}
  }

  private async fromStatsCc(userId: string): Promise<NameHit | null> {
    const html = await this.fetchPlayer(userId)
    if (!html) return null
    const meta = html.match(/<meta\s+property="profile:username"\s+content="([^"]+)"/i)
    const title = html.match(/<title>Siege Stats\s*-\s*Stats\.CC\s+(.+?)\s+-\s+Rainbow Six/i)
    const name = this.unescape((meta?.[1] || title?.[1] || '').trim())
    if (!name || UUID.test(name) || /cloudflare|attention required/i.test(name)) return null
    return { nameOnPlatform: name, username: name }
  }

  private async fetchPlayer(userId: string) {
    const url = `https://stats.cc/siege/player/${userId}`
    if (process.platform === 'win32') {
      try {
        const { stdout } = await execFileAsync(
          'curl.exe',
          ['-sS', '-L', '--max-time', '12', '-A', UA, '-H', 'Accept: text/html', url],
          { timeout: 15000, maxBuffer: 8 * 1024 * 1024, windowsHide: true, encoding: 'utf8' }
        )
        if (stdout && /profile:username|Stats\.CC/i.test(stdout)) return stdout
      } catch {}
    }
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: { Accept: 'text/html', 'User-Agent': UA }
      })
      return res.ok ? await res.text() : null
    } catch {
      return null
    }
  }

  private unescape(value: string) {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
  }

  private async gameRunning() {
    try {
      const cmd = process.platform === 'win32' ? 'tasklist /FO CSV /NH' : 'ps aux'
      const { stdout } = await execAsync(cmd)
      const list = stdout.toLowerCase()
      return R6_PROCS.some((name) => list.includes(name.toLowerCase()))
    } catch {
      return false
    }
  }

  private stamp(date: Date) {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`
  }
}
