interface TaxBracket {
  min: number;
  max: number | null;
  rate: number;
}

interface CppRates {
  basicExemption: number;
  ympe: number;
  yampe: number;
  rate: number;
  cpp2Rate: number;
  maxContribution: number;
  maxCpp2Contribution: number;
}

interface YearRates {
  federal: TaxBracket[];
  alberta: TaxBracket[];
  federalBPA: number;
  albertaBPA: number;
  cpp: CppRates;
}

export const TAX_RATES: Record<number, YearRates> = {
  2024: {
    federal: [
      { min: 0, max: 55867, rate: 0.15 },
      { min: 55867, max: 111733, rate: 0.205 },
      { min: 111733, max: 154906, rate: 0.26 },
      { min: 154906, max: 220000, rate: 0.29 },
      { min: 220000, max: null, rate: 0.33 },
    ],
    alberta: [
      { min: 0, max: 148269, rate: 0.10 },
      { min: 148269, max: 177922, rate: 0.12 },
      { min: 177922, max: 237230, rate: 0.13 },
      { min: 237230, max: 355845, rate: 0.14 },
      { min: 355845, max: null, rate: 0.15 },
    ],
    federalBPA: 15705,
    albertaBPA: 21003,
    cpp: {
      basicExemption: 3500,
      ympe: 68500,
      yampe: 73200,
      rate: 0.119,
      cpp2Rate: 0.08,
      maxContribution: 7735,
      maxCpp2Contribution: 376,
    },
  },
  2025: {
    federal: [
      { min: 0, max: 57375, rate: 0.15 },
      { min: 57375, max: 114750, rate: 0.205 },
      { min: 114750, max: 177882, rate: 0.26 },
      { min: 177882, max: 253414, rate: 0.29 },
      { min: 253414, max: null, rate: 0.33 },
    ],
    alberta: [
      { min: 0, max: 60000, rate: 0.08 },
      { min: 60000, max: 151234, rate: 0.10 },
      { min: 151234, max: 181481, rate: 0.12 },
      { min: 181481, max: 241974, rate: 0.13 },
      { min: 241974, max: 362961, rate: 0.14 },
      { min: 362961, max: null, rate: 0.15 },
    ],
    federalBPA: 16129,
    albertaBPA: 22323,
    cpp: {
      basicExemption: 3500,
      ympe: 71300,
      yampe: 81200,
      rate: 0.119,
      cpp2Rate: 0.08,
      maxContribution: 8068.20,
      maxCpp2Contribution: 852,
    },
  },
};

export function getYearRates(year: number): YearRates {
  return TAX_RATES[year] || TAX_RATES[2025];
}
