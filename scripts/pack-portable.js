const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const src = path.join(root, 'release', 'R6SaveSwapper.exe')
const destDir = path.join(root, 'portable')
const dest = path.join(destDir, 'R6SaveSwapper.exe')

if (!fs.existsSync(src)) {
  throw new Error(`Portable exe not found: ${src}`)
}

fs.rmSync(destDir, { recursive: true, force: true })
fs.mkdirSync(destDir, { recursive: true })
fs.copyFileSync(src, dest)

const unpacked = path.join(root, 'release', 'win-unpacked')
if (fs.existsSync(unpacked)) {
  fs.rmSync(unpacked, { recursive: true, force: true })
}

const sourceDir = path.join(destDir, 'source')
fs.mkdirSync(sourceDir, { recursive: true })

for (const name of ['package.json', 'package-lock.json', 'tsconfig.json', '.gitignore']) {
  const from = path.join(root, name)
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(sourceDir, name))
}

for (const name of ['src', 'renderer', 'assets']) {
  fs.cpSync(path.join(root, name), path.join(sourceDir, name), { recursive: true })
}

fs.mkdirSync(path.join(sourceDir, 'scripts'), { recursive: true })
for (const name of ['afterPack.js', 'pack-portable.js']) {
  fs.copyFileSync(path.join(root, 'scripts', name), path.join(sourceDir, 'scripts', name))
}

console.log(`Standalone exe: ${dest}`)
console.log(`Source: ${sourceDir}`)
