/**
 * india-tax.ts — income-tax engine for Tax Year 2026-27 (AY 2027-28).
 *
 * Shared by `india-ctc-salary-calculator` and `india-tax-regime-comparator` so the
 * slabs live in exactly one place. When the Finance Act moves a number, change it
 * here and both apps follow.
 *
 * Basis: Income-tax Act, 2025 (in force 1 April 2026), which replaced the 1961 Act
 * and retired "previous year / assessment year" in favour of **tax year**. Budget
 * 2026 left slabs, cess, surcharge and the section 87A rebate unchanged from the
 * previous year.
 *
 * Deliberately modelled, because most free calculators skip them and get large
 * incomes visibly wrong:
 *  - Surcharge **marginal relief** at every threshold.
 *  - The **87A cliff relief** just above ₹12,00,000 in the new regime.
 *  - The new regime's surcharge cap of **25%** (its 37% band does not exist).
 *
 * Deliberately NOT modelled: the 15% surcharge cap on capital gains under sections
 * 111A / 112A / 115AD and on domestic dividends. These are salary tools; feeding
 * capital gains in as ordinary income will overstate surcharge at the top end.
 *
 * Last verified against published slabs: 2026-08-28.
 */

/** Age band drives only the old regime's basic exemption limit. */
export type AgeBand = 'below60' | 'senior' | 'superSenior';

export type Regime = 'new' | 'old';

export interface TaxBreakdown {
  /** Income after every deduction the regime allows. */
  taxableIncome: number;
  /** Slab tax before rebate, surcharge and cess. */
  slabTax: number;
  /** Section 87A rebate actually applied. */
  rebate87A: number;
  /** Relief granted on the 87A cliff just above the rebate ceiling. New regime only. */
  cliffRelief: number;
  /** Surcharge after marginal relief. */
  surcharge: number;
  /** Marginal relief that was granted on surcharge. Reported so the number is auditable. */
  surchargeRelief: number;
  /** Surcharge rate that applied before marginal relief, as a percentage. */
  surchargeRate: number;
  /** Health and Education Cess at 4%. */
  cess: number;
  /** Everything, rounded to the nearest rupee. */
  totalTax: number;
  /** totalTax as a share of the gross income fed in. */
  effectiveRate: number;
}

interface Slab {
  upto: number;
  rate: number;
}

/** New regime slabs — section 115BAC as it stands for tax year 2026-27. */
const NEW_SLABS: Slab[] = [
  { upto: 400_000, rate: 0 },
  { upto: 800_000, rate: 0.05 },
  { upto: 1_200_000, rate: 0.1 },
  { upto: 1_600_000, rate: 0.15 },
  { upto: 2_000_000, rate: 0.2 },
  { upto: 2_400_000, rate: 0.25 },
  { upto: Infinity, rate: 0.3 },
];

/** Old regime slabs, by age band. Only the first threshold moves. */
const OLD_SLABS: Record<AgeBand, Slab[]> = {
  below60: [
    { upto: 250_000, rate: 0 },
    { upto: 500_000, rate: 0.05 },
    { upto: 1_000_000, rate: 0.2 },
    { upto: Infinity, rate: 0.3 },
  ],
  senior: [
    { upto: 300_000, rate: 0 },
    { upto: 500_000, rate: 0.05 },
    { upto: 1_000_000, rate: 0.2 },
    { upto: Infinity, rate: 0.3 },
  ],
  superSenior: [
    { upto: 500_000, rate: 0 },
    { upto: 1_000_000, rate: 0.2 },
    { upto: Infinity, rate: 0.3 },
  ],
};

export const CONSTANTS = {
  taxYear: '2026-27',
  assessmentYear: '2027-28',
  cessRate: 0.04,
  new: {
    standardDeduction: 75_000,
    /** 87A gives full relief up to this taxable income. */
    rebateLimit: 1_200_000,
    rebateMax: 60_000,
    /** Employer NPS under 80CCD(2) is capped at this share of basic in the new regime. */
    employerNpsCap: 0.14,
    familyPensionDeduction: 25_000,
  },
  old: {
    standardDeduction: 50_000,
    rebateLimit: 500_000,
    rebateMax: 12_500,
    employerNpsCap: 0.1,
    familyPensionDeduction: 15_000,
    limit80C: 150_000,
    limit80CCD1B: 50_000,
    /** Interest on a self-occupied house property under section 24(b). */
    limitHomeLoanInterest: 200_000,
  },
} as const;

