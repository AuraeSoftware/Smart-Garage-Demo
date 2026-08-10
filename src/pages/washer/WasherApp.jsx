import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useHashNav } from '../../hooks/useHashNav';
import { Btn, Inp, PhoneInp, Modal, Dropdown, Table, ConfirmModal, ThemeToggle } from '../../components/common/UI';
import NotificationsDropdown from '../../components/common/NotificationsDropdown';
import { generateInvoicePDF } from '../../utils/pdf';
import { openWhatsApp, sendPushNotification, getCurrency } from '../../utils/messaging';
import { API } from '../../utils/api';
import { BrowserMultiFormatReader } from '@zxing/library';
import '../admin/AddProductModal.css';
import logoLight from '../../assets/smart-garage-light/Smart-Garage-h.png';
import logoDark from '../../assets/smart-garage-dark/smart-garage-dark-theme-har.png';
import mapIcon from '../../assets/icons/map-icon.png';
import trophyIcon from '../../assets/icons/diamond-icon.png';
import SoapIcon from '../../assets/icons/soap-icon.png';
import backArrow from '../../assets/icons/back-arrow-icon.png';
import JobIcon from '../../assets/icons/job-icon.png';
import { NotificationsPage } from '../admin/NotificationsPage';

/* ── Reverse geocode ─────────────────────────────────────── */
const reverseGeocode = async (lat, lng) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { headers: { 'Accept-Language': 'en', 'User-Agent': 'WashProApp/2.0' } });
    const data = await res.json();
    const a = data.address || {};
    const parts = [
      a.amenity, a.house_number, a.road || a.pedestrian, a.suburb || a.neighbourhood, a.city || a.town || a.village, a.state
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : (data.display_name || null);
  } catch { return null; }
};

/* ── Step config ─────────────────────────────────────────── */
const STEPS = [
  { id: 1, label: 'Location' },
  { id: 2, label: 'Photo' },
  { id: 3, label: 'AI Scan' },
  { id: 4, label: 'Details' },
  { id: 5, label: 'Package' },
];

