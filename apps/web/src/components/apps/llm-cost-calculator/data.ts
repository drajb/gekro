/**
 * data.ts — LLM Cost Calculator source data
 *
 * Rules:
 *  - Every number has a cited source URL in a comment
 *  - null = no published benchmark; never estimated from specs (decision log 2026-04-19)
 *  - lastVerified must be updated whenever prices/benchmarks are refreshed
 */

export const LAST_VERIFIED = '2026-04-19';
export const ELECTRICITY_RATE_DEFAULT_USD_KWH = 0.1745; // EIA Jan 2026 residential avg
// Source: https://www.eia.gov/electricity/monthly/update/end-use.php

// ── Cloud API pricing ─────────────────────────────────────────────────────────

export interface CloudModel {
  id: string;
  label: string;
  provider: 'Anthropic' | 'OpenAI' | 'Google';
  inputPerMTok: number;     // USD per 1M input tokens
  outputPerMTok: number;    // USD per 1M output tokens
  cacheReadPerMTok: number; // USD per 1M cache-read tokens (0 = no cache)
  contextWindow: number;    // max tokens
  sourceUrl: string;
}

export const CLOUD_MODELS: CloudModel[] = [
  // Source: https://platform.claude.com/docs/en/docs/about-claude/pricing (2026-04-19)
  {
    id: 'claude-opus-4-7',
    label: 'Claude Opus 4.7',
    provider: 'Anthropic',
    inputPerMTok: 5.00,
    outputPerMTok: 25.00,
    cacheReadPerMTok: 0.50,
    contextWindow: 1_000_000,
    sourceUrl: 'https://platform.claude.com/docs/en/docs/about-claude/pricing',
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    inputPerMTok: 3.00,
    outputPerMTok: 15.00,
    cacheReadPerMTok: 0.30,
    contextWindow: 1_000_000,
    sourceUrl: 'https://platform.claude.com/docs/en/docs/about-claude/pricing',
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    inputPerMTok: 1.00,
    outputPerMTok: 5.00,
    cacheReadPerMTok: 0.10,
    contextWindow: 200_000,
    sourceUrl: 'https://platform.claude.com/docs/en/docs/about-claude/pricing',
  },
  // Source: https://developers.openai.com/api/docs/pricing (2026-04-19)
  // Note: GPT-5 (original Aug-2025 release) is now "previous model". Using current GPT-5.4.
  {
    id: 'gpt-5-4',
    label: 'GPT-5.4',
    provider: 'OpenAI',
    inputPerMTok: 2.50,
    outputPerMTok: 15.00,
    cacheReadPerMTok: 0.25,
    contextWindow: 1_050_000,
    sourceUrl: 'https://developers.openai.com/api/docs/pricing',
  },
  {
    id: 'gpt-5-4-mini',
    label: 'GPT-5.4 mini',
    provider: 'OpenAI',
    inputPerMTok: 0.75,
    outputPerMTok: 4.50,
    cacheReadPerMTok: 0.075,
    contextWindow: 400_000,
    sourceUrl: 'https://developers.openai.com/api/docs/pricing',
  },
  // Source: https://ai.google.dev/gemini-api/docs/pricing (2026-04-19)
  // Note: Gemini 2.5 Pro pricing shown is for ≤200k context. >200k = $2.50 input / $15.00 output.
  {
    id: 'gemini-2-5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'Google',
    inputPerMTok: 1.25,
    outputPerMTok: 10.00,
    cacheReadPerMTok: 0.125,
    contextWindow: 1_000_000,
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
  },
  {
    id: 'gemini-2-5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'Google',
    inputPerMTok: 0.30,
    outputPerMTok: 2.50,
    cacheReadPerMTok: 0.03,
    contextWindow: 1_000_000,
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
  },
];

// ── Local hardware ────────────────────────────────────────────────────────────

export interface LocalModel {
  id: string;
  label: string;
  params: string;
  quant: string;
}

export interface LocalHardware {
  id: string;
  label: string;
  shortLabel: string;
  msrpUSD: number;
  tdpWatts: number;    // Conservative upper bound (TGP). Inference typically 60–85% of this.
  note: string;
  benchmarks: Record<string, number | null>; // modelId → decode tok/s; null = no published data
  sourceUrl: string;
}

