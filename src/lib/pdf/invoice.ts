// lib/pdf/invoice.ts
// Generates a printable PDF invoice
// Uses @react-pdf/renderer or jsPDF — install whichever is in package.json
// This implementation uses HTML → PDF via puppeteer-free approach with jsPDF

export interface InvoicePDFData {
  shop:    { name: string; dba?: string; phone?: string; email?: string; address?: string; city?: string; state?: string; zip?: string }
  customer:{ company_name: string; contact_name?: string; phone?: string; email?: string; address?: string }
  invoice: { invoice_number: string; due_date?: string; subtotal: number; tax_amount: number; total: number; balance_due: number; amount_paid: number; notes?: string }
  serviceOrder: { so_number: string; complaint?: string; cause?: string; correction?: string; truck_unit?: string; truck_year?: number; truck_make?: string; truck_model?: string; odometer?: number; technician_name?: string }
  lines:   { line_type: string; description: string; part_number?: string; quantity: number; unit_price: number; total_price: number }[]
  paymentUrl?: string
  qrCodeUrl?:  string
}

// Generate invoice as HTML string (for browser printing or PDF conversion)
export function generateInvoiceHTML(data: InvoicePDFData): string {
  const shopName    = data.shop.dba || data.shop.name
  const laborLines  = data.lines.filter(l => l.line_type === 'labor')
  const partLines   = data.lines.filter(l => l.line_type === 'part')
  const otherLines  = data.lines.filter(l => !['labor','part'].includes(l.line_type))
  const isPaid      = data.invoice.balance_due <= 0

  const lineRows = (lines: typeof data.lines, color: string) => lines.map(l => `
    <tr>
      <td style="padding:6px 8px;font-size:11px;color:#2A2A2A;border-bottom:1px solid #F5F5F7">${l.description}${l.part_number ? `<div style="font-size:9px;color:#888;font-family:monospace">${l.part_number}</div>` : ''}</td>
      <td style="padding:6px 8px;text-align:center;font-family:monospace;font-size:11px;color:#555;border-bottom:1px solid #F5F5F7">${l.quantity}</td>
      <td style="padding:6px 8px;text-align:right;font-family:monospace;font-size:11px;color:#555;border-bottom:1px solid #F5F5F7">$${l.unit_price.toFixed(2)}</td>
      <td style="padding:6px 8px;text-align:right;font-family:monospace;font-size:11px;font-weight:700;color:${color};border-bottom:1px solid #F5F5F7">$${l.total_price.toFixed(2)}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Invoice ${data.invoice.invoice_number} — ${shopName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { font-family:'Helvetica Neue',Arial,sans-serif; background:#fff; color:#2A2A2A; font-size:12px; }
  @media print {
    body { print-color-adjust:exact; -webkit-print-color-adjust:exact }
    .no-print { display:none }
  }
</style>
</head>
<body style="max-width:800px;margin:0 auto;padding:32px">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #0A84FF">
    <div>
      <div style="font-size:24px;font-weight:800;letter-spacing:.5px;color:#2A2A2A">${shopName.toUpperCase()}</div>
      <div style="font-size:11px;color:#666;margin-top:3px">${data.shop.address || ''} ${data.shop.city || ''}, ${data.shop.state || ''} ${data.shop.zip || ''}</div>
      <div style="font-size:11px;color:#666">${data.shop.phone || ''}</div>
      <div style="font-size:11px;color:#666">${data.shop.email || ''}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:28px;font-weight:800;color:${isPaid ? '#0A84FF' : '#0A84FF'}">${isPaid ? 'PAID' : 'INVOICE'}</div>
      <div style="font-family:monospace;font-size:14px;font-weight:700;color:#2A2A2A;margin-top:4px">${data.invoice.invoice_number}</div>
      ${data.invoice.due_date ? `<div style="font-size:11px;color:#888;margin-top:2px">Due: ${data.invoice.due_date}</div>` : ''}
    </div>
  </div>

  <!-- Bill To + Vehicle -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:24px">
    <div>
      <div style="font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:#888;margin-bottom:6px">Bill To</div>
      <div style="font-weight:700;font-size:13px">${data.customer.company_name}</div>
      ${data.customer.contact_name ? `<div style="color:#555;font-size:11px">${data.customer.contact_name}</div>` : ''}
      ${data.customer.phone       ? `<div style="color:#555;font-size:11px">${data.customer.phone}</div>` : ''}
      ${data.customer.email       ? `<div style="color:#555;font-size:11px">${data.customer.email}</div>` : ''}
    </div>
    <div>
      <div style="font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:#888;margin-bottom:6px">Vehicle</div>
      <div style="font-weight:700;font-size:13px">Unit #${data.serviceOrder.truck_unit || '—'}</div>
      <div style="color:#555;font-size:11px">${data.serviceOrder.truck_year || ''} ${data.serviceOrder.truck_make || ''} ${data.serviceOrder.truck_model || ''}</div>
      ${data.serviceOrder.odometer ? `<div style="color:#888;font-size:11px;font-family:monospace">${data.serviceOrder.odometer.toLocaleString()} mi in</div>` : ''}
    </div>
    <div>
      <div style="font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:#888;margin-bottom:6px">Service Order</div>
      <div style="font-weight:700;font-family:monospace;font-size:13px">${data.serviceOrder.so_number}</div>
      ${data.serviceOrder.technician_name ? `<div style="color:#555;font-size:11px">Tech: ${data.serviceOrder.technician_name}</div>` : ''}
    </div>
  </div>

  <!-- Work Performed -->
  ${data.serviceOrder.cause ? `
  <div style="background:#F5F5F7;border-left:3px solid #0A84FF;padding:10px 14px;margin-bottom:20px;border-radius:0 6px 6px 0">
    <div style="font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:#888;margin-bottom:5px">Work Performed</div>
    <div style="font-size:11px;color:#333;line-height:1.5"><strong>Cause:</strong> ${data.serviceOrder.cause}</div>
    ${data.serviceOrder.correction ? `<div style="font-size:11px;color:#333;line-height:1.5;margin-top:4px"><strong>Correction:</strong> ${data.serviceOrder.correction}</div>` : ''}
  </div>` : ''}

  <!-- Line Items -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    <thead>
      <tr style="background:#2A2A2A">
        <th style="padding:8px;text-align:left;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#fff;font-weight:600">Description</th>
        <th style="padding:8px;text-align:center;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#fff;font-weight:600;width:60px">Qty</th>
        <th style="padding:8px;text-align:right;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#fff;font-weight:600;width:80px">Rate</th>
        <th style="padding:8px;text-align:right;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#fff;font-weight:600;width:90px">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${laborLines.length ? `<tr><td colspan="4" style="padding:5px 8px;font-size:9px;letter-spacing:1px;text-transform:uppercase;background:#F5F5F7;color:#0A84FF;font-weight:700">Labor</td></tr>${lineRows(laborLines,'#0A84FF')}` : ''}
      ${partLines.length  ? `<tr><td colspan="4" style="padding:5px 8px;font-size:9px;letter-spacing:1px;text-transform:uppercase;background:#F5F5F7;color:#0A84FF;font-weight:700">Parts</td></tr>${lineRows(partLines,'#0A84FF')}` : ''}
      ${otherLines.length ? `<tr><td colspan="4" style="padding:5px 8px;font-size:9px;letter-spacing:1px;text-transform:uppercase;background:#F5F5F7;color:#FFD60A;font-weight:700">Other</td></tr>${lineRows(otherLines,'#FFD60A')}` : ''}
    </tbody>
  </table>

  <!-- Totals -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:24px">
    <div style="min-width:240px">
      ${[
        { label:'Subtotal',    val:`$${data.invoice.subtotal.toFixed(2)}`,     bold:false },
        { label:'Tax',         val:`$${data.invoice.tax_amount.toFixed(2)}`,   bold:false },
        ...(data.invoice.amount_paid > 0 ? [{ label:'Amount Paid', val:`-$${data.invoice.amount_paid.toFixed(2)}`, bold:false }] : []),
        { label:'Balance Due', val:`$${data.invoice.balance_due.toFixed(2)}`,  bold:true  },
      ].map(r => `
        <div style="display:flex;justify-content:space-between;padding:5px 0;${r.bold ? 'border-top:2px solid #2A2A2A;margin-top:4px' : 'border-bottom:1px solid #F5F5F7'}">
          <span style="font-size:${r.bold?'14':'11'}px;${r.bold?'font-weight:800':'color:#555'}">${r.label}</span>
          <span style="font-family:monospace;font-size:${r.bold?'18':'11'}px;font-weight:${r.bold?800:400};color:${r.bold?(isPaid?'#0A84FF':'#0A84FF'):'#333'}">${r.val}</span>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- QR Payment -->
  ${data.paymentUrl && !isPaid ? `
  <div style="display:flex;align-items:center;gap:20px;background:#F5F5F7;border:2px solid #0A84FF;border-radius:10px;padding:16px;margin-bottom:24px">
    ${data.qrCodeUrl ? `<img src="${data.qrCodeUrl}" width="80" height="80" style="border-radius:6px"/>` : ''}
    <div>
      <div style="font-weight:700;font-size:13px;color:#0A84FF">Pay Online</div>
      <div style="font-size:11px;color:#555;margin-top:3px">Scan QR code or visit:</div>
      <div style="font-family:monospace;font-size:10px;color:#0A84FF;word-break:break-all">${data.paymentUrl}</div>
    </div>
  </div>` : ''}

  ${data.invoice.notes ? `<div style="font-size:11px;color:#666;border-top:1px solid #eee;padding-top:12px"><strong>Notes:</strong> ${data.invoice.notes}</div>` : ''}

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;text-align:center;font-size:10px;color:#aaa">
    Thank you for your business · ${shopName} · ${data.shop.phone || ''} · ${data.shop.email || ''}
  </div>

  <!-- Print button (hidden when printing) -->
  <div class="no-print" style="margin-top:24px;text-align:center">
    <button onclick="window.print()" style="padding:10px 24px;background:#0A84FF;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">Print / Save as PDF</button>
  </div>

</body>
</html>`
}

// Server-side: generate and return as Response for /api/invoices/[id]/pdf
export async function serveInvoicePDF(html: string): Promise<Response> {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'inline',
    },
  })
}
