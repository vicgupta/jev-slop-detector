// Calibration seeds — expand to ~10 human / 10 slop / 10 mixed.
export const SAMPLES: { label: string; text: string }[] = [
  {
    label: "human",
    text: "Deploys failed at 14:02 UTC with exit 137 on api-2. Rolled back to build 481, error stopped. Memory limit was 512MB, bumped to 1GB in prod.conf.",
  },
  {
    label: "human",
    text: "I tried the new router for a week. Latency p95 dropped from 340ms to 210ms, but cold starts got worse on Mondays. Keeping it, with a cron warmup.",
  },
  {
    label: "slop",
    text: "Delve into this tapestry of cutting-edge synergy. In today's fast-paced digital landscape, it's important to note that excellence isn't just a goal — it's a journey of robust, seamless, game-changing innovation.",
  },
  {
    label: "slop",
    text: "Unlock unparalleled success with our revolutionary paradigm-shifting solution. Leverage holistic best practices to supercharge your workflow like never before!",
  },
  {
    label: "mixed",
    text: "Our platform leverages AI to improve productivity. In practice: triage time fell from 2h to 25min on 40 tickets last week, but two escalations were misrouted.",
  },
  {
    label: "mixed",
    text: "In conclusion, it's worth mentioning that this cutting-edge approach is truly transformative. Setup took 20 minutes, docs were missing one env var: REDIS_URL.",
  },
];
