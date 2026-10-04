import { QUESTIONS } from "./rubric.js";
import { JevError } from "./errors.js";
import type { JevAnswers, JevResponse } from "./jev.js";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Local models return a single token (letter/number/Y-N), not calibrated
// probabilities, so distributions are one-hot and confidence is a flat 0.5.
// The verdict math (choice + score>=3 + noul gate) works unchanged.
const FLAT_CONFIDENCE = 0.5;

function oneHot(keys: string[], winner: string): Record<string, number> {
  return Object.fromEntries(keys.map((k) => [k, k === winner ? 1 : 0]));
}

function oneHotLevels(max: number, picked: number): Record<string, number> {
  const r: Record<string, number> = {};
  for (let i = 0; i <= max; i++) r[String(i)] = i === picked ? 1 : 0;
  return r;
}

async function generate(endpoint: string, model: string, prompt: string, usage: { in: number; out: number }): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${endpoint}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0, num_predict: 128 } }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new JevError(502, `Ollama request failed. Is ollama serving at ${endpoint}?`);
  }
  if (!res.ok) throw new JevError(502, `Ollama returned ${res.status}. Is model "${model}" pulled?`);
  const j = (await res.json()) as { response?: string; prompt_eval_count?: number; eval_count?: number };
  usage.in += j.prompt_eval_count ?? 0;
  usage.out += j.eval_count ?? 0;
  return j.response ?? "";
}

export async function callOllama(state: string, model = process.env.OLLAMA_MODEL ?? "tev1:latest"): Promise<JevResponse> {
  const endpoint = process.env.OLLAMA_ENDPOINT ?? "http://localhost:11434";
  // tev1-class models run small contexts (num_ctx ~2k): keep prompts short.
  const short = state.length > 1500 ? state.slice(0, 1500) : state;
  const usage = { in: 0, out: 0 };
  const answers: Record<string, unknown> = {};

  for (const [name, q] of Object.entries(QUESTIONS)) {
    const question = q as { type: string; instructions: string; criteria?: unknown };
    if (question.type === "choice") {
      const criteria = question.criteria as Record<string, string>;
      const keys = Object.keys(criteria);
      const prompt =
        `TEXT:\n${short}\n\nQUESTION: ${question.instructions}\nOPTIONS (return only the winning letter):\n` +
        keys.map((k, i) => `${LETTERS[i]}) ${k} — ${criteria[k]}`).join("\n") +
        `\nANSWER:`;
      const out = await generate(endpoint, model, prompt, usage);
      // Models often reason first ("The answer is B") — read the LAST candidate.
      const letters = (out.match(/[A-Za-z]/g) ?? []).map((c) => c.toUpperCase());
      let idx = -1;
      for (const c of letters.reverse()) {
        const i = LETTERS.indexOf(c);
        if (i >= 0 && i < keys.length) {
          idx = i;
          break;
        }
      }
      if (idx < 0 || idx >= keys.length) idx = keys.findIndex((k) => out.toLowerCase().includes(k.toLowerCase()));
      if (idx < 0) idx = 0;
      answers[name] = {
        type: "choice",
        choice: keys[idx],
        confidence: FLAT_CONFIDENCE,
        probabilities: oneHot(keys, keys[idx]),
      };
    } else if (question.type === "score") {
      const levels = question.criteria as string[];
      const prompt =
        `TEXT:\n${short}\n\nQUESTION: ${question.instructions}\nLEVELS (return only the level number):\n` +
        levels.map((d, i) => `${i}) ${d}`).join("\n") +
        `\nANSWER:`;
      const out = await generate(endpoint, model, prompt, usage);
      const nums = out.replace(/,/g, ".").match(/-?\d+(\.\d+)?/g) ?? [];
      const num = parseFloat(nums.length > 0 ? nums[nums.length - 1] : "NaN");
      const picked = Math.round(Math.min(levels.length - 1, Math.max(0, Number.isNaN(num) ? 0 : num)));
      answers[name] = {
        type: "score",
        score: picked,
        probabilities: oneHotLevels(levels.length - 1, picked),
        legend: Object.fromEntries(levels.map((d, i) => [String(i), d])),
        confidence: FLAT_CONFIDENCE,
      };
    } else {
      const criteria = (question.criteria ?? {}) as { true?: string; false?: string };
      const prompt =
        `TEXT:\n${short}\n\nQUESTION: ${question.instructions}\n` +
        (criteria.true ? `YES means: ${criteria.true}\n` : "") +
        (criteria.false ? `NO means: ${criteria.false}\n` : "") +
        `Return only Y for yes or N for no.\nANSWER:`;
      const out = await generate(endpoint, model, prompt, usage);
      const votes = out.match(/\b(y|yes|n|no|true|false|1|0)\b/gi) ?? [];
      const last = (votes.length > 0 ? votes[votes.length - 1] : "n").toLowerCase();
      const yes = last === "y" || last === "yes" || last === "true" || last === "1";
      answers[name] = { type: "noul", noul: yes ? 1 : 0 };
    }
  }

  return {
    answers: answers as JevAnswers,
    usage: { input_tokens: usage.in, cost_usd: 0 },
  };
}
