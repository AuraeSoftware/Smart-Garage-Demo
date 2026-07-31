import React, { useState, useEffect } from 'react';
import { API, token } from '../../utils/api';
import { HowItWorksSidebar } from './HowItWorksSidebar'; 
import { FloatingSignupHook } from '../../components/common/FloatingSignupHook';

export const JobTracking = ({ trackingId, isDark }) => {
  const parsePackageTime = (t) => {
    if (!t) return 0;
    const str = String(t).toLowerCase();
    if (str.includes('h')) return parseFloat(str) * 60;
    if (str.includes('m')) return parseFloat(str);
    return parseFloat(str) || 0;
  };

  const TrackingTimer = ({ startTime, durationMinutes }) => {
    const durationSeconds = durationMinutes * 60;
    const getElapsedSeconds = () => {
      const cleanTime = typeof startTime === 'string' ? startTime.replace('T', ' ').replace(/-/g, '/') : startTime;
      return Math.floor((Date.now() - new Date(cleanTime).getTime()) / 1000);
    };
    const [elapsed, setElapsed] = useState(getElapsedSeconds());
    
    useEffect(() => {
      const int = setInterval(() => setElapsed(getElapsedSeconds()), 1000);
      return () => clearInterval(int);
    }, [startTime]);
    
    const remainingSeconds = Math.max(0, durationSeconds - elapsed);
    const isOverdue = elapsed > durationSeconds;
    
    const formatTime = (totalSeconds) => {
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '8px 12px', background: isOverdue ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', borderRadius: 8, width: 'fit-content' }}>
        <img src={require('../../assets/icons/alarm-icon.png')} alt="timer" style={{ width: 18, height: 18 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: isOverdue ? 'var(--red)' : 'var(--green)' }}>
          {isOverdue ? `Overdue by ${formatTime(elapsed - durationSeconds)}` : `${formatTime(remainingSeconds)} remaining`}
        </span>
      </div>
    );
  };

  const [req, setReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const LogoBrand = isDark ? require('../../assets/smart-garage-dark/smart-garage-dark-theme-v.png') : require('../../assets/smart-garage-light/Smart-Garage-vertical.png');

  const fetchStatus = async () => {
    try {
      const res = await API.jobRequests.trackPublic(trackingId);
      setReq(res);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, [trackingId]);

  if (loading && !req) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}><div className="loading-spinner" /></div>;

  const getStatusStep = (status) => {
    if (status === 'Completed') return 3;
    if (status === 'Assigned') return 2;
    return 1;
  };

  const step = req ? getStatusStep(req.status) : 0;

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
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src={LogoBrand} alt="Smart Garage" style={{ height: 80, display: 'block', margin: '0 auto' }} />
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '16px 0 8px', color: 'var(--text)' }}>Track Your Wash</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>Tracking ID: <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text)' }}>{trackingId}</span></p>
        </div>

        {error ? (
          <div style={{ padding: 16, background: 'rgba(239,68,68,0.1)', color: 'var(--red)', borderRadius: 12, fontSize: 14, fontWeight: 600, textAlign: 'center' }}>{error}</div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: 30 }}>
            {/* Timeline Line */}
            <div style={{ position: 'absolute', top: 10, bottom: 20, left: 9, width: 2, background: 'var(--border-2)', borderRadius: 2 }} />
            <div style={{ position: 'absolute', top: 10, bottom: step === 3 ? 20 : step === 2 ? '50%' : '100%', left: 9, width: 2, background: 'var(--accent)', borderRadius: 2, transition: 'bottom 0.5s ease' }} />

            {/* Step 1: Request Received */}
            <div style={{ position: 'relative', marginBottom: 30 }}>
              <div style={{ position: 'absolute', left: -27, top: 4, width: 14, height: 14, borderRadius: '50%', background: step >= 1 ? 'var(--accent)' : 'var(--bg-3)', border: `3px solid ${step >= 1 ? 'var(--accent-dim)' : 'var(--border)'}`, zIndex: 2 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: step >= 1 ? 'var(--text)' : 'var(--text-3)' }}>Request Received</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>We have received your wash request.</div>
            </div>

            {/* Step 2: Washer Assigned */}
            <div style={{ position: 'relative', marginBottom: 30 }}>
              <div style={{ position: 'absolute', left: -27, top: 4, width: 14, height: 14, borderRadius: '50%', background: step >= 2 ? 'var(--accent)' : 'var(--bg-3)', border: `3px solid ${step >= 2 ? 'var(--accent-dim)' : 'var(--border)'}`, zIndex: 2 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: step >= 2 ? 'var(--text)' : 'var(--text-3)' }}>Washer Assigned</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>A washer has been assigned and is heading to you or preparing.</div>
              {req?.job?.status === 'pending' && req?.job?.packageTime && step === 2 && (
                <TrackingTimer 
                  startTime={req.job.submittedAt} 
                  durationMinutes={parsePackageTime(req.job.packageTime)} 
                />
              )}
            </div>

            {/* Step 3: Completed */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: -27, top: 4, width: 14, height: 14, borderRadius: '50%', background: step >= 3 ? 'var(--green)' : 'var(--bg-3)', border: `3px solid ${step >= 3 ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`, zIndex: 2 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: step >= 3 ? 'var(--text)' : 'var(--text-3)' }}>Completed</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Your wash is complete. Thank you for choosing Smart Garage!</div>
            </div>
          </div>
        )}
        </div>
      </div>
      <FloatingSignupHook />
    </div>
  );
};
