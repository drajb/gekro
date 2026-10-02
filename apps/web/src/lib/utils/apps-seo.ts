/**
 * SEO helpers for the /apps section (added 2026-10-02).
 *
 * One place for: per-category landing-page copy, the schema.org
 * applicationCategory mapping, the CTR-oriented <title> builder, and the
 * related-apps ranking used for internal links at the bottom of every app.
 *
 * Kept free of astro:content imports so vitest can exercise it directly.
 */

export type AppCategory = 'ai' | 'infra' | 'ev' | 'trading' | 'dev' | 'finance' | 'fun' | 'health';

export interface CategoryMeta {
  /** Short chip label, matches AppShell / AppCard. */
  label: string;
  /** H1 on the category hub. */
  heading: string;
  /** Full <title>, kept at or under 60 characters. */
  title: string;
  /** Meta description, kept at or under 160 characters. */
  description: string;
  /** One-paragraph intro on the hub page. */
  intro: string;
  /** schema.org applicationCategory for SoftwareApplication. */
  schemaCategory: string;
}

/** Hubs are only generated for categories with at least this many live apps. */
export const MIN_APPS_FOR_HUB = 3;

export const CATEGORY_META: Record<AppCategory, CategoryMeta> = {
  ai: {
    label: 'AI',
    heading: 'Free AI engineering tools',
    title: 'Free AI Engineering Tools & LLM Calculators | gekro',
    description:
      'Free browser tools for AI engineers: LLM cost and token calculators, VRAM and latency estimators, prompt, RAG and MCP inspectors. No login, nothing uploaded.',
    intro:
      'These are the tools I reach for while building with LLMs: pricing and token math, GPU memory sizing, local-model configuration, prompt and RAG debugging, and MCP tracing. Every one runs entirely in your browser, uses sourced data with a visible verification date, and never asks for an API key.',
    schemaCategory: 'DeveloperApplication',
  },
  dev: {
    label: 'Dev',
    heading: 'Free online developer tools',
    title: 'Free Developer Tools - Formatters & Converters | gekro',
    description:
      'Free in-browser developer tools: JSON formatter, regex tester, diff checker, JWT decoder, hash and Base64 encoders, PDF merger. Nothing leaves your device.',
    intro:
      'Everyday developer utilities without the ad-stuffed pages or the upload step: format and validate data, test regular expressions, diff text, decode tokens, convert configs, and handle images and PDFs locally. Your input stays on your machine because there is no server to send it to.',
    schemaCategory: 'DeveloperApplication',
  },
  finance: {
    label: 'Finance',
    heading: 'Free finance calculators',
    title: 'Free Finance Calculators - Loans, Tax & Salary | gekro',
    description:
      'Free finance calculators: loan amortization, debt-to-income, currency conversion, India CTC to in-hand salary, old vs new tax regime and tax-loss harvesting.',
    intro:
      'Personal-finance calculators I built for my own decisions, with the formulas shown and the assumptions editable. Tax constants carry a verification date, and nothing you type is stored or sent anywhere.',
    schemaCategory: 'FinanceApplication',
  },
  trading: {
    label: 'Trading',
    heading: 'Free trading calculators',
    title: 'Free Trading Calculators - Position Size & Options | gekro',
    description:
      'Free trading calculators: position sizing by risk, options profit and loss with Greeks, and drawdown with Sharpe and Sortino ratios. Runs in your browser.',
    intro:
      'Risk-first trading math: size a position from the stop distance, chart an options payoff with its Greeks, and measure drawdown and risk-adjusted returns. These are educational tools, not advice, and they never connect to a broker.',
    schemaCategory: 'FinanceApplication',
  },
  ev: {
    label: 'EV',
    heading: 'Free EV and Tesla calculators',
    title: 'Free EV & Tesla Calculators - Trips & Charging | gekro',
    description:
      'Free EV calculators: Tesla road-trip energy and charging stops, cheapest overnight charging window, and EV charging cost versus gas. No login required.',
    intro:
      'Calculators from living with a Tesla Model Y in Texas: plan trip energy and charging stops, find the cheapest time-of-use window to charge at home, and compare charging cost against gas.',
    schemaCategory: 'UtilitiesApplication',
  },
  infra: {
    label: 'Infra',
    heading: 'Free self-hosting and config generators',
    title: 'Free Nginx, systemd & SSH Config Generators | gekro',
    description:
      'Free config generators for self-hosters: nginx server blocks, systemd unit files, SSH config, Docker Compose visualizer and a device info checker.',
    intro:
      'Config generators from running a Raspberry Pi 5 cluster at home: nginx with sane TLS and security headers, hardened systemd units, SSH host aliases with jump hosts, and a Docker Compose dependency map.',
    schemaCategory: 'DeveloperApplication',
  },
  fun: {
    label: 'Fun',
    heading: 'Fun browser tools',
    title: 'Fun Browser Tools - Dice, Coin Flip & World Clock | gekro',
    description:
      'Small fun tools that run in your browser: a fair dice roller, a coin flipper using the Web Crypto API, a multi-timezone world clock and an ambigram maker.',
    intro:
      'Small tools that do one thing well. Randomness comes from the browser crypto API rather than Math.random, and nothing is tracked.',
    schemaCategory: 'EntertainmentApplication',
  },
  health: {
    label: 'Health',
    heading: 'Free health calculators',
    title: 'Free Health Calculators | gekro',
    description: 'Free health calculators that run in your browser. Informational only, not medical advice.',
    intro: 'Informational health calculators. Not medical advice.',
    schemaCategory: 'HealthApplication',
  },
};

