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
  closeBtn: document.getElementById('close-btn')
}

let status = null
let selectedFiles = []
let sourceProfileId = ''

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
document.addEventListener('click', closeProfileMenu)
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
