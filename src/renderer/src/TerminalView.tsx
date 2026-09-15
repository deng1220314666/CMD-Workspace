import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { Terminal } from '@xterm/xterm'
import {
  terminalShortcutAction,
  type TerminalShortcutAction,
} from './terminal-shortcuts'

const CURSOR_SETTLE_DELAY_MS = 48

interface TerminalViewProps {
  terminalId: string
  active: boolean
  onError: (message: string) => void
  onShortcut: (action: TerminalShortcutAction) => void
}

export interface TerminalViewHandle {
  focus(): void
  copy(): Promise<boolean>
  paste(): Promise<void>
  clear(): void
  findNext(query: string): boolean
  findPrevious(query: string): boolean
  clearSearch(): void
}

export const TerminalView = forwardRef<TerminalViewHandle, TerminalViewProps>(
  function TerminalView({ terminalId, active, onError, onShortcut }, ref) {
    const hostRef = useRef<HTMLDivElement>(null)
    const terminalRef = useRef<Terminal | null>(null)
    const fitRef = useRef<FitAddon | null>(null)
    const activeRef = useRef(active)
    const followOutputRef = useRef(true)
    const searchRef = useRef<SearchAddon | null>(null)
    const onShortcutRef = useRef(onShortcut)
    const feedbackTimerRef = useRef<number | null>(null)
    const [hasSelection, setHasSelection] = useState(false)
    const [copyFeedback, setCopyFeedback] = useState<'idle' | 'copied'>('idle')

    useEffect(() => {
      onShortcutRef.current = onShortcut
    }, [onShortcut])

    const activateTerminal = useCallback(() => {
      const terminal = terminalRef.current
      if (!terminal) return
      followOutputRef.current = true
      fitRef.current?.fit()
      terminal.scrollToBottom()
      terminal.refresh(0, terminal.rows - 1)
      terminal.focus()

      window.requestAnimationFrame(() => {
        if (!activeRef.current || terminalRef.current !== terminal) return
        fitRef.current?.fit()
        terminal.scrollToBottom()
        terminal.refresh(0, terminal.rows - 1)
        terminal.focus()
      })
    }, [])

    const setCompositionActive = useCallback((composing: boolean) => {
      hostRef.current?.classList.toggle('ime-composing', composing)
    }, [])

    useLayoutEffect(() => {
      activeRef.current = active
      if (!active) {
        setCompositionActive(false)
        terminalRef.current?.blur()
        return
      }
      const frame = window.requestAnimationFrame(activateTerminal)
      return () => window.cancelAnimationFrame(frame)
    }, [activateTerminal, active, setCompositionActive])

    const copySelection = useCallback(async (): Promise<boolean> => {
      const selection = terminalRef.current?.getSelection() ?? ''
      if (!selection) return false
      try {
        await window.cmdWorkspace.clipboard.writeText(selection)
        setCopyFeedback('copied')
        terminalRef.current?.focus()
        if (feedbackTimerRef.current !== null)
          window.clearTimeout(feedbackTimerRef.current)
        feedbackTimerRef.current = window.setTimeout(
          () => setCopyFeedback('idle'),
          1400,
        )
        return true
      } catch (error) {
        onError(
          `Copy failed: ${error instanceof Error ? error.message : String(error)}`,
        )
        return false
      }
    }, [onError])

    const pasteClipboard = useCallback(async () => {
      try {
        const text = await window.cmdWorkspace.clipboard.readText()
        if (text) terminalRef.current?.paste(text)
        terminalRef.current?.focus()
      } catch (error) {
        onError(
          `Paste failed: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }, [onError])

    useImperativeHandle(
      ref,
      () => ({
        focus: () => terminalRef.current?.focus(),
        copy: copySelection,
        paste: pasteClipboard,
        clear: () => {
          terminalRef.current?.clear()
          terminalRef.current?.focus()
        },
        findNext: (query) => {
          if (query) followOutputRef.current = false
          return Boolean(
            query &&
              searchRef.current?.findNext(query, {
                incremental: true,
                decorations: {
                  matchBackground: '#5b461f',
                  matchOverviewRuler: '#f0ad3d',
                  activeMatchBackground: '#a46616',
                  activeMatchColorOverviewRuler: '#ffffff',
                },
              }),
          )
        },
        findPrevious: (query) => {
          if (query) followOutputRef.current = false
          return Boolean(query && searchRef.current?.findPrevious(query))
        },
        clearSearch: () => searchRef.current?.clearDecorations(),
      }),
      [copySelection, pasteClipboard],
    )

    useEffect(() => {
      const host = hostRef.current
      if (!host) return
      const terminal = new Terminal({
        cursorBlink: false,
        cursorStyle: 'bar',
        cursorInactiveStyle: 'none',
        fontFamily: 'Cascadia Mono, Consolas, monospace',
        fontSize: 14,
        lineHeight: 1.25,
        scrollback: 5000,
        theme: {
          background: '#0b1118',
          foreground: '#d7e0e7',
          cursor: '#e7a93b',
          selectionBackground: '#31506b88',
          black: '#15212d',
          brightBlack: '#536675',
          red: '#ef6b73',
          green: '#7ec699',
          yellow: '#e7bb66',
          blue: '#72a7d8',
          magenta: '#b19cd9',
          cyan: '#63c5c8',
          white: '#d7e0e7',
        },
      })
      const fitAddon = new FitAddon()
      const searchAddon = new SearchAddon()
      terminal.loadAddon(fitAddon)
      terminal.loadAddon(searchAddon)
      terminal.open(host)
      terminalRef.current = terminal
      fitRef.current = fitAddon
      searchRef.current = searchAddon
      if (activeRef.current) requestAnimationFrame(activateTerminal)

      const textarea = terminal.textarea
      const onCompositionStart = () => setCompositionActive(true)
      const onCompositionEnd = () => setCompositionActive(false)
      const onTextareaBlur = () => setCompositionActive(false)
      textarea?.addEventListener('compositionstart', onCompositionStart)
      textarea?.addEventListener('compositionend', onCompositionEnd)
      textarea?.addEventListener('blur', onTextareaBlur)

      terminal.attachCustomKeyEventHandler((event) => {
        const action = terminalShortcutAction(event, terminal.hasSelection())
        if (!action) return true
        if (event.type === 'keydown') {
          if (action === 'copy') void copySelection()
          else if (action === 'paste') void pasteClipboard()
          else if (action === 'clear') terminal.clear()
          else onShortcutRef.current(action)
        }
        return false
      })
      const selection = terminal.onSelectionChange(() => {
        setHasSelection(terminal.hasSelection())
      })

      let lastSequence = 0
      let snapshotLoaded = false
      const pendingEvents: Array<{ sequence: number; data: string }> = []
      let queuedOutput = ''
      let outputFrame: number | null = null
      let cursorSettleTimer: number | null = null
      let writesInFlight = 0
      let fitting = false
      let disposed = false

      const followOutput = () => {
        if (!disposed && activeRef.current && followOutputRef.current)
          terminal.scrollToBottom()
      }
      const fitTerminal = () => {
        if (disposed || host.clientWidth === 0 || host.clientHeight === 0)
          return
        fitting = true
        try {
          fitAddon.fit()
          followOutput()
        } finally {
          fitting = false
        }
      }
      const scroll = terminal.onScroll(() => {
        // Parsing output and reflow can move the viewport without user intent.
        if (
          followOutputRef.current ||
          fitting ||
          writesInFlight > 0 ||
          queuedOutput.length > 0
        )
          return
        followOutputRef.current =
          terminal.buffer.active.viewportY >= terminal.buffer.active.baseY
      })
      const onWheel = (event: WheelEvent) => {
        if (event.deltaY < 0) followOutputRef.current = false
        else if (event.deltaY > 0)
          requestAnimationFrame(() => {
            if (!disposed && activeRef.current)
              followOutputRef.current =
                terminal.buffer.active.viewportY >= terminal.buffer.active.baseY
          })
      }
      const onPointerDown = (event: PointerEvent) => {
        const viewport = host.querySelector<HTMLElement>('.xterm-viewport')
        if (!viewport || event.target !== viewport) return
        const bounds = viewport.getBoundingClientRect()
        if (event.clientX >= bounds.left + viewport.clientWidth)
          followOutputRef.current = false
      }
      const onHistoryKey = (event: KeyboardEvent) => {
        if (event.shiftKey && event.key === 'PageUp')
          followOutputRef.current = false
      }
      host.addEventListener('wheel', onWheel, { passive: true })
      host.addEventListener('pointerdown', onPointerDown)
      host.addEventListener('keydown', onHistoryKey, true)

      const revealSettledCursor = () => {
        if (cursorSettleTimer !== null) window.clearTimeout(cursorSettleTimer)
        cursorSettleTimer = window.setTimeout(() => {
          cursorSettleTimer = null
          host.classList.remove('output-updating')
        }, CURSOR_SETTLE_DELAY_MS)
      }
      const flushOutput = () => {
        outputFrame = null
        const data = queuedOutput
        queuedOutput = ''
        if (!data) return
        writesInFlight += 1
        terminal.write(data, () => {
          if (disposed) return
          followOutput()
          writesInFlight -= 1
          if (
            writesInFlight === 0 &&
            outputFrame === null &&
            queuedOutput.length === 0
          )
            revealSettledCursor()
        })
      }
      const enqueueOutput = (data: string) => {
        if (!data) return
        queuedOutput += data
        host.classList.add('output-updating')
        if (cursorSettleTimer !== null) {
          window.clearTimeout(cursorSettleTimer)
          cursorSettleTimer = null
        }
        if (outputFrame === null)
          outputFrame = window.requestAnimationFrame(flushOutput)
      }

      const unsubscribe = window.cmdWorkspace.terminal.onData((event) => {
        if (event.terminalId !== terminalId) return
        if (!snapshotLoaded) {
          pendingEvents.push(event)
        } else if (event.sequence > lastSequence) {
          lastSequence = event.sequence
          enqueueOutput(event.data)
        }
      })
      void window.cmdWorkspace.terminal
        .snapshot({ terminalId })
        .then((snapshot) => {
          if (disposed) return
          enqueueOutput(snapshot.output)
          lastSequence = snapshot.lastSequence
          snapshotLoaded = true
          for (const event of pendingEvents) {
            if (event.sequence > lastSequence) {
              lastSequence = event.sequence
              enqueueOutput(event.data)
            }
          }
          requestAnimationFrame(fitTerminal)
        })
        .catch((error: unknown) =>
          onError(error instanceof Error ? error.message : String(error)),
        )
      const input = terminal.onData((data) => {
        followOutputRef.current = true
        followOutput()
        void window.cmdWorkspace.terminal
          .write({ terminalId, data })
          .catch((error: unknown) =>
            onError(error instanceof Error ? error.message : String(error)),
          )
      })
      const observer = new ResizeObserver(() => {
        fitTerminal()
        void window.cmdWorkspace.terminal
          .resize({ terminalId, cols: terminal.cols, rows: terminal.rows })
          .catch(() => undefined)
      })
      observer.observe(host)
      return () => {
        disposed = true
        if (feedbackTimerRef.current !== null)
          window.clearTimeout(feedbackTimerRef.current)
        unsubscribe()
        input.dispose()
        selection.dispose()
        scroll.dispose()
        host.removeEventListener('wheel', onWheel)
        host.removeEventListener('pointerdown', onPointerDown)
        host.removeEventListener('keydown', onHistoryKey, true)
        observer.disconnect()
        if (outputFrame !== null) window.cancelAnimationFrame(outputFrame)
        if (cursorSettleTimer !== null) window.clearTimeout(cursorSettleTimer)
        host.classList.remove('output-updating')
        textarea?.removeEventListener('compositionstart', onCompositionStart)
        textarea?.removeEventListener('compositionend', onCompositionEnd)
        textarea?.removeEventListener('blur', onTextareaBlur)
        setCompositionActive(false)
        terminalRef.current = null
        fitRef.current = null
        searchRef.current = null
        terminal.dispose()
      }
    }, [
      activateTerminal,
      copySelection,
      onError,
      pasteClipboard,
      setCompositionActive,
      terminalId,
    ])

    return (
      <div
        className="terminal-frame"
        onContextMenu={(event) => {
          event.preventDefault()
          if (terminalRef.current?.hasSelection()) void copySelection()
          else void pasteClipboard()
        }}
      >
        <div
          className="terminal-host"
          ref={hostRef}
          aria-label="Interactive terminal"
        />
        <button
          className={`copy-selection-button ${copyFeedback === 'copied' ? 'copied' : ''}`}
          type="button"
          disabled={!hasSelection}
          title={
            hasSelection
              ? 'Copy selected text (Ctrl+Shift+C)'
              : 'Select terminal text to copy'
          }
          onClick={() => void copySelection()}
        >
          <span aria-hidden="true">
            {copyFeedback === 'copied' ? '✓' : '▣'}
          </span>
          {copyFeedback === 'copied' ? 'Copied' : 'Copy'}
        </button>
      </div>
    )
  },
)
