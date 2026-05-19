import type { Profile, Client } from './types';

interface InvoiceLineItem {
  description: string | null;
  work_date: string | null;
  hours: number | null;
  rate: number | null;
  subtotal: number | null;
  gst_amount: number;
  total_amount: number | null;
}

interface InvoiceForPdf {
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  notes: string | null;
}

type BillingInfo = {
  address: string;
  city: string;
  province: string;
  postal_code: string;
};

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function textToHtml(value: string | null | undefined) {
  return escapeHtml(value).replace(/\n/g, '<br />');
}

function parseBillingFromNotes(notes: string | null): BillingInfo {
  const emptyBilling: BillingInfo = {
    address: '',
    city: '',
    province: '',
    postal_code: '',
  };

  if (!notes) return emptyBilling;

  const blockMatch = notes.match(/\[BILLING_ADDRESS\]([\s\S]*?)\[\/BILLING_ADDRESS\]/);

  if (blockMatch?.[1]) {
    const values = blockMatch[1]
      .split('\n')
      .reduce<Record<string, string>>((acc, line) => {
        const [key, ...rest] = line.split('=');
        if (!key) return acc;

        acc[key.trim()] = rest.join('=').trim();
        return acc;
      }, {});

    return {
      address: values.address || '',
      city: values.city || '',
      province: values.province || '',
      postal_code: values.postal_code || '',
    };
  }

  const legacyMatch = notes.match(/^Billing Address:\s*(.*)$/im);

  if (legacyMatch?.[1]) {
    return {
      ...emptyBilling,
      address: legacyMatch[1].trim(),
    };
  }

  return emptyBilling;
}

function cleanNotes(notes: string | null) {
  if (!notes) return '';

  return notes
    .replace(/\[BILLING_ADDRESS\][\s\S]*?\[\/BILLING_ADDRESS\]/g, '')
    .replace(/^Billing Address:.*$/gim, '')
    .trim();
}

function getClientBillingInfo(client: Client): BillingInfo {
  const parsed = parseBillingFromNotes(client.notes);

  return {
    address: (client as any).address || parsed.address || '',
    city: (client as any).city || parsed.city || '',
    province: (client as any).province || parsed.province || '',
    postal_code: (client as any).postal_code || parsed.postal_code || '',
  };
}

function formatAddressLines(info: BillingInfo) {
  const cityProvince = [info.city, info.province].filter(Boolean).join(', ');
  const cityLine = [cityProvince, info.postal_code].filter(Boolean).join(' ');

  return [info.address, cityLine].filter(Boolean);
}

function getBusinessAddressLines(profile: Profile) {
  const cityProvince = [profile.city, profile.province].filter(Boolean).join(', ');
  const cityLine = [cityProvince, profile.postal_code].filter(Boolean).join(' ');

  return [profile.home_address, cityLine].filter(Boolean);
}

