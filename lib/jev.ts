import { QUESTIONS } from "./rubric.js";
import { JevError } from "./errors.js";

export const JEV_ENDPOINT = process.env.JEV_ENDPOINT ?? "https://jevtypesafeai.com/api/v1/decide";
export const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/alpha/decisions";
export const JEV_MODEL = process.env.JEV_MODEL ?? "typesafe/jev-1.13";
export const MAX_STATE_CHARS = 4000;

type ScoreAnswer = {
  type: "score";
  score: number;
  probabilities: Record<string, number>;
  legend: Record<string, string>;
  confidence: number;
};

export type JevAnswers = {
  style_bucket: { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> };
  filler: ScoreAnswer;
  hype: ScoreAnswer;
  repetition: ScoreAnswer;
  specificity: ScoreAnswer;
  cliche: ScoreAnswer;
  clarity: ScoreAnswer;
  weasel: ScoreAnswer;
  formula: ScoreAnswer;
  generic: ScoreAnswer;
  slop_index: ScoreAnswer;
  is_slop: { type: "noul"; noul: number };
};

export type JevResponse = {
  answers: JevAnswers;
  usage?: { input_tokens?: number; cost_usd?: number; credits_remaining_usd?: number };
};

export function trimState(text: string): { state: string; trimmed: boolean } {
  const t = text.trim();
  if (t.length <= MAX_STATE_CHARS) return { state: t, trimmed: false };
  return { state: t.slice(0, MAX_STATE_CHARS), trimmed: true };
}

export type ProviderName = "typesafe" | "openrouter" | "ollama" | "hosted";
export type CheckOptions = { apiKey: string; provider?: string; model?: string };

export function activeProvider(explicit?: string): ProviderName {
  const valid = (s: string | undefined): ProviderName | undefined => {
    const v = (s ?? "").toLowerCase();
    return v === "typesafe" || v === "openrouter" || v === "ollama" || v === "hosted" ? v : undefined;
  };
  return (
    valid(explicit) ??
    valid(process.env.JEV_PROVIDER) ??
    (process.env.OPENROUTER_API_KEY ? "openrouter" : undefined) ??
    (process.env.TYPESAFE_API_KEY ? "typesafe" : undefined) ??
    (process.env.JEV_API_KEY ? "hosted" : undefined) ??
    "hosted"
  );
}

export async function callJev(state: string, opts: CheckOptions): Promise<JevResponse> {
  const provider = activeProvider(opts.provider);
  if (provider === "ollama") {
    const { callOllama } = await import("./ollama.js");
    return callOllama(state, opts.model);
  }
  const keyHint =
    provider === "typesafe" ? "TYPESAFE_API_KEY" : provider === "openrouter" ? "OPENROUTER_API_KEY" : "JEV_API_KEY";
  const key = opts.apiKey || process.env[keyHint] || "";
  if (!key) {
    throw new JevError(500, `No API key for ${provider}. Paste one in the UI or export ${keyHint}.`);
  }
  const endpoint =
    provider === "typesafe"
      ? process.env.TYPESAFE_ENDPOINT || "https://api.typesafe.ai/v1/systemone"
      : provider === "openrouter"
        ? !process.env.JEV_ENDPOINT || process.env.JEV_ENDPOINT.includes("openrouter.ai")
          ? OPENROUTER_ENDPOINT
          : process.env.JEV_ENDPOINT
        : JEV_ENDPOINT;
  const body =
    provider === "hosted"
      ? { state, questions: QUESTIONS }
      : { model: opts.model || (provider === "typesafe" ? "jev-latest" : JEV_MODEL), state, questions: QUESTIONS };
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new JevError(502, "Jev request timed out or failed. Retry.");
  }
  if (res.status === 401) throw new JevError(401, `Invalid ${provider} API key.`);
  if (res.status === 402) throw new JevError(402, `Insufficient credits on ${provider} — top up and retry.`);
  if (res.status === 429) throw new JevError(429, "Rate limited. Retry with backoff.");
  if (!res.ok) throw new JevError(502, `Jev returned ${res.status}. Retry.`);
  const raw = (await res.json()) as {
    answers: JevAnswers;
    usage?: { input_tokens?: number; output_tokens?: number; cost?: number; cost_usd?: number; credits_remaining_usd?: number };
  };
  const costUsd = raw.usage?.cost_usd ?? raw.usage?.cost;
  return {
    answers: raw.answers,
    usage: raw.usage
      ? { input_tokens: raw.usage.input_tokens, cost_usd: costUsd, credits_remaining_usd: raw.usage.credits_remaining_usd }
      : undefined,
  };
}
