import { describe, expect, it } from 'vitest'
import { BoundedTerminalBuffer } from '../src/main/bounded-buffer'

describe('BoundedTerminalBuffer', () => {
  it('keeps recent output within the byte limit', () => {
    const buffer = new BoundedTerminalBuffer(6)
    buffer.append('abc')
    buffer.append('def')
    buffer.append('ghi')
    expect(buffer.toString()).toBe('defghi')
    expect(buffer.size).toBeLessThanOrEqual(6)
  })

  it('bounds a single large chunk', () => {
    const buffer = new BoundedTerminalBuffer(4)
    buffer.append('123456')
    expect(buffer.toString()).toBe('3456')
  })
})
