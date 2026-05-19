export interface Profile {
  id: string;
  full_name: string;
  business_name: string;
  email: string;
  phone: string;
  city: string;
  province: string;
  home_address: string | null;
  business_number: string | null;
  gst_enabled: boolean;
  gst_number: string | null;
  gst_rate: number;
  wcb_account_number: string;
  wcb_industry_code: string | null;
  wcb_industry_rate: number | null;
  wcb_coverage_effective_date: string | null;
  wcb_coverage_expiry_date: string | null;
  wcb_insurable_earnings: number | null;
  wcb_annual_premium: number | null;
  default_hourly_rate: number | null;
  default_tax_reserve_percent: number;
  home_office_percent: number;
  vehicle_business_use_percent: number;
  phone_business_use_percent: number;
  internet_business_use_percent: number;
  fiscal_year_start: string;
  industry_code: string | null;
  payment_instructions: string | null;
  rrsp_room_remaining: number | null;
  rrsp_planned_contribution: number | null;
  tfsa_room_remaining: number | null;
  prev_year_net_income: number | null;
  previous_year_taxable_income: number | null;
  last_noa_year: number | null;
  canada_training_credit_remaining: number | null;
  tfsa_room_warning: boolean;
  tfsa_room_verified_date: string | null;
  card_slug: string | null;
  card_image_url: string | null;
  tagline: string | null;
  website: string | null;
  service_area: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobSite {
  id: string;
  user_id: string;
  client_id: string | null;
  site_name: string;
  address: string | null;
  city: string | null;
  province: string;
  postal_code: string | null;
  distance_from_home_km: number | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  clients?: Client;
}

export interface WorkHour {
  id: string;
  user_id: string;
  client_id: string | null;
  job_site_id: string | null;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  total_hours: number | null;
  hourly_rate: number | null;
  subtotal: number | null;
  gst_amount: number;
  total_amount: number | null;
  status: 'not_invoiced' | 'invoiced' | 'paid';
  notes: string | null;
  created_at: string;
  updated_at: string;
  clients?: Client;
  job_sites?: JobSite;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  pdf_url: string | null;
  show_business_address: boolean;
  show_gst_number: boolean;
  created_at: string;
  updated_at: string;
  clients?: Client;
}

export interface InvoiceItem {
  id: string;
  user_id: string;
  invoice_id: string;
  work_hour_id: string | null;
  job_site_id: string | null;
  description: string | null;
  work_date: string | null;
  hours: number | null;
  rate: number | null;
  subtotal: number | null;
  gst_amount: number;
  total_amount: number | null;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  invoice_id: string | null;
  client_id: string | null;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  invoices?: Invoice;
  clients?: Client;
}

export interface Expense {
  id: string;
  user_id: string;
  expense_date: string;
  vendor: string | null;
  category: string | null;
  description: string | null;
  job_site_id: string | null;
  subtotal_before_gst: number;
  gst_paid: number;
  total_paid: number;
  business_use_percent: number;
  deductible_amount: number;
  itc_claim_amount: number;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  job_sites?: JobSite;
}

export interface WcbPremium {
  id: string;
  user_id: string;
  year: number;
  total_premium_amount: number;
  insurable_earnings_declared: number | null;
  industry_code: string | null;
  industry_rate: number | null;
  assessment_letter_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WcbInstallment {
  id: string;
  user_id: string;
  wcb_premium_id: string | null;
  installment_number: number;
  due_date: string | null;
  amount_due: number;
  amount_paid: number;
  paid_date: string | null;
  payment_method: string | null;
  receipt_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type WcbClearanceDirection = 'issued_to_me' | 'i_issued';
export type WcbClearanceStatus = 'cleared' | 'not_cleared' | 'pending';

export interface WcbClearanceLetter {
  id: string;
  user_id: string;
  direction: WcbClearanceDirection;
  counterparty_name: string;
  letter_date: string | null;
  valid_through_date: string | null;
  status: WcbClearanceStatus;
  pdf_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type WcbChargeType = 'penalty' | 'interest' | 'admin_fee' | 'other';

export interface WcbCharge {
  id: string;
  user_id: string;
  wcb_premium_id: string | null;
  charge_type: WcbChargeType;
  amount: number;
  charge_date: string | null;
  paid: boolean;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  document_type: string | null;
  title: string | null;
  file_url: string | null;
  notes: string | null;
  uploaded_at: string;
}

export const EXPENSE_CATEGORIES = [
  'Materials and supplies',
  'Tools and equipment',
  'Vehicle / auto',
  'Fuel',
  'Parking',
  'Phone',
  'Internet',
  'Home office',
  'WCB Premium',
  'WCB Penalty/Interest',
  'Insurance',
  'Business license / admin',
  'Software / apps',
  'Bank fees',
  'Accounting / tax preparation',
  'Safety equipment',
  'Work clothing',
  'Meals',
  'Subcontractor payments',
  'Other',
] as const;

export const DOCUMENT_TYPES = [
  'Receipt',
  'Invoice PDF',
  'WCB document',
  'GST / CRA document',
  'Contract',
  'Job site photo',
  'Other',
] as const;

export type PersonalCreditType = 'tuition' | 'medical' | 'charitable' | 'political' | 'canada_training' | 'other';

export interface PersonalTaxCredit {
  id: string;
  user_id: string;
  year: number;
  credit_type: PersonalCreditType;
  amount: number;
  description: string | null;
  receipt_url: string | null;
  t_form_received: boolean;
  notes: string | null;
  created_at: string;
}

export interface EmploymentIncome {
  id: string;
  user_id: string;
  year: number;
  employer_name: string;
  employer_address: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  position_title: string | null;
  box_14_employment_income: number;
  box_16_cpp_contributions: number;
  box_17_qpp_contributions: number;
  box_18_ei_premiums: number;
  box_20_rpp_contributions: number;
  box_22_income_tax_deducted: number;
  box_24_ei_insurable_earnings: number;
  box_26_cpp_pensionable_earnings: number;
  box_44_union_dues: number;
  box_46_charitable_donations: number;
  box_52_pension_adjustment: number;
  t4_received: boolean;
  t4_filed_with_cra: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Paystub {
  id: string;
  user_id: string;
  employment_income_id: string;
  pay_period_end: string;
  gross_pay: number;
  cpp_withheld: number;
  ei_withheld: number;
  tax_withheld: number;
  rpp_withheld: number;
  other_deductions: number;
  net_pay: number;
  notes: string | null;
  created_at: string;
}

export const PERSONAL_CREDIT_TYPES: { value: PersonalCreditType; label: string }[] = [
  { value: 'tuition', label: 'Tuition (T2202)' },
  { value: 'medical', label: 'Medical Expenses' },
  { value: 'charitable', label: 'Charitable Donations' },
  { value: 'political', label: 'Political Donations' },
  { value: 'canada_training', label: 'Canada Training Credit' },
  { value: 'other', label: 'Other' },
];
