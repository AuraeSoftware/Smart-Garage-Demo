import React, { useState, useEffect, useMemo } from 'react';
import { getCurrency } from '../../utils/messaging';
import { Card, SectionTitle, Btn, Chip, Dropdown, Inp } from '../../components/common/UI';
import { API } from '../../utils/api';

export const SubscriptionHistoryPage = ({ currentUser, branches, users }) => {
  const curr = getCurrency(currentUser?.phone);

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState('All'); // All, Day, Month, Year
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const data = await API.subscriptions.history(true);
        setHistory(data || []);
      } catch (err) {
        console.error("Failed to fetch subscription history", err);
      }
      setLoading(false);
    };
    fetchHistory();
  }, []);

  const filteredHistory = useMemo(() => {
    let result = history;
    
    if (filterPeriod !== 'All') {
      const now = new Date();
      result = result.filter(tx => {
        if (!tx.created_at) return false;
        const txDate = new Date(tx.created_at);
        
        if (filterPeriod === 'Day') {
          return txDate.toDateString() === now.toDateString();
        } else if (filterPeriod === 'Month') {
          return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
        } else if (filterPeriod === 'Year') {
          return txDate.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }

    if (searchQuery.trim() !== '') {
      const lowerQ = searchQuery.toLowerCase();
      result = result.filter(tx => {
        const branchName = (tx.branch_name || '').toLowerCase();
        const userName = (tx.user_name || '').toLowerCase();
        const planName = (tx.plan_name || '').toLowerCase();
        const transId = (tx.transaction_id || '').toLowerCase();
        return branchName.includes(lowerQ) || userName.includes(lowerQ) || planName.includes(lowerQ) || transId.includes(lowerQ);
      });
    }

    return result;
  }, [history, filterPeriod, searchQuery]);

  const currencyStats = useMemo(() => {
    const stats = {};
    filteredHistory.forEach(tx => {
      const c = tx.currency || 'MYR';
      if (!stats[c]) {
        stats[c] = { revenue: 0, count: 0 };
      }
      stats[c].revenue += (tx.amount || 0);
      stats[c].count += 1;
    });
    return Object.entries(stats).sort((a, b) => b[1].revenue - a[1].revenue); // Sort by revenue descending
  }, [filteredHistory]);

  const totalSubscriptions = filteredHistory.length;

  // Calculate expired users (SuperAdmins)
  const expiredUsersCount = (users || []).filter(u => {
    if (u.role !== 'SuperAdmin' || u.status === 'Rejected' || u.status === 'Pending' || (u.trackingId && u.trackingId.startsWith('UPGRADE-'))) return false;
    const brId = u.branch_id || u.branchId;
    const branch = (branches || []).find(b => String(b.id) === String(brId));
    if (!branch || !branch.expiry_date) return false;
    return new Date(branch.expiry_date) < new Date();
  }).length;

  const handleExportCSV = () => {
    if (filteredHistory.length === 0) return;
    
    const headers = ['Date', 'User Name', 'Branch Name', 'Plan', 'Amount', 'Currency', 'Status'];
    const rows = filteredHistory.map(tx => [
      tx.created_at || '-',
      tx.user_name || '-',
      tx.branch_name || '-',
      tx.plan_name || '-',
      tx.amount || 0,
      tx.currency || 'MYR',
      tx.status || 'Verified'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `subscription_report_${filterPeriod.toLowerCase()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <SectionTitle sub="View all subscription purchases, revenue, and expired plans">
            Subscription History
          </SectionTitle>
        </div>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Inp 
            placeholder="Search transactions..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 200 }}
          />
          <Dropdown
            value={filterPeriod}
            onChange={setFilterPeriod}
            options={[
              { value: 'All', label: 'All Time' },
              { value: 'Day', label: 'Today' },
              { value: 'Month', label: 'This Month' },
              { value: 'Year', label: 'This Year' }
            ]}
            style={{ minWidth: 140 }}
          />
          
          <Btn onClick={handleExportCSV} style={{ background: 'var(--accent)', color: '#fff' }} disabled={filteredHistory.length === 0}>
            Export Report (CSV)
          </Btn>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 24, marginBottom: 24 }}>
        {currencyStats.map(([currency, stat]) => (
          <Card key={currency} style={{ padding: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Total Revenue ({currency})</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)' }}>{currency} {stat.revenue.toFixed(2)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>{stat.count} subscriptions</div>
          </Card>
        ))}
        {currencyStats.length === 0 && (
          <Card style={{ padding: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Total Revenue</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)' }}>-</div>
          </Card>
        )}
        <Card style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Expired Users</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--red)' }}>{expiredUsersCount}</div>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Transaction Ledger</h3>
          <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>{filteredHistory.length} records found</span>
        </div>
        
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading history...</div>
        ) : filteredHistory.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>No transactions found for the selected period.</div>
        ) : (
          <div className="table-responsive-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-3)', color: 'var(--text-2)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>Date</th>
                  <th style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>User & Branch</th>
                  <th style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>Plan</th>
                  <th style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>Trans ID</th>
                  <th style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>Amount</th>
                  <th style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map(tx => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '16px 20px', fontSize: 13 }}>
                      {new Date(tx.created_at).toLocaleDateString()} <br />
                      <span style={{ color: 'var(--text-3)', fontSize: 11 }}>{new Date(tx.created_at).toLocaleTimeString()}</span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{tx.user_name || '-'}</div>
                      <div style={{ color: 'var(--text-3)', fontSize: 12 }}>{tx.branch_name || '-'}</div>
                    </td>
                    <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text)' }}>
                      {tx.plan_name || '-'}
                    </td>
                    <td style={{ padding: '16px 20px', fontFamily: 'monospace', fontSize: 13, color: 'var(--text-2)' }}>
                      {tx.transaction_id || '-'}
                    </td>
                    <td style={{ padding: '16px 20px', fontWeight: 800, color: 'var(--green)' }}>
                      {tx.currency || 'MYR'} {tx.amount.toFixed(2)}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <Chip color="var(--green)">{tx.status}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
