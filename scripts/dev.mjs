// `npm run dev`: start the site and API, unless they are already running (for example, started
// in the background by the Claude SessionStart hook), in which case say where to find them.
import { spawn } from 'node:child_process'
import net from 'node:net'

const SITE_PORT = 5173
const API_PORT = Number(process.env.API_PORT) || 4387

const listening = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ port, host: 'localhost' })
    const done = (up) => {
      socket.destroy()
      resolve(up)
    }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    socket.setTimeout(800, () => done(false))
  })

const [siteUp, apiUp] = await Promise.all([listening(SITE_PORT), listening(API_PORT)])

if (siteUp && apiUp) {
  console.log(`\n  Already running at http://localhost:${SITE_PORT}\n`)
  console.log('  Its log is in .claude/dev-server.log.')
  console.log('  To run it in this terminal instead, stop the other one first: npm run dev:stop\n')
  process.exit(0)
}
if (siteUp || apiUp) {
  const busy = siteUp ? SITE_PORT : API_PORT
  console.error(`\n  Port ${busy} is in use, but the full dev server isn't running.`)
  console.error('  Run npm run dev:stop, then npm run dev again.\n')
  process.exit(1)
}

const child = spawn('npm', ['run', '-s', 'dev:servers'], { stdio: 'inherit' })
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)))
// Ctrl-C reaches the whole foreground group already; just don't let this wrapper die first.
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig))