/**
 * Surcharge bands. The new regime tops out at 25% — the 37% band was removed for
 * section 115BAC and never came back.
 */
const SURCHARGE_BANDS: Record<Regime, { over: number; rate: number }[]> = {
  new: [
    { over: 5_000_000, rate: 0.1 },
    { over: 10_000_000, rate: 0.15 },
    { over: 20_000_000, rate: 0.25 },
  ],
  old: [
    { over: 5_000_000, rate: 0.1 },
    { over: 10_000_000, rate: 0.15 },
    { over: 20_000_000, rate: 0.25 },
    { over: 50_000_000, rate: 0.37 },
  ],
};

/** Progressive slab tax. Pure function of taxable income and a slab table. */
const slabTax = (income: number, slabs: Slab[]): number => {
  let tax = 0;
  let lower = 0;
  for (const s of slabs) {
    if (income <= lower) break;
    tax += (Math.min(income, s.upto) - lower) * s.rate;
    lower = s.upto;
  }
  return tax;
};

/**
 * Surcharge with marginal relief.
 *
 * Marginal relief exists so that crossing a threshold by ₹1 cannot cost more than
 * ₹1 of extra tax. Formally: the total of tax plus surcharge at income I may not
 * exceed the total at the threshold T plus (I - T). We compute the ceiling at T
 * using the surcharge rate of the band *below* T, which is what makes the relief
 * taper smoothly instead of jumping.
 */
const computeSurcharge = (
  taxableIncome: number,
  taxAfterRebate: number,
  regime: Regime,
  slabs: Slab[],
  rebateFn: (ti: number, tax: number) => number,
): { surcharge: number; relief: number; rate: number } => {
  const bands = SURCHARGE_BANDS[regime];
  let rate = 0;
  let threshold = 0;
  let prevRate = 0;
  for (const b of bands) {
    if (taxableIncome > b.over) {
      prevRate = rate;
      rate = b.rate;
      threshold = b.over;
    }
  }
  if (rate === 0) return { surcharge: 0, relief: 0, rate: 0 };

  const raw = taxAfterRebate * rate;

  // Tax plus surcharge exactly at the threshold, using the band below it.
  const taxAtThreshold = slabTax(threshold, slabs);
  const netAtThreshold = taxAtThreshold - rebateFn(threshold, taxAtThreshold);
  const ceiling = netAtThreshold * (1 + prevRate) + (taxableIncome - threshold);

  if (taxAfterRebate + raw > ceiling) {
    const capped = Math.max(0, ceiling - taxAfterRebate);
    return { surcharge: capped, relief: raw - capped, rate: rate * 100 };
  }
  return { surcharge: raw, relief: 0, rate: rate * 100 };
};

const finalise = (
  taxableIncome: number,
  grossForRate: number,
  slabs: Slab[],
  regime: Regime,
  rebateFn: (ti: number, tax: number) => number,
  cliffRelief: number,
  rebate87A: number,
): TaxBreakdown => {
  const base = slabTax(taxableIncome, slabs);
  const afterRebate = Math.max(0, base - rebate87A - cliffRelief);
  const { surcharge, relief, rate } = computeSurcharge(taxableIncome, afterRebate, regime, slabs, rebateFn);
  const cess = (afterRebate + surcharge) * CONSTANTS.cessRate;
  const totalTax = Math.round(afterRebate + surcharge + cess);
  return {
    taxableIncome: Math.round(taxableIncome),
    slabTax: Math.round(base),
    rebate87A: Math.round(rebate87A),
    cliffRelief: Math.round(cliffRelief),
    surcharge: Math.round(surcharge),
    surchargeRelief: Math.round(relief),
    surchargeRate: rate,
    cess: Math.round(cess),
    totalTax,
    effectiveRate: grossForRate > 0 ? totalTax / grossForRate : 0,
  };
};

/**
 * New regime (section 115BAC).
 *
 * `taxableIncome` is income after the standard deduction and 80CCD(2) — the caller
 * applies those, because only the caller knows the salary split. The 87A rebate
 * wipes out tax up to ₹12,00,000, and the cliff just above it is smoothed by
 * marginal relief: tax can never exceed the rupees earned past ₹12,00,000.
 */
