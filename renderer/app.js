const api = window.saves

const els = {
  gameBadge: document.getElementById('game-badge'),
  refreshBtn: document.getElementById('refresh-btn'),
  profileDropdown: document.getElementById('profile-dropdown'),
  profileToggle: document.getElementById('profile-toggle'),
  profileToggleLabel: document.getElementById('profile-toggle-label'),
  profileMenu: document.getElementById('profile-menu'),
  profileEmpty: document.getElementById('profile-empty'),
  profileBody: document.getElementById('profile-body'),
  copyIdBtn: document.getElementById('copy-id-btn'),
  profileName: document.getElementById('profile-name'),
  folderLabel: document.getElementById('folder-label'),
  openSavesBtn: document.getElementById('open-saves-btn'),
  pickFilesBtn: document.getElementById('pick-files-btn'),
  pickFolderBtn: document.getElementById('pick-folder-btn'),
  replacementFiles: document.getElementById('replacement-files'),
  backupBtn: document.getElementById('backup-btn'),
  replaceBtn: document.getElementById('replace-btn'),
  sourceEmpty: document.getElementById('source-empty'),
  sourceBody: document.getElementById('source-body'),
  sourceProfiles: document.getElementById('source-profiles'),
  copyProfileBtn: document.getElementById('copy-profile-btn'),
  backupsCard: document.getElementById('backups-card'),
  backups: document.getElementById('backups'),
  toast: document.getElementById('toast'),
  cloudSyncModal: document.getElementById('cloud-sync-modal'),
  cloudSyncOk: document.getElementById('cloud-sync-ok'),
  confirmModal: document.getElementById('confirm-modal'),
  confirmEyebrow: document.getElementById('confirm-eyebrow'),
  confirmTitle: document.getElementById('confirm-title'),
  confirmBody: document.getElementById('confirm-body'),
  confirmCancel: document.getElementById('confirm-cancel'),
  confirmOk: document.getElementById('confirm-ok'),
  minBtn: document.getElementById('min-btn'),
  maxBtn: document.getElementById('max-btn'),
  closeBtn: document.getElementById('close-btn'),
  settingsBtn: document.getElementById('settings-btn'),
  settingsPanel: document.getElementById('settings-panel'),
  settingsDismiss: document.getElementById('settings-dismiss'),
  settingsReset: document.getElementById('settings-reset'),
  settingsDone: document.getElementById('settings-done'),
  colorPop: document.getElementById('color-pop'),
  svMap: document.getElementById('sv-map'),
  svThumb: document.getElementById('sv-thumb'),
  hueSlider: document.getElementById('hue-slider'),
  hueThumb: document.getElementById('hue-thumb'),
  hexEdit: document.getElementById('hex-edit')
}

let status = null
let selectedFiles = []
let sourceProfileId = ''

const THEMES = ['mono', 'graphite', 'light', 'orange']
const THEME_ALIASES = { ember: 'orange', abyss: 'graphite' }
const THEME_KEYS = ['background', 'panels', 'controls', 'borders', 'text', 'muted', 'accent', 'accentText']
const THEME_VARS = [
  '--shell', '--bg', '--drop-bg', '--card', '--modal', '--raised', '--menu',
  '--line', '--drop-border', '--text', '--muted', '--accent', '--accent-text',
  '--hover', '--close-bg', '--close-text', '--primary-hover', '--active-meta', '--overlay'
]
const THEME_FROM_VAR = {
  background: '--shell',
  panels: '--card',
  controls: '--raised',
  borders: '--line',
  text: '--text',
  muted: '--muted',
  accent: '--accent',
  accentText: '--accent-text'
}

function parseColor(value) {
  if (!value) return null
  const raw = String(value).trim()
  const rgb = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3] }
  let hex = raw[0] === '#' ? raw : `#${raw}`
  if (/^#([0-9a-f]{3})$/i.test(hex)) {
    const h = hex.slice(1)
    return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) }
  }
  if (/^#([0-9a-f]{6})$/i.test(hex)) {
    return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) }
  }
  return null
}

