---
name: design-cmd-workspace-ui
description: Design, implement, review, or optimize the CMD-Workspace desktop UI. Use for project navigation, terminal tabs, terminal layouts, command palettes, settings, dialogs, themes, interaction states, and desktop usability.
---

# CMD-Workspace UI

Build a professional desktop terminal workspace inspired by modern IDEs.

Before making UI changes, read:

- `references/design-system.md`

## Preferred stack

- shadcn/ui for reusable UI components
- Tailwind CSS for styling and design tokens
- Lucide React for icons
- react-resizable-panels for resizable panes
- xterm.js for terminal rendering
- Zustand for workspace UI state

Do not replace xterm.js with a generic UI component.

## Workflow

Before modifying code:

1. Inspect the existing components and styles.
2. Identify reusable components and design tokens.
3. Check how xterm.js instances are created and retained.
4. Identify empty, loading, running, exited and error states.
5. Present a concise implementation plan.

During implementation:

- Preserve existing PTY and database behavior.
- Keep UI changes separate from backend changes.
- Prefer existing dependencies and components.
- Make the smallest coherent change.
- Do not recreate terminal instances during project or tab switching.
- Do not introduce placeholder data.
- Do not redesign unrelated pages.

After implementation:

1. Run lint.
2. Run type checking.
3. Run relevant tests.
4. Verify terminal creation, switching, resizing and closing.
5. Verify switching projects preserves running terminals.
6. Verify the layout at 1440×900 and 1024×768.
7. Review `git diff` for unrelated changes.

## Visual direction

- Desktop-first and dark-first.
- Compact, professional and information-dense.
- Neutral surfaces with one accent color.
- Use semantic colors for process status.
- Prefer separators over excessive cards.
- Avoid gradients, glassmorphism and oversized headings.
- Avoid excessive rounded containers and animations.

## Component rules

Use shadcn/ui for:

- Buttons
- Tooltips
- Dialogs
- Context menus
- Dropdown menus
- Inputs
- Selects
- Command palette
- Scroll areas
- Alert dialogs

Use custom application components for:

- Project sidebar
- Terminal tab strip
- Terminal workspace
- Split terminal layout
- Window title bar
- Process status indicator

The xterm.js container must remain under application lifecycle control.

## Required states

Relevant features must handle:

- Empty workspace
- Project loading
- Missing project directory
- Terminal starting
- Terminal running
- Terminal exited
- Terminal failed
- PTY disconnected
- Database unavailable
- Destructive-action confirmation
