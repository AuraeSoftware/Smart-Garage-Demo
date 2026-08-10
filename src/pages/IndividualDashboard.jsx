import React, { useState, useEffect } from 'react';
import { useHashNav } from '../hooks/useHashNav';
import { ThemeToggle, Chip, Card } from '../components/common/UI';
import NotificationsDropdown from '../components/common/NotificationsDropdown';
import { API } from '../utils/api';
import { generateInvoicePDF } from '../utils/pdf';
import { openWhatsApp, getCurrency } from '../utils/messaging';
import logoLight from "../assets/smart-garage-light/Smart-Garage-h.png";
import logoDark from "../assets/smart-garage-dark/smart-garage-dark-theme-har.png";
import eligible from "../assets/icons/eligible-icon.png";
import carwashIcon from "../assets/icons/car-icon.png";
import revenueIcon from "../assets/icons/currancy-icon.png";
import couponIcon from "../assets/icons/gift-icon.png";
import starIcon from "../assets/icons/diamond-icon.png";
import workerIcon from "../assets/icons/worker-icon.png";
import calendarIcon from "../assets/icons/calendar-icon.png";

export const IndividualDashboard = ({ user, onLogout, isDark, onToggleTheme }) => {
  const curr = getCurrency(user?.phone) || 'RM';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useHashNav('overview'); // overview | invoices | loyalty
  const [selInv, setSelInv] = useState(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const fetchData = () => {
      API.individual.dashboard()
        .then(d => { setData(d); setLoading(false); })
        .catch(() => setLoading(false));
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const sessions = data?.sessions || [];
  const activeJobs = data?.active_jobs || [];
  const customer = data?.customer || {};
  const loyalty = data?.loyalty_cfg || {};
  const coupons = customer.coupon_history || [];
  const visits = customer.visits || [];
  const totalWashes = data?.total_washes || 0;
  const totalSpend = data?.total_spend || 0;
  const visitThreshold = loyalty.visitThreshold || 3;
  const isEligible = visits.length >= visitThreshold;
  const progressPct = Math.min(100, (visits.length / visitThreshold) * 100);

  // Aggregate vehicle details from sessions
  const vehicles = {};
  sessions.forEach(s => {
    const v = s.vehicle || {};
    const key = v.plate || `${v.make}-${v.model}`;
    if (key && !vehicles[key]) vehicles[key] = { ...v, count: 0 };
    if (key) vehicles[key].count++;
  });

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
        <img src={require('../assets/icons/alarm-icon.png')} alt="timer" style={{ width: 18, height: 18 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: isOverdue ? 'var(--red)' : 'var(--green)' }}>
          {isOverdue ? `Overdue by ${formatTime(elapsed - durationSeconds)}` : `${formatTime(remainingSeconds)} remaining`}
        </span>
      </div>
    );
  };

  const NavBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{
      padding: '8px 18px', borderRadius: 9, border: `1.5px solid ${tab === id ? 'var(--accent)' : 'var(--border)'}`,
      background: tab === id ? 'var(--accent-dim)' : 'transparent',
      color: tab === id ? 'var(--accent)' : 'var(--text-2)',
      fontWeight: tab === id ? 700 : 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
    }}>{label}</button>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '0 20px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        {/* Left Placeholder */}
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
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{user.phone}</div>
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

        {/* Right: User Info & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flex: 1, position: 'relative', zIndex: 10 }}>
          <NotificationsDropdown user={user} sessions={sessions} loyalty={loyalty} />
          <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
        </div>
      </header>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
        <div style={{ flex: 1, maxWidth: 720, width: '100%', margin: '0 auto', padding: '24px 16px', boxSizing: 'border-box' }} className="page-enter">
          {/* Welcome */}

          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 4 }}>My Dashboard</h1>
            <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Welcome back, {user.name} · {user.phone}</p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', margin: '0 auto 14px', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading your history...</div>
            </div>
          ) : (
            <>
              {/* KPI cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
                {[
                  { icon: <img src={carwashIcon} alt="Washes" style={{ width: 24, height: 24 }} />, label: 'Total Washes', value: totalWashes },
                  { icon: <img src={revenueIcon} alt="Spent" style={{ width: 24, height: 24 }} />, label: 'Total Spent', value: `${curr} ${totalSpend.toLocaleString()}` },
                  { icon: <img src={couponIcon} alt="Coupons" style={{ width: 24, height: 24 }} />, label: 'Coupons Used', value: customer.coupons_redeemed || 0 },
                  { icon: <img src={starIcon} alt="Loyalty" style={{ width: 24, height: 24 }} />, label: 'Loyalty Points', value: `${visits.length}/${visitThreshold}` },
                ].map(({ icon, label, value }) => (
                  <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '16px 18px', boxShadow: 'var(--shadow)' }}>
                    <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>{value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Loyalty progress */}
              {loyalty.enabled !== false && (
                <Card style={{ marginBottom: 22 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 3 }}><img src={eligible} alt="" style={{ width: 18, height: 18, marginRight: 6, verticalAlign: 'middle' }} /> Loyalty Progress</div>
                      <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                        {isEligible ? 'You have earned a reward!' : `${visitThreshold - visits.length} more wash${visitThreshold - visits.length !== 1 ? 'es' : ''} to earn a ${loyalty.discountType === 'percent' ? `${loyalty.discountValue}%` : `${curr} ${loyalty.discountValue}`} discount`}
                      </div>
                    </div>
                    {isEligible && <Chip color="var(--green)"><img src={eligible} alt="" style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} /> Eligible</Chip>}
                  </div>
                  <div style={{ height: 8, background: 'var(--bg-3)', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: `${progressPct}%`, background: isEligible ? 'var(--green)' : 'var(--accent)', borderRadius: 99, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-3)' }}>
                    <span>{visits.length} visits completed</span>
                    <span>Goal: {visitThreshold} visits</span>
                  </div>
                </Card>
              )}

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                <NavBtn id="overview" label="Overview" />
                <NavBtn id="invoices" label={`Invoices (${sessions.length})`} />
                <NavBtn id="loyalty" label={`Coupons (${coupons.length})`} />
              </div>

              {/* ── Overview ── */}
              {tab === 'overview' && (
                <>
                  {/* Live Tracker */}
                  {activeJobs.length > 0 && (
                    <Card style={{ marginBottom: 16, background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--accent)', marginBottom: 14, display: 'flex', alignItems: 'center' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--accent)', borderRadius: '50%', marginRight: 8, animation: 'stepPulse 2s infinite' }} />
                        Live Tracker
                      </div>
                      {activeJobs.map(job => (
                        <div key={job.id} style={{ background: 'var(--bg)', borderRadius: 10, padding: '16px', marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15 }}>{job.vehicle?.make} {job.vehicle?.model}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{job.package?.name}</div>
                            </div>
                            {(() => {
                              const stat = (job.status || 'pending').toLowerCase();
                              const hasWasher = !!job.washer;
                              const isCompleted = stat === 'completed';
                              const isInProgress = stat === 'in_progress';
                              const isAssigned = stat === 'assigned' || (stat === 'pending' && hasWasher);
                              return (
                                <Chip color={isCompleted ? 'var(--green)' : isInProgress ? 'var(--blue)' : isAssigned ? 'var(--accent)' : 'var(--amber)'}>
                                  {isCompleted ? 'Job Completed' : isInProgress ? 'Job in Progress' : isAssigned ? 'Worker on the way' : 'Looking for Worker'}
                                </Chip>
                              );
                            })()}
                          </div>
                          {job.washer && (
                            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                              <img src={workerIcon} alt="" style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 6 }} />
                              Assigned Worker: {job.washer}
                            </div>
                          )}
                          {job.status === 'pending' && job.package?.time && (
                            <TrackingTimer 
                              startTime={job.submittedAt || job.submitted_at} 
                              durationMinutes={parsePackageTime(job.package.time)} 
                            />
                          )}
                          <div style={{ marginTop: 16, display: 'flex', gap: 4 }}>
                            {['pending', 'assigned', 'in_progress', 'completed'].map((s, i) => {
                              const steps = ['pending', 'assigned', 'in_progress', 'completed'];
                              let currentIdx = steps.indexOf((job.status || 'pending').toLowerCase());
                              if (currentIdx === -1) currentIdx = 0;
                              if (currentIdx === 0 && job.washer) currentIdx = 1; // Auto-advance to assigned if washer exists
                              const isActive = i <= currentIdx;
                              return (
                                <div key={s} style={{ flex: 1, height: 4, background: isActive ? 'var(--accent)' : 'var(--bg-3)', borderRadius: 4 }} />
                              );
                            })}
                          </div>
                          {(() => {
                            const steps = ['pending', 'assigned', 'in_progress', 'completed'];
                            let currentIdx = steps.indexOf((job.status || 'pending').toLowerCase());
                            if (currentIdx === -1) currentIdx = 0;
                            if (currentIdx === 0 && job.washer) currentIdx = 1;
                            return (
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>
                                <span style={{ color: currentIdx >= 0 ? 'var(--accent)' : 'var(--text-3)' }}>Pending</span>
                                <span style={{ color: currentIdx >= 1 ? 'var(--accent)' : 'var(--text-3)' }}>Assigned</span>
                                <span style={{ color: currentIdx >= 2 ? 'var(--accent)' : 'var(--text-3)' }}>Washing</span>
                                <span style={{ color: currentIdx >= 3 ? 'var(--accent)' : 'var(--text-3)' }}>Completed</span>
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </Card>
                  )}

                  {/* Vehicles */}
                  <Card style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 14 }}><img src={carwashIcon} alt="" style={{ width: 18, height: 18, marginRight: 6, verticalAlign: 'middle' }} /> My Vehicles</div>
                    {Object.keys(vehicles).length === 0 ? (
                      <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No vehicles on record yet</div>
                    ) : Object.values(vehicles).map((v, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{v.colour} {v.make} {v.model}</div>
                          {v.plate && v.plate !== 'Not Visible' && <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--amber)', marginTop: 2 }}>{v.plate}</div>}
                        </div>
                        <Chip color="var(--accent)">{v.count} wash{v.count !== 1 ? 'es' : ''}</Chip>
                      </div>
                    ))}
                  </Card>

                  {/* Recent sessions */}
                  <Card>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 14 }}>Recent Washes</div>
                    {sessions.length === 0 ? (
                      <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No wash history yet. Visit an Smart Garage branch!</div>
                    ) : sessions.slice(0, 5).map(s => (
                      <div key={s.id} style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{s.vehicle?.make} {s.vehicle?.model}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{s.package?.name} · {s.branch || 'Smart Garage'}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--accent)' }}>{curr} {s.total}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{s.date}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}><img src={workerIcon} alt="" style={{ width: 15, height: 15, verticalAlign: 'text-bottom' }} /> {s.washer} ·  {s.locationName || s.branch}</div>
                      </div>
                    ))}
                  </Card>
                </>
              )}

              {/* ── Invoices ── */}
              {tab === 'invoices' && (
                <div style={{ display: 'block', gap: 14 }}>
                  <div>
                    {sessions.length === 0 ? (
                      <Card><div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-3)' }}>No invoices yet</div></Card>
                    ) : sessions.map(s => (
                      <div key={s.id}
                        style={{ background: 'var(--card)', border: `1px solid ${selInv?.id === s.id ? 'var(--accent)' : 'var(--card-border)'}`, borderRadius: 12, marginBottom: 10, transition: 'all 0.15s', overflow: 'hidden' }}>
                        <div onClick={() => setSelInv(s === selInv ? null : s)} style={{ padding: '14px', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{s.id}</span>
                            <span style={{ fontWeight: 800, color: 'var(--text)', fontSize: 15 }}>{curr} {s.total}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>{s.vehicle?.make} {s.vehicle?.model} · {s.package?.name}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', alignItems: 'center' }}>
                            <span> <img src={workerIcon} alt="" style={{ width: 13, height: 13, verticalAlign: 'text-bottom' }} /> {s.washer}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {s.date}
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: selInv?.id === s.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </span>
                          </div>
                        </div>

                        {/* Dropdown Invoice Details */}
                        {selInv?.id === s.id && (
                          <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-3)' }}>
                            <div style={{ paddingTop: 14 }}>
                              {[
                                ['Date', s.date],
                                ['Vehicle', `${s.vehicle?.colour} ${s.vehicle?.make} ${s.vehicle?.model}`],
                                ['Plate', s.vehicle?.plate || '—'],
                                ['Package', s.package?.name],
                                ['Worker', s.washer],
                                ['Branch', s.branch || '—'],
                                ['Location', s.locationName || '—'],
                                ['Payment', s.payment?.mode],
                              ].map(([l, v]) => (
                                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                                  <span style={{ color: 'var(--text-3)' }}>{l}</span>
                                  <span style={{ fontWeight: 600, color: 'var(--text)', textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                                </div>
                              ))}
                              {s.coupon?.applied && (
                                <div style={{ background: 'rgba(5,150,105,0.07)', borderRadius: 8, padding: '8px 10px', marginTop: 10, fontSize: 12, color: 'var(--green)' }}>
                                  <img src={couponIcon} alt="" style={{ width: 15, height: 15, verticalAlign: 'text-bottom', marginRight: 4 }} /> Coupon: {s.coupon.code} · -{curr} {s.coupon.discountAmount}
                                </div>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 0', marginTop: 10, borderTop: '2px solid var(--border)' }}>
                                <span style={{ fontWeight: 700, fontSize: 14 }}>Total Paid</span>
                                <span style={{ fontWeight: 900, fontSize: 22, color: 'var(--accent)', letterSpacing: '-0.02em' }}>{curr} {s.total}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                                <button onClick={() => openWhatsApp(user.phone, { ...s, currency: curr })}
                                  style={{ flex: 1, padding: '9px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                  WhatsApp
                                </button>
                                <button onClick={() => generateInvoicePDF({ ...s, currency: curr })}
                                  style={{ flex: 1, padding: '9px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                  PDF
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Coupons ── */}
              {tab === 'loyalty' && (
                <Card>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 14 }}> <img src={couponIcon} alt="" style={{ width: 22, height: 22, verticalAlign: 'bottom', marginRight: 4 }} /> Coupon History</div>
                  {coupons.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-3)', fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><img src={couponIcon} alt="" style={{ width: 42, height: 42, opacity: 0.6 }} /></div>
                      No coupons yet. Complete {visitThreshold} washes to earn your first reward!
                    </div>
                  ) : Array.from(new Map(coupons.map(c => [c.code, c])).values()).map((c, i) => (
                    <div key={i} style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>{c.code}</span>
                        <Chip color="var(--green)">Redeemed</Chip>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}> <img src={calendarIcon} alt="" style={{ width: 14, height: 14, verticalAlign: 'text-bottom', marginRight: 4 }} /> {c.usedAt ? new Date(c.usedAt).toLocaleDateString('en-MY') : '—'}</div>
                    </div>
                  ))}
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