export const categoryHubUrl = (cat: string) => `/apps/category/${cat}/`;

/**
 * <title> for an app page. Tool searches ("json formatter", "llm cost
 * calculator") reward titles that confirm the tool is free and online, so the
 * modifier is added whenever it fits Google's ~60-character display width,
 * falling back to shorter variants and finally the bare name.
 */
export const TITLE_MAX = 60;
export const appPageTitle = (title: string): string => {
  const t = title.trim();
  const candidates = [`${t} - Free Online Tool | gekro`, `${t} - Free Tool | gekro`, `${t} | gekro`];
  return candidates.find(c => c.length <= TITLE_MAX) ?? candidates[candidates.length - 1];
};

export interface RelatableApp {
  id: string;
  data: { title: string; job: string; category: string; companionPostSlug?: string };
}

const STOP = new Set([
  'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'is', 'it', 'of', 'on', 'or', 'the',
  'to', 'vs', 'with', 'your', 'you', 'any', 'see', 'get', 'how', 'what', 'one', 'all', 'per', 'that',
  'this', 'tool', 'free', 'online', 'paste', 'calculator', 'generator',
]);

const tokens = (s: string): Set<string> =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(w => w.length > 1 && !STOP.has(w)),
  );

/**
 * Rank other apps by relatedness: same category first, then shared words in
 * title + job (title words count double), then a shared companion post. Ties
 * break alphabetically so the output is deterministic across builds.
 */
export const relatedApps = <T extends RelatableApp>(app: T, all: T[], n = 4): T[] => {
  const mine = tokens(`${app.data.title} ${app.data.title} ${app.data.job}`);
  const titleMine = tokens(app.data.title);
  const scored = all
    .filter(a => a.id !== app.id)
    .map(a => {
      const theirs = tokens(`${a.data.title} ${a.data.job}`);
      const titleTheirs = tokens(a.data.title);
      let overlap = 0;
      for (const w of theirs) if (mine.has(w)) overlap += 1;
      for (const w of titleTheirs) if (titleMine.has(w)) overlap += 1;
      let score = overlap;
      if (a.data.category === app.data.category) score += 3;
      if (app.data.companionPostSlug && a.data.companionPostSlug === app.data.companionPostSlug) score += 2;
      return { a, score };
    })
    .sort((x, y) => y.score - x.score || x.a.data.title.localeCompare(y.a.data.title));
  return scored.slice(0, n).map(s => s.a);
};
