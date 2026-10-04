# Jev Slop Detector

Paste text in, get a typed verdict out. A minimal web app that detects **AI slop** —
generic, padded, clichéd low-effort prose — using
[Jev by TypeSafe AI](https://typesafe.ai) (choice / score / noul typed decisions),
with OpenRouter and local Ollama as first-class providers.

One check = one batched model call: **1 choice + 10 scores + 1 noul**, answered in
parallel in ~70–500 ms on API providers, for about **$0.00006**.

## Features

- **12-question rubric** with a single headline **slop index** (0–3) plus per-dimension
  bars: filler, hype, repetition, specificity, cliché, clarity, weasel words,
  templated structures, generic interchangeability
- **3 providers, switchable in the UI:** TypeSafe direct, OpenRouter, Ollama (local, free)
- **Code-driven verdict gates** — FLAG / REVIEW / PASS with reasons, tunable threshold slider
- **Big red / amber / green gate banner** driven by `is_slop` vs your gate
- Tailwind UI with system-default dark mode + manual toggle
- Per-check token usage and cost; Ollama checks cost $0
- 10-case `testsuite.md` and a full agent build prompt (`PROMPT.md`)

## Prerequisites

- **Node.js 18+** (uses stdlib `fetch`; no runtime dependencies)
- One of:
  - **OpenRouter key** → https://openrouter.ai/settings/keys (same $0.042/M rate as direct, no second account)
  - **TypeSafe key** → https://console.typesafe.ai ($5 free credit ≈ 85k checks)
  - **Ollama** → https://ollama.com + any pulled model, e.g. `ollama pull qwen3.5` (local models in this repo were tested with `tev1:latest`)

## Install

```bash
git clone https://github.com/vicgupta/jev-slop-detector.git
cd jev-slop-detector
npm install
cp .env.example .env
```

Edit `.env` and set **one** of these (or skip `.env` entirely and paste keys in the UI):

```bash
# OpenRouter (recommended — no waitlist, billed to your OpenRouter account)
OPENROUTER_API_KEY=sk-or-v1-...
JEV_MODEL=typesafe/jev-1.13

# ...or TypeSafe direct
# TYPESAFE_API_KEY=...
# ...or local Ollama (free, no key at all)
# JEV_PROVIDER=ollama
# OLLAMA_MODEL=tev1:latest
# OLLAMA_ENDPOINT=http://localhost:11434

PORT=3000
```

Then:

```bash
npm run dev    # start with auto-reload (tsx watch)
# npm run build && npm start   # compiled production run
# npm run typecheck            # strict TypeScript check
```

Open **http://localhost:3000**.

> `.env` is git-ignored. Keys typed into the UI live only in the browser's
> `localStorage` — the server holds them in memory for one request and never
> writes them to disk or logs.

## Use

1. Pick a **provider** in the dropdown (TypeSafe / OpenRouter / Ollama).
2. Paste the key for that provider if it isn't in `.env` (Ollama needs a model name instead).
3. Paste text, set the **gate threshold** (default 0.70), hit **Check**.

### Reading a result

| Element | Meaning |
|---|---|
| Big banner | `✕ READS AS SLOP` (red, `is_slop` ≥ gate) · `? UNCLEAR` (amber, within 0.2 below gate) · `✓ LOOKS CLEAN` (green) |
| Slop index `X.X / 3` | Single headline score — red ≥ 2.0, amber 1.5–2.0, green below |
| Verdict pill | FLAG (2+ reasons or gate tripped) · REVIEW (1 reason or borderline) · PASS, with reasons listed |
| Bucket | `human` / `slop` / `mixed` with per-option probabilities |
| Score bars | Each dimension 0–3 with its matched level description underneath |
| Footer | `via {provider}` · input tokens · cost in USD · raw JSON toggle |

### API

```bash
curl -X POST http://localhost:3000/api/check \
  -H 'Content-Type: application/json' \
  -d '{"text":"Delve into this tapestry...","threshold":0.7,"provider":"openrouter","apiKey":"sk-or-..."}'
```

- `GET /api/config` → `{"provider":"...","ollamaModel":"..."}` (server defaults)
- `provider` is `typesafe` | `openrouter` | `ollama` (falls back to server env);
  `apiKey`/`model` are optional per-request overrides.

## The rubric

All 12 questions ship in a single call (`lib/rubric.ts` — the only file you edit to
add a check). Scores run 0 (clean) → 3 (total slop):

`style_bucket` (choice) · `filler` · `hype` · `repetition` · `specificity` ·
`cliche` · `clarity` · `weasel` · `formula` (templated structures: not-X-but-Y,
rhetorical Q&A, era openers) · `generic` (would this fit any topic?) ·
`slop_index` (overall) · `is_slop` (noul gate).

Signal sources: TypeSafe's rubric guidance, the Antislop paper
(arXiv 2510.15061), slop-cop's 36 heuristic rules, and "Measuring AI Slop in
Text" (arXiv 2509.19163). The UI and verdict logic iterate scores dynamically,
so a new check is a few lines in `lib/rubric.ts` — nothing else changes.

## Test it

`testsuite.md` has 10 paste-and-check scenarios with expected outcomes:
obvious slop, clean incident note, tricky mixed text, listicle spam, hedge
stack, negation-pivot sermon, marketing-*with-receipts* (should survive!),
a terse note, a hype tweet, and a non-English case (expect unknown — Jev is
English-first per its docs).

## Cost

| Route | Input / 1M tokens |
|---|---|
| TypeSafe direct / OpenRouter | **$0.042** (output free) |
| Ollama local | **$0** |

A full 12-question check is ~1.4k tokens ≈ **$0.00006**. TypeSafe's $5 starter
credit covers roughly 85,000 checks.

## Project structure

```
lib/rubric.ts    questions (edit here to add checks)
lib/jev.ts       provider routing + API normalization
lib/ollama.ts    local-model adapter (one prompt per question, last-token parse)
lib/verdict.ts   pure flag/review/pass math
lib/errors.ts    shared JevError
src/server.ts    static server + POST /api/check + GET /api/config
public/index.html  Tailwind UI (CDN), vanilla JS
testsuite.md     10 manual test scenarios
PROMPT.md        full agent-readable build spec
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No API key for openrouter` | Paste key in UI or export `OPENROUTER_API_KEY` and restart |
| `Invalid openrouter API key` (401) | Key is wrong/revoked — check https://openrouter.ai/settings/keys |
| `Insufficient credits` (402) | Top up the provider balance |
| `Ollama returned 404` | `ollama pull <model>` first; check `OLLAMA_ENDPOINT` |
| All scores 0 from Ollama | Small models ramble — the adapter reads the *last* verdict token; retry, or use a larger model (`ornith-1.5:9b`, `qwen3.5`) |
| `Jev returned 5xx` | Transient — retry; API providers flap occasionally |

## License

See [LICENSE](LICENSE).
