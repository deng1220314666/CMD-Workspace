const { TerminalManager } = require('../dist/main/terminal-manager.js')

const data = []
const statuses = []
const manager = new TerminalManager({
  onData: (event) => data.push(event),
  onStatus: (event) => statuses.push(event),
  maxBufferBytes: 4_096,
})

function waitFor(predicate, label, timeout = 10_000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const poll = () => {
      const value = predicate()
      if (value) return resolve(value)
      if (Date.now() - started > timeout)
        return reject(new Error(`Timed out waiting for ${label}`))
      setTimeout(poll, 30)
    }
    poll()
  })
}

async function run() {
  const first = await manager.create({
    cwd: process.cwd(),
    cols: 90,
    rows: 28,
    shell: 'powershell',
  })
  if (first.status !== 'running' || !first.pid)
    throw new Error('Manager did not start a live terminal')
  const siblings = await Promise.all([
    manager.create({
      cwd: process.cwd(),
      cols: 90,
      rows: 28,
      shell: 'cmd',
    }),
    ...Array.from({ length: 2 }, () =>
      manager.create({
        cwd: process.cwd(),
        cols: 90,
        rows: 28,
        shell: 'powershell',
      }),
    ),
  ])
  const sibling = siblings[0]
  if (sibling.shell !== 'cmd')
    throw new Error('Manager did not retain the selected shell')
  manager.write(sibling.terminalId, 'echo CMD_SHELL_OK\r')
  await waitFor(
    () => data.some((event) => event.data.includes('CMD_SHELL_OK')),
    'Command Prompt output',
  )
  const allTerminals = [first, ...siblings]
  const stablePids = new Map(
    allTerminals.map((terminal) => [terminal.terminalId, terminal.pid]),
  )
  for (let switchCount = 0; switchCount < 25; switchCount += 1) {
    const selected = allTerminals[switchCount % allTerminals.length]
    const snapshot = manager.snapshot(selected.terminalId)
    if (snapshot.pid !== stablePids.get(selected.terminalId))
      throw new Error('Snapshot attachment changed a terminal PID')
  }

  manager.write(first.terminalId, "Write-Output 'MANAGER_OUTPUT_OK'\r")
  await waitFor(
    () => data.some((event) => event.data.includes('MANAGER_OUTPUT_OK')),
    'terminal output',
  )
  manager.write(first.terminalId, 'exit\r')
  await waitFor(
    () => statuses.find((event) => event.status === 'exited'),
    'clean exit',
  )

  const restarted = await manager.restart(first.terminalId, null)
  if (restarted.terminalId !== first.terminalId || restarted.pid === first.pid)
    throw new Error('Restart did not preserve runtime ID with a new PID')
  manager.resize(first.terminalId, 110, 36)
  manager.write(first.terminalId, 'exit 7\r')
  await waitFor(
    () =>
      statuses.find(
        (event) => event.status === 'failed' && event.exitCode === 7,
      ),
    'failed exit state',
  )

  const snapshot = manager.snapshot(first.terminalId)
  if (manager.snapshot(sibling.terminalId).pid !== sibling.pid)
    throw new Error('Restarting one terminal changed its sibling PID')
  await manager.close(sibling.terminalId, 'graceful', sibling.pid)
  try {
    manager.snapshot(sibling.terminalId)
    throw new Error('Gracefully closed terminal remained registered')
  } catch (error) {
    if (!String(error).includes('Terminal does not exist')) throw error
  }
  const forceTarget = siblings[1]
  try {
    await manager.close(forceTarget.terminalId, 'force', forceTarget.pid + 1)
    throw new Error('Stale PID confirmation unexpectedly closed a terminal')
  } catch (error) {
    if (!String(error).includes('Terminal PID changed')) throw error
  }
  if (manager.snapshot(forceTarget.terminalId).pid !== forceTarget.pid)
    throw new Error('Rejected close changed the terminal PID')
  for (const terminal of siblings.slice(1))
    await manager.close(terminal.terminalId, 'force', terminal.pid)
  console.log(
    `TERMINAL_MANAGER_SMOKE_OK id=${snapshot.terminalId} status=${snapshot.status} exit=${snapshot.exitCode}`,
  )
  manager.dispose()
  process.exit(0)
}

run().catch((error) => {
  console.error('TERMINAL_MANAGER_SMOKE_FAILED', error)
  manager.dispose()
  process.exit(1)
})
