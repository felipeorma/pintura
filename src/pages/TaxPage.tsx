import { useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  AlertTriangle,
  Calculator,
  Car,
  CheckCircle,
  ClipboardCheck,
  DollarSign,
  FileText,
  Home,
  Lightbulb,
  Receipt,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

interface TaxData {
  incomeBeforeGst: number;
  gstCollected: number;
  gstItc: number;
  gstPayable: number;
  expenses: number;
  wcbPaid: number;
  paymentsReceived: number;
  estimatedProfit: number;
  federalTax: number;
  albertaTax: number;
  cpp: number;
  cpp2: number;
  incomeTaxAndCpp: number;
  totalToSave: number;
  safeCash: number;
  filingDeadline: string;
  paymentDeadline: string;
  missingReceipts: number;
  missingReceiptsAmount: number;
  needsReview: number;
  totalKm: number;
  hasVehicle: boolean;
  hasHomeOffice: boolean;
  uninvoicedCount: number;
  uninvoicedAmount: number;
  formRows: FormRow[];
  opportunities: Opportunity[];
}

interface FormRow {
  form: string;
  line: string;
  description: string;
  amount: number;
}

interface Opportunity {
  id: string;
  priority: 'high' | 'medium' | 'low';
  icon: ReactElement;
  title: string;
  detail: string;
  action: string;
  estimate?: number;
}

const money = (value: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value || 0);

const COMMON_DEDUCTION_CATEGORIES = [
  'Materials and supplies',
  'Tools and equipment',
  'Parking',
  'Phone',
  'Internet',
  'Insurance',
  'Bank fees',
  'Accounting / tax preparation',
  'Safety equipment',
  'Work clothing',
];

const CATEGORY_LINES: Record<string, { line: string; label: string }> = {
  'Materials and supplies': { line: 'T2125 line 8320 / 8811', label: 'Materials, supplies, office supplies' },
  'Tools and equipment': { line: 'T2125 CCA area / line 9270 if current expense', label: 'Tools and equipment' },
  'Vehicle / auto': { line: 'T2125 line 9281 + Motor vehicle chart', label: 'Motor vehicle expenses' },
  Fuel: { line: 'T2125 line 9281 + Motor vehicle chart', label: 'Fuel and vehicle costs' },
  Parking: { line: 'T2125 line 9281', label: 'Parking for business trips' },
  Phone: { line: 'T2125 line 9220', label: 'Telephone and utilities' },
  Internet: { line: 'T2125 line 9220 / business-use-of-home', label: 'Internet business portion' },
  'Home office': { line: 'T2125 line 9945', label: 'Business-use-of-home expenses' },
  WCB: { line: 'T2125 line 8760 / 8690', label: 'Business fees or insurance' },
  Insurance: { line: 'T2125 line 8690', label: 'Business insurance' },
  'Business license / admin': { line: 'T2125 line 8760', label: 'Licences, dues, memberships' },
  'Software / apps': { line: 'T2125 line 8810', label: 'Office/software expenses' },
  'Bank fees': { line: 'T2125 line 8710', label: 'Interest and bank charges' },
  'Accounting / tax preparation': { line: 'T2125 line 8860', label: 'Professional fees' },
  'Safety equipment': { line: 'T2125 line 8811 / 9270', label: 'Safety supplies and equipment' },
  'Work clothing': { line: 'T2125 line 8811 / 9270', label: 'Protective work clothing' },
  Meals: { line: 'T2125 line 8523', label: 'Meals and entertainment' },