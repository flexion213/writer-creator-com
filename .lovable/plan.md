# Plan: Interactive Notebooks + AI Grammar Assistant

## Problem

- Notebooks section currently shows 3 hardcoded static cards — you can't actually create, edit, or save anything. That's why it feels "inaccessible."
- Visual style is plain, doesn't match the modern feel of the rest of the app.
- No writing assistance.

## What I'll build

### 1. Real Notebooks (replace static cards)

- Stateful list of notebooks (title + body), stored in component state.
- "New notebook" button → adds a fresh card you can type into immediately.
- Each notebook: editable title, editable multi-line body, delete button, last-edited timestamp.
- Empty state when no notebooks yet, with a friendly CTA.

### 2. Modern look

- Gradient/glass cards with subtle border glow, rounded-2xl, soft shadow.
- Section header with icon tile + title + subtitle (matches the menu style).
- Smooth hover/focus states; auto-grow textareas; monospace-free clean typography.
- Same treatment applied lightly to Suggestions and Feed headers for consistency.

### 3. AI Grammar Assistant

- "Fix grammar" button on each notebook (and on the Global Feed composer).
- Detects the language automatically and corrects grammar/spelling in that same language (no translation).
- Powered by Lovable AI Gateway (default model `google/gemini-3-flash-preview`) via a TanStack `createServerFn` — no client-side keys.
- While running: button shows a spinner; on success, text is replaced and a small "✓ Fixed" hint appears for 2s; on rate-limit/credit errors, a toast explains it.

## Technical notes

- New file `src/lib/grammar.functions.ts` exporting `fixGrammar` server fn:
  - Input: `{ text: string }` (Zod, 1–4000 chars).
  - Calls AI gateway with a system prompt: "Detect the language of the user's text. Return ONLY the same text with grammar and spelling fixed, in the SAME language. No explanations, no quotes, no translation." Uses tool-calling for structured `{ corrected: string, language: string }` output.
  - Handles 429/402 with friendly error messages.
- Will ensure `LOVABLE_API_KEY` is provisioned (Lovable Cloud + AI gateway) before wiring the call.
- Notebooks state lives in the existing `IndexPage` (lifted) so it survives section switches within the session.
- No persistence to a database unless you ask — keeps it lightweight per the original brief.

## Out of scope (ask if you want them)

- Saving notebooks across reloads (would need Cloud + a table).
- Multi-user sync.
- Rich text formatting.
