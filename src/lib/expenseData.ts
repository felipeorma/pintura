export interface SubcategoryDef {
  name: string;
  helperText?: string;
  defaultBusinessUse?: number;
  needsReview?: boolean;
}

export interface CategoryDef {
  name: string;
  subcategories: SubcategoryDef[];
}

export const EXPENSE_CATEGORY_DATA: CategoryDef[] = [
  {
    name: 'Materials and supplies',
    subcategories: [
      { name: 'Paint' },
      { name: 'Brushes' },
      { name: 'Rollers' },
      { name: 'Tape' },
      { name: 'Plastic covers' },
      { name: 'Sandpaper' },
      { name: 'Caulking' },
      { name: 'Cleaning supplies' },
      { name: 'Other painting materials' },
    ],
  },
  {
    name: 'Tools and equipment',
    subcategories: [
      { name: 'Ladder' },
      { name: 'Drill' },
      { name: 'Sander' },
      { name: 'Paint sprayer' },
      { name: 'Extension pole' },
      { name: 'Work lights' },
      { name: 'Toolbox' },
      { name: 'Small tools' },
      { name: 'Large tools / capital asset', needsReview: true, helperText: 'Check if this should be a current expense or capital asset (CCA).' },
      { name: 'Repairs to tools' },
    ],
  },
  {
    name: 'Vehicle / auto',
    subcategories: [
      { name: 'Fuel' },
      { name: 'Oil change' },
      { name: 'Repairs' },
      { name: 'Maintenance' },
      { name: 'Insurance' },
      { name: 'Registration' },
      { name: 'Car wash for work vehicle' },
      { name: 'Parking' },
      { name: 'Business mileage record', helperText: 'Log this in the mileage tracker for proper documentation.' },
      { name: 'Lease/loan interest portion', needsReview: true, helperText: 'Only the business-use portion of lease interest is deductible.' },
      { name: 'Other vehicle cost' },
    ],
  },
  {
    name: 'Fuel',
    subcategories: [
      { name: 'Gas for work vehicle' },
      { name: 'Gas for generator/equipment' },
    ],
  },
  {
    name: 'Parking',
    subcategories: [
      { name: 'Job site parking' },
      { name: 'Client meeting parking' },
      { name: 'Supply store parking' },
    ],
  },
  {
    name: 'Phone',
    subcategories: [
      { name: 'Monthly phone bill', defaultBusinessUse: 50, helperText: 'Enter a reasonable business-use percentage for your phone.' },
      { name: 'Business calls' },
      { name: 'Business data usage' },
      { name: 'Phone accessories' },
      { name: 'Phone repair' },
    ],
  },
  {
    name: 'Internet',
    subcategories: [
      { name: 'Home internet', defaultBusinessUse: 25, helperText: 'Enter a reasonable business-use percentage for your internet.' },
      { name: 'Business-use percentage' },
      { name: 'Router/equipment' },
    ],
  },
  {
    name: 'Home office',
    subcategories: [
      { name: 'Rent portion', helperText: 'Use the home office % from your home office settings.' },
      { name: 'Utilities portion' },
      { name: 'Electricity' },
      { name: 'Heating' },
      { name: 'Home insurance portion' },
      { name: 'Cleaning supplies' },
      { name: 'Office furniture' },
      { name: 'Office supplies' },
      { name: 'Workspace area calculation' },
      { name: 'Other home office cost' },
    ],
  },
  {
    name: 'WCB Premium',
    subcategories: [
      { name: 'Annual premium' },
      { name: 'Installment payment' },
    ],
  },
  {
    name: 'WCB Penalty/Interest',
    subcategories: [
      { name: 'Late payment penalty', needsReview: true },
      { name: 'Interest charge', needsReview: true },
      { name: 'Admin fee', needsReview: true },
    ],
  },
  {
    name: 'Insurance',
    subcategories: [
      { name: 'Commercial liability insurance' },
      { name: 'Tool insurance' },
      { name: 'Vehicle business insurance' },
      { name: 'Other' },
    ],
  },
  {
    name: 'Business license / admin',
    subcategories: [
      { name: 'City license' },
      { name: 'Registration fees' },
      { name: 'CRA/GST documents' },
      { name: 'Legal/admin fees' },
    ],
  },
  {
    name: 'Software / apps',
    subcategories: [
      { name: 'Accounting software' },
      { name: 'Invoice software' },
      { name: 'Cloud storage' },
      { name: 'Business apps' },
      { name: 'Phone apps used for work' },
    ],
  },
  {
    name: 'Bank fees',
    subcategories: [
      { name: 'Monthly bank fees' },
      { name: 'Transaction fees' },
      { name: 'E-transfer fees' },
    ],
  },
  {
    name: 'Accounting / tax preparation',
    subcategories: [
      { name: 'Accountant fees' },
      { name: 'Tax preparation' },
      { name: 'Bookkeeping' },
    ],
  },
  {
    name: 'Safety equipment',
    subcategories: [
      { name: 'Gloves' },
      { name: 'Mask / respirator' },
      { name: 'Safety glasses' },
      { name: 'Ear protection' },
      { name: 'Work boots' },
      { name: 'High-vis clothing' },
      { name: 'Other PPE' },
    ],
  },
  {
    name: 'Work clothing',
    subcategories: [
      { name: 'Painting pants', helperText: 'Only business/work-specific clothing should be tracked.' },
      { name: 'Work shirts', helperText: 'Only business/work-specific clothing should be tracked.' },
      { name: 'Coveralls', helperText: 'Only business/work-specific clothing should be tracked.' },
      { name: 'Work gloves' },
      { name: 'Work boots' },
    ],
  },
  {
    name: 'Meals',
    subcategories: [
      { name: 'Meal with client', needsReview: true, helperText: 'Meals may have limits (50%). Review before tax filing.' },
      { name: 'Travel/work-related meal', needsReview: true, helperText: 'Meals may have limits (50%). Review before tax filing.' },
    ],
  },
  {
    name: 'Subcontractor payments',
    subcategories: [
      { name: 'Payment to subcontractor', helperText: 'Keep records of who you paid and their business number.' },
    ],
  },
  {
    name: 'Other',
    subcategories: [
      { name: 'Other business expense' },
    ],
  },
];

export const PAYMENT_METHODS = [
  'Debit card',
  'Credit card',
  'Cash',
  'E-transfer',
  'Cheque',
  'Other',
] as const;

export const TAX_CONFIDENCE_OPTIONS = [
  { value: 'clear', label: 'Clear - No issues' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'ask_accountant', label: 'Ask Accountant' },
] as const;