function toHex(color) {
  const h = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  return `#${h(color.r)}${h(color.g)}${h(color.b)}`
}

function mix(a, b, t) {
  const from = typeof a === 'string' ? parseColor(a) : a
  const to = typeof b === 'string' ? parseColor(b) : b
  if (!from || !to) return '#000000'
  return toHex({
    r: Math.round(from.r + (to.r - from.r) * t),
    g: Math.round(from.g + (to.g - from.g) * t),
    b: Math.round(from.b + (to.b - from.b) * t)
  })
}

function luminance(color) {
  const c = typeof color === 'string' ? parseColor(color) : color
  if (!c) return 0
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255
}

function loadThemeColors() {
  try {
    const parsed = JSON.parse(localStorage.getItem('r6-theme-colors') || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function currentThemeName() {
  return document.documentElement.dataset.theme || 'graphite'
}

function clearThemeVars() {
  THEME_VARS.forEach((name) => document.documentElement.style.removeProperty(name))
}

function applyThemeColors(colors) {
  const c = {}
  for (const key of THEME_KEYS) {
    const parsed = parseColor(colors?.[key])
    if (parsed) c[key] = toHex(parsed)
  }
  if (THEME_KEYS.some((key) => !c[key])) return false

  const hover = mix(c.controls, c.text, 0.12)
  const dropBg = mix(c.background, '#000000', 0.12)
  const dropBorder = mix(c.borders, c.text, 0.22)
  const primaryHover = luminance(c.accent) > 0.55 ? mix(c.accent, '#000000', 0.12) : mix(c.accent, '#ffffff', 0.14)
  const overlay = luminance(c.background) > 0.5 ? 'rgba(0, 0, 0, 0.28)' : 'rgba(0, 0, 0, 0.5)'
  const root = document.documentElement.style
  root.setProperty('--shell', c.background)
  root.setProperty('--bg', c.background)
  root.setProperty('--drop-bg', dropBg)
  root.setProperty('--card', c.panels)
  root.setProperty('--modal', c.panels)
  root.setProperty('--raised', c.controls)
  root.setProperty('--menu', c.controls)
  root.setProperty('--line', c.borders)
  root.setProperty('--drop-border', dropBorder)
  root.setProperty('--text', c.text)
  root.setProperty('--muted', c.muted)
  root.setProperty('--accent', c.accent)
  root.setProperty('--accent-text', c.accentText)
  root.setProperty('--hover', hover)
  root.setProperty('--close-bg', c.accent)
  root.setProperty('--close-text', c.accentText)
  root.setProperty('--primary-hover', primaryHover)
  root.setProperty('--active-meta', mix(c.accentText, c.accent, 0.28))
  root.setProperty('--overlay', overlay)
  return true
}

function computedThemeColors() {
  const styles = getComputedStyle(document.documentElement)
  const colors = {}
  for (const [key, name] of Object.entries(THEME_FROM_VAR)) {
    const parsed = parseColor(styles.getPropertyValue(name))
    colors[key] = parsed ? toHex(parsed) : '#000000'
  }
  return colors
}

function rgbToHsv({ r, g, b }) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
    else if (max === g) h = ((b - r) / d + 2) * 60
    else h = ((r - g) / d + 4) * 60
  }
  return { h, s: max ? d / max : 0, v: max }
}

function hsvToRgb(h, s, v) {
  const c = v * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  }
}

function paintPicker(key, hex) {
  const chip = els.settingsPanel.querySelector(`[data-key="${key}"]`)
  if (!chip) return
  chip.dataset.hex = hex
  const label = chip.querySelector('.hex-value')
  if (label) label.textContent = hex
  chip.style.setProperty('--swatch', hex)
  chip.style.setProperty('--swatch-text', luminance(hex) > 0.55 ? '#1c1c1c' : '#ffffff')
}

function fillSettingsFields(colors) {
  THEME_KEYS.forEach((key) => paintPicker(key, colors[key]))
}

