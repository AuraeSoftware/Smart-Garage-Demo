import React, { useState, useEffect } from 'react';
import { getCurrency } from '../../utils/messaging';
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Card, StatCard, EmptyState, Chip, Btn, Inp, Dropdown, Modal } from '../../components/common/UI';
import GiftIcon from '../../assets/icons/gift-icon.png';
import EditIcon from '../../assets/icons/edit-icon.png';
import SaveIcon from '../../assets/icons/save-icon.png';
import BranchIcon from '../../assets/icons/branch-icon.png';
import RevenueIcon from '../../assets/icons/revenue-icon-vec.png';
import CarIcon from '../../assets/icons/car-icon.png';
import ReceiptIcon from '../../assets/icons/receipt-icon.png';
import ChartIcon from '../../assets/icons/bar-chart-icon.png';
import DiamondIcon from '../../assets/icons/diamond-icon.png';
import WorkerIcon from '../../assets/icons/worker-icon.png';
import SoapIcon from '../../assets/icons/soap-icon.png';
import ActiveIcon from '../../assets/icons/active-icon.png';
import AlertIcon from '../../assets/icons/low-stack-alert-icon.png';
import DownloadIcon from '../../assets/icons/download-icon.png';
import GroupIcon from '../../assets/icons/group-icon.png';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PKG_CLR = ['#3B82F6', '#8B5CF6', '#F59E0B', '#22D3EE', '#22C55E'];
const PAY_CLR = { Cash: '#22C55E', 'QR Payment': '#22D3EE', 'QR Pay': '#22D3EE', 'Online Transfer': '#A78BFA', 'Transfer': '#A78BFA' };

const ChartTip = ({ active, payload, label, curr = 'RM' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '9px 14px', fontSize: 12 }}>
      <div style={{ color: 'var(--text-2)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--accent)', fontWeight: 700 }}>
          {p.name?.toLowerCase().includes('rev') ? `${curr} ${p.value}` : p.value}
        </div>
      ))}
    </div>
  );
};

