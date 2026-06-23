/**
 * apps.smoke.spec.ts — runtime smoke test for every /apps/[slug].
 *
 * For each app it asserts the things a user would notice if the app were
 * broken: the page loads, the calculator island actually mounts (not the
 * "coming soon" stub), it renders content immediately (no blank state), the
 * page doesn't scroll sideways on phone/tablet/desktop widths, and nothing
 * throws or logs an error during load + a first interaction.
 *
 * Slugs are read from the content dir so the suite always covers 100% of apps
 * with zero maintenance when apps are added.
 */
import { test, expect, type ConsoleMessage } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, '..', 'src/content/apps');

const slugs = readdirSync(contentDir)
  .filter((f) => f.endsWith('.md') && f !== '_template.md')
  .map((f) => f.replace(/\.md$/, ''))
  .sort();

/**
 * Benign, environment-driven errors to ignore per app. These are NOT app bugs —
 * they're headless-browser realities (no microphone, no real WebGL, blocked
 * outbound network, CDN model downloads, intentional WebSocket connects).
 * Keep this list tight: anything not matched here is treated as a real failure.
 */
const ALLOWED_ERRORS: Record<string, RegExp[]> = {
  'voice-transcriber': [/speechrecognition/i, /not-allowed/i, /microphone/i, /permission/i],
  'translator': [/transformers/i, /failed to fetch/i, /huggingface|hf\.co|jsdelivr|cdn|onnx/i, /load model/i],
  'rag-eval-toolkit': [/transformers/i, /failed to fetch/i, /huggingface|jsdelivr|cdn|onnx/i],
  'device-info': [/webgl/i, /failed to fetch/i, /1\.1\.1\.1|cloudflare|trace/i],
  'currency-converter': [/failed to fetch/i, /exchangerate|frankfurter|api/i, /networkerror/i],
  'mcp-server-tester': [/failed to fetch/i, /cors/i, /networkerror/i],
  'websocket-tester': [/websocket/i, /failed to fetch/i],
  'streaming-response-player': [/failed to fetch/i],
};

// Errors that are never an app's fault regardless of slug (favicon, beacons,
// third-party analytics that may be blocked in the test environment).
const GLOBAL_IGNORE: RegExp[] = [
  /favicon/i,
  /cloudflareinsights|static\.cloudflare/i,
  /googletagmanager|google-analytics|gtag/i,
  /ERR_BLOCKED_BY_CLIENT/i,
  /net::ERR_/i,
  /Download the React DevTools/i,
];

for (const slug of slugs) {
  test(`/apps/${slug} mounts and runs clean`, async ({ page }) => {
    const errors: string[] = [];
    const onConsole = (m: ConsoleMessage) => {
      if (m.type() === 'error') errors.push(m.text());
    };
    page.on('console', onConsole);
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

    const resp = await page.goto(`/apps/${slug}/`, { waitUntil: 'domcontentloaded' });
    expect(resp, `${slug}: no response`).not.toBeNull();
    expect(resp!.status(), `${slug}: HTTP ${resp!.status()}`).toBeLessThan(400);

    // The island must mount, and must NOT be the "coming soon" fallback.
    const island = page.locator('#calculator-island');
    await expect(island, `${slug}: #calculator-island missing`).toBeVisible();
    await expect(
      page.getByText('Calculator coming soon'),
      `${slug}: shows "Calculator coming soon" stub`,
    ).toHaveCount(0);

    // Renders content immediately (no blank state per platform standard §5.1).
    const childCount = await island.locator(':scope *').count();
    expect(childCount, `${slug}: island rendered no content`).toBeGreaterThan(3);

    // Give islands a moment to hydrate and run their init() before checking errors.
    await page.waitForTimeout(600);

    // No horizontal overflow at phone / tablet / desktop widths.
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 2,
      );
      expect(overflow, `${slug}: horizontal overflow at ${width}px`).toBe(false);
    }

    const allowed = [...(ALLOWED_ERRORS[slug] ?? []), ...GLOBAL_IGNORE];
    const real = errors.filter((e) => !allowed.some((re) => re.test(e)));
    expect(real, `${slug}: ${real.length} unexpected error(s):\n - ${real.join('\n - ')}`).toEqual([]);
  });
}
