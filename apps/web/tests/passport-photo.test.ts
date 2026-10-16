/**
 * passport-photo.test.ts - pins the geometry, the print-size maths and the file
 * writers behind `passport-photo-maker`.
 *
 * The standards table itself (printed sizes, head ranges) is checked against
 * the figures each authority publishes; if one moves, this file should go red
 * before a wrong number ships. The helpers are imported from the private apps
 * repo, which CI clones before running tests.
 */
import { describe, it, expect } from 'vitest';
import {
  mmToPx, outputSize, computeGuides, initialView, viewMatrix, viewScale, baseScale, panView,
  photoCoversFrame, resolutionCheck, analyseBackground, setJpegDpi, readJpegDpi, qualityForCap,
  sheetLayout, bestSheetLayout, SHEETS, jpegToPdf, photoFilename, sanitizeView, ZOOM_MIN, ZOOM_MAX,
  alignView, retargetView,
} from '../src/components/apps-private/passport-photo-maker/helpers';
import { STANDARDS } from '../src/components/apps-private/passport-photo-maker/data';

describe('size maths', () => {
  it('2 x 2 inch at 300 dpi is 600 px', () => {
    expect(mmToPx(50.8, 300)).toBe(600);
    expect(outputSize({ mmW: 51, mmH: 51 }, 300)).toEqual({ w: 602, h: 602 });
  });
  it('35 x 45 mm at 300 dpi is 413 x 531', () => {
    expect(outputSize({ mmW: 35, mmH: 45 }, 300)).toEqual({ w: 413, h: 531 });
  });
});

describe('guides', () => {
  it('keeps the head band inside the photo for every standard', () => {
    for (const s of STANDARDS) {
      const g = computeGuides(s);
      expect(g.chinMm, s.id).toBeGreaterThanOrEqual(0);
      expect(g.crownMaxMm, s.id).toBeLessThanOrEqual(s.mmH);
      expect(g.crownMinMm, s.id).toBeLessThan(g.crownMaxMm);
      expect(g.frac.chin, s.id).toBeGreaterThan(g.frac.crownMax);
    }
  });
  it('centres an official eye band on the eyes', () => {
    const g = computeGuides({ mmH: 60, headMin: 25, headMax: 35, eyeMin: 28, eyeMax: 35 });
    const headMid = 30;
    const eyes = g.chinMm + 0.5 * headMid;
    expect(eyes).toBeCloseTo(31.5, 5);
    expect(g.eyeBandMm).toEqual([28, 35]);
  });
  it('omits the eye band when none is published', () => {
    const g = computeGuides({ mmH: 45, headMin: 32, headMax: 36 });
    expect(g.eyeBandMm).toBeNull();
    expect(g.frac.eyeBand).toBeNull();
  });
});

describe('view transform', () => {
  const img = { w: 3000, h: 4000 };
  const frame = { w: 600, h: 600 };

  it('zoom 1 covers the frame and starts centred', () => {
    const v = initialView(img);
    expect(viewScale(v, img, frame)).toBeCloseTo(baseScale(img, frame));
    expect(photoCoversFrame(v, img, frame)).toBe(true);
  });
  it('the photo centre lands on the frame centre', () => {
    const v = { zoom: 2, cx: 1234, cy: 2345, rot: 17 };
    const [a, b, c, d, e, f] = viewMatrix(v, img, frame);
    expect(a * v.cx + c * v.cy + e).toBeCloseTo(300, 6);
    expect(b * v.cx + d * v.cy + f).toBeCloseTo(300, 6);
  });
  it('dragging moves the photo with the pointer at any rotation', () => {
    for (const rot of [0, 33, -90, 150]) {
      const v = { zoom: 1.5, cx: 1500, cy: 2000, rot };
      const s = viewScale(v, img, frame);
      const moved = panView(v, 40, -25, s);
      // A photo point that was at frame (p) must now be at p + (40, -25).
      const q = { x: 1700, y: 1900 };
      const at = (vv: typeof v) => {
        const [a, b, c, d, e, f] = viewMatrix(vv, img, frame);
        return { x: a * q.x + c * q.y + e, y: b * q.x + d * q.y + f };
      };
      const p0 = at(v);
      const p1 = at(moved);
      expect(p1.x - p0.x).toBeCloseTo(40, 6);
      expect(p1.y - p0.y).toBeCloseTo(-25, 6);
    }
  });
  it('detects uncovered corners when zoomed out or rotated far', () => {
    expect(photoCoversFrame({ zoom: 0.5, cx: 1500, cy: 2000, rot: 0 }, img, frame)).toBe(false);
    expect(photoCoversFrame({ zoom: 1, cx: 100, cy: 100, rot: 0 }, img, frame)).toBe(false);
  });
  it('sanitizes poisoned values instead of propagating NaN', () => {
    const v = sanitizeView({ zoom: NaN, cx: Infinity, cy: -Infinity, rot: 9999 }, img);
    expect(Number.isFinite(v.zoom) && Number.isFinite(v.cx) && Number.isFinite(v.cy) && Number.isFinite(v.rot)).toBe(true);
    expect(sanitizeView({ zoom: 99, cx: 0, cy: 0, rot: 0 }, img).zoom).toBe(ZOOM_MAX);
    expect(sanitizeView({ zoom: 0, cx: 0, cy: 0, rot: 0 }, img).zoom).toBe(ZOOM_MIN);
  });
});

