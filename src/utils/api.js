/**
 * WashPro API Client
 * All HTTP calls to the FastAPI backend go through here.
 * Base URL is set via REACT_APP_API_URL environment variable.
 * Falls back to localhost:8000 for local development.
 */

// REST API
export const BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/$/, '');


const TOKEN_KEY = 'washpro:token';

// ── Token management ──────────────────────────────────────
export const token = {
  get: () => localStorage.getItem(TOKEN_KEY) || '',
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// ── Base fetch wrapper ────────────────────────────────────
async function req(method, path, body = null) {
  const headers = {};
  const t = token.get();
  if (t) headers['Authorization'] = `Bearer ${t}`;

  const opts = { method, headers };

  if (body !== null) {
    if (body instanceof FormData || (body && typeof body.append === 'function')) {
      opts.body = body;
    } else {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, opts);

  // Token expired or invalid → clear and reload to login screen
  // Do not reload if the 401 came from a login or signup attempt
  if (res.status === 401) {
    const isAuthRoute = path.includes('/login') || path.includes('/signup');
    if (!isAuthRoute) {
      token.clear();
      window.location.reload();
      return null;
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }

  return res.json();
}

const get = (path) => req('GET', path);
const post = (path, body) => req('POST', path, body);
const put = (path, body) => req('PUT', path, body);
const del = (path) => req('DELETE', path);

// ════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════
export const API = {

  auth: {
    login: (username, password) => post('/api/auth/login', { username, password }),
    me: () => get('/api/auth/me'),
    forgotPassword: (contact) => post('/api/auth/forgot-password', { contact }),
    resetPassword: (contact, code, new_password) => post('/api/auth/reset-password', { contact, code, new_password }),
  },

  // ════════════════════════════════════════════════════════
  // USERS
  // ════════════════════════════════════════════════════════
  users: {
    list: () => get('/api/users'),
    create: (data) => post('/api/users', data),
    update: (id, data) => put(`/api/users/${id}`, data),
    delete: (id) => del(`/api/users/${id}`),
  },

  // ════════════════════════════════════════════════════════
  // BRANCHES
  // ════════════════════════════════════════════════════════
  branches: {
    list: () => get('/api/branches'),
    create: (data) => post('/api/branches', data),
    update: (id, data) => put(`/api/branches/${id}`, data),
    delete: (id) => del(`/api/branches/${id}`),
  },

  // ════════════════════════════════════════════════════════
  // PACKAGES
  // ════════════════════════════════════════════════════════
  packages: {
    list: () => get('/api/packages'),
    create: (data) => post('/api/packages', data),
    update: (id, data) => put(`/api/packages/${id}`, data),
    delete: (id) => del(`/api/packages/${id}`),
  },

  // ════════════════════════════════════════════════════════
  // SUBSCRIPTION PLANS
  // ════════════════════════════════════════════════════════
  subscriptions: {
    list: () => get('/api/subscriptions'),
    create: (data) => post('/api/subscriptions', data),
    update: (id, data) => put(`/api/subscriptions/${id}`, data),
    delete: (id) => del(`/api/subscriptions/${id}`),
    upgradePlan: (data) => post('/api/subscriptions/upgrade', data),
    history: (all = false) => get(`/api/subscriptions/history${all ? '?all=true' : ''}`),
  },

  // ════════════════════════════════════════════════════════
  // PRODUCTS
  // ════════════════════════════════════════════════════════
  products: {
    list: () => get('/api/products'),
    create: (data) => post('/api/products', data),
    update: (id, data) => put(`/api/products/${id}`, data),
    delete: (id) => del(`/api/products/${id}`),
  },

  // ════════════════════════════════════════════════════════
  // INVENTORY
  // ════════════════════════════════════════════════════════
  inventory: {
    list: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v))
      ).toString();
      return get(`/api/inventory/${qs ? '?' + qs : ''}`);
    },
    get: (id) => get(`/api/inventory/${id}`),
    create: (data) => post('/api/inventory/', data),
    update: (id, data) => put(`/api/inventory/${id}`, data),
    delete: (id) => del(`/api/inventory/${id}`),
    restock: (id, data) => post(`/api/inventory/${id}/restock`, data),
    use: (id, data) => post(`/api/inventory/${id}/use`, data),
    history: (id) => get(`/api/inventory/${id}/history`),
  },

  // ════════════════════════════════════════════════════════
  // SESSIONS (invoices)
  // ════════════════════════════════════════════════════════
  sessions: {
    list: () => get('/api/sessions'),
    create: (data) => post('/api/sessions', data),
  },

  // ════════════════════════════════════════════════════════
  // PENDING JOBS
  // ════════════════════════════════════════════════════════
  pendingJobs: {
    list: () => get('/api/pending-jobs'),
    create: (data) => post('/api/pending-jobs', data),
    update: (id, data) => put(`/api/pending-jobs/${id}`, data),
    delete: (id) => del(`/api/pending-jobs/${id}`),
  },

  // ════════════════════════════════════════════════════════
  // JOB REQUESTS (QR)
  // ════════════════════════════════════════════════════════
  jobRequests: {
    list: () => get('/api/admin/job-requests'),
    assign: (id, data) => put(`/api/admin/job-requests/${id}/assign`, data),
    createPublic: (data) => post('/api/public/job-request', data),
    trackPublic: (trackingId) => get(`/api/public/track-job/${trackingId}`),
    getAvailable: () => get('/api/washer/available-job-requests'),
    take: (id) => post(`/api/washer/job-requests/${id}/take`),
  },

  vision: {
    analyzeCar: (formData) => post('/api/vision/analyze-car', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
    analyzeSSM: (formData) => post('/api/vision/analyze-ssm', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  // ════════════════════════════════════════════════════════
  // CUSTOMERS
  // ════════════════════════════════════════════════════════
  customers: {
    list: () => get('/api/customers'),
    update: (id, data) => put(`/api/customers/${id}`, data),
  },

  // ════════════════════════════════════════════════════════
  // LOYALTY
  // ════════════════════════════════════════════════════════
  loyalty: {
    check: (phone) => post('/api/loyalty/check', { phone }),
    recordUsage: (phone, couponCode) => post('/api/loyalty/coupon-usage', { phone, coupon_code: couponCode }),
    getConfig: () => get('/api/settings/loyalty'),
    setConfig: (data) => put('/api/settings/loyalty', data),
  },

  // ════════════════════════════════════════════════════════
  // SETTINGS
  // ════════════════════════════════════════════════════════
  auth2: {
    signupSuperAdmin: (d) => post('/api/auth/signup/branch-admin', d),
    validateSignupSuperAdmin: (d) => post('/api/auth/validate-signup/branch-admin', d),
    signupIndividual: (d) => post('/api/auth/signup/individual', d),
    checkStatus: (trackingId) => get(`/api/auth/check-status/${trackingId}`),
  },
  individual: {
    dashboard: () => get('/api/individual/dashboard'),
  },
  admin: {
    pendingApprovals: () => get('/api/admin/pending-approvals'),
    approve: (id) => put(`/api/admin/approve/${id}`, {}),
    reject: (id) => put(`/api/admin/reject/${id}`, {}),
  },
  settings: {

    getBankDetails: () => get('/api/settings/bank'),
    getSupremeBankDetails: () => get('/api/settings/supreme-bank'),
    setBankDetails: (data) => put('/api/settings/bank', data),
    getRazorpay: () => get('/api/settings/razorpay'),
    setRazorpay: (data) => put('/api/settings/razorpay', data),
    getSupremeRazorpay: () => get('/api/settings/supreme-razorpay'),
    setSupremeRazorpay: (data) => put('/api/settings/supreme-razorpay', data),
    getGst: () => get('/api/settings/gst'),
    setGst: (data) => put('/api/settings/gst', data),
    getQR: () => get('/api/settings/qr'),
    setQR: (data) => put('/api/settings/qr', data),
    getSupremeQR: () => get('/api/settings/supreme-qr'),
    setSupremeQR: (data) => put('/api/settings/supreme-qr', data),
  },
  payment: {
    getRazorpayKey: (for_subscription = false) => post('/api/payment/razorpay-key', { for_subscription }),
    createRazorpayOrder: (amount, for_subscription = false, currency = 'MYR') => post('/api/payment/create-order', { amount, for_subscription, currency }),
    verifyRazorpayPayment: (data) => post('/api/payment/verify-payment', data),
    createSubscriptionQr: (plan_id, amount, currency='MYR') => post(`/api/payment/razorpay/create_qr?amount=${amount}&reference_id=${plan_id}&payment_type=subscription&currency=${currency}`),
    createSubscriptionOrder: (plan_id, amount, currency='MYR') => post(`/api/payment/razorpay/create_order?amount=${amount}&reference_id=${plan_id}&payment_type=subscription&currency=${currency}`),
    createInvoiceQr: (job_id, amount, branch_id, currency = 'MYR') => post('/api/payment/razorpay/create_qr?amount=' + amount + '&reference_id=' + job_id + '&payment_type=invoice&branch_id=' + branch_id + '&currency=' + currency),
    getSubscriptionStatus: (order_number) => get(`/api/payment/subscription/status/${order_number}`),
  },
};
