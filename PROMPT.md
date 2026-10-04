# Slop Detector — Detailed Build Prompt

> Paste this into any capable coding agent (opencode, Claude Code, Cursor) to
> recreate or extend this project. It is the full spec: goal, providers, rubric,
> verdict math, file layout, and acceptance criteria.

## 1. Goal

Build a minimal, dependency-free (stdlib-only at runtime) TypeScript web app that
detects "AI slop" — generic, padded, clichéd low-effort prose — in pasted text.
One paste-box UI, one server route, one batched model call per check, typed
verdict back in under a second (API) or seconds (local).

## 2. Architecture

```
public/index.html --POST /api/check {text, threshold}--> src/server.ts --> provider
     ^                                                                     |
     └────────────── {answers, verdict, usage, trimmed, threshold} ─────────┘
```

- Runtime: Node 18+ stdlib (`http`, `fetch`) only. Dev deps: `typescript`, `tsx`, `@types/node`.
- `src/server.ts`: serves `public/index.html` at `/`, handles `POST /api/check`
  (validate JSON, reject empty text with 400, trim state, call provider, map
  verdict, return JSON). Auto-loads `.env` (tiny hand-rolled loader, no dotenv
  package — only fills vars missing from the real environment).
- `lib/rubric.ts`: the single source of truth for all questions.
- `lib/jev.ts`: `callJev(state, apiKey)` — provider switch + response normalization.
- `lib/ollama.ts`: `callOllama(state)` — local-model adapter (see §4).
- `lib/errors.ts`: shared `JevError { status, message }`.
- `lib/verdict.ts`: `toVerdict(answers, threshold)` — pure function, all gating here.
- `lib/samples.ts`: calibration seeds (human / slop / mixed).
- UI: single `public/index.html`, Tailwind via Play CDN, vanilla JS, system-default
  dark mode (`dark:` variants), no framework.

## 3. Providers (in priority order)

1. **Ollama (local, free)** — when `JEV_PROVIDER=ollama`. Model from `OLLAMA_MODEL`
   (default `tev1:latest`), endpoint `OLLAMA_ENDPOINT` (default
   `http://localhost:11434`). Any chat model works (`tev1`, `ornith-1.5:9b`,
   `qwen3.5`, `gemma4:12b`).
2. **OpenRouter (recommended API)** — when `OPENROUTER_API_KEY` is set.
   `POST https://openrouter.ai/api/alpha/decisions`,
   `Authorization: Bearer $OPENROUTER_API_KEY`, body
   `{model: "typesafe/jev-1.13", state, questions}`. Response `answers` shape is
   identical to Jev's; normalize `usage.cost` → `cost_usd`. Rate: $0.042/M input
   tokens, output free (verify against receipts: cost = input_tokens × 0.042/1e6).
3. **Hosted proxy fallback** — `JEV_API_KEY` + `JEV_ENDPOINT`
   (default `https://jevtypesafeai.com/api/v1/decide`), body `{state, questions}`.

Error mapping: 401 → invalid key, 402 → empty balance/credits, 429 → rate
limited (retry with backoff), anything else/timeout (10s API, 120s Ollama) → 502.

## 4. Ollama adapter design (important)

Local models cannot return calibrated probabilities, so translate each Jev
question into a minimal-completion prompt against `/api/generate`
(`{model, prompt, stream: false, options: {temperature: 0, num_predict: 128}}`,
one question per call, state trimmed to 1500 chars for small contexts):

- **choice** → list options as `A) key — description`, "return only the winning
  letter". Parse the LAST valid letter (models reason out loud, then conclude);
  fall back to substring search for the key name, then index 0.
- **score** → list levels as `0) desc … N) desc`, "return only the level number".
  Parse the LAST number, clamp to range, round.
- **noul** → append YES/NO meanings from criteria, "return only Y or N". Take the
  LAST yes/no token; Y→1, N→0.

Synthesize Jev-shaped answers: one-hot `probabilities`, `legend` echo for scores,
flat `confidence: 0.5` (explicitly uncalibrated — never claim calibration from
single-token outputs). `usage: {input_tokens: prompt_eval_count total,
cost_usd: 0}`.

