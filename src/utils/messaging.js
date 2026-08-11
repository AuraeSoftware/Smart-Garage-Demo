// ================================================================
// WashPro — Messaging & OTP utilities
// WhatsApp message layout mirrors the PDF receipt structure
// ================================================================

import { API } from './api';

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
export const CC_TO_CURRENCY = {
  '1': 'USD', '7': 'RUB', '20': 'EGP', '27': 'ZAR', '30': 'EUR', '31': 'EUR', '32': 'EUR', '33': 'EUR',
  '34': 'EUR', '36': 'HUF', '39': 'EUR', '40': 'RON', '41': 'CHF', '43': 'EUR', '44': 'GBP', '45': 'DKK',
  '46': 'SEK', '47': 'NOK', '48': 'PLN', '49': 'EUR', '51': 'PEN', '52': 'MXN', '53': 'CUP', '54': 'ARS',
  '55': 'BRL', '56': 'CLP', '57': 'COP', '58': 'VES', '60': 'RM', '61': 'AUD', '62': 'Rp', '63': 'PHP',
  '64': 'NZD', '65': 'SGD', '66': 'THB', '81': 'JPY', '82': 'KRW', '84': 'VND', '86': 'CNY', '90': 'TRY',
  '91': 'INR', '92': 'PKR', '93': 'AFN', '94': 'LKR', '95': 'MMK', '98': 'IRR', '212': 'MAD', '213': 'DZD',
  '216': 'TND', '218': 'LYD', '220': 'GMD', '221': 'XOF', '234': 'NGN', '254': 'KES', '255': 'TZS', '256': 'UGX',
  '351': 'EUR', '353': 'EUR', '358': 'EUR', '380': 'UAH', '673': 'BND', '852': 'HKD', '853': 'MOP', '880': 'BDT',
  '886': 'TWD', '966': 'SAR', '971': 'AED', '972': 'ILS', '973': 'BHD', '974': 'QAR', '977': 'NPR',
};

export const getCurrency = (phone) => {
  if (!phone) return 'RM';
  const p = String(phone).replace(/\s|-|\+/g, '');
  
  const codes = Object.keys(CC_TO_CURRENCY).sort((a, b) => b.length - a.length);
  for (let c of codes) {
    if (p.startsWith(c)) {
      if (CC_TO_CURRENCY[c] === 'USD') return '$';
      return CC_TO_CURRENCY[c];
    }
  }
  return 'RM';
};

// ── Currency Conversion ───────────────────────────────────────────

export let EXCHANGE_RATES = {
  'RM': 1, 'INR': 18.5, 'SGD': 0.28, 'Rp': 3450, '$': 0.21,
  'EUR': 0.20, 'GBP': 0.17, 'AUD': 0.33, 'RUB': 19.33, 'EGP': 10.15,
  'ZAR': 3.93, 'HUF': 77.58, 'RON': 0.99, 'CHF': 0.19, 'DKK': 1.49,
  'SEK': 2.21, 'NOK': 2.23, 'PLN': 0.86, 'PEN': 0.79, 'MXN': 3.53,
  'CUP': 5.04, 'ARS': 182.16, 'BRL': 1.07, 'CLP': 200.74, 'COP': 847.61,
  'VES': 7.63, 'PHP': 12.01, 'NZD': 0.35, 'THB': 7.64, 'JPY': 31.85,
  'KRW': 288.75, 'VND': 5326.68, 'CNY': 1.52, 'TRY': 6.84, 'PKR': 58.74,
  'AFN': 15.01, 'LKR': 64.38, 'MMK': 441.74, 'IRR': 8847.54, 'MAD': 2.12,
  'DZD': 28.32, 'TND': 0.66, 'LYD': 1.02, 'GMD': 14.28, 'XOF': 131.06,
  'NGN': 301.76, 'KES': 27.42, 'TZS': 546.90, 'UGX': 792.83, 'UAH': 8.16,
  'BND': 0.28, 'HKD': 1.65, 'MOP': 1.70, 'BDT': 23.01, 'TWD': 6.85,
  'SAR': 0.79, 'AED': 0.77, 'ILS': 0.79, 'BHD': 0.08, 'QAR': 0.77, 'NPR': 28.16,
};

export let PLAN_OVERRIDES = {};

export const syncCurrencyRates = async () => {
  try {
    const data = await API.settings.getCurrencyRates();
    if (data) {
      if (data.rates) {
        EXCHANGE_RATES = { ...EXCHANGE_RATES, ...data.rates };
        if (data.overrides) PLAN_OVERRIDES = data.overrides;
      } else if (Object.keys(data).length > 0) {
        EXCHANGE_RATES = { ...EXCHANGE_RATES, ...data };
      }
    }
  } catch (err) {
    console.error("Failed to sync currency rates:", err);
  }
};

export const getConvertedPrice = (basePrice, targetCurrency, planId = null, priceType = null) => {
  if (planId && PLAN_OVERRIDES[targetCurrency] && PLAN_OVERRIDES[targetCurrency][planId]) {
    const planOverrides = PLAN_OVERRIDES[targetCurrency][planId];
    if (priceType && planOverrides[priceType] !== undefined && planOverrides[priceType] !== '' && planOverrides[priceType] !== null) {
      return Number(planOverrides[priceType]);
    }
    // Fallback: If monthly_price is requested but not overridden, check if base price is overridden
    if (priceType === 'monthly_price' && planOverrides['price'] !== undefined && planOverrides['price'] !== '' && planOverrides['price'] !== null) {
      return Number(planOverrides['price']);
    }
  }

  const baseAmount = typeof basePrice === 'number' ? basePrice : parseFloat(String(basePrice || '0').replace(/[^0-9.]/g, ''));
  if (isNaN(baseAmount)) return 0;
  
  const rate = EXCHANGE_RATES[targetCurrency] || 1;
  const converted = baseAmount * rate;
  
  if (targetCurrency === 'Rp' || targetCurrency === 'INR') {
    return Math.round(converted);
  }
  return Number(converted.toFixed(2));
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
