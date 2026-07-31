import { useState, useCallback, useEffect, useRef } from 'react';
import { API, token, BASE_URL } from '../utils/api';

const safeParseJSON = (data) => {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }
  return data;
};

const toSession = (s) => ({
  id: s.id, date: s.date,
  washerId: s.washerId || s.washer_id,
  washer: s.washer, washerUsername: s.washerUsername || s.washer_username,
  branchId: s.branchId || s.branch_id, branch: s.branch,
  location: s.location, locationName: s.locationName || s.location_name,
  lat: s.lat, lng: s.lng,
  vehicle: safeParseJSON(s.vehicle),
  customer: safeParseJSON(s.customer),
  package: safeParseJSON(s.package),
  payment: safeParseJSON(s.payment),
  coupon: safeParseJSON(s.coupon),
  products: safeParseJSON(s.products),
  originalTotal: s.originalTotal || s.original_total,
  total: s.total, status: s.status,
  createdAt: s.createdAt || s.created_at,
});

const toJob = (j) => ({
  id: j.id,
  customer: safeParseJSON(j.customer),
  vehicle: safeParseJSON(j.vehicle),
  package: safeParseJSON(j.package),
  geo: safeParseJSON(j.geo),
  locationName: j.locationName || j.location_name,
  branchId: j.branchId || j.branch_id, branch: j.branch,
  washerId: j.washerId || j.washer_id, washer: j.washer,
  loyalty: safeParseJSON(j.loyalty),
  submittedAt: j.submittedAt || j.submitted_at,
  status: j.status,
  products: safeParseJSON(j.products),
});

