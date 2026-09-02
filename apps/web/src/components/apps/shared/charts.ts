/**
 * charts.ts — hand-rolled SVG chart primitives for the /apps calculators.
 *
 * Why not a charting library: every app on this site is client-only and the
 * homepage already cost us a Lighthouse incident from a heavy client bundle
 * (see decision log 2026-09-01). Chart.js is ~200KB, Recharts drags in React.
 * These are pure string builders with no runtime, no dependencies and no
 * animation, and they render at the same moment the numbers do.
 *
 * Contract for every function here:
 *  - Returns an SVG string. Callers drop it into innerHTML alongside their
 *    existing markup, which is how the calculators already render.
 *  - Colours come from design tokens only (design system locked 2026-05-03).
 *    Never introduce a literal hex here.
 *  - Responsive by viewBox, never by fixed pixel width.
 *  - role="img" plus an aria-label, because a chart that only exists visually
 *    is a chart half the audience cannot read. Callers must pass a real
 *    `ariaLabel` describing the finding, not the chart type.
 *  - Degenerate input (empty series, all zeros, NaN, Infinity) renders an
 *    empty frame rather than throwing or emitting NaN into the DOM.
 *  - Any caller-supplied label is escaped. Some of these apps chart text the
 *    user pasted in.
 */

/** Series colours, in the order a multi-series chart should consume them. */
export const SERIES_COLORS = [
  'var(--color-accent)',
  'var(--color-accent-success)',
  'var(--color-accent-warm)',
  'var(--color-accent-danger)',
  'var(--color-text-muted)',
] as const;

const AXIS = 'var(--color-border-subtle)';
const LABEL = 'var(--color-text-muted)';
const LABEL_STRONG = 'var(--color-text-secondary)';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c] || c);

/** Finite-or-zero. Keeps NaN and Infinity out of path data. */
const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Truncate a label so it cannot blow out the plot area. */
const clip = (s: string, max: number): string =>
  s.length > max ? s.slice(0, Math.max(0, max - 1)) + '…' : s;