## 5. Rubric (all batched in ONE call — 1 choice + 10 scores + 1 noul)

All scores run 0 (clean) → 3 (total slop) so bars and gates read uniformly.
Level descriptions must be behavioral and distinguishable — description quality
drives score quality (per TypeSafe docs). Criteria must extend the instructions.

- `style_bucket` (choice): human = specific/grounded/uneven/concrete;
  slop = generic filler/hype/faux-depth; mixed = partly edited, needs cleanup.
- `filler`: tight/every-sentence-new-info → throat-clearers (it's worth noting,
  importantly) → deletable paragraphs → wall of fluff.
- `hype`: plain → light adjectives → heavy hype (revolutionary, game-changing,
  unlock) → unbearable purple prose.
- `repetition`: tight/varied → restated points → looped phrases → listicle spam.
- `specificity`: concrete names/numbers/dates/examples → mostly grounded →
  vague unactionable assertions → zero checkable substance.
- `cliche`: fresh wording → one tired phrase → several pet phrases (delve,
  tapestry, seamless, robust, fast-paced landscape) → clichés every sentence.
- `clarity`: plain/followable → occasional tangle → needs re-reading →
  word-salad.
- `weasel`: committed falsifiable claims → light hedging (may/often) → stacked
  weasels (arguably/seemingly/potentially) → nothing checkable claimed.
- `formula`: natural varied structures → one templated move → several → assembled
  from templates. Watch: "not X but Y" pivots, rhetorical question immediately
  answered, "In an era/world of…" openers, "In conclusion / Moving forward"
  closers, em-dash pivots, one-line dramatic fragments.
- `generic`: could-only-be-about-this-topic → generic stretches → mostly
  interchangeable → applies to almost any context (the interchangeability test).
- `slop_index`: THE SINGLE HEADLINE SCORE. "Overall, how much does this read as
  slop regardless of who wrote it?" clean human-grade → rough but genuine →
  reads as slop → textbook slop.
- `is_slop` (noul): "Does this need a rewrite before publishing as non-slop?"
  with criteria `{true: "publishing as-is reads as slop", false: "fine as-is"}`.

Gates stay in code (official composite-scoring pattern — weights are business
logic, never in the model).

## 6. Verdict math (`toVerdict`, pure, tested)

Default threshold 0.7 (UI slider 0.5–0.9):

- reason if `style_bucket.choice === "slop"` (with its probability)
- reason per score with `score >= 3` (generic over ALL score answers — never
  hardcode names, so new checks auto-participate)
- reason if `is_slop.noul >= threshold`
- `reasons >= 2` OR `noul >= threshold` → FLAG
- `reasons == 1` OR `noul >= threshold − 0.2` → REVIEW (if reasons empty, add
  `is_slop=X (borderline, threshold T)` so the UI never shows an empty reason)
- else PASS

## 7. UI requirements

- Textarea + threshold slider with live value + Check button (disables while checking).
- Result card: verdict pill (green/yellow/red + dark variants), hero `slop_index`
  number (`X.X / 3`), bucket + per-option probability chips, dynamic score rows
  (name, `score / 3`, bar, matched level text from `legend`), `is_slop` vs
  threshold, trim notice, token cost, collapsible raw JSON.
- New scores render automatically — iterate response answers by `type`, never
  hardcode score names (except hero `slop_index`).

## 8. Acceptance criteria

- `npm run typecheck` clean; `GET /` → 200.
- Obvious slop → FLAG with bucket=slop and several scores ≥ 2.5.
- Clean incident note → PASS, bucket=human, scores ≈ 0.
- Mixed text (hype + one buried fact) → bucket=mixed, mid slop_index,
  `specificity` stays low (the fact is spotted).
- `testsuite.md`: 10 scenarios (slop / human / mixed / listicle / hedge-stack /
  negation-pivot / marketing-with-receipts / terse note / hype tweet /
  non-English with expect-unknown). All must behave per their notes on the API
  provider; local-model noise on 4B models is expected and documented, not a bug
  in the harness.
- No API keys in code, logs, or git. `.env.example` documents every variable.
