import React, { useState } from 'react';
import { getCurrency } from '../../utils/messaging';
import { Card, StatCard, Chip, Btn, Inp, PhoneInp, Modal, EmptyState } from '../../components/common/UI';
import BranchIcon from '../../assets/icons/branch-icon.png';
import ActiveIcon from '../../assets/icons/active-icon.png';
import WorkerIcon from '../../assets/icons/worker-icon.png';
import RevenueIcon from '../../assets/icons/revenue-icon-vec.png';
import CallIcon from '../../assets/icons/phone-icon.png';
import MapIcon from '../../assets/icons/map-icon.png';



const EMPTY_FORM = {
  name: '', address: '', phone: '', manager: '', status: 'Active', subscription: 'trial',
  adminName: '', adminUsername: '', adminPassword: '', adminPhone: '',
};

export const Branches = ({ branches, users, sessions, createBranch, updateBranch, deleteBranch, createUser, updateUser, notify, userRole, currentUser, subscriptionPlans = [] }) => {
  const curr = getCurrency(currentUser?.phone);
  const isSuperAdmin = userRole === 'SuperAdmin';
  const isSupremeAdmin = userRole === 'SupremeAdmin';
  const isBranchAdmin = userRole === 'Admin';

  const userPlanId = currentUser?.subscription || (currentUser?.branch_id && branches.find(b => b.id === currentUser.branch_id)?.subscription) || 'trial';
  const PLAN_MAP = subscriptionPlans.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
  const userPlan = PLAN_MAP[userPlanId] || PLAN_MAP['trial'] || {};
  const ownedBranchesCount = branches.filter(b => b.owner_id === currentUser?.id).length;
  const canAddBranch = isSuperAdmin && (userPlan.max_branches > 0 ? ownedBranchesCount < userPlan.max_branches : userPlan.has_multiple_branches);

  const visibleBranches = isBranchAdmin
    ? branches.filter(b => b.id === (currentUser?.branch_id || currentUser?.branchId))
    : branches;

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showSub, setShowSub] = useState(null);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const branchStats = (brId) => ({
    sessions: sessions.filter(s => (s.branchId || s.branch_id) === brId).length,
    revenue: sessions.filter(s => (s.branchId || s.branch_id) === brId).reduce((a, s) => a + (s.total || 0), 0),
    washers: users.filter(u => (u.branch_id || u.branchId) === brId && u.role === 'Washer').length,
  });

  const handleAdd = async () => {
    if (!form.name || !form.address) { notify('Branch name and address are required', 'error'); return; }
    if (!form.adminName || !form.adminUsername || !form.adminPassword) { notify('Branch Admin credentials are required', 'error'); return; }
    if (form.adminPassword.length < 6) { notify('Password must be at least 6 characters', 'error'); return; }

    setSaving(true); setApiError('');
    try {
      // Step 1 — create branch
      const newBranch = await createBranch({
        name: form.name, address: form.address, phone: form.phone,
        manager: form.adminName, status: form.status, subscription: form.subscription,
      });

      try {
        // Step 2 — create Admin user linked to this branch
        await createUser({
          name: form.adminName,
          username: form.adminUsername,
          password: form.adminPassword,
          phone: form.adminPhone,
          role: 'Admin',
          branch_id: newBranch.id,
        });
      } catch (userErr) {
        // Rollback branch creation if user creation fails
        await deleteBranch(newBranch.id);
        throw userErr;
      }

      setForm(EMPTY_FORM);
      setShowAdd(false);
      notify(`Branch "${form.name}" and admin "${form.adminUsername}" created!`);
    } catch (err) {
      const msg = err.message || 'Failed to create branch';
      setApiError(msg);
      notify(msg, 'error');
    }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!editing?.name || !editing?.address) { notify('Name and address required', 'error'); return; }
    setSaving(true);
    try {
      await updateBranch(editing.id, {
        name: editing.name, address: editing.address, phone: editing.phone,
        manager: editing.manager, status: editing.status, subscription: editing.subscription,
        expiry_date: editing.expiry_date
      });
      setEditing(null);
      notify('Branch updated!');
    } catch (err) { notify(err.message || 'Failed to update', 'error'); }
    setSaving(false);
  };

  const handleToggle = async (id) => {
    const b = branches.find(b => b.id === id);
    const newBranchStatus = b.status === 'Active' ? 'Inactive' : 'Active';
    const newUserStatus = b.status === 'Active' ? 'Suspended' : 'Active';
    try {
      // 1. Update the branch status
      await updateBranch(id, { ...b, status: newBranchStatus });
      // 2. Also update all Admin/SuperAdmin users linked to this branch so they can/cannot login
      const linkedAdmins = (users || []).filter(
        u => (u.branch_id || u.branchId) === id && (u.role === 'Admin' || u.role === 'SuperAdmin')
      );
      await Promise.all(linkedAdmins.map(u => updateUser(u.id, { status: newUserStatus })));
      notify(`${b.status === 'Active' ? 'Deactivated' : 'Reactivated'}: ${b.name}`);
    } catch (err) { notify(err.message || 'Failed', 'error'); }
  };

  const handleDeleteBranch = async (id) => {
    if (!window.confirm("Are you sure you want to delete this branch? This action cannot be undone.")) return;
    try {
      await deleteBranch(id);
      notify("Branch deleted successfully!");
    } catch (err) {
      notify(err.message || "Failed to delete branch", "error");
    }
  };

  const handleUpgradePlan = async (branchId, planId) => {
    const b = branches.find(b => b.id === branchId);
    try {
      await updateBranch(branchId, { ...b, subscription: planId });
      notify(`${b.name} → ${PLAN_MAP[planId]?.label} plan`);
      setShowSub(null);
    } catch (err) { notify(err.message || 'Failed', 'error'); }
  };

  return (
    <>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard icon={<img src={BranchIcon} alt="" style={{ width: 24, height: 24 }} />} label="Branches" value={visibleBranches.length} color="var(--accent)" />
        {!isSupremeAdmin && <StatCard icon={<img src={ActiveIcon} alt="" style={{ width: 24, height: 24 }} />} label="Active" value={visibleBranches.filter(b => b.status === 'Active').length} color="var(--green)" />}
        {!isSupremeAdmin && <StatCard icon={<img src={WorkerIcon} alt="" style={{ width: 24, height: 24 }} />} label="Staff" value={users.filter(u => u.role === 'Washer').length} color="var(--blue)" />}
        <StatCard icon={<img src={RevenueIcon} alt="" style={{ width: 24, height: 24 }} />} label="Total Rev" value={`${curr} ${sessions.reduce((a, s) => a + (s.total || 0), 0).toLocaleString()}`} color="var(--amber)" />
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Branch Network</h2>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Manage branches, subscriptions and admins</p>
        </div>
        {isSuperAdmin && (
          <div>
            {!canAddBranch && (
              <span style={{ fontSize: 12, color: 'var(--amber)', marginRight: 12, background: 'var(--amber)22', padding: '6px 12px', borderRadius: 8 }}>
                Plan upgrade required for multiple branches
              </span>
            )}
            <Btn disabled={!canAddBranch} onClick={() => { setApiError(''); setForm(EMPTY_FORM); setShowAdd(true); }}>+ Add Branch</Btn>
          </div>
        )}
      </div>

      {/* Branch cards */}
      {visibleBranches.length === 0
        ? <EmptyState icon={<img src={BranchIcon} alt="" style={{ width: 48, height: 48 }} />} title="No branches yet" sub='Click "Add Branch" to create your first location' />
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
            {visibleBranches.map(b => {
              const stats = branchStats(b.id);
              const plan = PLAN_MAP[b.subscription] || subscriptionPlans[0] || { label: 'Unknown', color: '#ccc' };
              const isActive = b.status === 'Active';
              const branchAdmins = users.filter(u => (u.branch_id || u.branchId) === b.id && (u.role === 'Admin' || u.role === 'SuperAdmin'));
              const isMainBranch = branchAdmins.some(u => u.role === 'SuperAdmin');

              if (isSuperAdmin) {
                return (
                  <Card key={b.id} style={{ opacity: isActive ? 1 : 0.7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{b.name}</div>
                      <Chip color={b.is_locked ? 'var(--red)' : (isActive ? 'var(--green)' : 'var(--red)')}>{b.is_locked ? 'Locked' : b.status}</Chip>
                    </div>
                    <div style={{ background: 'var(--bg-3)', borderRadius: 9, padding: '14px', textAlign: 'center', marginBottom: 14 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Total Revenue</div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--green)' }}>{curr} {stats.revenue.toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn variant="ghost" size="sm" style={{ flex: 1 }} onClick={() => setEditing({ ...b })} disabled={b.is_locked}>Edit</Btn>
                      <Btn
                        variant={isActive ? 'danger' : 'success'}
                        size="sm"
                        style={{ flex: 1 }}
                        onClick={() => handleToggle(b.id)}
                        disabled={b.is_locked || isMainBranch}
                        title={isMainBranch ? "Main branch cannot be deactivated" : ""}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </Btn>
                      <Btn variant="danger" size="sm" style={{ flex: 1 }} onClick={() => handleDeleteBranch(b.id)} disabled={isMainBranch} title={isMainBranch ? "Main branch cannot be deleted" : ""}>Delete</Btn>
                    </div>
                  </Card>
                );
              }

              return (
                <Card key={b.id} style={{ opacity: isActive ? 1 : 0.7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 3 }}>{b.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}><img src={MapIcon} alt="mapicon" style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} /> {b.address}</div>
                      {b.phone && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}><img src={CallIcon} alt="phoneicon" style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} />{b.phone}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                      <Chip color={b.is_locked ? 'var(--red)' : (isActive ? 'var(--green)' : 'var(--text-3)')}>{b.is_locked ? 'Locked' : b.status}</Chip>
                      <button onClick={() => setShowSub(b)}
                        style={{ background: `${plan.color}12`, border: `1px solid ${plan.color}30`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: plan.color, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {plan.label} ↗
                      </button>
                    </div>
                  </div>

                  {/* Branch Admin badge */}
                  {branchAdmins.length > 0 && (
                    <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)', borderRadius: 8, padding: '7px 10px', marginBottom: 12, fontSize: 12 }}>
                      <span style={{ color: 'var(--text-3)' }}>Admin: </span>
                      <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                        {branchAdmins.map(a => `${a.name} (@${a.username})${a.phone ? ` - ${a.phone}` : ''}`).join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
                    {[['Sessions', stats.sessions, 'var(--accent)'], ['Revenue', `${curr} ${stats.revenue}`, 'var(--green)'], ['Workers', stats.washers, 'var(--blue)']].map(([l, v, col]) => (
                      <div key={l} style={{ background: 'var(--bg-3)', borderRadius: 9, padding: '9px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>{l}</div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: col }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {isSupremeAdmin && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn variant="ghost" size="sm" style={{ flex: 1 }} onClick={() => setEditing({ ...b })} disabled={b.is_locked}>Edit</Btn>
                      <Btn variant={isActive ? 'danger' : 'success'} size="sm" style={{ flex: 1 }} onClick={() => handleToggle(b.id)} disabled={b.is_locked || isMainBranch} title={isMainBranch ? "Main branch cannot be deactivated" : ""}>
                        {isActive ? 'Deactivate' : 'Reactivate'}
                      </Btn>
                      <Btn variant="danger" size="sm" style={{ flex: 1 }} onClick={() => handleDeleteBranch(b.id)} disabled={isMainBranch} title={isMainBranch ? "Main branch cannot be deleted" : ""}>Delete</Btn>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      }

      {/* ── Add Branch + SuperAdmin Modal ── */}
      <Modal title="Add New Branch" open={showAdd} onClose={() => setShowAdd(false)} maxWidth={520}>
        {/* Branch info */}
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Branch Details</div>
        <Inp label="Branch Name *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Petaling Jaya Outlet" />
        <Inp label="Address *" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full street address" />
        <PhoneInp label="Phone" value={form.phone} onChange={e => { const val = e.target.value; set('phone', val); }} placeholder="e.g. 012-3456789" />
        {/* Subscription plan */}
        {isSupremeAdmin && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>Subscription Plan</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {subscriptionPlans.map(plan => (
                <button key={plan.id} onClick={() => set('subscription', plan.id)}
                  style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: `2px solid ${form.subscription === plan.id ? plan.color : 'var(--border)'}`, background: form.subscription === plan.id ? `${plan.color}08` : 'var(--bg-3)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: form.subscription === plan.id ? plan.color : 'var(--text)' }}>{plan.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{plan.price} {plan.duration}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Branch Admin credentials */}
        <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Branch Admin Account</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>Creates the login credentials for this branch's admin</div>

        <Inp label="Admin Full Name *" value={form.adminName} onChange={e => set('adminName', e.target.value)} placeholder="e.g. Ahmad bin Razif" />
        <Inp label="Admin Username *" value={form.adminUsername} onChange={e => set('adminUsername', e.target.value)} placeholder="e.g. admin_pj (no spaces)" />
        <Inp label="Admin Mobile Number" value={form.adminPhone} onChange={e => set('adminPhone', e.target.value)} placeholder="e.g. 012-3456789" />
        <Inp label="Admin Password *" type="password" value={form.adminPassword} onChange={e => set('adminPassword', e.target.value)} placeholder="Min. 6 characters" hint="Branch admin will use this to log in" />

        {apiError && (
          <div style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 9, padding: '10px 13px', fontSize: 13, color: 'var(--red)', marginBottom: 14 }}>
            {apiError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn full onClick={handleAdd} disabled={saving}>{saving ? 'Creating...' : 'Create Branch & Admin'}</Btn>
          <Btn full variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* ── Edit Branch Modal ── */}
      <Modal title="Edit Branch" open={!!editing} onClose={() => setEditing(null)}>
        {editing && <>
          <Inp label="Branch Name" value={editing.name || ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} />
          <Inp label="Address" value={editing.address || ''} onChange={e => setEditing(p => ({ ...p, address: e.target.value }))} />
          <PhoneInp label="Phone" value={editing.phone || ''} onChange={e => { const val = e.target.value; setEditing(p => ({ ...p, phone: val })); }} />
          <Inp label="Branch Manager" value={editing.manager || ''} onChange={e => setEditing(p => ({ ...p, manager: e.target.value }))} />
          {isSupremeAdmin && <Inp label="Expiry Date (YYYY-MM-DD)" value={editing.expiry_date ? editing.expiry_date.split('T')[0] : ''} onChange={e => setEditing(p => ({ ...p, expiry_date: e.target.value }))} />}
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn full onClick={handleUpdate} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Btn>
            <Btn full variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
          </div>
        </>}
      </Modal>

      {/* ── Subscription Modal ── */}
      <Modal title={`Subscription — ${showSub?.name}`} open={!!showSub} onClose={() => setShowSub(null)} maxWidth={480}>
        {showSub && <>
          <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13 }}>
            Current: <b style={{ color: 'var(--text)' }}>{PLAN_MAP[showSub.subscription]?.label || 'No Plan'}</b>
          </div>
          {subscriptionPlans.map(plan => {
            const isCurrent = showSub.subscription === plan.id;
            const feats = Array.isArray(plan.features) ? plan.features : [];
            return (
              <div key={plan.id} style={{ background: isCurrent ? `${plan.color}06` : 'var(--bg-3)', border: `2px solid ${isCurrent ? plan.color : 'var(--border)'}`, borderRadius: 12, padding: '14px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: plan.color }}>{plan.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{feats.join(' · ')}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>{plan.price}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{plan.duration}</div>
                  </div>
                </div>
                {isCurrent
                  ? <div style={{ fontSize: 12, fontWeight: 700, color: plan.color, textAlign: 'center', padding: '6px', background: `${plan.color}10`, borderRadius: 7 }}>Current Plan</div>
                  : isSupremeAdmin && <Btn full variant="outline" size="sm" onClick={() => handleUpgradePlan(showSub.id, plan.id)}>{plan.id === 'trial' ? 'Downgrade' : 'Upgrade'} to {plan.label}</Btn>
                }
              </div>
            );
          })}
          <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 9, fontSize: 12, color: 'var(--text-3)' }}>
            💡 Billing is handled manually. Contact your account manager to process payments.
          </div>
        </>}
      </Modal>
    </>
  );
};