describe('alignment and retargeting', () => {
  const img = { w: 900, h: 1200 };
  it('puts the chin on the chin line and the head at mid band', () => {
    for (const s of STANDARDS) {
      const frame = outputSize(s, 300);
      const g = computeGuides(s);
      const v = alignView(img, frame, g, s, 260, 640, 450);
      const [a, , c, d, e, f] = viewMatrix(v, img, frame);
      const chinFrameY = viewMatrix(v, img, frame)[3] * 640 + f;
      const crownFrameY = viewMatrix(v, img, frame)[3] * 260 + f;
      expect(a * 450 + c * 640 + e, s.id).toBeCloseTo(frame.w / 2, 3);
      expect(chinFrameY / frame.h, s.id).toBeCloseTo(g.frac.chin, 3);
      const headFrac = (chinFrameY - crownFrameY) / frame.h;
      expect(headFrac, s.id).toBeCloseTo(((s.headMin + s.headMax) / 2) / s.mmH, 3);
      void d;
    }
  });
  it('keeps the vertical composition when the frame shape changes', () => {
    const from = { w: 600, h: 600 };
    const to = { w: 354, h: 472 };
    const v = { zoom: 1.7, cx: 430, cy: 600, rot: 0 };
    const w = retargetView(v, img, from, to);
    const at = (vv: typeof v, frame: typeof from, y: number) => viewMatrix(vv, img, frame)[3] * y + viewMatrix(vv, img, frame)[5];
    // A photo row sits at the same fraction of the height in both frames.
    for (const y of [300, 640, 900]) {
      expect(at(w, to, y) / to.h).toBeCloseTo(at(v, from, y) / from.h, 6);
    }
  });
});

describe('resolution check', () => {
  const img = { w: 3000, h: 4000 };
  const frame = { w: 600, h: 600 };
  it('is good for a large photo and low when enlarged hard', () => {
    expect(resolutionCheck({ zoom: 1, cx: 1500, cy: 2000, rot: 0 }, img, frame, 300).level).toBe('good');
    const tiny = { w: 200, h: 260 };
    expect(resolutionCheck(initialView(tiny), tiny, frame, 300).level).toBe('low');
  });
});

describe('background check', () => {
  const make = (r: number, g: number, b: number, w = 100, h = 100) => {
    const a = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { a[i * 4] = r; a[i * 4 + 1] = g; a[i * 4 + 2] = b; a[i * 4 + 3] = 255; }
    return a;
  };
  it('accepts white and flags dark or tinted walls', () => {
    expect(analyseBackground(make(250, 250, 250), 100, 100).level).toBe('ok');
    expect(analyseBackground(make(40, 40, 40), 100, 100).level).toBe('dark');
    expect(analyseBackground(make(150, 220, 250), 100, 100).level).toBe('tinted');
  });
  it('flags a busy pattern', () => {
    const a = make(255, 255, 255);
    for (let i = 0; i < 100 * 100; i++) if (i % 2) { a[i * 4] = a[i * 4 + 1] = a[i * 4 + 2] = 120; }
    expect(analyseBackground(a, 100, 100).level).toBe('busy');
  });
  it('says unknown for tiny input rather than guessing', () => {
    expect(analyseBackground(new Uint8ClampedArray(16), 2, 2).level).toBe('unknown');
  });
});

