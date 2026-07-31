import React, { useState, useEffect } from 'react';
import { ThemeToggle, PhoneInp } from '../components/common/UI';
import { API, token } from '../utils/api';
import { getCurrency } from '../utils/messaging';
import LogoLightFull from '../assets/smart-garage-light/Smart-Garage-vertical.png';
import LogoDarkFull from '../assets/smart-garage-dark/smart-garage-dark-theme-v.png';
import carIcon from '../assets/icons/car-icon.png';
import branchIcon from '../assets/icons/branch-icon.png';
import StepSection from './public/StepSection';
const DEFAULT_PLANS = [
    { id: 'trial', label: 'Free Trial', price: 'RM 0', desc: '14 days · 1 washer · 50 sessions', requiresPayment: false },
    { id: 'starter', label: 'Starter', price: 'RM 99', desc: '/month · 3 washers · 500 sessions', requiresPayment: true },
    { id: 'business', label: 'Business', price: 'RM 199', desc: '/month · Unlimited · AI + Priority support', requiresPayment: true },
];

export const LoginPage = ({ isDark, onToggleTheme }) => {
    const [tab, setTab] = useState(() => sessionStorage.getItem('rwash_login_tab') || 'login');
    // tabs: 'login' | 'signup-choose' | 'signup-individual' | 'signup-branch' | 'signup-payment'

    useEffect(() => {
        sessionStorage.setItem('rwash_login_tab', tab);
    }, [tab]);

    const [plans, setPlans] = useState(DEFAULT_PLANS);

    useEffect(() => {
        API.subscriptions.list().then(data => {
            if (data && data.length > 0) {
                setPlans(data.map(p => ({
                    ...p,
                    desc: `${p.duration === '/month' ? '/month' : p.duration} · ${p.max_washers > 0 ? p.max_washers : 'Unlimited'} washers · ${p.max_sessions > 0 ? p.max_sessions : 'Unlimited'} sessions`,
                    requiresPayment: !['rm 0', '0', 'free', 'trial', 'rm0'].includes((p.price || '').toLowerCase().replace(/\s/g, ''))
                })));
            }
        }).catch(() => { });
    }, []);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [registeredTrackingId, setRegisteredTrackingId] = useState('');

    const [login, setLogin] = useState({ username: '', password: '' });
    const [showPwd, setShowPwd] = useState(false);

    const [resetContact, setResetContact] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [resetNewPassword, setResetNewPassword] = useState('');

    const [ind, setInd] = useState({ name: '', username: '', password: '', phone: '', email: '', vehicle_plate: '', vehicle_make: '', vehicle_model: '' });

    const [br, setBr] = useState(() => {
        const saved = sessionStorage.getItem('rwash_signup_br');
        return saved ? JSON.parse(saved) : { name: '', username: '', password: '', phone: '', email: '', branch_name: '', branch_address: '', branch_phone: '', subscription: 'trial', company_reg_no: '', country: 'Malaysia' };
    });

    useEffect(() => {
        sessionStorage.setItem('rwash_signup_br', JSON.stringify(br));
    }, [br]);

    const [pay, setPay] = useState(() => {
        const saved = sessionStorage.getItem('rwash_signup_pay');
        const parsed = saved ? JSON.parse(saved) : null;
        const defaultDate = new Date().toISOString().split('T')[0];
        return parsed ? { ...parsed, paymentDate: parsed.paymentDate || defaultDate } : { transactionId: '', accountName: '', paymentDate: defaultDate };
    });

    useEffect(() => {
        sessionStorage.setItem('rwash_signup_pay', JSON.stringify(pay));
    }, [pay]);

    const [checkTrackingId, setCheckTrackingId] = useState('');
    const [statusResult, setStatusResult] = useState(null);

    const [paymentMethod, setPaymentMethod] = useState('online');
    const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'annually'

    const [bankDetails, setBankDetails] = useState({ bankName: 'Maybank', accountNumber: '1234 5678 9012', accountHolder: 'Supreme Admin Co.' });
    const [ssmLoading, setSsmLoading] = useState(false);
    
    const [dynamicQrUrl, setDynamicQrUrl] = useState('');
    const [orderNumber, setOrderNumber] = useState('');
    const [qrLoading, setQrLoading] = useState(false);

    useEffect(() => {
        let interval;
        if (orderNumber && paymentMethod === 'dynamic_qr') {
            interval = setInterval(async () => {
                try {
                    const res = await API.payment.getSubscriptionStatus(orderNumber);
                    if (res.status === 'PAID') {
                        clearInterval(interval);
                        setSuccess('Payment successful! Submitting your registration...');
                        setOrderNumber('');
                        const successPayment = {
                            transactionId: orderNumber,
                            accountName: br.name || 'Admin',
                            paymentDate: new Date().toISOString()
                        };
                        setPay(successPayment);
                        handleBranchSignup(successPayment);
                    }
                } catch (e) { }
            }, 5000);
        }
        return () => clearInterval(interval);
    }, [orderNumber, paymentMethod, br.name]);

    useEffect(() => {

        API.settings.getSupremeBankDetails().then(data => {
            if (data) setBankDetails(data);
        }).catch(() => { });
    }, []);

    // Poll status every 10s if pending
    useEffect(() => {
        let interval;
        if (tab === 'check-status' && statusResult?.status === 'Pending Verification' && statusResult?.trackingId) {
            interval = setInterval(async () => {
                try {
                    const res = await API.auth2.checkStatus(statusResult.trackingId);
                    setStatusResult(prev => prev ? ({
                        ...prev,
                        status: res.status === 'Pending' ? 'Pending Verification' : res.status,
                    }) : null);
                } catch (err) {
                    // silent fail on polling
                }
            }, 10000);
        }
        return () => clearInterval(interval);
    }, [tab, statusResult?.status, statusResult?.trackingId]);

    const setI = (k, v) => setInd(f => ({ ...f, [k]: v }));
    const setB = (k, v) => {
        setBr(f => {
            const next = { ...f, [k]: v };
            if (k === 'phone' || k === 'branch_phone') {
                if (getCurrency(v) === 'INR') next.country = 'India';
                else next.country = 'Malaysia';
            }
            return next;
        });
    };

    const go = (t) => { setTab(t); setError(''); setSuccess(''); setStatusResult(null); };

    // ── Login ─────────────────────────────────────────────
    const handleLogin = async () => {
        if (!login.username || !login.password) { setError('Please fill in all fields'); return; }
        setError(''); setLoading(true);
        try {
            const res = await API.auth.login(login.username, login.password);
            token.set(res.access_token);
            window.location.reload();
        } catch (err) {
            const msg = err.message || 'Invalid credentials';
            if (msg === 'PENDING_APPROVAL') {
                setError('Your account is pending approval from the Supreme Admin. You will be notified once approved.');
            } else if (msg === 'ACCOUNT_REJECTED') {
                setError('Your account application was rejected. Please check your application status or re-apply.');
            } else if (msg === 'EXPIRED_SUBSCRIPTION') {
                setError('Your plan has expired. Please contact the Supreme Admin.');
            } else {
                setError(msg);
            }
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!resetContact) { setError('Please enter your email or phone number'); return; }
        setError(''); setLoading(true);
        try {
            await API.auth.forgotPassword(resetContact);
            setSuccess('Verification code sent! Please check your terminal (simulating SMS/Email).');
            go('reset-password');
        } catch (err) {
            setError(err.message || 'User not found');
        }
        setLoading(false);
    };

    const handleResetPassword = async () => {
        if (!resetCode || !resetNewPassword) { setError('Please enter the verification code and new password'); return; }
        if (resetNewPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
        setError(''); setLoading(true);
        try {
            await API.auth.resetPassword(resetContact, resetCode, resetNewPassword);
            setSuccess('Password reset successful. You can now sign in.');
            setResetCode('');
            setResetNewPassword('');
            go('login');
        } catch (err) {
            setError(err.message || 'Invalid or expired code');
        }
        setLoading(false);
    };

    // ── Individual signup ─────────────────────────────────
    const handleIndividualSignup = async () => {
        if (!ind.name || !ind.username || !ind.password || !ind.phone) { setError('Name, username, password and phone are required'); return; }
        if (ind.password.length < 6) { setError('Password must be at least 6 characters'); return; }
        setError(''); setLoading(true);
        try {
            const res = await API.auth2.signupIndividual(ind);
            token.set(res.access_token);
            window.location.reload();
        } catch (err) { setError(err.message || 'Signup failed'); setLoading(false); }
    };

    // ── Branch admin signup ───────────────────────────────
    const proceedToPayment = async () => {
        const missing = [];
        if (!br.name) missing.push('Full Name');
        if (!br.phone) missing.push('Phone Number');
        if (!br.branch_name) missing.push('Company / Branch Name');
        if (!br.company_reg_no) missing.push('Company Registration No');
        if (!br.branch_address) missing.push('Branch Address');
        if (!br.username) missing.push('Username');
        if (!br.password) missing.push('Password');

        if (missing.length > 0) {
            setError(`Please fill in: ${missing.join(', ')}`); return;
        }
        if (br.password.length < 6) { setError('Password must be at least 6 characters'); return; }

        const ssmNo = br.company_reg_no.trim();
        const oldFormat = /^\d+-[A-Za-z]+$/;
        const newFormat = /^\d{12}$/;
        if (!oldFormat.test(ssmNo) && !newFormat.test(ssmNo)) {
            setError('Invalid SSM Registration Number format. Use old format (e.g., 123456-X) or new 12-digit format (YYYYXXXXXXXX).');
            return;
        }

        // Check if SSM verification explicitly failed
        if (br.ssm_verified === false) {
            setError("Cannot proceed: SSM Verification failed. Please ensure your company registration number is active.");
            return;
        }

        try {
            setLoading(true); setError('');
            await API.auth2.validateSignupSuperAdmin({ ...br });
            setLoading(false);

            const selectedPlan = plans.find(p => p.id === br.subscription);
            if (selectedPlan && selectedPlan.requiresPayment) {
                go('signup-payment');
            } else {
                handleBranchSignup();
            }
        } catch (err) {
            setError(err.message || 'Validation failed');
            setLoading(false);
        }
    };

    const handleBranchSignup = async (paymentData = null) => {
        setError(''); setLoading(true);
        try {
            const payload = { ...br };
            const activePay = { ...(paymentData || pay), billing_cycle: billingCycle };
            if (activePay.transactionId) {
                payload.payment = activePay;
                payload.trackingId = 'TRK-' + Math.random().toString(36).substring(2, 8).toUpperCase();
            } else {
                payload.payment = activePay;
                payload.trackingId = 'TRK-' + Math.random().toString(36).substring(2, 8).toUpperCase();
            }

            await API.auth2.signupSuperAdmin(payload);
            setRegisteredTrackingId(payload.trackingId);
            setSuccess(`Registration submitted! Your Tracking ID is: ${payload.trackingId} (Save this ID to check your status). Application should be approved within 24 hours.`);
            setTab('login');
            // Reset forms
            setBr({ name: '', username: '', password: '', phone: '', email: '', branch_name: '', branch_address: '', branch_phone: '', subscription: 'trial', company_reg_no: '' });
            setPay({ transactionId: '', accountName: '', paymentDate: '' });
            sessionStorage.removeItem('rwash_signup_br');
            sessionStorage.removeItem('rwash_signup_pay');
            setLoading(false);
        } catch (err) { setError(err.message || 'Signup failed'); setLoading(false); }
    };

    const handleSSMUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSsmLoading(true);
        setError('');
        setSuccess('');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await API.vision.analyzeSSM(formData);

            if (res.error) {
                setError(res.error);
                return;
            }

            let msg = [];
            if (res.company_name) {
                setB('branch_name', res.company_name);
                msg.push(`"${res.company_name}"`);
            }
            if (res.registration_number) {
                setB('company_reg_no', res.registration_number);
                msg.push(`No. ${res.registration_number}`);
            }

            if (msg.length > 0) {
                let statusText = "";
                if (res.verification) {
                    statusText = res.verification.valid
                        ? ` (Verified Active )`
                        : ` (Verification Failed - ${res.verification.message})`;
                    setB('ssm_verified', res.verification.valid);
                } else {
                    setB('ssm_verified', null);
                }
                setSuccess(`Successfully extracted: ${msg.join(' and ')}${statusText}`);
            } else {
                setError("Could not confidently extract details. Please fill them manually.");
            }
        } catch (err) {
            setError(err.message || 'Failed to analyze SSM certificate');
        } finally {
            setSsmLoading(false);
            e.target.value = null;
        }
    };

    const generateDynamicQr = async () => {
        setQrLoading(true); setError(''); setDynamicQrUrl('');
        try {
            const currencyCode = br.country === 'India' ? 'INR' : 'MYR';
            const selectedPlan = plans.find(p => p.id === br.subscription);
            const displayPriceStr = getDisplayPrice(selectedPlan) || '0';
            const amount = parseFloat(String(displayPriceStr).replace(/[^0-9.]/g, ''));
            const res = await API.payment.createSubscriptionQr(br.subscription, amount, currencyCode);
            setDynamicQrUrl(res.qr_url);
            setOrderNumber(res.order_id);
        } catch (err) {
            setError(err.message || "Failed to generate dynamic QR.");
        }
        setQrLoading(false);
    };

    const handleRazorpayCheckout = async () => {
        setLoading(true); setError('');
        try {
            if (!window.Razorpay) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.body.appendChild(script);
                });
            }

            const { key_id } = await API.payment.getRazorpayKey(true);
            const currencyCode = br.country === 'India' ? 'INR' : 'MYR';
            const selectedPlan = plans.find(p => p.id === br.subscription);
            const displayPriceStr = getDisplayPrice(selectedPlan) || '0';
            const amount = parseFloat(String(displayPriceStr).replace(/[^0-9.]/g, ''));

            const { order_id } = await API.payment.createRazorpayOrder(amount, true, currencyCode);

            const options = {
                key: key_id,
                amount: Math.round(amount * 100),
                currency: currencyCode,
                name: "Smart Garage Supreme",
                description: `Subscription: ${selectedPlan.label}`,
                order_id: order_id,
                handler: async function (response) {
                    try {
                        await API.payment.verifyRazorpayPayment({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            for_subscription: true
                        });
                        const successPayment = {
                            transactionId: response.razorpay_payment_id,
                            accountName: br.name,
                            paymentDate: new Date().toISOString(),
                            currency: currencyCode
                        };
                        setPay(successPayment);
                        handleBranchSignup(successPayment);
                    } catch (err) {
                        setError("Payment verification failed. Please contact support.");
                        setLoading(false);
                    }
                },
                prefill: {
                    name: br.name,
                    email: br.email,
                    contact: br.phone
                },
                theme: { color: "#da1a31" },
                modal: {
                    ondismiss: function () {
                        setLoading(false);
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response) {
                setError("Payment failed: " + response.error.description);
                setLoading(false);
            });
            rzp.open();

        } catch (err) {
            setError(err.message || 'Failed to initialize payment');
            setLoading(false);
        }
    };

    const handleCheckStatus = async () => {
        if (!checkTrackingId) return;
        setLoading(true); setError(''); setStatusResult(null);

        // Normalize the tracking ID: remove trailing periods, spaces, and make uppercase
        const cleanTrackingId = checkTrackingId.trim().replace(/\.+$/, '').toUpperCase();

        try {
            const res = await API.auth2.checkStatus(cleanTrackingId);
            setStatusResult({
                trackingId: cleanTrackingId,
                status: res.status === 'Pending' ? (res.plan === 'Free Trial' ? 'Pending Approval' : 'Pending Verification') : res.status,
                submittedAt: res.date
            });
        } catch (err) {
            setError(err.message || 'Failed to fetch status. Invalid Tracking ID.');
        }
        setLoading(false);
    };

    // ── Shared styles ─────────────────────────────────────
    const inp = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-3)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '11px 16px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none' };
    const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 };

    const fld = (label, key, setter, type = 'text', ph = '', autoComplete = 'off', isReadOnly = false, maxLength = undefined) => {
        const safeId = label.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const isPhone = type === 'tel' || label.toLowerCase().includes('phone');
        if (isPhone) {
            return (
                <PhoneInp
                    label={label}
                    value={key}
                    onChange={e => { if (!isReadOnly) setter(e.target.value); }}
                    placeholder={ph}
                    readOnly={isReadOnly}
                    type={type}
                />
            );
        }
        return (
            <div style={{ marginBottom: 14 }}>
                <label htmlFor={safeId} style={lbl}>{label}</label>
                <input id={safeId} name={safeId} type={type} placeholder={ph} value={key} maxLength={maxLength}
                    onChange={e => { if (!isReadOnly) setter(e.target.value); }}
                    onKeyDown={e => e.key === 'Enter' && tab === 'login' && handleLogin()}
                    autoComplete={autoComplete}
                    readOnly={isReadOnly}
                    style={{ ...inp, background: isReadOnly ? 'var(--bg-2)' : 'var(--bg-3)', opacity: isReadOnly ? 0.7 : 1, cursor: isReadOnly ? 'not-allowed' : 'text' }} />
            </div>
        );
    };

    const PrimaryBtn = ({ children, onClick, disabled }) => (
        <button onClick={onClick} disabled={disabled} style={{
            width: '100%', padding: '13px', borderRadius: 10, border: 'none',
            background: disabled ? 'var(--bg-3)' : 'var(--accent)', color: disabled ? 'var(--text-3)' : '#fff',
            fontSize: 14, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', boxShadow: disabled ? 'none' : '0 4px 14px var(--accent-dim)', transition: 'all 0.2s',
        }}>{children}</button>
    );

    const GhostBtn = ({ children, onClick }) => (
        <button onClick={onClick} style={{
            width: '100%', padding: '11px', borderRadius: 10, border: '1.5px solid var(--border)',
            background: 'transparent', color: 'var(--text-2)', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
        }}>{children}</button>
    );

    const SectionLabel = ({ children }) => (
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '18px 0 12px' }}>{children}</div>
    );

    const selectedPlan = plans.find(p => p.id === br.subscription);

    // Only show the billing toggle when at least one plan has a real annual_price configured.
    const hasAnnualPricing = plans.some(p => p.annual_price > 0);

    const getDisplayPrice = (plan) => {
        if (!plan) return '0';
        if (br.country === 'India') {
            if (billingCycle === 'annually' && plan.annual_price_inr > 0) return `INR ${plan.annual_price_inr}`;
            return plan.price_inr || plan.price;
        }
        if (billingCycle === 'annually' && plan.annual_price > 0) {
            const prefixMatch = (plan.price || '').match(/^([a-zA-Z\s]+)/);
            const prefix = prefixMatch ? prefixMatch[1] : 'RM ';
            return `${prefix}${plan.annual_price}`;
        }
        return plan.price;
    };

    const getStrikethroughPrice = (plan) => {
        if (!plan || billingCycle !== 'annually' || plan.annual_price <= 0) return null;
        if (br.country === 'India') {
            if (plan.monthly_price_inr > 0) return `INR ${plan.monthly_price_inr * 12}`;
            return null;
        }
        if (plan.monthly_price > 0) {
            const prefixMatch = (plan.price || '').match(/^([a-zA-Z\s]+)/);
            const prefix = prefixMatch ? prefixMatch[1] : 'RM ';
            return `${prefix}${plan.monthly_price * 12}`;
        }
        return null;
    };

    const getDisplayDesc = (plan) => {
        if (!plan) return '';
        if (billingCycle === 'annually' && plan.annual_price > 0) {
            return plan.desc ? plan.desc.replace('/month', '/year') : '';
        }
        return plan.desc || '';
    };

    return (
        <div style={{ height: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}>

            {/* ── Left branding panel ── */}
            <div style={{
                width: '42%', height: '100vh',
                background: tab === 'signup-individual' ? 'var(--bg-2)' : 'linear-gradient(160deg, #0a0a0a 0%, #1a0608 50%, #0a0a0a 100%)',
                display: 'flex', flexDirection: 'column', justifyContent: tab === 'signup-individual' ? 'center' : 'space-between',
                padding: tab === 'signup-individual' ? '0' : '40px 48px', boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
            }} className="hide-mobile">
                {tab === 'signup-individual' ? (
                    <StepSection />
                ) : (
                    <>
                        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(218,26,49,0.15) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(218,26,49,0.07) 0%, transparent 50%)', pointerEvents: 'none' }} />
                        <div />
                        <div style={{ position: 'relative', width: '80%', marginLeft: 'auto', marginRight: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.03em', marginBottom: 16 }}>
                                Run your car wash<br /><span style={{ color: '#da1a31' }}>smarter</span>, faster.
                            </div>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.7, maxWidth: 300 }}>
                                Track sessions, manage staff, and grow customer loyalty — all in one place.
                            </p>
                            <div style={{ marginTop: 28, display: 'inline-flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
                                {['Real-time job tracking across all branches', 'AI-powered vehicle recognition', 'Loyalty rewards & coupon management', 'Individual customer wash history portal'].map(f => (
                                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(218,26,49,0.2)', border: '1px solid rgba(218,26,49,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4L3 6L7 2" stroke="#da1a31" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        </div>
                                        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{f}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ position: 'relative', fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>Built by OS2 Studio</div>
                    </>
                )}
            </div>

            {/* ── Right form panel ── */}
            <div style={{ flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', padding: '32px 24px', background: 'var(--bg)', position: 'relative', overflowY: 'auto' }}>
                <div style={{ position: 'absolute', top: 20, right: 20 }}>
                    <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
                </div>

                <div className="login-card-box">
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
                        <img src={LogoLightFull} alt="Smart Garage" className="logo-light" style={{ width: '45%', height: 'auto' }} />
                        <img src={LogoDarkFull} alt="Smart Garage" className="logo-dark" style={{ width: '60%', height: 'auto' }} />
                    </div>

                    {/* ══ LOGIN ══ */}
                    {tab === 'login' && (
                        <>
                            <div style={{ marginBottom: 28, textAlign: 'center' }}>
                                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 6 }}>Welcome back</h1>
                                <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Sign in to your account</p>
                            </div>
                            {success && (
                                <div style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 9, padding: '12px 14px', fontSize: 13, color: '#059669', marginBottom: 16 }}>
                                    {success}
                                    {registeredTrackingId && (
                                        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                                            <button 
                                                onClick={(e) => { 
                                                    e.preventDefault(); 
                                                    navigator.clipboard.writeText(registeredTrackingId); 
                                                    alert('Tracking ID copied to clipboard!'); 
                                                }}
                                                style={{ padding: '6px 12px', background: '#059669', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                                Copy Tracking ID
                                            </button>
                                            <button 
                                                onClick={(e) => { 
                                                    e.preventDefault(); 
                                                    const csvContent = "data:text/csv;charset=utf-8,Tracking ID\n" + registeredTrackingId;
                                                    const encodedUri = encodeURI(csvContent);
                                                    const link = document.createElement("a");
                                                    link.setAttribute("href", encodedUri);
                                                    link.setAttribute("download", "Smart Garage_Tracking_ID_" + registeredTrackingId + ".csv");
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                }}
                                                style={{ padding: '6px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                                Download Excel (CSV)
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                            {fld('Username', login.username, v => setLogin(f => ({ ...f, username: v })), 'text', 'Your username', 'username')}
                            <div style={{ marginBottom: 20 }}>
                                <label htmlFor="login-password" style={lbl}>Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input id="login-password" name="login-password" type={showPwd ? 'text' : 'password'} placeholder="Your password" value={login.password}
                                        autoComplete="current-password"
                                        onChange={e => setLogin(f => ({ ...f, password: e.target.value }))}
                                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                        style={{ ...inp, paddingRight: 52 }} />
                                    <button className="show-pwd-btn" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 12, padding: 4 }}>
                                        {showPwd ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                                <div style={{ textAlign: 'right', marginTop: 8 }}>
                                    <span onClick={() => go('forgot-password')} style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Forgot Password?</span>
                                </div>
                            </div>
                            {error && <div style={{ background: 'rgba(218,26,49,0.07)', border: '1px solid rgba(218,26,49,0.2)', borderRadius: 9, padding: '10px 14px', fontSize: 14, color: 'var(--red)', marginBottom: 14 }}>{error}</div>}
                            <PrimaryBtn onClick={handleLogin} disabled={loading}>{loading ? 'Signing in...' : 'Sign in →'}</PrimaryBtn>
                            <div style={{ height: 1, background: 'var(--border)', margin: '22px 0' }} />
                            <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', marginBottom: 12 }}>Don't have an account?</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <GhostBtn onClick={() => go('signup-choose')}>Create an Account</GhostBtn>
                                <GhostBtn onClick={() => go('check-status')}>Check Application Status</GhostBtn>
                            </div>
                        </>
                    )}

                    {/* ══ FORGOT PASSWORD ══ */}
                    {tab === 'forgot-password' && (
                        <>
                            <button onClick={() => go('login')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, padding: 0 }}>
                                <span>←</span> Back to login
                            </button>
                            <div style={{ marginBottom: 28, textAlign: 'center' }}>
                                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 6 }}>Reset Password</h1>
                                <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Enter your registered phone number to receive a verification code.</p>
                            </div>
                            {error && <div style={{ background: 'rgba(218,26,49,0.07)', border: '1px solid rgba(218,26,49,0.2)', borderRadius: 9, padding: '10px 14px', fontSize: 14, color: 'var(--red)', marginBottom: 14 }}>{error}</div>}
                            {fld('Phone number', resetContact, setResetContact, 'text', 'e.g. user@example.com or 1234567890')}
                            <PrimaryBtn onClick={handleForgotPassword} disabled={loading}>{loading ? 'Sending...' : 'Send Verification Code'}</PrimaryBtn>
                        </>
                    )}

                    {/* ══ RESET PASSWORD ══ */}
                    {tab === 'reset-password' && (
                        <>
                            <button onClick={() => go('forgot-password')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, padding: 0 }}>
                                <span>←</span> Back
                            </button>
                            <div style={{ marginBottom: 28, textAlign: 'center' }}>
                                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 6 }}>Enter Verification Code</h1>
                                <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Please enter the 6-digit code sent to you and your new password.</p>
                            </div>
                            {success && (
                                <div style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 9, padding: '12px 14px', fontSize: 13, color: '#059669', marginBottom: 16 }}>
                                    {success}
                                </div>
                            )}
                            {error && <div style={{ background: 'rgba(218,26,49,0.07)', border: '1px solid rgba(218,26,49,0.2)', borderRadius: 9, padding: '10px 14px', fontSize: 14, color: 'var(--red)', marginBottom: 14 }}>{error}</div>}
                            {fld('Verification Code', resetCode, setResetCode, 'text', '6-digit code')}
                            {fld('New Password', resetNewPassword, setResetNewPassword, 'password', 'At least 6 characters')}
                            <PrimaryBtn onClick={handleResetPassword} disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</PrimaryBtn>
                            <div style={{ marginTop: 14 }}>
                                <GhostBtn onClick={handleForgotPassword} disabled={loading}>{loading ? 'Sending...' : 'Resend Code'}</GhostBtn>
                            </div>
                        </>
                    )}

                    {/* ══ CHOOSE SIGNUP TYPE ══ */}
                    {tab === 'signup-choose' && (
                        <>
                            <div style={{ marginBottom: 28 }}>
                                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 6 }}>Create Account</h1>
                                <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Choose your account type to get started</p>
                            </div>
                            <button onClick={() => go('signup-individual')}
                                style={{ width: '100%', background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '18px 20px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', marginBottom: 12, transition: 'all 0.15s' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(218,26,49,0.1)', border: '1px solid rgba(218,26,49,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <img src={carIcon} alt="" style={{ width: '80%', height: 'auto' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 3 }}>Individual Customer</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Track your vehicle's wash history, loyalty rewards and invoices</div>
                                    </div>
                                </div>
                            </button>
                            <button onClick={() => go('signup-branch')}
                                style={{ width: '100%', background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '18px 20px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', marginBottom: 22, transition: 'all 0.15s' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(218,26,49,0.1)', border: '1px solid rgba(218,26,49,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}> <img src={branchIcon} alt="" style={{ width: '80%', height: 'auto' }} /></div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 3 }}>Super Admin (Retailer)</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Register your car wash branch — pending Supreme Admin approval</div>
                                    </div>
                                </div>
                            </button>
                            <GhostBtn onClick={() => go('login')}>← Back to Sign In</GhostBtn>
                        </>
                    )}

                    {/* ══ INDIVIDUAL SIGNUP ══ */}
                    {tab === 'signup-individual' && (
                        <>
                            <div style={{ marginBottom: 24, textAlign: 'center' }}>
                                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 4 }}>Individual Account</h1>
                                <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Track your wash history and loyalty rewards</p>
                            </div>
                            <SectionLabel>Your Details</SectionLabel>
                            {fld('Full Name *', ind.name, v => setI('name', v), 'text', 'e.g. Ahmad bin Razif', 'name')}
                            {fld('Phone Number *', ind.phone, v => setI('phone', v), 'tel', 'e.g. 0123456789', 'tel')}
                            {fld('Email', ind.email, v => setI('email', v), 'email', 'optional', 'email')}
                            <SectionLabel>Login Credentials</SectionLabel>
                            {fld('Username *', ind.username, v => setI('username', v), 'text', 'Choose a username', 'username')}
                            {fld('Password *', ind.password, v => setI('password', v), 'password', 'Min. 6 characters', 'new-password')}
                            <SectionLabel>Your Vehicle (optional)</SectionLabel>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div>
                                    <label htmlFor="vehicle-make" style={lbl}>Make</label>
                                    <input id="vehicle-make" name="vehicle-make" placeholder="e.g. Toyota" autoComplete="off" value={ind.vehicle_make} onChange={e => setI('vehicle_make', e.target.value)} style={inp} />
                                </div>
                                <div>
                                    <label htmlFor="vehicle-model" style={lbl}>Model</label>
                                    <input id="vehicle-model" name="vehicle-model" placeholder="e.g. Hilux" autoComplete="off" value={ind.vehicle_model} onChange={e => setI('vehicle_model', e.target.value)} style={inp} />
                                </div>
                            </div>
                            <div style={{ marginTop: 10, marginBottom: 18 }}>
                                <label htmlFor="vehicle-plate" style={lbl}>Plate Number</label>
                                <input id="vehicle-plate" name="vehicle-plate" placeholder="e.g. WKL 1234" autoComplete="off" value={ind.vehicle_plate} onChange={e => setI('vehicle_plate', e.target.value)} style={inp} />
                            </div>
                            {error && <div style={{ background: 'rgba(218,26,49,0.07)', border: '1px solid rgba(218,26,49,0.2)', borderRadius: 9, padding: '10px 14px', fontSize: 14, color: 'var(--red)', marginBottom: 14 }}>{error}</div>}
                            <PrimaryBtn onClick={handleIndividualSignup} disabled={loading}>{loading ? 'Creating account...' : 'Create Account →'}</PrimaryBtn>
                            <div style={{ marginTop: 10 }}><GhostBtn onClick={() => go('signup-choose')}>← Back</GhostBtn></div>
                        </>
                    )}

                    {/* ══ BRANCH ADMIN SIGNUP ══ */}
                    {tab === 'signup-branch' && (
                        <>
                            <div style={{ marginBottom: 24, textAlign: 'center' }}>
                                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 4 }}>Register Super Admin</h1>
                                <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Submit your branch details for Supreme Admin approval</p>
                            </div>
                            <SectionLabel>Your Details</SectionLabel>
                            {fld('Full Name *', br.name, v => setB('name', v), 'text', 'Your full name', 'name')}
                            {fld('Phone Number *', br.phone, v => setB('phone', v), 'tel', 'e.g. 0123456789', 'tel')}
                            {fld('Email', br.email, v => setB('email', v), 'email', 'optional', 'email')}
                            <SectionLabel>Branch Information</SectionLabel>
                            <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 9, padding: '10px 13px', fontSize: 12, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
                                Please enter your company name and SSM registration number. This information is required for verification, so please enter it correctly.
                            </div>

                            {fld('Company / Branch Name *', br.branch_name, v => setB('branch_name', v), 'text', 'e.g. Smart Garage Sdn Bhd', 'organization')}
                            {fld('Company Registration No. *', br.company_reg_no || '', v => setB('company_reg_no', v), 'text', 'e.g. 123456-X or 201901000001', 'off', false, 12)}
                            {fld('Branch Address *', br.branch_address, v => setB('branch_address', v), 'text', 'Full address', 'street-address')}
                            {fld('Branch Phone', br.branch_phone, v => setB('branch_phone', v), 'tel', 'optional', 'tel')}

                            <SectionLabel>Subscription Plan</SectionLabel>

                            {/* ── Billing cycle toggle (only shown when annual prices are configured) ── */}
                            {hasAnnualPricing && (
                                <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 12, padding: 4, marginBottom: 14, position: 'relative' }}>
                                    <button
                                        onClick={() => setBillingCycle('monthly')}
                                        style={{
                                            flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', fontFamily: 'inherit',
                                            fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                                            background: billingCycle === 'monthly' ? 'var(--card)' : 'transparent',
                                            color: billingCycle === 'monthly' ? 'var(--text)' : 'var(--text-3)',
                                            boxShadow: billingCycle === 'monthly' ? 'var(--shadow)' : 'none',
                                        }}
                                    >Monthly</button>
                                    <button
                                        onClick={() => setBillingCycle('annually')}
                                        style={{
                                            flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', fontFamily: 'inherit',
                                            fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                                            background: billingCycle === 'annually' ? 'var(--card)' : 'transparent',
                                            color: billingCycle === 'annually' ? 'var(--text)' : 'var(--text-3)',
                                            boxShadow: billingCycle === 'annually' ? 'var(--shadow)' : 'none',
                                        }}
                                    >Annually</button>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                                {plans.filter(plan =>
                                    billingCycle === 'monthly' || !plan.requiresPayment || plan.annual_price > 0
                                ).map(plan => (
                                    <button key={plan.id} onClick={() => setB('subscription', plan.id)}
                                        style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `2px solid ${br.subscription === plan.id ? '#da1a31' : 'var(--border)'}`, background: br.subscription === plan.id ? 'rgba(218,26,49,0.06)' : 'var(--bg-3)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.18s' }}>
                                        <div>
                                            <span style={{ fontWeight: 700, fontSize: 13, color: br.subscription === plan.id ? '#da1a31' : 'var(--text)' }}>{plan.label}</span>
                                            <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 8 }}>{getDisplayDesc(plan)}</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            {getStrikethroughPrice(plan) && (
                                                <div style={{ fontSize: 12, color: 'var(--text-2)', textDecoration: 'line-through', marginBottom: 2, fontWeight: 500 }}>
                                                    {getStrikethroughPrice(plan)}
                                                </div>
                                            )}
                                            <div style={{ fontWeight: 800, fontSize: 14, color: br.subscription === plan.id ? '#da1a31' : 'var(--text)' }}>
                                                {getDisplayPrice(plan)}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <SectionLabel>Login Credentials</SectionLabel>
                            {fld('Username *', br.username, v => setB('username', v), 'text', 'Choose a username', 'username')}
                            {fld('Password *', br.password, v => setB('password', v), 'password', 'Min. 6 characters', 'new-password')}

                            <div style={{ background: 'rgba(218,26,49,0.05)', border: '1px solid rgba(218,26,49,0.15)', borderRadius: 9, padding: '10px 13px', fontSize: 12, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
                                After submitting, the Supreme Admin will review your application. You'll be able to log in once approved.
                            </div>

                            {error && <div style={{ background: 'rgba(218,26,49,0.07)', border: '1px solid rgba(218,26,49,0.2)', borderRadius: 9, padding: '10px 14px', fontSize: 14, color: 'var(--red)', marginBottom: 14 }}>{error}</div>}

                            <PrimaryBtn onClick={proceedToPayment} disabled={loading}>{loading ? 'Processing...' : 'Continue →'}</PrimaryBtn>
                            <div style={{ marginTop: 10 }}><GhostBtn onClick={() => go('signup-choose')}>← Back</GhostBtn></div>
                        </>
                    )}



                    {/* ══ PAYMENT DETAILS ══ */}
                    {tab === 'signup-payment' && (
                        <>
                            <div style={{ marginBottom: 24, textAlign: 'center' }}>
                                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 4 }}>Complete Payment</h1>
                                <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Please pay {getDisplayPrice(selectedPlan)} to activate your subscription</p>
                            </div>

                            <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'var(--bg-3)', padding: 4, borderRadius: 12 }}>
                                <button
                                    onClick={() => { setPaymentMethod('online'); setError(''); }}
                                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: paymentMethod === 'online' ? 'var(--card)' : 'transparent', color: paymentMethod === 'online' ? 'var(--text)' : 'var(--text-3)', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', boxShadow: paymentMethod === 'online' ? 'var(--shadow)' : 'none' }}
                                >Pay Online</button>
                                <button
                                    onClick={() => { setPaymentMethod('dynamic_qr'); setError(''); generateDynamicQr(); }}
                                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: paymentMethod === 'dynamic_qr' ? 'var(--card)' : 'transparent', color: paymentMethod === 'dynamic_qr' ? 'var(--text)' : 'var(--text-3)', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', boxShadow: paymentMethod === 'dynamic_qr' ? 'var(--shadow)' : 'none' }}
                                >Dynamic QR</button>
                            </div>

                            {paymentMethod === 'online' ? (
                                <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 14, padding: 32, marginBottom: 20, textAlign: 'center' }}>
                                    <div style={{ fontSize: 42, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>{getDisplayPrice(selectedPlan)}</div>
                                    <div style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 32 }}>{selectedPlan?.label} Plan {selectedPlan?.desc}</div>

                                    {error && <div style={{ background: 'rgba(218,26,49,0.07)', border: '1px solid rgba(218,26,49,0.2)', borderRadius: 9, padding: '10px 14px', fontSize: 14, color: 'var(--red)', marginBottom: 24, textAlign: 'left' }}>{error}</div>}

                                    <PrimaryBtn
                                        onClick={handleRazorpayCheckout}
                                        disabled={loading}
                                    >
                                        {loading ? 'Processing...' : 'Pay securely with Razorpay →'}
                                    </PrimaryBtn>

                                    <div style={{ background: 'rgba(218,26,49,0.05)', border: '1px solid rgba(218,26,49,0.15)', borderRadius: 9, padding: '10px 13px', fontSize: 12, color: 'var(--text-2)', marginTop: 16, lineHeight: 1.6, textAlign: 'left' }}>
                                        Once the payment is successful, your application will be submitted for Supreme Admin review.
                                    </div>
                                </div>
                            ) : paymentMethod === 'dynamic_qr' ? (
                                <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 14, padding: 32, marginBottom: 20, textAlign: 'center' }}>
                                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Pay {getDisplayPrice(selectedPlan)}</div>
                                    <div style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 24 }}>Scan this QR code with any UPI or payment app to complete your registration.</div>
                                    
                                    {error && <div style={{ background: 'rgba(218,26,49,0.07)', border: '1px solid rgba(218,26,49,0.2)', borderRadius: 9, padding: '10px 14px', fontSize: 14, color: 'var(--red)', marginBottom: 20, textAlign: 'left' }}>{error}</div>}
                                    
                                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24, minHeight: 200 }}>
                                        {qrLoading ? (
                                            <div style={{ padding: 60, color: 'var(--text-3)', fontSize: 14, border: '1.5px dashed var(--border-2)', borderRadius: 12 }}>Generating secure QR...</div>
                                        ) : dynamicQrUrl ? (
                                            <div style={{ padding: 12, background: '#fff', borderRadius: 16, border: '1px solid var(--border-2)' }}>
                                                <img src={dynamicQrUrl} alt="Dynamic Payment QR" style={{ width: 220, height: 220, display: 'block' }} />
                                            </div>
                                        ) : (
                                            <div style={{ padding: 60, color: 'var(--red)', fontSize: 14, border: '1.5px dashed var(--border-2)', borderRadius: 12 }}>
                                                Failed to load QR.<br/>
                                                <span onClick={generateDynamicQr} style={{textDecoration: 'underline', cursor: 'pointer', color: 'var(--text-2)', marginTop: 8, display: 'inline-block'}}>Try Again</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div style={{ background: 'rgba(5,150,105,0.05)', border: '1px solid rgba(5,150,105,0.15)', borderRadius: 9, padding: '12px 14px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, textAlign: 'left' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#059669', fontWeight: 600, marginBottom: 4 }}>
                                            <span style={{ display: 'inline-block', width: 8, height: 8, background: '#059669', borderRadius: '50%' }}></span>
                                            Awaiting Payment
                                        </div>
                                        Leave this page open. Your account will automatically activate once the payment is confirmed.
                                    </div>
                                </div>
                            ) : null}

                            <div style={{ marginTop: 10 }}><GhostBtn onClick={() => go('signup-branch')}>← Back to Details</GhostBtn></div>
                        </>
                    )}

                    {/* ══ CHECK STATUS ══ */}
                    {tab === 'check-status' && (
                        <>
                            <div style={{ marginBottom: 24, textAlign: 'center' }}>
                                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 4 }}>Application Status</h1>
                                <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Enter your Tracking ID to check status</p>
                            </div>

                            {fld('Tracking ID or Phone Number', checkTrackingId, setCheckTrackingId, 'text', 'e.g. TRK-A1B2C3 or 0123456789')}

                            <PrimaryBtn onClick={handleCheckStatus} disabled={loading || !checkTrackingId}>{loading ? 'Checking...' : 'Check Status'}</PrimaryBtn>

                            {error && <div style={{ background: 'rgba(218,26,49,0.07)', border: '1px solid rgba(218,26,49,0.2)', borderRadius: 9, padding: '10px 14px', fontSize: 14, color: 'var(--red)', marginTop: 14 }}>{error}</div>}

                            {statusResult && (
                                <div style={{ marginTop: 24, background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 14, padding: 20 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                                        <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>Tracking ID</span>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>{statusResult.trackingId}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                                        <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>Status</span>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)', background: 'rgba(245,158,11,0.1)', padding: '4px 10px', borderRadius: 20 }}>{statusResult.status}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>Submitted</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{new Date(statusResult.submittedAt).toLocaleDateString()}</span>
                                    </div>

                                    {statusResult.status === 'Pending Verification' && (
                                        <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: 12, textAlign: 'center', color: 'var(--blue)', fontSize: 13, fontWeight: 600 }}>
                                            Application should be approved within 24 hours.
                                        </div>
                                    )}
                                    {statusResult.status === 'Rejected' && (
                                        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, textAlign: 'center', color: 'var(--red)', fontSize: 13, fontWeight: 600, marginTop: 12 }}>
                                            Your SSM verification failed. Please check your SSM certificate.
                                            <div style={{ marginTop: 12 }}>
                                                <PrimaryBtn onClick={() => {
                                                    setBr(prev => ({
                                                        ...prev,
                                                        name: statusResult.name || '',
                                                        username: statusResult.username || '',
                                                        phone: statusResult.phone || '',
                                                        email: statusResult.email || '',
                                                        branch_name: statusResult.branch_name || '',
                                                        company_reg_no: statusResult.company_reg_no || '',
                                                        branch_address: statusResult.branch_address || '',
                                                        branch_phone: statusResult.branch_phone || ''
                                                    }));
                                                    go('signup-branch');
                                                }}>Reapply Now</PrimaryBtn>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{ marginTop: 24 }}><GhostBtn onClick={() => go('login')}>← Back to Login</GhostBtn></div>
                        </>
                    )}

                </div>
            </div>
        </div>
    );
};
