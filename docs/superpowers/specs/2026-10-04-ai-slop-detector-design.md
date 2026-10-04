# AI Slop Detector — Design Spec

Date: 2026-10-04
Status: approved (manual checker, multi-dimension rubric, TS web app)
Endpoint: `POST https://jevtypesafeai.com/api/v1/decide` (opencode/Jev hosted proxy)

## 1. Intent

Manual checker tool: paste text in, get a typed slop verdict back.
Uses Jev System One (state + typed questions -> choice/score/noul in 70–500ms)
instead of regexes or slow LLM judges.

Success: paste -> one Jev round-trip -> bucket + 3 score bars + gate probability
+ pass/review verdict. High-precision gate first.

## 2. Rubric v1 (batched in one call)

`state` = trimmed input text (max 4000 chars, client + server trim).

`questions`:
- `style_bucket` choice: human / slop / mixed
- `filler` score [routine, some fluff, heavy filler, wall of fluff]
- `hype` score [plain, light marketing, heavy hype, unbearable purple prose]
- `repetition` score [tight, some repetition, looped phrases, listicle spam]
- `is_slop` noul: "Does this need a rewrite before publishing?"

Response `answers` gives `choice+probabilities`, `score+distribution`, `noul 0..1`.
Verdict rule (code, tunable via UI slider): FLAG if `is_slop > threshold (default 0.7)`
or any score >= 3.0 or `style_bucket == slop`.

## 3. Architecture

```
public/index.html --POST /api/check {text}--> src/server.ts --POST /api/v1/decide--> Jev
     ^                          |
     └──── {answers, verdict} ───┘
```

- No framework, no DB, no auth. Node stdlib `http` + `fetch`, TS via `tsx`.
- `JEV_API_KEY` (`jv_live_...`) server-side only, never logged.
- Files: `lib/rubric.ts` (questions), `lib/jev.ts` (client+trim+errors),
  `lib/verdict.ts` (threshold mapping), `src/server.ts` (static + /api/check),
  `public/index.html` (UI), `lib/samples.ts` (20-30 calibration texts).

## 4. Error handling

- Missing key -> 500 "set JEV_API_KEY".
- 402 -> "balance empty, top up at pricing page".
- Upstream non-200/timeout (10s Abort) -> 502 "uncertain, retry".
- Empty/over-limit input -> 400 with clear message + trim notice.

## 5. Calibration & testing

Seed `lib/samples.ts` with 10 human / 10 slop / 10 mixed. Tune wording +
threshold slider manually. Verify: `npm run typecheck`, `npm run dev`,
curl `/api/check`, check <1s end-to-end and typed JSON shape.
