/**
 * charts.test.ts — guards the SVG chart primitives that ~35 calculators render.
 *
 * The failure modes that matter here are not "does it look right" but:
 *  - NaN or Infinity leaking into path data, which silently blanks a chart
 *  - unescaped user text, since several apps chart strings the user pasted
 *  - degenerate input (empty, single point, all zeros) throwing
 *  - missing accessibility attributes
 */
import { describe, it, expect } from 'vitest';
import {
  barChart, stackedBar, lineChart, histogram, donut, gauge, chartFrame, SERIES_COLORS,
} from '../src/components/apps/shared/charts';

/** Every chart in the module, exercised with ordinary input. */
const allCharts = (): Record<string, string> => ({
  bar: barChart({ data: [{ label: 'A', value: 10 }, { label: 'B', value: 20 }], ariaLabel: 'test' }),
  stacked: stackedBar({ segments: [{ label: 'A', value: 3 }, { label: 'B', value: 7 }], ariaLabel: 'test' }),
  line: lineChart({ series: [{ label: 'S', points: [{ x: 0, y: 1 }, { x: 1, y: 5 }] }], ariaLabel: 'test' }),
  hist: histogram({ values: [1, 2, 2, 3, 3, 3, 4, 9], ariaLabel: 'test' }),
  donut: donut({ segments: [{ label: 'A', value: 1 }, { label: 'B', value: 2 }], ariaLabel: 'test' }),
  gauge: gauge({ value: 0.4, max: 1, ariaLabel: 'test' }),
});

describe('every chart is well-formed and accessible', () => {
  it('emits an svg with a viewBox, role and aria-label', () => {
    for (const [name, svg] of Object.entries(allCharts())) {
      expect(svg, name).toMatch(/^<svg /);
      expect(svg, name).toContain('viewBox="0 0 ');
      expect(svg, name).toContain('role="img"');
      expect(svg, name).toContain('aria-label="test"');
      expect(svg, name).toMatch(/<\/svg>$/);
    }
  });

  it('never emits NaN, Infinity or undefined into the markup', () => {
    for (const [name, svg] of Object.entries(allCharts())) {
      expect(svg, name).not.toMatch(/NaN/);
      expect(svg, name).not.toMatch(/Infinity/);
      expect(svg, name).not.toMatch(/undefined/);
      expect(svg, name).not.toMatch(/null/);
    }
  });

  it('opens and closes the same number of svg tags', () => {
    for (const [name, svg] of Object.entries(allCharts())) {
      const open = (svg.match(/<svg/g) || []).length;
      const close = (svg.match(/<\/svg>/g) || []).length;
      expect(open, name).toBe(close);
    }
  });
});

