import { getYearRates } from './taxRates';

export function marginalRate(netIncome: number, year: number): number {
  const rates = getYearRates(year);
  let fedRate = 0;
  let abRate = 0;

  for (const bracket of rates.federal) {
    if (netIncome > bracket.min) {
      fedRate = bracket.rate;
    }
  }
  for (const bracket of rates.alberta) {
    if (netIncome > bracket.min) {
      abRate = bracket.rate;
    }
  }

  return fedRate + abRate;
}

export function taxSavingsFromDeduction(amount: number, netIncome: number, year: number): number {
  return amount * marginalRate(netIncome, year);
}

export interface BracketInfo {
  currentBracket: number;
  nextBracketAt: number;
  roomLeft: number;
  lowerBracketAt: number;
  deductionToDropBracket: number;
}

export function bracketHeadroom(netIncome: number, year: number): BracketInfo {
  const rates = getYearRates(year);

  const combined: { min: number; max: number | null; rate: number }[] = [];
  const fedBrackets = rates.federal;
  const abBrackets = rates.alberta;

  const breakpoints = new Set<number>();
  breakpoints.add(0);
  for (const b of fedBrackets) { breakpoints.add(b.min); if (b.max) breakpoints.add(b.max); }
  for (const b of abBrackets) { breakpoints.add(b.min); if (b.max) breakpoints.add(b.max); }

  const sortedBreaks = Array.from(breakpoints).sort((a, b) => a - b);

  for (let i = 0; i < sortedBreaks.length; i++) {
    const min = sortedBreaks[i];
    const max = i < sortedBreaks.length - 1 ? sortedBreaks[i + 1] : null;
    const fedR = fedBrackets.find(b => min >= b.min && (b.max === null || min < b.max))?.rate || 0;
    const abR = abBrackets.find(b => min >= b.min && (b.max === null || min < b.max))?.rate || 0;
    combined.push({ min, max, rate: fedR + abR });
  }

  let currentRate = combined[0].rate;
  let nextBracketAt = Infinity;
  let lowerBracketAt = 0;

  for (let i = 0; i < combined.length; i++) {
    const seg = combined[i];
    if (netIncome >= seg.min && (seg.max === null || netIncome < seg.max)) {
      currentRate = seg.rate;
      nextBracketAt = seg.max ?? Infinity;
      lowerBracketAt = seg.min;
      break;
    }
  }

  return {
    currentBracket: Math.round(currentRate * 100),
    nextBracketAt,
    roomLeft: nextBracketAt === Infinity ? Infinity : nextBracketAt - netIncome,
    lowerBracketAt,
    deductionToDropBracket: netIncome - lowerBracketAt,
  };
}

export function cppOnIncome(netIncome: number, year: number): number {
  const rates = getYearRates(year);
  const { basicExemption, ympe, yampe, rate, cpp2Rate } = rates.cpp;

  const pensionableEarnings = Math.max(0, Math.min(netIncome, ympe) - basicExemption);
  const cpp1 = pensionableEarnings * rate;

  const cpp2Earnings = Math.max(0, Math.min(netIncome, yampe) - ympe);
  const cpp2 = cpp2Earnings * cpp2Rate;

  return cpp1 + cpp2;
}
