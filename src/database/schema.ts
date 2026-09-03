import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const runState = pgEnum('terminal_run_state', [
  'starting',
  'running',
  'stopping',
  'exited',
  'failed',
  'interrupted',
])

export const restartPolicy = pgEnum('terminal_restart_policy', [
  'never',
  'on-failure',
  'always',
])

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    remarkName: text('remark_name'),
    purpose: text('purpose'),
    displayPath: text('display_path').notNull(),
    normalizedPath: text('normalized_path').notNull(),
    defaultShell: text('default_shell').notNull().default('powershell.exe'),
    environmentRefs: jsonb('environment_refs')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('projects_normalized_path_unique').on(table.normalizedPath),
    index('projects_order_idx').on(table.orderIndex, table.createdAt),
    check('projects_order_nonnegative', sql`${table.orderIndex} >= 0`),
  ],
)

export const terminalProfiles = pgTable(
  'terminal_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    executable: text('executable').notNull().default('powershell.exe'),
    arguments: jsonb('arguments')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    workingDirectory: text('working_directory').notNull(),
    startupCommand: text('startup_command'),
    environmentRefs: jsonb('environment_refs')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    autoStart: boolean('auto_start').notNull().default(false),
    restartPolicy: restartPolicy('restart_policy').notNull().default('never'),
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('terminal_profiles_project_order_unique').on(
      table.projectId,
      table.orderIndex,
    ),
    unique('terminal_profiles_id_project_unique').on(table.id, table.projectId),
    index('terminal_profiles_project_idx').on(table.projectId),
    check('terminal_profiles_order_nonnegative', sql`${table.orderIndex} >= 0`),
  ],
)

export const terminalRuns = pgTable(
  'terminal_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => terminalProfiles.id, { onDelete: 'cascade' }),
    applicationInstanceId: uuid('application_instance_id').notNull(),
    diagnosticPid: integer('diagnostic_pid'),
    state: runState('state').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    exitCode: integer('exit_code'),
    errorSummary: text('error_summary'),
    logPath: text('log_path'),
  },
  (table) => [
    index('terminal_runs_profile_started_idx').on(
      table.profileId,
      table.startedAt,
    ),
    index('terminal_runs_state_idx').on(table.state),
    check(
      'terminal_runs_duration_nonnegative',
      sql`${table.durationMs} is null or ${table.durationMs} >= 0`,
    ),
  ],
)

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => terminalProfiles.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    readiness: jsonb('readiness').$type<Record<string, unknown>>(),
    timeoutMs: integer('timeout_ms').notNull().default(30000),
    retryPolicy: jsonb('retry_policy')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    stopPolicy: jsonb('stop_policy')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('tasks_project_name_unique').on(table.projectId, table.name),
    index('tasks_project_order_idx').on(table.projectId, table.orderIndex),
    check('tasks_timeout_positive', sql`${table.timeoutMs} > 0`),
    check('tasks_order_nonnegative', sql`${table.orderIndex} >= 0`),
    foreignKey({
      columns: [table.profileId, table.projectId],
      foreignColumns: [terminalProfiles.id, terminalProfiles.projectId],
      name: 'tasks_profile_project_ownership_fk',
    }).onDelete('cascade'),
  ],
)

export const taskDependencies = pgTable(
  'task_dependencies',
  {
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    prerequisiteTaskId: uuid('prerequisite_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.prerequisiteTaskId] }),
    index('task_dependencies_prerequisite_idx').on(table.prerequisiteTaskId),
    check(
      'task_dependencies_not_self',
      sql`${table.taskId} <> ${table.prerequisiteTaskId}`,
    ),
  ],
)

export const applicationState = pgTable('application_state', {
  key: text('key').primaryKey(),
  version: integer('version').notNull().default(1),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
