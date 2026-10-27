// SessionStart hook: make sure `npm run dev` is running whenever a Claude session opens here.
// The server is started detached (its own process group), so it keeps running after the
// session ends. Stop it with `npm run dev:stop`.
import { spawn } from 'node:child_process'
import { openSync } from 'node:fs'
import net from 'node:net'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const LOG = '.claude/dev-server.log'
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

function reply(message) {
  process.stdout.write(
    JSON.stringify({
      systemMessage: message,
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: message },
    }),
  )
}

if (await listening(5173)) {
  reply(`Vision FA dev server is already running at ${URL_}`)
} else {
  const out = openSync(`${ROOT}/${LOG}`, 'a')
  const env = { ...process.env }
  delete env.NODE_ENV // dev must not inherit a production flag
  spawn('npm', ['run', 'dev'], { cwd: ROOT, env, detached: true, stdio: ['ignore', out, out] }).unref()

  let up = false
  for (let i = 0; i < 40 && !up; i++) {
    await sleep(500)
    up = await listening(5173)
  }
  reply(
    up
      ? `Started the Vision FA dev server at ${URL_} (stop it with npm run dev:stop; log in ${LOG})`
      : `Tried to start the Vision FA dev server but ${URL_} is not answering yet. Check ${LOG}.`,
  )
}