export const WasherApp = ({ user, packages, inventory, consumeInventoryItem, qrLabel, bankDetails, branches, onLogout, onAddSession, addPendingJob, updatePendingJob, completePendingJob, pendingJobs, sessions, isDark, onToggleTheme, notify, branchSubscription }) => {
  const curr = getCurrency(user?.phone) || 'RM';
  const currencyCode = curr === 'INR' ? 'INR' : curr === 'Rp' ? 'IDR' : curr === '$' ? 'USD' : curr === 'SGD' ? 'SGD' : 'MYR';
  const [view, setView] = useHashNav('dashboard');

  const getSavedState = () => {
    try {
      const saved = sessionStorage.getItem('washerIntakeState');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.washerId === user.id) return parsed;
      }
    } catch (e) { console.error(e); }
    return {};
  };
  const [savedState] = useState(getSavedState);

  const [activeJob, setActiveJob] = useState(savedState.activeJob || null);

  const [step, setStep] = useState(savedState.step || 1);
  const [geo, setGeo] = useState(savedState.geo || null);
  const [dynamicQrUrl, setDynamicQrUrl] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [qrLoading, setQrLoading] = useState(false);


  const [locationName, setLocationName] = useState(savedState.locationName || null);
  const [geoLoad, setGeoLoad] = useState(false);
  const [photo, setPhoto] = useState(savedState.photo || null);
  const [camActive, setCamActive] = useState(false);
  const [aiResult, setAiResult] = useState(savedState.aiResult || null);
  const [aiLoad, setAiLoad] = useState(false);
  const [vehicle, setVehicle] = useState(savedState.vehicle || { make: '', model: '', colour: '', plate: '' });
  const [customer, setCustomer] = useState(savedState.customer || { name: '', phone: '', email: '' });
  const [custErrors, setCustErrors] = useState({});
  const [loyalty, setLoyalty] = useState(savedState.loyalty || null);
  const [selPkg, setSelPkg] = useState(savedState.selPkg || null);
  const [assignedJobId, setAssignedJobId] = useState(savedState.assignedJobId || null);
  const [isPackageLocked, setIsPackageLocked] = useState(savedState.isPackageLocked || false);

  // Default to Main Branch (branches[0]) if the user has no specific branch assigned.
  const mainBranchId = branches.find(b => b.name?.toLowerCase().includes('main'))?.id || branches[0]?.id || '';
  const [branchId, setBranchId] = useState(savedState.branchId || user.branchId || user.branch_id || mainBranchId);

  const [coupon, setCoupon] = useState(savedState.coupon || null);
  const [cart, setCart] = useState(savedState.cart || []);
  const [payMode, setPayMode] = useState(savedState.payMode || null);
  const [payRef, setPayRef] = useState(savedState.payRef || '');
  const [cashAmt, setCashAmt] = useState(savedState.cashAmt || '');
  const [invoice, setInvoice] = useState(savedState.invoice || null);

  useEffect(() => {
    let interval;
    if (orderNumber && payMode === 'Dynamic QR') {
      interval = setInterval(async () => {
        try {
          const res = await API.payment.getSubscriptionStatus(orderNumber);
          if (res.status === 'PAID') {
            clearInterval(interval);
            await finalizeInvoice(orderNumber, true);
          }
        } catch (e) { }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [orderNumber, payMode]);
  const [payStep, setPayStep] = useState(savedState.payStep || 6);

  // Save intake state on change
  useEffect(() => {
    const stateToSave = { 
      washerId: user.id, step, geo, locationName, photo, aiResult, vehicle, customer, loyalty, selPkg, assignedJobId, isPackageLocked, branchId,
      activeJob, coupon, cart, payMode, payRef, cashAmt, invoice, payStep
    };
    try {
      sessionStorage.setItem('washerIntakeState', JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Failed to save intake state to sessionStorage', e);
      if (e.name === 'QuotaExceededError') {
        try {
          const stateWithoutPhoto = { ...stateToSave, photo: null };
          sessionStorage.setItem('washerIntakeState', JSON.stringify(stateWithoutPhoto));
        } catch (e2) {
          console.warn('Still failed to save state', e2);
        }
      }
    }
  }, [user.id, step, geo, locationName, photo, aiResult, vehicle, customer, loyalty, selPkg, assignedJobId, isPackageLocked, branchId, activeJob, coupon, cart, payMode, payRef, cashAmt, invoice, payStep]);
  const [branchBankDetails, setBranchBankDetails] = useState({ bankName: '', accountNumber: '', accountHolder: '' });
  const [branchQrLabel, setBranchQrLabel] = useState('Payment');
  const [razorpayConfig, setRazorpayConfig] = useState({ key_id: '' });

  useEffect(() => {
    API.settings.getBankDetails().then(data => {
      if (data) setBranchBankDetails(data);
    }).catch(err => console.warn('Failed to fetch washer bank details', err));

    API.settings.getQR().then(res => {
      if (res && res.value) setBranchQrLabel(res.value);
    }).catch(err => console.warn('Failed to fetch washer QR label', err));

    API.settings.getRazorpay().then(data => {
      if (data) setRazorpayConfig(data);
    }).catch(err => console.warn('Failed to fetch razorpay config', err));

    API.settings.getGst().then(data => {
      if (data) setGstConfig(data);
    }).catch(err => console.warn('Failed to fetch gst config', err));
  }, []);

  const [availableRequests, setAvailableRequests] = useState([]);

  const prevReqsRef = useRef([]);

  const fetchAvailableRequests = useCallback(() => {
    API.jobRequests.getAvailable()
      .then(reqs => {
        const newReqs = reqs || [];
        setAvailableRequests(newReqs);

        const prevIds = prevReqsRef.current.map(r => r.id);
        const newlyAdded = newReqs.filter(r => !prevIds.includes(r.id));
        if (newlyAdded.length > 0 && prevReqsRef.current.length !== 0) {
          notify(`New public job request${newlyAdded.length > 1 ? 's' : ''} available!`, 'success');
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
          } catch(e) {}
        }
        prevReqsRef.current = newReqs;
      })
      .catch(err => console.warn('Failed to fetch available job requests', err));
  }, [notify]);

  useEffect(() => {
    fetchAvailableRequests();
    const interval = setInterval(fetchAvailableRequests, 15000);
    return () => clearInterval(interval);
  }, [fetchAvailableRequests]);

  const [gstConfig, setGstConfig] = useState({ enabled: false, percentage: 6, number: '' });
  const [pdfLoad, setPdfLoad] = useState(false);
  const [isScanningProduct, setIsScanningProduct] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerActiveView, setScannerActiveView] = useState(false);
  const [scanType, setScanType] = useState('addon');
  const [showMenu, setShowMenu] = useState(false);
  const [historyMonth, setHistoryMonth] = useState(new Date().getMonth());
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear());
  const [filterType, setFilterType] = useState('month'); // 'month' or 'custom'
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [takingJobId, setTakingJobId] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const washerQrRef = useRef(null);
  const scanHandlerRef = useRef(null);

  useEffect(() => () => stopCamera(), []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCamActive(false);
  };

  /* ── GPS ── */
  const captureGeo = () => {
    setGeoLoad(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude.toFixed(5);
        const lng = p.coords.longitude.toFixed(5);
        setGeo({ lat, lng, accuracy: Math.round(p.coords.accuracy) });
        setGeoLoad(false);
        const name = await reverseGeocode(lat, lng);
        if (name) setLocationName(name);
      },
      (error) => {
        alert('Unable to retrieve your location. Please ensure GPS is enabled and allowed for this site.');
        setGeoLoad(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  /* ── Camera ── */
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      setCamActive(true);
      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play().catch(e => console.log('Autoplay prevented:', e));
        }
      }, 50);
    } catch { notify('Camera access denied. Please upload a photo.', 'warn'); }
  };

  const capturePhoto = () => {
    const canvas = canvasRef.current, video = videoRef.current;
    if (canvas && video) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext('2d').drawImage(video, 0, 0);
      setPhoto({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), timestamp: new Date().toISOString(), geo });
      setAiResult(null);
      stopCamera();
    }
  };

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 1280;
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setPhoto({ dataUrl, timestamp: new Date().toISOString(), geo, fromFile: true });
        setAiResult(null);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const dataURItoBlob = (dataURI) => {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  };

  /* ── AI Scan ── */
  const runAI = async () => {
    setAiLoad(true); setAiResult(null);
    try {
      if (!photo) throw new Error("No photo captured");

      const blob = dataURItoBlob(photo.dataUrl);
      const formData = new FormData();
      formData.append('file', blob, 'car.jpg');

      const res = await API.vision.analyzeCar(formData);

      const fb = {
        make: res.car_make || 'Unknown',
        model: res.car_model || 'Unknown',
        colour: res.car_colour || 'Unknown',
        plate: res.plate_number || 'Not Visible',
        confidence: 'High',
        notes: 'AI Processed'
      };
      setAiResult(fb);
      setVehicle(v => ({ ...v, make: fb.make !== 'Unknown' ? fb.make : v.make, model: fb.model !== 'Unknown' ? fb.model : v.model, colour: fb.colour !== 'Unknown' ? fb.colour : v.colour, plate: fb.plate && fb.plate !== 'Not Visible' ? fb.plate : v.plate }));
    } catch (err) {
      console.error(err);
      notify(`AI Scan failed: ${err.message || "Please enter details manually."}`, "error");
    }
    setAiLoad(false);
  };

  /* ── Validate & proceed to package ── */
  const validateAndProceed = useCallback(async () => {
    const errors = {};
    if (!customer.name.trim()) errors.name = 'Required';
    if (!customer.phone.trim()) errors.phone = 'Required';
    else if (!/^[\d\s+\-()]{7,15}$/.test(customer.phone.trim())) errors.phone = 'Invalid phone';
    if (!vehicle.make.trim()) errors.make = 'Required';
    if (!vehicle.model.trim()) errors.model = 'Required';
    setCustErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const elig = await API.loyalty.check(customer.phone.trim()).catch(() => ({ eligible: false }));
    setLoyalty(elig);
    if (elig.eligible) notify(`Loyalty reward available for ${customer.name}!`, 'success');
    setStep(5);
  }, [customer, vehicle, notify]);

  useEffect(() => {
    if (view !== 'intake') return;
    if (selPkg && selPkg.products) {
      try {
        const parsed = typeof selPkg.products === 'string' ? JSON.parse(selPkg.products) : selPkg.products;
        if (Array.isArray(parsed)) {
          const validItems = [];
          const branchToUse = branchId || user?.branch_id || user?.branchId;
          const isMatchingBranch = (i) => !branchToUse || branchToUse === 'all' || String(i.branch_id || i.branchId) === String(branchToUse);

          parsed.forEach(p => {
            if (p.isCustom) {
              validItems.push({
                cartId: `${p.id}-retail`, id: p.id, originalId: p.id, name: p.name, category: 'Placeholder', price: p.price || 0, isIncluded: true, quantity: 0, maxQty: 9999
              });
              return;
            }
            let invItem = (inventory || []).find(i => isMatchingBranch(i) && String(i.id) === String(p.id));
            if (!invItem) invItem = (inventory || []).find(i => isMatchingBranch(i) && i.name && p.name && i.name.toLowerCase() === p.name.toLowerCase());
            if (!invItem) invItem = { id: p.id, name: p.name || 'Unknown Product', category: p.category || 'Retail', price: p.price || 0, quantity: 0, washes_per_unit: 1 };
            const packageWpu = p.quantity || 1;
            const wpu = invItem.washes_per_unit || 1;
            const used = invItem.used_washes || 0;
            const maxAvailableScans = Math.max(0, Math.floor((invItem.quantity || 0) * wpu) - used);
            const maxQty = maxAvailableScans > 0 ? maxAvailableScans : 9999;
            const initialQty = Math.min(packageWpu, maxQty);
            validItems.push({
              cartId: `${invItem.id}-retail`, id: invItem.id, originalId: p.id, name: invItem.name, category: invItem.category, price: invItem.price || invItem.cost || 0, isIncluded: true, quantity: initialQty, package_wpu: packageWpu, maxQty: maxQty
            });
          });
          setCart(validItems);
        } else setCart([]);
      } catch (e) { setCart([]); }
    } else setCart([]);
  }, [selPkg, inventory, branchId, user, view]);

  const submitJob = useCallback(async () => {
    if (!selPkg) { notify('Select a package first', 'warn'); return; }
    if (saving) return;
    setSaving(true);
    try {
      const branch = branches.find(b => b.id === branchId);
      const jobData = {
        customer, vehicle, package: selPkg, geo, locationName,
        branchId, branch: branch?.name,
        washerId: user.id, washer: user.name, loyalty,
        status: 'pending',
        products: cart,
      };

      if (assignedJobId) {
        jobData.id = assignedJobId;
        jobData.submittedAt = new Date().toISOString();
        await updatePendingJob(assignedJobId, jobData);
      } else {
        jobData.id = 'JOB-' + Date.now().toString().slice(-8);
        jobData.submittedAt = new Date().toISOString();
        await addPendingJob(jobData);
      }
      notify(`Job submitted for ${customer.name}`, 'success');
      resetIntake();
      setView('dashboard');
    } catch (err) {
      console.warn("Failed to submit job:", err);
      notify("Failed to submit job", "error");
    } finally {
      setSaving(false);
    }
  }, [selPkg, customer, vehicle, geo, locationName, branchId, branches, user, loyalty, assignedJobId, cart, addPendingJob, updatePendingJob, notify, saving]);

  const handleTakeJob = async (reqId) => {
    try {
      setTakingJobId(reqId);
      await API.jobRequests.take(reqId);
      notify("Job claimed successfully!", "success");
      fetchAvailableRequests();
      // Wait a moment for backend to fully process then reload pending jobs
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      console.error(err);
      notify(err.response?.data?.detail || "Failed to take job. Another washer might have taken it.", "error");
      fetchAvailableRequests();
    } finally {
      setTakingJobId(null);
    }
  };

  const resetIntake = () => {
    setStep(1); setGeo(null); setLocationName(null); setPhoto(null);
    setAiResult(null); setVehicle({ make: '', model: '', colour: '', plate: '' });
    setCustomer({ name: '', phone: '', email: '' });
    setCustErrors({}); setLoyalty(null); setSelPkg(null); setCart([]);
    setAssignedJobId(null);
    setIsPackageLocked(false);
  };

  /* ── Open payment ── */
  const openPayment = async (job) => {
    setActiveJob(job);
    const elig = await API.loyalty.check(job.customer.phone).catch(() => ({ eligible: false }));
    setLoyalty(elig);
    setCoupon(null); setPayMode(null); setPayRef(''); setCashAmt('');
    setInvoice(null); setPayStep(6);

    let parsedJobProducts = null;
    if (job.products) {
      try {
        parsedJobProducts = typeof job.products === 'string' ? JSON.parse(job.products) : job.products;
      } catch (e) {
        // ignore
      }
    }

    if (Array.isArray(parsedJobProducts) && parsedJobProducts.length > 0) {
      setCart(parsedJobProducts);
    } else if (job.package && job.package.products) {
      try {
        const parsed = typeof job.package.products === 'string'
          ? JSON.parse(job.package.products)
          : job.package.products;
        if (Array.isArray(parsed)) {
          const validItems = [];
          const branchToUse = job.branchId || branchId || user?.branch_id || user?.branchId;
          const isMatchingBranch = (i) => !branchToUse || branchToUse === 'all' || String(i.branch_id || i.branchId) === String(branchToUse);

          parsed.forEach(p => {
            if (p.isCustom) {
              validItems.push({
                cartId: `${p.id}-retail`,
                id: p.id,
                originalId: p.id,
                name: p.name,
                category: 'Placeholder',
                price: p.price || 0,
                isIncluded: true,
                quantity: 0,
                maxQty: 9999
              });
              return;
            }
            let invItem = (inventory || []).find(i => isMatchingBranch(i) && String(i.id) === String(p.id));
            if (!invItem) {
              invItem = (inventory || []).find(i => isMatchingBranch(i) && i.name && p.name && i.name.toLowerCase() === p.name.toLowerCase());
            }
            if (!invItem) {
              invItem = {
                id: p.id,
                name: p.name || 'Unknown Product',
                category: p.category || 'Retail',
                price: p.price || 0,
                quantity: 0,
                washes_per_unit: 1
              };
            }
            const packageWpu = p.quantity || 1;
            const wpu = invItem.washes_per_unit || 1;
            const used = invItem.used_washes || 0;
            const maxAvailableScans = Math.max(0, Math.floor((invItem.quantity || 0) * wpu) - used);
            validItems.push({
              cartId: `${invItem.id}-retail`,
              id: invItem.id,
              originalId: p.id,
              name: invItem.name,
              category: invItem.category,
              price: invItem.price || invItem.cost || 0,
              isIncluded: true,
              quantity: packageWpu,
              package_wpu: packageWpu,
              maxQty: maxAvailableScans > 0 ? maxAvailableScans : 9999
            });
          });
          setCart(validItems);
        } else {
          setCart([]);
        }
      } catch (e) { setCart([]); }
    } else {
      setCart([]);
    }

    setView('payment');
  };

  const applyCoupon = useCallback(() => {
    if (!loyalty?.eligible || !activeJob?.package) return;
    const disc = loyalty.discount;
    const discAmt = disc.type === 'percent' ? Math.round(activeJob.package.price * disc.value / 100) : Math.min(disc.value, activeJob.package.price);
    setCoupon({ code: loyalty.code, discount: disc, discountAmount: discAmt, applied: true });
    notify(`Coupon ${loyalty.code} applied! -{curr} ${discAmt}`, 'success');
  }, [loyalty, activeJob, notify]);

  // ── Cart / Retail Products ──
  const handleScanProduct = useCallback((code) => {
    if (!code || !code.trim()) return;
    const searchCode = code.trim();
    const item = (inventory || []).find(i => (i.barcode && String(i.barcode) === searchCode) || String(i.id) === searchCode);
    if (!item) {
      notify(`Product not found: ${searchCode}`, 'error');
      return;
    }

    const currentPkg = activeJob?.package || selPkg;
    if (scanType === 'retail' && currentPkg?.products) {
      try {
        const pkgProducts = typeof currentPkg.products === 'string' ? JSON.parse(currentPkg.products) : currentPkg.products;
        if (pkgProducts && pkgProducts.length > 0) {
          const hasCustomPlaceholder = pkgProducts.some(p => p.isCustom);
          const isAllowed = pkgProducts.some(p => String(p.id) === String(item.id) || (p.name && p.name.toLowerCase() === item.name.toLowerCase()));

          if (!isAllowed && !hasCustomPlaceholder) {
            notify(`${item.name} is not included in the selected package!`, 'error');
            return;
          }
        }
      } catch (e) { }
    }

    const wpu = item.washes_per_unit || 1;
    const used = item.used_washes || 0;
    const maxAvailableScans = Math.floor((item.quantity || 0) * wpu) - used;

    if (maxAvailableScans <= 0) {
      notify(`${item.name} out of stock`, 'error');
      return;
    }

    setCart(prev => {
      const cartId = `${item.id}-${scanType}`;
      const existing = prev.find(p => p.cartId === cartId);
      if (existing) {
        if (existing.quantity >= maxAvailableScans) {
          notify(`Not enough ${item.name} in stock`, 'warn');
          return prev;
        }
        return prev.map(p => p.cartId === cartId ? { ...p, quantity: p.quantity + 1 } : p);
      }
      return [...prev, {
        cartId,
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price || item.cost || 0,
        isIncluded: scanType === 'retail',
        quantity: 1,
        maxQty: maxAvailableScans
      }];
    });
    notify(`✓ Added ${item.name} to cart`, 'success');
  }, [inventory, notify, scanType, activeJob]);

  useEffect(() => { scanHandlerRef.current = handleScanProduct; }, [handleScanProduct]);

  useEffect(() => {
    let codeReader;
    if (isScanningProduct) {
      setCameraError('');
      codeReader = new BrowserMultiFormatReader();

      codeReader.listVideoInputDevices()
        .then((videoInputDevices) => {
          if (videoInputDevices.length === 0) {
            setCameraError("No camera devices found.");
            return;
          }
          let selectedDeviceId = videoInputDevices[0].deviceId;
          const backCamera = videoInputDevices.find(device =>
            device.label.toLowerCase().includes('back') ||
            device.label.toLowerCase().includes('environment')
          );
          if (backCamera) {
            selectedDeviceId = backCamera.deviceId;
          }

          codeReader.decodeFromVideoDevice(selectedDeviceId, 'washer-qr-reader', (result, err) => {
            if (result) {
              const text = result.getText();
              if (scanHandlerRef.current) scanHandlerRef.current(text);
              setIsScanningProduct(false);
              setShowScannerModal(false);
              setScannerActiveView(false);
            }
          });
        })
        .catch((err) => {
          setCameraError(err?.message || "Unable to access webcam. Please check permissions.");
          notify("Failed to start camera. Please check permissions.", "error");
        });
    }

    return () => {
      if (codeReader) {
        codeReader.reset();
      }
    };
  }, [isScanningProduct, notify]);

  const updateCartQty = (cartId, delta) => {
    setCart(prev => prev.map(p => {
      if (p.cartId === cartId) {
        const newQty = Math.max(0, Math.min(p.maxQty, p.quantity + delta));
        return { ...p, quantity: newQty };
      }
      return p;
    }).filter(p => {
      if (p.quantity > 0) return true;
      const currentPkg = activeJob?.package || selPkg;
      if (p.isIncluded && currentPkg?.products) {
        try {
          const pkgProducts = typeof currentPkg.products === 'string' ? JSON.parse(currentPkg.products) : currentPkg.products;
          if (Array.isArray(pkgProducts)) {
            return pkgProducts.some(req => String(req.id) === String(p.originalId));
          }
        } catch (e) { }
      }
      return false;
    }));
  };

  const [submitLoad, setSubmitLoad] = useState(false);

  const generateDynamicQr = async () => {
    setQrLoading(true); setDynamicQrUrl('');
    try {
      const pkg = activeJob.package;
      const cartAddonTotal = cart.reduce((sum, p) => sum + (p.isIncluded ? 0 : Number(p.price || 0) * Number(p.quantity || 1)), 0);
      const baseTotal = (coupon?.applied ? Math.max(0, Number(pkg.price) - coupon.discountAmount) : Number(pkg.price)) + cartAddonTotal;
      const gstAmount = gstConfig?.enabled ? (baseTotal * (gstConfig.percentage / 100)) : 0;
      const finalTotal = baseTotal + gstAmount;

      const branchToUse = activeJob?.branchId || activeJob?.branch_id || user?.branchId || user?.branch_id || '';
      const res = await API.payment.createInvoiceQr(activeJob.id, finalTotal, branchToUse, currencyCode);
      setDynamicQrUrl(res.qr_url);
      setOrderNumber(res.order_number || res.order_id);
    } catch (err) {
      alert(err.message || "Failed to generate dynamic QR.");
    }
    setQrLoading(false);
  };

  const generateInvoice = async () => {
    if (payMode === 'Online (Razorpay)') {
      if (!razorpayConfig.key_id) return alert('Razorpay is not properly configured for this branch');

      const pkg = activeJob.package;
      const cartAddonTotal = cart.reduce((sum, p) => sum + (p.isIncluded ? 0 : Number(p.price || 0) * Number(p.quantity || 1)), 0);
      const baseTotal = (coupon?.applied ? Math.max(0, Number(pkg.price) - coupon.discountAmount) : Number(pkg.price)) + cartAddonTotal;
      const gstAmount = gstConfig?.enabled ? (baseTotal * (gstConfig.percentage / 100)) : 0;
      const finalTotal = baseTotal + gstAmount;

      setSubmitLoad(true);
      try {
        const { order_id } = await API.payment.createRazorpayOrder(finalTotal, false, currencyCode);
        const options = {
          key: razorpayConfig.key_id,
          amount: Math.round(finalTotal * 100),
          currency: currencyCode,
          name: "Smart Garage Service",
          description: `Wash Service: ${activeJob.vehicle.plate}`,
          order_id: order_id,
          handler: async function (response) {
            try {
              await API.payment.verifyRazorpayPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                for_subscription: false
              });
              await finalizeInvoice(response.razorpay_payment_id);
            } catch (err) {
              setSubmitLoad(false);
              alert("Payment verification failed. Please contact support.");
            }
          },
          prefill: {
            name: activeJob.customer.name,
            contact: activeJob.customer.phone
          },
          theme: { color: "#6366f1" },
          modal: { ondismiss: () => setSubmitLoad(false) }
        };
        if (!window.Razorpay) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
          });
        }
        const rzp = new window.Razorpay(options);
        rzp.open();
      } catch (err) {
        setSubmitLoad(false);
        alert(err.message || 'Failed to initiate online payment');
      }
      return;
    }

    await finalizeInvoice();
  };

  const finalizeInvoice = async (onlinePayRef = null) => {
    setSubmitLoad(true);
    try {
      const pkg = activeJob.package;
      const cartAddonTotal = cart.reduce((sum, p) => sum + (p.isIncluded ? 0 : Number(p.price || 0) * Number(p.quantity || 1)), 0);
      const baseTotal = (coupon?.applied ? Math.max(0, Number(pkg.price) - coupon.discountAmount) : Number(pkg.price)) + cartAddonTotal;
      const gstAmount = gstConfig?.enabled ? (baseTotal * (gstConfig.percentage / 100)) : 0;
      const finalTotal = baseTotal + gstAmount;

      let finalRef = '—';
      if (payMode === 'Cash') {
        finalRef = cashAmt ? String(cashAmt) : String(finalTotal);
      } else if (payMode === 'Online (Razorpay)') {
        finalRef = onlinePayRef || String(finalTotal);
      } else {
        finalRef = payRef ? String(payRef) : `REF-${Math.floor(100000 + Math.random() * 900000)}`;
      }

      let finalLat = parseFloat(activeJob.geo?.lat || 0);
      let finalLng = parseFloat(activeJob.geo?.lng || 0);
      let finalLocationName = activeJob.locationName || null;

      try {
        const p = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
        });
        finalLat = parseFloat(p.coords.latitude.toFixed(5));
        finalLng = parseFloat(p.coords.longitude.toFixed(5));
        const name = await reverseGeocode(finalLat, finalLng);
        if (name) finalLocationName = name;
      } catch (e) {
        // silently fallback to activeJob's geo
      }

      const tempInv = {
        id: 'PENDING', date: new Date().toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }),
        washerId: user.id, washer: user.name, washerUsername: user.username,
        branchId: activeJob.branchId, branch: activeJob.branch,
        location: (finalLat && finalLng) ? `${finalLat}, ${finalLng}` : 'N/A',
        locationName: finalLocationName, lat: finalLat, lng: finalLng,
        vehicle: activeJob.vehicle, customer: activeJob.customer, package: pkg,
        payment: {
          mode: payMode,
          ref: finalRef,
          subTotal: baseTotal,
          gst: gstConfig?.enabled ? { enabled: true, percentage: gstConfig.percentage, amount: gstAmount, number: gstConfig.number } : null
        },
        coupon: coupon?.applied ? { ...coupon } : null,
        products: cart.length > 0 ? cart : null,
        originalTotal: Number(pkg.price) + cartAddonTotal, total: finalTotal, status: 'Completed', createdAt: new Date().toISOString(),
      };

      const savedInv = await onAddSession(tempInv);
      const inv = savedInv || tempInv;
      setInvoice(inv);
      if (activeJob?.id) completePendingJob(activeJob.id);
      if (coupon?.applied && activeJob.customer.phone) API.loyalty.recordUsage(activeJob.customer.phone.trim(), coupon.code).catch(() => { });

      sendPushNotification('Invoice Created', `${inv.id} — {curr} ${inv.total}`);
      setPayStep(7);
    } catch (err) {
      alert("Failed to save invoice");
    } finally {
      setSubmitLoad(false);
    }
  };

  const finishAndReturn = () => {
    setActiveJob(null); setInvoice(null); setCoupon(null);
    setPayMode(null); setPayRef(''); setCashAmt('');
    setView('dashboard');
  };

  const handleSelectPackage = useCallback((pkg, targetBranchId = null) => {
    setSelPkg(pkg);
    if (pkg.products) {
      try {
        const parsed = JSON.parse(pkg.products);
        if (Array.isArray(parsed)) {
          const validItems = [];
          const branchToUse = targetBranchId || branchId || user?.branch_id || user?.branchId;
          const isMatchingBranch = (i) => !branchToUse || branchToUse === 'all' || String(i.branch_id || i.branchId) === String(branchToUse);

          parsed.forEach(p => {
            if (p.isCustom) return;
            let invItem = (inventory || []).find(i => isMatchingBranch(i) && String(i.id) === String(p.id));
            if (!invItem) {
              invItem = (inventory || []).find(i => isMatchingBranch(i) && i.name && p.name && i.name.toLowerCase() === p.name.toLowerCase());
            }
            if (!invItem) return;
            if (invItem.quantity > 0) {
              const packageWpu = p.quantity || 1;
              const actualWpu = invItem.washes_per_unit || 1;
              const used = invItem.used_washes || 0;
              const maxAvailableScans = Math.floor((invItem.quantity || 0) * actualWpu) - used;
              validItems.push({ id: invItem.id, originalId: p.id, name: invItem.name, price: invItem.price || invItem.cost || 0, isIncluded: true, quantity: packageWpu, package_wpu: packageWpu, maxQty: maxAvailableScans });
              if (maxAvailableScans < packageWpu) notify(`Insufficient stock for ${p.name}`, 'warn');
            } else {
              notify(`${p.name} is out of stock in inventory! Not added to checkout.`, 'error');
            }
          });
          setCart(validItems);
        }
      } catch (e) { console.error('Failed to parse package products', e); }
    } else {
      setCart([]);
    }
  }, [inventory, notify, branchId, user]);

  const startAssignedJob = (job) => {
    // Explicit inline reset of intake stages to ensure batched updates don't conflict
    setStep(1);
    setGeo(job.geo || null);
    setLocationName(job.locationName || null);
    setPhoto(null);
    setAiResult(null);

    // Explicitly prefill customer details with string fallbacks to prevent uncontrolled input warning
    const cust = job.customer || {};
    setCustomer({
      name: cust.name || '',
      phone: cust.phone || '',
      email: cust.email || ''
    });

    // Explicitly prefill vehicle details with string fallbacks
    const veh = job.vehicle || {};
    setVehicle({
      make: veh.make || '',
      model: veh.model || '',
      colour: veh.colour || '',
      plate: veh.plate || ''
    });

    setCustErrors({});
    setLoyalty(job.loyalty || null);
    setCart([]);
    setAssignedJobId(job.id);

    // Auto-fill branch if provided
    if (job.branchId) setBranchId(job.branchId);

    // Pre-fill package if it was selected by Admin
    if (job.package && job.package.id) {
      handleSelectPackage(job.package, job.branchId);
      setIsPackageLocked(true);
    } else {
      setIsPackageLocked(false);
    }

    setView('intake');

    // Update it so the admin can track it's in progress
    updatePendingJob(job.id, { status: 'in_progress' }).catch(err => {
      console.warn("Could not mark job in progress:", err);
    });
  };

  const allMyJobs = pendingJobs.filter(j => (j.washerId || j.washer_id) === user.id);
  const myAssignedJobs = allMyJobs.filter(j => j.status === 'assigned');
  const myPendingJobs = allMyJobs.filter(j => j.status !== 'assigned');
  const [confirmCashModal, setConfirmCashModal] = useState(false);
  const cartAddonTotal = cart.reduce((sum, p) => sum + (p.isIncluded ? 0 : Number(p.price || 0) * Number(p.quantity || 1)), 0);
  const baseTotal = (coupon?.applied ? Math.max(0, Number(activeJob?.package?.price || 0) - coupon.discountAmount) : Number(activeJob?.package?.price || 0)) + cartAddonTotal;
  const gstAmount = gstConfig?.enabled ? (baseTotal * (gstConfig.percentage / 100)) : 0;
  const effectiveTotal = baseTotal + gstAmount;

  const getQuantityMismatchError = () => {
    const pkg = activeJob?.package;
    if (!pkg || !pkg.products) return null;
    try {
      const parsed = JSON.parse(pkg.products);
      if (!Array.isArray(parsed)) return null;

      let totalCustomRequired = 0;
      let totalCustomFulfilled = 0;

      // Track how much of each cart item is used to fulfill specific requirements
      const cartUsage = {};
      cart.forEach(c => {
        if (c.isIncluded) cartUsage[c.cartId] = 0;
      });

      for (const p of parsed) {
        if (p.isCustom) {
          totalCustomRequired += 1;
          continue;
        }

        // Specific product requirement
        const cartItem = cart.find(c => c.isIncluded && (String(c.id) === String(p.id) || String(c.originalId) === String(p.id) || (c.name && c.name.toLowerCase() === p.name?.toLowerCase())));
        const requiredQty = 1;
        const actualQty = cartItem ? cartItem.quantity : 0;

        if (actualQty < requiredQty) {
          return `Missing ${p.name}: Please scan the product to continue.`;
        }

        if (cartItem) {
          cartUsage[cartItem.cartId] += requiredQty;
        }

        // Check inventory stock if it's a specific product that we know about
        const branchToUse = activeJob?.branchId || branchId || user?.branch_id || user?.branchId;
        const isMatchingBranch = (i) => !branchToUse || branchToUse === 'all' || String(i.branch_id || i.branchId) === String(branchToUse);

        let invItem = (inventory || []).find(i => isMatchingBranch(i) && String(i.id) === String(p.id));
        if (!invItem) invItem = (inventory || []).find(i => isMatchingBranch(i) && i.name && p.name && i.name.toLowerCase() === p.name.toLowerCase());

        if (invItem) {
          const wpu = invItem.washes_per_unit || 1;
          const used = invItem.used_washes || 0;
          const maxAvailableScans = Math.floor((invItem.quantity || 0) * wpu) - used;
          if (maxAvailableScans < requiredQty) {
            return `Insufficient stock for ${p.name}: inventory has ${maxAvailableScans} scans available, but package requires ${requiredQty}.`;
          }
        }
      }

      // Now calculate how many extra retail items were scanned to fulfill custom placeholders
      cart.forEach(c => {
        if (c.isIncluded) {
          const used = cartUsage[c.cartId] || 0;
          const availableForCustom = c.quantity - used;
          if (availableForCustom > 0) {
            totalCustomFulfilled += availableForCustom;
          }
        }
      });

      if (totalCustomFulfilled < totalCustomRequired) {
        return `Package requires you to select ${totalCustomRequired} retail product(s), but you have only selected ${totalCustomFulfilled}. Please scan a retail product to continue.`;
      }

    } catch (e) {
      console.error(e);
    }
    return null;
  };

  const getParsedQr = () => {
    try {
      if (!branchQrLabel || branchQrLabel === 'Payment') return { upi_id: '', payee_name: 'WashPro Payment', enabled: true };
      if (typeof branchQrLabel === 'object') return { upi_id: branchQrLabel?.upi_id || '', payee_name: branchQrLabel?.payee_name || 'WashPro Payment', enabled: branchQrLabel?.enabled === true };
      if (typeof branchQrLabel === 'string') {
        try {
          const parsed = JSON.parse(branchQrLabel);
          return { upi_id: parsed?.upi_id || '', payee_name: parsed?.payee_name || 'WashPro Payment', enabled: parsed?.enabled === true };
        } catch (e) {
          return { upi_id: typeof branchQrLabel.trim === 'function' ? branchQrLabel.trim() : '', payee_name: 'WashPro Payment', enabled: false };
        }
      }
      return { upi_id: '', payee_name: 'WashPro Payment', enabled: false };
    } catch (err) {
      console.warn("Error parsing QR:", err);
      return { upi_id: '', payee_name: 'WashPro Payment', enabled: false };
    }
  };
  const parsedQr = getParsedQr();
  const hasValidQrSetting = Boolean(parsedQr.upi_id && parsedQr.enabled);

  const myActiveBranch = branches?.find(b => b.id === (user?.branch_id || user?.branchId));
  const isExpired = myActiveBranch?.expiry_date ? new Date(myActiveBranch.expiry_date) < new Date() : false;
  const mySessions = (sessions || []).filter(s => String(s.branchId) === String(myActiveBranch?.id));
  const limitReached = myActiveBranch?.max_sessions > 0 && mySessions.length >= myActiveBranch?.max_sessions;
  const isBlocked = isExpired || limitReached || user?.is_locked;

  const myWasherSessions = (sessions || []).filter(s => (s.washerId || s.washer_id) === user.id);
  const filteredSessions = myWasherSessions.filter(s => {
    const d = new Date(s.createdAt || s.date);
    if (isNaN(d.getTime())) return false;
    
    if (filterType === 'month') {
      return d.getMonth() === historyMonth && d.getFullYear() === historyYear;
    } else {
      const start = historyStartDate ? new Date(historyStartDate) : null;
      const end = historyEndDate ? new Date(historyEndDate) : null;
      
      if (end) {
        end.setHours(23, 59, 59, 999);
      }
      
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    }
  });
  const totalCompleted = filteredSessions.length;
  const recentHistory = filteredSessions; // show all for the selected filter

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <>
      {user?.is_locked && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }}>
          <img src={isDark ? logoDark : logoLight} alt="WashPro" style={{ width: 140, marginBottom: 30 }} />
          <div style={{ background: 'var(--red)', width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 30 }}>🔒</span>
          </div>
          <h2 style={{ margin: '0 0 10px', color: 'var(--text)', fontSize: 24, fontWeight: 800 }}>Account Locked</h2>
          <p style={{ margin: '0 0 30px', color: 'var(--text-2)', fontSize: 15, maxWidth: 400, lineHeight: 1.5 }}>
            Your access is currently restricted because your branch has exceeded its subscription limit for the number of active washers. Please contact your branch administrator to upgrade the plan or free up a slot.
          </p>
          <Btn variant="danger" onClick={onLogout}>Sign Out</Btn>
        </div>
      )}
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', filter: user?.is_locked ? 'blur(10px)' : 'none', pointerEvents: user?.is_locked ? 'none' : 'auto' }}>

        {/* ── Header ── */}
        <header style={{
          background: 'var(--bg-2)', borderBottom: '1px solid var(--border)',
          padding: '0 20px', height: 58, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100,
        }}>
          {/* Left: Back Button & Menu */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, zIndex: 10, position: 'relative' }}>
            <button onClick={() => setShowMenu(!showMenu)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text)', display: 'flex', alignItems: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>


            {showMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowMenu(false)} />
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 8, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, minWidth: 200, zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                  <div style={{ padding: '0 8px 12px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{user.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Worker</div>
                  </div>

                  <button onClick={onLogout} style={{ width: '100%', background: 'rgba(218,26,49,0.07)', border: 'none', borderRadius: 8, padding: '10px 8px', fontSize: 13, fontWeight: 600, color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
                    Sign out
                  </button>
                </div>
              </>
            )}

          </div>

          {/* Center: Logo */}
          <div className="logo-typo" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 5 }}>
            <img src={isDark ? logoDark : logoLight} alt="Smart Garage" style={{ height: '36px', width: 'auto', objectFit: 'contain', pointerEvents: 'auto' }} />
          </div>

          {/* Right: Theme Toggle */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, position: 'relative', zIndex: 10 }}>
            <NotificationsDropdown user={user} pendingJobs={pendingJobs} jobRequests={availableRequests} onNav={setView} onTakeJob={handleTakeJob} />
            <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
          </div>
        </header>

        {/* ════════════════════════════════════════════════════
          DASHBOARD
      ════════════════════════════════════════════════════ */}
        {view === 'dashboard' && (
            <div style={{ flex: 1, maxWidth: 540, width: '100%', margin: '0 auto', padding: '24px 16px 48px', boxSizing: 'border-box' }} className="page-enter">

              {/* Stats Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px', boxShadow: 'var(--shadow)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Total Completed</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{totalCompleted}</div>
                </div>
                <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)', borderRadius: 14, padding: '16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Active Jobs</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.02em' }}>{myPendingJobs.length + myAssignedJobs.length}</div>
                </div>
              </div>
              {/* Pending jobs */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>Pending Jobs</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{myPendingJobs.length} active</div>
              </div>

              {myPendingJobs.length === 0 ? (
                <div style={{ background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: 14, padding: '40px 20px', textAlign: 'center', marginBottom: 24 }}>
                  <div style={{ fontSize: 32, marginBottom: 10, display: 'flex', justifyContent: 'center' }}> <img src={SoapIcon} alt="" style={{ width: 36, height: 36, opacity: 0.8 }} /> </div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-2)', marginBottom: 4 }}>No pending jobs</div>
                  <div style={{ fontSize: 13, color: 'var(--text-3)' }}>There are no active jobs waiting for payment</div>
                </div>
              ) : (
                <div style={{ marginBottom: 24 }}>
                  {myPendingJobs.map(job => (
                    <JobCard key={job.id} job={job} onView={() => {
                      if (job.status === 'in_progress' && (!job.geo || !job.package)) {
                        if (isBlocked) {
                          notify(`Branch plan is ${isExpired ? 'expired' : 'over its session limit'}. Cannot start job.`, 'error');
                          return;
                        }
                        startAssignedJob(job);
                      } else {
                        openPayment(job);
                      }
                    }} isBlocked={isBlocked} />
                  ))}
                </div>
              )}

              {/* Assigned jobs */}
              {myAssignedJobs.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>Assigned to You</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{myAssignedJobs.length} new</div>
                  </div>
                  {myAssignedJobs.map(job => (
                    <div key={job.id} style={{ background: 'var(--card)', border: '2px solid var(--accent)', borderRadius: 14, padding: '16px', marginBottom: 12, boxShadow: '0 4px 14px var(--accent-dim)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', letterSpacing: '-0.01em' }}>{job.customer?.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{job.customer?.phone}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em', background: 'var(--accent-dim)', padding: '4px 8px', borderRadius: 6, marginBottom: 4 }}>New Assignment</div>
                          {job.submittedAt && (
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {(() => {
                                const el = Math.round((Date.now() - new Date(job.submittedAt).getTime()) / 60000);
                                return el < 60 ? `${el}m ago` : `${Math.floor(el / 60)}h ${el % 60}m ago`;
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                      {(job.vehicle?.make || job.vehicle?.model || job.vehicle?.plate) ? (
                        <div style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 0 }}>
                            {job.vehicle?.make} {job.vehicle?.model} {job.vehicle?.plate ? `(${job.vehicle.plate})` : ''}
                          </div>
                        </div>
                      ) : (
                        <div style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontStyle: 'italic', color: 'var(--text-3)', fontSize: 13 }}>
                          Vehicle details not provided
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>Package:</span>
                          {job.package?.name && job.package?.name !== "To be decided" ? (
                            <span style={{ background: `${job.package.color || 'var(--accent)'}15`, color: job.package.color || 'var(--accent)', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                              {job.package.name}
                            </span>
                          ) : (
                            <span style={{ fontStyle: 'italic', color: 'var(--text-3)', fontSize: 12 }}>
                              To be decided
                            </span>
                          )}
                        </div>
                        {(() => {
                          if (job.products) {
                            try {
                              const parsed = typeof job.products === 'string' ? JSON.parse(job.products) : job.products;
                              if (Array.isArray(parsed) && parsed.length > 0) {
                                return (
                                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 62 }}>
                                    Includes: {parsed.map(p => `${p.name} (x${p.quantity})`).join(', ')}
                                  </div>
                                );
                              }
                            } catch(e) {}
                          }
                          return null;
                        })()}
                      </div>

                      {job.locationName && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}><img src={mapIcon} alt="" style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} />{job.locationName}</div>
                      )}
                      <button onClick={() => {
                        if (isBlocked) {
                          notify(`Branch plan is ${isExpired ? 'expired' : 'over its session limit'}. Cannot start jobs.`, "error");
                          return;
                        }
                        startAssignedJob(job);
                      }}
                        style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: isBlocked ? 'var(--bg-3)' : 'var(--accent)', color: isBlocked ? 'var(--text-3)' : '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: isBlocked ? 'not-allowed' : 'pointer', letterSpacing: '-0.01em' }}>
                        Fill Stages to Start
                      </button>
                    </div>
                  ))}
                </div>
              )}

                            <button onClick={() => {
                if (isBlocked) {
                  notify(user?.is_locked ? 'Your account is locked due to branch washer limits.' : `Branch plan is ${isExpired ? 'expired' : 'over its session limit'}. Cannot start new wash.`, 'error');
                  return;
                }
                resetIntake();
                setView('intake');
              }}
                style={{
                  width: '100%', padding: '18px 24px', borderRadius: 14, border: 'none',
                  background: isBlocked ? 'var(--bg-3)' : 'var(--accent)', color: isBlocked ? 'var(--text-3)' : '#fff', cursor: isBlocked ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 24, fontFamily: 'inherit',
                  boxShadow: isBlocked ? 'none' : '0 4px 14px var(--accent-dim)',
                }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 2 }}>Start New Job</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Intake → Job → Payment</div>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  +
                </div>
              </button>

              {/* History Button */}
              <button onClick={() => setView('history')}
                style={{
                  width: '100%', padding: '16px', borderRadius: 12, border: '1px solid var(--border)',
                  background: 'var(--card)', color: 'var(--text)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit', fontSize: 15, fontWeight: 600, transition: 'all 0.2s',
                }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                View History
              </button>

              {/* Available Public Job Requests */}
              {availableRequests.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>Available Public Requests</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{availableRequests.length} new</div>
                  </div>
                  {availableRequests.map(req => (
                    <div key={req.id} style={{ background: 'var(--card)', border: '2px solid var(--accent-2)', borderRadius: 14, padding: '16px', marginBottom: 12, boxShadow: '0 4px 14px rgba(139, 92, 246, 0.15)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', letterSpacing: '-0.01em' }}>{req.customerName}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{req.customerPhone}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: '0.04em', background: 'rgba(139, 92, 246, 0.1)', padding: '4px 8px', borderRadius: 6 }}>Unassigned</div>
                        </div>
                      </div>
                      {req.address && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}><img src={mapIcon} alt="" style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} />{req.address}</div>
                      )}
                      
                      {req.packageId && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>Package:</span>
                            <span style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-2)', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                              {packages.find(p => p.id === req.packageId)?.name || 'Selected'}
                            </span>
                          </div>
                          {(() => {
                            const pkg = packages.find(p => p.id === req.packageId);
                            if (pkg && pkg.products) {
                              try {
                                const parsed = typeof pkg.products === 'string' ? JSON.parse(pkg.products) : pkg.products;
                                if (Array.isArray(parsed) && parsed.length > 0) {
                                  return (
                                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 62 }}>
                                      Includes: {parsed.map(p => `${p.name} (x${p.quantity})`).join(', ')}
                                    </div>
                                  );
                                }
                              } catch(e) {}
                            }
                            return null;
                          })()}
                        </div>
                      )}

                      <button onClick={() => {
                        if (isBlocked) {
                          notify(`Branch plan is ${isExpired ? 'expired' : 'over its session limit'}. Cannot take jobs.`, "error");
                          return;
                        }
                        handleTakeJob(req.id);
                      }}
                        disabled={!!takingJobId}
                        style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: isBlocked ? 'var(--bg-3)' : 'var(--accent-2)', color: isBlocked ? 'var(--text-3)' : '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: isBlocked || takingJobId ? 'not-allowed' : 'pointer', letterSpacing: '-0.01em', transition: 'background 0.2s' }}>
                        {takingJobId === req.id ? 'Taking...' : 'Take Job'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* New job CTA */}
              {isBlocked && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)', borderRadius: 12, padding: '16px 20px', marginBottom: 22 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--red)', marginBottom: 4 }}>{user?.is_locked ? 'Account Locked!' : isExpired ? 'Plan Expired!' : 'Session Limit Reached!'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{user?.is_locked ? 'Your branch has exceeded its active washer limit.' : `The subscription plan for this branch is ${isExpired ? 'expired' : 'over its session limit'}.`} You cannot start new jobs until the Admin updates the plan.</div>
                </div>
              )}


            </div>
        )}

        {/* ════════════════════════════════════════════════════
          HISTORY VIEW
      ════════════════════════════════════════════════════ */}
        {view === 'history' && (
          <div style={{ flex: 1, maxWidth: 540, width: '100%', margin: '0 auto', padding: '24px 16px 48px', boxSizing: 'border-box' }} className="page-enter">
            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 24 }}>
              <button onClick={() => setView('dashboard')}
                style={{
                  background: 'none', border: 'none',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.2s', padding: 4, width: 'fit-content'
                }}
              >
                <img src={backArrow} alt="Back" style={{ width: 24, height: 24 }} />
              </button>
              <div style={{ fontSize: 18, fontWeight: 700, marginLeft: 12, color: 'var(--text)' }}>History</div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button 
                onClick={() => setFilterType('month')}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: filterType === 'month' ? 'var(--accent)' : 'var(--card)', color: filterType === 'month' ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 13, flex: 1, fontWeight: 600, transition: 'all 0.2s' }}
              >Month Filter</button>
              <button 
                onClick={() => setFilterType('custom')}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: filterType === 'custom' ? 'var(--accent)' : 'var(--card)', color: filterType === 'custom' ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 13, flex: 1, fontWeight: 600, transition: 'all 0.2s' }}
              >Custom Date</button>
            </div>

            {filterType === 'month' ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <Dropdown
                  value={historyMonth}
                  onChange={v => setHistoryMonth(Number(v))}
                  options={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => ({ value: i, label: m }))}
                  style={{ flex: 1 }}
                />
                <Dropdown
                  value={historyYear}
                  onChange={v => setHistoryYear(Number(v))}
                  options={Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => ({ value: y, label: y.toString() }))}
                  style={{ flex: 1 }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Date</div>
                  <Inp type="date" value={historyStartDate} onChange={e => setHistoryStartDate(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>End Date</div>
                  <Inp type="date" value={historyEndDate} onChange={e => setHistoryEndDate(e.target.value)} />
                </div>
              </div>
            )}

            {recentHistory.length > 0 ? (
              recentHistory.map(job => (
                <div key={job.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{job.vehicle?.plate || job.vehicle?.model || 'Vehicle'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{job.package?.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--green)' }}>{curr} {Number(job.total || 0).toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{job.date ? job.date.split(',')[0] : 'N/A'}</div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-3)', fontSize: 14, background: 'var(--bg-3)', borderRadius: 12 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: 12 }}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <div style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>No History Found</div>
                <div style={{ fontSize: 13 }}>No jobs found for this month.</div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════
          NOTIFICATIONS VIEW
      ════════════════════════════════════════════════════ */}
        {view === 'notifications' && (
          <div style={{ flex: 1, maxWidth: 540, width: '100%', margin: '0 auto', boxSizing: 'border-box' }} className="page-enter">
            <div style={{ padding: '24px 16px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 8 }}>
                <button onClick={() => setView('dashboard')}
                  style={{
                    background: 'none', border: 'none',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.2s', padding: 4, width: 'fit-content'
                  }}
                >
                  <img src={backArrow} alt="Back" style={{ width: 24, height: 24 }} />
                </button>
              </div>
            </div>
            
            <div style={{ marginTop: '-20px' }}>
               <NotificationsPage user={user} pendingJobs={pendingJobs} jobRequests={availableRequests} onNav={setView} />
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
          INTAKE (Steps 1-5)
      ════════════════════════════════════════════════════ */}
        {view === 'intake' && (
          <div style={{ flex: 1, maxWidth: 540, width: '100%', margin: '0 auto', padding: '24px 16px 48px', boxSizing: 'border-box' }} className="page-enter">
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
              <button onClick={() => {
                if (step > 1) {
                  setStep(step - 1);
                } else {
                  resetIntake();
                  setView('dashboard');
                }
              }}
                style={{
                  background: 'none', border: 'none',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.2s', padding: 4, width: 'fit-content'
                }}
              >
                <img src={backArrow} alt="Back" style={{ width: 24, height: 24 }} />
              </button>
            </div>

            {/* Branch picker */}
            {branches.length > 1 && (
              <Dropdown id="branch-select" name="branchSelect" value={branchId} onChange={v => setBranchId(v)}
                options={branches.map(b => ({ value: b.id, label: b.name }))}
                style={{ width: '100%', marginBottom: 16 }} />
            )}

            {/* Step indicator */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, gap: 0 }}>
              {STEPS.map((s, i) => (
                <React.Fragment key={s.id}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                      background: step > s.id ? 'var(--accent)' : step === s.id ? 'var(--accent-dim)' : 'var(--bg-3)',
                      color: step > s.id ? '#fff' : step === s.id ? 'var(--accent)' : 'var(--text-3)',
                      border: step === s.id ? '2px solid var(--accent)' : step > s.id ? 'none' : '1.5px solid var(--border)',
                      animation: step === s.id ? 'stepPulse 2s ease infinite' : 'none',
                    }}>
                      {step > s.id ? '✓' : s.id}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: step === s.id ? 700 : 400, color: step === s.id ? 'var(--accent)' : 'var(--text-3)', letterSpacing: '0.02em' }}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ flex: 1, height: 2, background: step > s.id ? 'var(--accent)' : 'var(--border)', margin: '0 2px', marginBottom: 20, transition: 'background 0.3s' }} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* ── Step 1: GPS ── */}
            {step === 1 && (
              <WCard title="Capture Location" sub="Tag this session with your GPS location">
                {!geo ? (
                  <Btn full size="lg" onClick={captureGeo} disabled={geoLoad}>
                    {geoLoad ? 'Acquiring GPS...' : <><img src={mapIcon} alt="" style={{ width: 18, height: 18, marginRight: 6, verticalAlign: 'middle' }} /> Get My Location</>}
                  </Btn>
                ) : (
                  <>
                    <SuccessBox>Location captured{geo.simulated ? ' (demo)' : ''}!</SuccessBox>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Address / Location Details</label>
                      <textarea 
                        value={locationName || ''} 
                        onChange={e => setLocationName(e.target.value)}
                        placeholder="Enter full address or building details..."
                        rows={3}
                        style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
                      />
                    </div>
                    {geo && (
                      <div style={{ borderRadius: 9, overflow: 'hidden', marginBottom: 12, border: '1px solid var(--border)', height: 160, position: 'relative', background: 'var(--bg-3)' }}>
                        <iframe
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          style={{ border: 0, position: 'absolute', inset: 0 }}
                          src={`https://maps.google.com/maps?q=${parseFloat(geo.lat)},${parseFloat(geo.lng)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                          allowFullScreen
                          title="Live GPS Location"
                        ></iframe>
                      </div>
                    )}
                    <DataRow label="Coordinates" value={`${geo.lat}, ${geo.lng}`} />
                    <DataRow label="Accuracy" value={`±${geo.accuracy}m`} />
                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                      <Btn full size="lg" onClick={() => setStep(2)}>Next →</Btn>
                      <Btn variant="ghost" size="lg" onClick={() => { setGeo(null); setLocationName(null); }}>Redo</Btn>
                    </div>
                  </>
                )}
              </WCard>
            )}

            {/* ── Step 2: Camera ── */}
            {step === 2 && (
              <WCard title="Vehicle Photo" sub="Photograph the vehicle for AI recognition">
                {!photo ? (
                  <>
                    {camActive && (
                      <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 12, background: '#000', position: 'relative', aspectRatio: '4/3' }}>
                        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        <div style={{ position: 'absolute', inset: 0, border: '2px solid var(--accent)', borderRadius: 12, pointerEvents: 'none' }} />
                      </div>
                    )}
                    {camActive
                      ? (
                        <div style={{ display: 'flex', gap: 10 }}>
                          <Btn full size="lg" onClick={capturePhoto}>Capture</Btn>
                          <Btn variant="ghost" size="lg" onClick={stopCamera}>Cancel</Btn>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <Btn full size="lg" onClick={startCamera}>Open Camera</Btn>
                          <Btn full variant="secondary" size="lg" onClick={() => fileRef.current?.click()}>Upload from Gallery</Btn>
                          <input ref={fileRef} id="photo-upload" name="photo-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
                        </div>
                      )
                    }
                  </>
                ) : (
                  <>
                    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                      <img src={photo.dataUrl} alt="Vehicle" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '20px 12px 10px', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>
                        <span>{locationName || `${geo?.lat}, ${geo?.lng}`}</span>
                        <span>{new Date(photo.timestamp).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <SuccessBox>Photo geo-tagged successfully</SuccessBox>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Btn full size="lg" onClick={() => setStep(3)}>Analyse with AI →</Btn>
                      <Btn variant="ghost" size="lg" onClick={() => { setPhoto(null); setAiResult(null); }}>Retake</Btn>
                    </div>
                  </>
                )}
              </WCard>
            )}

            {/* ── Step 3: AI Scan ── */}
            {step === 3 && (
              <WCard title="AI Recognition" sub="Auto-detect make, model, colour and plate">
                {!aiResult && !aiLoad && (
                  <>
                    <img src={photo?.dataUrl} alt="Vehicle" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10, marginBottom: 16, opacity: 0.9 }} />
                    <Btn full size="lg" onClick={runAI}>Run AI Analysis</Btn>
                  </>
                )}

                {aiLoad && (
                  <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', margin: '0 auto 18px', animation: 'spin 0.8s linear infinite' }} />
                    <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15, marginBottom: 6 }}>Analysing vehicle...</div>
                    <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Reading make, model, colour and plate</div>
                  </div>
                )}

                {aiResult && !aiLoad && (
                  <>
                    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Detection Result</div>
                      {[['Make', aiResult.make], ['Model', aiResult.model], ['Colour', aiResult.colour], ['Plate', aiResult.plate === 'Not Visible' ? '— Not detected' : aiResult.plate]].map(([l, v]) => (
                        <DataRow key={l} label={l} value={v} />
                      ))}
                      <div style={{ marginTop: 12, background: 'var(--highlight-dim)', border: '1px solid rgba(25,103,210,0.2)', borderRadius: 8, padding: '8px 11px', fontSize: 12, color: '#1967D2' }}>
                        AI-powered detection — please review details carefully before continuing
                      </div>
                      {aiResult.plate === 'Not Visible' && (
                        <div style={{ marginTop: 10, background: 'var(--highlight-dim)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 8, padding: '8px 11px', fontSize: 12, color: 'var(--highlight)' }}>
                          Plate not detected — enter manually in next step
                        </div>
                      )}
                    </div>
                    <Btn full size="lg" onClick={() => setStep(4)}>Confirm Details →</Btn>
                  </>
                )}
              </WCard>
            )}

            {/* ── Step 4: Details ── */}
            {step === 4 && (
              <WCard title="Vehicle & Customer" sub="Review AI results and complete customer info">

                <SLabel>Vehicle</SLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
                  {[['make', 'Brand', 'e.g. Toyota'], ['model', 'Model', 'e.g. Hilux'], ['colour', 'Colour', 'e.g. White'], ['plate', 'Plate No.', 'e.g. WKL 1234']].map(([f, label, ph]) => (
                    <div key={f} style={f === 'plate' ? { gridColumn: '1 / -1' } : {}}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5 }}>{label}</div>
                      <input type="text" id={`vehicle-${f}`} name={`vehicle-${f}`} placeholder={ph} value={vehicle[f]} onChange={e => setVehicle(v => ({ ...v, [f]: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-3)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                    </div>
                  ))}
                </div>

                <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />
                <SLabel>Customer</SLabel>

                {[
                  ['name', 'Full Name *', 'text', true],
                  ['phone', 'Phone Number *', 'tel', true],
                  ['email', 'Email (optional)', 'email', false],
                ].map(([f, label, type, req]) => {
                  const isPhone = f === 'phone';
                  if (isPhone) {
                    return (
                      <div key={f}>
                        <PhoneInp
                          label={label}
                          error={custErrors[f]}
                          value={customer[f]}
                          onChange={e => setCustomer(c => ({ ...c, [f]: e.target.value }))}
                          placeholder={label}
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={f}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: custErrors[f] ? 'var(--red)' : 'var(--text-3)', marginBottom: 5 }}>{label}</div>
                      <input type={type} id={`customer-${f}`} name={`customer-${f}`} placeholder={label} value={customer[f]} onChange={e => setCustomer(c => ({ ...c, [f]: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-3)', border: `1.5px solid ${custErrors[f] ? 'var(--red)' : 'var(--border)'}`, borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: custErrors[f] ? 4 : 12 }} />
                      {custErrors[f] && <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 10 }}>{custErrors[f]}</div>}
                    </div>
                  )
                })}

                <Btn full size="lg" onClick={validateAndProceed} style={{ marginTop: 4 }}>Choose Package →</Btn>
              </WCard>
            )}

            {/* ── Step 5: Package ── */}
            {step === 5 && (
              <WCard title="Select Package" sub={`${vehicle.colour} ${vehicle.make} ${vehicle.model}${vehicle.plate ? ' · ' + vehicle.plate : ''}`}>

                {loyalty?.eligible && (
                  <div style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--green)', marginBottom: 3 }}> <img src={trophyIcon} alt="" style={{ width: '16px', height: '16px', marginRight: '4px' }} /> Loyalty Reward Available</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{loyalty.cfg?.alertMessage}</div>
                  </div>
                )}
                {loyalty && !loyalty.eligible && loyalty.needed && (
                  <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--text-2)' }}>
                    {customer.name} needs {loyalty.needed} more {loyalty.needed === 1 ? 'visit' : 'visits'} to earn a reward
                  </div>
                )}

                {isPackageLocked && (
                  <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--text-2)' }}>
                    Package was pre-selected by Admin and cannot be changed.
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {packages.length === 0 ? (
                    <div style={{ background: 'var(--bg-3)', border: '1px dashed var(--border)', borderRadius: 12, padding: '32px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: 28, marginBottom: 10 }}>📦</div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-2)', marginBottom: 4 }}>No packages available</div>
                      <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>Your branch admin hasn't created any wash packages yet. Please contact your admin to add packages.</div>
                    </div>
                  ) : packages.map(pkg => (
                    <button key={pkg.id} onClick={() => { if (!isPackageLocked) handleSelectPackage(pkg); }}
                      style={{
                        width: '100%', padding: '14px 16px', borderRadius: 12, cursor: isPackageLocked ? 'not-allowed' : 'pointer', fontFamily: 'inherit', textAlign: 'left',
                        border: `2px solid ${selPkg?.id === pkg.id ? pkg.color : 'var(--border)'}`,
                        background: selPkg?.id === pkg.id ? `${pkg.color}0a` : 'var(--card)',
                        opacity: isPackageLocked && selPkg?.id !== pkg.id ? 0.5 : 1,
                        transition: 'all 0.15s',
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{pkg.name}</span>
                        <span style={{ fontWeight: 800, fontSize: 18, color: pkg.color }}>{curr} {pkg.price}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>{pkg.desc}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ background: `${pkg.color}14`, color: pkg.color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>⏱ {pkg.time}</span>
                        {selPkg?.id === pkg.id && <span style={{ background: 'rgba(5,150,105,0.1)', color: 'var(--green)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>✓ Selected</span>}
                      </div>
                    </button>
                  ))}
                </div>

                {selPkg && (
                  <div style={{ marginBottom: 24 }}>
                    {/* Added Products (Unified) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Added Products</div>
                    </div>
                    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                      {cart.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {cart.map(p => (
                            <div key={p.cartId || p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{p.name} {p.isIncluded && '(Included)'}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
                                  <button onClick={() => updateCartQty(p.cartId || p.id, -1)} style={{ background: 'none', border: 'none', color: 'var(--text)', padding: '2px 8px', cursor: 'pointer', fontSize: 14 }}>-</button>
                                  <span style={{ fontSize: 13, fontWeight: 600, width: 20, textAlign: 'center' }}>{p.quantity || 1}</span>
                                  <button onClick={() => updateCartQty(p.cartId || p.id, 1)} style={{ background: 'none', border: 'none', color: 'var(--text)', padding: '2px 8px', cursor: 'pointer', fontSize: 14 }}>+</button>
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', minWidth: 60, textAlign: 'right' }}>
                                  {p.isIncluded ? 'Included' : `${curr} ${(p.price || 0) * (p.quantity || 1)}`}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 8, marginTop: cart.length > 0 ? 16 : 0 }}>
                        <Btn variant="danger" size="sm" onClick={() => { setScanType('retail'); setShowScannerModal(true); }}>+ Scan Retail</Btn>
                        <Btn variant="danger" size="sm" onClick={() => { setScanType('addon'); setShowScannerModal(true); }}>+ Scan Addon</Btn>
                      </div>

                    </div>
                  </div>
                )}

                {/* Amount display for Intake Stage */}
                {selPkg && (
                  <div style={{ textAlign: 'center', marginBottom: 20, padding: '20px', background: 'var(--accent-dim)', borderRadius: 12, border: '1px solid var(--accent-glow)' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>Estimated Total</div>
                    <div style={{ fontSize: 42, fontWeight: 900, color: 'var(--accent)', letterSpacing: '-0.04em', lineHeight: 1 }}>
                      {curr} {(
                        (Number(selPkg.price || 0) + cartAddonTotal) + 
                        (gstConfig?.enabled ? ((Number(selPkg.price || 0) + cartAddonTotal) * (gstConfig.percentage / 100)) : 0)
                      ).toFixed(2)}
                    </div>

                    {gstConfig?.enabled && (
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', justifyContent: 'space-between', width: '180px' }}>
                          <span>Subtotal:</span>
                          <span>{curr} {(Number(selPkg.price || 0) + cartAddonTotal).toFixed(2)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', justifyContent: 'space-between', width: '180px' }}>
                          <span>GST ({gstConfig.percentage}%):</span>
                          <span>{curr} {((Number(selPkg.price || 0) + cartAddonTotal) * (gstConfig.percentage / 100)).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button onClick={submitJob}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 11, border: 'none',
                    background: selPkg ? 'var(--accent)' : 'var(--bg-3)',
                    color: selPkg ? '#fff' : 'var(--text-3)',
                    fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: selPkg ? 'pointer' : 'not-allowed',
                    boxShadow: selPkg ? '0 4px 14px var(--accent-dim)' : 'none', transition: 'all 0.2s',
                  }}>
                  Submit Job
                </button>
              </WCard>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════
          PAYMENT (Steps 6-7)
      ════════════════════════════════════════════════════ */}
        {view === 'payment' && !activeJob && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 100 }}>
            <img src={JobIcon} alt="" style={{ display: 'block', width: 48, height: 48, opacity: 0.5, marginBottom: 16 }} />
            <div style={{ fontSize: 16, color: 'var(--text-2)', fontWeight: 600 }}>No active job selected.</div>
            <Btn style={{ marginTop: 20 }} onClick={() => setView('dashboard')}>Go to Dashboard</Btn>
          </div>
        )}

        {view === 'payment' && activeJob && (
          <div style={{ flex: 1, maxWidth: 540, width: '100%', margin: '0 auto', padding: '24px 16px 48px', boxSizing: 'border-box' }} className="page-enter">

            {/* Step 6: Payment */}
            {payStep === 6 && (
              <WCard title="Collect Payment" sub={`${activeJob.customer.name} · ${activeJob.vehicle.make} ${activeJob.vehicle.model}`}>

                {/* Job recap */}
                <div style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
                  {[['Customer', activeJob.customer.name], ['Phone', activeJob.customer.phone], ['Vehicle', `${activeJob.vehicle.colour} ${activeJob.vehicle.make} ${activeJob.vehicle.model}`], ['Plate', activeJob.vehicle.plate || '—'], ['Package', activeJob.package.name], ['Duration', activeJob.package.time]].map(([l, v]) => (
                    <DataRow key={l} label={l} value={v} />
                  ))}

                  {/* Cart Items Recap & Editing */}
                  {cart.length > 0 && (
                    <div style={{ marginTop: 12, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 6 }}>Added Products</div>
                      {cart.map(p => (
                        <div key={p.cartId || p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{p.name} {p.isIncluded && '(Included)'}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
                              <button onClick={() => updateCartQty(p.cartId || p.id, -1)} style={{ background: 'none', border: 'none', color: 'var(--text)', padding: '2px 8px', cursor: 'pointer', fontSize: 14 }}>-</button>
                              <span style={{ fontSize: 13, fontWeight: 600, width: 20, textAlign: 'center' }}>{p.quantity || 1}</span>
                              <button onClick={() => updateCartQty(p.cartId || p.id, 1)} style={{ background: 'none', border: 'none', color: 'var(--text)', padding: '2px 8px', cursor: 'pointer', fontSize: 14 }}>+</button>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', minWidth: 60, textAlign: 'right' }}>
                              {p.isIncluded ? 'Included' : `${curr} ${(p.price || 0) * (p.quantity || 1)}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <Btn size="sm" onClick={() => { setScanType('retail'); setShowScannerModal(true); }}>+ Scan Retail</Btn>
                    <Btn size="sm" onClick={() => { setScanType('addon'); setShowScannerModal(true); }}>+ Scan Addon</Btn>
                  </div>
                </div>

                {/* Amount display */}
                <div style={{ textAlign: 'center', marginBottom: 20, padding: '20px', background: 'var(--accent-dim)', borderRadius: 12, border: '1px solid var(--accent-glow)' }}>
                  {coupon?.applied ? (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'line-through', marginBottom: 4 }}>{curr} {(activeJob.package.price + cartAddonTotal).toFixed(2)}</div>
                      <div style={{ fontSize: 42, fontWeight: 900, color: 'var(--accent)', letterSpacing: '-0.04em', lineHeight: 1 }}>{curr} {effectiveTotal.toFixed(2)}</div>
                      <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 6, fontWeight: 600 }}>Saved {curr} {coupon.discountAmount.toFixed(2)} with loyalty coupon</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 42, fontWeight: 900, color: 'var(--accent)', letterSpacing: '-0.04em', lineHeight: 1 }}>{curr} {effectiveTotal.toFixed(2)}</div>
                  )}

                  {gstConfig?.enabled && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', justifyContent: 'space-between', width: '180px' }}>
                        <span>Subtotal:</span>
                        <span>{curr} {baseTotal.toFixed(2)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', justifyContent: 'space-between', width: '180px' }}>
                        <span>GST ({gstConfig.percentage}%):</span>
                        <span>{curr} {gstAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Coupon */}
                {loyalty?.eligible && (
                  <div style={{ marginBottom: 16 }}>
                    {!coupon?.applied ? (
                      <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>{loyalty.discount?.label} Loyalty Coupon</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>{loyalty.code}</div>
                        </div>
                        <Btn variant="success" size="sm" onClick={applyCoupon}>Apply</Btn>
                      </div>
                    ) : (
                      <div style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>✓ Coupon Applied · {coupon.code}</div>
                        <Btn variant="ghost" size="sm" onClick={() => setCoupon(null)}>Remove</Btn>
                      </div>
                    )}
                  </div>
                )}

                {/* Payment method */}
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Payment Method</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {['Cash', ...(branchSubscription?.has_qr && hasValidQrSetting ? ['QR Pay'] : []), ...(razorpayConfig.key_id ? ['Dynamic QR'] : [])].map(m => (

                    <button key={m} onClick={() => setPayMode(m)}
                      style={{ flex: 1, padding: '10px 6px', borderRadius: 10, border: `2px solid ${payMode === m ? 'var(--accent)' : 'var(--border)'}`, background: payMode === m ? 'var(--accent-dim)' : 'var(--card)', color: payMode === m ? 'var(--accent)' : 'var(--text-2)', fontWeight: payMode === m ? 700 : 500, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', transition: 'all 0.15s' }}>
                      {m}
                    </button>
                  ))}
                </div>

                {payMode === 'Cash' && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Cash Received ({curr})</div>
                    <input type="number" id="cash-amt" name="cashAmt" placeholder="Enter amount" value={cashAmt} onChange={e => setCashAmt(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-3)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '11px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 10 }} />
                    {cashAmt && Number(cashAmt) >= effectiveTotal && (
                      <SuccessBox>Change: {curr} {(Number(cashAmt) - effectiveTotal).toFixed(2)}</SuccessBox>
                    )}
                  </>
                )}

                {payMode === 'QR Pay' && (() => {
                  const upiId = parsedQr.upi_id;
                  const payeeName = parsedQr.payee_name;
                  const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${effectiveTotal}`;

                  return (
                    <div style={{ textAlign: 'center', marginBottom: 16 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 10 }}>Customer scans to pay {curr} {effectiveTotal}:</div>
                      <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 12, display: 'inline-block', border: '1px solid rgba(5,150,105,0.2)' }}>
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiString)}&color=1a1a2e&bgcolor=f0fdf4`} alt="Dynamic UPI QR" style={{ display: 'block', borderRadius: 6 }} />
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <input id="pay-ref" name="payRef" placeholder="Confirmation ref" value={payRef} onChange={e => setPayRef(e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                      </div>
                    </div>
                  );
                })()}

                {payMode === 'Dynamic QR' && (
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 10 }}>Customer scans to pay {curr} {effectiveTotal}:</div>
                    {!dynamicQrUrl ? (
                      <button disabled={qrLoading} onClick={generateDynamicQr} style={{ width: '100%', padding: '14px', borderRadius: 11, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                        {qrLoading ? 'Generating QR Code...' : 'Generate Dynamic QR Code'}
                      </button>
                    ) : (
                      <div>
                        <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 12, display: 'inline-block', border: '1px solid rgba(5,150,105,0.2)' }}>
                          <img src={dynamicQrUrl} alt="Razorpay QR" style={{ width: 180, height: 180, display: 'block', borderRadius: 6 }} />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                          <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--amber)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                          Waiting for payment scan...
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(() => {
                  const isCashInvalid = payMode === 'Cash' && (!cashAmt || Number(cashAmt) < effectiveTotal);
                  const isRefMissing = (payMode === 'QR Pay') && (!payRef || payRef.trim() === '');
                  const err = getQuantityMismatchError() || 
                              (isCashInvalid ? `Entered cash amount must be at least {curr} ${effectiveTotal.toFixed(2)}` : 
                               (isRefMissing ? 'Payment Reference is mandatory' : null));
                  return (
                    <>
                      {err && (
                        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1.5px solid var(--red)', borderRadius: 10, padding: '12px', color: 'var(--red)', fontSize: 13, marginBottom: 14, fontWeight: 600, textAlign: 'left', lineHeight: 1.4 }}>
                          Blocked: {err}
                        </div>
                      )}
                      {payMode && payMode !== 'Dynamic QR' && (
                        <button
                          disabled={!!err || submitLoad}
                          onClick={generateInvoice}
                          style={{
                            width: '100%', padding: '14px', borderRadius: 11, border: 'none',
                            background: err ? 'var(--bg-3)' : 'var(--accent)', color: err ? 'var(--text-3)' : '#fff',
                            fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
                            cursor: err ? 'not-allowed' : 'pointer', marginTop: 8,
                            boxShadow: err ? 'none' : '0 4px 14px var(--accent-dim)'
                          }}
                        >
                          {submitLoad ? 'Processing...' : (payMode === 'Online (Razorpay)' ? 'Pay securely with Razorpay →' : 'Confirm & Generate Invoice →')}
                        </button>
                      )}
                    </>
                  );
                })()}
              </WCard>
            )}

            {/* Step 7: Invoice */}
            {payStep === 7 && invoice && (
              <WCard title="Invoice Generated" sub={`${invoice.id} · Saved to records`}>
                <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)', borderRadius: 12, padding: '16px', marginBottom: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 12 }}>
                    {invoice.vehicle.colour} {invoice.vehicle.make} {invoice.vehicle.model}
                    {invoice.vehicle.plate && <span style={{ color: 'var(--amber)', marginLeft: 8, fontSize: 13, fontFamily: 'monospace' }}>{invoice.vehicle.plate}</span>}
                  </div>
                  {[['Invoice No.', invoice.id], ['Date', invoice.date], ['Customer', invoice.customer?.name], ['Phone', invoice.customer?.phone], ['Package', invoice.package?.name], ['Payment', invoice.payment?.mode]].map(([l, v]) => (
                    <DataRow key={l} label={l} value={v} />
                  ))}
                  {invoice.coupon?.applied && <DataRow label="Coupon" value={`${invoice.coupon.code} (−{curr} ${invoice.coupon.discountAmount})`} />}
                  {invoice.products && invoice.products.filter(p => p.isIncluded).length > 0 && (
                    <div style={{ marginTop: 12, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.04em' }}>Retail Products</div>
                      {invoice.products.filter(p => p.isIncluded).map(p => (
                        <DataRow key={p.cartId || p.id} label={p.name} value={`Qty: ${p.quantity} · Included`} />
                      ))}
                    </div>
                  )}
                  {invoice.products && invoice.products.filter(p => !p.isIncluded).length > 0 && (
                    <div style={{ marginTop: 12, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.04em' }}>Addon Products</div>
                      {invoice.products.filter(p => !p.isIncluded).map(p => (
                        <DataRow key={p.cartId || p.id} label={p.name} value={`Qty: ${p.quantity} · {curr} ${(p.price || 0) * p.quantity}`} />
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0 0', marginTop: 12, borderTop: '1px dashed var(--border)' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Total Paid</span>
                    <span style={{ fontWeight: 900, fontSize: 28, color: 'var(--accent)', letterSpacing: '-0.03em' }}>{curr} {invoice.total}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <Btn variant="success" size="md" onClick={() => openWhatsApp(invoice.customer?.phone, { ...invoice, currency: curr })}>WhatsApp</Btn>
                  <Btn variant="ghost" size="md" disabled={pdfLoad}
                    onClick={async () => { setPdfLoad(true); await generateInvoicePDF({ ...invoice, branch: activeJob?.branch, currency: curr }); setPdfLoad(false); }}>
                    {pdfLoad ? 'Generating...' : 'Download PDF'}
                  </Btn>
                </div>

                <Btn full size="lg" onClick={finishAndReturn}>← Back to My Jobs</Btn>
              </WCard>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
          SCANNER MODAL
      ══════════════════════════════════════════════════════ */}
        {showScannerModal && (
          <div className="modal-overlay" onClick={() => { setShowScannerModal(false); setScannerActiveView(false); setIsScanningProduct(false); }}>
            <div className="modal-content add-product-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: scannerActiveView ? 450 : 350 }}>
              <div className="modal-header">
                <h2>Add Addon Product</h2>
                <button className="close-btn" onClick={() => { setShowScannerModal(false); setScannerActiveView(false); setIsScanningProduct(false); }}>&times;</button>
              </div>

              {!scannerActiveView ? (
                <>
                  <div className="modal-options" style={{ gridTemplateColumns: '1fr', padding: '32px 40px' }}>
                    <button className="option-card scanner-card" onClick={() => setScannerActiveView(true)}>
                      <div className="option-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 4h4v4H3z"></path>
                          <path d="M17 4h4v4h-4z"></path>
                          <path d="M3 17h4v4H3z"></path>
                          <path d="M17 17h4v4h-4z"></path>
                          <line x1="2" y1="12" x2="22" y2="12"></line>
                          <line x1="12" y1="2" x2="12" y2="22"></line>
                        </svg>
                      </div>
                      <h3>Barcode Scanner</h3>
                      <p>Scan barcode or QR code</p>
                    </button>
                  </div>
                  <div className="modal-info">
                    <p>Choose the scanning method to add a product</p>
                  </div>
                </>
              ) : (
                <div className="scanner-body">
                  {isScanningProduct ? (
                    <>
                      <div style={{ position: 'relative', width: '100%', maxWidth: '350px', margin: '0 auto', borderRadius: '16px', overflow: 'hidden', background: '#000', minHeight: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <video id="washer-qr-reader" style={{ width: '100%', height: '100%', objectFit: 'cover' }}></video>

                        {/* Scanning Animation Overlay - Only show if no error */}
                        {!cameraError && (
                          <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            pointerEvents: 'none', zIndex: 10
                          }}>
                            {/* Target Box with semi-transparent backdrop */}
                            <div style={{
                              position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%',
                              border: '2px solid rgba(255, 255, 255, 0.4)', borderRadius: '12px',
                              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)'
                            }}>
                              {/* Corner Markers */}
                              <div style={{ position: 'absolute', top: -2, left: -2, width: 24, height: 24, borderTop: '4px solid #fff', borderLeft: '4px solid #fff', borderTopLeftRadius: 12 }}></div>
                              <div style={{ position: 'absolute', top: -2, right: -2, width: 24, height: 24, borderTop: '4px solid #fff', borderRight: '4px solid #fff', borderTopRightRadius: 12 }}></div>
                              <div style={{ position: 'absolute', bottom: -2, left: -2, width: 24, height: 24, borderBottom: '4px solid #fff', borderLeft: '4px solid #fff', borderBottomLeftRadius: 12 }}></div>
                              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderBottom: '4px solid #fff', borderRight: '4px solid #fff', borderBottomRightRadius: 12 }}></div>

                              {/* Laser Line */}
                              <div style={{
                                position: 'absolute', left: 0, right: 0, height: '2px', background: '#22c55e',
                                boxShadow: '0 0 10px #22c55e, 0 0 20px #22c55e',
                                animation: 'scan-laser 2s infinite linear'
                              }}></div>
                            </div>
                          </div>
                        )}

                        {/* Camera Error Display */}
                        {cameraError && (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: '#fef2f2', zIndex: 20 }}>
                            <div style={{ textAlign: 'center', color: '#ef4444' }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 48, height: 48, margin: '0 auto 12px' }}>
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                              </svg>
                              <p style={{ fontWeight: 600 }}>{cameraError}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <style>{`
                      @keyframes scan-laser {
                        0% { top: 5%; opacity: 0; }
                        10% { opacity: 1; }
                        90% { opacity: 1; }
                        100% { top: 95%; opacity: 0; }
                      }
                      #washer-qr-reader {
                        object-fit: cover !important;
                        border-radius: 16px;
                      }
                    `}</style>
                      <p className="scanner-instruction" style={{ marginTop: '16px', fontWeight: '500' }}>{cameraError ? 'Please allow camera access and try again' : 'Point camera at barcode/QR code'}</p>
                      <button className="stop-scanning-btn" onClick={() => setIsScanningProduct(false)} style={{ background: 'var(--red)', color: '#fff', padding: '14px', width: '100%', borderRadius: '10px', border: 'none', fontWeight: 'bold', marginTop: '12px', fontSize: '15px' }}>Stop Camera</button>
                    </>
                  ) : (
                    <>
                      <div className="scanner-icon" style={{ marginBottom: 12 }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 48, height: 48, color: 'var(--accent)' }}>
                          <path d="M3 4h4v4H3z"></path>
                          <path d="M17 4h4v4h-4z"></path>
                          <path d="M3 17h4v4H3z"></path>
                          <path d="M17 17h4v4h-4z"></path>
                          <line x1="2" y1="12" x2="22" y2="12"></line>
                          <line x1="12" y1="2" x2="12" y2="22"></line>
                        </svg>
                      </div>

                      <div style={{ marginBottom: '24px' }}>
                        <p className="scanner-instruction" style={{ marginBottom: '8px', fontWeight: 600 }}>1. Use External Barcode Scanner:</p>
                        <input
                          autoFocus
                          id="external-barcode-scan"
                          name="externalBarcodeScan"
                          type="text"
                          className="barcode-input"
                          placeholder="Click here & zap with external device..."
                          style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '2px solid var(--accent)', outline: 'none', fontSize: 16, boxSizing: 'border-box' }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && e.target.value.trim()) {
                              handleScanProduct(e.target.value.trim());
                              e.target.value = '';
                              setShowScannerModal(false);
                              setScannerActiveView(false);
                            }
                          }}
                        />
                        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>The scanner will automatically submit the code.</p>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                        <p className="scanner-instruction" style={{ marginBottom: '12px', fontWeight: 600 }}>2. Or Use Your Device Camera:</p>
                        <button className="start-scanning-btn" onClick={() => setIsScanningProduct(true)} style={{ background: 'var(--card)', color: 'var(--accent)', border: '2px solid var(--accent)', padding: '12px', width: '100%', borderRadius: '10px', fontWeight: 'bold', fontSize: 14, cursor: 'pointer' }}>Start Mobile/Webcam Camera</button>
                      </div>
                    </>
                  )}
                  <button className="back-to-options-btn" onClick={() => setScannerActiveView(false)} style={{ marginTop: '20px', background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontWeight: 600 }}>← Back to Options</button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </>
  );
};

/* ═══════════════════════════════════════════════════════════
   JOB CARD
═══════════════════════════════════════════════════════════ */
const parsePackageTime = (timeStr) => {
  if (!timeStr) return 0;
  const lower = timeStr.toLowerCase();
  let val = parseFloat(lower);
  if (isNaN(val)) return 0;
  if (lower.includes('hr') || lower.includes('hour')) {
    return Math.round(val * 60);
  }
  return val;
};

const JobTimer = ({ startTime, durationMinutes }) => {
  const durationSeconds = durationMinutes * 60;
  
  const getElapsedSeconds = () => {
    const safeStartTime = startTime || Date.now();
    return Math.floor((Date.now() - new Date(safeStartTime).getTime()) / 1000);
  };
  const [elapsed, setElapsed] = useState(getElapsedSeconds());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(getElapsedSeconds());
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const progress = Math.min(100, Math.max(0, (elapsed / durationSeconds) * 100));
  const remainingSeconds = durationSeconds - elapsed;
  const isOverdue = remainingSeconds < 0;

  const absRem = Math.abs(remainingSeconds);
  const h = Math.floor(absRem / 3600);
  const m = Math.floor((absRem % 3600) / 60);
  const s = absRem % 60;
  const timeStr = `${h > 0 ? h.toString().padStart(2, '0') + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = (progress / 100) * circumference;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
      <div style={{ fontSize: 11, color: isOverdue ? 'var(--red)' : 'var(--text-2)', fontWeight: 600 }}>
        {isOverdue ? `Overdue ${timeStr}` : `${timeStr} left`}
      </div>
      <svg width="24" height="24" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="12" cy="12" r={radius} fill="none" stroke="var(--border)" strokeWidth="3" />
        <circle 
          cx="12" cy="12" r={radius} fill="none" 
          stroke={isOverdue ? 'var(--red)' : 'var(--accent)'} 
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
      </svg>
    </div>
  );
};

const JobCard = ({ job, onView, isBlocked }) => {
  const safeSubmittedAt = job.submittedAt || Date.now();
  const elapsed = Math.round((Date.now() - new Date(safeSubmittedAt).getTime()) / 60000);
  const elapsedStr = elapsed < 60 ? `${elapsed}m ago` : `${Math.floor(elapsed / 60)}h ${elapsed % 60}m ago`;
  const packageMins = job.package?.time ? parsePackageTime(job.package.time) : 0;
  const showTimer = job.status === 'pending' && packageMins > 0;

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '16px', marginBottom: 12, boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', letterSpacing: '-0.01em' }}>{job.customer.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{job.customer.phone}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: job.status === 'in_progress' ? 'var(--amber)' : 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
            {job.status === 'in_progress' ? 'In Progress' : 'Pending Payment'}
          </div>
          {showTimer ? (
            <JobTimer startTime={job.submittedAt} durationMinutes={packageMins} />
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{elapsedStr}</div>
          )}
        </div>
      </div>

      <div style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>
          {job.vehicle.colour} {job.vehicle.make} {job.vehicle.model}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {job.vehicle.plate && (
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--amber)', fontWeight: 700, background: 'rgba(217,119,6,0.1)', padding: '2px 8px', borderRadius: 6 }}>
              {job.vehicle.plate}
            </span>
          )}
          <span style={{ background: `${job.package.color}12`, color: job.package.color, borderRadius: 6, padding: '2px 9px', fontSize: 12, fontWeight: 600 }}>
            {job.package.name}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{job.package.time}</span>
        </div>
      </div>

      {job.locationName && (
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}><img src={mapIcon} alt="" style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} />{job.locationName}</div>
      )}

      <button onClick={onView}
        style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: (isBlocked && job.status === 'in_progress') ? 'var(--bg-3)' : 'var(--accent)', color: (isBlocked && job.status === 'in_progress') ? 'var(--text-3)' : '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: (isBlocked && job.status === 'in_progress') ? 'not-allowed' : 'pointer', letterSpacing: '-0.01em' }}>
        {job.status === 'in_progress' ? 'Fill Stages to Start' : 'View → Proceed to Payment'}
      </button>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════ */
const WCard = ({ title, sub, children }) => (
  <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '22px 20px', boxShadow: 'var(--shadow)' }}>
    <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>{title}</h2>
    {sub && <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-3)' }}>{sub}</p>}
    {children}
  </div>
);

const DataRow = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
    <span style={{ color: 'var(--text-3)' }}>{label}</span>
    <span style={{ fontWeight: 600, color: 'var(--text)', textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{value}</span>
  </div>
);

const SuccessBox = ({ children }) => (
  <div style={{ background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.18)', borderRadius: 9, padding: '10px 13px', fontSize: 13, color: 'var(--green)', marginBottom: 12, fontWeight: 500 }}>
    {children}
  </div>
);

const SLabel = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
    {children}
  </div>
);
