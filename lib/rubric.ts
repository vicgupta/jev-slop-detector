// Rubric v2 — one batched Jev call: 1 choice + 10 scores + 1 noul.
// Research notes:
// - TypeSafe docs: level descriptions drive score quality — keep them behavioral
//   and distinguishable; criteria must extend the instructions, not fight them.
// - Official composite-scoring pattern: atomic scores + weights in code (see
//   lib/verdict.ts). slop_index is the single headline number; gates stay in code.
// - Signals sourced from: Antislop paper (arxiv 2510.15061 — phrase fingerprints,
//   "it's not X, it's Y" patterns), slop-cop's 36 rules (era openers, connector
//   addiction, negation pivots, listicle instinct), and "Measuring AI Slop in
//   Text" (arxiv 2509.19163 — information density, generic interchangeability).
// All scores run 0 (clean) -> 3 (total slop) so bars and gates read uniformly.

export const QUESTIONS = {
  style_bucket: {
    type: "choice",
    instructions: "Classify the writing style of the text.",
    criteria: {
      human: "specific, grounded, uneven in a human way, concrete details",
      slop: "generic AI filler, hype, faux-depth, no real information",
      mixed: "partly edited AI or mixed quality, needs cleanup",
    },
  },
  filler: {
    type: "score",
    instructions: "How much empty filler or throat-clearing? 0=none, 3=wall of fluff.",
    criteria: [
      "tight: every sentence carries new information",
      "a few throat-clearers (it's worth noting, importantly, essentially)",
      "heavy filler: whole paragraphs could be deleted",
      "wall of fluff: almost no sentence carries information",
    ],
  },
  hype: {
    type: "score",
    instructions: "How much hype or purple prose? 0=plain, 3=unbearable.",
    criteria: [
      "plain and measured",
      "light marketing adjectives",
      "heavy hype: revolutionary, game-changing, unlock, supercharge",
      "unbearable purple prose throughout",
    ],
  },
  repetition: {
    type: "score",
    instructions: "How repetitive or listicle-like? 0=tight, 3=spam.",
    criteria: [
      "tight and varied",
      "some points restated",
      "looped phrases; same idea three times",
      "listicle spam: the same idea N times or a filler list",
    ],
  },
  specificity: {
    type: "score",
    instructions: "How vague is it? 0=concrete (names, numbers, examples), 3=pure hand-waving with zero substance.",
    criteria: [
      "concrete: names, numbers, dates, worked examples",
      "mostly grounded with some generalities",
      "mostly vague assertions a reader cannot act on",
      "pure hand-waving: zero checkable substance",
    ],
  },
  cliche: {
    type: "score",
    instructions: "How full of AI pet phrases (delve, tapestry, seamless, robust, landscape, holistic…)? 0=fresh wording, 3=stuffed throughout.",
    criteria: [
      "fresh wording, no pet phrases",
      "one tired phrase",
      "several pet phrases (delve, tapestry, seamless, robust, fast-paced landscape)",
      "stuffed with clichés in nearly every sentence",
    ],
  },
  clarity: {
    type: "score",
    instructions: "How hard to parse? 0=plain and easy to follow, 3=impenetrable word-salad.",
    criteria: [
      "plain and easy to follow",
      "mostly readable, occasional tangle",
      "convoluted: needs re-reading to parse",
      "impenetrable word-salad",
    ],
  },
  weasel: {
    type: "score",
    instructions: "How hedged? 0=committed, falsifiable claims, 3=pure hedge that says nothing.",
    criteria: [
      "committed, falsifiable claims",
      "light hedging (may, often, can)",
      "heavy weasel words stacked (arguably, seemingly, potentially, almost)",
      "pure hedge: nothing checkable is claimed",
    ],
  },
  formula: {
    type: "score",
    instructions: "How assembled-from-templates? Watch for: 'not X but Y' pivots, rhetorical question immediately answered, 'In an era/world of…' openers, 'In conclusion / Moving forward' closers, em-dash pivots, one-line dramatic fragments. 0=natural varied structures, 3=built from templates.",
    criteria: [
      "natural, varied sentence structures",
      "one templated move",
      "several templated structures",
      "assembled from templates throughout",
    ],
  },
  generic: {
    type: "score",
    instructions: "How interchangeable is it? Could these sentences apply to almost any topic with nouns swapped? 0=only about this topic, 3=fully generic.",
    criteria: [
      "could only be about this topic",
      "mostly specific with generic stretches",
      "mostly interchangeable with any topic",
      "fully generic: applies to almost any context",
    ],
  },
  slop_index: {
    type: "score",
    instructions: "Overall, how much does this read as slop — generic, padded, clichéd low-effort prose — regardless of who wrote it? 0=clean human-grade prose, 3=textbook slop.",
    criteria: [
      "clean, human-grade prose",
      "rough edges but genuine",
      "reads as slop: generic, padded, clichéd",
      "textbook slop",
    ],
  },
  is_slop: {
    type: "noul",
    instructions: "Does this text need a rewrite before publishing as non-slop?",
    criteria: {
      true: "publishing as-is would read as slop; needs a rewrite",
      false: "fine to publish as-is",
    },
  },
} as const;

export type QuestionName = keyof typeof QUESTIONS;
