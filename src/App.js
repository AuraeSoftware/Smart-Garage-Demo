import React, { useState, useEffect } from 'react';
import { useTheme } from './hooks/useTheme';
import { useNotification } from './hooks/useNotification';
import { useAppData } from './hooks/useAppData';
import { useHashNav } from './hooks/useHashNav';
import { ToastStack, EmptyState, Modal, Btn } from './components/common/UI';
import { AdminShell } from './components/layout/AdminShell';
import { LoginPage } from './pages/LoginPage';
import { WasherApp } from './pages/washer/WasherApp';
import LogoLightWithoutTagline from './assets/smart-garage-light/Smart-Garage-vertical.png';
import LogoDarkWithoutTagline from './assets/smart-garage-dark/smart-garage-dark-theme-v.png';
import { IndividualDashboard } from './pages/IndividualDashboard';
import { Dashboard } from './pages/admin/Dashboard';
import { Sessions } from './pages/admin/Sessions';
import { Customers } from './pages/admin/Customers';
import { Branches } from './pages/admin/Branches';
import { SuperAdminProducts } from './pages/admin/SuperAdminProducts';
import { SuperAdminsPage } from './pages/admin/SuperAdminsPage';
import { SubscriptionHistoryPage } from './pages/admin/SubscriptionHistoryPage';

import { InventoryList } from './pages/admin/InventoryList';
import { RetailProducts } from './pages/admin/RetailProducts';
import { AssignJob } from './pages/admin/AssignJob';
import { JobRequestsAdmin } from './pages/admin/JobRequestsAdmin';
import { MyPlanPage } from './pages/admin/MyPlanPage';
import { GstManager } from './pages/admin/GstManager';
import { JobRequestForm } from './pages/public/JobRequestForm';
import { JobTracking } from './pages/public/JobTracking';
import { API, token } from './utils/api';
import {
  Washers, Credentials, Packages, PaymentSettingsPage, Reports, LiveMap, LoyaltySettings, SubscriptionPlans, CurrencyConfigPage
} from './pages/admin/AdminPages';
import { NotificationsPage } from './pages/admin/NotificationsPage';