export const useAppData = () => {
  const [users, setUsers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [packages, setPackages] = useState([]);
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [bankDetails, setBankDetails] = useState({ bankName: '', accountNumber: '', accountHolder: '' });
  const [loyalty, setLoyalty] = useState({});
  const [pendingJobs, setPendingJobs] = useState([]);
  const [jobRequests, setJobRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [ready, setReady] = useState(false);
  const currentUserRef = useRef(null);



  // Called after successful auth — fetches only what the role is allowed to see
  const loadAll = useCallback(async (user) => {
    const role = user?.role || '';
    const isSupreme = role === 'SupremeAdmin';
    const isSuper = role === 'SuperAdmin' || role === 'SupremeAdmin';
    const isAdmin = isSuper || role === 'Admin';
    const isWasher = role === 'Washer';
    // IndividualUser gets nothing except packages
    const none = Promise.resolve(null);
    currentUserRef.current = user;

    try {
      const safe = (p, fb = null) => p.catch(e => { console.warn('Safe fetch failed:', e.message); return fb; });

      const [u, s, p, b, c, loyData, jobs, reqs, prods, inv, subs, bankData] = await Promise.all([
        isAdmin ? safe(API.users.list(), []) : none,
        (isAdmin || isWasher) ? safe(API.sessions.list(), []) : none,
        safe(API.packages.list(), []),                 // all roles
        (isAdmin || isWasher) ? safe(API.branches.list(), []) : none,
        isAdmin ? safe(API.customers.list(), []) : none,
        isAdmin ? safe(API.loyalty.getConfig(), {}) : none,
        isWasher || isAdmin ? safe(API.pendingJobs.list(), []) : none,
        isAdmin ? safe(API.jobRequests.list(), []) : none,
        (isAdmin || isWasher) ? safe(API.products.list(), []) : none,
        isWasher || isAdmin ? safe(API.inventory.list(), []) : none,
        isSuper ? safe(API.subscriptions.list(), []) : none,
        isAdmin || isWasher ? safe(API.settings.getBankDetails(), null) : none,
      ]);

      setUsers((u || []));
      setSessions((s || []).map(toSession));
      setPackages(p || []);
      setBranches(b || []);
      setCustomers(c || []);

      if (bankData) setBankDetails(bankData);
      setLoyalty(loyData || {});
      setPendingJobs((jobs || []).map(toJob));
      setJobRequests(reqs || []);
      setProducts(prods || []);
      setInventory(inv || []);
      setSubscriptionPlans(subs || []);
    } catch (err) {
      console.error('loadAll failed:', err.message);
    } finally {
      setReady(true);
    }
  }, []);

  const markReady = useCallback(() => setReady(true), []);

  // ── WEBSOCKET FOR REAL-TIME UPDATES ────────────────────────
  // External event subscribers (for toast notifications in App.js)
  const wsEventListenersRef = useRef([]);
  const subscribeToWsEvents = useCallback((fn) => {
    wsEventListenersRef.current.push(fn);
    return () => { wsEventListenersRef.current = wsEventListenersRef.current.filter(f => f !== fn); };
  }, []);

  useEffect(() => {
    if (!ready || !currentUserRef.current) return;

    const wsUrl = BASE_URL.replace(/^http/, 'ws') + `/ws?token=${token.get()}`;
    let ws = null;
    let reconnectTimer = null;
    let pingInterval = null;

    const connectWS = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Keep-alive ping every 25s
        pingInterval = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 25000);
      };

      ws.onmessage = async (event) => {
        const user = currentUserRef.current;
        const role = user?.role || '';
        const isAdmin = role === 'SuperAdmin' || role === 'SupremeAdmin' || role === 'Admin';
        const isWasher = role === 'Washer';

        // Legacy plain-string fallback
        if (event.data === 'refresh') {
          try {
            const safe = (p, fb = null) => p.catch(() => fb);
            if (isAdmin) {
              const s = await safe(API.sessions.list());
              if (s) setSessions(s.map(toSession));
              const c = await safe(API.customers.list());
              if (c) setCustomers(c);
              const reqs = await safe(API.jobRequests.list());
              if (reqs) setJobRequests(reqs);
            }
            if (isWasher || isAdmin) {
              const jobs = await safe(API.pendingJobs.list());
              if (jobs) setPendingJobs(jobs.map(toJob));
            }
          } catch (err) {
            console.warn('Real-time fetch error:', err);
          }
          return;
        }

        // Typed JSON events
        let parsed = null;
        try { parsed = JSON.parse(event.data); } catch { return; }
        if (!parsed || !parsed.type) return;

        const { type, payload } = parsed;

        // Notify external listeners (e.g. toast notifications)
        wsEventListenersRef.current.forEach(fn => { try { fn(type, payload); } catch {} });

        // ── Surgical state updates ──────────────────────────────
        switch (type) {
          case 'pong':
            break;

          // Sessions
          case 'session.created':
            if (payload.session && (isAdmin || isWasher)) {
              setSessions(prev => {
                const exists = prev.some(s => s.id === payload.session.id);
                if (exists) return prev;
                return [toSession(payload.session), ...prev];
              });
              // Refresh customers list since a new customer might have been created
              if (isAdmin) {
                API.customers.list().then(c => { if (c) setCustomers(c); }).catch(() => {});
                API.inventory.list().then(inv => { if (inv) setInventory(inv); }).catch(() => {});
              }
            }
            break;

          // Pending Jobs
          case 'job.assigned':
            if (payload.job && (isAdmin || isWasher)) {
              setPendingJobs(prev => {
                const exists = prev.some(j => j.id === payload.job.id);
                if (exists) return prev;
                return [toJob(payload.job), ...prev];
              });
            }
            break;

          case 'job.updated':
            if (payload.job && (isAdmin || isWasher)) {
              setPendingJobs(prev => prev.map(j => j.id === payload.job.id ? toJob(payload.job) : j));
            }
            break;

          case 'job.completed':
            if (payload.jobId && (isAdmin || isWasher)) {
              setPendingJobs(prev => prev.filter(j => j.id !== payload.jobId));
            }
            break;

          // Job Requests (QR-based from customers)
          case 'jobrequest.new':
            if (payload.request && isAdmin) {
              setJobRequests(prev => {
                const exists = prev.some(r => r.id === payload.request.id);
                if (exists) return prev;
                return [payload.request, ...prev];
              });
            }
            break;

          case 'jobrequest.assigned':
            if (isAdmin || isWasher) {
              if (isAdmin && payload.request) {
                setJobRequests(prev => prev.map(r => r.id === payload.request.id ? { ...r, ...payload.request } : r));
              }
              if (payload.job) {
                setPendingJobs(prev => {
                  const exists = prev.some(j => j.id === payload.job.id);
                  if (exists) return prev;
                  return [toJob(payload.job), ...prev];
                });
              }
            }
            break;

          // Inventory
          case 'inventory.created':
            if (payload.item && (isAdmin || isWasher)) {
              setInventory(prev => {
                const exists = prev.some(i => i.id === payload.item.id);
                if (exists) return prev;
                return [payload.item, ...prev];
              });
            }
            break;

          case 'inventory.updated':
          case 'inventory.restocked':
            if (payload.item && (isAdmin || isWasher)) {
              setInventory(prev => prev.map(i => i.id === payload.item.id ? payload.item : i));
            }
            break;

          case 'inventory.deleted':
            if (payload.itemId && (isAdmin || isWasher)) {
              setInventory(prev => prev.filter(i => i.id !== payload.itemId));
            }
            break;

          // Products
          case 'product.created':
            if (payload.product && (isAdmin || isWasher)) {
              setProducts(prev => {
                const exists = prev.some(p => p.id === payload.product.id);
                if (exists) return prev;
                return [payload.product, ...prev];
              });
            }
            break;

          case 'product.updated':
            if (payload.product && (isAdmin || isWasher)) {
              setProducts(prev => prev.map(p => p.id === payload.product.id ? payload.product : p));
            }
            break;

          case 'product.deleted':
            if (payload.productId && (isAdmin || isWasher)) {
              setProducts(prev => prev.filter(p => p.id !== payload.productId));
            }
            break;

          // Users
          case 'user.created':
            if (payload.user && isAdmin) {
              setUsers(prev => {
                const exists = prev.some(u => u.id === payload.user.id);
                if (exists) return prev;
                return [...prev, payload.user];
              });
            }
            break;

          // New super admin registration (SupremeAdmin only sees this)
          case 'user.registered':
            // Refetch users to get the new pending user
            if (isAdmin) {
              API.users.list().then(u => { if (u) setUsers(u); }).catch(() => {});
            }
            break;

          // Plan upgrade/approval
          case 'plan.upgraded':
          case 'plan.upgrade_requested':
            // Refetch subscription plans and users for Supreme Admin
            if (role === 'SupremeAdmin') {
              API.subscriptions.list().then(s => { if (s) setSubscriptionPlans(s); }).catch(() => {});
              API.users.list().then(u => { if (u) setUsers(u); }).catch(() => {});
            }
            break;

          default:
            break;
        }
      };

      ws.onclose = () => {
        clearInterval(pingInterval);
        // Automatically reconnect after 5 seconds
        reconnectTimer = setTimeout(connectWS, 5000);
      };
      
      ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
      };
    };

    connectWS();

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null; // Prevent reconnection on intentional unmount
        ws.close();
      }
    };
  }, [ready]);

  // ── USERS ──────────────────────────────────────────────────
  const createUser = useCallback(async (d) => {
    const u = await API.users.create(d);
    setUsers(prev => [...prev, u]);
    return u;
  }, []);

  const updateUser = useCallback(async (id, d) => {
    const u = await API.users.update(id, d);
    setUsers(prev => prev.map(x => x.id === id ? u : x));
    return u;
  }, []);

  const deleteUser = useCallback(async (id) => {
    await API.users.delete(id);
    setUsers(prev => prev.filter(x => x.id !== id));
  }, []);

  // ── SESSIONS ───────────────────────────────────────────────
  const addSession = useCallback(async (data) => {
    const saved = await API.sessions.create({
      date: data.date,
      washer_id: data.washerId,
      washer: data.washer,
      washer_username: data.washerUsername,
      branch_id: data.branchId,
      branch: data.branch,
      location: data.location,
      location_name: data.locationName,
      lat: data.lat || 0,
      lng: data.lng || 0,
      vehicle: data.vehicle,
      customer: data.customer,
      package: data.package,
      payment: data.payment,
      coupon: data.coupon,
      products: data.products,
      original_total: data.originalTotal,
      total: data.total,
      status: data.status || 'Completed',
    });
    const norm = toSession(saved);
    setSessions(prev => {
      if (prev.some(x => x.id === norm.id)) return prev;
      return [norm, ...prev];
    });
    API.customers.list().then(c => setCustomers(c || [])).catch(() => { });
    API.inventory.list().then(inv => setInventory(inv || [])).catch(() => { });
    return norm;
  }, []);

  // ── PACKAGES ───────────────────────────────────────────────
  const createPackage = useCallback(async (d) => {
    const p = await API.packages.create(d);
    setPackages(prev => [...prev, p].sort((a, b) => a.sort_order - b.sort_order));
    return p;
  }, []);

  const updatePackage = useCallback(async (id, d) => {
    const p = await API.packages.update(id, d);
    setPackages(prev => prev.map(x => x.id === id ? p : x).sort((a, b) => a.sort_order - b.sort_order));
    return p;
  }, []);

  const deletePackage = useCallback(async (id) => {
    await API.packages.delete(id);
    setPackages(prev => prev.filter(x => x.id !== id));
  }, []);

  // ── SUBSCRIPTIONS ────────────────────────────────────────────
  const createSubscriptionPlan = useCallback(async (d) => {
    const p = await API.subscriptions.create(d);
    setSubscriptionPlans(prev => [...prev, p]);
    return p;
  }, []);

  const updateSubscriptionPlan = useCallback(async (id, d) => {
    const p = await API.subscriptions.update(id, d);
    setSubscriptionPlans(prev => prev.map(x => x.id === id ? p : x));
    return p;
  }, []);

  const deleteSubscriptionPlan = useCallback(async (id) => {
    await API.subscriptions.delete(id);
    setSubscriptionPlans(prev => prev.filter(x => x.id !== id));
  }, []);

  // ── PRODUCTS ───────────────────────────────────────────────
  const createProduct = useCallback(async (d) => {
    const p = await API.products.create(d);
    setProducts(prev => {
      if (prev.some(x => x.id === p.id)) return prev;
      return [p, ...prev];
    });
    return p;
  }, []);

  const updateProduct = useCallback(async (id, d) => {
    const p = await API.products.update(id, d);
    setProducts(prev => prev.map(x => x.id === id ? p : x));
    return p;
  }, []);

  const deleteProduct = useCallback(async (id) => {
    await API.products.delete(id);
    setProducts(prev => prev.filter(x => x.id !== id));
  }, []);

  // ── INVENTORY ──────────────────────────────────────────────
  const refreshInventory = useCallback(async () => {
    const inv = await API.inventory.list();
    setInventory(inv || []);
  }, []);

  const createInventoryItem = useCallback(async (d) => {
    const item = await API.inventory.create(d);
    setInventory(prev => {
      if (prev.some(x => x.id === item.id)) return prev;
      return [item, ...prev];
    });
    return item;
  }, []);

  const updateInventoryItem = useCallback(async (id, d) => {
    const item = await API.inventory.update(id, d);
    setInventory(prev => prev.map(x => x.id === id ? item : x));
    return item;
  }, []);

  const deleteInventoryItem = useCallback(async (id) => {
    await API.inventory.delete(id);
    setInventory(prev => prev.filter(x => x.id !== id));
  }, []);

  const restockInventoryItem = useCallback(async (id, data) => {
    const res = await API.inventory.restock(id, data);
    setInventory(prev => prev.map(x => x.id === id ? { ...x, quantity: res.quantity, low_stock: res.low_stock, updated_at: res.updated_at } : x));
    return res;
  }, []);

  const useInventoryItem = useCallback(async (id, data) => {
    const res = await API.inventory.use(id, data);
    setInventory(prev => prev.map(x => x.id === id ? { ...x, quantity: res.quantity, low_stock: res.low_stock, updated_at: res.updated_at } : x));
    return res;
  }, []);

  // ── BRANCHES ───────────────────────────────────────────────
  const createBranch = useCallback(async (d) => {
    const b = await API.branches.create(d);
    setBranches(prev => [...prev, b]);
    return b;
  }, []);

  const updateBranch = useCallback(async (id, d) => {
    const b = await API.branches.update(id, d);
    setBranches(prev => prev.map(x => x.id === id ? b : x));
    
    // Also update the local users state if the phone number changed
    if (d.phone !== undefined) {
      setUsers(prev => prev.map(u => 
        ((u.branch_id === id || u.branchId === id) && (u.role === 'Admin' || u.role === 'SuperAdmin')) 
          ? { ...u, phone: d.phone } 
          : u
      ));
    }
    
    return b;
  }, []);

  const deleteBranch = useCallback(async (id) => {
    await API.branches.delete(id);
    setBranches(prev => prev.filter(x => x.id !== id));
  }, []);

  // ── CUSTOMERS ──────────────────────────────────────────────
  const updateCustomers = useCallback((arr) => setCustomers(arr), []);

  const updateCustomer = useCallback(async (id, d) => {
    const c = await API.customers.update(id, d);
    setCustomers(prev => prev.map(x => x.id === id ? c : x));
    return c;
  }, []);


  // ── LOYALTY ────────────────────────────────────────────────
  const updateLoyalty = useCallback(async (data) => {
    await API.loyalty.setConfig(data);
    setLoyalty(data);
  }, []);

  // ── PENDING JOBS ───────────────────────────────────────────
  const addPendingJob = useCallback(async (job) => {
    const saved = await API.pendingJobs.create({
      id: job.id,
      customer: job.customer,
      vehicle: job.vehicle,
      package: job.package,
      geo: job.geo,
      location_name: job.locationName,
      branch_id: job.branchId,
      branch: job.branch,
      washer_id: job.washerId,
      washer: job.washer,
      loyalty: job.loyalty,
      status: job.status,
      products: job.products,
    });
    const norm = toJob(saved);
    setPendingJobs(prev => {
      const exists = prev.some(j => j.id === norm.id);
      if (exists) return prev;
      if (prev.some(x => x.id === norm.id)) return prev;
      return [norm, ...prev];
    });
    return norm;
  }, []);

  const updatePendingJob = useCallback(async (jobId, data) => {
    const updated = await API.pendingJobs.update(jobId, data);
    setPendingJobs(prev => prev.map(j => j.id === jobId ? toJob(updated) : j));
    return toJob(updated);
  }, []);

  const completePendingJob = useCallback(async (jobId) => {
    await API.pendingJobs.delete(jobId);
    setPendingJobs(prev => prev.filter(j => j.id !== jobId));
  }, []);

  const assignJobRequest = useCallback(async (reqId, data) => {
    const updated = await API.jobRequests.assign(reqId, data);
    setJobRequests(prev => prev.map(r => r.id === reqId ? updated : r));
    API.pendingJobs.list().then(jobs => { if (jobs) setPendingJobs(jobs.map(toJob)); }).catch(() => { });
    return updated;
  }, []);

  return {
    ready, loadAll, markReady,
    users, createUser, updateUser, deleteUser,
    sessions, addSession,
    packages, createPackage, updatePackage, deletePackage,
    products, createProduct, updateProduct, deleteProduct,
    inventory,
    createInventoryItem, updateInventoryItem, deleteInventoryItem,
    restockInventoryItem, useInventoryItem, refreshInventory,
    subscriptionPlans,
    createSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan,
    branches, createBranch, updateBranch, deleteBranch,
    customers, updateCustomers, updateCustomer,

    loyalty, updateLoyalty,
    pendingJobs, addPendingJob, updatePendingJob, completePendingJob,
    jobRequests, assignJobRequest,
    subscribeToWsEvents,
  };
};
