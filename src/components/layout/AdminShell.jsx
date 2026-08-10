import React, { useState } from 'react';
import { ThemeToggle } from '../common/UI';
import NotificationsDropdown from '../common/NotificationsDropdown';
import logoLight from '../../assets/smart-garage-light/Smart-Garage-h.png';
import logoDark from '../../assets/smart-garage-dark/smart-garage-dark-theme-har.png';
import backArrow from '../../assets/icons/back-arrow-icon.png';

/**
 * Role → nav access:
 * SupremeAdmin — all items (cross-branch analytics, approvals, subscriptions)
 * SuperAdmin   — Dashboard, Sessions, Customers, Washers,
 *                Packages, QR, Reports, Loyalty  (NO Branches, Credentials, Map)
 */
const NAV = [
  { id: 'dashboard', label: 'Dashboard', super: false, path: 'M3 3h7v7H3zM13 3h7v7h-7zM3 13h7v7H3z' },
  { id: 'sessions', label: 'Sessions', super: false, path: 'M4 6h16M4 10h16M4 14h10' },
  { id: 'customers', label: 'Customers', super: false, path: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
  { id: 'washers', label: 'Workers', super: false, path: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8' },
  { id: 'packages', label: 'Packages', super: false, path: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12' },

  { id: 'payment_settings', label: 'Payment Settings', super: false, path: 'M3 10h18M7 15h.01M11 15h2M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6z' },
  { id: 'reports', label: 'Reports', super: false, path: 'M18 20V10M12 20V4M6 20v-6' },
  { id: 'loyalty', label: 'Loyalty', super: false, path: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z' },
  { id: 'products', label: 'Inventory', super: false, path: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { id: 'retail_products', label: 'Products', super: false, path: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
  { id: 'job_requests', label: 'Job Requests', super: false, path: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { id: 'my_plan', label: 'My Plan', super: false, superAdminOnly: true, path: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'gst_manager', label: 'GST Manager', super: false, superAdminOnly: true, path: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  // SuperAdmin-only below
  { id: 'branches', label: 'Branches', super: false, path: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10' },
  { id: 'super_admins', label: 'Super Admins', super: true, path: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zM12 11a2 2 0 100-4 2 2 0 000 4zm-3 5c0-2 2-3 3-3s3 1 3 3' },
  { id: 'subscriptions', label: 'Subscription Plans', super: true, path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
  { id: 'sub_history', label: 'Subscription History', super: true, path: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'credentials', label: 'Credentials', super: false, path: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4' },
  { id: 'map', label: 'Live Map', super: false, path: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 13a3 3 0 100-6 3 3 0 000 6z' },
];

const Icon = ({ path, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);

export const AdminShell = ({ user, nav, onNav, sessions, inventory, users, branches, pendingJobs, jobRequests, loyalty, onLogout, isDark, onToggleTheme, branchSubscription, children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isBranchAdmin = user?.role === 'Admin';
  const isSuperAdmin = user?.role === 'SuperAdmin';
  const isSupremeAdmin = user?.role === 'SupremeAdmin';
  const lowStockItems = inventory?.filter(item => item.quantity <= item.low_stock_alert) || [];

  const sidebarW = collapsed ? 58 : 220;
  const visibleNav = NAV.filter(n => {
    if (isSupremeAdmin) {
      return ['dashboard', 'reports', 'subscriptions', 'sub_history', 'super_admins', 'payment_settings', 'credentials'].includes(n.id);
    }
    // Super Admin & Branch Admin Logic
    if (n.super) return false;

    // Branch Admin (role Admin) cannot manage branches, hide Branches menu
    if (isBranchAdmin && n.id === 'branches') return false;

    // Only show 'My Plan' for Super Admins
    if (n.superAdminOnly && !isSuperAdmin) return false;

    // Apply subscription restrictions
    if (!branchSubscription?.has_loyalty && n.id === 'loyalty') return false;

    if (!branchSubscription?.has_reports && n.id === 'reports') return false;

    return true;
  });
  const current = NAV.find(n => n.id === nav);

  const SidebarContent = () => (
    <div style={{
      width: sidebarW, height: '100%',
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
              {(item.id === 'products' || item.id === 'retail_products') && lowStockItems.length > 0 && collapsed && (
                <span style={{
                  position: 'absolute',
                  right: 18,
                  top: 8,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--red)',
                  boxShadow: '0 0 6px var(--red)'
                }} />
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
                  {(item.id === 'products' || item.id === 'retail_products') && lowStockItems.length > 0 && (
                    <span style={{ background: 'var(--red)', color: '#fff', borderRadius: 99, padding: '1px 6px', fontSize: 14, fontWeight: 700 }} title={`${lowStockItems.length} items low on stock`}>
                      {lowStockItems.length}
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
                {isSupremeAdmin ? 'Supreme Admin' : isSuperAdmin ? 'Super Admin' : 'Branch Admin'}
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
        @media(min-width:1024px){
          .desktop-sidebar { display: block !important; }
          .mobile-menu-btn { display: none !important; }
        }
      `}</style>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={() => setMobileOpen(false)} />
          <div style={{ position: 'relative', zIndex: 1, height: '100%' }}><SidebarContent /></div>
        </div>
      )}

      {/* Main */}
      <div className="print-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Topbar */}
        <div className="admin-topbar" style={{
          height: 58, padding: '0 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-2)', position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>


            <div style={{ marginLeft: 10, display: 'flex', alignItems: 'center', gap: 12 }} className="desktop-title">
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                  {current?.label || 'Dashboard'}
                </div>
                <div className="hide-mobile" style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  {new Date().toLocaleDateString('en-MY', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>
          </div>

          <div className="logo-typo" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 5 }}>
            <img src={isDark ? logoDark : logoLight} alt="Smart Garage" onClick={() => onNav('dashboard')} style={{ height: 40, width: 'auto', maxWidth: 160, objectFit: 'contain', pointerEvents: 'auto', cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = 0.8} onMouseLeave={e => e.currentTarget.style.opacity = 1} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {(isSuperAdmin || isBranchAdmin) && (
              <span className="header-actions-badge hide-mobile" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)', borderRadius: 6, padding: '3px 8px' }}>
                {isSuperAdmin ? 'Super Admin' : 'Branch Admin'}
              </span>
            )}

            {isSupremeAdmin && (
              <span className="header-actions-badge hide-mobile" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-2)', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, padding: '3px 8px', boxShadow: '0 0 10px rgba(139,92,246,0.15)' }}>
                Supreme Admin
              </span>
            )}

            <div className="header-actions-username hide-mobile" style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{user.name}</div>
            <NotificationsDropdown
              user={user}
              users={users}
              branches={branches}
              pendingJobs={pendingJobs}
              jobRequests={jobRequests}
              sessions={sessions}
              inventory={inventory}
              loyalty={loyalty}
              onNav={onNav}
            />
            <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
          </div>
        </div>

        {/* Page content */}
        <div style={{ padding: '24px', flex: 1, overflowX: 'hidden' }} className="page-enter admin-content">


          {nav !== 'dashboard' && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
              <button onClick={() => onNav('dashboard')}
                style={{
                  background: 'none', border: 'none',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.2s', padding: 4, width: 'fit-content'
                }}
              >
                <img src={backArrow} alt="Back" style={{ width: 24, height: 24 }} />
              </button>
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
};
