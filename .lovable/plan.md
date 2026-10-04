# Plan: Desktop workspace optimization

## Goal
Make Writer Creator comfortable on laptop, 1080p, and 1440p screens without changing editor, canvas, persistence, or version-history behavior.

## Changes

### 1. Widescreen containers
- Replace the phone-width cap around Notebooks, Suggestions, Settings, and Announcements with a fluid desktop container that grows across large screens while retaining sensible side gutters.
- Keep compact content readable by giving each section its own appropriate maximum width rather than stretching every form edge-to-edge.
- Give the full-screen notebook editor a centered, wider writing column on desktop, while preserving the current full-height mobile layout.
- Keep drawing and tactical canvases full-viewport and prevent document-level scrolling or clipping.

### 2. Desktop panels
- Size Quick Scratchpad and Version History with responsive `clamp()`-style widths for laptop and 1440p displays.
- On desktop, constrain panel height/overflow and comparison columns so controls and text remain usable without horizontal collisions.
- Keep mobile drawers full-width and preserve all current open/close, comparison, restore, and local-save behavior.

### 3. Keyboard shortcuts
- Add `Ctrl/Cmd + S` inside an open notebook to prevent the browser Save dialog, immediately save the current title/body, capture a version snapshot, and show confirmation.
- Preserve `Alt + N` for Quick Scratchpad and ensure repeated key events do not double-toggle it.
- Keep shortcuts scoped to the writing workspace so they do not alter unrelated screens or canvas behavior.

### 4. Desktop interaction polish
- Refine the existing slim scrollbar styling for mouse-wheel use, including semantic hover colors.
- Add consistent hover/focus-visible feedback and accessible tooltip text to icon-only notebook, Scratchpad, Version History, and drawing toolbar controls.
- Respect reduced-motion preferences for panel and control transitions.

## Verification
- Check the notebook workspace at laptop, 1080p, and 1440p widths for clipping, overlap, and usable text width.
- Verify `Ctrl/Cmd + S` prevents the browser dialog, persists the draft, and creates a snapshot; verify `Alt + N` toggles once per press.
- Open Scratchpad and Version History to confirm desktop sizing, scrolling, and comparison layout.
- Confirm the drawing canvas remains full-screen and its toolbar controls show clear hover/focus feedback.
- Run the project type check and inspect the latest preview build diagnostics.

## Out of scope
- No editor, canvas drawing, version-history, navigation, or data-model rewrites.
- No new features beyond desktop layout, shortcuts, scrollbars, hover states, and tooltips.
