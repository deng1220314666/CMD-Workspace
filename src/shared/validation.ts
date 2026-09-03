import { z } from 'zod'

const terminalId = z.string().uuid()
const profileId = z.string().uuid()
const projectId = z.string().uuid()
const dimensions = {
  cols: z.number().int().min(2).max(500),
  rows: z.number().int().min(1).max(300),
}

export const createTerminalSchema = z.object({
  profileId,
  cwd: z.string().min(1).max(32_767),
  shell: z.enum(['powershell', 'cmd']),
  ...dimensions,
})
export const writeTerminalSchema = z.object({
  terminalId,
  data: z.string().max(65_536),
})
export const resizeTerminalSchema = z.object({ terminalId, ...dimensions })
export const terminalIdSchema = z.object({ terminalId })
export const closeTerminalSchema = z.object({
  terminalId,
  mode: z.enum(['graceful', 'force']),
  expectedPid: z.number().int().positive().nullable(),
})
export const restartTerminalSchema = z.object({
  terminalId,
  expectedPid: z.number().int().positive().nullable(),
})

export const createProfileSchema = z.object({
  projectId,
  displayName: z.string().trim().min(1).max(120),
  workingDirectory: z.string().min(1).max(32_767),
  shell: z.enum(['powershell', 'cmd']),
})
export const renameProfileSchema = z.object({
  profileId,
  displayName: z.string().trim().min(1).max(120),
})
export const reorderProfilesSchema = z.object({
  projectId,
  orderedProfileIds: z.array(profileId).max(100),
})
export const deleteProfileSchema = z.object({ profileId })
export const saveSelectionSchema = z.object({
  activeProjectId: projectId.nullable(),
  activeProfileIds: z.record(projectId, profileId.nullable()),
})
export const updateProjectAnnotationsSchema = z.object({
  projectId,
  remarkName: z.string().trim().max(120).nullable(),
  purpose: z.string().trim().max(500).nullable(),
})

export function validationMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ')
}
