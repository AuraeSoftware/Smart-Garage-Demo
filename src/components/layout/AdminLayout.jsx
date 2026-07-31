import React, { useState } from 'react';
import { ThemeToggle } from '../common/UI';
import NotificationPanel from '../common/NotificationPanel';
import logoLight from '../../assets/Rwash-Brand-Color/RWASH-Typo-logo-head-.png';
import logoDark from '../../assets/Rwash-Single-Color/RWASH-Typo-logo-White.png';


/**
 * Role → nav access:
 * SuperAdmin  — all items
 * SuperAdmin — Dashboard, Sessions, Customers, Washers,
 *               Packages, QR, Reports, Loyalty  (NO Branches, Credentials, Map)
 */
const NAV = [
  { id: 'dashboard', label: 'Dashboard', super: false, path: 'M3 3h7v7H3zM13 3h7v7h-7zM3 13h7v7H3z' },
  { id: 'sessions', label: 'Sessions', super: false, path: 'M4 6h16M4 10h16M4 14h10' },
  { id: 'customers', label: 'Customers', super: false, path: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
  { id: 'washers', label: 'Washers', super: false, path: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8' },
  { id: 'packages', label: 'Packages', super: false, path: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12' },

  { id: 'reports', label: 'Reports', super: false, path: 'M18 20V10M12 20V4M6 20v-6' },
  { id: 'loyalty', label: 'Loyalty', super: false, path: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z' },
  { id: 'products', label: 'Inventory', super: false, path: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { id: 'retail_products', label: 'Products', super: false, path: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
  // SuperAdmin-only below
  { id: 'branches', label: 'Branches', super: true, path: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10' },
  { id: 'credentials', label: 'Credentials', super: false, path: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4' },
  { id: 'map', label: 'Live Map', super: false, path: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 13a3 3 0 100-6 3 3 0 000 6z' },
];

const Icon = ({ path, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);

export const AdminShell = ({ user, nav, onNav, sessions, inventory, onLogout, isDark, onToggleTheme, children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isSuperAdmin = user?.role === 'SuperAdmin';
  const isSupremeAdmin = user?.role === 'SupremeAdmin';
  const lowStockItems = inventory?.filter(item => item.quantity <= item.low_stock_alert) || [];

  const sidebarW = collapsed ? 58 : 220;
  const visibleNav = NAV.filter(n => {
    if (isSupremeAdmin) {
      return ['dashboard', 'reports', 'customers', 'packages', 'loyalty', 'credentials', 'map'].includes(n.id);
    }
    return !n.super || isSuperAdmin;
  });
  const current = NAV.find(n => n.id === nav);

  const SidebarContent = () => (
    <div style={{
      width: sidebarW, height: '100vh',
      background: 'var(--sidebar)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.2s ease', overflow: 'hidden', flexShrink: 0,
    }}>

      {/* ── Logo ── */}
      <div>

        {!collapsed && (
          <button onClick={() => setCollapsed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, fontSize: 18, lineHeight: 1 }}>
            ‹
          </button>
        )}
        {collapsed && (
          <button onClick={() => setCollapsed(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px 0', fontSize: 18, lineHeight: 1, display: 'block', width: '100%', textAlign: 'center' }}>
            ›
          </button>
        )}
      </div>

      {/* ── Nav items — scrollable ── */}
      <nav className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: collapsed ? '6px' : '6px 8px', minHeight: 0 }}>
        {!collapsed && (
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 6px 4px' }}>
            Menu
          </div>
        )}
        {visibleNav.map(item => {
          const active = nav === item.id;
          return (
            <button key={item.id}
              title={collapsed ? item.label : ''}
              onClick={() => { onNav(item.id); setMobileOpen(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                gap: 9, padding: collapsed ? '9px 0' : '8px 10px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 8, marginBottom: 1, cursor: 'pointer',
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-3)',
                fontWeight: active ? 700 : 400, fontSize: 13,
                border: 'none', fontFamily: 'inherit', transition: 'all 0.14s',
                position: 'relative',
              }}
            >
              {active && !collapsed && (
                <span style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, borderRadius: 99, background: 'var(--accent)' }} />
              )}
              <span style={{ color: active ? 'var(--accent)' : 'inherit', flexShrink: 0 }}>
                <Icon path={item.path} size={15} />
              </span>
              {!collapsed && (
                <>
                  <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                  {item.id === 'sessions' && sessions.length > 0 && (
                    <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 99, padding: '1px 6px', fontSize: 14, fontWeight: 700 }}>
                      {sessions.length}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── User + logout — PINNED to bottom, never scrolls away ── */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: collapsed ? '10px 6px' : '12px 12px',
        flexShrink: 0,
        background: 'var(--sidebar)',
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: 'var(--accent)', flexShrink: 0,
            }}>
              {user.name?.slice(0, 2).toUpperCase() || '??'}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                {isSuperAdmin ? 'Super Admin' : isSupremeAdmin ? 'Supreme Admin' : 'Super Admin'}
              </div>
            </div>
          </div>
        )}
        <button onClick={onLogout}
          style={{
            width: '100%', background: 'rgba(220,38,38,0.06)',
            border: '1px solid rgba(220,38,38,0.18)', borderRadius: 8,
            padding: collapsed ? '9px' : '8px 10px',
            fontSize: 14, fontWeight: 600, color: 'var(--red)',
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <Icon path="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" size={13} />
          {!collapsed && 'Sign out'}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Desktop sidebar */}
      <div className="desktop-sidebar" style={{ display: 'none', height: '100vh', position: 'sticky', top: 0, flexShrink: 0 }}>
        <SidebarContent />
      </div>

      <style>{`
        @media(min-width:768px){
          .desktop-sidebar { display: block !important; }
          .mobile-menu-btn { display: none !important; }
        }
      `}</style>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={() => setMobileOpen(false)} />
          <div style={{ position: 'relative', zIndex: 1 }}><SidebarContent /></div>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Topbar */}
        <div style={{
          height: 58, padding: '0 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-2)', position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, color: 'var(--text-2)' }}>
              <Icon path="M3 12h18M3 6h18M3 18h12" size={18} />
            </button>
            <div className="logo-typo" style={{ display: 'flex' }}>
              <img src={isDark ? logoDark : logoLight} alt="RWASH" height="30" />
            </div>
            <div style={{ marginLeft: 10 }} className="desktop-title">
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                {current?.label || 'Dashboard'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                {new Date().toLocaleDateString('en-MY', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            {isSuperAdmin && (
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)', borderRadius: 6, padding: '3px 8px' }}>
                Super Admin
              </span>
            )}

            {isSupremeAdmin && (
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-2)', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, padding: '3px 8px', boxShadow: '0 0 10px rgba(139,92,246,0.15)' }}>
                Supreme Admin
              </span>
            )}

            {isSuperAdmin && (
              <NotificationPanel lowStockItems={lowStockItems} />
            )}

            <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{user.name}</div>
            <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
            <button onClick={onLogout} style={{ background: 'rgba(218,26,49,0.07)', border: '1px solid rgba(218,26,49,0.18)', borderRadius: 8, padding: '7px 12px', fontSize: 14, fontWeight: 600, color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
          </div>
        </div>

        {/* Page content */}
        <div style={{ padding: '24px', flex: 1, overflowX: 'hidden' }} className="page-enter">
          {children}
        </div>
      </div>
    </div>
  );
};
