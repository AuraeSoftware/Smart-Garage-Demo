import React, { useState, useEffect } from 'react';
import { getCurrency, getConvertedPrice } from '../../utils/messaging';
import { Card, SectionTitle, Chip, Modal, Btn, Inp } from '../../components/common/UI';
import ActiveIcon from '../../assets/icons/active-icon.png';
import { API } from '../../utils/api';

export const MyPlanPage = ({ currentUser, branchSubscription, data }) => {
  const curr = getCurrency(currentUser?.phone);
  const getRazorpayCurrencyCode = (c) => {
    if (c === 'INR') return 'INR';
    if (c === 'SGD') return 'SGD';
    if (c === '$') return 'USD';
    if (c === 'Rp') return 'IDR';
    return 'MYR';
  };
  const currencyCode = getRazorpayCurrencyCode(curr);
  const isSuperOrSupreme = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'SupremeAdmin' || currentUser?.role === 'super_admin';

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(branchSubscription?.id);
  const [pay, setPay] = useState({ transactionId: '', accountName: '', paymentDate: new Date().toISOString().split('T')[0] });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [qrData, setQrData] = useState('Payment');
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [dynamicQrUrl, setDynamicQrUrl] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [qrLoading, setQrLoading] = useState(false);

  const [bankDetails, setBankDetails] = useState({ bankName: 'Maybank', accountNumber: '1234 5678 9012', accountHolder: 'Supreme Admin Co.' });
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const handleDownloadReceipt = (tx) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt - ${tx.transaction_id || tx.id}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #333; }
            .receipt-box { max-width: 600px; margin: auto; border: 1px solid #eee; padding: 30px; box-shadow: 0 0 10px rgba(0,0,0,0.1); border-radius: 8px; }
            .header { text-align: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
            .header h2 { margin: 0; color: #da1a31; font-weight: 900; }
            .details table { width: 100%; border-collapse: collapse; }
            .details th, .details td { padding: 12px 0; border-bottom: 1px solid #eee; text-align: left; }
            .total { font-size: 20px; font-weight: 800; text-align: right; margin-top: 20px; }
            .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #777; }
            @media print {
              body { padding: 0; }
              .receipt-box { box-shadow: none; border: none; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-box">
            <div class="header">
              <h2>Smart Garage Supreme</h2>
              <p>Subscription Payment Receipt</p>
            </div>
            <div class="details">
              <table>
                <tr><th>Date</th><td>${new Date((tx.created_at || tx.payment_date).replace('Z', '')).toLocaleString('en-GB')}</td></tr>
                <tr><th>Transaction ID</th><td>${tx.transaction_id || tx.id}</td></tr>
                <tr><th>Plan</th><td>${tx.plan_name || tx.plan_id}</td></tr>
                <tr><th>Status</th><td style="color: #059669; font-weight: 700;">${(tx.status || 'Paid').toUpperCase()}</td></tr>
              </table>
            </div>
            <div class="total">
              Amount Paid: ${tx.currency} ${tx.amount}
            </div>
            <div class="footer">
              Thank you for subscribing to Smart Garage Supreme.<br>
              This is a computer-generated receipt.
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); window.onafterprint = function(){ window.close(); } }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    setLoadingHistory(true);
    API.subscriptions.history().then(data => {
      setHistory(data || []);
    }).catch(() => {}).finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    API.settings.getSupremeQR().then(res => {
      if (res && res.value) setQrData(res.value);
    }).catch(() => { });
    API.settings.getSupremeBankDetails().then(data => {
      if (data) setBankDetails(data);
    }).catch(() => { });
  }, []);

  useEffect(() => {
    const handlePlanUpgraded = () => {
      setTimeout(() => window.location.reload(), 2000);
    };
    window.addEventListener('plan_upgraded', handlePlanUpgraded);
    return () => window.removeEventListener('plan_upgraded', handlePlanUpgraded);
  }, []);

  useEffect(() => {
    let interval;
    if (orderNumber && paymentMethod === 'dynamic_qr') {
      interval = setInterval(async () => {
        try {
          const res = await API.payment.getSubscriptionStatus(orderNumber);
          if (res.status === 'PAID' || res.status === 'paid' || res.status === 'Completed' || res.status === 'success') {
            clearInterval(interval);
            const successPayment = {
              transactionId: res.payment_id || orderNumber,
              accountName: currentUser?.name || currentUser?.username || 'Admin',
              paymentDate: new Date().toISOString(),
              currency: curr
            };
            handleUpgrade(successPayment);
          }
        } catch (e) { }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [orderNumber, paymentMethod]);

  if (!branchSubscription) return null;

  // Find the user's primary branch to get the expiry date
  const myBranches = (data.branches || []).filter(b => b.owner_id === currentUser.id);
  const userBranchId = currentUser?.branch_id || currentUser?.branchId;
  const activeBranch = (data.branches || []).find(b => b.id === userBranchId);
  const mainBranch = activeBranch || myBranches[0];
  const expiryDate = mainBranch?.expiry_date;
  const isExpired = expiryDate ? new Date(expiryDate) < new Date() : false;

  const features = [
    { key: 'has_loyalty', label: 'Loyalty Settings' },
    { key: 'has_qr', label: 'QR Manager' },
    { key: 'has_reports', label: 'Advanced Reports' },
    { key: 'has_ai_scanning', label: 'AI Scanning' },
    { key: 'has_multiple_branches', label: 'Multiple Branches' },
  ];

  const handleUpgrade = async (paymentData = null) => {
    setLoading(true); setError(''); setSuccess('');
    try {
      const selectedPlanInfo = (data.subscriptionPlans || []).find(p => p.id === selectedPlanId);
      let priceType = 'price';
      let priceStr = selectedPlanInfo?.price;
      if (billingCycle === 'annual' && selectedPlanInfo?.annual_price) {
        priceStr = selectedPlanInfo.annual_price;
        priceType = 'annual_price';
      } else if (billingCycle === 'monthly' && selectedPlanInfo?.monthly_price) {
        priceStr = selectedPlanInfo.monthly_price;
        priceType = 'monthly_price';
      }
      
      const calcAmount = selectedPlanInfo ? getConvertedPrice(priceStr, curr, selectedPlanInfo.id, priceType) : 0;
      
      let activePay = paymentData || pay || { currency: curr };
      activePay = { ...activePay, amount: activePay.amount || calcAmount };
      const payload = {
        userId: currentUser.id,
        branchId: mainBranch?.id,
        newPlanId: selectedPlanId,
        billing_cycle: billingCycle,
        payment: activePay
      };
      await API.subscriptions.upgradePlan(payload);
      setSuccess('Upgrade request submitted! Pending Supreme Admin verification.');
      setTimeout(() => {
        setShowUpgrade(false);
        setSuccess('');
        setPay({ transactionId: '', accountName: '', paymentDate: '' });
        window.location.reload();
      }, 3000);
    } catch (err) {
      setError(err.message || 'Failed to request upgrade');
    }
    setLoading(false);
  };

  const generateDynamicQr = async () => {
    setQrLoading(true); setError(''); setDynamicQrUrl('');
    try {
      const selectedPlanInfo = (data.subscriptionPlans || []).find(p => p.id === selectedPlanId);
      
      let priceType = 'price';
      let priceStr = selectedPlanInfo.price;
      if (billingCycle === 'annual' && selectedPlanInfo.annual_price) {
        priceStr = selectedPlanInfo.annual_price;
        priceType = 'annual_price';
      } else if (billingCycle === 'monthly' && selectedPlanInfo.monthly_price) {
        priceStr = selectedPlanInfo.monthly_price;
        priceType = 'monthly_price';
      }
      
      const prefixMatch = String(selectedPlanPriceStr).match(/^([^\d\s.,]+)\s*/);
      const displayCurr = prefixMatch ? prefixMatch[1].trim() : curr;
      let finalCurrencyCode = displayCurr;
      if (displayCurr === 'RM') finalCurrencyCode = 'MYR';
      else if (displayCurr === '$') finalCurrencyCode = 'USD';
      else if (displayCurr === 'Rp') finalCurrencyCode = 'IDR';
      else if (displayCurr === '€') finalCurrencyCode = 'EUR';
      else if (displayCurr === '£') finalCurrencyCode = 'GBP';

      const amountStr = String(selectedPlanPriceStr).replace(prefixMatch ? prefixMatch[0] : '', '');
      const amount = parseFloat(amountStr.replace(/[^0-9.]/g, '')) || 0;
      
      const res = await API.payment.createSubscriptionQr(selectedPlanId, amount, finalCurrencyCode);
      setDynamicQrUrl(res.qr_url);
      setOrderNumber(res.order_id);
    } catch (err) {
      setError(err.message || "Failed to generate dynamic QR. Please check Razorpay keys.");
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
      const selectedPlanInfo = (data.subscriptionPlans || []).find(p => p.id === selectedPlanId);

      let priceType = 'price';
      let priceStr = selectedPlanInfo.price;
      if (billingCycle === 'annual' && selectedPlanInfo.annual_price) {
        priceStr = selectedPlanInfo.annual_price;
        priceType = 'annual_price';
      } else if (billingCycle === 'monthly' && selectedPlanInfo.monthly_price) {
        priceStr = selectedPlanInfo.monthly_price;
        priceType = 'monthly_price';
      }

      const prefixMatch = String(selectedPlanPriceStr).match(/^([^\d\s.,]+)\s*/);
      const displayCurr = prefixMatch ? prefixMatch[1].trim() : curr;
      let finalCurrencyCode = displayCurr;
      if (displayCurr === 'RM') finalCurrencyCode = 'MYR';
      else if (displayCurr === '$') finalCurrencyCode = 'USD';
      else if (displayCurr === 'Rp') finalCurrencyCode = 'IDR';
      else if (displayCurr === '€') finalCurrencyCode = 'EUR';
      else if (displayCurr === '£') finalCurrencyCode = 'GBP';

      const amountStr = String(selectedPlanPriceStr).replace(prefixMatch ? prefixMatch[0] : '', '');
      const amount = parseFloat(amountStr.replace(/[^0-9.]/g, '')) || 0;

      const { order_id } = await API.payment.createRazorpayOrder(amount, true, finalCurrencyCode);

      const options = {
        key: key_id,
        amount: Math.round(amount * 100),
        currency: finalCurrencyCode,
        name: "Smart Garage Supreme",
        description: `Upgrade to ${selectedPlanInfo.label}`,
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
              accountName: currentUser.name || currentUser.username,
              paymentDate: new Date().toISOString(),
              currency: curr
            };
            setPay(successPayment);
            handleUpgrade(successPayment);
          } catch (err) {
            setError("Payment verification failed. Please contact support.");
            setLoading(false);
          }
        },
        prefill: {
          name: currentUser.name || currentUser.username,
          email: currentUser.email || '',
          contact: currentUser.phone || ''
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

  const selectedPlanInfo = (data.subscriptionPlans || []).find(p => p.id === selectedPlanId);

  let selectedPlanPriceStr = selectedPlanInfo ? `${curr} ${getConvertedPrice(selectedPlanInfo.price, curr, selectedPlanInfo.id, 'price')}` : '';
  if (selectedPlanInfo) {
    if (billingCycle === 'annual' && selectedPlanInfo.annual_price) {
      selectedPlanPriceStr = `${curr} ${getConvertedPrice(selectedPlanInfo.annual_price, curr, selectedPlanInfo.id, 'annual_price')}`;
    } else if (billingCycle === 'monthly' && selectedPlanInfo.monthly_price) {
      selectedPlanPriceStr = `${curr} ${getConvertedPrice(selectedPlanInfo.monthly_price, curr, selectedPlanInfo.id, 'monthly_price')}`;
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <SectionTitle title="My Subscription Plan" subtitle="View your current plan details and active features" />
        <Btn onClick={() => { setShowUpgrade(true); setSelectedPlanId(branchSubscription?.id); }} style={{ background: 'var(--accent)', color: '#fff', fontWeight: 700 }}>
          Upgrade Plan
        </Btn>
      </div>

      <Card style={{ marginTop: 24, padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Active Plan
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: branchSubscription.color || 'var(--accent)' }} />
              <h1 style={{ fontSize: 32, margin: 0, fontWeight: 800, color: branchSubscription.color || 'var(--text)' }}>
                {branchSubscription.label || 'Trial'}
              </h1>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Status
            </div>
            {expiryDate ? (
              new Date(expiryDate) < new Date() ? (
                <Chip color="var(--red)">Expired on {new Date(expiryDate).toLocaleDateString('en-GB')}</Chip>
              ) : (
                <Chip color={branchSubscription.color || "var(--green)"}>Active until {new Date(expiryDate).toLocaleDateString('en-GB')}</Chip>
              )
            ) : (
              <Chip color={branchSubscription.color || "var(--green)"}>Active</Chip>
            )}
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '32px 0' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 24 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8 }}>Price</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              {branchSubscription.price ? ((branchSubscription.price || '').toString().toLowerCase().includes('free') ? 'Free' : `${curr} ${getConvertedPrice(branchSubscription.price, curr, branchSubscription.id, 'price')}`) : 'Free'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8 }}>Monthly</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              {branchSubscription.monthly_price > 0 ? `${curr} ${getConvertedPrice(branchSubscription.monthly_price, curr, branchSubscription.id, 'monthly_price')}` : (branchSubscription.id === 'trial' || (branchSubscription.price || '').toString().toLowerCase().includes('free') ? 'Free' : 'N/A')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8 }}>Annual</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              {branchSubscription.annual_price > 0 ? `${curr} ${getConvertedPrice(branchSubscription.annual_price, curr, branchSubscription.id, 'annual_price')}` : (branchSubscription.id === 'trial' || (branchSubscription.price || '').toString().toLowerCase().includes('free') ? 'Free' : 'N/A')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8 }}>Billing Cycle</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              {branchSubscription.id === 'trial' ? '14 Days' : (currentUser?.paymentInfo?.billing_cycle === 'annual' || currentUser?.paymentInfo?.billing_cycle === 'annually' ? '/year' : '/month')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8 }}>Max Workers</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              {branchSubscription.max_washers === 0 ? 'Unlimited' : branchSubscription.max_washers}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8 }}>Max Sessions</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              {branchSubscription.max_sessions === 0 ? 'Unlimited' : branchSubscription.max_sessions}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8 }}>Max Branches</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              {branchSubscription.max_branches === 0 ? 'Unlimited' : (branchSubscription.max_branches || 'Unlimited')}
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '32px 0' }} />

        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
          Module Access
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {features.map(f => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {branchSubscription[f.key] ? (
                <img src={ActiveIcon} alt="Active" style={{ width: 20, height: 20 }} />
              ) : (
                <div style={{ width: 20, height: 20, borderRadius: 4, background: 'var(--bg-3)' }} />
              )}
              <span style={{
                fontSize: 14,
                fontWeight: branchSubscription[f.key] ? 600 : 400,
                color: branchSubscription[f.key] ? (branchSubscription.color || 'var(--text)') : 'var(--text-3)',
                textDecoration: branchSubscription[f.key] ? 'none' : 'line-through'
              }}>
                {f.label}
              </span>
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '32px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
            Transaction History
          </div>
          <Btn variant="outline" onClick={() => setShowHistoryModal(true)} style={{ fontSize: 13, padding: '8px 16px' }}>
            View History
          </Btn>
        </div>

      </Card>

      {/* Upgrade Modal */}
      <Modal title="Upgrade Subscription Plan" open={showUpgrade} onClose={() => setShowUpgrade(false)} maxWidth={550}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Select a Plan</div>
            <div style={{ display: 'flex', background: 'var(--bg-3)', padding: 4, borderRadius: 8 }}>
              <button
                onClick={() => setBillingCycle('monthly')}
                style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, border: 'none', cursor: 'pointer', background: billingCycle === 'monthly' ? 'var(--card)' : 'transparent', color: billingCycle === 'monthly' ? 'var(--text)' : 'var(--text-3)', fontWeight: 700, transition: 'all 0.2s', boxShadow: billingCycle === 'monthly' ? 'var(--shadow-sm)' : 'none' }}>
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, border: 'none', cursor: 'pointer', background: billingCycle === 'annual' ? 'var(--card)' : 'transparent', color: billingCycle === 'annual' ? 'var(--text)' : 'var(--text-3)', fontWeight: 700, transition: 'all 0.2s', boxShadow: billingCycle === 'annual' ? 'var(--shadow-sm)' : 'none' }}>
                Annually
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(data.subscriptionPlans || [])
              .filter(plan => plan.id !== 'trial')
              .filter(plan => !(billingCycle === 'annual' && (!plan.annual_price || plan.annual_price <= 0)))
              .map(plan => {
                let planPriceStr = `${curr} ${getConvertedPrice(plan.price, curr, plan.id, 'price')}`;
                if (billingCycle === 'annual' && plan.annual_price) planPriceStr = `${curr} ${getConvertedPrice(plan.annual_price, curr, plan.id, 'annual_price')}`;
                else if (billingCycle === 'monthly' && plan.monthly_price) planPriceStr = `${curr} ${getConvertedPrice(plan.monthly_price, curr, plan.id, 'monthly_price')}`;

                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    style={{
                      width: '100%', padding: '14px 16px', borderRadius: 12,
                      border: `2px solid ${selectedPlanId === plan.id ? (plan.color || 'var(--accent)') : 'var(--border)'}`,
                      background: selectedPlanId === plan.id ? `${plan.color || 'var(--accent)'}10` : 'var(--bg-3)',
                      cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: selectedPlanId === plan.id ? (plan.color || 'var(--accent)') : 'var(--text)' }}>
                        {plan.label} {branchSubscription?.id === plan.id && <Chip size="sm" style={{ marginLeft: 8 }}>Current</Chip>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Workers: {plan.max_washers === 0 ? 'Unlimited' : plan.max_washers} · Sessions: {plan.max_sessions === 0 ? 'Unlimited' : plan.max_sessions} · Branches: {plan.max_branches === 0 ? 'Unlimited' : (plan.max_branches || 'Unlimited')}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {billingCycle === 'annual' && plan.annual_price > 0 && plan.monthly_price > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-2)', textDecoration: 'line-through', marginBottom: 2, fontWeight: 500 }}>
                          {`${curr} ${getConvertedPrice(plan.monthly_price, curr, plan.id, 'monthly_price') * 12}`}
                        </div>
                      )}
                      <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)' }}>{planPriceStr}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{plan.id === 'trial' ? plan.duration : (billingCycle === 'annual' ? '/year' : '/month')}</div>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {selectedPlanId && (selectedPlanId !== branchSubscription?.id || isExpired) && selectedPlanInfo?.price !== '{curr} 0' && (
          <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 12 }}>Payment Details</div>

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
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--text)', marginBottom: 24 }}>{selectedPlanPriceStr}</div>

                <Btn
                  full
                  onClick={handleRazorpayCheckout}
                  disabled={loading}
                  style={{ padding: '16px', fontSize: 16 }}
                >
                  {loading ? 'Processing...' : 'Pay securely with Razorpay →'}
                </Btn>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12 }}>You will be redirected to our secure payment gateway.</div>
              </div>
            ) : paymentMethod === 'dynamic_qr' ? (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--text)', marginBottom: 24 }}>{selectedPlanPriceStr}</div>
                
                {!dynamicQrUrl ? (
                  <Btn full onClick={generateDynamicQr} disabled={qrLoading} style={{ padding: '16px', fontSize: 16 }}>
                    {qrLoading ? 'Generating QR Code...' : 'Generate Dynamic QR Code'}
                  </Btn>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <img src={dynamicQrUrl} alt="Razorpay QR" style={{ width: 200, height: 200, borderRadius: 12, border: '2px solid var(--border)', marginBottom: 16 }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--amber)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                      Waiting for payment scan...
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {error && <div style={{ background: 'rgba(218,26,49,0.07)', border: '1px solid rgba(218,26,49,0.2)', borderRadius: 9, padding: '10px 14px', fontSize: 14, color: 'var(--red)', marginBottom: 14 }}>{error}</div>}
        {success && <div style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#059669', marginBottom: 14 }}>{success}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          {(!selectedPlanId || (selectedPlanId === branchSubscription?.id && !isExpired) || selectedPlanInfo?.price === '{curr} 0') && paymentMethod !== 'dynamic_qr' && (
            <Btn
              full
              onClick={() => handleUpgrade(null)}
              disabled={loading || (selectedPlanId === branchSubscription?.id && !isExpired)}
            >
              {loading ? 'Submitting...' : (isExpired && selectedPlanId === branchSubscription?.id ? 'Submit Renewal Request' : 'Submit Upgrade Request')}
            </Btn>
          )}
          <Btn full variant="ghost" onClick={() => setShowUpgrade(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* History Modal */}
      <Modal title="Transaction History" open={showHistoryModal} onClose={() => setShowHistoryModal(false)} maxWidth={700}>
        <div style={{ marginTop: 10 }}>
          {loadingHistory ? (
             <div style={{ fontSize: 14, color: 'var(--text-3)' }}>Loading history...</div>
          ) : history.length === 0 ? (
             <div style={{ fontSize: 14, color: 'var(--text-3)' }}>No transaction history found.</div>
          ) : (
             <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
               <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                 <thead>
                   <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-3)' }}>
                     <th style={{ padding: '12px 8px', fontWeight: 600 }}>Date</th>
                     {isSuperOrSupreme && <th style={{ padding: '12px 8px', fontWeight: 600 }}>User / Branch</th>}
                     <th style={{ padding: '12px 8px', fontWeight: 600 }}>Plan</th>
                     <th style={{ padding: '12px 8px', fontWeight: 600 }}>Amount</th>
                     <th style={{ padding: '12px 8px', fontWeight: 600 }}>Transaction ID</th>
                     <th style={{ padding: '12px 8px', fontWeight: 600 }}>Status</th>
                     <th style={{ padding: '12px 8px', fontWeight: 600 }}>Action</th>
                   </tr>
                 </thead>
                 <tbody>
                   {history.map(tx => (
                     <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-2)' }}>
                       <td style={{ padding: '12px 8px', color: 'var(--text)' }}>{tx.created_at || tx.payment_date ? new Date((tx.created_at || tx.payment_date).replace('Z', '')).toLocaleString('en-GB') : '-'}</td>
                       {isSuperOrSupreme && (
                         <td style={{ padding: '12px 8px', color: 'var(--text)' }}>
                           <div style={{ fontWeight: 600 }}>{tx.user_name || '-'}</div>
                           <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{tx.branch_name || tx.branch_id || '-'}</div>
                         </td>
                       )}
                       <td style={{ padding: '12px 8px', color: 'var(--text)' }}>{tx.plan_name || tx.plan_id}</td>
                       <td style={{ padding: '12px 8px', color: 'var(--text)' }}>{tx.currency} {tx.amount}</td>
                       <td style={{ padding: '12px 8px', color: 'var(--text-2)', fontSize: 12 }}>{tx.transaction_id || '-'}</td>
                       <td style={{ padding: '12px 8px' }}>
                         <Chip size="sm" color={tx.status === 'success' || tx.status === 'completed' || tx.status === 'PAID' ? 'var(--green)' : tx.status === 'pending' ? 'var(--amber)' : 'var(--red)'}>
                           {tx.status || 'unknown'}
                         </Chip>
                       </td>
                       <td style={{ padding: '12px 8px' }}>
                         {(tx.status === 'success' || tx.status === 'completed' || tx.status === 'PAID' || tx.status === 'Verified') && (
                           <button 
                             onClick={() => handleDownloadReceipt(tx)}
                             style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}
                           >
                             Receipt
                           </button>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          )}
        </div>
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowHistoryModal(false)}>Close</Btn>
        </div>
      </Modal>

    </div>
  );
};