const wrap = (inner: string, w: number, h: number, ariaLabel: string, extraClass = ''): string =>
  `<svg viewBox="0 0 ${w} ${h}" class="w-full h-auto ${extraClass}" role="img" aria-label="${esc(ariaLabel)}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;

const emptyFrame = (w: number, h: number, ariaLabel: string, msg = 'No data yet'): string =>
  wrap(
    `<rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="${AXIS}" stroke-width="1" rx="8"/>` +
      `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="middle" font-family="monospace" font-size="11" fill="${LABEL}">${esc(msg)}</text>`,
    w, h, ariaLabel,
  );

const defaultFmt = (v: number): string =>
  Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : String(Math.round(v * 100) / 100);

// ── Horizontal bars ─────────────────────────────────────────────────────────

export interface BarDatum {
  label: string;
  value: number;
  /** Overrides the palette for this bar. Use for pass/fail semantics. */
  color?: string;
  /** Small annotation drawn after the value, e.g. "fits" or "cheapest". */
  note?: string;
}

/**
 * Horizontal bar chart. The right choice whenever category labels are words
 * rather than numbers - model names, machine names, providers - because
 * horizontal bars give the label room without rotating text.
 */
export const barChart = (opts: {
  data: BarDatum[];
  ariaLabel: string;
  width?: number;
  labelWidth?: number;
  rowHeight?: number;
  formatValue?: (v: number) => string;
  /** Draw a dashed reference line at this value, e.g. a budget or a threshold. */
  threshold?: { value: number; label: string };
}): string => {
  const { data, ariaLabel } = opts;
  const W = opts.width ?? 640;
  const LW = opts.labelWidth ?? 150;
  const RH = opts.rowHeight ?? 26;
  const fmt = opts.formatValue ?? defaultFmt;
  const PAD_R = 76;
  const PAD_T = 8;
  const rows = data.filter(Boolean);
  const H = PAD_T * 2 + Math.max(1, rows.length) * RH + (opts.threshold ? 16 : 0);
  if (!rows.length) return emptyFrame(W, 80, ariaLabel);

  const max = Math.max(...rows.map((d) => Math.abs(n(d.value))), 0);
  if (max <= 0) return emptyFrame(W, H, ariaLabel, 'All values are zero');
  const plotW = W - LW - PAD_R;
  const sx = (v: number) => (Math.abs(n(v)) / max) * plotW;

  const bars = rows.map((d, i) => {
    const y = PAD_T + i * RH;
    const bw = Math.max(1, sx(d.value));
    const color = d.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
    return `<text x="${LW - 8}" y="${y + RH / 2}" text-anchor="end" dominant-baseline="middle" font-family="monospace" font-size="10" fill="${LABEL_STRONG}">${esc(clip(d.label, 26))}</text>
      <rect x="${LW}" y="${y + 4}" width="${bw.toFixed(1)}" height="${RH - 12}" fill="${color}" rx="2"/>
      <text x="${LW + bw + 6}" y="${y + RH / 2}" dominant-baseline="middle" font-family="monospace" font-size="10" fill="${LABEL}">${esc(fmt(n(d.value)))}${d.note ? ' ' + esc(d.note) : ''}</text>`;
  }).join('');

  let thr = '';
  if (opts.threshold && n(opts.threshold.value) > 0 && n(opts.threshold.value) <= max) {
    const tx = LW + sx(opts.threshold.value);
    thr = `<line x1="${tx.toFixed(1)}" y1="${PAD_T}" x2="${tx.toFixed(1)}" y2="${PAD_T + rows.length * RH}" stroke="var(--color-accent-danger)" stroke-width="1.5" stroke-dasharray="4 3"/>
      <text x="${tx.toFixed(1)}" y="${PAD_T + rows.length * RH + 12}" text-anchor="middle" font-family="monospace" font-size="9" fill="var(--color-accent-danger)">${esc(opts.threshold.label)}</text>`;
  }

  return wrap(`<line x1="${LW}" y1="${PAD_T}" x2="${LW}" y2="${PAD_T + rows.length * RH}" stroke="${AXIS}" stroke-width="1"/>${bars}${thr}`, W, H, ariaLabel);
};

// ── Single stacked bar (composition) ────────────────────────────────────────

export interface Segment {
  label: string;
  value: number;
  color?: string;
}

/**
 * One horizontal stacked bar plus a legend. This is the composition chart:
 * where a total splits into parts. Memory into weights/KV/overhead, CTC into
 * basic/HRA/deductions, cost into input/output/cache.
 *
 * Deliberately one bar rather than a pie: humans compare lengths far better
 * than angles, and a stacked bar keeps the total legible as a total.
 */
export const stackedBar = (opts: {
  segments: Segment[];
  ariaLabel: string;
  width?: number;
  barHeight?: number;
  formatValue?: (v: number) => string;
  /** Printed above the bar, e.g. "14.2 GB total". */
  totalLabel?: string;
}): string => {
  const { segments, ariaLabel } = opts;
  const W = opts.width ?? 640;
  const BH = opts.barHeight ?? 34;
  const fmt = opts.formatValue ?? defaultFmt;
  const segs = segments.filter((s) => s && n(s.value) > 0);
  const total = segs.reduce((a, s) => a + n(s.value), 0);
  const legendRows = Math.ceil(segs.length / 2);
  const H = (opts.totalLabel ? 22 : 0) + BH + 12 + legendRows * 18;
  if (!segs.length || total <= 0) return emptyFrame(W, 80, ariaLabel, 'Nothing to break down yet');

  const top = opts.totalLabel ? 22 : 0;
  let x = 0;
  const bars = segs.map((s, i) => {
    const w = (n(s.value) / total) * W;
    const color = s.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
    const rect = `<rect x="${x.toFixed(1)}" y="${top}" width="${Math.max(1, w).toFixed(1)}" height="${BH}" fill="${color}"/>`;
    // Only label in-place when the slice is wide enough to hold the text.
    const pct = (n(s.value) / total) * 100;
    const inline = w > 46
      ? `<text x="${(x + w / 2).toFixed(1)}" y="${top + BH / 2}" text-anchor="middle" dominant-baseline="middle" font-family="monospace" font-size="9" fill="var(--color-bg-base)" font-weight="600">${pct.toFixed(0)}%</text>`
      : '';
    x += w;
    return rect + inline;
  }).join('');

  const legend = segs.map((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const lx = col * (W / 2);
    const ly = top + BH + 16 + row * 18;
    const color = s.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
    return `<rect x="${lx}" y="${ly - 7}" width="9" height="9" fill="${color}" rx="2"/>
      <text x="${lx + 14}" y="${ly}" dominant-baseline="middle" font-family="monospace" font-size="10" fill="${LABEL}">${esc(clip(s.label, 24))} ${esc(fmt(n(s.value)))}</text>`;
  }).join('');

  const totalText = opts.totalLabel
    ? `<text x="0" y="12" font-family="monospace" font-size="11" fill="${LABEL_STRONG}">${esc(opts.totalLabel)}</text>`
    : '';

  return wrap(`${totalText}<g>${bars}</g><rect x="0" y="${top}" width="${W}" height="${BH}" fill="none" stroke="${AXIS}" stroke-width="1"/>${legend}`, W, H, ariaLabel);
};

// ── Line / area ─────────────────────────────────────────────────────────────

export interface LineSeries {
  label: string;
  points: { x: number; y: number }[];
  color?: string;
  dashed?: boolean;
  /** Fill the area between the line and the baseline. */
  fill?: boolean;
}

/**
 * Multi-series line chart with optional reference markers.
 *
 * Used for anything with a continuous independent variable: cost as volume
 * grows, latency as context grows, tax as deductions rise, an equity curve.
 * `markers` draws the vertical annotations that carry the actual finding -
 * a crossover, a breakeven, a threshold.
 */
export const lineChart = (opts: {
  series: LineSeries[];
  ariaLabel: string;
  width?: number;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  formatX?: (v: number) => string;
  formatY?: (v: number) => string;
  markers?: { x: number; label: string; color?: string }[];
  /** Force the y-axis to include zero. Needed for P&L so the zero line shows. */
  includeZero?: boolean;
}): string => {
  const { ariaLabel } = opts;
  const W = opts.width ?? 640;
  const H = opts.height ?? 240;
  const fmtX = opts.formatX ?? defaultFmt;
  const fmtY = opts.formatY ?? defaultFmt;
  const series = (opts.series || []).filter((s) => s && s.points && s.points.length > 1);
  if (!series.length) return emptyFrame(W, H, ariaLabel);

  const PAD_L = 62, PAD_R = 12, PAD_T = 14, PAD_B = opts.xLabel ? 40 : 26;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const xs = series.flatMap((s) => s.points.map((p) => n(p.x)));
  const ys = series.flatMap((s) => s.points.map((p) => n(p.y)));
  let minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  if (opts.includeZero) { minY = Math.min(minY, 0); maxY = Math.max(maxY, 0); }
  if (maxX === minX) maxX = minX + 1;
  if (maxY === minY) maxY = minY + 1;
  // Breathing room so the top line is not welded to the frame.
  const padY = (maxY - minY) * 0.08;
  maxY += padY;
  if (!opts.includeZero || minY < 0) minY -= padY;

  const sx = (v: number) => PAD_L + ((n(v) - minX) / (maxX - minX)) * plotW;
  const sy = (v: number) => PAD_T + plotH - ((n(v) - minY) / (maxY - minY)) * plotH;

  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = minY + (maxY - minY) * f;
    const y = sy(v);
    return `<line x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${W - PAD_R}" y2="${y.toFixed(1)}" stroke="${AXIS}" stroke-width="1"/>
      <text x="${PAD_L - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-family="monospace" font-size="9" fill="${LABEL}">${esc(fmtY(v))}</text>`;
  }).join('');

  const xTicks = [0, 0.5, 1].map((f) => {
    const v = minX + (maxX - minX) * f;
    return `<text x="${sx(v).toFixed(1)}" y="${H - PAD_B + 14}" text-anchor="middle" font-family="monospace" font-size="9" fill="${LABEL}">${esc(fmtX(v))}</text>`;
  }).join('');

  // Zero line, when the range straddles it. Matters for P&L.
  const zero = minY < 0 && maxY > 0
    ? `<line x1="${PAD_L}" y1="${sy(0).toFixed(1)}" x2="${W - PAD_R}" y2="${sy(0).toFixed(1)}" stroke="${LABEL}" stroke-width="1.5"/>`
    : '';

  const paths = series.map((s, i) => {
    const color = s.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
    const d = s.points.map((p, j) => `${j === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    const area = s.fill
      ? `<path d="${d} L${sx(s.points[s.points.length - 1].x).toFixed(1)},${sy(Math.max(minY, 0)).toFixed(1)} L${sx(s.points[0].x).toFixed(1)},${sy(Math.max(minY, 0)).toFixed(1)} Z" fill="${color}" opacity="0.12"/>`
      : '';
    return `${area}<path d="${d}" fill="none" stroke="${color}" stroke-width="2" ${s.dashed ? 'stroke-dasharray="5 3"' : ''} stroke-linejoin="round"/>`;
  }).join('');

  const markers = (opts.markers || []).filter((m) => n(m.x) >= minX && n(m.x) <= maxX).map((m) => {
    const mx = sx(m.x);
    const c = m.color ?? 'var(--color-accent-success)';
    return `<line x1="${mx.toFixed(1)}" y1="${PAD_T}" x2="${mx.toFixed(1)}" y2="${PAD_T + plotH}" stroke="${c}" stroke-width="1.5" stroke-dasharray="4 3"/>
      <text x="${mx.toFixed(1)}" y="${PAD_T - 3}" text-anchor="middle" font-family="monospace" font-size="9" fill="${c}">${esc(m.label)}</text>`;
  }).join('');

  const legend = series.length > 1
    ? series.map((s, i) => {
        const color = s.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
        const lx = PAD_L + i * (plotW / series.length);
        return `<rect x="${lx}" y="${H - 10}" width="9" height="3" fill="${color}"/>
          <text x="${lx + 13}" y="${H - 5}" font-family="monospace" font-size="9" fill="${LABEL}">${esc(clip(s.label, 22))}</text>`;
      }).join('')
    : '';

  const axisTitles =
    (opts.xLabel ? `<text x="${PAD_L + plotW / 2}" y="${H - PAD_B + 28}" text-anchor="middle" font-family="monospace" font-size="9" fill="${LABEL}">${esc(opts.xLabel)}</text>` : '') +
    (opts.yLabel ? `<text transform="translate(11,${PAD_T + plotH / 2}) rotate(-90)" text-anchor="middle" font-family="monospace" font-size="9" fill="${LABEL}">${esc(opts.yLabel)}</text>` : '');

  return wrap(`${grid}${xTicks}${zero}${paths}${markers}${legend}${axisTitles}`, W, H, ariaLabel);
};

// ── Histogram ───────────────────────────────────────────────────────────────

/**
 * Distribution of raw values. Bins internally so callers can hand over an
 * unprocessed array - token counts, chunk sizes, roll results, P&L per lot.
 */
export const histogram = (opts: {
  values: number[];
  ariaLabel: string;
  bins?: number;
  width?: number;
  height?: number;
  formatX?: (v: number) => string;
  xLabel?: string;
  color?: string;
  /** Dashed vertical line, typically the mean. */
  marker?: { value: number; label: string };
}): string => {
  const { ariaLabel } = opts;
  const W = opts.width ?? 640;
  const H = opts.height ?? 200;
  const vals = (opts.values || []).map(n).filter((v) => Number.isFinite(v));
  if (vals.length < 2) return emptyFrame(W, H, ariaLabel, 'Not enough data to plot a distribution');

  const binCount = Math.max(4, Math.min(opts.bins ?? 20, 40));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const counts = new Array(binCount).fill(0);
  for (const v of vals) {
    const idx = Math.min(binCount - 1, Math.floor(((v - min) / span) * binCount));
    counts[idx]++;
  }
  const peak = Math.max(...counts, 1);

  const PAD_L = 40, PAD_R = 10, PAD_T = 10, PAD_B = opts.xLabel ? 36 : 24;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const bw = plotW / binCount;
  const color = opts.color ?? 'var(--color-accent)';
  const fmtX = opts.formatX ?? defaultFmt;

  const bars = counts.map((c, i) => {
    const h = (c / peak) * plotH;
    return `<rect x="${(PAD_L + i * bw).toFixed(1)}" y="${(PAD_T + plotH - h).toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${h.toFixed(1)}" fill="${color}" rx="1"/>`;
  }).join('');

  const yTicks = [0, 0.5, 1].map((f) => {
    const y = PAD_T + plotH - f * plotH;
    return `<line x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${W - PAD_R}" y2="${y.toFixed(1)}" stroke="${AXIS}" stroke-width="1"/>
      <text x="${PAD_L - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-family="monospace" font-size="9" fill="${LABEL}">${Math.round(peak * f)}</text>`;
  }).join('');

  const xTicks = [0, 0.5, 1].map((f) => {
    const v = min + span * f;
    return `<text x="${(PAD_L + f * plotW).toFixed(1)}" y="${H - PAD_B + 14}" text-anchor="middle" font-family="monospace" font-size="9" fill="${LABEL}">${esc(fmtX(v))}</text>`;
  }).join('');

  let marker = '';
  if (opts.marker && Number.isFinite(n(opts.marker.value))) {
    const mv = n(opts.marker.value);
    if (mv >= min && mv <= max) {
      const mx = PAD_L + ((mv - min) / span) * plotW;
      marker = `<line x1="${mx.toFixed(1)}" y1="${PAD_T}" x2="${mx.toFixed(1)}" y2="${PAD_T + plotH}" stroke="var(--color-accent-warm)" stroke-width="1.5" stroke-dasharray="4 3"/>
        <text x="${mx.toFixed(1)}" y="${PAD_T - 1}" text-anchor="middle" font-family="monospace" font-size="9" fill="var(--color-accent-warm)">${esc(opts.marker.label)}</text>`;
    }
  }

  const xTitle = opts.xLabel
    ? `<text x="${PAD_L + plotW / 2}" y="${H - 3}" text-anchor="middle" font-family="monospace" font-size="9" fill="${LABEL}">${esc(opts.xLabel)}</text>`
    : '';

  return wrap(`${yTicks}${bars}${xTicks}${marker}${xTitle}`, W, H, ariaLabel);
};

