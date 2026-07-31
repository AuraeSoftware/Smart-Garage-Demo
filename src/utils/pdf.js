// WashPro Invoice PDF — A5 format
// NO emoji in text — jsPDF helvetica does not support unicode emoji
// Layout matches INV-346150 (clean, professional)

import logoImg from '../assets/smart-garage-light/Smart-Garage.png';  // OS2: invoice logo repointed to a valid asset (original invoice PNG was corrupt in the archive)
import { getCurrency } from './messaging';

const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
};

export const generateInvoicePDF = async (invoice) => {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc   = new jsPDF({ unit: 'mm', format: 'a5' });
  const curr  = invoice.currency || getCurrency(invoice.customer?.phone || invoice.customerPhone || invoice.payment?.phone || '');
  const W     = doc.internal.pageSize.getWidth();
  const RED   = [218, 26, 49]; // #da1a31 brand red
  const DARK  = [0, 0, 0];     // black
  const GREY  = [0, 0, 0];     // black
  const BODY  = [0, 0, 0];     // black
  const WHITE = [255, 255, 255];

  // ── HEADER BAR ──────────────────────────────────────────
  doc.setFillColor(...RED);
  doc.rect(0, 0, W, 30, 'F');

  // Load and render logo image, fallback to stylized text
  let logoLoaded = false;
  try {
    const img = await loadImage(logoImg);

    let typoWidth = img.naturalWidth || img.width || 1;
    let typoHeight = img.naturalHeight || img.height || 1;
    const typoAspect = typoWidth / typoHeight;
    
    // Resize image if it's too large to prevent massive PDF sizes
    let finalImg = img;
    const MAX_PIXEL_WIDTH = 800;
    if (typoWidth > MAX_PIXEL_WIDTH) {
      const canvas = document.createElement('canvas');
      canvas.width = MAX_PIXEL_WIDTH;
      canvas.height = MAX_PIXEL_WIDTH / typoAspect;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      finalImg = canvas.toDataURL('image/png');
    }
    
    // Target height of 26mm inside the 30mm header
    let printHeight = 26;
    let printTypoWidth = printHeight * typoAspect;
    let totalWidth = printTypoWidth;
    
    // Cap total width at 100mm to maintain professional proportions
    if (totalWidth > 100) {
      const scale = 100 / totalWidth;
      printHeight = printHeight * scale;
      printTypoWidth = printHeight * typoAspect;
      totalWidth = printTypoWidth;
    }
    
    const startX = (W - totalWidth) / 2;
    const yPos = (30 - printHeight) / 2;

    doc.addImage(finalImg, 'PNG', startX, yPos, printTypoWidth, printHeight, undefined, 'FAST');
    
    logoLoaded = true;
  } catch (err) {
    console.error('Failed to load logo image for PDF:', err);
  }

  if (!logoLoaded) {
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('Smart Garage', W / 2, 13, { align: 'center' });

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Car Wash Management System', W / 2, 21, { align: 'center' });
  }

  doc.setTextColor(...WHITE);
  doc.setFontSize(9);
  doc.text('TAX INVOICE', W - 10, 13, { align: 'right' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.id, W - 10, 22, { align: 'right' });

  // ── META ROWS ───────────────────────────────────────────
  doc.setTextColor(...BODY);
  doc.setFontSize(8.5);
  let y = 35; // Shrunk from 38 to 35

  const metaRows = [
    ['Date',     invoice.date],
    ['Washer',   invoice.washer],
  ];
  const gstData = invoice.payment?.gst || invoice.gst;
  if (gstData?.enabled && gstData?.number) {
    metaRows.push(['GST No.', gstData.number]);
  }
  metaRows.push(
    ['Branch',   invoice.branch || 'Main Branch'],
    ['Location', invoice.locationName
        ? `${invoice.locationName}  (${invoice.location})`
        : (invoice.location || 'N/A')]
  );

  metaRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GREY);
    doc.text(label + ':', 10, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BODY);
    // Wrap long location strings
    const lines = doc.splitTextToSize(String(value), W - 45);
    doc.text(lines, 38, y);
    y += lines.length > 1 ? lines.length * 4.2 + 0.8 : 5; // Shrunk spacing
  });

  // ── DIVIDER ─────────────────────────────────────────────
  doc.setDrawColor(210, 220, 240);
  doc.line(10, y, W - 10, y);
  y += 5; // Shrunk from 7 to 5

  // ── SECTION HEADER helper ────────────────────────────────
  const sectionTitle = (title, yPos) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5); // Shrunk from 9 to 8.5
    doc.setTextColor(...RED);
    doc.text(title, 10, yPos);
  };

  // ── CUSTOMER SECTION ────────────────────────────────────
  if (invoice.customer?.name || invoice.customer?.phone) {
    sectionTitle('CUSTOMER DETAILS', y);
    y += 3; // Shrunk from 4 to 3

    doc.autoTable({
      startY: y,
      head: [],
      body: [
        ['Name',  invoice.customer?.name  || 'Walk-in',
         'Phone', invoice.customer?.phone || 'N/A'],
        ...(invoice.customer?.email
          ? [['Email', invoice.customer.email, '', '']]
          : []),
      ],
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 1.2, textColor: BODY }, // Shrunk padding and font
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 20, textColor: GREY },
        1: { cellWidth: 'auto' },
        2: { fontStyle: 'bold', cellWidth: 18, textColor: GREY },
        3: { cellWidth: 30 },
      },
      margin: { left: 10, right: 10 },
    });
    y = doc.lastAutoTable.finalY + 3.5; // Shrunk from 5 to 3.5

    doc.setDrawColor(230, 235, 245);
    doc.line(10, y - 1.5, W - 10, y - 1.5);
    y += 1.5; // Shrunk from 2 to 1.5
  }

  // ── VEHICLE DETAILS ─────────────────────────────────────
  sectionTitle('VEHICLE DETAILS', y);
  y += 3; // Shrunk from 4 to 3

  doc.autoTable({
    startY: y,
    head: [],
    body: [
      ['Make',   invoice.vehicle?.make   || '—',
       'Model',  invoice.vehicle?.model  || '—'],
      ['Colour', invoice.vehicle?.colour || '—',
       'Plate',  invoice.vehicle?.plate  || '—'],
    ],
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: 1.4, textColor: BODY }, // Shrunk padding and font
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 20, textColor: GREY },
      1: { cellWidth: 'auto' },
      2: { fontStyle: 'bold', cellWidth: 18, textColor: GREY },
      3: { cellWidth: 30 },
    },
    margin: { left: 10, right: 10 },
  });
  y = doc.lastAutoTable.finalY + 3.5; // Shrunk from 5 to 3.5

  // ── SERVICE ─────────────────────────────────────────────
  sectionTitle('SERVICE', y);
  y += 3; // Shrunk from 4 to 3

  doc.autoTable({
    startY: y,
    head: [['Package', 'Description', 'Duration', 'Amount']],
    body: [[
      invoice.package?.name || '—',
      invoice.package?.desc || '—',
      invoice.package?.time || '—',
      `${curr} ${invoice.package?.price || invoice.originalTotal || invoice.total}`,
    ]],
    theme: 'striped',
    headStyles: { fillColor: DARK, textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 1.8, textColor: BODY }, // Shrunk padding and font
    margin: { left: 10, right: 10 },
  });
  y = doc.lastAutoTable.finalY + 3.5; // Shrunk from 5 to 3.5

  // ── RETAIL PRODUCTS ───────────────────────────────────
  const retailProducts = invoice.products?.filter(p => p.isIncluded) || [];
  if (retailProducts.length > 0) {
    sectionTitle('RETAIL PRODUCTS', y);
    y += 3;

    doc.autoTable({
      startY: y,
      head: [['Product Name', 'Quantity', 'Price']],
      body: retailProducts.map(p => {
        const displayQty = p.quantity || 1;
        const totalAmount = (Number(p.price) || 0) * displayQty;
        return [
          p.name || '—',
          displayQty,
          `Included`
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: DARK, textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 1.8, textColor: BODY },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 24, halign: 'center' },
        2: { cellWidth: 36, halign: 'right' }
      },
      margin: { left: 10, right: 10 },
    });
    y = doc.lastAutoTable.finalY + 3.5;
  }

  // ── ADDON PRODUCTS ───────────────────────────────────
  const addonProducts = invoice.products?.filter(p => !p.isIncluded) || [];
  if (addonProducts.length > 0) {
    sectionTitle('ADDON PRODUCTS', y);
    y += 3;

    doc.autoTable({
      startY: y,
      head: [['Product Name', 'Quantity', 'Price']],
      body: addonProducts.map(p => {
        const displayQty = p.quantity || 1;
        const totalAmount = (Number(p.price) || 0) * displayQty;
        return [
          p.name || '—',
          displayQty,
          `${curr} ${totalAmount}`
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: DARK, textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 1.8, textColor: BODY },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 24, halign: 'center' },
        2: { cellWidth: 36, halign: 'right' }
      },
      margin: { left: 10, right: 10 },
    });
    y = doc.lastAutoTable.finalY + 3.5;
  }

  // ── PAYMENT ─────────────────────────────────────────────
  sectionTitle('PAYMENT', y);
  y += 3; // Shrunk from 4 to 3

  const payBody = [
    ['Method',    invoice.payment?.mode || '—'],
  ];
  // Bank transfer extra fields
  if (invoice.payment?.mode === 'Online Transfer') {
    if (invoice.payment?.bankHolder) payBody.push(['Acct Holder', invoice.payment.bankHolder]);
    if (invoice.payment?.bankName)   payBody.push(['Bank',        invoice.payment.bankName]);
    if (invoice.payment?.ifscCode)   payBody.push(['IFSC/SWIFT',  invoice.payment.ifscCode]);
  }
  payBody.push(['Reference', invoice.payment?.ref || '—']);
  if (invoice.coupon?.applied) {
    payBody.push(['Coupon Code',  invoice.coupon.code]);
    payBody.push(['Discount',     `-${curr} ${invoice.coupon.discountAmount}`]);
  }
  
  const actualGst = invoice.gst || invoice.payment?.gst;
  const actualSubTotal = invoice.subTotal || invoice.payment?.subTotal || (invoice.total - (actualGst?.amount || 0));

  if (actualGst?.enabled) {
    payBody.push(['Subtotal', `${curr} ${actualSubTotal.toFixed(2)}`]);
    payBody.push([`GST (${actualGst.percentage}%)`, `${curr} ${actualGst.amount.toFixed(2)}`]);
  }

  payBody.push(['Total Paid', `${curr} ${Number(invoice.total).toFixed(2)}`]);

  doc.autoTable({
    startY: y,
    head: [],
    body: payBody,
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: 1.4, textColor: BODY }, // Shrunk padding and font
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35, textColor: GREY },
      1: { fontStyle: 'bold' },
    },
    margin: { left: 10, right: 10 },
  });
  y = doc.lastAutoTable.finalY + 3.5; // Shrunk from 5 to 3.5

  // ── LOYALTY BADGE (if coupon applied) ──────────────────
  if (invoice.coupon?.applied) {
    doc.setFillColor(34, 197, 94);
    doc.roundedRect(10, y, W - 20, 7, 1.5, 1.5, 'F'); // Shrunk from 9 to 7
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8); // Shrunk from 8.5 to 8
    doc.text(
      `LOYALTY DISCOUNT APPLIED: -${curr} ${invoice.coupon.discountAmount}  |  ${invoice.coupon.code}`,
      W / 2, y + 4.8, { align: 'center' }
    );
    y += 10; // Shrunk from 13 to 10
  }

  // ── TOTAL BANNER ────────────────────────────────────────
  doc.setFillColor(...RED);
  doc.roundedRect(10, y, W - 20, 11, 2, 2, 'F'); // Shrunk from 14 to 11
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12); // Shrunk from 13 to 12
  doc.text('TOTAL AMOUNT', 15, y + 7.2);
  doc.text(`${curr} ${Number(invoice.total).toFixed(2)}`, W - 15, y + 7.2, { align: 'right' });
  y += 15; // Shrunk from 19 to 15

  // ── STATUS BADGE (completed) ────────────────────────────
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(10, y, W - 20, 7, 1.5, 1.5, 'F'); // Shrunk from 9 to 7
  doc.setTextColor(22, 163, 74);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8); // Shrunk from 8.5 to 8
  doc.text('COMPLETED   PAID', W / 2, y + 4.8, { align: 'center' });
  y += 11; // Shrunk from 14 to 11

  // ── FOOTER ───────────────────────────────────────────────
  doc.setTextColor(160, 170, 190);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    'Thank you for choosing Smart Garage! This is a computer-generated invoice.',
    W / 2, y, { align: 'center' }
  );

  doc.save(`${invoice.id}.pdf`);
};
