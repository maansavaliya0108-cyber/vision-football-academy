// Stops the dev server however it was started (terminal or the SessionStart hook) by ending
// the whole process group behind whatever listens on the dev ports: npm, concurrently,
// node --watch, Vite and the API all go together, so nothing is left running.
import { execFileSync } from 'node:child_process'

const PORTS = ['5173', '4387']
const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

const pids = run('lsof', ['-t', '-sTCP:LISTEN', `-iTCP:${PORTS.join(',')}`]).split('\n').filter(Boolean)
const groups = new Set(pids.map((pid) => run('ps', ['-o', 'pgid=', '-p', pid])).filter(Boolean))
// Never signal our own group (when run from an interactive shell it may be the shell's).
groups.delete(run('ps', ['-o', 'pgid=', '-p', String(process.pid)]))

for (const pgid of groups) {
  try {
    process.kill(-Number(pgid), 'SIGTERM')
  } catch {}
}
console.log(groups.size ? 'Dev server stopped' : 'Dev server was not running')
