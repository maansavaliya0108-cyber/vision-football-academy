// `npm run dev:follow`: make sure the dev server is running (starting it in the background, the
// same way the Claude startup hook does, if it isn't), then stay attached and stream its log.
// This is what the in-app preview runs, since it needs a process that keeps running.
// Stopping this only detaches; the server keeps going. Stop the server with `npm run dev:stop`.
import { spawn } from 'node:child_process'
import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs'
import net from 'node:net'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const LOG = `${ROOT}.claude/dev-server.log`
const URL_ = 'http://localhost:5173'

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (!(await listening(5173))) {
  console.log('Starting the dev server in the background…')
  const out = openSync(LOG, 'a')
  const env = { ...process.env }
  delete env.NODE_ENV
  delete env.PORT // the preview sets PORT for its own use; the dev API keeps API_PORT
  spawn('npm', ['run', 'dev:servers'], { cwd: ROOT, env, detached: true, stdio: ['ignore', out, out] }).unref()
  let up = false
  for (let i = 0; i < 40 && !up; i++) {
    await sleep(500)
    up = await listening(5173)
  }
  if (!up) {
    console.error(`The dev server did not come up. Check ${LOG}.`)
    process.exit(1)
  }
}

console.log(`Dev server running at ${URL_} (stop it with npm run dev:stop)`)

// Stream new log lines as they arrive.
let offset = existsSync(LOG) ? statSync(LOG).size : 0
setInterval(() => {
  if (!existsSync(LOG)) return
  const size = statSync(LOG).size
  if (size < offset) offset = 0
  if (size === offset) return
  const fd = openSync(LOG, 'r')
  const buf = Buffer.alloc(size - offset)
  readSync(fd, buf, 0, buf.length, offset)
  closeSync(fd)
  offset = size
  process.stdout.write(buf)
}, 500)

// If the server goes away, say so and exit, so the preview shows it as stopped.
setInterval(async () => {
  if (!(await listening(5173))) {
    console.error('The dev server has stopped.')
    process.exit(1)
  }
}, 4000)