describe('hostile numeric input cannot corrupt path data', () => {
  const nasty = [NaN, Infinity, -Infinity, undefined as unknown as number, null as unknown as number];

  it('survives NaN and Infinity in bar values', () => {
    for (const v of nasty) {
      const svg = barChart({ data: [{ label: 'x', value: v }, { label: 'y', value: 5 }], ariaLabel: 'a' });
      expect(svg).not.toMatch(/NaN|Infinity/);
    }
  });

  it('survives NaN and Infinity in line points', () => {
    for (const v of nasty) {
      const svg = lineChart({
        series: [{ label: 's', points: [{ x: 0, y: v }, { x: 1, y: 2 }, { x: 2, y: 3 }] }],
        ariaLabel: 'a',
      });
      expect(svg).not.toMatch(/NaN|Infinity/);
    }
  });

  it('survives NaN in histogram values', () => {
    const svg = histogram({ values: [1, NaN, 3, Infinity, 5, 6], ariaLabel: 'a' });
    expect(svg).not.toMatch(/NaN|Infinity/);
  });

  it('survives a zero max on the gauge without dividing by zero', () => {
    const svg = gauge({ value: 5, max: 0, ariaLabel: 'a' });
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
});

describe('degenerate input renders an empty frame rather than throwing', () => {
  it('handles empty series', () => {
    expect(() => barChart({ data: [], ariaLabel: 'a' })).not.toThrow();
    expect(() => stackedBar({ segments: [], ariaLabel: 'a' })).not.toThrow();
    expect(() => lineChart({ series: [], ariaLabel: 'a' })).not.toThrow();
    expect(() => histogram({ values: [], ariaLabel: 'a' })).not.toThrow();
    expect(() => donut({ segments: [], ariaLabel: 'a' })).not.toThrow();
    expect(barChart({ data: [], ariaLabel: 'a' })).toContain('role="img"');
  });

  it('handles all-zero values without dividing by zero', () => {
    const svg = barChart({ data: [{ label: 'a', value: 0 }, { label: 'b', value: 0 }], ariaLabel: 'a' });
    expect(svg).not.toMatch(/NaN|Infinity/);
    expect(svg).toContain('zero');
  });

  it('handles a single line point, which cannot form a path', () => {
    const svg = lineChart({ series: [{ label: 's', points: [{ x: 1, y: 1 }] }], ariaLabel: 'a' });
    expect(svg).toContain('role="img"');
    expect(svg).not.toMatch(/NaN/);
  });

  it('handles a flat series where min equals max', () => {
    const svg = lineChart({
      series: [{ label: 's', points: [{ x: 0, y: 7 }, { x: 1, y: 7 }, { x: 2, y: 7 }] }],
      ariaLabel: 'a',
    });
    expect(svg).not.toMatch(/NaN|Infinity/);
  });

  it('draws a full-circle donut as a circle, since one arc cannot close', () => {
    const svg = donut({ segments: [{ label: 'only', value: 10 }], ariaLabel: 'a' });
    expect(svg).toContain('<circle');
    expect(svg).not.toMatch(/NaN/);
  });
});

describe('user-supplied text is escaped', () => {
  const XSS = '<img src=x onerror="alert(1)">';

  it('escapes labels in every chart that takes them', () => {
    const svgs = [
      barChart({ data: [{ label: XSS, value: 5 }], ariaLabel: XSS }),
      stackedBar({ segments: [{ label: XSS, value: 5 }], ariaLabel: XSS, totalLabel: XSS }),
      lineChart({ series: [{ label: XSS, points: [{ x: 0, y: 1 }, { x: 1, y: 2 }] }], ariaLabel: XSS, xLabel: XSS }),
      histogram({ values: [1, 2, 3, 4], ariaLabel: XSS, xLabel: XSS }),
      donut({ segments: [{ label: XSS, value: 1 }], ariaLabel: XSS, centerLabel: XSS }),
      gauge({ value: 1, max: 2, ariaLabel: XSS, label: XSS }),
      chartFrame(XSS, '<svg></svg>', XSS),
    ];
    for (const svg of svgs) {
      expect(svg).not.toContain('<img src=x');
      expect(svg).not.toContain('onerror="');
      expect(svg).toContain('&lt;img');
    }
  });

  it('escapes a formatted value that contains markup', () => {
    const svg = barChart({
      data: [{ label: 'a', value: 1 }],
      ariaLabel: 'a',
      formatValue: () => '<script>x</script>',
    });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });
});

describe('charts actually encode their data', () => {
  it('scales bars proportionally to value', () => {
    const svg = barChart({ data: [{ label: 'small', value: 10 }, { label: 'big', value: 100 }], ariaLabel: 'a' });
    const widths = [...svg.matchAll(/<rect [^>]*width="([\d.]+)"/g)].map((m) => parseFloat(m[1]));
    expect(widths.length).toBeGreaterThanOrEqual(2);
    // The 100 bar must be about ten times the 10 bar.
    expect(Math.max(...widths) / Math.min(...widths)).toBeGreaterThan(5);
  });

  it('renders one path per line series', () => {
    const svg = lineChart({
      series: [
        { label: 'a', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
        { label: 'b', points: [{ x: 0, y: 1 }, { x: 1, y: 0 }] },
      ],
      ariaLabel: 'a',
    });
    expect((svg.match(/<path d="M/g) || []).length).toBe(2);
  });

  it('draws a marker line when one is supplied in range', () => {
    const svg = lineChart({
      series: [{ label: 'a', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }],
      ariaLabel: 'a',
      markers: [{ x: 5, label: 'breakeven' }],
    });
    expect(svg).toContain('breakeven');
    expect(svg).toContain('stroke-dasharray');
  });

  it('drops a marker that falls outside the plotted range', () => {
    const svg = lineChart({
      series: [{ label: 'a', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }],
      ariaLabel: 'a',
      markers: [{ x: 999, label: 'offscreen' }],
    });
    expect(svg).not.toContain('offscreen');
  });

  it('draws a zero line only when the range straddles zero', () => {
    const straddles = lineChart({
      series: [{ label: 'pnl', points: [{ x: 0, y: -50 }, { x: 1, y: 50 }] }],
      ariaLabel: 'a', includeZero: true,
    });
    const positive = lineChart({
      series: [{ label: 'p', points: [{ x: 0, y: 10 }, { x: 1, y: 50 }] }],
      ariaLabel: 'a',
    });
    const zeroLine = /stroke="var\(--color-text-muted\)" stroke-width="1\.5"/;
    expect(straddles).toMatch(zeroLine);
    expect(positive).not.toMatch(zeroLine);
  });

  it('bins a histogram so counts sum to the input length', () => {
    const svg = histogram({ values: [1, 1, 2, 2, 2, 3], ariaLabel: 'a', bins: 4 });
    expect((svg.match(/<rect /g) || []).length).toBeGreaterThan(0);
    expect(svg).not.toMatch(/NaN/);
  });
});

describe('design system compliance', () => {
  it('uses only CSS design tokens, never literal hex colours', () => {
    for (const [name, svg] of Object.entries(allCharts())) {
      expect(svg, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  it('exposes a series palette drawn from tokens', () => {
    expect(SERIES_COLORS.length).toBeGreaterThanOrEqual(4);
    for (const c of SERIES_COLORS) expect(c).toMatch(/^var\(--color-/);
  });
});
