/**
 * og/render.ts — Branded Open Graph card renderer (1200×630 PNG)
 *
 * Generates a dark-themed OG card per post/experiment using sharp + SVG
 * compositing. No new dependencies: sharp is already in node_modules via
 * Astro's image pipeline.
 *
 * Why SVG-to-PNG instead of canvas or @vercel/og:
 *  - sharp ships with Astro; adding canvas or @vercel/og would pull in new
 *    native deps. An SVG template rendered via sharp.toBuffer('png') is
 *    zero-dependency and builds cleanly on Cloudflare Pages.
 *  - Text wrapping is handled manually in wrapTitle(); SVG's <text> element
 *    doesn't auto-wrap, so we split on word boundaries and emit <tspan>s.
 *
 * Output: 1200×630 PNG, matches og:image:width/height declared in SEOHead.
 *
 * Used by:
 *  src/pages/og/blog/[slug].png.ts
 *  src/pages/og/experiments/[slug].png.ts
 */

import sharp from 'sharp';

const W = 1200;
const H = 630;
const TITLE_FONT_SIZE = 64;
const MAX_TITLE_CHARS_PER_LINE = 28;
const MAX_TITLE_LINES = 4;

// XML entity escaping — titles can contain &, <, ", ' which break SVG
const escapeXml = (s: string): string =>
  s.replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[ch]!));

// Greedy word-wrap — splits on spaces, keeps each line under the char budget.
// Lines beyond MAX_TITLE_LINES are truncated with an ellipsis on the last.
const wrapTitle = (title: string): string[] => {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > MAX_TITLE_CHARS_PER_LINE && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length > MAX_TITLE_LINES) {
    const truncated = lines.slice(0, MAX_TITLE_LINES);
    truncated[MAX_TITLE_LINES - 1] = truncated[MAX_TITLE_LINES - 1].replace(/\.?\s*$/, '') + '…';
    return truncated;
  }
  return lines;
};

export interface OgCardInput {
  title: string;
  // Short label above the title (e.g. "Blog Post", "Experiment", topic name)
  eyebrow?: string;
  // ISO date string — rendered in the bottom-left badge if present
  date?: string;
}

export const renderOgCard = async ({ title, eyebrow, date }: OgCardInput): Promise<Buffer> => {
  const titleLines = wrapTitle(title);
  const lineHeight = TITLE_FONT_SIZE * 1.15;
  const titleStartY = H / 2 - ((titleLines.length - 1) * lineHeight) / 2 - 20;

  const tspans = titleLines.map((line, i) =>
    `<tspan x="80" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
  ).join('');

  const eyebrowText = eyebrow ? escapeXml(eyebrow.toUpperCase()) : 'GEKRO LAB';
  const dateText = date ? escapeXml(date) : '';

  // Dark navy gradient + accent glow in the bottom-right corner, mirrors the
  // site's hero aesthetic. Fonts fall back through the stack — OG rendering
  // happens at build time on the build runner, not the user's browser, so we
  // rely on sans-serif fallbacks being available in the sharp/librsvg bundle.
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050810"/>
      <stop offset="100%" stop-color="#0a1020"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0.85" r="0.5">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- Accent bar -->
  <rect x="80" y="80" width="64" height="4" fill="#3b82f6"/>

  <!-- Eyebrow / kicker -->
  <text x="80" y="120" font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
        font-size="20" fill="#3b82f6" letter-spacing="4">${eyebrowText}</text>

  <!-- Title (wrapped) -->
  <text x="80" y="${titleStartY}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
        font-size="${TITLE_FONT_SIZE}" font-weight="600" fill="#f5f7fa"
        dominant-baseline="middle">${tspans}</text>

  <!-- Bottom bar: brand + date -->
  <text x="80" y="${H - 80}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
        font-size="32" font-weight="600" fill="#f5f7fa">gekro<tspan fill="#3b82f6">.com</tspan></text>
  ${dateText ? `<text x="${W - 80}" y="${H - 80}" text-anchor="end"
        font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
        font-size="20" fill="#94a3b8">${dateText}</text>` : ''}
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
};
