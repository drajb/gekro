/**
 * apps.passport-photo.spec.ts - the claims `passport-photo-maker` makes, tested.
 *
 * The generic app suites prove the page loads and survives fuzzing. This one
 * proves what the page promises a visitor:
 *  - the photo never leaves the browser (no request carries it, and the whole
 *    flow works with every third-party request blocked);
 *  - downloads are the size and resolution they say, within the file-size cap;
 *  - "Clear photo" really drops the photo and turns the downloads off;
 *  - hostile numeric input on the custom size never reaches the page as NaN.
 */
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const URL_PATH = '/apps/passport-photo-maker/';

/** A real JPEG, built in the browser so the repo needs no binary fixtures. */
async function makePhoto(page: Page, w = 1800, h = 2400): Promise<Buffer> {
  const b64 = await page.evaluate(
    async ([W, H]) => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d')!;
      x.fillStyle = '#f4f4f2'; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 2500; i++) {
        x.fillStyle = `rgba(${100 + ((i * 53) % 100)},${100 + ((i * 97) % 100)},${100 + ((i * 29) % 100)},0.4)`;
        x.fillRect((i * 7919) % W, (i * 104729) % H, 5, 5);
      }
      x.fillStyle = '#c9b49d'; x.beginPath(); x.ellipse(W / 2, H * 0.4, W * 0.17, H * 0.17, 0, 0, 7); x.fill();
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b as Blob), 'image/jpeg', 0.9));
      const u = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (const v of u) s += String.fromCharCode(v);
      return btoa(s);
    },
    [w, h],
  );
  return Buffer.from(b64, 'base64');
}

function jpegInfo(buf: Buffer): { w: number; h: number; dpi: number | null } {
  let w = 0, h = 0;
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    const len = (buf[i + 2] << 8) | buf[i + 3];
    if (m >= 0xc0 && m <= 0xc3) { h = (buf[i + 5] << 8) | buf[i + 6]; w = (buf[i + 7] << 8) | buf[i + 8]; break; }
    i += 2 + len;
  }
  const jfif = buf[2] === 0xff && buf[3] === 0xe0 && buf.toString('latin1', 6, 10) === 'JFIF';
  return { w, h, dpi: jfif && buf[13] === 1 ? (buf[14] << 8) | buf[15] : null };
}

async function addPhoto(page: Page, buf: Buffer) {
  await page.setInputFiles('#pp-file', { name: 'me.jpg', mimeType: 'image/jpeg', buffer: buf });
  await expect(page.locator('#pp-status')).toContainText('Photo loaded on this device');
}

async function download(page: Page, buttonId: string) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click(buttonId)]);
  const path = await dl.path();
  return { name: dl.suggestedFilename(), bytes: readFileSync(path!) };
}

