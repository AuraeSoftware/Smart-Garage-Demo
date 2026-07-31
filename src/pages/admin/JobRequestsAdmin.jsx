import React, { useState, useMemo, useEffect } from 'react';
import { getCurrency } from '../../utils/messaging';
import { Card, Btn, Dropdown, Modal } from '../../components/common/UI';
import { checkSessionLimit } from '../../utils/limitCheck';
import LogoMain from '../../assets/smart-garage-light/Smart-Garage-vertical.png';
import LogoIcon from '../../assets/smart-garage-light/Smart-Garage.png';
import JobIcon from '../../assets/icons/job-icon.png';

const parsePackageTime = (t) => {
  if (!t) return 0;
  const str = String(t).toLowerCase();
  if (str.includes('h')) return parseFloat(str) * 60;
  if (str.includes('m')) return parseFloat(str);
  return parseFloat(str) || 0;
};

const AdminJobTimer = ({ startTime, durationMinutes }) => {
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
    <span style={{ fontSize: 11, fontWeight: 700, color: isOverdue ? 'var(--red)' : 'var(--green)' }}>
      {isOverdue ? `Overdue by ${formatTime(elapsed - durationSeconds)}` : `${formatTime(remainingSeconds)} remaining`}
    </span>
  );
};

export const JobRequestsAdmin = ({ jobRequests, users, packages, branches, currentUser, assignJobRequest, notify, pendingJobs, sessions, branchSubscription, onNav }) => {
  const curr = getCurrency(currentUser?.phone);

  const [selectedBranch, setSelectedBranch] = useState('');
  const [assigningReq, setAssigningReq] = useState(null);
  const [selectedWasher, setSelectedWasher] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('');

  // Default branch selection
  React.useEffect(() => {
    if (!selectedBranch) {
      if (currentUser?.role === 'SupremeAdmin') {
        setSelectedBranch('all');
      } else if (currentUser?.branch_id || currentUser?.branchId) {
        setSelectedBranch(currentUser.branch_id || currentUser.branchId);
      } else if (branches && branches.length > 0) {
        setSelectedBranch(branches[0].id);
      }
    }
  }, [branches, currentUser, selectedBranch]);

  const branchObj = branches?.find(b => b.id === selectedBranch);
  const publicUrl = branchObj ? `${window.location.origin}/#/job-request/${branchObj.id}` : '';
  const qrDataUrl = publicUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicUrl)}&color=0a1020&bgcolor=ffffff` : '';

  const filteredRequests = useMemo(() => {
    return (jobRequests || []).filter(r => selectedBranch === 'all' || r.branchId === selectedBranch);
  }, [jobRequests, selectedBranch]);

  const washers = useMemo(() => {
    return (users || []).filter(u => {
      if (u.role !== 'Washer' || u.status !== 'Active' || u.is_locked) return false;
      if (selectedBranch !== 'all' && u.branch_id !== selectedBranch && u.branchId !== selectedBranch) return false;
      
      const pendingCount = (pendingJobs || []).filter(j => (j.washerId || j.washer_id) === u.id && j.status !== 'Completed').length;
      return pendingCount === 0;
    });
  }, [users, selectedBranch, pendingJobs]);

  const handleAssignClick = (req) => {
    if (!checkSessionLimit(sessions, branchSubscription, onNav)) return;
    setAssigningReq(req);
    setSelectedWasher('');
    setSelectedPackage(req.packageId || req.package_id || '');
  };

  const handleAssignSubmit = async () => {
    if (!selectedWasher) {
      notify('Please select a washer', 'warn');
      return;
    }
    try {
      await assignJobRequest(assigningReq.id, {
        washer_id: parseInt(selectedWasher, 10),
        package_id: selectedPackage || null
      });
      notify('Job assigned successfully!', 'success');
      setAssigningReq(null);
    } catch (err) {
      notify(err.message || 'Failed to assign job', 'error');
    }
  };

  const handleDownloadQr = async () => {
    if (!qrDataUrl) return;

    try {
      const loadImage = (src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

      const [mainLogo, iconLogo, qrImg] = await Promise.all([
        loadImage(LogoMain),
        loadImage(LogoIcon),
        loadImage(qrDataUrl)
      ]);

      const canvasWidth = 800;
      const mainLogoWidth = 360;
      const mainLogoHeight = mainLogoWidth * (mainLogo.height / mainLogo.width);
      const mainLogoX = (canvasWidth - mainLogoWidth) / 2;
      const mainLogoY = 80;

      const lineY1 = mainLogoY + mainLogoHeight + 50;
      const textY = lineY1 + 70;
      const qrWidth = 460;
      const qrX = (canvasWidth - qrWidth) / 2;
      const qrY = textY + 60;
      const textY2 = qrY + qrWidth + 70;

      const iconWidth = 100;
      const iconHeight = iconWidth * (iconLogo.height / iconLogo.width);
      const iconX = (canvasWidth - iconWidth) / 2;
      const iconY = textY2 + 30;

      const canvasHeight = iconY + iconHeight + 60;

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');

      // Fill background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Main Logo (Top)
      ctx.drawImage(mainLogo, mainLogoX, mainLogoY, mainLogoWidth, mainLogoHeight);

      // Lines above text
      ctx.beginPath();
      ctx.moveTo(200, lineY1);
      ctx.lineTo(600, lineY1);
      ctx.strokeStyle = '#e5e7eb'; // light border color
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text "SCAN & REQUEST"
      ctx.font = 'bold 76px "Inter", "Arial Black", sans-serif';
      const w1 = ctx.measureText("SCAN ").width;
      const w2 = ctx.measureText("&").width;
      const w3 = ctx.measureText(" REQUEST").width;
      const startX = (canvas.width - (w1 + w2 + w3)) / 2;
      
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#111111';
      ctx.fillText("SCAN ", startX, textY);
      ctx.fillStyle = '#dc2626'; // Smart Garage Red
      ctx.fillText("&", startX + w1, textY);
      ctx.fillStyle = '#111111';
      ctx.fillText(" REQUEST", startX + w1 + w2, textY);

      // QR Code
      ctx.drawImage(qrImg, qrX, qrY, qrWidth, qrWidth);

      // Powered by text
      ctx.font = 'bold 28px "Inter", Arial, sans-serif';
      const wp = ctx.measureText("Powered by ").width;
      const wr = ctx.measureText("Smart Garage").width;
      const startX2 = (canvas.width - (wp + wr)) / 2;

      ctx.fillStyle = '#111111';
      ctx.fillText("Powered by ", startX2, textY2);
      ctx.fillStyle = '#dc2626';
      ctx.fillText("Smart Garage", startX2 + wp, textY2);

      // Icon Logo (Bottom)
      ctx.drawImage(iconLogo, iconX, iconY, iconWidth, iconHeight);

      // Lines beside bottom icon
      const lineY2 = iconY + iconHeight / 2;
      ctx.beginPath();
      ctx.moveTo(180, lineY2);
      ctx.lineTo(iconX - 30, lineY2);
      ctx.moveTo(iconX + iconWidth + 30, lineY2);
      ctx.lineTo(canvas.width - 180, lineY2);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Trigger download
      const finalUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = finalUrl;
      a.download = `Job-Request-QR-${branchObj?.name || 'branch'}.png`;
      a.click();
      
      notify('Poster generated and downloaded successfully!', 'success');
    } catch (err) {
      console.error(err);
      notify('Failed to generate poster. Downloading normal QR...', 'warn');
      // Fallback
      const a = document.createElement('a');
      a.href = qrDataUrl;
      a.download = `job-request-qr-${branchObj?.name || 'branch'}.png`;
      a.click();
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.02em', color: 'var(--text)' }}>Customer Job Requests</h1>
          <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 14 }}>Manage public requests and generate QR codes for customers to request a wash.</p>
        </div>
        {branches && branches.length > 1 && (
          <div style={{ minWidth: 200 }}>
            <Dropdown
              value={selectedBranch}
              onChange={v => setSelectedBranch(v)}
              options={[
                ...(currentUser?.role === 'SupremeAdmin' ? [{ value: 'all', label: 'All Branches' }] : []),
                ...branches.map(b => ({ value: b.id, label: b.name }))
              ]}
            />
          </div>
        )}
      </div>

      <div className="responsive-split-1-1" style={{ gap: 20, marginBottom: 24 }}>
        {/* QR Code Section */}
        <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 32 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Job Request QR Code</h3>
          <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-2)' }}>Print this QR code and display it at your branch. Customers can scan it to request a wash.</p>
          
          {qrDataUrl ? (
            <div style={{ background: '#fff', padding: 16, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 24 }}>
              <img src={qrDataUrl} alt="Job Request QR" style={{ width: 180, height: 180, display: 'block' }} />
            </div>
          ) : (
            <div style={{ width: 180, height: 180, background: 'var(--bg-3)', borderRadius: 16, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', textAlign: 'center', padding: 16, boxSizing: 'border-box' }}>
              Select a specific branch to generate QR
            </div>
          )}

          <div style={{ background: 'var(--bg-3)', padding: '12px 16px', borderRadius: 10, fontSize: 12, wordBreak: 'break-all', color: 'var(--text-2)', marginBottom: 16, border: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>Public Link: </span>
            <a href={publicUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--text)', textDecoration: 'underline' }}>{publicUrl}</a>
          </div>

          <Btn onClick={handleDownloadQr} style={{ width: '100%', maxWidth: 200 }}>Download QR</Btn>
        </Card>

        {/* Requests List Section */}
        <Card style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Recent Requests</h3>
          
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 500, paddingRight: 4 }}>
            {filteredRequests.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--bg-3)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                No job requests found{selectedBranch === 'all' ? ' across all branches' : ' for this branch'}.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredRequests.map(req => {
                  const reqBranch = branches?.find(b => b.id === req.branchId);
                  const isExpired = reqBranch?.expiry_date ? new Date(reqBranch.expiry_date) < new Date() : false;
                  const limitReached = reqBranch?.max_sessions > 0 && reqBranch?.current_month_sessions >= reqBranch?.max_sessions;
                  const isBlocked = isExpired || limitReached || reqBranch?.is_locked;

                  return (
                  <div key={req.id} style={{ padding: 16, background: 'var(--bg-3)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>{req.customerName}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span> {req.customerPhone}</span>
                        <span style={{ color: 'var(--text-3)' }}>⏱ {(() => {
                          let d = null;
                          if (req.createdAt) {
                            d = new Date(req.createdAt);
                          }
                          return d && !isNaN(d.getTime()) ? d.toLocaleString() : 'Date unavailable';
                        })()}</span>
                        {selectedBranch === 'all' && (
                          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                            {reqBranch?.name || 'Unknown Branch'}
                          </span>
                        )}
                        {(req.packageId || req.package_id) && (
                          <span style={{ color: 'var(--text)', fontWeight: 600, background: 'var(--bg)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <img src={JobIcon} alt="Package" style={{ width: 14, height: 14, opacity: 0.7 }} />
                            {packages?.find(p => p.id === (req.packageId || req.package_id))?.name || 'Selected Package'}
                          </span>
                        )}
                      </div>
                      {req.address && (
                        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8 }}>📍 {req.address}</div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, fontFamily: 'monospace' }}>TRK: {req.trackingId}</div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {req.status === 'Pending' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)', background: 'rgba(245,158,11,0.1)', padding: '4px 10px', borderRadius: 99 }}>Pending</span>
                          <Btn 
                            onClick={() => {
                              if (isBlocked) {
                                notify(`Branch plan is ${isExpired ? 'expired' : 'over its session limit'}. Cannot assign new jobs.`, 'error');
                                return;
                              }
                              handleAssignClick(req);
                            }} 
                            style={{
                              background: isBlocked ? 'var(--bg-3)' : 'var(--accent)',
                              color: isBlocked ? 'var(--text-3)' : '#fff',
                              cursor: isBlocked ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Assign Job
                          </Btn>
                        </div>
                      ) : req.status === 'Assigned' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '4px 10px', borderRadius: 99 }}>Assigned</span>
                          {req.job?.status === 'pending' && req.job?.packageTime && (
                            <AdminJobTimer startTime={req.job.submittedAt} durationMinutes={parsePackageTime(req.job.packageTime)} />
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', background: 'rgba(34,197,94,0.1)', padding: '4px 10px', borderRadius: 99 }}>Completed</span>
                      )}
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Assign Modal */}
      <Modal title={`Assign Request: ${assigningReq?.customerName}`} open={!!assigningReq} onClose={() => setAssigningReq(null)}>
        {assigningReq && (
          <div>
            <div style={{ marginBottom: 20, padding: 16, background: 'var(--bg-3)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>Customer Details</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{assigningReq.customerName}</div>
              <div style={{ fontSize: 14, color: 'var(--text-2)' }}>{assigningReq.customerPhone}</div>
              {assigningReq.address && (
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8 }}>📍 {assigningReq.address}</div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>Select Washer</label>
              {washers.length === 0 ? (
                <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', color: 'var(--red)', borderRadius: 8, fontSize: 13 }}>No washers available in this branch.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {washers.map(w => (
                    <div key={w.id} onClick={() => setSelectedWasher(w.id.toString())}
                      style={{ padding: '12px 16px', borderRadius: 10, cursor: 'pointer', border: selectedWasher === w.id.toString() ? '2px solid var(--accent)' : '2px solid transparent', background: selectedWasher === w.id.toString() ? 'var(--accent-dim)' : 'var(--bg-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: selectedWasher === w.id.toString() ? 'var(--accent)' : 'var(--text)' }}>{w.name}</span>
                      {selectedWasher === w.id.toString() && <span style={{ color: 'var(--accent)' }}>✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>Select Package (Optional)</label>
              <Dropdown
                value={selectedPackage}
                onChange={setSelectedPackage}
                options={[
                  { value: '', label: 'To be decided by washer' },
                  ...(packages || []).map(p => ({ value: p.id, label: `${p.name} (${curr} ${p.price})` }))
                ]}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <Btn full onClick={handleAssignSubmit} disabled={!selectedWasher}>Confirm Assignment</Btn>
              <Btn full variant="ghost" onClick={() => setAssigningReq(null)}>Cancel</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