// ── Donut ───────────────────────────────────────────────────────────────────

/**
 * Share-of-total, with the total in the middle. Use only when there are few
 * slices and the total itself is worth reading; otherwise stackedBar is the
 * better tool and this file prefers it.
 */
export const donut = (opts: {
  segments: Segment[];
  ariaLabel: string;
  size?: number;
  centerLabel?: string;
  centerSub?: string;
}): string => {
  const { ariaLabel } = opts;
  const S = opts.size ?? 180;
  const segs = opts.segments.filter((s) => s && n(s.value) > 0);
  const total = segs.reduce((a, s) => a + n(s.value), 0);
  if (!segs.length || total <= 0) return emptyFrame(S, S, ariaLabel, 'No data');

  const cx = S / 2, cy = S / 2, r = S * 0.38, sw = S * 0.16;
  let angle = -Math.PI / 2;
  const arcs = segs.map((s, i) => {
    const frac = n(s.value) / total;
    const sweep = frac * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const color = s.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
    // A full circle cannot be drawn as a single arc; use a plain circle.
    if (frac >= 0.999) return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"/>`;
    return `<path d="M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)}" fill="none" stroke="${color}" stroke-width="${sw}"/>`;
  }).join('');

  const center = opts.centerLabel
    ? `<text x="${cx}" y="${cy - (opts.centerSub ? 5 : 0)}" text-anchor="middle" dominant-baseline="middle" font-family="monospace" font-size="15" font-weight="600" fill="var(--color-text-primary)">${esc(opts.centerLabel)}</text>` +
      (opts.centerSub ? `<text x="${cx}" y="${cy + 13}" text-anchor="middle" dominant-baseline="middle" font-family="monospace" font-size="9" fill="${LABEL}">${esc(opts.centerSub)}</text>` : '')
    : '';

  return wrap(`${arcs}${center}`, S, S, ariaLabel);
};

