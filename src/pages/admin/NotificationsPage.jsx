import React, { useMemo } from 'react';

/*
 * NotificationsPage
 * -----------------
 * NOTE: This file was reconstructed by OS2 Studio because the developer's
 * App.js imports `./pages/admin/NotificationsPage` but the file was missing
 * from the 25.07 archive (the RAR was truncated). It builds the notification
 * list from the same data the app already holds, using the same event types
 * as NotificationsDropdown, so the `notifications` route compiles and works.
 * If the developer later supplies their own NotificationsPage, replace this file.
 */

const timeAgo = (d) => {
  if (!d) return '';
  const t = new Date(d).getTime();
  if (isNaN(t)) return '';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const Row = ({ icon, color, title, sub, when }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: '14px 16px', borderBottom: '1px solid var(--border)',
  }}>
    <div style={{
      width: 34, height: 34, borderRadius: 9, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--accent-dim)', color: color || 'var(--accent)', fontSize: 16,
    }}>{icon}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
    </div>
    {when && <div style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0, whiteSpace: 'nowrap' }}>{when}</div>}
  </div>
);

export const NotificationsPage = ({ user, users = [], branches = [], pendingJobs = [], jobRequests = [], sessions = [], inventory = [], loyalty, onNav }) => {
  const items = useMemo(() => {
    const list = [];

    (jobRequests || []).filter(r => (r.status || '').toLowerCase() === 'pending').forEach(r => {
      list.push({
        key: `req-${r.id}`, icon: '📩', color: 'var(--accent)',
        title: 'New job request',
        sub: `${r.customer_name || 'Customer'}${r.vehicle_plate ? ' · ' + r.vehicle_plate : ''}`,
        ts: r.created_at,
      });
    });

    (pendingJobs || []).forEach(j => {
      list.push({
        key: `job-${j.id}`, icon: '🧽', color: 'var(--accent-2)',
        title: 'Job in progress',
        sub: `${j.customer_name || 'Customer'}${j.washer_name ? ' · ' + j.washer_name : ''}`,
        ts: j.created_at || j.assigned_at,
      });
    });

    (inventory || []).filter(it => Number(it.quantity) <= Number(it.low_stock_alert)).forEach(it => {
      list.push({
        key: `stock-${it.id}`, icon: '⚠️', color: '#d97706',
        title: 'Low stock',
        sub: `${it.name} — ${it.quantity} left`,
        ts: null,
      });
    });

    (sessions || []).slice(0, 15).forEach(s => {
      list.push({
        key: `sess-${s.id}`, icon: '✅', color: '#059669',
        title: 'Wash completed',
        sub: `${s.customer_name || 'Customer'}${s.amount != null ? ' · ' + s.amount : ''}`,
        ts: s.created_at || s.date,
      });
    });

    return list
      .sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime())
      .slice(0, 60);
  }, [jobRequests, pendingJobs, inventory, sessions]);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Notifications</h2>
        <span style={{
          fontSize: 13, fontWeight: 700, color: 'var(--accent)',
          background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)',
          borderRadius: 999, padding: '3px 10px',
        }}>{items.length}</span>
      </div>

      <div style={{
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {items.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🔔</div>
            <div style={{ fontSize: 14 }}>You're all caught up.</div>
          </div>
        ) : items.map(it => (
          <Row key={it.key} icon={it.icon} color={it.color} title={it.title} sub={it.sub} when={timeAgo(it.ts)} />
        ))}
      </div>
    </div>
  );
};

export default NotificationsPage;
