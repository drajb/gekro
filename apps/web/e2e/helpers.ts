/**
 * helpers.ts — shared bits for the /apps e2e suites (smoke + interactions).
 */
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, '..', 'src/content/apps');

/** Every live app slug, derived from the content collection (zero maintenance). */
export const appSlugs = (): string[] =>
  readdirSync(contentDir)
    .filter((f) => f.endsWith('.md') && f !== '_template.md')
    .map((f) => f.replace(/\.md$/, ''))
    .sort();

/**
 * Benign, environment-driven errors to ignore per app. These are NOT app bugs —
 * they're headless-browser realities (no microphone, no real WebGL, blocked
 * outbound network, CDN model downloads, intentional WebSocket connects).
 * Keep this list tight: anything not matched is treated as a real failure.
 */
export const ALLOWED_ERRORS: Record<string, RegExp[]> = {
  'voice-transcriber': [/speechrecognition/i, /not-allowed/i, /microphone/i, /permission/i],
  'translator': [/transformers/i, /failed to fetch/i, /huggingface|hf\.co|jsdelivr|cdn|onnx/i, /load model/i],
  'rag-eval-toolkit': [/transformers/i, /failed to fetch/i, /huggingface|jsdelivr|cdn|onnx/i, /404/],
  'embedding-playground': [/transformers/i, /failed to fetch/i, /huggingface|jsdelivr|cdn|onnx/i, /404/, /model|embed/i],
  // html-to-image walks stylesheets during PNG export; cross-origin Google
  // Fonts CSS can't be read in headless and logs SecurityErrors while the
  // export itself still completes.
  'code-snippet-png': [/cssRules|CSSStyleSheet/i, /fonts\.googleapis/i, /remote (css|stylesheet)/i],
  'device-info': [/webgl/i, /failed to fetch/i, /1\.1\.1\.1|cloudflare|trace/i],
  'currency-converter': [/failed to fetch/i, /exchangerate|frankfurter|api/i, /networkerror/i],
  'mcp-server-tester': [/failed to fetch/i, /cors/i, /networkerror/i],
  'websocket-tester': [/websocket/i, /failed to fetch/i],
  'streaming-response-player': [/failed to fetch/i],
};

/**
 * Errors that are never an app's fault regardless of slug: favicon, analytics
 * beacons blocked in the test env, clipboard/fullscreen denied in headless,
 * and canceled downloads.
 */
export const GLOBAL_IGNORE: RegExp[] = [
  /favicon/i,
  // Pagefind's UI assets are emitted by the `pagefind` postbuild step and are
  // lazy-loaded by SearchWidget. Whether that request lands before a test's
  // error check is a race, so it surfaced as an intermittent 404 on whichever
  // app happened to be running. Matched via the URL that consoleText() appends
  // (the raw console text for a failed resource carries no URL at all).
  /\/pagefind\//i,
  /cloudflareinsights|static\.cloudflare/i,
  /googletagmanager|google-analytics|gtag/i,
  /ERR_BLOCKED_BY_CLIENT/i,
  /net::ERR_/i,
  /Download the React DevTools/i,
  /clipboard|NotAllowedError/i,
  /fullscreen/i,
  /download.*(cancell?ed|interrupted)/i,
];

export const isAllowed = (slug: string, msg: string): boolean =>
  [...(ALLOWED_ERRORS[slug] ?? []), ...GLOBAL_IGNORE].some((re) => re.test(msg));

/**
 * Console text for matching, with the offending URL appended.
 *
 * A failed sub-resource logs exactly "Failed to load resource: the server
 * responded with a status of 404 ()" - no URL - so allow-listing by message
 * alone would mean ignoring *every* 404, including real ones an app caused.
 * Playwright exposes the failing request URL on the message location, so we
 * fold it into the string the allow-lists are tested against. That keeps the
 * lists URL-precise instead of blanket-ignoring a status code.
 */
export const consoleText = (m: { text(): string; location(): { url?: string } }): string => {
  const url = m.location()?.url;
  return url ? `${m.text()} ${url}` : m.text();
};
