'use strict';
// Prepare a user-owned macOS launch agent. Installing/starting it is an explicit
// operational command, separate from generating the file or running tests.
const fs = require('node:fs');
const path = require('node:path');
const LABEL = 'lt.globis.scrapers';
const xml = value => String(value).replace(/[<>&"']/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&apos;' })[c]);

function plist({ outDir, repoDir = path.resolve(__dirname, '../..'), node = process.execPath }) {
  if (![outDir, repoDir, node].every(p => typeof p === 'string' && path.isAbsolute(p) && !/[\x00-\x1f]/.test(p))) throw Error('Expected absolute paths');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${LABEL}</string>
<key>ProgramArguments</key><array><string>${xml(node)}</string><string>${xml(path.join(repoDir, 'scripts/scrapers/service.cjs'))}</string><string>${xml(outDir)}</string></array>
<key>WorkingDirectory</key><string>${xml(repoDir)}</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>/usr/local/bin:/usr/bin:/bin</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>30</integer>
<key>ExitTimeOut</key><integer>30</integer>
<key>ProcessType</key><string>Background</string>
<key>Nice</key><integer>10</integer><key>LowPriorityIO</key><true/>
<key>StandardOutPath</key><string>${xml(path.join(outDir, 'service.log'))}</string>
<key>StandardErrorPath</key><string>${xml(path.join(outDir, 'service.log'))}</string>
</dict></plist>\n`;
}

if (require.main === module) {
  const [file, outDir] = process.argv.slice(2);
  if (!file || !outDir) { console.error('Usage: node scripts/scrapers/launchd.cjs <absolute-plist-file> <absolute-runtime-directory>'); process.exitCode = 2; }
  else {
    const body = plist({ outDir });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body, { mode: 0o600 });
    console.log(JSON.stringify({ label: LABEL, file, outDir, installed: false }));
  }
}
module.exports = { plist, LABEL };
