/**
 * One-off: names the existing Work contracts "Luminos" (they have no name yet). Never changes a name that exists.
 *
 *   npm run name:contracts              # dry run
 *   npm run name:contracts -- --apply   # app closed; backs up time/work/ first, reads the files back
 */
import { homedir } from 'os'
import { join } from 'path'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { nameContracts } from '../src/main/tracking/name-contracts'

const apply = process.argv.includes('--apply')
const root = join(
  assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir()),
  'CentralCommand'
)
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const report = nameContracts(root, 'Luminos', apply, stamp)
for (const line of report.lines) console.log(line)
if (!report.ok) {
  console.log('\nPROBLEMS: see above.')
  process.exit(1)
}
if (report.backup)
  console.log(`\nBacked up to ${report.backup}; named ${report.changed}, read back.`)
else if (!apply) console.log('\nDry run: nothing changed. Add --apply (app closed) to do it.')
