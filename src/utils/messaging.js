// ================================================================
// WashPro — Messaging & OTP utilities
// WhatsApp message layout mirrors the PDF receipt structure
// ================================================================

// ── WhatsApp Invoice Message ─────────────────────────────────────
// Structure mirrors the PDF: meta → customer → vehicle → service → payment → total
export const buildWhatsAppMessage = (invoice) => {
  const D = '━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const d = '──────────────────────────';
  const curr = invoice.currency || getCurrency(invoice.customer?.phone || invoice.customerPhone || invoice.payment?.phone || '');

  const locationLine = invoice.locationName
    ? `${invoice.locationName}  (${invoice.location})`
    : (invoice.location || 'N/A');

  const lines = [
    `*Smart Garage TAX INVOICE*`,
    D,
    `Invoice No : *${invoice.id}*`,
    `Date       : ${invoice.date}`,
    `Branch     : ${invoice.branch || 'Main Branch'}`,
    `Washer     : ${invoice.washer}`,
    `Location   : ${locationLine}`,
    ``,
    `${d}`,
    `*CUSTOMER DETAILS*`,
    `Name       : ${invoice.customer?.name  || 'Walk-in'}`,
    `Phone      : ${invoice.customer?.phone || 'N/A'}`,
    ...(invoice.customer?.email ? [`Email      : ${invoice.customer.email}`] : []),
    ``,
    `${d}`,
    `*VEHICLE DETAILS*`,
    `Make       : ${invoice.vehicle?.make   || '—'}`,
    `Model      : ${invoice.vehicle?.model  || '—'}`,
    `Colour     : ${invoice.vehicle?.colour || '—'}`,
    `Plate      : *${invoice.vehicle?.plate || 'N/A'}*`,
    ``,
    `${d}`,
    `*SERVICE*`,
    `Package    : ${invoice.package?.name || '—'}`,
    `Details    : ${invoice.package?.desc || '—'}`,
    `Duration   : ${invoice.package?.time || '—'}`,
    ...(invoice.products && invoice.products.length > 0
      ? [
          ``,
          `${d}`,
          `*ADDON PRODUCTS*`,
          ...invoice.products.map(p => `• ${p.name} (Qty: ${p.quantity} · Price: ${curr} ${p.price || 0})`)
        ]
      : []),
    ``,
    `${d}`,
    `*PAYMENT*`,
    `Method     : ${invoice.payment?.mode || '—'}`,
    ...(invoice.payment?.mode === 'Online Transfer' && invoice.payment?.bankHolder
      ? [`Acct Holder: ${invoice.payment.bankHolder}`] : []),
    ...(invoice.payment?.mode === 'Online Transfer' && invoice.payment?.bankName
      ? [`Bank       : ${invoice.payment.bankName}`] : []),
    ...(invoice.payment?.mode === 'Online Transfer' && invoice.payment?.ifscCode
      ? [`IFSC/SWIFT : ${invoice.payment.ifscCode}`] : []),
    ...(invoice.payment?.ref && invoice.payment.ref !== 'CASH'
      ? [`Reference  : ${invoice.payment.ref}`]
      : []),
    ...(invoice.coupon?.applied
      ? [
          `Coupon     : ${invoice.coupon.code}`,
          `Discount   : -${curr} ${invoice.coupon.discountAmount}`,
          `Original   : ${curr} ${invoice.originalTotal}`,
        ]
      : []),
    ``,
    D,
    `*TOTAL AMOUNT : ${curr} ${invoice.total}*`,
    D,
    ``,
    `[ COMPLETED  |  PAID ]`,
    ``,
    `Thank you for choosing Smart Garage!`,
    `_This is a computer-generated invoice._`,
  ];

  return lines.join('\n');
};

// ── Currency Symbol Helper ────────────────────────────────────────
export const getCurrency = (phone) => {
  if (!phone) return 'RM';
  const p = String(phone).replace(/\s|-/g, '');
  if (p.startsWith('+91') || p.startsWith('91')) return 'INR';
  if (p.startsWith('+65') || p.startsWith('65')) return 'SGD';
  if (p.startsWith('+62') || p.startsWith('62')) return 'Rp';
  if (p.startsWith('+1') || (p.startsWith('1') && p.length > 10)) return '$';
  return 'RM';
};

// ── Phone normalizer (MY & IN) ────────────────────────────────────
export const normalizePhone = (phone, country = 'MY') => {
  if (!phone) return '';
  const phoneStr = String(phone);
  if (phoneStr.startsWith('+')) {
    return `+${phoneStr.replace(/\D/g, '')}`;
  }
  const digits = phoneStr.replace(/\D/g, '');
  if (country === 'MY') {
    if (digits.startsWith('60'))  return `+${digits}`;
    if (digits.startsWith('0'))   return `+6${digits}`;
    return `+60${digits}`;
  }
  if (country === 'IN') {
    if (digits.startsWith('91'))  return `+${digits}`;
    if (digits.startsWith('0'))   return `+91${digits.slice(1)}`;
    return `+91${digits}`;
  }
  return `+${digits}`;
};

// ── Mask phone for display ────────────────────────────────────────
export const maskPhone = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\s|-/g, '');
  if (cleaned.length < 6) return phone;
  const prefix = cleaned.slice(0, 3);
  const suffix = cleaned.slice(-4);
  const masked = '*'.repeat(Math.max(0, cleaned.length - 7));
  return `${prefix}-${masked}-${suffix}`;
};

// ── Open WhatsApp ─────────────────────────────────────────────────
export const openWhatsApp = (phone, invoice) => {
  const msg = buildWhatsAppMessage(invoice);
  if (phone) {
    const num = normalizePhone(phone).replace('+', '');
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }
};

// ── Browser Push Notification ─────────────────────────────────────
export const requestPushPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
};

export const sendPushNotification = (title, body, icon = '/favicon.ico') => {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon });
  }
};

// ================================================================
// OTP SERVICE LAYER
// Currently DEMO mode — OTP logged to console, shown on screen.
//
// To enable real SMS:
//
// MALAYSIA:
//   Twilio:   POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages
//   Vonage:   POST https://rest.nexmo.com/sms/json
//
// INDIA:
//   MSG91:    POST https://api.msg91.com/api/v5/otp
//   Fast2SMS: POST https://www.fast2sms.com/dev/bulkV2
//   2Factor:  GET  https://2factor.in/API/V1/{key}/SMS/{phone}/{otp}
//
// IMPORTANT: Never call SMS APIs from the browser directly.
// Create a backend endpoint: POST /api/send-otp  { phone, otp }
// ================================================================
export const OTP_SERVICE = {
  generate: () => Math.floor(100000 + Math.random() * 900000).toString(),

  send: async (phone, otp) => {
    // TODO: replace with real backend call
    // const res = await fetch('/api/send-otp', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ phone: normalizePhone(phone), otp }),
    // });
    // return res.ok;
    console.log(`[DEMO OTP] Phone: ${phone}  OTP: ${otp}`);
    return true;
  },

  verify: (input, expected) => String(input).trim() === String(expected).trim(),
};