export function generateInvoicePdf(
  invoice: InvoiceForPdf,
  items: InvoiceLineItem[],
  profile: Profile,
  client: Client
) {
  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00');

    return date.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatItemDate = (d: string) => {
    const date = new Date(d + 'T00:00');

    return date.toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (n: number | null | undefined) => {
    return `$${(n || 0).toFixed(2)}`;
  };

  const GST_RATE_LABEL = '5%';

  const clientBillingInfo = getClientBillingInfo(client);
  const clientAddressLines = formatAddressLines(clientBillingInfo);
  const businessAddressLines = getBusinessAddressLines(profile);
  const safeInvoiceNotes = cleanNotes(invoice.notes);

  const itemRows = items
    .map(
      item => `
        <tr>
          <td class="td td-muted nowrap">
            ${item.work_date ? escapeHtml(formatItemDate(item.work_date)) : '-'}
          </td>

          <td class="td description">
            ${escapeHtml(item.description || 'Service')}
          </td>

          <td class="td center">
            ${item.hours != null ? item.hours.toFixed(2) : '-'}
          </td>

          <td class="td right">
            ${item.rate != null ? formatCurrency(item.rate) : '-'}
          </td>

          <td class="td right amount">
            ${formatCurrency(item.subtotal)}
          </td>
        </tr>
      `
    )
    .join('');

  const gstItemRow =
    invoice.gst_amount > 0
      ? `
        <tr>
          <td class="td td-muted nowrap">
            Tax
          </td>

          <td class="td description">
            GST ${GST_RATE_LABEL}
            <span class="item-note">Goods and Services Tax</span>
          </td>

          <td class="td center">
            -
          </td>

          <td class="td right">
            ${GST_RATE_LABEL}
          </td>

          <td class="td right amount">
            ${formatCurrency(invoice.gst_amount)}
          </td>
        </tr>
      `
      : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${escapeHtml(invoice.invoice_number)}</title>

  <style>
    @page {
      size: letter;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family:
        Inter,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Roboto,
        Arial,
        sans-serif;
      background: #f3f4f6;
      color: #111827;
      line-height: 1.45;
    }

    .page {
      width: 8.5in;
      min-height: 11in;
      margin: 0 auto;
      background: #ffffff;
      position: relative;
      overflow: hidden;
    }

    .top-bar {
      height: 14px;
      background: linear-gradient(90deg, #020617 0%, #1f2937 65%, #0f766e 100%);
    }

    .container {
      padding: 44px 48px 36px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 32px;
      margin-bottom: 32px;
    }

    .eyebrow {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #0f766e;
      margin-bottom: 8px;
    }

    .invoice-title {
      font-size: 42px;
      line-height: 1;
      font-weight: 900;
      letter-spacing: -0.06em;
      color: #020617;
    }

    .invoice-number {
      margin-top: 10px;
      font-size: 14px;
      color: #64748b;
      font-weight: 600;
    }

    .total-card {
      background: #020617;
      color: #ffffff;
      padding: 20px 22px;
      border-radius: 22px;
      min-width: 240px;
      text-align: right;
      box-shadow: 0 20px 40px rgba(15, 23, 42, 0.16);
    }

    .total-label {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #ccfbf1;
    }

    .total-value {
      margin-top: 8px;
      font-size: 30px;
      font-weight: 900;
      letter-spacing: -0.04em;
    }

    .total-subtext {
      margin-top: 8px;
      font-size: 12px;
      color: #cbd5e1;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 28px;
    }

    .party-card {
      border: 1px solid #e5e7eb;
      border-radius: 20px;
      padding: 18px;
      background: #ffffff;
    }

    .party-card.dark {
      background: #f8fafc;
    }

    .section-label {
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 10px;
    }

    .party-name {
      font-size: 15px;
      font-weight: 800;
      color: #111827;
      margin-bottom: 4px;
    }

    .party-line {
      font-size: 12.5px;
      color: #64748b;
      margin-top: 2px;
    }

    .gst-pill {
      display: inline-block;
      margin-top: 10px;
      padding: 6px 10px;
      border-radius: 999px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      color: #334155;
      font-size: 11px;
      font-weight: 800;
    }

    .dates-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 28px;
    }

    .date-card {
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 14px 16px;
    }

    .date-label {
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 4px;
    }

    .date-value {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
    }

    .table-wrap {
      border: 1px solid #e5e7eb;
      border-radius: 18px;
      overflow: hidden;
      margin-bottom: 24px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead tr {
      background: #020617;
    }

    th {
      padding: 12px 14px;
      text-align: left;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #cbd5e1;
    }

    th.center {
      text-align: center;
    }

    th.right {
      text-align: right;
    }

    tbody tr:nth-child(even) {
      background: #f8fafc;
    }

    .td {
      padding: 13px 14px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 12.5px;
      color: #334155;
      vertical-align: top;
    }

    tbody tr:last-child .td {
      border-bottom: none;
    }

    .td-muted {
      color: #64748b;
      font-size: 12px;
    }

    .description {
      color: #111827;
      font-weight: 600;
    }

    .item-note {
      display: block;
      margin-top: 2px;
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
    }

    .center {
      text-align: center;
    }

    .right {
      text-align: right;
    }

    .nowrap {
      white-space: nowrap;
    }

    .amount {
      color: #111827;
      font-weight: 800;
    }

    .summary-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 26px;
    }

    .summary-card {
      width: 300px;
      border-radius: 20px;
      border: 1px solid #e5e7eb;
      background: #f8fafc;
      padding: 18px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 7px 0;
      font-size: 13px;
      color: #64748b;
    }

    .summary-row strong {
      color: #111827;
    }

    .summary-total {
      margin-top: 8px;
      padding-top: 14px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      font-size: 18px;
      font-weight: 900;
      color: #020617;
    }

    .summary-total span:last-child {
      color: #0f766e;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      margin-top: 20px;
    }

    .info-box {
      border: 1px solid #e5e7eb;
      background: #ffffff;
      border-radius: 18px;
      padding: 16px;
    }

    .info-title {
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 8px;
    }

    .info-text {
      font-size: 12.5px;
      color: #475569;
      white-space: pre-line;
    }

    .footer {
      position: absolute;
      left: 48px;
      right: 48px;
      bottom: 28px;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      border-top: 1px solid #e5e7eb;
      padding-top: 14px;
      font-size: 11px;
      color: #94a3b8;
    }

    .footer strong {
      color: #334155;
    }

    @media print {
      body {
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .page {
        margin: 0;
        width: 8.5in;
        min-height: 11in;
        box-shadow: none;
      }
    }
  </style>
</head>

<body>
  <div class="page">
    <div class="top-bar"></div>

    <div class="container">
      <div class="header">
        <div>
          <div class="eyebrow">Professional Invoice</div>
          <h1 class="invoice-title">INVOICE</h1>
          <p class="invoice-number">${escapeHtml(invoice.invoice_number)}</p>
        </div>

        <div class="total-card">
          <div class="total-label">Amount Due</div>
          <div class="total-value">${formatCurrency(invoice.total_amount)}</div>
          ${
            invoice.due_date
              ? `<div class="total-subtext">Due ${escapeHtml(formatDate(invoice.due_date))}</div>`
              : ''
          }
        </div>
      </div>

      <div class="meta-grid">
        <div class="party-card">
          <p class="section-label">From</p>

          <p class="party-name">
            ${escapeHtml(profile.business_name || profile.full_name || 'Business')}
          </p>

          ${
            profile.full_name && profile.business_name
              ? `<p class="party-line">${escapeHtml(profile.full_name)}</p>`
              : ''
          }

          ${businessAddressLines
            .map(line => `<p class="party-line">${escapeHtml(line)}</p>`)
            .join('')}

          ${profile.phone ? `<p class="party-line">${escapeHtml(profile.phone)}</p>` : ''}
          ${profile.email ? `<p class="party-line">${escapeHtml(profile.email)}</p>` : ''}

          ${
            profile.gst_number
              ? `<div class="gst-pill">GST: ${escapeHtml(profile.gst_number)}</div>`
              : ''
          }
        </div>

        <div class="party-card dark">
          <p class="section-label">Bill To</p>

          <p class="party-name">${escapeHtml(client.name)}</p>

          ${clientAddressLines
            .map(line => `<p class="party-line">${escapeHtml(line)}</p>`)
            .join('')}

          ${
            client.contact_name
              ? `<p class="party-line" style="margin-top: 8px;">Contact: ${escapeHtml(client.contact_name)}</p>`
              : ''
          }

          ${client.email ? `<p class="party-line">${escapeHtml(client.email)}</p>` : ''}
          ${client.phone ? `<p class="party-line">${escapeHtml(client.phone)}</p>` : ''}
        </div>
      </div>

      <div class="dates-row">
        <div class="date-card">
          <p class="date-label">Invoice Date</p>
          <p class="date-value">${escapeHtml(formatDate(invoice.invoice_date))}</p>
        </div>

        <div class="date-card">
          <p class="date-label">Due Date</p>
          <p class="date-value">
            ${invoice.due_date ? escapeHtml(formatDate(invoice.due_date)) : 'Upon receipt'}
          </p>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th class="center">Qty/Hrs</th>
              <th class="right">Rate</th>
              <th class="right">Amount</th>
            </tr>
          </thead>

          <tbody>
            ${itemRows}
            ${gstItemRow}
          </tbody>
        </table>
      </div>

      <div class="summary-section">
        <div class="summary-card">
          <div class="summary-row">
            <span>Subtotal</span>
            <strong>${formatCurrency(invoice.subtotal)}</strong>
          </div>

          ${
            invoice.gst_amount > 0
              ? `
                <div class="summary-row">
                  <span>GST (${GST_RATE_LABEL})</span>
                  <strong>${formatCurrency(invoice.gst_amount)}</strong>
                </div>
              `
              : ''
          }

          <div class="summary-total">
            <span>Total</span>
            <span>${formatCurrency(invoice.total_amount)}</span>
          </div>
        </div>
      </div>

      ${
        safeInvoiceNotes || profile.payment_instructions
          ? `
            <div class="info-grid">
              ${
                safeInvoiceNotes
                  ? `
                    <div class="info-box">
                      <p class="info-title">Notes</p>
                      <p class="info-text">${textToHtml(safeInvoiceNotes)}</p>
                    </div>
                  `
                  : ''
              }

              ${
                profile.payment_instructions
                  ? `
                    <div class="info-box">
                      <p class="info-title">Payment Instructions</p>
                      <p class="info-text">${textToHtml(profile.payment_instructions)}</p>
                    </div>
                  `
                  : ''
              }
            </div>
          `
          : ''
      }
    </div>

    <div class="footer">
      <span>Thank you for your business.</span>
      <span><strong>${escapeHtml(profile.business_name || profile.full_name || '')}</strong></span>
    </div>
  </div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';

  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

  if (!iframeDoc) return;

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  const printInvoice = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 300);
  };

  iframe.onload = printInvoice;

  if (iframeDoc.readyState === 'complete') {
    printInvoice();
  }
}
