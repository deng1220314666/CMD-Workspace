export class BoundedTerminalBuffer {
  private chunks: string[] = []
  private byteLength = 0

  constructor(private readonly maxBytes: number) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1)
      throw new Error('maxBytes must be positive')
  }

  append(data: string): void {
    if (!data) return
    this.chunks.push(data)
    this.byteLength += Buffer.byteLength(data)
    while (this.byteLength > this.maxBytes && this.chunks.length > 1) {
      const removed = this.chunks.shift()
      if (removed) this.byteLength -= Buffer.byteLength(removed)
    }
    if (this.byteLength > this.maxBytes) {
      const only = Buffer.from(this.chunks[0] ?? '')
      this.chunks = [only.subarray(only.length - this.maxBytes).toString()]
      this.byteLength = Buffer.byteLength(this.chunks[0])
    }
  }

  clear(): void {
    this.chunks = []
    this.byteLength = 0
  }

  toString(): string {
    return this.chunks.join('')
  }

  get size(): number {
    return this.byteLength
  }
}
