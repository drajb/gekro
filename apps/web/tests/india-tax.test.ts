/**
 * india-tax.test.ts — pins the Tax Year 2026-27 engine to published figures.
 *
 * These are the numbers the whole of `india-ctc-salary-calculator` and
 * `india-tax-regime-comparator` sit on top of. If a Finance Act moves a slab,
 * this file should go red before anything ships.
 *
 * The interesting cases are the two places calculators usually break: marginal
 * relief on the 87A cliff just above ₹12L, and marginal relief on surcharge at
 * every threshold.
 */
import { describe, it, expect } from 'vitest';
import {
  computeNewRegime,
  computeOldRegime,
  hraExemption,
  CONSTANTS,
} from '../src/components/apps/shared/india-tax';

describe('new regime — slab tax', () => {
  it('is nil at the basic exemption limit', () => {
    expect(computeNewRegime(400_000).totalTax).toBe(0);
  });

  it('is nil at the 87A ceiling of ₹12,00,000', () => {
    const r = computeNewRegime(1_200_000);
    expect(r.slabTax).toBe(60_000); // 20,000 + 40,000
    expect(r.rebate87A).toBe(60_000);
    expect(r.totalTax).toBe(0);
  });

  it('matches published tax at ₹16,00,000 taxable', () => {
    // 4-8L @5% = 20,000; 8-12L @10% = 40,000; 12-16L @15% = 60,000 → 1,20,000 + 4% cess
    const r = computeNewRegime(1_600_000);
    expect(r.slabTax).toBe(120_000);
    expect(r.cess).toBe(4_800);
    expect(r.totalTax).toBe(124_800);
  });

  it('matches published tax at ₹24,00,000 taxable', () => {
    // 20,000 + 40,000 + 60,000 + 80,000 + 1,00,000 = 3,00,000 + 4% cess
    const r = computeNewRegime(2_400_000);
    expect(r.slabTax).toBe(300_000);
    expect(r.totalTax).toBe(312_000);
  });
});

describe('new regime — 87A cliff relief', () => {
  it('caps tax at the rupees earned past ₹12,00,000', () => {
    // Slab tax at 12.10L is 61,500, but only 10,000 was earned past the ceiling.
    const r = computeNewRegime(1_210_000);
    expect(r.slabTax).toBe(61_500);
    expect(r.cliffRelief).toBe(51_500);
    expect(r.totalTax).toBe(10_400); // 10,000 + 4% cess
  });

  it('never makes an extra rupee of income cost more than a rupee of tax', () => {
    for (let ti = 1_200_000; ti <= 1_300_000; ti += 1_000) {
      const here = computeNewRegime(ti).totalTax;
      const next = computeNewRegime(ti + 1_000).totalTax;
      expect(next - here).toBeLessThanOrEqual(1_000 * 1.04 + 1);
    }
  });

  it('stops granting relief once slab tax falls below the excess', () => {
    // By ~12.75L the slab tax is less than the excess earned, so relief is spent.
    expect(computeNewRegime(1_300_000).cliffRelief).toBe(0);
  });
});

describe('old regime — slab tax', () => {
  it('matches the classic ₹10,00,000 figure', () => {
    // 2.5-5L @5% = 12,500; 5-10L @20% = 1,00,000 → 1,12,500 + 4% cess
    const r = computeOldRegime(1_000_000);
    expect(r.slabTax).toBe(112_500);
    expect(r.totalTax).toBe(117_000);
  });

  it('is nil at the ₹5,00,000 rebate ceiling', () => {
    expect(computeOldRegime(500_000).totalTax).toBe(0);
  });

  it('has a hard 87A cliff with no marginal relief — that is the law', () => {
    const r = computeOldRegime(500_010);
    expect(r.rebate87A).toBe(0);
    expect(r.totalTax).toBeGreaterThan(10_000);
  });

  it('lifts the exemption limit for senior and super-senior citizens', () => {
    expect(computeOldRegime(300_000, 'senior').totalTax).toBe(0);
    expect(computeOldRegime(500_000, 'superSenior').totalTax).toBe(0);
    // Super senior skips the 5% band entirely: 5-10L is taxed at 20%.
    expect(computeOldRegime(1_000_000, 'superSenior').slabTax).toBe(100_000);
  });
});

describe('surcharge and marginal relief', () => {
  it('charges no surcharge exactly at ₹50,00,000', () => {
    const r = computeOldRegime(5_000_000);
    expect(r.surcharge).toBe(0);
    expect(r.slabTax).toBe(1_312_500);
  });

  it('grants marginal relief a rupee past the ₹50L threshold', () => {
    // Raw surcharge would be ~₹1.31L on ₹10 of extra income. Relief kills nearly all of it.
    const r = computeOldRegime(5_000_010);
    expect(r.surchargeRate).toBe(10);
    expect(r.surchargeRelief).toBeGreaterThan(130_000);
    expect(r.surcharge).toBeLessThan(100);
  });

  it('never lets crossing a threshold cost more than the income gained', () => {
    for (const t of [5_000_000, 10_000_000, 20_000_000, 50_000_000]) {
      const at = computeOldRegime(t).totalTax;
      const past = computeOldRegime(t + 10_000).totalTax;
      expect(past - at).toBeLessThanOrEqual(10_000 * 1.04 + 1);
    }
  });

  it('applies the same relief in the new regime', () => {
    for (const t of [5_000_000, 10_000_000, 20_000_000]) {
      const at = computeNewRegime(t).totalTax;
      const past = computeNewRegime(t + 10_000).totalTax;
      expect(past - at).toBeLessThanOrEqual(10_000 * 1.04 + 1);
    }
  });

  it('caps the new regime at 25% and lets the old regime reach 37%', () => {
    expect(computeNewRegime(60_000_000).surchargeRate).toBe(25);
    expect(computeOldRegime(60_000_000).surchargeRate).toBe(37);
  });
});

