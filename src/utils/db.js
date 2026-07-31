import { DEFAULT_USERS, DEFAULT_PACKAGES, DEFAULT_BRANCHES, DEFAULT_LOYALTY } from './defaults';

const KEY = {
  users:       'washpro:users',
  sessions:    'washpro:sessions',
  packages:    'washpro:packages',
  qr:          'washpro:qr',
  branches:    'washpro:branches',
  customers:   'washpro:customers',
  loyalty:     'washpro:loyalty',
  pendingJobs: 'washpro:pending_jobs',
  invCounter:  'washpro:inv_counter',
  cusCounter:  'washpro:cus_counter',
};

const ls = {
  get: (k)    => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

export const DB = {

  // ── SEQUENTIAL INVOICE NUMBER ────────────────────────────
  // Format: INV-CAR001, INV-CAR002, ...
  getNextInvoiceNumber() {
    const current = ls.get(KEY.invCounter) || 0;
    const next    = current + 1;
    ls.set(KEY.invCounter, next);
    return `INV-CAR${String(next).padStart(3, '0')}`;
  },

  // ── SEQUENTIAL CUSTOMER ID ────────────────────────────────
  // Format: CUS-001, CUS-002, ...
  getNextCustomerId() {
    const current = ls.get(KEY.cusCounter) || 0;
    const next    = current + 1;
    ls.set(KEY.cusCounter, next);
    return `CUS-${String(next).padStart(3, '0')}`;
  },

  // ── USERS ─────────────────────────────────────────────────
  getUsers()   { return ls.get(KEY.users) || DEFAULT_USERS; },
  setUsers(u)  { ls.set(KEY.users, u); },

  // ── PENDING JOBS (submitted, awaiting payment) ─────────────
  getPendingJobs()  { return ls.get(KEY.pendingJobs) || []; },
  setPendingJobs(j) { ls.set(KEY.pendingJobs, j); },

  addPendingJob(job) {
    const all     = DB.getPendingJobs();
    const updated = [job, ...all];
    ls.set(KEY.pendingJobs, updated);
    return updated;
  },

  // Mark a pending job as completed (removes from pending list)
  completePendingJob(jobId) {
    const all     = DB.getPendingJobs();
    const updated = all.filter(j => j.id !== jobId);
    ls.set(KEY.pendingJobs, updated);
    return updated;
  },

  // ── SESSIONS (completed invoices) ─────────────────────────
  getSessions() { return ls.get(KEY.sessions) || []; },
  addSession(s) {
    const all     = DB.getSessions();
    const updated = [s, ...all];
    ls.set(KEY.sessions, updated);
    DB.upsertCustomer(s);
    return updated;
  },

  // ── PACKAGES ──────────────────────────────────────────────
  getPackages()  { return ls.get(KEY.packages) || DEFAULT_PACKAGES; },
  setPackages(p) { ls.set(KEY.packages, p); },

  // ── QR ────────────────────────────────────────────────────
  getQR()    { return ls.get(KEY.qr) || 'WASHPRO_PAYMENT_ADMIN'; },
  setQR(v)   { ls.set(KEY.qr, v); },

  // ── BRANCHES ──────────────────────────────────────────────
  getBranches()  { return ls.get(KEY.branches) || DEFAULT_BRANCHES; },
  setBranches(b) { ls.set(KEY.branches, b); },

  // ── LOYALTY CONFIG ────────────────────────────────────────
  getLoyalty()  { return { ...DEFAULT_LOYALTY, ...(ls.get(KEY.loyalty) || {}) }; },
  setLoyalty(c) { ls.set(KEY.loyalty, c); },

  // ── CUSTOMERS ─────────────────────────────────────────────
  getCustomers()  { return ls.get(KEY.customers) || []; },
  setCustomers(c) { ls.set(KEY.customers, c); },

  checkLoyaltyEligibility(phone) {
    if (!phone) return { eligible: false };
    const cfg      = DB.getLoyalty();
    if (!cfg.enabled) return { eligible: false };
    const all      = DB.getCustomers();
    const normPhone = phone.replace(/\s|-/g, '');
    const cust     = all.find(c => c.phone.replace(/\s|-/g, '') === normPhone);
    if (!cust) return { eligible: false };

    const visits = cust.visits?.length || 0;
    if (visits < cfg.visitThreshold) {
      return { eligible: false, visits, needed: cfg.visitThreshold - visits };
    }

    const lastCoupon = cust.lastCouponUsed;
    if (lastCoupon) {
      const daysSince = (Date.now() - new Date(lastCoupon).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < cfg.validityDays) {
        return { eligible: false, reason: 'recently_used', nextEligible: Math.ceil(cfg.validityDays - daysSince) };
      }
    }

    const code     = `${cfg.couponPrefix}-${cust.id.slice(-4).toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
    const discount = cfg.discountType === 'percent'
      ? { type: 'percent', value: cfg.discountValue, label: `${cfg.discountValue}% off` }
      : { type: 'fixed',   value: cfg.discountValue, label: `RM ${cfg.discountValue} off` };

    return { eligible: true, visits, cfg, code, discount, customer: cust, message: cfg.alertMessage };
  },

  recordCouponUsage(phone, couponCode) {
    const all       = DB.getCustomers();
    const normPhone = phone.replace(/\s|-/g, '');
    const idx       = all.findIndex(c => c.phone.replace(/\s|-/g, '') === normPhone);
    if (idx >= 0) {
      all[idx].lastCouponUsed  = new Date().toISOString();
      all[idx].couponsRedeemed = (all[idx].couponsRedeemed || 0) + 1;
      all[idx].couponHistory   = [
        { code: couponCode, usedAt: new Date().toISOString() },
        ...(all[idx].couponHistory || []),
      ];
      DB.setCustomers(all);
    }
  },

  upsertCustomer(session) {
    if (!session.customer?.phone) return;
    const all   = DB.getCustomers();
    const phone = session.customer.phone.replace(/\s/g, '');
    const idx   = all.findIndex(c => c.phone === phone);
    const visit = {
      sessionId: session.id,
      date:      session.date,
      vehicle:   session.vehicle,
      package:   session.package?.name,
      amount:    session.total,
      washer:    session.washer,
      branchId:  session.branchId,
      couponUsed: session.coupon?.code || null,
    };
    if (idx >= 0) {
      all[idx].visits     = [visit, ...(all[idx].visits || [])];
      all[idx].totalSpend = (all[idx].totalSpend || 0) + (session.total || 0);
      all[idx].lastVisit  = session.date;
      if (session.customer.name)  all[idx].name  = session.customer.name;
      if (session.customer.email) all[idx].email = session.customer.email;
    } else {
      // Use sequential customer ID for new customers
      all.push({
        id:              DB.getNextCustomerId(),
        name:            session.customer.name  || 'Walk-in',
        phone,
        email:           session.customer.email || '',
        branchId:        session.branchId || 'br1',
        visits:          [visit],
        totalSpend:      session.total || 0,
        lastVisit:       session.date,
        joinedAt:        new Date().toISOString(),
        notes:           '',
        couponsRedeemed: 0,
        couponHistory:   [],
      });
    }
    if (session.coupon?.code) {
      const custIdx = idx >= 0 ? idx : all.length - 1;
      all[custIdx].lastCouponUsed  = new Date().toISOString();
      all[custIdx].couponsRedeemed = (all[custIdx].couponsRedeemed || 0) + 1;
      all[custIdx].couponHistory   = [
        { code: session.coupon.code, usedAt: new Date().toISOString(), discount: session.coupon.discount },
        ...(all[custIdx].couponHistory || []),
      ];
    }
    DB.setCustomers(all);
  },

  // ── RESET ─────────────────────────────────────────────────
  reset() { Object.values(KEY).forEach(k => localStorage.removeItem(k)); },
};
