const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const desktopDir = path.join(os.homedir(), 'Desktop');
const shortcutPath = path.join(desktopDir, 'Dhanalakshmi Textiles Billing.lnk');
const targetBat = path.join(__dirname, 'run.bat');
const iconPath = path.join(__dirname, 'build', 'icon.ico');

const vbsScript = `
Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = "${shortcutPath.replace(/\\/g, '\\\\')}"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "${targetBat.replace(/\\/g, '\\\\')}"
oLink.WorkingDirectory = "${__dirname.replace(/\\/g, '\\\\')}"
oLink.Description = "Dhanalakshmi Textiles Billing System"
${fs.existsSync(iconPath) ? `oLink.IconLocation = "${iconPath.replace(/\\/g, '\\\\')}"` : ''}
oLink.Save
`;

const tempVbs = path.join(__dirname, 'create_shortcut.vbs');
fs.writeFileSync(tempVbs, vbsScript);
try {
  execSync(`cscript //nologo "${tempVbs}"`);
  console.log('SUCCESS: Desktop shortcut created at:', shortcutPath);
} catch (e) {
  console.error('Error creating shortcut:', e.message);
} finally {
  if (fs.existsSync(tempVbs)) fs.unlinkSync(tempVbs);
}