describe('monotonicity', () => {
  it('never lets total tax fall as income rises, in either regime', () => {
    let prevNew = -1;
    let prevOld = -1;
    for (let ti = 0; ti <= 60_000_000; ti += 5_000) {
      const n = computeNewRegime(ti).totalTax;
      const o = computeOldRegime(ti).totalTax;
      expect(n).toBeGreaterThanOrEqual(prevNew);
      expect(o).toBeGreaterThanOrEqual(prevOld);
      prevNew = n;
      prevOld = o;
    }
  });

  /**
   * Take-home is NOT monotonic, and that is the law rather than a bug here.
   * Marginal relief caps the *tax* at the excess income earned past the ceiling,
   * then 4% cess is charged on top of that capped figure — so across the relief
   * band an extra rupee costs 1.04 rupees. Everywhere else take-home rises.
   */
  it('dips by at most 4% of the excess inside the new regime 87A relief band', () => {
    const atCeiling = 1_200_000 - computeNewRegime(1_200_000).totalTax;
    let worstDip = 0;
    for (let ti = 1_200_000; ti <= 1_275_000; ti += 1_000) {
      worstDip = Math.max(worstDip, atCeiling - (ti - computeNewRegime(ti).totalTax));
    }
    // Band runs to ~₹12,70,588, where slab tax finally equals the excess.
    expect(worstDip).toBeGreaterThan(2_000);
    expect(worstDip).toBeLessThan(3_000);
  });

  /**
   * The general rule, stated exactly. Wherever marginal relief is active — the 87A
   * cliff or any surcharge threshold — relief pins tax to the excess earned, then
   * cess lands on top, so an extra rupee costs ₹1.04 and take-home slides at 4%.
   * Wherever relief is NOT active, take-home rises. Both regimes, whole range.
   */
  it('only ever dips while marginal relief is active, and then at exactly the cess rate', () => {
    const STEP = 5_000;
    for (const compute of [computeNewRegime, (ti: number) => computeOldRegime(ti)]) {
      let prev = -1;
      let prevRelieved = false;
      for (let ti = 600_000; ti <= 60_000_000; ti += STEP) {
        const r = compute(ti);
        const takeHome = ti - r.totalTax;
        const relieved = r.cliffRelief > 0 || r.surchargeRelief > 0;
        if (prev >= 0) {
          if (prevRelieved || relieved) {
            // A dip is allowed here, but never more than the cess on the step.
            expect(prev - takeHome).toBeLessThanOrEqual(STEP * CONSTANTS.cessRate + 1);
          } else {
            expect(takeHome).toBeGreaterThanOrEqual(prev);
          }
        }
        prev = takeHome;
        prevRelieved = relieved;
      }
    }
  });

  /**
   * The old regime's 87A cliff at ₹5,00,000 has no marginal relief at all, so it
   * is a genuine step: one extra rupee of taxable income costs about ₹13,000.
   * Worth knowing before you claim one rupee less of 80C.
   */
  it('exposes the old regime ₹5L cliff as a ~₹13,000 step', () => {
    const below = 500_000 - computeOldRegime(500_000).totalTax;
    const above = 500_010 - computeOldRegime(500_010).totalTax;
    const step = below - above;
    expect(step).toBeGreaterThan(12_000);
    expect(step).toBeLessThan(14_000);
  });
});

describe('HRA exemption — least of three', () => {
  it('picks the rent-minus-10%-of-basic limb when rent is modest', () => {
    // basic 6L, HRA 3L, rent 2.4L, metro → min(3L, 3L, 2.4L - 60k = 1.8L)
    expect(hraExemption(300_000, 600_000, 240_000, true)).toBe(180_000);
  });

  it('picks the 40% limb in a non-metro city', () => {
    // min(3L, 40% of 6L = 2.4L, 4.8L - 60k = 4.2L)
    expect(hraExemption(300_000, 600_000, 480_000, false)).toBe(240_000);
  });

  it('is nil when no rent is paid', () => {
    expect(hraExemption(300_000, 600_000, 0, true)).toBe(0);
  });

  it('never goes negative when rent is below 10% of basic', () => {
    expect(hraExemption(300_000, 600_000, 30_000, true)).toBe(0);
  });
});

describe('constants are the tax year 2026-27 set', () => {
  it('pins the figures the UI prints', () => {
    expect(CONSTANTS.taxYear).toBe('2026-27');
    expect(CONSTANTS.new.standardDeduction).toBe(75_000);
    expect(CONSTANTS.new.rebateMax).toBe(60_000);
    expect(CONSTANTS.old.standardDeduction).toBe(50_000);
    expect(CONSTANTS.cessRate).toBe(0.04);
  });
});
