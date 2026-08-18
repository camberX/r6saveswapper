const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

exports.default = async function afterPack(context) {
  const exeName = `${context.packager.appInfo.productFilename}.exe`
  const exe = path.join(context.appOutDir, exeName)
  const icon = path.join(context.packager.projectDir, 'assets', 'icon.ico')
  const rcedit = path.join(context.packager.projectDir, 'scripts', 'rcedit-x64.exe')

  if (!fs.existsSync(exe) || !fs.existsSync(rcedit) || !fs.existsSync(icon)) {
    return
  }

  execFileSync(rcedit, [exe, '--set-icon', icon], { stdio: 'inherit' })
  console.log(`Set icon on ${exeName}`)
}
