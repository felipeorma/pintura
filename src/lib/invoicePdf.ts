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

export function generateInvoicePdf(
  invoice: InvoiceForPdf,
  items: InvoiceLineItem[],
  profile: Profile,
  client: Client
) {
  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00');
    return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatItemDate = (d: string) => {
    const date = new Date(d + 'T00:00');
    return date.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatCurrency = (n: number) => `$${n.toFixed(2)}`;

  const itemRows = items.map((item, i) => `
    <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
      <td style="padding: 11px 14px; border-bottom: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; white-space: nowrap;">
        ${item.work_date ? formatItemDate(item.work_date) : '-'}
      </td>
      <td style="padding: 11px 14px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #374151;">
        ${item.description || 'Service'}
      </td>
      <td style="padding: 11px 14px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #6b7280; text-align: center;">
        ${item.hours != null ? item.hours.toFixed(1) : '-'}
      </td>
      <td style="padding: 11px 14px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #6b7280; text-align: right;">
        ${item.rate != null ? formatCurrency(item.rate) : '-'}
      </td>
      <td style="padding: 11px 14px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #111827; text-align: right; font-weight: 600;">
        ${formatCurrency(item.subtotal || 0)}
      </td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Felipe Invoice - ${client.name.replace(/[^a-zA-Z0-9 ]/g, '').trim()} - ${formatDate(invoice.invoice_date)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1f2937;
      line-height: 1.5;
      width: 816px;
      background: #ffffff;
    }
    @page {
      size: letter portrait;
      margin: 0;
    }
    @media print {
      html, body {
        width: 816px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>

  <div style="width: 816px; padding: 0; border-top: 6px solid #0d9488; border-bottom: 4px solid #0891b2;">
    <div style="padding: 40px 56px 36px 56px;">

      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px;">
        <div>
          <h1 style="font-size: 36px; font-weight: 800; color: #0d9488; letter-spacing: -1px; line-height: 1;">INVOICE</h1>
          <p style="font-size: 13px; color: #9ca3af; margin-top: 6px; letter-spacing: 0.3px;">${invoice.invoice_number}</p>
        </div>
        <div style="text-align: right;">
          <p style="font-size: 17px; font-weight: 700; color: #111827;">${profile.business_name || profile.full_name}</p>
          ${profile.full_name && profile.business_name ? `<p style="font-size: 13px; color: #6b7280; margin-top: 2px;">${profile.full_name}</p>` : ''}
          ${profile.home_address ? `<p style="font-size: 13px; color: #6b7280;">${profile.home_address}</p>` : ''}
          ${profile.city ? `<p style="font-size: 13px; color: #6b7280;">${profile.city}${profile.province ? ', ' + profile.province : ''}</p>` : ''}
          ${profile.phone ? `<p style="font-size: 13px; color: #6b7280; margin-top: 4px;">${profile.phone}</p>` : ''}
          ${profile.email ? `<p style="font-size: 13px; color: #6b7280;">${profile.email}</p>` : ''}
          ${profile.gst_number ? `<p style="font-size: 12px; color: #9ca3af; margin-top: 4px;">GST # ${profile.gst_number}</p>` : ''}
        </div>
      </div>

      <!-- Divider -->
      <div style="height: 1px; background: #e5e7eb; margin-bottom: 24px;"></div>

      <!-- Bill To + Dates -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px;">
        <div style="background: #f9fafb; border-radius: 10px; padding: 18px 22px; min-width: 200px;">
          <p style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 6px;">Bill To</p>
          <p style="font-size: 15px; font-weight: 700; color: #111827;">${client.name}</p>
          ${client.contact_name ? `<p style="font-size: 13px; color: #6b7280; margin-top: 2px;">${client.contact_name}</p>` : ''}
          ${client.email ? `<p style="font-size: 13px; color: #6b7280;">${client.email}</p>` : ''}
          ${client.phone ? `<p style="font-size: 13px; color: #6b7280;">${client.phone}</p>` : ''}
        </div>
        <div style="display: flex; gap: 32px; text-align: right;">
          <div>
            <p style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 4px;">Invoice Date</p>
            <p style="font-size: 14px; color: #111827; font-weight: 500;">${formatDate(invoice.invoice_date)}</p>
          </div>
          ${invoice.due_date ? `
          <div>
            <p style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 4px;">Due Date</p>
            <p style="font-size: 14px; color: #111827; font-weight: 500;">${formatDate(invoice.due_date)}</p>
          </div>
          ` : ''}
        </div>
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background: #111827;">
            <th style="padding: 11px 14px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Date</th>
            <th style="padding: 11px 14px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Description</th>
            <th style="padding: 11px 14px; text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Hrs</th>
            <th style="padding: 11px 14px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Rate</th>
            <th style="padding: 11px 14px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <!-- Totals -->
      <div style="display: flex; justify-content: flex-end; margin-bottom: 28px;">
        <div style="width: 260px;">
          <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; border-bottom: 1px solid #f3f4f6;">
            <span style="color: #6b7280;">Subtotal</span>
            <span style="color: #374151; font-weight: 500;">${formatCurrency(invoice.subtotal)}</span>
          </div>
          ${invoice.gst_amount > 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; border-bottom: 1px solid #f3f4f6;">
            <span style="color: #6b7280;">GST (${profile.gst_rate || 5}%)</span>
            <span style="color: #374151; font-weight: 500;">${formatCurrency(invoice.gst_amount)}</span>
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding: 14px 16px; background: #0d9488; border-radius: 8px;">
            <span style="font-size: 14px; font-weight: 700; color: #ffffff;">Total Due</span>
            <span style="font-size: 20px; font-weight: 800; color: #ffffff;">${formatCurrency(invoice.total_amount)}</span>
          </div>
        </div>
      </div>

      <!-- Notes / Payment Instructions -->
      ${invoice.notes || profile.payment_instructions ? `
      <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; display: flex; gap: 40px; margin-bottom: 24px;">
        ${invoice.notes ? `
        <div style="flex: 1;">
          <p style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 6px;">Notes</p>
          <p style="font-size: 13px; color: #4b5563; line-height: 1.6;">${invoice.notes}</p>
        </div>
        ` : ''}
        ${profile.payment_instructions ? `
        <div style="flex: 1;">
          <p style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 6px;">Payment Instructions</p>
          <p style="font-size: 13px; color: #4b5563; white-space: pre-line; line-height: 1.6;">${profile.payment_instructions}</p>
        </div>
        ` : ''}
      </div>
      ` : ''}

      <!-- Footer -->
      <div style="border-top: 1px solid #f3f4f6; padding-top: 16px; display: flex; justify-content: space-between; align-items: center;">
        <p style="font-size: 12px; color: #d1d5db;">Thank you!</p>
        <p style="font-size: 11px; color: #d1d5db;">${invoice.invoice_number}</p>
      </div>

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

  const triggerPrint = () => {
  const clientName = client.name.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const date = formatDate(invoice.invoice_date);
  const title = `Felipe Invoice - ${clientName} - ${date}`;
  const originalTitle = document.title;

  // Cambia el título ANTES del timeout, no dentro
  document.title = title;

  setTimeout(() => {
    const win = iframe.contentWindow;
    if (!win) return;
    win.document.title = title;
    win.print();
    setTimeout(() => {
      document.title = originalTitle;
      document.body.removeChild(iframe);
    }, 2000);
  }, 500);
};

  iframe.onload = triggerPrint;

  if (iframeDoc.readyState === 'complete') {
    triggerPrint();
  }
}