// ── Loyalty Config Widget ─────────────────────────────────
const LoyaltyConfig = ({ loyalty, updateLoyalty, notify, curr = 'RM' }) => {
  const [cfg, setCfg] = useState({ ...loyalty });
  const [editing, setEditing] = useState(false);
  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const handleSave = async () => {
    try {
      await updateLoyalty(cfg);
      setEditing(false);
      notify('Loyalty settings saved!');
    } catch (err) { notify(err.message || 'Failed to save loyalty settings', 'error'); }
  };

  return (
    <Card style={{ borderTop: '3px solid var(--accent-2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src={GiftIcon} alt="" style={{ width: 20, height: 20 }} />
            Loyalty & Coupon Settings
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-2)' }}>Reward customers after a set number of visits</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Enable/disable toggle */}
          <div
            onClick={async () => { try { await updateLoyalty({ ...loyalty, enabled: !loyalty.enabled }); notify(loyalty.enabled ? 'Loyalty rewards disabled' : 'Loyalty rewards enabled'); } catch (e) { } }}
            style={{ width: 44, height: 24, borderRadius: 99, background: loyalty.enabled ? 'var(--green)' : 'var(--bg-3)', border: `1px solid ${loyalty.enabled ? 'var(--green)' : 'var(--border-2)'}`, cursor: 'pointer', position: 'relative', transition: 'all 0.2s' }}
          >
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: loyalty.enabled ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
          </div>
          <Btn variant="ghost" size="sm" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : <><img src={EditIcon} alt="" style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} />Edit</>}</Btn>
        </div>
      </div>

      {!editing ? (
        // Read-only view
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
          {[
            ['Visit Threshold', `${loyalty.visitThreshold} visits`, 'var(--accent-2)'],
            ['Discount', loyalty.discountType === 'percent' ? `${loyalty.discountValue}%` : `${curr} ${loyalty.discountValue}`, 'var(--green)'],
            ['Coupon Validity', `${loyalty.validityDays} days`, 'var(--amber)'],
            ['Coupon Prefix', loyalty.couponPrefix, 'var(--accent)'],
          ].map(([l, v, c]) => (
            <div key={l} style={{ background: 'var(--bg-3)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{l}</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: c }}>{v}</div>
            </div>
          ))}
          {/* Alert message preview */}
          <div style={{ background: 'var(--bg-3)', borderRadius: 12, padding: '12px 14px', gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Customer Alert Message</div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontStyle: 'italic' }}>"{loyalty.alertMessage}"</div>
          </div>
        </div>
      ) : (
        // Edit form
        <div className="responsive-split-1-1" style={{ gap: 12 }}>
          <Inp label="Visit Threshold" type="number" value={cfg.visitThreshold}
            onChange={e => set('visitThreshold', Number(e.target.value))} />
          <Dropdown label="Discount Type" value={cfg.discountType}
            onChange={v => set('discountType', v)}
            options={[{ value: 'percent', label: 'Percentage (%)' }, { value: 'fixed', label: `Fixed Amount (${curr})` }]} />
          <Inp label={cfg.discountType === 'percent' ? 'Discount (%)' : `Discount Amount (${curr})`}
            type="number" value={cfg.discountValue}
            onChange={e => set('discountValue', Number(e.target.value))} />
          <Inp label="Coupon Validity (days)" type="number" value={cfg.validityDays}
            onChange={e => set('validityDays', Number(e.target.value))} />
          <Inp label="Coupon Prefix" value={cfg.couponPrefix}
            onChange={e => set('couponPrefix', e.target.value.toUpperCase())} />
          <div /> {/* spacer */}
          <div style={{ gridColumn: '1 / -1' }}>
            <Inp label="Customer Alert Message" value={cfg.alertMessage}
              onChange={e => set('alertMessage', e.target.value)} />
          </div>
          <Btn onClick={handleSave}><img src={SaveIcon} alt="" style={{ width: 14, height: 14, marginRight: 6, verticalAlign: 'middle' }} />Save Settings</Btn>
          <Btn variant="ghost" onClick={() => { setCfg({ ...loyalty }); setEditing(false); }}>Cancel</Btn>
        </div>
      )}

      {/* Loyalty stats */}
    </Card>
  );
};

export const Dashboard = ({ sessions, users, packages, customers, loyalty, updateLoyalty, notify, onNav, userRole, branches = [], currentUser, branchSubscription, subscriptionPlans = [] }) => {
  const curr = getCurrency(currentUser?.phone);

  const isSuperAdmin = userRole === 'SuperAdmin';
  const isSupremeAdmin = userRole === 'SupremeAdmin';
  const [pending, setPending] = React.useState([]);

  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [selectedFranchise, setSelectedFranchise] = useState(null);  // franchise/branch detail popup
  const [statModal, setStatModal] = useState(null);  // supreme summary card popup ('admins'|'revMYR'|'revINR'|'sessions')

  const MONTH_MAP = {
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
  };

  const getSessionDate = (s) => {
    if (s.createdAt) return new Date(s.createdAt);
    if (s.date) return new Date(s.date);
    return null;
  };

  const filteredSessions = sessions.filter(s => {
    const d = getSessionDate(s);
    if (!d || isNaN(d.getTime())) return false;
    if (selectedYear !== 'All' && d.getFullYear().toString() !== selectedYear) return false;
    if (selectedMonth !== 'All' && d.getMonth() !== MONTH_MAP[selectedMonth]) return false;
    return true;
  });

  // For Supreme Admin, exclude dummy sessions (sessions not belonging to a SuperAdmin)
  const actualSessions = isSupremeAdmin 
    ? filteredSessions.filter(s => {
        const b = branches.find(br => br.id === s.branchId);
        return b && users.some(u => u.role === 'SuperAdmin' && (u.id === b.owner_id || u.branch_id === b.id || u.branchId === b.id));
      })
    : filteredSessions;

  const totalRevFiltered = actualSessions.reduce((a, s) => a + (s.total || 0), 0);
  const totalSesFiltered = actualSessions.length;
  const avgTicketFiltered = totalSesFiltered ? Math.round(totalRevFiltered / totalSesFiltered) : 0;

  const activeBranchIds = new Set(actualSessions.map(s => s.branchId).filter(Boolean));
  const activeBranchesCount = activeBranchIds.size;

  const branchDataMap = {};
  
  let totalSubscriptionRevenueMYR = 0;
  let totalSubscriptionRevenueINR = 0;
  let superAdminCountMYR = 0;
  let superAdminCountINR = 0;
  const superAdminsList = users.filter(u => u.role === 'SuperAdmin');

  if (isSupremeAdmin) {
    superAdminsList.forEach(sa => {
      const saCurr = getCurrency(sa.phone);
      if (saCurr === 'INR') superAdminCountINR++;
      else superAdminCountMYR++;

      const ownedBranches = branches.filter(b => b.owner_id === sa.id || b.id === sa.branchId || b.id === sa.branch_id);
      const subPlanId = sa.subscription || (ownedBranches[0]?.subscription) || 'trial';
      const plan = subscriptionPlans.find(p => p.id === subPlanId);
      
      if (plan) {
        const saCurr = getCurrency(sa.phone);
        if (saCurr === 'INR') {
          const priceValue = plan.monthly_price_inr || parseFloat((String(plan.price_inr || '0')).replace(/[^0-9.]/g, '')) || 0;
          totalSubscriptionRevenueINR += priceValue;
        } else {
          const priceValue = plan.monthly_price || parseFloat((String(plan.price || '0')).replace(/[^0-9.]/g, '')) || 0;
          totalSubscriptionRevenueMYR += priceValue;
        }
      }

      branchDataMap[sa.id] = {
        id: `FR-${sa.id}`,
        name: sa.name,
        manager: sa.username,
        address: `${ownedBranches.length} branch(es)`,
        subscription: subPlanId,
        washes: 0,
        revenue: 0,
        phone: sa.phone
      };
    });

    filteredSessions.forEach(s => {
      const b = branches.find(br => br.id === s.branchId);
      if (b) {
        const owner = superAdminsList.find(sa => sa.id === b.owner_id || sa.branch_id === b.id || sa.branchId === b.id);
        if (owner && branchDataMap[owner.id]) {
          branchDataMap[owner.id].washes += 1;
          branchDataMap[owner.id].revenue += s.total || 0;
        }
      }
    });
  } else {
    branches.forEach(b => {
      branchDataMap[b.id] = {
        id: b.id,
        name: b.name,
        manager: b.manager || '—',
        address: b.address || '—',
        subscription: b.subscription || 'trial',
        washes: 0,
        revenue: 0
      };
    });

    filteredSessions.forEach(s => {
      const bid = s.branchId || 'unknown';
      if (!branchDataMap[bid]) {
        branchDataMap[bid] = {
          id: bid, name: s.branch || 'Unknown Branch', manager: '—', address: '—',
          subscription: 'trial', washes: 0, revenue: 0
        };
      }
      branchDataMap[bid].washes += 1;
      branchDataMap[bid].revenue += s.total || 0;
    });
  }

  const branchDataList = Object.values(branchDataMap).sort((a, b) => b.revenue - a.revenue);

  let trendData = [];
  if (selectedYear !== 'All' && selectedMonth !== 'All') {
    const yr = parseInt(selectedYear);
    const mth = MONTH_MAP[selectedMonth];
    const daysInMonth = new Date(yr, mth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      trendData.push({ name: `Day ${d}`, revenue: 0, washes: 0 });
    }
    actualSessions.forEach(s => {
      const d = getSessionDate(s);
      if (d) {
        const dIdx = d.getDate() - 1;
        if (trendData[dIdx]) {
          trendData[dIdx].revenue += s.total || 0;
          trendData[dIdx].washes += 1;
        }
      }
    });
  } else if (selectedYear !== 'All') {
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    trendData = MONTH_NAMES.map(m => ({ name: m, revenue: 0, washes: 0 }));
    actualSessions.forEach(s => {
      const d = getSessionDate(s);
      if (d) {
        const mIdx = d.getMonth();
        if (trendData[mIdx]) {
          trendData[mIdx].revenue += s.total || 0;
          trendData[mIdx].washes += 1;
        }
      }
    });
  } else {
    const yearlyMap = {};
    actualSessions.forEach(s => {
      const d = getSessionDate(s);
      if (d) {
        const yr = d.getFullYear().toString();
        yearlyMap[yr] = (yearlyMap[yr] || 0) + (s.total || 0);
      }
    });
    ['2024', '2025', '2026'].forEach(yr => {
      if (yearlyMap[yr] === undefined) yearlyMap[yr] = 0;
    });
    trendData = Object.entries(yearlyMap).map(([yr, rev]) => ({
      name: yr,
      revenue: rev
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  const handlePrint = () => {
    window.print();
  };

  React.useEffect(() => {
    if (isSupremeAdmin) {
      import('../../utils/api').then(({ API }) => {
        API.admin.pendingApprovals().then(setPending).catch(() => { });
      });
    }
  }, [isSupremeAdmin]);

  const handleApprove = async (id, name) => {
    const { API } = await import('../../utils/api');
    try {
      await API.admin.approve(id);
      setPending(p => p.filter(u => u.id !== id));
      notify(`${name} approved!`);
    } catch (err) { notify(err.message || 'Failed to approve', 'error'); }
  };

  const handleReject = async (id, name) => {
    const { API } = await import('../../utils/api');
    try {
      await API.admin.reject(id);
      setPending(p => p.filter(u => u.id !== id));
      notify(`${name} rejected`);
    } catch (err) { notify(err.message || 'Failed', 'error'); }
  };
  const today = new Date().toDateString();
  const todaySes = sessions.filter(s => s.createdAt && new Date(s.createdAt).toDateString() === today);
  const totalRev = sessions.reduce((a, s) => a + (s.total || 0), 0);
  const todayRev = todaySes.reduce((a, s) => a + (s.total || 0), 0);
  const staff = users.filter(u => u.role === 'Washer');
  const activeWashers = staff.filter(u => u.status === 'Active');

  // Loyalty stats
  const loyalCustomers = customers.filter(c => (c.visits?.length || 0) >= (loyalty.visitThreshold || 3));
  const couponsUsed = sessions.filter(s => s.coupon?.applied).length;
  const discountGiven = sessions.filter(s => s.coupon?.applied).reduce((a, s) => a + (s.coupon?.discountAmount || 0), 0);

  // Weekly chart
  const weekly = DAYS.map(d => ({ day: d, revenue: 0, sessions: 0 }));
  sessions.forEach(s => {
    if (!s.createdAt) return;
    const i = new Date(s.createdAt).getDay();
    weekly[i].revenue += s.total || 0;
    weekly[i].sessions += 1;
  });

  // Pkg dist
  const pkgMap = {};
  sessions.forEach(s => { const n = s.package?.name; if (n) pkgMap[n] = (pkgMap[n] || 0) + 1; });
  const pkgDist = Object.entries(pkgMap).map(([name, value], i) => ({ name, value, color: PKG_CLR[i % PKG_CLR.length] }));

  if (isSupremeAdmin) {
    return (
      <>
        {/* Supreme Filter Panel */}
        <Card style={{ marginBottom: 20, borderTop: '3px solid var(--accent-2)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
            <div>
              <h2 className="supreme-command-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Supreme Admin Analytics Command Center</h2>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-3)' }}>Cross-branch analysis, financial auditing, and performance reports</p>
            </div>
          <div className="filter-bar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ width: 140 }}>
                <Dropdown
                  label="Auditing Year"
                  value={selectedYear}
                  onChange={v => setSelectedYear(v)}
                  options={[
                    { value: 'All', label: 'All Years' },
                    { value: '2024', label: '2024' },
                    { value: '2025', label: '2025' },
                    { value: '2026', label: '2026' }
                  ]}
                />
              </div>
              <div style={{ width: 140 }}>
                <Dropdown
                  label="Auditing Month"
                  value={selectedMonth}
                  onChange={v => setSelectedMonth(v)}
                  options={[
                    { value: 'All', label: 'All Months' },
                    { value: 'January', label: 'January' },
                    { value: 'February', label: 'February' },
                    { value: 'March', label: 'March' },
                    { value: 'April', label: 'April' },
                    { value: 'May', label: 'May' },
                    { value: 'June', label: 'June' },
                    { value: 'July', label: 'July' },
                    { value: 'August', label: 'August' },
                    { value: 'September', label: 'September' },
                    { value: 'October', label: 'October' },
                    { value: 'November', label: 'November' },
                    { value: 'December', label: 'December' }
                  ]}
                />
              </div>
              <Btn onClick={handlePrint} variant="ghost" style={{ border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 16 }}>
                <img src={DownloadIcon} alt="" style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} /> Export PDF / Print
              </Btn>
            </div>
          </div>
        </Card>

        {/* Filtered Supreme KPI Cards */}
        <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
          <StatCard onClick={() => setStatModal('admins')} icon={<img src={GroupIcon} alt="" style={{ width: 24, height: 24 }} />} label="Super Admins (MYR / INR)" value={`${superAdminCountMYR} / ${superAdminCountINR}`} sub={`${activeBranchesCount} active branches in period`} color="var(--accent)" />
          <StatCard onClick={() => setStatModal('revMYR')} icon={<img src={RevenueIcon} alt="" style={{ width: 24, height: 24 }} />} label="Subscription Rev (MYR)" value={`RM ${totalSubscriptionRevenueMYR.toLocaleString()}`} sub={`${selectedMonth === 'All' ? 'All Months' : selectedMonth} ${selectedYear === 'All' ? 'All Years' : selectedYear}`} color="var(--green)" />
          <StatCard onClick={() => setStatModal('revINR')} icon={<img src={RevenueIcon} alt="" style={{ width: 24, height: 24 }} />} label="Subscription Rev (INR)" value={`₹${totalSubscriptionRevenueINR.toLocaleString()}`} sub={`${selectedMonth === 'All' ? 'All Months' : selectedMonth} ${selectedYear === 'All' ? 'All Years' : selectedYear}`} color="var(--green)" />
          <StatCard onClick={() => setStatModal('sessions')} icon={<img src={CarIcon} alt="" style={{ width: 24, height: 24 }} />} label="Audited Sessions" value={totalSesFiltered} sub="wash sessions completed" color="var(--accent-2)" />
        </div>

        {/* Supreme Analytical Charts Row */}
        <div className="responsive-split-3-2" style={{ marginBottom: 14 }}>
          {/* Revenue Trend Area Chart */}
          <Card>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14, color: 'var(--text)' }}>
              Revenue Trend ({selectedMonth === 'All' ? 'Yearly/Monthly' : `${selectedMonth} ${selectedYear}`})
            </div>
            {filteredSessions.length === 0 ? (
              <EmptyState icon={<img src={ChartIcon} alt="" style={{ width: 48, height: 48 }} />} title="No matching sessions" sub="Try expanding your Year or Month filters" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={trendData}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${curr} ${v}`} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="revenue" name="revenue" stroke="var(--accent)" fillOpacity={1} fill="url(#areaGrad)" />
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Branch-wise Revenue Distribution (Bar Chart) */}
          <Card>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14, color: 'var(--text)' }}>Branch Revenue Comparison</div>
            {filteredSessions.length === 0 ? (
              <EmptyState icon={<img src={ChartIcon} alt="" style={{ width: 48, height: 48 }} />} title="No branch records found" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={branchDataList.filter(b => b.revenue > 0)}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${curr} ${v}`} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="revenue" name="revenue" fill="url(#branchBarGrad)" radius={[5, 5, 0, 0]} />
                  <defs>
                    <linearGradient id="branchBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-2)" />
                      <stop offset="100%" stopColor="var(--accent)" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Branch Leaderboard & Report Details Table */}
        <Card style={{ marginBottom: 14 }}>
          <div className="branch-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src={ActiveIcon} alt="" style={{ width: 18, height: 18 }} />
              {isSupremeAdmin ? 'Franchisee Revenue Auditing Table' : 'Cross-Branch Revenue Auditing Table'}
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>Sorted by Highest Revenue</span>
          </div>
          {branchDataList.length === 0 ? (
            <EmptyState icon={<img src={BranchIcon} alt="" style={{ width: 48, height: 48 }} />} title="No branches registered" />
          ) : (
            <div className="table-responsive-wrapper">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {(isSupremeAdmin 
                      ? ['Franchisee ID', 'Franchisee Name', 'Username', 'Sub-Branches', 'Washes Done', 'Total Revenue', 'Subscription']
                      : ['Branch ID', 'Branch Name', 'Manager', 'Location', 'Washes Done', 'Total Revenue', 'Subscription']
                    ).map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {branchDataList.map((b, idx) => (
                    <tr key={b.id} onClick={() => setSelectedFranchise({ ...b, rank: idx + 1 })} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--accent)', fontSize: 13 }}>
                        {b.id}
                        {idx === 0 && b.revenue > 0 && <span style={{ marginLeft: 6, fontSize: 11, background: 'rgba(245,158,11,0.15)', color: 'var(--amber)', borderRadius: 4, padding: '2px 6px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}><img src={DiamondIcon} alt="" style={{ width: 10, height: 10 }} /> Rank #1</span>}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: 13 }}>{b.name}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-2)' }}>{b.manager}</td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.address}>
                        {b.address}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700 }}>{b.washes} sessions</td>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--green)', fontSize: 14 }}>{b.phone ? getCurrency(b.phone) : curr} {b.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <Chip color={b.subscription === 'premium' ? 'var(--accent)' : 'var(--text-3)'} size="sm">
                          {b.subscription.toUpperCase()}
                        </Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Franchise detail popup — read-only summary of the clicked row */}
        <Modal title={selectedFranchise ? `${selectedFranchise.name}` : ''} open={!!selectedFranchise} onClose={() => setSelectedFranchise(null)} maxWidth={520}>
          {selectedFranchise && (() => {
            const f = selectedFranchise;
            const fc = f.phone ? getCurrency(f.phone) : curr;
            const plan = subscriptionPlans.find(p => p.id === f.subscription);
            const ownerId = String(f.id).replace('FR-', '');
            const owned = branches.filter(b => String(b.owner_id) === ownerId || `FR-${b.owner_id}` === f.id);
            const row = (label, value) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textAlign: 'right' }}>{value}</span>
              </div>
            );
            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>{f.id}</span>
                  <Chip color="var(--text-3)" size="sm">{String(f.subscription).toUpperCase()}</Chip>
                  {f.rank === 1 && f.revenue > 0 && <Chip color="var(--amber)" size="sm">Rank #1</Chip>}
                </div>
                {row('Username', f.manager)}
                {row('Branches', f.address)}
                {row('Washes done', `${f.washes} sessions`)}
                {row('Total revenue', `${fc} ${f.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                {plan && row('Plan limits', `${plan.max_washers ?? '∞'} washers · ${plan.max_sessions ?? '∞'} sessions/mo · ${plan.max_branches ?? '∞'} branches`)}
                {owned.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Branches</div>
                    {owned.map(b => (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 10px', background: 'var(--bg-3)', borderRadius: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</span>
                        <span style={{ fontSize: 12, color: b.expiry_date && new Date(b.expiry_date) < new Date() ? 'var(--red)' : 'var(--text-3)' }}>
                          {b.expiry_date ? `exp ${new Date(b.expiry_date).toLocaleDateString()}` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </Modal>

        {/* Supreme summary-card detail popup */}
        <Modal
          title={statModal === 'admins' ? 'Super Admins' : statModal === 'revMYR' ? 'Subscription Revenue (MYR)' : statModal === 'revINR' ? 'Subscription Revenue (INR)' : statModal === 'sessions' ? 'Audited Sessions' : ''}
          open={!!statModal} onClose={() => setStatModal(null)} maxWidth={560}>
          {statModal && (() => {
            const rowLine = (label, value, strong) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: strong ? 800 : 700, color: strong ? 'var(--green)' : 'var(--text)', textAlign: 'right' }}>{value}</span>
              </div>
            );

            // ── Super Admins breakdown ──
            if (statModal === 'admins') {
              return (
                <div>
                  {rowLine('Malaysia (MYR)', `${superAdminCountMYR} admins`)}
                  {rowLine('India (INR)', `${superAdminCountINR} admins`)}
                  {rowLine('Active branches in period', activeBranchesCount)}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>All Super Admins</div>
                    <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                      {superAdminsList.map(sa => {
                        const c = getCurrency(sa.phone);
                        return (
                          <div key={sa.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 10px', background: 'var(--bg-3)', borderRadius: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{sa.name} <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>@{sa.username}</span></span>
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{c}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }

            // ── Revenue breakdown (MYR or INR) ──
            if (statModal === 'revMYR' || statModal === 'revINR') {
              const wantINR = statModal === 'revINR';
              const sym = wantINR ? '₹' : 'RM';
              const total = wantINR ? totalSubscriptionRevenueINR : totalSubscriptionRevenueMYR;
              // per-plan tally for the matching currency
              const planTally = {};
              superAdminsList.forEach(sa => {
                if ((getCurrency(sa.phone) === 'INR') !== wantINR) return;
                const ob = branches.filter(b => b.owner_id === sa.id || b.id === sa.branchId || b.id === sa.branch_id);
                const pid = sa.subscription || ob[0]?.subscription || 'trial';
                const plan = subscriptionPlans.find(p => p.id === pid);
                const price = wantINR
                  ? (plan?.monthly_price_inr || parseFloat(String(plan?.price_inr || '0').replace(/[^0-9.]/g, '')) || 0)
                  : (plan?.monthly_price || parseFloat(String(plan?.price || '0').replace(/[^0-9.]/g, '')) || 0);
                const key = plan?.label || pid;
                if (!planTally[key]) planTally[key] = { count: 0, sum: 0 };
                planTally[key].count += 1; planTally[key].sum += price;
              });
              return (
                <div>
                  {rowLine('Total subscription revenue', `${sym} ${total.toLocaleString()}`, true)}
                  {rowLine('Period', `${selectedMonth === 'All' ? 'All Months' : selectedMonth} · ${selectedYear === 'All' ? 'All Years' : selectedYear}`)}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>By plan</div>
                    {Object.keys(planTally).length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0' }}>No subscriptions in this currency.</div>
                    ) : Object.entries(planTally).map(([name, v]) => (
                      <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 10px', background: 'var(--bg-3)', borderRadius: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{name} <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>× {v.count}</span></span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{sym} {v.sum.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            // ── Audited sessions breakdown ──
            if (statModal === 'sessions') {
              return (
                <div>
                  {rowLine('Total audited sessions', totalSesFiltered, true)}
                  {rowLine('Period', `${selectedMonth === 'All' ? 'All Months' : selectedMonth} · ${selectedYear === 'All' ? 'All Years' : selectedYear}`)}
                  {rowLine('Active branches', activeBranchesCount)}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sessions by franchise</div>
                    <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                      {branchDataList.filter(b => b.washes > 0).map(b => (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 10px', background: 'var(--bg-3)', borderRadius: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</span>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{b.washes} sessions</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}
        </Modal>
      </>
    );
  }


  // Plan Expiry Logic
  const activeBranch = currentUser ? branches.find(b => b.id === (currentUser.branch_id || currentUser.branchId)) : null;
  const expiryDate = activeBranch?.expiry_date;
  let daysToExpiry = null;
  if (expiryDate) {
     const diff = new Date(expiryDate).getTime() - new Date().getTime();
     daysToExpiry = Math.ceil(diff / (1000 * 3600 * 24));
  }

  // Session Limit Logic
  const now = new Date();
  const currentMonthSessions = actualSessions.filter(s => {
    const d = getSessionDate(s);
    return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const sessionLimit = branchSubscription?.max_sessions || 0;
  const limitReached = sessionLimit > 0 && actualSessions.length >= sessionLimit;
  const refreshDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      {/* Expiry Alert */}
      {daysToExpiry !== null && daysToExpiry <= 8 && !isSupremeAdmin && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid var(--amber)', borderRadius: 12, padding: '16px 20px', marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
               <img src={AlertIcon} alt="" style={{ width: 24, height: 24, filter: 'brightness(0) invert(1)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--amber)', marginBottom: 2 }}>Subscription Expiring Soon!</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Your plan will expire in <strong style={{ color: 'var(--text)' }}>{daysToExpiry} day(s)</strong>. Please upgrade or renew to avoid service interruption.</div>
            </div>
          </div>
          <Btn onClick={() => onNav('my_plan')} style={{ background: 'var(--amber)', color: '#000', fontWeight: 800 }}>Upgrade Now</Btn>
        </div>
      )}

      {/* Session Limit Alert */}
      {limitReached && !isSupremeAdmin && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)', borderRadius: 12, padding: '16px 20px', marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
               <img src={AlertIcon} alt="" style={{ width: 24, height: 24, filter: 'brightness(0) invert(1)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--red)', marginBottom: 2 }}>Session Limit Reached!</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>You have reached your limit of <strong style={{ color: 'var(--text)' }}>{sessionLimit} sessions</strong> for this month. You cannot assign new jobs until it refreshes on <strong>{refreshDate}</strong>.</div>
            </div>
          </div>
          <Btn onClick={() => onNav('my_plan')} style={{ background: 'var(--red)', color: '#fff', fontWeight: 800 }}>Upgrade for More</Btn>
        </div>
      )}

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Btn onClick={() => {
          if (limitReached && !isSupremeAdmin) {
            window.dispatchEvent(new CustomEvent('show_limit_modal'));
            return;
          }
          onNav('assign_job');
        }} style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Assign Job
        </Btn>
      </div>  

      {/* KPI cards */}
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
        <StatCard icon={<img src={RevenueIcon} alt="" style={{ width: 24, height: 24 }} />} label="Total Revenue" value={`${curr} ${totalRev.toLocaleString()}`} sub={`${curr} ${todayRev} today`} color="var(--accent)" />
        <StatCard icon={<img src={CarIcon} alt="" style={{ width: 24, height: 24 }} />} label="Total Sessions" value={sessions.length} sub={`${todaySes.length} today`} color="var(--accent-2)" />
        <StatCard icon={<img src={WorkerIcon} alt="" style={{ width: 24, height: 24 }} />} label="Active Washers" value={activeWashers.length} sub={`of ${staff.length} staff`} color="var(--green)" />

      </div>

      {/* Charts row */}
      <div className="responsive-split-3-2" style={{ marginBottom: 14 }}>
        <Card>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14, color: 'var(--text)' }}>Revenue by Day of Week</div>
          {sessions.length === 0
            ? <EmptyState icon={<img src={ChartIcon} alt="" style={{ width: 48, height: 48 }} />} title="No sessions yet" sub="Complete washes to see revenue data" />
            : <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekly}>
                <XAxis dataKey="day" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${curr} ${v}`} />
                <Tooltip content={<ChartTip curr={curr} />} />
                <Bar dataKey="revenue" name="revenue" fill="url(#barGrad)" radius={[5, 5, 0, 0]} />
                <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" /><stop offset="100%" stopColor="var(--accent-2)" /></linearGradient></defs>
              </BarChart>
            </ResponsiveContainer>
          }
        </Card>
        <Card>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14, color: 'var(--text)' }}>Package Split</div>
          {pkgDist.length === 0
            ? <EmptyState icon={<img src={SoapIcon} alt="" style={{ width: 48, height: 48 }} />} title="No data yet" />
            : <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart><Pie data={pkgDist} cx="50%" cy="50%" innerRadius={38} outerRadius={60} dataKey="value" strokeWidth={0}>
                  {pkgDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie><Tooltip formatter={v => `${v} sessions`} /></PieChart>
              </ResponsiveContainer>
              {pkgDist.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1 }}>{p.name}</span>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{p.value}</span>
                </div>
              ))}
            </>
          }
        </Card>
      </div>

      {/* Loyalty summary + config */}
      <div className="responsive-split-1-2" style={{ marginBottom: 14 }}>
        <Card style={{ borderTop: '3px solid var(--green)' }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src={DiamondIcon} alt="" style={{ width: 18, height: 18 }} />
            Loyalty Stats
          </div>
          {[
            ['Loyal Customers', loyalCustomers.length, 'var(--green)'],
            ['Coupons Redeemed', couponsUsed, 'var(--accent-2)'],
            ['Discount Given', `${curr} ${discountGiven}`, 'var(--amber)'],
          ].map(([l, v, c]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-2)' }}>{l}</span>
              <span style={{ fontWeight: 800, color: c }}>{v}</span>
            </div>
          ))}
          <Btn full variant="ghost" size="sm" onClick={() => onNav('customers')} style={{ marginTop: 12 }}>View Customers →</Btn>
        </Card>

        <LoyaltyConfig loyalty={loyalty} updateLoyalty={updateLoyalty} notify={notify} curr={curr} />
      </div>

      {/* Recent sessions */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Recent Sessions</div>
          <button onClick={() => onNav('sessions')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>View all →</button>
        </div>
        {sessions.length === 0
          ? <EmptyState icon={<img src={CarIcon} alt="" style={{ width: 48, height: 48 }} />} title="No sessions yet" sub="Sessions from the Washer App appear here live" />
          : <div className="table-responsive-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Invoice', 'Vehicle', 'Plate', 'Customer', 'Package', 'Amount', 'Payment'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 13px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {sessions.slice(0, 6).map(s => (
                  <tr key={s.id} onClick={() => onNav('sessions')} style={{ cursor: 'pointer' }}>
                    <td style={{ padding: '11px 13px', borderBottom: '1px solid var(--border)', color: 'var(--accent)', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {s.id}
                      {s.coupon?.applied && <img src={DiamondIcon} alt="Applied Coupon" style={{ width: 14, height: 14 }} />}
                    </td>
                    <td style={{ padding: '11px 13px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text)' }}>
                      {`${s.vehicle?.colour || ''} ${s.vehicle?.make || ''} ${s.vehicle?.model || ''}`.trim() || <span style={{ color: 'var(--amber)' }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 13px', borderBottom: '1px solid var(--border)', fontFamily: 'monospace', color: 'var(--amber)', fontSize: 12 }}>{s.vehicle?.plate || '—'}</td>
                    <td style={{ padding: '11px 13px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-2)' }}>{s.customer?.name || 'Walk-in'}</td>
                    <td style={{ padding: '11px 13px', borderBottom: '1px solid var(--border)' }}><Chip color="var(--accent-2)" size="sm">{s.package?.name}</Chip></td>
                    <td style={{ padding: '11px 13px', borderBottom: '1px solid var(--border)', fontWeight: 800, color: 'var(--green)', fontSize: 13 }}>{curr} {s.total}</td>
                    <td style={{ padding: '11px 13px', borderBottom: '1px solid var(--border)' }}><Chip color={PAY_CLR[s.payment?.mode] || 'var(--text-3)'}>{s.payment?.mode}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      </Card>
    </>
  );
};