function setTheme(name) {
  const mapped = THEME_ALIASES[name] || name
  const theme = THEMES.includes(mapped) ? mapped : 'graphite'
  document.documentElement.dataset.theme = theme
  localStorage.setItem('r6-theme', theme)
  document.querySelectorAll('.theme-dot').forEach((dot) => {
    dot.classList.toggle('active', dot.dataset.theme === theme)
  })
  clearThemeVars()
  const saved = loadThemeColors()[theme]
  if (saved) applyThemeColors(saved)
  if (!els.settingsPanel.classList.contains('hidden')) fillSettingsFields(computedThemeColors())
}

function readSettingsColors() {
  const colors = {}
  THEME_KEYS.forEach((key) => {
    colors[key] = els.settingsPanel.querySelector(`[data-key="${key}"]`)?.dataset.hex
  })
  return colors
}

function saveCurrentThemeColors(colors) {
  if (!applyThemeColors(colors)) return
  const all = loadThemeColors()
  all[currentThemeName()] = {}
  THEME_KEYS.forEach((key) => {
    all[currentThemeName()][key] = toHex(parseColor(colors[key]))
  })
  localStorage.setItem('r6-theme-colors', JSON.stringify(all))
}

let pickerState = { key: null, h: 0, s: 0, v: 0 }

function updatePickerUI() {
  els.svMap.style.setProperty('--hue', String(pickerState.h))
  els.svThumb.style.left = `${pickerState.s * 100}%`
  els.svThumb.style.top = `${(1 - pickerState.v) * 100}%`
  els.hueThumb.style.left = `${(pickerState.h / 360) * 100}%`
}

function commitPicker() {
  if (!pickerState.key) return
  const hex = toHex(hsvToRgb(pickerState.h, pickerState.s, pickerState.v))
  paintPicker(pickerState.key, hex)
  els.hexEdit.value = hex
  saveCurrentThemeColors(readSettingsColors())
  updatePickerUI()
}

function positionColorPop(chip) {
  const shell = document.querySelector('.shell').getBoundingClientRect()
  const panel = els.settingsPanel.getBoundingClientRect()
  const chipRect = chip.getBoundingClientRect()
  els.colorPop.style.right = `${Math.max(8, shell.right - panel.left + 8)}px`
  let top = chipRect.top - shell.top
  const popH = els.colorPop.offsetHeight || 210
  if (top + popH > shell.height - 12) top = shell.height - popH - 12
  if (top < 12) top = 12
  els.colorPop.style.top = `${top}px`
}

function openColorPop(chip) {
  const parsed = parseColor(chip.dataset.hex)
  if (!parsed) return
  const hsv = rgbToHsv(parsed)
  pickerState = { key: chip.dataset.key, h: hsv.s === 0 ? pickerState.h : hsv.h, s: hsv.s, v: hsv.v }
  els.hexEdit.value = toHex(parsed)
  els.colorPop.classList.remove('hidden')
  document.querySelectorAll('.color-chip').forEach((el) => el.classList.toggle('open', el === chip))
  updatePickerUI()
  positionColorPop(chip)
}

function closeColorPop() {
  els.colorPop.classList.add('hidden')
  pickerState.key = null
  document.querySelectorAll('.color-chip').forEach((el) => el.classList.remove('open'))
}

function openSettings() {
  fillSettingsFields(computedThemeColors())
  els.settingsPanel.classList.remove('hidden')
  els.settingsDismiss.classList.remove('hidden')
  els.settingsBtn.classList.add('open')
}

function closeSettings() {
  closeColorPop()
  els.settingsPanel.classList.add('hidden')
  els.settingsDismiss.classList.add('hidden')
  els.settingsBtn.classList.remove('open')
}

function bindDrag(el, onMove) {
  const move = (e) => onMove(e, el.getBoundingClientRect())
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    el.setPointerCapture(e.pointerId)
    move(e)
  })
  el.addEventListener('pointermove', (e) => {
    if (el.hasPointerCapture(e.pointerId)) move(e)
  })
}

setTheme(localStorage.getItem('r6-theme') || 'graphite')