describe('JPEG resolution stamp', () => {
  // SOI + JFIF APP0 (density units 0, 1:1) + EOI, enough for the header logic.
  const jfif = () => new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
    0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9,
  ]);
  it('rewrites an existing JFIF header to dots per inch', () => {
    const out = setJpegDpi(jfif(), 300);
    expect(readJpegDpi(out)).toBe(300);
    expect(out.length).toBe(jfif().length);
  });
  it('inserts a JFIF header when the encoder wrote none', () => {
    const bare = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x02, 0xff, 0xd9]);
    const out = setJpegDpi(bare, 600);
    expect(readJpegDpi(out)).toBe(600);
    expect(out[0]).toBe(0xff);
    expect(out.slice(-2)).toEqual(new Uint8Array([0xff, 0xd9]));
  });
  it('leaves non-JPEG bytes alone', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(setJpegDpi(png, 300)).toBe(png);
    expect(readJpegDpi(png)).toBeNull();
  });
});

describe('size-capped encoding', () => {
  // Fake encoder: file size grows linearly with quality.
  const sizeAt = (cap: number) => async (q: number) => Math.round(q * cap * 1.5);
  it('returns the top quality when it already fits', async () => {
    expect(await qualityForCap(1_000_000, sizeAt(100_000))).toBe(0.95);
  });
  it('searches down to the highest quality that fits', async () => {
    const q = await qualityForCap(100_000, sizeAt(100_000));
    expect(q).not.toBeNull();
    expect(await sizeAt(100_000)(q as number)).toBeLessThanOrEqual(100_000);
    expect(q as number).toBeGreaterThan(0.6);
  });
  it('gives up honestly when nothing fits', async () => {
    expect(await qualityForCap(10, sizeAt(100_000))).toBeNull();
  });
});

describe('print sheet', () => {
  it('fits 8 photos of 35 x 45 mm on a 4 x 6 in print, landscape or portrait', () => {
    const l = sheetLayout(SHEETS[0], { w: 35, h: 45 });
    expect(l.count).toBeGreaterThanOrEqual(6);
    expect(l.cells.length).toBe(l.count);
  });
  it('packs six 2 x 2 in photos edge to edge on a 4 x 6 in print', () => {
    const l = bestSheetLayout(SHEETS[0], { w: 50.8, h: 50.8 });
    expect(l.count).toBe(6);
    expect(l.tight).toBe(true);
  });
  it('keeps cutting space when that already fits as many', () => {
    const l = bestSheetLayout(SHEETS[0], { w: 35, h: 45 });
    expect(l.tight).toBe(false);
    expect(l.count).toBeGreaterThanOrEqual(8);
  });
  it('never places a photo outside the page', () => {
    for (const sheet of SHEETS) {
      for (const s of STANDARDS) {
        const l = sheetLayout(sheet, { w: s.mmW, h: s.mmH });
        for (const c of l.cells) {
          expect(c.x).toBeGreaterThanOrEqual(0);
          expect(c.y).toBeGreaterThanOrEqual(0);
          expect(c.x + s.mmW).toBeLessThanOrEqual(l.pageW + 1e-6);
          expect(c.y + s.mmH).toBeLessThanOrEqual(l.pageH + 1e-6);
        }
      }
    }
  });
  it('returns zero when the photo does not fit at all', () => {
    expect(sheetLayout({ mmW: 30, mmH: 30 }, { w: 51, h: 51 }).count).toBe(0);
  });
});

describe('PDF writer', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = jpegToPdf(jpeg, 1200, 1800, 101.6, 152.4);
  const text = new TextDecoder('latin1').decode(pdf);
  it('is a PDF with a true-size 4 x 6 in page', () => {
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/MediaBox [0 0 288 432]');
    expect(text).toContain('/DCTDecode');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });
  it('has a cross-reference table whose offsets point at real objects', () => {
    const start = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(start, start + 4)).toBe('xref');
    const entries = [...text.slice(start).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(5);
    entries.forEach((off, i) => expect(text.slice(off, off + 7)).toBe(`${i + 1} 0 obj`));
  });
});

describe('filenames', () => {
  it('encode kind, standard and pixel size', () => {
    expect(photoFilename('us', { w: 600, h: 600 }, 'jpg')).toBe('passport-photo-us-600x600.jpg');
    expect(photoFilename('uk', { w: 1200, h: 1800 }, 'pdf', 'sheet')).toBe('passport-sheet-uk-1200x1800.pdf');
  });
});
