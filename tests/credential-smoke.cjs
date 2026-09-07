const path = require('node:path')
const { readFile, rm } = require('node:fs/promises')
const { randomUUID } = require('node:crypto')
const { app, safeStorage } = require('electron')

const directory = path.resolve(
  process.cwd(),
  '.tools',
  `credential-smoke-${randomUUID()}`,
)
app.setPath('userData', directory)

app.whenReady().then(async () => {
  let exitCode = 0
  try {
    if (!safeStorage.isEncryptionAvailable())
      throw new Error('safeStorage encryption is unavailable')
    const {
      CredentialService,
    } = require('../dist/main/ai/credential-service.js')
    const file = path.join(directory, 'credentials', 'ai-credentials.json')
    const service = new CredentialService(file)
    const id = randomUUID()
    const fakeSecret = 'FAKE_CREDENTIAL_SMOKE_SECRET'
    await service.set(id, fakeSecret)
    if ((await service.status(id)) !== 'configured')
      throw new Error('credential presence was not retained')
    if ((await service.resolve(id)) !== fakeSecret)
      throw new Error('credential did not decrypt after a fresh read')
    if ((await readFile(file, 'utf8')).includes(fakeSecret))
      throw new Error('credential store contains plaintext')
    await service.delete(id)
    if ((await service.status(id)) !== 'missing')
      throw new Error('credential was not deleted')
    console.log('CREDENTIAL_SMOKE_OK encrypted=true readBack=true deleted=true')
  } catch (error) {
    console.error('CREDENTIAL_SMOKE_FAILED', error)
    exitCode = 1
  } finally {
    await rm(directory, { recursive: true, force: true })
    app.exit(exitCode)
  }
})