document.getElementById('theme-picker').addEventListener('click', (e) => {
  const dot = e.target.closest('[data-theme]')
  if (dot) setTheme(dot.dataset.theme)
})
els.settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  if (els.settingsPanel.classList.contains('hidden')) openSettings()
  else closeSettings()
})
els.settingsPanel.addEventListener('click', (e) => {
  e.stopPropagation()
  const chip = e.target.closest('.color-chip')
  if (!chip) return
  if (pickerState.key === chip.dataset.key && !els.colorPop.classList.contains('hidden')) {
    closeColorPop()
    return
  }
  openColorPop(chip)
})
els.colorPop.addEventListener('click', (e) => e.stopPropagation())
els.settingsDismiss.addEventListener('pointerdown', (e) => {
  e.preventDefault()
  closeSettings()
})
bindDrag(els.svMap, (e, rect) => {
  pickerState.s = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
  pickerState.v = Math.min(1, Math.max(0, 1 - (e.clientY - rect.top) / rect.height))
  commitPicker()
})
bindDrag(els.hueSlider, (e, rect) => {
  pickerState.h = Math.min(359.99, Math.max(0, ((e.clientX - rect.left) / rect.width) * 360))
  commitPicker()
})
els.hexEdit.addEventListener('input', () => {
  const parsed = parseColor(els.hexEdit.value)
  if (!parsed || !pickerState.key) return
  const hsv = rgbToHsv(parsed)
  pickerState.h = hsv.s === 0 ? pickerState.h : hsv.h
  pickerState.s = hsv.s
  pickerState.v = hsv.v
  paintPicker(pickerState.key, toHex(parsed))
  saveCurrentThemeColors(readSettingsColors())
  updatePickerUI()
})
els.settingsReset.addEventListener('click', () => {
  const all = loadThemeColors()
  delete all[currentThemeName()]
  localStorage.setItem('r6-theme-colors', JSON.stringify(all))
  clearThemeVars()
  fillSettingsFields(computedThemeColors())
  if (pickerState.key) {
    const chip = els.settingsPanel.querySelector(`[data-key="${pickerState.key}"]`)
    if (chip) openColorPop(chip)
  }
})
els.settingsDone.addEventListener('click', closeSettings)

function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

function showToast(message, kind = '') {
  els.toast.textContent = message
  els.toast.className = `toast ${kind}`
  clearTimeout(showToast.timer)
  showToast.timer = setTimeout(() => els.toast.classList.add('hidden'), 4200)
}

function askConfirm({ eyebrow = 'Confirm', title, body, ok = 'OK' }) {
  return new Promise((resolve) => {
    els.confirmEyebrow.textContent = eyebrow
    els.confirmTitle.textContent = title
    els.confirmBody.textContent = body
    els.confirmOk.textContent = ok
    els.confirmModal.classList.remove('hidden')
    document.body.classList.add('modal-open')

    const finish = (value) => {
      els.confirmModal.classList.add('hidden')
      document.body.classList.remove('modal-open')
      els.confirmOk.onclick = null
      els.confirmCancel.onclick = null
      resolve(value)
    }

    els.confirmOk.onclick = () => finish(true)
    els.confirmCancel.onclick = () => finish(false)
  })
}

function renderFiles(target, files, emptyText) {
  if (!files?.length) {
    target.innerHTML = `<p class="empty">${emptyText}</p>`
    return
  }
  target.innerHTML = files
    .map((f) => `<div class="file-row"><strong>${f.name}</strong><span>${formatBytes(f.size)}</span></div>`)
    .join('')
}

function profileLabel(profile) {
  return profile.nameOnPlatform || profile.username || profile.profileId
}

function fileCount(profile) {
  return (profile.folders || []).reduce((n, f) => n + (f.files?.length || 0), 0)
}

function currentSource() {
  const profile = (status?.otherProfiles || []).find((p) => p.profileId === sourceProfileId)
  const matchGame = status?.activeFolder?.gameId
  const folder = profile?.folders.find((f) => f.gameId === matchGame) || profile?.folders[0]
  return { profile, folder }
}

