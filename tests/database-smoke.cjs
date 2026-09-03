const path = require('node:path')
const { randomUUID } = require('node:crypto')
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') })
const { Pool } = require('pg')
const { PersistenceRepository } = require('../dist/database/repository.js')

async function run() {
  if (!process.env.DATABASE_URL)
    throw new Error('DATABASE_URL is not configured')
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const before = await pool.query(
    "select count(*)::integer as count from information_schema.tables where table_schema = 'public' and table_name = 'projects'",
  )
  await pool.end()

  let repository = await PersistenceRepository.connect(
    process.env.DATABASE_URL,
    migrationsFolder,
  )
  await repository.close()
  repository = await PersistenceRepository.connect(
    process.env.DATABASE_URL,
    migrationsFolder,
  )

  const cleanupPool = new Pool({ connectionString: process.env.DATABASE_URL })
  await cleanupPool.query(
    "delete from projects where name like 'M3 verify %' or name like 'Foreign project %'",
  )
  await cleanupPool.query(
    "delete from application_state where key = 'workspace-selection' and not exists (select 1 from projects where id::text = application_state.value->>'activeProjectId')",
  )
  await cleanupPool.end()

  const suffix = randomUUID()
  const normalizedPath = `c:\\cmd-workspace-m3-verify\\${suffix}`
  const project = await repository.importProject({
    name: `M3 verify ${suffix}`,
    displayPath: normalizedPath,
    normalizedPath,
  })
  const duplicate = await repository.importProject({
    name: 'Duplicate must not be inserted',
    displayPath: normalizedPath.toUpperCase(),
    normalizedPath,
  })
  if (duplicate.projectId !== project.projectId)
    throw new Error('Normalized project paths were not deduplicated')
  await repository.updateProjectAnnotations(project.projectId, {
    remarkName: 'M3 verification project',
    purpose: 'Verifies persisted project annotations',
  })

  const first = await repository.createProfile({
    projectId: project.projectId,
    displayName: 'First terminal',
    workingDirectory: normalizedPath,
  })
  const second = await repository.createProfile({
    projectId: project.projectId,
    displayName: 'Second terminal',
    workingDirectory: normalizedPath,
  })
  await repository.renameProfile(second.profileId, 'Renamed terminal')
  await repository.reorderProfiles(project.projectId, [
    second.profileId,
    first.profileId,
  ])
  await repository.saveSelection({
    activeProjectId: project.projectId,
    activeProfileIds: { [project.projectId]: second.profileId },
  })
  const runId = await repository.startRun({
    profileId: first.profileId,
    applicationInstanceId: randomUUID(),
    diagnosticPid: 424242,
  })
  await repository.close()

  repository = await PersistenceRepository.connect(
    process.env.DATABASE_URL,
    migrationsFolder,
  )
  const restored = await repository.loadWorkspace()
  const restoredProject = restored.projects.find(
    (candidate) => candidate.projectId === project.projectId,
  )
  if (
    !restoredProject ||
    restoredProject.remarkName !== 'M3 verification project' ||
    restoredProject.purpose !== 'Verifies persisted project annotations' ||
    restoredProject.profiles[0]?.profileId !== second.profileId ||
    restored.selection.activeProfileIds[project.projectId] !== second.profileId
  )
    throw new Error(
      'Persisted profile ordering or selection did not survive reconnect',
    )
  const interrupted = await repository.reconcileStaleRuns()
  if (interrupted < 1) throw new Error('Stale run was not reconciled')

  const verificationPool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })
  let uniqueConstraint = false
  try {
    await verificationPool.query(
      'insert into projects (name, display_path, normalized_path, order_index) values ($1, $2, $3, $4)',
      ['Duplicate', normalizedPath, normalizedPath, 99999],
    )
  } catch (error) {
    uniqueConstraint = error.code === '23505'
  }
  if (!uniqueConstraint)
    throw new Error('Database accepted a duplicate normalized project path')
  const run = await verificationPool.query(
    'select state, diagnostic_pid, finished_at, duration_ms from terminal_runs where id = $1',
    [runId],
  )
  if (
    run.rows[0]?.state !== 'interrupted' ||
    run.rows[0]?.diagnostic_pid !== 424242 ||
    !run.rows[0]?.finished_at ||
    run.rows[0]?.duration_ms < 0
  )
    throw new Error('Interrupted run summary is incomplete')
  const outputColumns = await verificationPool.query(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'terminal_runs' and column_name in ('output', 'buffer', 'terminal_output')",
  )
  if (outputColumns.rowCount !== 0)
    throw new Error('Terminal output must not be stored in PostgreSQL')

  const taskId = randomUUID()
  await verificationPool.query(
    'insert into tasks (id, project_id, profile_id, name) values ($1, $2, $3, $4)',
    [taskId, project.projectId, first.profileId, `Task ${suffix}`],
  )
  let selfConstraint = false
  try {
    await verificationPool.query(
      'insert into task_dependencies (task_id, prerequisite_task_id) values ($1, $1)',
      [taskId],
    )
  } catch (error) {
    selfConstraint = error.code === '23514'
  }
  if (!selfConstraint) throw new Error('Database accepted a self dependency')

  const foreignProject = await repository.importProject({
    name: `Foreign project ${suffix}`,
    displayPath: `${normalizedPath}-foreign`,
    normalizedPath: `${normalizedPath}-foreign`,
  })
  let ownershipConstraint = false
  try {
    await verificationPool.query(
      'insert into tasks (project_id, profile_id, name) values ($1, $2, $3)',
      [
        foreignProject.projectId,
        first.profileId,
        `Invalid ownership ${suffix}`,
      ],
    )
  } catch (error) {
    ownershipConstraint = error.code === '23503'
  }
  if (!ownershipConstraint)
    throw new Error('Database accepted a profile owned by another project')
  await verificationPool.query('delete from projects where id = $1', [
    foreignProject.projectId,
  ])

  let actionableConstraint = false
  try {
    await repository.createProfile({
      projectId: randomUUID(),
      displayName: 'Invalid owner',
      workingDirectory: normalizedPath,
    })
  } catch (error) {
    actionableConstraint = String(error).includes(
      'The owning project no longer exists',
    )
  }
  if (!actionableConstraint)
    throw new Error('Foreign-key failure was not reported actionably')

  await verificationPool.query('delete from projects where id = $1', [
    project.projectId,
  ])
  const cascaded = await verificationPool.query(
    'select (select count(*) from terminal_profiles where project_id = $1)::integer as profiles, (select count(*) from tasks where project_id = $1)::integer as tasks, (select count(*) from terminal_runs where profile_id in ($2, $3))::integer as runs',
    [project.projectId, first.profileId, second.profileId],
  )
  if (
    cascaded.rows[0].profiles !== 0 ||
    cascaded.rows[0].tasks !== 0 ||
    cascaded.rows[0].runs !== 0
  )
    throw new Error('Project ownership cascade did not remove child records')
  await verificationPool.query(
    "delete from application_state where key = 'workspace-selection' and value->>'activeProjectId' = $1",
    [project.projectId],
  )
  await verificationPool.end()
  await repository.close()
  console.log(
    `DATABASE_SMOKE_OK emptyBefore=${before.rows[0].count === 0} repeatMigration=true restored=true annotations=true interrupted=${interrupted} noOutputColumns=true uniquePath=true ownership=true actionableErrors=true constraints=true cascades=true`,
  )
}

run().catch((error) => {
  console.error('DATABASE_SMOKE_FAILED', error)
  process.exit(1)
})
