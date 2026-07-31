import React, { useState } from 'react';
import { API, token } from '../../utils/api';
import { Dropdown } from '../../components/common/UI';
import { HowItWorksSidebar } from './HowItWorksSidebar'; 
import { FloatingSignupHook } from '../../components/common/FloatingSignupHook';

export const JobRequestForm = ({ branchId, isDark }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+60');
  const [address, setAddress] = useState('');
  const [packageId, setPackageId] = useState('');
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const LogoBrand = isDark ? require('../../assets/smart-garage-dark/smart-garage-dark-theme-v.png') : require('../../assets/smart-garage-light/Smart-Garage-vertical.png');

  React.useEffect(() => {
    API.packages.list().then(setPackages).catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !phone || !address) {
      setError('Please fill out all required fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fullPhone = `${countryCode}${phone.replace(/^0+/, '')}`;
      const res = await API.jobRequests.createPublic({
        customer_name: name,
        customer_phone: fullPhone,
        address: address,
        branch_id: branchId,
        package_id: packageId || undefined
      });
      // Redirect to tracking page
      window.location.hash = `/track/${res.trackingId}`;
    } catch (err) {
      setError(err.message || 'Failed to submit request');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
        <img src={LogoBrand} alt="Smart Garage" style={{ height: 70 }} />
        <button 
          onClick={() => {
            token.clear();
            sessionStorage.setItem('rwash_login_tab', 'signup-individual');
            window.location.href = window.location.pathname + '?t=' + Date.now() + '#/';
          }}
          style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }}>
          Sign In / Sign Up
        </button>
      </div>

      <div className="public-layout-container">
        <HowItWorksSidebar />
        
        <div className="public-form-container" style={{ background: 'var(--card)', padding: '40px 32px', borderRadius: 24, boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src={LogoBrand} alt="Smart Garage" style={{ height: 80, display: 'block', margin: '0 auto' }} />
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '16px 0 8px', color: 'var(--text)' }}>Request a Wash</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>Fill in your details and we'll assign a washer right away.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', color: 'var(--red)', borderRadius: 10, fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{error}</div>}
          
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Your Name</label>
            <input 
              value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. John Doe"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Mobile Number</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select 
                value={countryCode} 
                onChange={e => setCountryCode(e.target.value)}
                style={{ width: '100px', padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              >
                <option value="+60">+60 (MY)</option>
                <option value="+91">+91 (IN)</option>
                <option value="+65">+65 (SG)</option>
                <option value="+62">+62 (ID)</option>
                <option value="+1">+1 (US)</option>
              </select>
              <input 
                value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 123456789"
                style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Address / Location</label>
            <textarea 
              value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Enter your full address or location details"
              rows={3}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>

          {packages.length > 0 && (
            <Dropdown
              label="Select Wash Package (Optional)"
              value={packageId}
              onChange={setPackageId}
              options={[
                { value: '', label: "— I'll decide later —" },
                ...packages.map(p => ({ value: p.id, label: `${p.name} (RM ${p.price})` }))
              ]}
            />
          )}

          <button 
            type="submit" 
            disabled={loading}
            style={{ marginTop: 8, width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.2s', fontFamily: 'inherit' }}
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>
      </div>
      <FloatingSignupHook />
    </div>
  );
};
