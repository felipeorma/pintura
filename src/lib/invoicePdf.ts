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

  const itemRows = items.map(item => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; white-space: nowrap;">
        ${item.work_date ? formatItemDate(item.work_date) : '-'}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151;">
        ${item.description || 'Service'}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151; text-align: center;">
        ${item.hours != null ? item.hours.toFixed(1) : '-'}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151; text-align: right;">
        ${item.rate != null ? formatCurrency(item.rate) : '-'}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151; text-align: right; font-weight: 500;">
        ${formatCurrency(item.subtotal || 0)}
      </td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; line-height: 1.5; }
  @page {
    size: letter portrait;
    margin: 0;
  }
  @media print {
    html, body {
      width: 100%;
      height: 100%;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body > div {
      /* Escala el contenido para que quepa siempre en 1 página */
      transform-origin: top left;
      transform: scale(var(--print-scale, 1));
      width: calc(100% / var(--print-scale, 1));
    }
    /* Evita que se parta en múltiples páginas */
    table { page-break-inside: avoid; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div style="max-width: 800px; margin: 0 auto; padding: 48px;">
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px;">
      <div>
        <h1 style="font-size: 28px; font-weight: 700; color: #0d9488; letter-spacing: -0.5px;">INVOICE</h1>
        <p style="font-size: 14px; color: #6b7280; margin-top: 4px;">${invoice.invoice_number}</p>
      </div>
      <div style="text-align: right;">
        <p style="font-size: 16px; font-weight: 600; color: #1f2937;">${profile.business_name || profile.full_name}</p>
        ${profile.full_name && profile.business_name ? `<p style="font-size: 13px; color: #6b7280;">${profile.full_name}</p>` : ''}
        ${profile.city ? `<p style="font-size: 13px; color: #6b7280;">${profile.city}${profile.province ? ', ' + profile.province : ''}</p>` : ''}
        ${profile.phone ? `<p style="font-size: 13px; color: #6b7280;">${profile.phone}</p>` : ''}
        ${profile.email ? `<p style="font-size: 13px; color: #6b7280;">${profile.email}</p>` : ''}
      </div>
    </div>

    <!-- Bill To + Dates -->
    <div style="display: flex; justify-content: space-between; margin-bottom: 32px; padding: 20px; background: #f9fafb; border-radius: 8px;">
      <div>
        <p style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 6px;">Bill To</p>
        <p style="font-size: 14px; font-weight: 600; color: #1f2937;">${client.name}</p>
        ${client.contact_name ? `<p style="font-size: 13px; color: #6b7280;">${client.contact_name}</p>` : ''}
        ${client.email ? `<p style="font-size: 13px; color: #6b7280;">${client.email}</p>` : ''}
        ${client.phone ? `<p style="font-size: 13px; color: #6b7280;">${client.phone}</p>` : ''}
      </div>
      <div style="text-align: right;">
        <div style="margin-bottom: 8px;">
          <p style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af;">Invoice Date</p>
          <p style="font-size: 14px; color: #1f2937;">${formatDate(invoice.invoice_date)}</p>
        </div>
        ${invoice.due_date ? `
        <div>
          <p style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af;">Due Date</p>
          <p style="font-size: 14px; color: #1f2937;">${formatDate(invoice.due_date)}</p>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Items Table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr style="border-bottom: 2px solid #0d9488;">
          <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Date</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Description</th>
          <th style="padding: 10px 12px; text-align: center; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Hrs</th>
          <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Rate</th>
          <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <!-- Totals -->
    <div style="display: flex; justify-content: flex-end; margin-bottom: 32px;">
      <div style="width: 240px;">
        <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px;">
          <span style="color: #6b7280;">Subtotal</span>
          <span style="color: #1f2937; font-weight: 500;">${formatCurrency(invoice.subtotal)}</span>
        </div>
        ${invoice.gst_amount > 0 ? `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; border-bottom: 1px solid #e5e7eb;">
          <span style="color: #6b7280;">GST (${profile.gst_rate || 5}%)</span>
          <span style="color: #1f2937; font-weight: 500;">${formatCurrency(invoice.gst_amount)}</span>
        </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 16px; font-weight: 700;">
          <span style="color: #1f2937;">Total</span>
          <span style="color: #0d9488;">${formatCurrency(invoice.total_amount)}</span>
        </div>
      </div>
    </div>

    <!-- Notes / Payment Instructions -->
    ${invoice.notes || profile.payment_instructions ? `
    <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
      ${invoice.notes ? `
      <div style="margin-bottom: 12px;">
        <p style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 4px;">Notes</p>
        <p style="font-size: 13px; color: #4b5563;">${invoice.notes}</p>
      </div>
      ` : ''}
      ${profile.payment_instructions ? `
      <div>
        <p style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 4px;">Payment Instructions</p>
        <p style="font-size: 13px; color: #4b5563; white-space: pre-line;">${profile.payment_instructions}</p>
      </div>
      ` : ''}
    </div>
    ` : ''}

    <!-- Footer -->
    <div style="margin-top: 48px; text-align: center; font-size: 12px; color: #9ca3af;">
      <p>Thank you for your business.</p>
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

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 250);
  };

  if (iframeDoc.readyState === 'complete') {
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 250);
  }
}