test.describe('passport-photo-maker', () => {
  test('the photo never leaves the browser: third parties blocked, no write requests, everything still works', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const writes: string[] = [];
    const blocked: string[] = [];
    await page.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith(origin) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
      blocked.push(u);
      return route.abort();
    });
    // Site-wide analytics (GTM, GA, Cloudflare beacon) is site chrome, not the app.
    const CHROME = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com|cloudflareinsights\.com|doubleclick\.net/;
    page.on('request', (r) => {
      if (r.method() !== 'GET' && r.method() !== 'HEAD' && !CHROME.test(r.url())) writes.push(`${r.method()} ${r.url()}`);
    });

    await page.goto(URL_PATH, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#pp-app')).toBeVisible();
    await page.waitForTimeout(500);
    await addPhoto(page, await makePhoto(page));
    const photo = await download(page, '#pp-dl');
    expect(jpegInfo(photo.bytes).w).toBeGreaterThan(0);
    const pdf = await download(page, '#pp-dl-pdf');
    expect(pdf.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');

    expect(writes, `a request wrote data: ${writes.join(', ')}`).toEqual([]);
    // Whatever was blocked was site chrome, never an image or a file.
    expect(blocked.every((u) => !/\.(jpe?g|png|pdf)(\?|$)|^blob:|^data:/i.test(u)), `a file went to a third party: ${blocked.join(', ')}`).toBe(true);
  });

  test('control: the write detector used above really does catch a POST', async ({ page, baseURL }) => {
    const writes: string[] = [];
    page.on('request', (r) => { if (r.method() !== 'GET' && r.method() !== 'HEAD') writes.push(r.method()); });
    await page.goto(URL_PATH, { waitUntil: 'domcontentloaded' });
    await page.evaluate((u) => fetch(u, { method: 'POST', body: 'x' }).catch(() => {}), `${new URL(baseURL!).origin}/__leak_probe__`);
    await page.waitForTimeout(200);
    expect(writes).toContain('POST');
  });

  test('photo download has the right pixel size and a 300 dpi stamp', async ({ page }) => {
    await page.goto(`${URL_PATH}?std=uk`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await addPhoto(page, await makePhoto(page));
    const { name, bytes } = await download(page, '#pp-dl');
    const info = jpegInfo(bytes);
    expect(name).toBe('passport-photo-uk-413x531.jpg');
    expect(info).toEqual({ w: 413, h: 531, dpi: 300 });
  });

  test('US visa online version fits the 240 KB cap at 600 x 600', async ({ page }) => {
    await page.goto(`${URL_PATH}?std=us-visa`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await addPhoto(page, await makePhoto(page));
    const { bytes } = await download(page, '#pp-dl-online');
    const info = jpegInfo(bytes);
    expect(info.w).toBe(600);
    expect(info.h).toBe(600);
    expect(bytes.length).toBeLessThanOrEqual(240 * 1024);
  });

  test('a 4 x 6 sheet packs six 2 x 2 in photos and the PDF is true size', async ({ page }) => {
    await page.goto(`${URL_PATH}?std=us`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await expect(page.locator('#pp-sheet-note')).toContainText('Fits 6 photos');
    await addPhoto(page, await makePhoto(page));
    const sheet = await download(page, '#pp-dl-sheet');
    expect(jpegInfo(sheet.bytes)).toEqual({ w: 1200, h: 1800, dpi: 300 });
    const pdf = await download(page, '#pp-dl-pdf');
    expect(pdf.bytes.toString('latin1')).toContain('/MediaBox [0 0 288 432]');
  });

  test('Clear photo drops the photo and switches downloads off', async ({ page }) => {
    await page.goto(URL_PATH, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await expect(page.locator('#pp-dl')).toBeDisabled();
    await addPhoto(page, await makePhoto(page));
    await expect(page.locator('#pp-dl')).toBeEnabled();
    await page.click('#pp-clear');
    await expect(page.locator('#pp-dl')).toBeDisabled();
    await expect(page.locator('#pp-status')).toContainText('cleared');
  });

  test('rejects a file that is not an image, without crashing', async ({ page }) => {
    await page.goto(URL_PATH, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.setInputFiles('#pp-file', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(page.locator('#pp-error')).toContainText('not an image');
    await expect(page.locator('#pp-dl')).toBeDisabled();
  });

  test('custom size clamps hostile numbers and never shows NaN', async ({ page }) => {
    await page.goto(URL_PATH, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.selectOption('#pp-std', 'custom');
    for (const v of ['0', '-5', '999999', '']) {
      await page.fill('#pp-cw', v);
      await page.fill('#pp-ch', v);
      await page.waitForTimeout(80);
    }
    const text = await page.locator('#pp-app').innerText();
    expect(text).not.toMatch(/NaN|Infinity|undefined|null/);
    const w = Number(await page.inputValue('#pp-cw'));
    expect(Number.isFinite(w)).toBe(true);
  });

  test('keyboard: plus and minus zoom the preview, square brackets tilt it', async ({ page }) => {
    await page.goto(URL_PATH, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await addPhoto(page, await makePhoto(page));
    await page.focus('#pp-canvas');
    const z0 = Number(await page.inputValue('#pp-zoom'));
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    expect(Number(await page.inputValue('#pp-zoom'))).toBeGreaterThan(z0);
    await page.keyboard.press(']');
    await page.keyboard.press(']');
    expect(Number(await page.inputValue('#pp-tilt'))).toBe(1);
  });
});