export const computeNewRegime = (taxableIncome: number, grossForRate = taxableIncome): TaxBreakdown => {
  const ti = Math.max(0, taxableIncome);
  const base = slabTax(ti, NEW_SLABS);

  let rebate = 0;
  let cliff = 0;
  if (ti <= CONSTANTS.new.rebateLimit) {
    rebate = Math.min(base, CONSTANTS.new.rebateMax);
  } else {
    // Above the ceiling the rebate vanishes, so relief caps tax at the excess earned.
    cliff = Math.max(0, base - (ti - CONSTANTS.new.rebateLimit));
  }

  const rebateFn = (t: number, tax: number) =>
    t <= CONSTANTS.new.rebateLimit
      ? Math.min(tax, CONSTANTS.new.rebateMax)
      : Math.max(0, tax - (t - CONSTANTS.new.rebateLimit));

  return finalise(ti, grossForRate, NEW_SLABS, 'new', rebateFn, cliff, rebate);
};

/**
 * Old regime.
 *
 * `taxableIncome` is income after every deduction the caller chose to claim.
 * The 87A rebate here is a hard cliff at ₹5,00,000 with no marginal relief —
 * that is the law, not an omission.
 */
export const computeOldRegime = (
  taxableIncome: number,
  ageBand: AgeBand = 'below60',
  grossForRate = taxableIncome,
): TaxBreakdown => {
  const ti = Math.max(0, taxableIncome);
  const slabs = OLD_SLABS[ageBand];
  const base = slabTax(ti, slabs);
  const rebate = ti <= CONSTANTS.old.rebateLimit ? Math.min(base, CONSTANTS.old.rebateMax) : 0;

  const rebateFn = (t: number, tax: number) =>
    t <= CONSTANTS.old.rebateLimit ? Math.min(tax, CONSTANTS.old.rebateMax) : 0;

  return finalise(ti, grossForRate, slabs, 'old', rebateFn, 0, rebate);
};

/**
 * HRA exemption under section 10(13A) — least of three amounts.
 * Metro means Delhi, Mumbai, Kolkata or Chennai, and nothing else, however large
 * the city. Old regime only; the new regime does not allow it.
 */
export const hraExemption = (
  hraReceived: number,
  basicPlusDA: number,
  rentPaid: number,
  isMetro: boolean,
): number => {
  if (rentPaid <= 0 || hraReceived <= 0) return 0;
  return Math.max(
    0,
    Math.min(
      hraReceived,
      basicPlusDA * (isMetro ? 0.5 : 0.4),
      rentPaid - basicPlusDA * 0.1,
    ),
  );
};

/**
 * Professional tax, an annual figure. Levied by states, and capped at ₹2,500 a year
 * by Article 276(2) of the Constitution — which is why nobody pays more than that
 * anywhere. Deductible under section 16(iii) in the old regime only.
 */
export const PROFESSIONAL_TAX: { state: string; annual: number }[] = [
  { state: 'Karnataka', annual: 2400 },
  { state: 'Maharashtra', annual: 2500 },
  { state: 'West Bengal', annual: 2400 },
  { state: 'Tamil Nadu', annual: 2496 },
  { state: 'Telangana', annual: 2400 },
  { state: 'Andhra Pradesh', annual: 2400 },
  { state: 'Gujarat', annual: 2400 },
  { state: 'Madhya Pradesh', annual: 2500 },
  { state: 'Kerala', annual: 2500 },
  { state: 'Odisha', annual: 2500 },
  { state: 'Assam', annual: 2500 },
  { state: 'Bihar', annual: 2500 },
  { state: 'Jharkhand', annual: 2500 },
  { state: 'Delhi (none)', annual: 0 },
  { state: 'Uttar Pradesh (none)', annual: 0 },
  { state: 'Haryana (none)', annual: 0 },
  { state: 'Rajasthan (none)', annual: 0 },
  { state: 'Punjab', annual: 2400 },
  { state: 'Chandigarh (none)', annual: 0 },
  { state: 'Goa (none)', annual: 0 },
];

/** ₹12,34,567 → "₹12,34,567". Indian lakh/crore grouping, not thousands. */
export const inr = (n: number, decimals = 0): string => {
  const v = Number.isFinite(n) ? n : 0;
  return (
    '₹' +
    Number(v.toFixed(decimals)).toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
};

/** ₹1,25,00,000 → "₹1.25 Cr". For headline figures where the digits stop helping. */
export const inrShort = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr';
  if (abs >= 1e5) return '₹' + (n / 1e5).toFixed(2) + ' L';
  return inr(n);
};
