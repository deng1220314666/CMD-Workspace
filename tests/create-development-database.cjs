const path = require('node:path')
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') })
const { Client } = require('pg')

async function run() {
  if (!process.env.DATABASE_URL)
    throw new Error('DATABASE_URL is not configured')
  const target = new URL(process.env.DATABASE_URL)
  if (target.pathname !== '/cmd_workspace')
    throw new Error('Refusing to create any database except cmd_workspace')
  target.pathname = '/postgres'
  const client = new Client({ connectionString: target.toString() })
  await client.connect()
  const existing = await client.query(
    "select 1 from pg_database where datname = 'cmd_workspace'",
  )
  if (!existing.rowCount) await client.query('create database cmd_workspace')
  await client.end()
  console.log(
    existing.rowCount
      ? 'DATABASE_CREATE_OK existing=true'
      : 'DATABASE_CREATE_OK existing=false created=cmd_workspace',
  )
}

run().catch((error) => {
  console.error('DATABASE_CREATE_FAILED', error)
  process.exit(1)
})