// ── Gauge ───────────────────────────────────────────────────────────────────

/**
 * Semicircular gauge for a single metric read against thresholds. Matches the
 * one debt-to-income-calculator already ships, generalised so other apps can
 * use the same visual language for "how close am I to the limit".
 */
export const gauge = (opts: {
  value: number;
  max: number;
  ariaLabel: string;
  label?: string;
  formatValue?: (v: number) => string;
  color?: string;
  size?: number;
}): string => {
  const S = opts.size ?? 150;
  const W = S, H = S * 0.62;
  const val = n(opts.value);
  const max = n(opts.max) || 1;
  const frac = Math.max(0, Math.min(1, val / max));
  const fmt = opts.formatValue ?? defaultFmt;
  const color = opts.color ?? 'var(--color-accent)';
  const r = S * 0.34, cx = S / 2, cy = H - 6;
  const startX = cx - r;
  const angle = Math.PI - frac * Math.PI;
  const endX = cx + r * Math.cos(angle);
  const endY = cy - r * Math.sin(angle);
  const large = frac > 0.5 ? 1 : 0;
  const arc = frac > 0.001
    ? `<path d="M${startX.toFixed(1)},${cy} A${r},${r} 0 ${large},1 ${endX.toFixed(1)},${endY.toFixed(1)}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"/>`
    : '';
  return wrap(
    `<path d="M${startX.toFixed(1)},${cy} A${r},${r} 0 0,1 ${(cx + r).toFixed(1)},${cy}" fill="none" stroke="var(--color-bg-elevated)" stroke-width="9" stroke-linecap="round"/>${arc}
     <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-family="monospace" font-size="14" font-weight="700" fill="${color}">${esc(fmt(val))}</text>
     ${opts.label ? `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="monospace" font-size="8" fill="${LABEL}">${esc(opts.label)}</text>` : ''}`,
    W, H, opts.ariaLabel,
  );
};

/** Standard wrapper so every chart on the site sits in the same furniture. */
export const chartFrame = (title: string, svg: string, caption?: string): string =>
  `<div class="space-y-2">
    <p class="text-[10px] font-mono uppercase tracking-widest text-text-secondary">${esc(title)}</p>
    <div class="p-4 bg-bg-surface border border-border-subtle rounded-xl overflow-x-auto">${svg}</div>
    ${caption ? `<p class="text-xs text-text-muted leading-relaxed">${esc(caption)}</p>` : ''}
  </div>`;