export const LOCAL_MODELS: LocalModel[] = [
  { id: 'llama-3-1-8b', label: 'Llama 3.1 8B Q4_K_M', params: '8B', quant: 'Q4_K_M' },
  { id: 'llama-3-2-3b', label: 'Llama 3.2 3B Q4_K_M', params: '3B', quant: 'Q4_K_M' },
  { id: 'qwen-2-5-1-5b', label: 'Qwen 2.5 1.5B int4', params: '1.5B', quant: 'int4' },
  { id: 'mistral-7b', label: 'Mistral 7B v0.3 Q4_K_M', params: '7B', quant: 'Q4_K_M' },
];

export const LOCAL_HARDWARE: LocalHardware[] = [
  {
    id: 'pi-hat2',
    label: 'Raspberry Pi AI HAT+ 2 (Hailo-10H, 40 TOPS)',
    shortLabel: 'Pi AI HAT+ 2',
    msrpUSD: 130,
    // Measured inference draw 7.2–7.6W; using midpoint.
    // Source: https://www.cnx-software.com/2026/01/20/raspberry-pi-ai-hat-2-review (Jan 2026)
    tdpWatts: 7.4,
    note: 'Runs 1.5–3B models only. 7B+ models are not supported on any current Pi hardware.',
    benchmarks: {
      // Source: CNX-Software Pi AI HAT+ 2 review, January 2026
      // https://www.cnx-software.com/2026/01/20/raspberry-pi-ai-hat-2-review-a-40-tops-ai-accelerator-tested-with-computer-vision-llm-and-vlm-workloads/
      'llama-3-1-8b': null,    // model too large for Hailo-10H
      'llama-3-2-3b': 2.60,   // measured, Llama 3.2 3B int4
      'qwen-2-5-1-5b': 6.74,  // measured, Qwen 2.5 1.5B Instruct int4
      'mistral-7b': null,      // model too large for Hailo-10H
    },
    sourceUrl: 'https://www.cnx-software.com/2026/01/20/raspberry-pi-ai-hat-2-review-a-40-tops-ai-accelerator-tested-with-computer-vision-llm-and-vlm-workloads/',
  },
  {
    id: 'rtx-5060-8gb',
    label: 'NVIDIA RTX 5060 8GB ($299)',
    shortLabel: 'RTX 5060 8GB',
    msrpUSD: 299,
    // TGP per NVIDIA spec; inference draw typically lower.
    // Source: https://videocardz.com/newz/nvidia-geforce-rtx-5060-to-feature-3840-cuda-cores-150w-tgp-and-8gb-gddr7-memory
    tdpWatts: 150,
    note: 'Benchmarks via Ollama 0.9.5 Q4 quantization. Power draw is TGP upper bound.',
    benchmarks: {
      // Source: https://www.databasemart.com/blog/ollama-gpu-benchmark-rtx5060 (Ollama Q4)
      'llama-3-1-8b': 58,
      'llama-3-2-3b': null, // no published benchmark for this combo
      'qwen-2-5-1-5b': null,
      'mistral-7b': 73,
    },
    sourceUrl: 'https://www.databasemart.com/blog/ollama-gpu-benchmark-rtx5060',
  },
  {
    id: 'rtx-5060ti-16gb',
    label: 'NVIDIA RTX 5060 Ti 16GB ($429)',
    shortLabel: 'RTX 5060 Ti 16GB',
    msrpUSD: 429,
    // TGP per Tom's Hardware RTX 5060 Ti review.
    // Source: https://www.tomshardware.com/pc-components/gpus/nvidia-geforce-rtx-5060-ti-16gb-review/9
    tdpWatts: 180,
    note: 'Benchmark uses llama.cpp Q4_K_M (highest-quality source available). Power draw is TGP upper bound.',
    benchmarks: {
      // Source: https://www.localscore.ai/accelerator/860 (llama.cpp Q4_K_M)
      'llama-3-1-8b': 60,
      'llama-3-2-3b': null,
      'qwen-2-5-1-5b': null,
      'mistral-7b': null,
    },
    sourceUrl: 'https://www.localscore.ai/accelerator/860',
  },
];

