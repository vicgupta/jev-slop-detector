import type { JevAnswers } from "./jev.js";

export type Verdict = { label: "pass" | "review" | "flag"; reasons: string[] };

export function toVerdict(a: JevAnswers, threshold = 0.7): Verdict {
  const reasons: string[] = [];
  if (a.style_bucket.choice === "slop") reasons.push(`bucket=slop (${pct(a.style_bucket.probabilities["slop"] ?? 0)})`);
  for (const [key, ans] of Object.entries(a)) {
    if (ans.type === "score" && ans.score >= 3) reasons.push(`${key}=${ans.score.toFixed(1)}/3`);
  }
  if (a.is_slop.noul >= threshold) reasons.push(`is_slop=${a.is_slop.noul.toFixed(2)}≥${threshold}`);
  if (reasons.length >= 2 || a.is_slop.noul >= threshold) return { label: "flag", reasons };
  if (reasons.length === 1 || a.is_slop.noul >= threshold - 0.2) {
    if (reasons.length === 0) reasons.push(`is_slop=${a.is_slop.noul.toFixed(2)} (borderline, threshold ${threshold})`);
    return { label: "review", reasons };
  }
  return { label: "pass", reasons };
}

function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}
