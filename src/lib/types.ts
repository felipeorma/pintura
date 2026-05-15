export interface Profile {
  id: string;
  full_name: string;
  business_name: string;
  email: string;
  phone: string;
  city: string;
  province: string;
  gst_enabled: boolean;
  gst_number: string | null;
  gst_rate: number;
  wcb_account_number: string;
  default_hourly_rate: number | null;
  default_tax_reserve_percent: number;
  payment_instructions: string | null;
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

export type WcbStatus = 'waiting_for_invoice' | 'invoice_received' | 'partially_paid' | 'paid' | 'overdue' | 'pending';

export interface WcbPayment {
  id: string;
  user_id: string;
  description: string | null;
  expected_invoice_date: string | null;
  invoice_received: boolean;
  invoice_date: string | null;
  due_date: string | null;
  amount_expected: number;
  amount_paid: number;
  remaining_balance: number;
  payment_date: string | null;
  status: WcbStatus;
  document_url: string | null;
  notes: string | null;
  amount: number | null;
  created_at: string;
  updated_at: string;
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
  'WCB',
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