// ── Calculation helpers ────────────────────────────────────────────────────────

export interface ApiCostResult {
  model: CloudModel;
  perDay: number;
  perMonth: number;
  perYear: number;
}

export function calcApiCost(
  model: CloudModel,
  inputPerDay: number,
  outputPerDay: number,
  cacheHitRate: number, // 0–1
): ApiCostResult {
  const cacheRate = Math.min(Math.max(cacheHitRate, 0), 1);
  const regularInput = inputPerDay * (1 - cacheRate);
  const cacheRead = inputPerDay * cacheRate;
  const perDay =
    (regularInput * model.inputPerMTok +
      cacheRead * model.cacheReadPerMTok +
      outputPerDay * model.outputPerMTok) /
    1_000_000;
  return { model, perDay, perMonth: perDay * 30, perYear: perDay * 365 };
}

export interface LocalTCOResult {
  hardware: LocalHardware;
  localModel: LocalModel;
  tokPerSec: number;
  inferenceHoursPerDay: number;
  electricityPerMonth: number;
  hardwarePerMonth: number;
  totalPerMonth: number;
  effectiveCostPerMTok: number;
}

export function calcLocalTCO(
  hardware: LocalHardware,
  localModel: LocalModel,
  tokensPerDay: number,
  electricityRateUSDkWh: number,
  amortYears: number,
): LocalTCOResult | null {
  const tokPerSec = hardware.benchmarks[localModel.id];
  if (!tokPerSec) return null;

  const inferenceSecsPerDay = tokensPerDay / tokPerSec;
  const inferenceHoursPerDay = inferenceSecsPerDay / 3600;
  const kWhPerDay = inferenceHoursPerDay * (hardware.tdpWatts / 1000);
  const electricityPerMonth = kWhPerDay * 30 * electricityRateUSDkWh;
  const hardwarePerMonth = hardware.msrpUSD / (amortYears * 12);
  const totalPerMonth = electricityPerMonth + hardwarePerMonth;
  const tokensPerMonth = tokensPerDay * 30;
  const effectiveCostPerMTok = tokensPerMonth > 0 ? (totalPerMonth / tokensPerMonth) * 1_000_000 : 0;

  return {
    hardware,
    localModel,
    tokPerSec,
    inferenceHoursPerDay,
    electricityPerMonth,
    hardwarePerMonth,
    totalPerMonth,
    effectiveCostPerMTok,
  };
}

export interface BreakEvenResult {
  breaksEven: boolean;
  breakEvenMonth?: number;
  totalCloud36mo: number;
  totalLocal36mo: number;
  savings36mo: number;
  monthlySavingsAfterBreakEven?: number;
  monthlyRows: { month: number; cloudCumulative: number; localCumulative: number }[];
}

export function calcBreakEven(
  cloudPerMonth: number,
  localTCO: LocalTCOResult,
): BreakEvenResult {
  const { msrpUSD } = localTCO.hardware;
  const localRunningPerMonth = localTCO.electricityPerMonth;
  const monthlySavings = cloudPerMonth - localRunningPerMonth;

  const monthlyRows = Array.from({ length: 36 }, (_, i) => ({
    month: i + 1,
    cloudCumulative: cloudPerMonth * (i + 1),
    localCumulative: msrpUSD + localRunningPerMonth * (i + 1),
  }));

  const totalCloud36mo = cloudPerMonth * 36;
  const totalLocal36mo = msrpUSD + localRunningPerMonth * 36;
  const savings36mo = totalCloud36mo - totalLocal36mo;

  if (monthlySavings <= 0) {
    return { breaksEven: false, totalCloud36mo, totalLocal36mo, savings36mo, monthlyRows };
  }

  const breakEvenMonth = Math.ceil(msrpUSD / monthlySavings);
  return {
    breaksEven: true,
    breakEvenMonth,
    totalCloud36mo,
    totalLocal36mo,
    savings36mo,
    monthlySavingsAfterBreakEven: monthlySavings,
    monthlyRows,
  };
}