function renderSource() {
  const others = status?.otherProfiles || []
  if (!others.length) {
    els.sourceEmpty.classList.remove('hidden')
    els.sourceBody.classList.add('hidden')
    els.copyProfileBtn.disabled = true
    return
  }

  els.sourceEmpty.classList.add('hidden')
  els.sourceBody.classList.remove('hidden')
  if (!others.some((p) => p.profileId === sourceProfileId)) sourceProfileId = others[0].profileId

  els.sourceProfiles.innerHTML = others
    .map((p) => {
      const count = fileCount(p)
      const active = p.profileId === sourceProfileId ? 'active' : ''
      return `<button class="profile-row ${active}" type="button" data-id="${p.profileId}"><strong>${profileLabel(p)}</strong><span>${count ? `${count} files` : 'no saves'}</span></button>`
    })
    .join('')

  const { folder } = currentSource()
  els.copyProfileBtn.disabled = !folder?.files?.length || status.gameRunning || !status.activeFolder
}

function showPickedFiles(files) {
  selectedFiles = files
  els.pickFilesBtn.classList.add('has-files')
  els.pickFilesBtn.querySelector('strong').textContent = 'Click to change files'
  els.pickFilesBtn.querySelector('span').textContent = `${files.length} file(s) selected`
  els.replacementFiles.classList.remove('hidden')
  renderFiles(els.replacementFiles, files, 'Nothing selected.')
  els.replaceBtn.disabled = !status?.activeFolder || status.gameRunning
}

function renderBackups(backups) {
  const items = backups || []
  els.backupsCard.classList.toggle('hidden', items.length === 0)
  if (!items.length) return
  els.backups.innerHTML = items
    .map(
      (b) =>
        `<div class="backup-row"><div><strong>${formatDate(b.createdAt)}</strong></div><span class="meta">${b.fileCount} files</span><button class="btn" data-restore="${b.id}" type="button">Restore</button></div>`
    )
    .join('')
}

function renderStatus(next) {
  status = next
  const profile = next.activeProfile
  const folder = next.activeFolder

  els.gameBadge.textContent = next.gameRunning ? 'Siege Running' : 'Siege Closed'

  if (!profile) {
    els.profileEmpty.classList.remove('hidden')
    els.profileBody.classList.add('hidden')
  } else {
    els.profileEmpty.classList.add('hidden')
    els.profileBody.classList.remove('hidden')
    const name = profile.nameOnPlatform || profile.username || 'Looking up...'
    els.profileName.textContent = name
  }

  const many = next.profiles.length > 1
  els.profileDropdown.classList.toggle('hidden', !many)
  els.profileName.classList.toggle('hidden', many)
  if (many) {
    const currentName = profileLabel(profile)
    els.profileToggleLabel.textContent = currentName
    els.profileMenu.innerHTML = next.profiles
      .map((p) => {
        const active = profile && p.profileId === profile.profileId ? 'active' : ''
        return `<button class="dropdown-item ${active}" type="button" data-id="${p.profileId}">${profileLabel(p)}</button>`
      })
      .join('')
  }

  els.folderLabel.textContent = folder?.label || ''
  renderBackups(next.backups)
  renderSource()
  els.replaceBtn.disabled = !selectedFiles.length || next.gameRunning || !folder
}

async function refresh() {
  try {
    renderStatus(await api.getStatus())
  } catch (err) {
    showToast(err?.message || String(err), 'error')
  }
}

async function refreshNames() {
  try {
    const next = await api.resolveNames()
    renderStatus(next)
    if (next?.activeProfile && !next.activeProfile.nameOnPlatform && !next.activeProfile.username) {
      els.profileName.textContent = 'Unknown'
    }
  } catch {
    if (els.profileName.textContent === 'Looking up...') els.profileName.textContent = 'Unknown'
  }
}

