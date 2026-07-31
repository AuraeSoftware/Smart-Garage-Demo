import React, { useState } from 'react';
import { Card, StatCard, Chip, Btn, Inp, PhoneInp, Modal, EmptyState, Dropdown } from '../../components/common/UI';
import { API } from '../../utils/api';
import ActiveIcon from '../../assets/icons/active-icon.png';
import SuspendIcon from '../../assets/icons/suspend-icon.png';
import BranchIcon from '../../assets/icons/branch-icon.png';
import EditIcon from '../../assets/icons/edit-icon.png';
import SaveIcon from '../../assets/icons/save-icon.png';
import DeleteIcon from '../../assets/icons/delete-icon.png';
import mobileIcon from '../../assets/icons/phone-icon.png';

export const SuperAdminsPage = ({ users, branches, subscriptionPlans, updateUser, deleteUser, updateBranch, notify, onNav }) => {
  const [editing, setEditing] = useState(null);
  const [showSub, setShowSub] = useState(null);
  const [view, setView] = useState('All');
  const [expandedId, setExpandedId] = useState(null);  // inline card expand/collapse

  const PLAN_MAP = (subscriptionPlans || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});

  // Filter only SuperAdmin role users
  const superAdmins = (users || []).filter(u => u.role === 'SuperAdmin');
  const activeCount = superAdmins.filter(u => u.status === 'Active').length;
  const suspendedCount = superAdmins.filter(u => u.status === 'Suspended').length;
  const pendingRequests = superAdmins.filter(u => u.status === 'Pending' || (u.trackingId && u.trackingId.startsWith('UPGRADE-')));
  const displayedAdmins = view === 'Pending' ? pendingRequests : superAdmins.filter(u => u.status !== 'Pending' && u.status !== 'Rejected' && !(u.trackingId && u.trackingId.startsWith('UPGRADE-')));

  const delayedCount = pendingRequests.filter(u => {
    if (!u.createdAt) return false;
    const diff = new Date().getTime() - new Date(u.createdAt).getTime();
    return diff > (48 * 60 * 60 * 1000);
  }).length;

  const getBranch = (u) => {
    const brId = u.branch_id || u.branchId;
    return branches.find(b => String(b.id) === String(brId));
  };

  const handleUpgradePlan = async (userId, planId) => {
    try {
      await updateUser(userId, { subscription: planId });
      const user = superAdmins.find(u => u.id === userId);
      const branchId = user?.branch_id || user?.branchId;
      if (branchId && updateBranch) {
        await updateBranch(branchId, { subscription: planId });
      }
      notify('Subscription updated!');
      setShowSub(null);
    } catch (err) {
      notify(err.message || 'Failed to update subscription', 'error');
    }
  };

  const handleToggle = async (id) => {
    const u = superAdmins.find(u => u.id === id);
    if (!u) return;

    try {
      if (u.status === 'Pending' || (u.trackingId && u.trackingId.startsWith('UPGRADE-'))) {
        await API.admin.approve(id);
        await updateUser(id, { status: 'Active', trackingId: null });
        notify(u.trackingId?.startsWith('UPGRADE-') ? `Upgrade Approved: ${u.name}` : `Activated: ${u.name}`);
        if (onNav) onNav('sub_history');
      } else {
        const newStatus = u.status === 'Active' ? 'Suspended' : 'Active';
        await updateUser(id, { status: newStatus });
        notify(`${newStatus === 'Active' ? 'Activated' : 'Deactivated'}: ${u.name}`);
      }
    } catch (err) {
      notify(err.message || 'Failed to update status', 'error');
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    try {
      const payload = { name: editing.name, phone: editing.phone, email: editing.email, branch_id: editing.branch_id || editing.branchId };
      if (editing._newPwd) payload.password = editing._newPwd;
      await updateUser(editing.id, payload);

      const targetBranchId = editing.branch_id || editing.branchId;
      if (targetBranchId && updateBranch && editing.expiry_date !== undefined) {
        await updateBranch(targetBranchId, { expiry_date: editing.expiry_date });
      }

      setEditing(null);
      notify('Super Admin updated!');
    } catch (err) {
      notify(err.message || 'Failed to update', 'error');
    }
  };

  const handleDelete = async (id) => {
    const u = superAdmins.find(u => u.id === id);
    if (!u) return;
    if (u.role === 'SupremeAdmin') { notify('Cannot delete Supreme Admin', 'error'); return; }
    if (!window.confirm(`Are you sure you want to ${u.status === 'Pending' ? 'reject' : 'delete'} ${u.name}?`)) return;
    try {
      if (u.status === 'Pending' || (u.trackingId && u.trackingId.startsWith('UPGRADE-'))) {
        await API.admin.reject(id);
        if (u.trackingId && u.trackingId.startsWith('UPGRADE-')) {
            await updateUser(id, { trackingId: null });
            notify(`Upgrade Rejected: ${u.name}`);
        } else {
            await updateUser(id, { status: 'Rejected' });
            notify(`Rejected: ${u.name}`);
        }
      } else {
        await deleteUser(id);
        notify(`Removed: ${u.name}`);
      }
    } catch (err) {
      notify(err.message || 'Failed to delete/reject', 'error');
    }
  };

  return (
    <>
      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard
          icon={<svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" /></svg>}
          label="Total Super Admins"
          value={superAdmins.length}
          color="var(--accent)"
        />
        <StatCard
          icon={<img src={ActiveIcon} alt="" style={{ width: 24, height: 24 }} />}
          label="Active"
          value={activeCount}
          color="var(--green)"
        />
        <StatCard
          icon={<img src={SuspendIcon} alt="" style={{ width: 24, height: 24 }} />}
          label="Suspended"
          value={suspendedCount}
          color="var(--red)"
        />
      </div>

      {/* Alert */}
      {delayedCount > 0 && (
        <div style={{ background: 'rgba(218,26,49,0.08)', border: '1px solid rgba(218,26,49,0.3)', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--red)', marginBottom: 2 }}>Action Required</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>You have <strong style={{ color: 'var(--red)' }}>{delayedCount} pending activation request(s)</strong> that have been waiting for more than 2 days. Please review and activate them to avoid service delays.</div>
          </div>
          <Btn style={{ marginLeft: 'auto', background: 'var(--red)', color: '#fff', whiteSpace: 'nowrap' }} onClick={() => setView('Pending')}>View Requests</Btn>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Super Admins</h2>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Manage activation status of all Super Admin accounts</p>
        </div>
        <div style={{ display: 'flex', background: 'var(--bg-3)', padding: 4, borderRadius: 10 }}>
          <button onClick={() => setView('All')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: view === 'All' ? 'var(--card)' : 'transparent', color: view === 'All' ? 'var(--text)' : 'var(--text-3)', fontWeight: view === 'All' ? 700 : 500, cursor: 'pointer', boxShadow: view === 'All' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>Active & Suspended</button>
          <button onClick={() => setView('Pending')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: view === 'Pending' ? 'var(--card)' : 'transparent', color: view === 'Pending' ? 'var(--text)' : 'var(--text-3)', fontWeight: view === 'Pending' ? 700 : 500, cursor: 'pointer', boxShadow: view === 'Pending' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>
            Pending Requests {pendingRequests.length > 0 && <span style={{ background: 'var(--red)', color: '#fff', padding: '2px 7px', borderRadius: 10, fontSize: 11, marginLeft: 6, fontWeight: 800 }}>{pendingRequests.length}</span>}
          </button>
        </div>
      </div>

      {/* Super Admin Cards */}
      {displayedAdmins.length === 0
        ? <EmptyState
          icon={<svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" /></svg>}
          title={view === 'Pending' ? "No pending requests" : "No Super Admins found"}
          sub={view === 'Pending' ? "There are no pending accounts awaiting activation." : "Super Admins will appear here once branches are created with admin accounts."}
        />
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
            {displayedAdmins.map(u => {
              const branch = getBranch(u);
              const isPendingUpgrade = u.trackingId && u.trackingId.startsWith('UPGRADE-');
              const isActive = u.status === 'Active' || isPendingUpgrade;
              const isPending = u.status === 'Pending' || isPendingUpgrade;
              let isExpired = false;
              if (branch?.expiry_date) {
                isExpired = new Date(branch.expiry_date) < new Date();
              }
              return (
                <Card key={u.id} style={{ borderLeft: `4px solid ${isActive ? (isExpired ? 'var(--amber)' : 'var(--green)') : 'var(--red)'}`, opacity: isActive ? 1 : 0.75 }}>
                  {/* User Header */}
                  <div onClick={() => setExpandedId(expandedId === u.id ? null : u.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, cursor: 'pointer' }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: '50%',
                      background: isActive
                        ? 'linear-gradient(135deg, var(--accent), var(--accent-2))'
                        : 'linear-gradient(135deg, var(--text-3), #888)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: 15, color: '#fff', flexShrink: 0,
                    }}>
                      {u.avatar || u.name?.slice(0, 2).toUpperCase() || '??'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 1 }}>@{u.username}</div>
                      {u.phone && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}> <img src={mobileIcon} alt="" style={{ width: 14, height: 14 }} /> {u.phone}</div>}
                    </div>
                    <Chip color={isActive && !isPendingUpgrade ? 'var(--green)' : (isPending ? 'var(--amber)' : 'var(--red)')}>{isPendingUpgrade ? 'Upgrade Pending' : (u.status || 'Active')}</Chip>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', transform: expandedId === u.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>▾</span>
                  </div>

                  {/* Branch & Plan Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    <div style={{
                      background: branch ? 'var(--accent-dim)' : 'var(--bg-3)',
                      border: branch ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
                      borderRadius: 8, padding: '7px 10px', fontSize: 12,
                      display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {branch && <img src={BranchIcon} alt="" style={{ width: 14, height: 14, flexShrink: 0 }} />}
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {branch ? (
                            <>
                              <span style={{ color: 'var(--text-3)' }}>Branch: </span>
                              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{branch.name}</span>
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-3)' }}>No branch assigned</span>
                          )}
                        </div>
                      </div>
                      {(branch?.company_reg_no || u.company_reg_no) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: 'var(--text-3)', fontSize: 11 }}>SSM No: </span>
                          <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 12 }}>{branch?.company_reg_no || u.company_reg_no}</span>
                        </div>
                      )}
                    </div>

                    <div style={{
                      background: 'var(--bg-3)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '7px 10px', fontSize: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <span style={{ color: 'var(--text-3)' }}>Plan: </span>
                        <span style={{ fontWeight: 700, color: isExpired ? 'var(--red)' : 'var(--text)' }}>
                          {PLAN_MAP[branch?.subscription || u.subscription]?.label || 'No Plan'}
                        </span>
                      </div>
                      {isExpired && (
                        <div style={{ background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>
                          Expired
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expandable detail — shown when the card header is clicked */}
                  {expandedId === u.id && (
                    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', marginBottom: 12 }}>
                      {[
                        ['Email', u.email || '—'],
                        ['Username', '@' + (u.username || '—')],
                        ['Phone', u.phone || '—'],
                        ['Branch', branch?.name || '—'],
                        ['SSM No', branch?.company_reg_no || '—'],
                        ['Plan', (PLAN_MAP[branch?.subscription]?.label) || branch?.subscription || '—'],
                        ['Expiry', branch?.expiry_date ? new Date(branch.expiry_date).toLocaleDateString() : '—'],
                        ['Status', isExpired ? 'Expired' : (u.status || 'Active')],
                      ].map(([label, value]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: (label === 'Expiry' || label === 'Status') && isExpired ? 'var(--red)' : 'var(--text)', textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
                        </div>
                      ))}
                      {u.trackingId && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Tracking ID</span>
                          <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)' }}>{u.trackingId}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Info for Pending */}
                  {isPending && u.paymentInfo && (
                    <div style={{ background: 'var(--card-hover)', border: '1px solid var(--amber)', borderRadius: 10, padding: '12px', marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                        {isPendingUpgrade ? `Upgrade Details: ${PLAN_MAP[u.paymentInfo.pendingPlanId]?.label} (${u.paymentInfo.billing_cycle || 'monthly'})` : 'Payment Details'}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                        <div><span style={{ color: 'var(--text-3)' }}>TRX ID:</span> <br /><strong style={{ color: 'var(--text)' }}>{u.paymentInfo.transactionId}</strong></div>
                        <div><span style={{ color: 'var(--text-3)' }}>Account Name:</span> <br /><strong style={{ color: 'var(--text)' }}>{u.paymentInfo.accountName}</strong></div>
                        <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-3)' }}>Payment Date:</span> <strong style={{ color: 'var(--text)' }}>{u.paymentInfo.paymentDate}</strong></div>
                        {u.trackingId && <div style={{ gridColumn: '1 / -1', marginTop: 4 }}><span style={{ color: 'var(--text-3)' }}>Tracking ID:</span> <span style={{ fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 700 }}>{u.trackingId}</span></div>}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {isPending && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn variant="ghost" size="sm" style={{ flex: 1, padding: '6px', border: '1px solid var(--accent)', color: 'var(--accent)' }} onClick={() => window.open('https://www.ssm.com.my/Pages/e-Search.aspx', '_blank')}>
                          SSM Verification
                        </Btn>
                        {(branch?.company_reg_no || u.company_reg_no) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(branch?.company_reg_no || u.company_reg_no);
                              notify('Copied SSM Registration Number!', 'success');
                            }}
                            title="Copy SSM Number"
                            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 8, padding: '0 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', transition: 'all 0.2s' }}
                            onMouseOver={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--accent)'; }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {!isPending && (
                        <Btn variant="ghost" size="sm" style={{ flex: 1, padding: '6px' }} onClick={() => {
                          const userBranch = (branches || []).find(b => b.id === (u.branch_id || u.branchId));
                          setEditing({ ...u, _newPwd: '', expiry_date: userBranch?.expiry_date ? userBranch.expiry_date.substring(0, 10) : '' });
                        }}>
                          <img src={EditIcon} alt="Edit" style={{ width: 16, height: 16, marginRight: 6, verticalAlign: 'middle' }} />
                          Edit
                        </Btn>
                      )}
                      <Btn
                        variant={isActive && !isPendingUpgrade ? 'danger' : 'success'}
                        size="sm"
                        style={{ flex: 1.2, padding: '6px' }}
                        onClick={() => handleToggle(u.id)}
                      >
                        <img
                          src={isActive && !isPendingUpgrade ? SuspendIcon : ActiveIcon}
                          alt={isActive && !isPendingUpgrade ? 'Deactivate' : (isPendingUpgrade ? 'Approve Upgrade' : 'Activate')}
                          style={{ width: 16, height: 16, marginRight: 6, verticalAlign: 'middle' }}
                        />
                        {isActive && !isPendingUpgrade ? 'Deactivate' : (isPendingUpgrade ? 'Approve Upgrade' : 'Activate')}
                      </Btn>
                      <Btn variant="danger" size="sm" style={{ flex: 1, padding: '6px' }} onClick={() => handleDelete(u.id)}>
                        <img src={DeleteIcon} alt="Delete" style={{ width: 16, height: 16, marginRight: 6, verticalAlign: 'middle' }} />
                        {isPending ? 'Reject' : 'Delete'}
                      </Btn>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      }

      {/* Edit Modal */}
      <Modal title={`Edit — ${editing?.name}`} open={!!editing} onClose={() => setEditing(null)}>
        {editing && <>
          <Inp label="Full Name" value={editing.name || ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} />
          <Inp label="Email" type="email" value={editing.email || ''} onChange={e => setEditing(p => ({ ...p, email: e.target.value }))} />
          <PhoneInp label="Phone" value={editing.phone || ''} onChange={e => { const val = e.target.value; setEditing(p => ({ ...p, phone: val })); }} />
          <Dropdown label="Branch" value={editing.branch_id || editing.branchId || ''} onChange={v => setEditing(p => ({ ...p, branch_id: v, branchId: v }))} options={[{ value: '', label: '— No Branch —' }, ...(branches || []).map(b => ({ value: b.id, label: b.name }))]} />
          {(editing.branch_id || editing.branchId) && (
            <Inp label="Subscription Expiry Date" type="date" value={editing.expiry_date || ''} onChange={e => setEditing(p => ({ ...p, expiry_date: e.target.value }))} />
          )}
          <Inp label="New Password (leave blank to keep)" type="password" value={editing._newPwd || ''} onChange={e => setEditing(p => ({ ...p, _newPwd: e.target.value }))} />
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <Btn full onClick={handleUpdate}>
              <img src={SaveIcon} alt="" style={{ width: 14, height: 14, marginRight: 6, verticalAlign: 'middle' }} />
              Save Changes
            </Btn>
            <Btn full variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
          </div>
        </>}
      </Modal>

      {/* Subscription Modal */}
      <Modal title={`Subscription — ${showSub?.name}`} open={!!showSub} onClose={() => setShowSub(null)} maxWidth={480}>
        {showSub && <>
          <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13 }}>
            Current: <b style={{ color: 'var(--text)' }}>{PLAN_MAP[getBranch(showSub)?.subscription || showSub.subscription]?.label || 'No Plan'}</b>
          </div>
          {(subscriptionPlans || []).map(plan => {
            const activePlan = getBranch(showSub)?.subscription || showSub.subscription;
            const isCurrent = activePlan === plan.id;
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
                  : <Btn full variant="outline" size="sm" onClick={() => handleUpgradePlan(showSub.id, plan.id)}>{plan.id === 'trial' ? 'Downgrade' : 'Upgrade'} to {plan.label}</Btn>
                }
              </div>
            );
          })}
          <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 9, fontSize: 12, color: 'var(--text-3)' }}>
            Updating this plan will affect the subscription of this Super Admin user.
          </div>
        </>}
      </Modal>
    </>
  );
};
