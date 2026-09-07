import { describe, expect, it } from 'vitest'
import {
  createProfileSchema,
  createTerminalSchema,
  deleteProjectSchema,
  reorderProfilesSchema,
  resizeTerminalSchema,
  saveSelectionSchema,
  updateProjectAnnotationsSchema,
  writeTerminalSchema,
  saveAIProviderSchema,
} from '../src/shared/validation'

describe('terminal IPC validation', () => {
  it('rejects invalid dimensions and terminal IDs', () => {
    expect(
      resizeTerminalSchema.safeParse({ terminalId: 'nope', cols: 0, rows: 999 })
        .success,
    ).toBe(false)
  })

  it('caps renderer writes', () => {
    expect(
      writeTerminalSchema.safeParse({
        terminalId: crypto.randomUUID(),
        data: 'x'.repeat(65_537),
      }).success,
    ).toBe(false)
  })

  it('accepts only supported shell identifiers', () => {
    const profileId = crypto.randomUUID()
    expect(
      createTerminalSchema.safeParse({
        profileId,
        cwd: 'C:\\work',
        shell: 'cmd',
        cols: 80,
        rows: 24,
      }).success,
    ).toBe(true)
    expect(
      createTerminalSchema.safeParse({
        profileId,
        cwd: 'C:\\work',
        shell: 'cmd.exe /c untrusted',
        cols: 80,
        rows: 24,
      }).success,
    ).toBe(false)
    expect(
      createProfileSchema.safeParse({
        projectId: crypto.randomUUID(),
        displayName: 'Command Prompt',
        workingDirectory: 'C:\\work',
        shell: 'cmd',
      }).success,
    ).toBe(true)
  })

  it('validates persisted profile ownership and selection IDs', () => {
    expect(
      reorderProfilesSchema.safeParse({
        projectId: crypto.randomUUID(),
        orderedProfileIds: [crypto.randomUUID(), crypto.randomUUID()],
      }).success,
    ).toBe(true)
    expect(
      saveSelectionSchema.safeParse({
        activeProjectId: 'not-a-uuid',
        activeProfileIds: {},
      }).success,
    ).toBe(false)
  })

  it('requires a project UUID before removal', () => {
    expect(
      deleteProjectSchema.safeParse({ projectId: crypto.randomUUID() }).success,
    ).toBe(true)
    expect(
      deleteProjectSchema.safeParse({ projectId: 'project-a' }).success,
    ).toBe(false)
  })

  it('bounds project annotations', () => {
    expect(
      updateProjectAnnotationsSchema.safeParse({
        projectId: crypto.randomUUID(),
        remarkName: 'Checkout API',
        purpose: 'Handles customer payment flows',
      }).success,
    ).toBe(true)
    expect(
      updateProjectAnnotationsSchema.safeParse({
        projectId: crypto.randomUUID(),
        remarkName: 'x'.repeat(121),
        purpose: null,
      }).success,
    ).toBe(false)
  })

  it('validates bounded AI provider settings', () => {
    expect(
      saveAIProviderSchema.safeParse({
        name: 'Local Ollama',
        type: 'openai-compatible',
        baseUrl: 'http://localhost:11434/v1',
        model: 'local-model',
        timeoutMs: 15_000,
        apiKey: 'FAKE_TEST_KEY',
      }).success,
    ).toBe(true)
    expect(
      saveAIProviderSchema.safeParse({
        name: 'Bad timeout',
        type: 'openai',
        model: 'model',
        timeoutMs: 0,
      }).success,
    ).toBe(false)
  })
})