els.sourceProfiles.addEventListener('click', (e) => {
  const row = e.target.closest('[data-id]')
  if (!row) return
  sourceProfileId = row.dataset.id
  renderSource()
})
els.copyProfileBtn.addEventListener('click', async () => {
  const { profile, folder } = currentSource()
  if (!folder?.files?.length) return
  const ok = await askConfirm({
    eyebrow: 'Copy',
    title: `Copy saves from ${profileLabel(profile)}?`,
    body: 'Current saves are backed up first.',
    ok: 'Copy'
  })
  if (!ok) return
  try {
    const result = await api.replace(folder.files)
    showToast(`Copied ${result.copied.length} file(s) from ${profileLabel(profile)}.`, 'success')
    await refresh()
  } catch (err) {
    showToast(err?.message || String(err), 'error')
  }
})
function closeProfileMenu() {
  els.profileMenu.classList.add('hidden')
}

els.profileToggle.addEventListener('click', (e) => {
  e.stopPropagation()
  els.profileMenu.classList.toggle('hidden')
})
els.profileMenu.addEventListener('click', async (e) => {
  const item = e.target.closest('[data-id]')
  if (!item) return
  closeProfileMenu()
  renderStatus(await api.selectProfile(item.dataset.id))
})
document.addEventListener('click', (e) => {
  closeProfileMenu()
  if (!e.target.closest('#settings-panel, #settings-btn, #theme-picker, #color-pop')) closeSettings()
})
els.refreshBtn.addEventListener('click', refresh)
els.copyIdBtn.addEventListener('click', async () => {
  const id = status?.activeProfile?.profileId
  if (!id) return
  await navigator.clipboard.writeText(id)
  showToast('Profile ID copied', 'success')
})
els.openSavesBtn.addEventListener('click', async () => {
  if (!status?.activeFolder?.path) return
  try {
    await api.openPath(status.activeFolder.path)
  } catch (err) {
    showToast(err?.message || String(err), 'error')
  }
})
els.pickFilesBtn.addEventListener('click', async () => {
  const files = await api.pickReplacementFiles()
  if (!files.length) return
  showPickedFiles(files)
})
els.pickFolderBtn.addEventListener('click', async () => {
  const files = await api.pickReplacementFolder()
  if (!files.length) {
    showToast('That folder has no .save files', 'error')
    return
  }
  showPickedFiles(files)
})
els.backupBtn.addEventListener('click', async () => {
  try {
    await api.backupNow()
    showToast('Saves backed up', 'success')
    await refresh()
  } catch (err) {
    showToast(err?.message || String(err), 'error')
  }
})
els.replaceBtn.addEventListener('click', async () => {
  if (!selectedFiles.length) return
  const ok = await askConfirm({
    eyebrow: 'Replace',
    title: 'Replace current saves?',
    body: 'A backup is created first.',
    ok: 'Replace'
  })
  if (!ok) return
  try {
    const result = await api.replace(selectedFiles)
    showToast(`Replaced ${result.copied.length} file(s).`, 'success')
    await refresh()
  } catch (err) {
    showToast(err?.message || String(err), 'error')
  }
})
els.backups.addEventListener('click', async (e) => {
  const restoreId = e.target.dataset.restore
  if (!restoreId) return
  const ok = await askConfirm({
    eyebrow: 'Restore',
    title: 'Restore this backup?',
    body: 'This overwrites the current saves.',
    ok: 'Restore'
  })
  if (!ok) return
  try {
    await api.restoreBackup(restoreId)
    showToast('Backup restored', 'success')
    await refresh()
  } catch (err) {
    showToast(err?.message || String(err), 'error')
  }
})
els.cloudSyncOk.addEventListener('click', () => {
  els.cloudSyncModal.classList.add('hidden')
  document.body.classList.remove('modal-open')
})
els.minBtn.addEventListener('click', () => api.minimize())
els.maxBtn.addEventListener('click', () => api.maximize())
els.closeBtn.addEventListener('click', () => api.close())
api.onMaximized?.((maximized) => document.body.classList.toggle('maximized', maximized))

refresh().then(() => refreshNames())
