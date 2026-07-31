import React, { useState, useEffect, useRef } from "react";
import notificationIcon from "../../assets/icons/notification-icon.png";
import lowStockIcon from "../../assets/icons/low-stack-alert-icon.png";
import jobIcon from "../../assets/icons/job-icon.png";
import activeIcon from "../../assets/icons/active-icon.png";

let audioCtx = null;

const playNotificationSound = () => {
  try {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioCtx = new AudioContext();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    
    // First tone (E5)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Second tone (A5)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.15);
    gain2.gain.setValueAtTime(0, now + 0.15);
    gain2.gain.linearRampToValueAtTime(0.3, now + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.log("Audio play failed", e);
  }
};

export default function NotificationsDropdown({ user, users, branches, pendingJobs, sessions, inventory, loyalty, onNav }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('washpro_dismissed_notifs')) || []; } catch { return []; }
  });
  const [readIds, setReadIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('washpro_read_notifs')) || []; } catch { return []; }
  });
  const panelRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('washpro_dismissed_notifs', JSON.stringify(dismissedIds));
  }, [dismissedIds]);

  useEffect(() => {
    localStorage.setItem('washpro_read_notifs', JSON.stringify(readIds));
  }, [readIds]);

  const togglePanel = () => setIsOpen(!isOpen);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const dismissItem = (id, e) => {
    e.stopPropagation();
    setDismissedIds(prev => [...prev, id]);
  };

  const dismissAll = () => {
    const allIds = notifications.map(n => n.id);
    setDismissedIds(prev => [...new Set([...prev, ...allIds])]);
  };

  // Generate notifications dynamically based on role
  const notifications = [];
  const role = user?.role;

  if (role === 'SupremeAdmin') {
    // New Super Admin requests
    const pendingAdmins = users?.filter(u => u.role === 'SuperAdmin' && u.status === 'Pending') || [];
    pendingAdmins.forEach(u => notifications.push({
      id: `sa_${u.id}`, title: 'New Registration', message: `${u.name} requested Super Admin access.`, type: 'info', action: () => onNav && onNav('super_admins'), timestamp: u.createdAt || new Date().toISOString()
    }));

    // Subscription expired / upgrade
    const pendingBranches = branches?.filter(b => b.status === 'Pending') || [];
    pendingBranches.forEach(b => notifications.push({
      id: `branch_${b.id}`, title: 'Branch Approval', message: `Branch ${b.name} is pending approval.`, type: 'warning', action: () => onNav && onNav('branches'), timestamp: b.createdAt || new Date().toISOString()
    }));

    // Super Admin Plan Expirations
    const expiredBranches = branches?.filter(b => b.expiry_date && new Date(b.expiry_date) < new Date()) || [];
    // Deduplicate by owner to avoid spam if they have multiple expired branches
    const expiredOwners = new Set();
    expiredBranches.forEach(b => {
      if (b.owner_id && !expiredOwners.has(b.owner_id)) {
        expiredOwners.add(b.owner_id);
        const owner = users?.find(u => u.id === b.owner_id);
        const ownerName = owner?.name || owner?.username || 'A Super Admin';
        notifications.push({
          id: `expired_sa_${b.owner_id}`, title: 'Plan Expired', message: `${ownerName}'s subscription plan has expired!`, type: 'error', action: () => onNav && onNav('super_admins'), timestamp: new Date().toISOString()
        });
      }
    });

    // Pending Plan Upgrades
    const pendingUpgrades = users?.filter(u => u.tracking_id && u.tracking_id.startsWith('UPGRADE-')) || [];
    pendingUpgrades.forEach(u => notifications.push({
      id: `upgrade_${u.id}`, title: 'Plan Upgrade Request', message: `${u.name || u.username} requested a plan upgrade.`, type: 'info', action: () => onNav && onNav('super_admins'), timestamp: u.payment_info?.requestedAt || new Date().toISOString()
    }));
  }

  if (role === 'SuperAdmin' || role === 'Admin') {
    const ownedBranchIds = (branches || []).map(b => String(b.id));
    const userBranch = user?.branch_id || user?.branchId;
    const isMatchingBranch = (b) => {
      if (!b) return true;
      if (!userBranch || userBranch === 'all') return true;
      if (role === 'SuperAdmin') {
        return ownedBranchIds.includes(String(b));
      }
      return String(b) === String(userBranch);
    };

    if (role === 'SuperAdmin') {
      const myBranches = branches?.filter(b => b.owner_id === user?.id) || [];
      const activeBranch = branches?.find(b => b.id === userBranch);
      const mainBranch = activeBranch || myBranches[0];
      
      if (mainBranch?.expiry_date && new Date(mainBranch.expiry_date) < new Date()) {
        notifications.push({
          id: `my_plan_expired`, title: 'Subscription Expired', message: `Your subscription plan has expired. Please contact support.`, type: 'error', action: () => onNav && onNav('my_plan'), timestamp: new Date().toISOString()
        });
      }
    }

    const myBranchJobs = pendingJobs?.filter(j => isMatchingBranch(j.branchId || j.branch_id)) || [];

    // Assigned jobs
    const assignedJobs = myBranchJobs.filter(j => j.status === 'assigned');
    assignedJobs.forEach(j => notifications.push({
      id: `assign_${j.id}`, title: 'Job Assigned', message: `Job ${j.id} assigned to Washer Profile: ${j.washer || 'Unknown'}.`, type: 'info', action: () => onNav && onNav('dashboard'), timestamp: j.submittedAt || new Date().toISOString()
    }));

    // Washer accepted/started the wash
    const inProgressJobs = myBranchJobs.filter(j => j.status === 'in_progress' || j.status === 'pending');
    inProgressJobs.forEach(j => notifications.push({
      id: `prog_${j.id}`, title: 'Wash Active', message: `Washer Profile: ${j.washer || 'Unknown'} is working on job ${j.id}.`, type: 'success', action: () => onNav && onNav('dashboard'), timestamp: j.submittedAt || new Date().toISOString()
    }));

    // Washer completed (limit to recent to avoid spam)
    const recentSessions = sessions?.filter(s => isMatchingBranch(s.branchId || s.branch_id) && s.status === 'Completed') || [];
    recentSessions.slice(0, 5).forEach(s => notifications.push({
      id: `sess_${s.id}`, title: 'Wash Completed', message: `${s.washerUsername || s.washer} completed a wash for ${s.customer?.name || 'Customer'}.`, type: 'success', action: () => onNav && onNav('sessions'), timestamp: s.createdAt || new Date().toISOString()
    }));

    // Low stock
    const lowStockItems = inventory?.filter(item => {
      const q = Number(item.quantity) || 0;
      const alertLvl = Number(item.threshold) || 3;
      return q <= alertLvl && isMatchingBranch(item.branchId || item.branch_id);
    }) || [];
    lowStockItems.forEach(i => notifications.push({
      id: `stock_${i.id}`, title: 'Low Stock Alert', message: `${i.name} is running low (${i.quantity} left).`, type: 'error', action: () => onNav && onNav('products'), timestamp: i.updated_at || new Date().toISOString()
    }));
  }

  if (role === 'Washer') {
    const myJobs = pendingJobs?.filter(j => (j.washerId === user?.id || j.washer_id === user?.id) && j.status === 'assigned') || [];
    myJobs.forEach(j => notifications.push({
      id: `w_job_${j.id}`, title: 'New Job Assigned', message: `You have been assigned a job for ${j.customer?.name || 'Customer'}.`, type: 'info', timestamp: j.updatedAt || j.createdAt || new Date().toISOString()
    }));
  }

  if (role === 'IndividualUser') {
    const mySessions = sessions || [];
    mySessions.slice(0, 2).forEach(s => notifications.push({
      id: `c_sess_${s.id}`, title: 'Wash Completed', message: `Your wash at ${s.branch || s.locationName || 'the branch'} is completed!`, type: 'success', timestamp: s.endTime || s.timestamp || new Date().toISOString()
    }));

    const myVisits = mySessions.length;
    const req = loyalty?.points_required || 10;
    if (myVisits > 0 && myVisits % req === 0) {
      notifications.push({
        id: `loyalty_reward_${myVisits}`, title: 'Loyalty Reward', message: `You've earned a free wash coupon!`, type: 'success', timestamp: new Date().toISOString()
      });
    }
  }
  const visibleNotifs = notifications
    .filter(n => !dismissedIds.includes(n.id))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const notifIdsString = JSON.stringify(visibleNotifs.map(n => n.id));

  useEffect(() => {
    if (isOpen) {
      setReadIds(prev => {
        const currentIds = JSON.parse(notifIdsString);
        const newIds = currentIds.filter(id => !prev.includes(id));
        if (newIds.length === 0) return prev;
        return [...prev, ...newIds];
      });
    }
  }, [isOpen, notifIdsString]);
  const [prevNotifIdsString, setPrevNotifIdsString] = useState(null);

  useEffect(() => {
    if (prevNotifIdsString === null) {
      setPrevNotifIdsString(notifIdsString);
      return;
    }
    if (notifIdsString !== prevNotifIdsString) {
      const currentIds = JSON.parse(notifIdsString);
      const prevIds = JSON.parse(prevNotifIdsString);
      const hasNew = currentIds.some(id => !prevIds.includes(id));
      if (hasNew) {
        playNotificationSound();
      }
      setPrevNotifIdsString(notifIdsString);
    }
  }, [notifIdsString, prevNotifIdsString]);

  const getIcon = (type) => {
    let iconSrc;
    switch (type) {
      case 'success': iconSrc = activeIcon; break;
      case 'error': iconSrc = lowStockIcon; break;
      case 'warning': iconSrc = lowStockIcon; break;
      case 'info': iconSrc = jobIcon; break;
      default: iconSrc = notificationIcon; break;
    }
    return <img src={iconSrc} alt={type} style={{ width: 18, height: 18, objectFit: 'contain' }} />;
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const unreadCount = visibleNotifs.filter(n => !readIds.includes(n.id)).length;

  return (
    <div className="notification-wrapper" ref={panelRef} style={{ position: 'relative' }}>
      <button className="notification-btn" onClick={togglePanel} style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer', position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={notificationIcon} alt="Notifications" style={{ width: 18, height: 18 }} />
        {unreadCount > 0 && (
          <span className="badge" style={{
            position: 'absolute', top: 0, right: 0, background: 'var(--red, #ef4444)', color: '#fff',
            fontSize: 9, fontWeight: 700, padding: '2px 4px', borderRadius: '10px', lineHeight: 1
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-panel" style={{
          background: 'var(--bg-2, #1e1e1e)',
          border: '1px solid var(--border, #333)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          zIndex: 9999, display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border, #333)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-3, #2a2a2a)' }}>
            <h4 style={{ margin: 0, fontSize: 14, color: 'var(--text, #fff)' }}>Notifications</h4>
            {visibleNotifs.length > 0 && (
              <button onClick={dismissAll} style={{ background: 'none', border: 'none', color: 'var(--accent, #3b82f6)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                Dismiss All
              </button>
            )}
          </div>

          <div style={{ maxHeight: 350, overflowY: 'auto', padding: '8px 0' }}>
            {visibleNotifs.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3, #888)', fontSize: 13 }}>
                No new notifications.
              </div>
            ) : (
              visibleNotifs.map((item) => (
                <div key={item.id}
                  onClick={() => {
                    if (item.action) item.action();
                    setDismissedIds(prev => [...prev, item.id]);
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--border, #333)', display: 'flex', gap: 10, cursor: item.action ? 'pointer' : 'default', transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3, #2a2a2a)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%' }}>
                    {getIcon(item.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #fff)' }}>{item.title}</span>
                      {item.timestamp && (
                        <span style={{ fontSize: 11, color: 'var(--text-3, #888)', whiteSpace: 'nowrap' }}>
                          {formatTime(item.timestamp)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2, #ccc)', lineHeight: 1.4 }}>
                      {item.message}
                    </div>
                  </div>
                  <button
                    onClick={(e) => dismissItem(item.id, e)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-3, #888)', cursor: 'pointer', fontSize: 14, height: 'fit-content' }}
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