export default function App() {
  const { theme, toggleTheme, isDark } = useTheme();
  const { toasts, notify, dismiss } = useNotification();
  const data = useAppData();
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [adminNav, setAdminNav] = useHashNav('dashboard');
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [limitModalOpen, setLimitModalOpen] = useState(false);

  useEffect(() => {
    const handleLimitModal = () => setLimitModalOpen(true);
    window.addEventListener('show_limit_modal', handleLimitModal);
    return () => window.removeEventListener('show_limit_modal', handleLimitModal);
  }, []);

  useEffect(() => {
    document.body.style.background = 'var(--bg)';
    document.body.style.color = 'var(--text)';
  }, [theme]);

  useEffect(() => {
    // 2-second visual delay to show a premium and smooth loading sequence
    const delayTimer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 2000);

    const stored = token.get();
    if (!stored) { data.markReady(); setAuthChecked(true); return () => clearTimeout(delayTimer); }
    API.auth.me()
      .then(user => { setCurrentUser(user); setAuthChecked(true); data.loadAll(user); })
      .catch(() => { token.clear(); data.markReady(); setAuthChecked(true); });

    return () => clearTimeout(delayTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'washpro:token') {
        window.location.reload();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ── Real-time WebSocket toast notifications ──────────────────
  useEffect(() => {
    if (!currentUser || !data.subscribeToWsEvents) return;
    const role = currentUser.role;
    const isAdmin = role === 'SuperAdmin' || role === 'SupremeAdmin' || role === 'Admin';
    const isWasher = role === 'Washer';
    const isSupreme = role === 'SupremeAdmin';

    const unsubscribe = data.subscribeToWsEvents((type, payload) => {
      const msg = payload?.message || '';
      switch (type) {
        case 'session.created':
          if (isAdmin) notify('' + (msg || 'New job session completed'), 'success');
          break;
        case 'job.assigned':
          if (isAdmin || isWasher) notify(' ' + (msg || 'New job assigned'), 'info');
          break;
        case 'job.completed':
          if (isAdmin || isWasher) notify(' ' + (msg || 'Job completed!'), 'success');
          break;
        case 'job.updated':
          // Subtle — don't notify for every update
          break;
        case 'jobrequest.new':
          if (isAdmin) notify(' ' + (msg || 'New customer job request received'), 'info', 5000);
          break;
        case 'jobrequest.assigned':
          if (isAdmin) notify(' ' + (msg || 'Job request assigned'), 'success');
          break;
        case 'inventory.restocked':
          if (isAdmin || isWasher) notify(' ' + (msg || 'Inventory restocked'), 'success');
          break;
        case 'inventory.created':
          if (isAdmin) notify(' ' + (msg || 'New inventory item added'), 'info');
          break;
        case 'inventory.deleted':
          if (isAdmin) notify(' ' + (msg || 'Inventory item removed'), 'warning');
          break;
        case 'product.created':
          if (isAdmin) notify(' ' + (msg || 'New product added'), 'info');
          break;
        case 'user.registered':
          if (isSupreme) notify(' ' + (msg || 'New super admin registration — pending approval'), 'info', 6000);
          break;
        case 'user.created':
          if (isAdmin) notify(' ' + (msg || 'New user created'), 'info');
          break;
        case 'plan.upgrade_requested':
          if (isSupreme) notify(' ' + (msg || 'Plan upgrade request submitted'), 'info', 6000);
          break;
        case 'plan.upgraded':
          notify(' ' + (msg || 'Plan has been upgraded!'), 'success', 6000);
          window.dispatchEvent(new CustomEvent('plan_upgraded'));
          break;
        default:
          break;
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, data.subscribeToWsEvents]);


  const handleLogout = () => {
    token.clear(); setCurrentUser(null); setAdminNav('dashboard');
    window.location.href = window.location.origin + window.location.pathname;
  };

  const isSupremeAdmin = currentUser?.role === 'SupremeAdmin';
  const isSuperAdmin = currentUser?.role === 'SuperAdmin';
  const isIndividual = currentUser?.role === 'IndividualUser';
  const isAdminRole = isSuperAdmin || isSupremeAdmin || currentUser?.role === 'Admin';

  const userBranchId = currentUser?.branch_id || currentUser?.branchId;
  const activeBranch = data.branches?.find(b => b.id === userBranchId);
  const branchSubscriptionId = currentUser?.subscription || activeBranch?.subscription || 'trial';
  const branchSubscription = data.subscriptionPlans?.find(p => p.id === branchSubscriptionId) || {
    id: 'trial', max_branches: 1, max_washers: 0, max_sessions: 0,
    has_loyalty: true, has_qr: true, has_reports: true,
    has_ai_scanning: true, has_multiple_branches: true, has_payment_gateway: true
  };

  // ── Subscription Routing Guard
  useEffect(() => {
    if (isAdminRole && !isSupremeAdmin) {
      const restricted = [];
      if (!branchSubscription?.has_loyalty) restricted.push('loyalty');

      if (!branchSubscription?.has_reports) restricted.push('reports');

      if (restricted.includes(adminNav)) {
        setAdminNav('dashboard');
      }
    }
  }, [adminNav, branchSubscription, isAdminRole, isSupremeAdmin, setAdminNav]);

  if (!authChecked || !data.ready || !minTimeElapsed) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="loading-logo-container">
          <img
            src={LogoLightWithoutTagline}
            alt="Smart Garage"
            className="spark-blink-logo logo-light"
            style={{ height: '25%', width: 'auto', objectFit: 'contain' }}
          />
          <img
            src={LogoDarkWithoutTagline}
            alt="Smart Garage"
            className="spark-blink-logo logo-dark"
            style={{ height: '25%', width: 'auto', objectFit: 'contain' }}
          />
        </div>
        <div style={{ color: 'var(--text-3)', marginTop: 8, fontSize: 12, fontWeight: 600, letterSpacing: '0.08em' }}>LOADING SYSTEM...</div>

        {/* Sleek animated glowing progress bar */}
        <div style={{
          width: 140,
          height: 3,
          background: 'var(--border)',
          borderRadius: 2,
          marginTop: 14,
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: '100%',
            background: 'var(--accent)',
            borderRadius: 2,
            transformOrigin: 'left',
            animation: 'loadingProgress 2s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            boxShadow: '0 0 8px var(--accent)'
          }} />
        </div>
      </div>
    </div>
  );

  const hash = window.location.hash;
  if (hash.startsWith('#/job-request/')) {
    const branchId = hash.split('/')[2];
    return <JobRequestForm branchId={branchId} isDark={isDark} />;
  }

  if (hash.startsWith('#/track/')) {
    const trackingId = hash.split('/')[2];
    return <JobTracking trackingId={trackingId} isDark={isDark} />;
  }

  // ── Page router
  // Strict gating to prevent URL modification bypassing
  const adminPage = () => {
    const isSupremeAdmin = currentUser?.role === 'SupremeAdmin';
    const isSuperAdmin = currentUser?.role === 'SuperAdmin';
    const isBranchAdmin = currentUser?.role === 'Admin';

    // Verify access
    if (!isSupremeAdmin) {
      if (isBranchAdmin && adminNav === 'branches') {
        return <EmptyState icon="🔒" title="Access Denied" sub="Branch Admins cannot manage branches." />;
      }
      if (adminNav === 'my_plan' && !isSuperAdmin) {
        return <EmptyState icon="🔒" title="Access Denied" sub="Only Super Admins can manage plans." />;
      }

      const requiresPlan = {
        loyalty: 'has_loyalty',
        qr: 'has_qr',
        reports: 'has_reports'
      };

      if (requiresPlan[adminNav] && !branchSubscription?.[requiresPlan[adminNav]]) {
        return <EmptyState icon="🔒" title="Upgrade Required" sub={`The ${adminNav} module is not available on your current plan.`} />;
      }
    }

    switch (adminNav) {
      case 'dashboard': return <Dashboard sessions={data.sessions} users={data.users} packages={data.packages} customers={data.customers} loyalty={data.loyalty} updateLoyalty={data.updateLoyalty} notify={notify} onNav={setAdminNav} userRole={currentUser.role} branches={data.branches} currentUser={currentUser} branchSubscription={branchSubscription} subscriptionPlans={data.subscriptionPlans} />;
      case 'assign_job': return <AssignJob users={data.users} packages={data.packages} pendingJobs={data.pendingJobs} branches={data.branches} currentUser={currentUser} addPendingJob={data.addPendingJob} notify={notify} onNav={setAdminNav} branchSubscription={branchSubscription} sessions={data.sessions} />;
      case 'sessions': return <Sessions sessions={data.sessions} users={data.users} branches={data.branches} onNav={setAdminNav} currentUser={currentUser} />;
      case 'customers': return <Customers customers={data.customers} sessions={data.sessions} branches={data.branches} updateCustomers={data.updateCustomers} updateCustomer={data.updateCustomer} notify={notify} onNav={setAdminNav} users={data.users} currentUser={currentUser} />;
      case 'my_plan': return <MyPlanPage currentUser={currentUser} branchSubscription={branchSubscription} data={data} />;
      case 'washers': return <Washers users={data.users} sessions={data.sessions} branches={data.branches} createUser={data.createUser} updateUser={data.updateUser} deleteUser={data.deleteUser} notify={notify} userRole={currentUser.role} currentUser={currentUser} branchSubscription={branchSubscription} onNav={setAdminNav} />;
      case 'credentials': return <Credentials users={data.users} sessions={data.sessions} updateUser={data.updateUser} deleteUser={data.deleteUser} notify={notify} userRole={currentUser.role} currentUser={currentUser} onNav={setAdminNav} />;
      case 'packages': return <Packages packages={data.packages} branches={data.branches} sessions={data.sessions} inventory={data.inventory} createPackage={data.createPackage} updatePackage={data.updatePackage} deletePackage={data.deletePackage} notify={notify} onNav={setAdminNav} branchSubscription={branchSubscription} currentUser={currentUser} />;
      case 'subscriptions': return <SubscriptionPlans plans={data.subscriptionPlans} createPlan={data.createSubscriptionPlan} updatePlan={data.updateSubscriptionPlan} deletePlan={data.deleteSubscriptionPlan} notify={notify} onNav={setAdminNav} />;
      case 'currency_config': return <CurrencyConfigPage plans={data.subscriptionPlans} notify={notify} />;
      case 'sub_history': return <SubscriptionHistoryPage branches={data.branches} currentUser={currentUser} users={data.users} />;
      case 'branches': return <Branches branches={data.branches} users={data.users} sessions={data.sessions} createBranch={data.createBranch} updateBranch={data.updateBranch} deleteBranch={data.deleteBranch} createUser={data.createUser} updateUser={data.updateUser} notify={notify} userRole={currentUser.role} currentUser={currentUser} subscriptionPlans={data.subscriptionPlans} onNav={setAdminNav} />;
      case 'super_admins': return <SuperAdminsPage users={data.users} branches={data.branches} subscriptionPlans={data.subscriptionPlans} updateUser={data.updateUser} deleteUser={data.deleteUser} updateBranch={data.updateBranch} notify={notify} onNav={setAdminNav} />;
      case 'gst_manager': return <GstManager notify={notify} />;
      case 'job_requests': return <JobRequestsAdmin jobRequests={data.jobRequests} users={data.users} pendingJobs={data.pendingJobs} packages={data.packages} branches={data.branches} currentUser={currentUser} assignJobRequest={data.assignJobRequest} notify={notify} sessions={data.sessions} branchSubscription={branchSubscription} onNav={setAdminNav} />;

      case 'payment_settings': return <PaymentSettingsPage currentUser={currentUser} notify={notify} branchSubscription={branchSubscription} />;
      case 'reports': return <Reports sessions={data.sessions} packages={data.packages} branches={data.branches} branchSubscription={branchSubscription} users={data.users} userRole={currentUser.role} currentUser={currentUser} onNav={setAdminNav} />;
      case 'map': return <LiveMap sessions={data.sessions} pendingJobs={data.pendingJobs} branches={data.branches} onNav={setAdminNav} />;
      case 'notifications': return <NotificationsPage user={currentUser} users={data.users} branches={data.branches} pendingJobs={data.pendingJobs} jobRequests={data.jobRequests} sessions={data.sessions} inventory={data.inventory} loyalty={data.loyalty} onNav={setAdminNav} />;
      case 'loyalty': return <LoyaltySettings currentUser={currentUser} customers={data.customers} sessions={data.sessions} loyalty={data.loyalty} updateLoyalty={data.updateLoyalty} notify={notify} onNav={setAdminNav} />;
      case 'products':
        return <InventoryList
          inventory={data.inventory}
          branches={data.branches}
          createInventoryItem={data.createInventoryItem}
          updateInventoryItem={data.updateInventoryItem}
          deleteInventoryItem={data.deleteInventoryItem}
          restockInventoryItem={data.restockInventoryItem}
          consumeInventoryItem={data.useInventoryItem}
          notify={notify}
          userRole={currentUser.role}
          currentUser={currentUser}
          branchSubscription={branchSubscription}
          onNav={setAdminNav}
        />;
      case 'retail_products':
        return <RetailProducts
          inventory={data.inventory}
          branches={data.branches}
          createInventoryItem={data.createInventoryItem}
          updateInventoryItem={data.updateInventoryItem}
          deleteInventoryItem={data.deleteInventoryItem}
          restockInventoryItem={data.restockInventoryItem}
          consumeInventoryItem={data.useInventoryItem}
          notify={notify}
          userRole={currentUser.role}
          currentUser={currentUser}
          branchSubscription={branchSubscription}
          onNav={setAdminNav}
        />;
      default: return null;
    }
  };

  return (
    <>
      <ToastStack toasts={toasts} dismiss={dismiss} />

      {!currentUser ? (
        <LoginPage isDark={isDark} onToggleTheme={toggleTheme} />

      ) : isAdminRole ? (
        /* ── SupremeAdmin + SuperAdmin both use AdminShell ────── */
        // AdminShell filters nav items based on user.role internally
        <AdminShell
          user={currentUser}
          nav={adminNav}
          onNav={setAdminNav}
          sessions={data.sessions}
          inventory={data.inventory}
          users={data.users}
          branches={data.branches}
          pendingJobs={data.pendingJobs}
          jobRequests={data.jobRequests}
          loyalty={data.loyalty}
          onLogout={handleLogout}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          branchSubscription={branchSubscription}
        >
          {adminPage()}
        </AdminShell>

      ) : isIndividual ? (
        // ── Individual Customer Dashboard ────────────────────
        <IndividualDashboard
          user={currentUser}
          onLogout={handleLogout}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />

      ) : (
        // ── Worker App ────────────────────────────────────────
        <WasherApp
          user={currentUser}
          packages={data.packages}
          inventory={data.inventory}
          consumeInventoryItem={data.useInventoryItem}
          qrLabel={data.qr}
          bankDetails={data.bankDetails}
          branches={data.branches}
          onLogout={handleLogout}
          onAddSession={data.addSession}
          addPendingJob={data.addPendingJob}
          updatePendingJob={data.updatePendingJob}
          completePendingJob={data.completePendingJob}
          pendingJobs={data.pendingJobs}
          sessions={data.sessions}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          notify={notify}
          branchSubscription={branchSubscription}
        />
      )}
      <Modal open={limitModalOpen} onClose={() => setLimitModalOpen(false)} title="Session Limit Reached" maxWidth={420}>
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>
          <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 20, fontWeight: 800 }}>Plan Limit Exceeded</h3>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 12, lineHeight: 1.5 }}>
            You have reached your plan's maximum session limit. Please upgrade your plan to continue assigning or starting new jobs.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center' }}>
            <Btn onClick={() => setLimitModalOpen(false)} style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }}>Cancel</Btn>
            <Btn onClick={() => { setLimitModalOpen(false); setAdminNav('my_plan'); }} style={{ background: 'var(--red)', color: '#fff', fontWeight: 800 }}>Upgrade Plan</Btn>
          </div>
        </div>
      </Modal>
    </>
  );
}
