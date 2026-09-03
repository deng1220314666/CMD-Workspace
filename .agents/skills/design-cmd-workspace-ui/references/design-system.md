# CMD-Workspace Design System

## Layout

- Minimum window size: 1024×768
- Default sidebar width: 240px
- Sidebar range: 180px–420px
- Terminal tab height: 36px
- Status bar height: 24px
- Pane dimensions should be resizable and persisted

## Spacing

Use a 4px base spacing system:

- 4px: small gaps
- 8px: compact padding
- 12px: row padding
- 16px: section spacing
- 24px: major structural spacing

## Radius

- Controls: 4px
- Menus and dialogs: 6px
- Avoid large card radii

## Typography

Use system UI fonts for application chrome.

Use monospace fonts only for terminal content, commands, paths, environment
variables and process identifiers.

Terminal font stack:

`Cascadia Code, JetBrains Mono, Consolas, monospace`

## Terminal lifecycle

- Keep terminal instances in a stable registry.
- Do not destroy inactive terminal instances.
- Hide inactive terminal containers instead of recreating them.
- Project switching must not terminate PTY processes.
- Layout resizing must call the xterm fit operation.
- UI rerenders must not recreate PTY processes.

## Project sidebar

Each project should support:

- Project name
- Path tooltip
- Running terminal count
- Active state
- Error state
- Context menu
- Rename
- Remove confirmation

Long project names must truncate safely.

## Terminal tabs

Each terminal tab should display:

- Terminal name
- Shell icon
- Running, exited or error status
- Close action
- Context menu

Closing a terminal with a running foreground process requires confirmation.

## Accessibility

- Icon-only buttons require labels and tooltips.
- Keyboard focus must be visible.
- Menus and dialogs must support keyboard navigation.
- Status must not rely only on color.
