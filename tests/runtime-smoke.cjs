const path = require('node:path')
const pty = require('node-pty')

const shell = path.join(
  process.env.SystemRoot || 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
)
const terminal = pty.spawn(shell, ['-NoLogo', '-NoProfile'], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
  env: process.env,
  useConpty: true,
})

let output = ''
let exited = false
terminal.onData((data) => {
  output += data
  process.stdout.write(data)
})
terminal.onExit(({ exitCode }) => {
  exited = true
  if (exitCode !== 0) fail(`PowerShell exited early with ${exitCode}`)
})

function fail(message) {
  console.error(`\nPTY_SMOKE_FAILED: ${message}`)
  try {
    terminal.kill()
  } catch {
    // The terminal may already have exited while reporting the failure.
  }
  process.exit(1)
}

function waitFor(text, timeout = 12_000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (output.includes(text)) return resolve()
      if (exited) return reject(new Error(`PTY exited before ${text}`))
      if (Date.now() - started > timeout)
        return reject(new Error(`Timed out waiting for ${text}`))
      setTimeout(poll, 30)
    }
    poll()
  })
}

async function run() {
  terminal.resize(120, 40)
  terminal.write(
    'Write-Host "$([char]27)[31mANSI_OK$([char]27)[0m"; Write-Output \'UNICODE_终端\'; Write-Output "SIZE_$($Host.UI.RawUI.WindowSize.Width)x$($Host.UI.RawUI.WindowSize.Height)"\r',
  )
  await waitFor('\x1b[31mANSI_OK')
  await waitFor('UNICODE_终端')
  await waitFor('SIZE_120x40')

  terminal.write('node -i\r')
  await waitFor('Welcome to Node.js')
  terminal.write("console.log('NODE_REPL_OK')\r")
  await waitFor('NODE_REPL_OK')
  output = ''
  terminal.write('.exit\r')
  await waitFor('PS ')

  output = ''
  terminal.write('python\r')
  await waitFor('Python 3.12.10')
  await waitFor('>>>')
  terminal.write("print('PY_REPL_OK')\r")
  await waitFor('PY_REPL_OK')
  output = ''
  terminal.write('raise SystemExit\r')
  await waitFor('PS ')

  output = ''
  terminal.write(
    "while ($true) { Write-Output 'TICK'; Start-Sleep -Milliseconds 100 }\r",
  )
  await waitFor('TICK')
  await new Promise((resolve) => setTimeout(resolve, 350))
  output = ''
  terminal.write('\x03')
  await waitFor('PS ')
  output = ''
  terminal.write("Write-Output 'INTERRUPT_OK'\r")
  await waitFor('INTERRUPT_OK')

  console.log(
    `\nPTY_SMOKE_OK pid=${terminal.pid} bytes=${Buffer.byteLength(output)}`,
  )
  terminal.kill()
  process.exit(0)
}

run().catch((error) => fail(error.message))
