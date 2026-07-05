# AGENTS.md

Guidance for AI agents (and humans) working on this codebase.

## What this is

Translate is a terminal-native translation tool. Run `trans` (or `bun run dev`)
to enter a TUI that accepts any text and streams back Chinese↔English
translation, part-of-speech / sentence skeleton, example sentences, and an
ASCII-art association image for single words. Built on Bun + OpenTUI (Solid) +
Vercel AI SDK.

## Tech stack

- **Runtime**: Bun (TSX/TS loaded directly, no build step)
- **TUI**: `@opentui/solid` (Solid.js reconciler over OpenTUI renderables)
- **LLM calls**: `ai` (Vercel AI SDK) + `@ai-sdk/openai` for chat;
  hand-rolled `fetch` for image generation (vendor-specific shapes)
- **Image processing**: `sharp` (resize, trim whitespace, raw RGB → terminal)
- **Terminal rendering**: Unicode half-block `▀` per character, upper pixel as
  `fg`, lower pixel as `bg`. True-color required.

## Project layout

```
src/
  index.tsx                # Entry: loads dotenv, renders <App/>
  app.tsx                  # Solid app: state, layout, input, image effects
  ai/
    config.ts              # Reads TRANSLATE_* / EXAMPLES_* / IMAGE_* from env
    providers.ts           # Lazy createOpenAI() chat models for translate/examples
    translate.ts           # streamText() translation, Chinese↔English auto
    examples.ts            # streamText() POS + examples / sentence skeleton
    image-gen.ts           # generateImage() — openai & tencent-lite vendors
    image-render.ts        # download / sharp.trim / render to StyledText / open
    image.ts               # Re-export shim for backwards compat
```

## Three external calls

All three are configurable via `.env` (copy `.env.example` → `.env`):

| Call       | Env prefix    | Protocol                                   |
|------------|---------------|--------------------------------------------|
| Translate  | `TRANSLATE_*`  | OpenAI chat completions (streamText)      |
| Examples   | `EXAMPLES_*`   | OpenAI chat completions (streamText)      |
| Image      | `IMAGE_*`       | OpenAI `/images/generations` **or** Tencent `/api/image/lite` |

`IMAGE_VENDOR` switches the request/response shape:
- `"openai"` (default) — standard `n`/`response_format`, returns `data[0].url`
- `"tencent-lite"` — uses `rsp_img_type` + `negative_prompt`, same response shape

`IMAGE_ENDPOINT` controls the path appended to `IMAGE_BASE_URL`.

## Commands

```bash
bun install          # install deps
bun run dev          # start TUI with --watch
bun run start        # start TUI once
bun run typecheck    # tsc --noEmit (no build step needed to run)
```

## Conventions

- **No build step.** Bun runs `.tsx` directly via the OpenTUI babel preset.
- **Streaming first.** Both chat calls use `streamText` + `textStream` so
  partial results render before the model finishes.
- **Parallelism.** On submit, translate / examples / image start together;
  don't serialize them. Image generation does not depend on translation output.
- **Terminal image rendering.** Always `sharp.trim()` whitespace before
  resizing to `maxColumns` (default 50). Half-block `▀` per cell. Save the
  trimmed original under `img/` (gitignored) so `⌃O` opens a clean copy.
- **Solid signals.** State lives in `createSignal` at the top of `App`.
  `createEffect` watches `resultParts()` to update the translation message
  in place and to trigger image generation when a word is detected.
- **Keybindings.** `Esc` / `Ctrl+C` → destroy renderer and exit (must call
  `renderer.destroy()` before `process.exit` to avoid terminal corruption).
  `Ctrl+O` → open the last generated image with the OS viewer.
- **Solid-JSX in OpenTUI.** Component tag names are lowercase
  (`<box>`, `<text>`, `<input>`, `<scrollbox>`). The `key` prop is NOT
  supported — use `id` instead. `StyledText` cannot be passed via the
  `content` prop (it gets stringified to `[object Object]`); assign it
  directly to the `TextRenderable` instance via a `ref`.

## Files of note

- `src/app.tsx` — everything UI: layout, history grouping, message renderer,
  keyboard handling, image effect that triggers on `currentQuery`.
- `src/ai/config.ts` — single source of truth for provider config; add new
  vendors here.
- `src/ai/image-gen.ts` — to support a new image vendor, add a `buildXBody`
  function and a branch in `generateImage`.

## Gotchas

- The Tencent `hy-image-lite` endpoint rejects `negative_prompt` silently on
  some accounts — if images stop returning, drop the negative prompt first.
- `sharp.trim()` with `background: "white"` only trims near-white borders.
  Dark or colored backgrounds won't be trimmed.
- `os.tmpdir()` is **not** used anymore — images go to `./img/` so users
  can find them next to the project.
- Don't push `.env`. The repo is public-ish; secrets live only in Keychain
  or local `.env` (gitignored).

## Memory items

- User prefers minimalist UI: no labels, no `│` bars, color + spacing do the
  separation. Larger fonts/elements on home region. See `user_profile.md`.
