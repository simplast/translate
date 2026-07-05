# translate

A terminal-native translation tool. Type any text, get streaming
Chinese↔English translation with part-of-speech, example sentences, and an
ASCII-art association image for single words.

Built on **Bun + OpenTUI (Solid) + Vercel AI SDK**.

## Features

- **Streaming output** — translation and examples render token-by-token
- **Auto word/sentence detection**
  - Word: translation + POS + 2 example sentences
  - Sentence: translation + sentence skeleton + a structurally similar example
- **Association image** — single words trigger image generation in parallel;
  rendered inline as colored half-block pixels, plus the trimmed original is
  saved under `img/` for `Ctrl+O` to open
- **Three independent providers** — translate / examples / image can each point
  to a different OpenAI-compatible endpoint

## Quick start

```bash
bun install
cp .env.example .env   # then edit .env with your endpoints/keys
bun run dev
```

## Configuration

All endpoints are configured via environment variables (see `.env.example`):

| Purpose   | Env prefix     | Protocol                                |
|-----------|----------------|-----------------------------------------|
| Translate | `TRANSLATE_*`  | OpenAI chat completions                 |
| Examples  | `EXAMPLES_*`   | OpenAI chat completions                 |
| Image     | `IMAGE_*`       | OpenAI `/images/generations` or Tencent |

For Tencent HY-Image-Lite, set `IMAGE_VENDOR=tencent-lite` and
`IMAGE_ENDPOINT=/api/image/lite`. Any standard OpenAI-compatible image
endpoint uses the default `IMAGE_VENDOR=openai`.

## Keybindings

- `Enter` — submit text
- `Ctrl+O` — open the last generated image in your OS image viewer
- `Esc` / `Ctrl+C` — quit

## Requirements

- A TrueColor terminal (iTerm2, Ghostty, Kitty, WezTerm, Windows Terminal,
  macOS Terminal.app) — the inline image uses 24-bit color half-blocks
- Bun runtime
- `sharp` native deps (auto-installed by `bun install`)

## Project structure

```
src/
  index.tsx              # entry
  app.tsx                # TUI: layout, state, input, image effects
  ai/
    config.ts            # reads provider config from env
    providers.ts         # lazy createOpenAI() chat models
    translate.ts         # streaming translation
    examples.ts          # streaming POS + examples
    image-gen.ts         # generateImage() — openai & tencent-lite vendors
    image-render.ts      # download / sharp.trim / render to StyledText / open
```

See [AGENTS.md](./AGENTS.md) for conventions and gotchas.

## License

MIT
