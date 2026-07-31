// ═══════════════════════════════════════════════════════════
// WASHERS PAGE
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getCurrency } from '../../utils/messaging';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Card, StatCard, Chip, Btn, Inp, PhoneInp, Sel, Dropdown, Modal, EmptyState, BackButton } from '../../components/common/UI';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ROLES } from '../../utils/defaults';
import { BarcodeScanner } from '../../components/common/BarcodeScanner';
import WorkerIcon from '../../assets/icons/worker-icon.png';
import ActiveIcon from '../../assets/icons/active-icon.png';
import SuspendIcon from '../../assets/icons/suspend-icon.png';
import BranchIcon from '../../assets/icons/branch-icon.png';
import EditIcon from '../../assets/icons/edit-icon.png';
import DeleteIcon from '../../assets/icons/delete-icon.png';
import JobIcon from '../../assets/icons/job-icon.png';
import RevenueIcon from '../../assets/icons/revenue-icon-vec.png';
import CarIcon from '../../assets/icons/car-icon.png';
import ReceiptIcon from '../../assets/icons/receipt-icon.png';
import ChartIcon from '../../assets/icons/bar-chart-icon.png';
import SoapIcon from '../../assets/icons/soap-icon.png';
import DownloadIcon from '../../assets/icons/download-icon.png';
import SaveIcon from '../../assets/icons/save-icon.png';
import EligibleIcon from '../../assets/icons/eligible-icon.png';
import RedeemIcon from '../../assets/icons/redeem-icon.png';
import GroupIcon from '../../assets/icons/group-icon.png';
import { API, BASE_URL } from '../../utils/api';
import CartIcon from '../../assets/icons/cart-icon.png';
import AlertIcon from '../../assets/icons/low-stack-alert-icon.png';
import MapIcon from '../../assets/icons/map-icon.png';
import BarcodeScannerIcon from '../../assets/icons/barcode-scanner-icon.png';
import BoxIcon from '../../assets/icons/circle-icon.png';
import SearchIcon from '../../assets/icons/search-icon.png';
import calenderIcon from '../../assets/icons/calendar-icon.png';

export const Washers = ({ users, sessions, branches, createUser, updateUser, deleteUser, notify, userRole, currentUser, branchSubscription, onNav }) => {
  const curr = getCurrency(currentUser?.phone);

  const isSupremeAdmin = userRole === 'SupremeAdmin';
  const isSuperAdmin = userRole === 'SuperAdmin';
  const isBranchAdmin = userRole === 'Admin';

  // SuperAdmin and BranchAdmin sees only their own washers
  const branchId = currentUser?.branch_id || currentUser?.branchId;
  const visibleWashers = users.filter(u => {
    if (isSupremeAdmin) return u.role !== 'SupremeAdmin';
    if (u.role !== 'Washer') return false;

    // For SuperAdmin, show washers from ANY of their owned branches
    // (the backend already filters 'users' to only owned branches for SuperAdmin)
    if (isSuperAdmin) return true;

    // For BranchAdmin, ensure branch matches
    return String(u.branch_id || u.branchId) === String(branchId);
  });

  const washerCount = isSupremeAdmin ? users.filter(u => u.role === 'Washer').length : visibleWashers.length;

  let canAddWasher = true;
  let addWasherMsg = '';

  if (branchSubscription?.max_washers !== undefined && branchSubscription?.max_washers !== null && branchSubscription.max_washers > 0) {
    if (washerCount >= branchSubscription.max_washers) {
      canAddWasher = false;
      addWasherMsg = `Your plan is limited to ${branchSubscription.max_washers} washers. Upgrade to add more.`;
    }
  }
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [newW, setNewW] = useState({ username: '', password: '', name: '', phone: '', role: 'Washer', branchId: '' });
  const ROLE_OPTIONS = isSupremeAdmin
    ? [{ value: 'Washer', label: 'Washer' }, { value: 'SuperAdmin', label: 'Super Admin' }, { value: 'Admin', label: 'Branch Admin' }]
    : [{ value: 'Washer', label: 'Washer' }];
  const set = (k, v) => setNewW(f => ({ ...f, [k]: v }));

  const washers = visibleWashers;
  const branchAdmins = users.filter(u => u.role === 'SuperAdmin' || u.role === 'Admin');
  const washerStats = {};
  sessions.forEach(s => {
    if (!washerStats[s.washer]) washerStats[s.washer] = { sessions: 0, revenue: 0 };
    washerStats[s.washer].sessions++;
    washerStats[s.washer].revenue += s.total || 0;
  });

  const handleAdd = async () => {
    if (!newW.username || !newW.password || !newW.name) { notify('Fill in all required fields', 'error'); return; }
    if (users.find(u => u.username === newW.username)) { notify('Username already exists!', 'error'); return; }
    try {
      if (newW.role === 'SuperAdmin' && !newW.branchId) { notify('Branch is required for Branch Admin', 'error'); return; }
      await createUser({ username: newW.username, password: newW.password, role: newW.role, name: newW.name, phone: newW.phone, branch_id: newW.branchId });
      setNewW({ username: '', password: '', name: '', phone: '', role: 'Washer', branchId: '' });
      setShowAdd(false);
      notify(`${newW.name} added!`);
    } catch (err) { notify(err.message || 'Failed to add washer', 'error'); }
  };

  const handleUpdate = async () => {
    try {
      const payload = { name: editing.name, username: editing.username, phone: editing.phone, branch_id: editing.branchId };
      if (editing._newPwd) payload.password = editing._newPwd;
      await updateUser(editing.id, payload);
      setEditing(null);
      notify('Washer updated!');
    } catch (err) { notify(err.message || 'Failed to update', 'error'); }
  };

  const handleToggle = async (id) => {
    const u = users.find(u => u.id === id);
    try {
      await updateUser(id, { status: u.status === 'Active' ? 'Suspended' : 'Active' });
      notify(`${u.status === 'Active' ? 'Suspended' : 'Reactivated'}: ${u.name}`);
    } catch (err) { notify(err.message || 'Failed to update status', 'error'); }
  };

  const handleDelete = async (id) => {
    const u = users.find(u => u.id === id);
    if (u.role === 'SupremeAdmin') { notify('Cannot delete Supreme Admin', 'error'); return; }
    try {
      await deleteUser(id);
      notify(`Removed: ${u.name}`);
    } catch (err) { notify(err.message || 'Failed to delete', 'error'); }
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard icon={<img src={WorkerIcon} alt="Worker" style={{ width: 24, height: 24 }} />} label="Total Staff" value={washers.length} color="var(--accent)" />
        <StatCard icon={<img src={ActiveIcon} alt="Active" style={{ width: 24, height: 24 }} />} label="Active" value={washers.filter(w => w.status === 'Active').length} sub="operational" color="var(--green)" />
        <StatCard icon={<img src={SuspendIcon} alt="Suspended" style={{ width: 24, height: 24 }} />} label="Suspended" value={washers.filter(w => w.status === 'Suspended').length} sub="" color="var(--red)" />
        <StatCard icon={<img src={JobIcon} alt="Total Jobs" style={{ width: 24, height: 24 }} />} label="Total Jobs" value={sessions.length} sub="across all staff" color="var(--accent-2)" />
        <StatCard icon={<img src={BranchIcon} alt="Branch" style={{ width: 24, height: 24 }} />} label="Branch Admins" value={branchAdmins.length} sub="branch managers" color="var(--amber)" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16 }}>
        {!canAddWasher && (
          <div style={{ color: 'var(--amber)', fontSize: 13, fontWeight: 700, marginRight: 16, background: 'var(--amber)22', padding: '6px 12px', borderRadius: 8 }}>
            {addWasherMsg}
          </div>
        )}
        <Btn onClick={() => {
          setNewW(prev => ({ ...prev, role: 'Washer', branchId: branches.length === 1 ? branches[0].id : '' }));
          setShowAdd(true);
        }} disabled={!canAddWasher}>+ Add Washer</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
        {washers.map(w => {
          const ws = washerStats[w.name] || { sessions: 0, revenue: 0 };
          const br = branches.find(b => String(b.id) === String(w.branchId || w.branch_id));
          return (
            <Card key={w.id} style={{ borderLeft: `4px solid ${w.status === 'Active' ? 'var(--green)' : 'var(--red)'}`, opacity: w.status === 'Suspended' ? 0.72 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, color: '#fff', flexShrink: 0 }}>{w.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{w.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 1 }}>{w.role} · @{w.username}</div>
                  {br && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 1 }}><img src={BranchIcon} alt="Branch" style={{ width: 16, height: 16 }} />{br.name.split('–')[0].trim()}</div>}
                </div>
                <Chip color={w.is_locked ? 'var(--red)' : (w.status === 'Active' ? 'var(--green)' : 'var(--red)')}>{w.is_locked ? 'Locked' : w.status}</Chip>
              </div>

              <div className="responsive-split-3" style={{ gap: 8, marginBottom: 14 }}>
                {[['Sessions', ws.sessions, 'var(--accent)'], ['Revenue', `${curr} ${(ws.revenue || 0).toFixed(2)}`, 'var(--green)'], ['Joined', w.joined, 'var(--text-2)']].map(([l, v, c]) => (
                  <div key={l} style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '9px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>{l}</div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: c }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="ghost" size="sm" style={{ flex: 1 }} onClick={() => setEditing({ ...w })} disabled={w.is_locked}>
                  <img
                    src={EditIcon}
                    alt="Edit"
                    style={{
                      width: 16,
                      height: 16,
                      marginRight: 6,
                      verticalAlign: 'middle',
                      opacity: w.is_locked ? 0.4 : 1
                    }}
                  />
                  Edit
                </Btn>
                <Btn variant={w.status === 'Active' ? 'danger' : 'ghost'} size="sm" style={{ flex: 1 }} onClick={() => handleToggle(w.id)} disabled={w.is_locked}>
                  <img
                    src={w.status === 'Active' ? SuspendIcon : ActiveIcon}
                    alt={w.status === 'Active' ? 'Suspend' : 'Reactivate'}
                    style={{
                      width: 16,
                      height: 16,
                      marginRight: 6,
                      verticalAlign: 'middle',
                      opacity: w.is_locked ? 0.4 : 1
                    }}
                  />
                  {w.status === 'Active' ? 'Suspend' : 'Reactivate'}
                </Btn>
                <Btn variant="danger" size="sm" onClick={() => handleDelete(w.id)}>
                  <img
                    src={DeleteIcon}
                    alt="Delete"
                    style={{
                      width: 16,
                      height: 16,
                      marginRight: 6,
                      verticalAlign: 'middle'
                    }}
                  />
                  Delete
                </Btn>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add */}
      <Modal title="➕ Add Washer" open={showAdd} onClose={() => setShowAdd(false)}>
        <Inp label="Full Name *" value={newW.name} onChange={e => set('name', e.target.value)} placeholder="Full name" />
        <Inp label="Username *" value={newW.username} onChange={e => set('username', e.target.value)} placeholder="Login username" />
        <Inp label="Password *" type="password" value={newW.password} onChange={e => set('password', e.target.value)} placeholder="Password" />
        <PhoneInp label="Phone" value={newW.phone} onChange={e => { const val = e.target.value; set('phone', val); }} placeholder="e.g. 012-3456789" />
        {isSupremeAdmin && <Dropdown label="Role" value={newW.role} onChange={v => set('role', v)} options={ROLE_OPTIONS} />}
        {branches.length === 1 ? (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 5 }}>Branch</label>
            <div style={{ background: 'var(--bg-3)', padding: '10px 14px', borderRadius: 10, fontSize: 13, color: 'var(--text)', border: '1px solid var(--border)', fontWeight: 600 }}>
              {branches[0].name}
            </div>
          </div>
        ) : (
          <Dropdown label="Branch" value={newW.branchId} onChange={v => set('branchId', v)} options={[{ value: '', label: '— Select Branch —' }, ...branches.map(b => ({ value: b.id, label: b.name }))]} />
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Btn full onClick={handleAdd}>Save Washer</Btn>
          <Btn full variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Edit */}
      <Modal title={` Edit — ${editing?.name}`} open={!!editing} onClose={() => setEditing(null)}>
        {editing && <>
          <Inp label="Full Name" value={editing.name || ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} />
          <Inp label="Username" value={editing.username || ''} onChange={e => setEditing(p => ({ ...p, username: e.target.value }))} />
          <PhoneInp label="Phone" value={editing.phone || ''} onChange={e => { const val = e.target.value; setEditing(p => ({ ...p, phone: val })); }} />
          <Inp label="New Password (leave blank to keep)" type="password" value={editing._newPwd || ''} onChange={e => setEditing(p => ({ ...p, _newPwd: e.target.value }))} />
          {branches.length === 1 ? (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 5 }}>Branch</label>
              <div style={{ background: 'var(--bg-3)', padding: '10px 14px', borderRadius: 10, fontSize: 13, color: 'var(--text)', border: '1px solid var(--border)', fontWeight: 600 }}>
                {branches[0].name}
              </div>
            </div>
          ) : (
            <Dropdown label="Branch" value={editing.branchId || ''} onChange={v => setEditing(p => ({ ...p, branchId: v }))} options={[{ value: '', label: '— No Branch —' }, ...branches.map(b => ({ value: b.id, label: b.name }))]} />
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <Btn full onClick={handleUpdate}>Save Changes</Btn>
            <Btn full variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
          </div>
        </>}
      </Modal>
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// CREDENTIALS PAGE
// ═══════════════════════════════════════════════════════════
export const Credentials = ({ users, sessions = [], updateUser, deleteUser, notify, userRole, currentUser, onNav }) => {
  const curr = (typeof currentUser !== 'undefined' && currentUser) ? getCurrency(currentUser?.phone) : 'RM';

  const isSupremeAdmin = userRole === 'SupremeAdmin';
  const isSuperAdmin = userRole === 'SuperAdmin';
  const isBranchAdmin = userRole === 'Admin';

  const visibleUsers = users.filter(u => {
    if (isSupremeAdmin) return u.role === 'Admin' || u.role === 'SuperAdmin' || u.role === 'IndividualUser';
    if (isSuperAdmin || isBranchAdmin) {
      if (u.role === 'Admin' && isSuperAdmin) return true;
      if (u.role === 'IndividualUser') {
        return sessions.some(s => s.customer?.phone === u.phone || s.customer?.id === u.id);
      }
      return false;
    }
    return false;
  });
  const [editing, setEditing] = useState(null);

  const handleUpdate = async () => {
    try {
      const payload = { name: editing.name, username: editing.username, phone: editing.phone };
      if (editing._newPwd) payload.password = editing._newPwd;
      await updateUser(editing.id, payload);
      setEditing(null);
      notify('Credentials updated!');
    } catch (err) { notify(err.message || 'Failed to update', 'error'); }
  };

  const handleDelete = async (id) => {
    const u = visibleUsers.find(u => u.id === id);
    if (!u) return;
    if (u.role === 'SupremeAdmin') { notify('Cannot delete Supreme Admin', 'error'); return; }
    try { await deleteUser(id); notify(`Removed: ${u.name}`); } catch (err) { notify(err.message || 'Failed', 'error'); }
  };

  const handleToggle = async (id) => {
    const u = visibleUsers.find(u => u.id === id);
    try {
      await updateUser(id, { status: u.status === 'Active' ? 'Suspended' : 'Active' });
      notify(`${u.status === 'Active' ? 'Suspended' : 'Activated'}: ${u.name}`);
    } catch (err) { notify(err.message || 'Failed to update status', 'error'); }
  };

  return (
    <>
      <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 14, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src={AlertIcon} alt="" style={{ width: 18, height: 18 }} />
        {isSupremeAdmin ? 'Changes are saved persistently. Super Admins must re-login to use new credentials.' : 'Changes are saved persistently. Washers must re-login to use new credentials.'}
      </div>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div className="table-responsive-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--bg-3)' }}>
              {['Name', 'Username', 'Role', 'Branch', 'Phone', 'Status', 'Password', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {visibleUsers.map(u => (
                <tr key={u.id} style={{ transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{u.name}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)' }}>{u.username}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}><Chip color={u.role === 'Admin' ? 'var(--amber)' : u.role === 'IndividualUser' ? 'var(--blue)' : 'var(--accent)'}>{u.role === 'IndividualUser' ? 'Customer' : u.role}</Chip></td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-2)' }}>{u.branchId || '—'}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-2)' }}>{u.phone || '—'}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}><Chip color={u.status === 'Active' ? 'var(--green)' : 'var(--red)'}>{u.status}</Chip></td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'monospace', color: 'var(--text)', fontSize: 13 }}>{u.password || '••••••••'}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn variant="ghost" size="sm" onClick={() => setEditing({ ...u })}><img src={EditIcon} alt="" style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} />Edit</Btn>
                      {u.role !== 'SupremeAdmin' && <Btn variant={u.status === 'Active' ? 'danger' : 'ghost'} size="sm" onClick={() => handleToggle(u.id)}>{u.status === 'Active' ? 'Suspend' : 'Activate'}</Btn>}
                      {u.role !== 'SupremeAdmin' && <Btn variant="danger" size="sm" onClick={() => handleDelete(u.id)}>✕</Btn>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal title={` Edit — ${editing?.name}`} open={!!editing} onClose={() => setEditing(null)}>
        {editing && <>
          <Inp label="Full Name" value={editing.name || ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} />
          <Inp label="Username" value={editing.username || ''} onChange={e => setEditing(p => ({ ...p, username: e.target.value }))} />
          <PhoneInp label="Phone" value={editing.phone || ''} onChange={e => { const val = e.target.value; setEditing(p => ({ ...p, phone: val })); }} />
          <Inp label="New Password (blank = keep current)" type="password" value={editing._newPwd || ''} onChange={e => setEditing(p => ({ ...p, _newPwd: e.target.value }))} />
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <Btn full onClick={handleUpdate}><img src={SaveIcon} alt="" style={{ width: 14, height: 14, marginRight: 6, verticalAlign: 'middle' }} />Save</Btn>
            <Btn full variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
          </div>
        </>}
      </Modal>
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// PACKAGES PAGE
// ═══════════════════════════════════════════════════════════
export const Packages = ({ packages, branches, sessions, inventory, createPackage, updatePackage, deletePackage, notify, onNav, branchSubscription, currentUser }) => {
  const curr = getCurrency(currentUser?.phone);

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [newP, setNewP] = useState({ name: '', desc: '', price: '', time: '', color: '#22d3ee', products: [], branch_id: currentUser?.branch_id || '' });
  const [scannerTarget, setScannerTarget] = useState(null); // 'new' | 'edit' | null
  const setN = (k, v) => setNewP(p => ({ ...p, [k]: v }));

  const handleEditClick = (pkg) => {
    let prods = [];
    if (pkg.products) {
      try {
        prods = JSON.parse(pkg.products);
      } catch (e) {
        console.error("Failed to parse package products", e);
      }
    }
    setEditing({ ...pkg, products: prods });
  };

  const handleAddOpen = () => {
    setNewP({ name: '', desc: '', price: '', time: '', color: '#22d3ee', products: [], branch_id: currentUser?.branch_id || '' });
    setShowAdd(true);
  };

  const handleAdd = async () => {
    if (!newP.name || !newP.price) { notify('Name and price are required', 'error'); return; }
    try {
      await createPackage({
        name: newP.name,
        desc: newP.desc,
        price: Number(newP.price),
        time: newP.time,
        color: newP.color,
        products: JSON.stringify(newP.products || []),
        branch_id: newP.branch_id || ''
      });
      setNewP({ name: '', desc: '', price: '', time: '', color: '#22d3ee', products: [] });
      setShowAdd(false);
      notify('Package added!');
    } catch (err) { notify(err.message || 'Failed to add package', 'error'); }
  };

  const handleUpdate = async () => {
    if (!editing.name || !editing.price) { notify('Name and price are required', 'error'); return; }
    try {
      await updatePackage(editing.id, {
        name: editing.name,
        desc: editing.desc,
        price: Number(editing.price),
        time: editing.time,
        color: editing.color,
        products: JSON.stringify(editing.products || []),
        branch_id: editing.branch_id || ''
      });
      setEditing(null);
      notify(' Package updated!');
    } catch (err) { notify(err.message || 'Failed to update package', 'error'); }
  };

  const handleDelete = async (id) => {
    try {
      await deletePackage(id);
      notify(' Package removed!');
    } catch (err) { notify(err.message || 'Failed to delete package', 'error'); }
  };

  // --- Sub-form Handlers ---
  const handleSelectProduct = (val, target) => {
    if (!val) return;
    const item = (inventory || []).find(i => i.id === val);
    if (!item) return;

    const state = target === 'new' ? newP : editing;
    const exists = (state.products || []).find(p => p.id === item.id);
    if (exists) {
      notify(`${item.name} is already attached.`, 'warn');
      return;
    }

    const updatedProds = [...(state.products || []), {
      id: item.id,
      name: item.name,
      quantity: 1,
      price: item.price || item.cost || 0,
      isCustom: false
    }];

    if (target === 'new') {
      setNewP(prev => ({ ...prev, products: updatedProds }));
    } else {
      setEditing(prev => ({ ...prev, products: updatedProds }));
    }
    notify(`✓ Attached ${item.name}!`);
  };

  const addPlaceholder = (target) => {
    const state = target === 'new' ? newP : editing;
    const updatedProds = [...(state.products || []), {
      id: 'custom_' + Date.now() + Math.random().toString(36).slice(2, 6),
      name: '',
      quantity: 1,
      price: 0,
      isCustom: true
    }];

    if (target === 'new') {
      setNewP(prev => ({ ...prev, products: updatedProds }));
    } else {
      setEditing(prev => ({ ...prev, products: updatedProds }));
    }
  };

  const updateProduct = (index, field, value, target) => {
    const state = target === 'new' ? newP : editing;
    const updated = [...(state.products || [])];
    updated[index] = { ...updated[index], [field]: value };

    if (target === 'new') {
      setNewP(prev => ({ ...prev, products: updated }));
    } else {
      setEditing(prev => ({ ...prev, products: updated }));
    }
  };

  const deleteProduct = (index, target) => {
    const state = target === 'new' ? newP : editing;
    const updated = (state.products || []).filter((_, i) => i !== index);

    if (target === 'new') {
      setNewP(prev => ({ ...prev, products: updated }));
    } else {
      setEditing(prev => ({ ...prev, products: updated }));
    }
  };

  const handleBarcodeConfirm = (code) => {
    if (!code) return;
    const item = (inventory || []).find(i => (i.barcode && String(i.barcode) === code) || String(i.id) === code);
    if (!item) {
      notify(`Product not found in inventory for barcode: ${code}. Try adding it as a placeholder.`, 'error');
      setScannerTarget(null);
      return;
    }

    const state = scannerTarget === 'new' ? newP : editing;
    const exists = (state.products || []).find(p => p.id === item.id);
    if (exists) {
      notify(`${item.name} is already attached.`, 'warn');
      setScannerTarget(null);
      return;
    }

    const updatedProds = [...(state.products || []), {
      id: item.id,
      name: item.name,
      quantity: 1,
      price: item.price || item.cost || 0,
      isCustom: false
    }];

    if (scannerTarget === 'new') {
      setNewP(prev => ({ ...prev, products: updatedProds }));
    } else {
      setEditing(prev => ({ ...prev, products: updatedProds }));
    }

    setScannerTarget(null);
    notify(`✓ Scanned & Attached: ${item.name}!`);
  };

  // --- Sub-form Render Helper ---
  const customInputStyle = {
    background: 'var(--bg-3)',
    border: '1.5px solid var(--border)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  };

  const renderProductsSubform = (state, target) => {
    const prods = state.products || [];
    return (
      <div style={{ marginTop: 22, marginBottom: 16, borderTop: '1px dashed var(--border)', paddingTop: 18 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.06em' }}>
          Products Consumed / Attached Products
        </label>

        {prods.length === 0 ? (
          <div style={{ padding: '16px', background: 'var(--bg-3)', borderRadius: 12, border: '1.5px dashed var(--border)', color: 'var(--text-3)', fontSize: 12, textAlign: 'center', marginBottom: 14 }}>
            No products attached yet. Scan, choose from dropdown, or add placeholder.
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr auto', gap: 8, marginBottom: 6, padding: '0 4px' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>Product Name</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>Clicks Count</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>Price ({curr})</span>
              <span style={{ width: 28 }}></span>
            </div>
            {prods.map((item, index) => (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                {item.isCustom ? (
                  <input
                    type="text"
                    placeholder="Custom item name..."
                    value={item.name}
                    onChange={e => updateProduct(index, 'name', e.target.value, target)}
                    style={customInputStyle}
                  />
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, border: '1.5px solid var(--border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }} title={item.name}>
                    <img src={BoxIcon} alt="" style={{ width: 14, height: 14 }} /> {item.name}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    placeholder="Clicks"
                    value={item.quantity}
                    onChange={e => updateProduct(index, 'quantity', Number(e.target.value), target)}
                    style={customInputStyle}
                  />
                  {!item.isCustom && (() => {
                    const invItem = inventory?.find(i => String(i.id) === String(item.id));
                    const wpu = invItem?.washes_per_unit || 1;
                    return (
                      <div style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 600, lineHeight: 1.1 }}>
                        ~ reduce 1 stock
                      </div>
                    );
                  })()}
                </div>

                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Price"
                  value={item.price}
                  onChange={e => updateProduct(index, 'price', Number(e.target.value), target)}
                  style={customInputStyle}
                />

                <Btn variant="danger" size="sm" onClick={() => deleteProduct(index, target)} style={{ padding: '8px 10px', height: '100%', minWidth: 32 }}>✕</Btn>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Dropdown
            onChange={(v) => handleSelectProduct(v, target)}
            value=""
            options={[
              { value: "", label: "— Attach Product —" },
              ...(inventory || []).map(i => ({ value: i.id, label: `${i.name} (Stock: ${i.quantity} · ${curr} ${i.price || i.cost})` }))
            ]}
            style={{ flex: 1, minWidth: 160 }}
          />

          {branchSubscription?.has_ai_scanning !== false && (
            <Btn variant="ghost" size="sm" onClick={() => setScannerTarget(target)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}>
              <img src={BarcodeScannerIcon} alt="" style={{ width: 14, height: 14 }} /> Scan Barcode
            </Btn>
          )}

          <Btn variant="ghost" size="sm" onClick={() => addPlaceholder(target)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}>
            + Add Placeholder
          </Btn>
        </div>
      </div>
    );
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>{packages.length} packages — changes reflect immediately in Washer App</p>
        <Btn onClick={handleAddOpen}>+ Add Package</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
        {packages.map(pkg => {
          const count = sessions.filter(s => s.package?.id === pkg.id).length;
          const rev = sessions.filter(s => s.package?.id === pkg.id).reduce((a, s) => a + (s.total || 0), 0);

          let attachedCount = 0;
          if (pkg.products) {
            try {
              const list = JSON.parse(pkg.products);
              if (Array.isArray(list)) attachedCount = list.length;
            } catch (e) { }
          }

          return (
            <Card key={pkg.id} accent={pkg.color}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{pkg.name}</div>
                <div style={{ fontWeight: 900, fontSize: 20, color: pkg.color }}>{curr} {pkg.price}</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>{pkg.desc}</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={{ background: `${pkg.color}15`, color: pkg.color, borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 600, border: `1px solid ${pkg.color}30` }}>⏱ {pkg.time}</span>
                <span style={{ background: 'var(--bg-3)', color: 'var(--text-2)', borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 600 }}>{count} uses · {curr} {rev.toFixed(2)}</span>
                {attachedCount > 0 && (
                  <span style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent)', borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 600, border: '1px solid rgba(59,130,246,0.2)' }}>
                    {attachedCount} products
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="ghost" size="sm" style={{ flex: 1 }} onClick={() => handleEditClick(pkg)}><img src={EditIcon} alt="" style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} />Edit</Btn>
                <Btn variant="danger" size="sm" onClick={() => handleDelete(pkg.id)}><img src={DeleteIcon} alt="" style={{ width: 14, height: 14 }} /></Btn>
              </div>
            </Card>
          );
        })}
      </div>

      {/* New Package */}
      <Modal title="➕ New Package" open={showAdd} onClose={() => setShowAdd(false)}>
        <Inp label="Package Name *" value={newP.name} onChange={e => setN('name', e.target.value)} placeholder="e.g. Foam Wash" />
        <Inp label="Description" value={newP.desc} onChange={e => setN('desc', e.target.value)} placeholder="Short description" />
        <Inp label="Price ({curr}) *" value={newP.price} onChange={e => setN('price', e.target.value)} type="number" placeholder="0" />
        <Inp label="Duration" value={newP.time} onChange={e => setN('time', e.target.value)} placeholder="e.g. 30 min" />

        <div style={{ marginBottom: 12 }}>
          <label htmlFor="pkg-color" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 5 }}>COLOUR</label>
          <input id="pkg-color" name="pkgColor" type="color" value={newP.color} onChange={e => setN('color', e.target.value)} style={{ width: '100%', height: 42, border: 'none', borderRadius: 10, cursor: 'pointer', background: 'transparent' }} />
        </div>

        {renderProductsSubform(newP, 'new')}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <Btn full onClick={handleAdd}><img src={SaveIcon} alt="" style={{ width: 14, height: 14, marginRight: 6, verticalAlign: 'middle' }} />Save Package</Btn>
          <Btn full variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Edit Package */}
      <Modal title={` Edit — ${editing?.name}`} open={!!editing} onClose={() => setEditing(null)}>
        {editing && <>
          <Inp label="Name *" value={editing.name} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} />
          <Inp label="Desc" value={editing.desc} onChange={e => setEditing(p => ({ ...p, desc: e.target.value }))} />
          <Inp label="Price *" value={editing.price} onChange={e => setEditing(p => ({ ...p, price: Number(e.target.value) }))} type="number" />
          <Inp label="Duration" value={editing.time} onChange={e => setEditing(p => ({ ...p, time: e.target.value }))} />

          {(currentUser?.role === 'SupremeAdmin' || currentUser?.role === 'SuperAdmin') && branches && branches.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Assign to Branch</div>
              <Dropdown value={editing.branch_id || ''} onChange={v => setEditing(p => ({ ...p, branch_id: v }))} options={[
                { value: '', label: currentUser?.role === 'SupremeAdmin' ? 'Global (All Branches)' : 'Select Branch...' },
                ...branches.map(b => ({ value: b.id, label: b.name }))
              ]} />
            </div>
          )}

          {renderProductsSubform(editing, 'edit')}

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <Btn full onClick={handleUpdate}>Save Changes</Btn>
            <Btn full variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
          </div>
        </>}
      </Modal>

      {/* Barcode Scanner Modal */}
      {scannerTarget && (
        <BarcodeScanner
          onClose={() => setScannerTarget(null)}
          onConfirm={handleBarcodeConfirm}
        />
      )}
    </>
  );
};




// ═══════════════════════════════════════════════════════════
// PAYMENT GATEWAY SETTINGS PAGE
// ═══════════════════════════════════════════════════════════
export const PaymentGatewaySettings = ({ notify, currentUser }) => {
  const curr = (typeof currentUser !== 'undefined' && currentUser) ? getCurrency(currentUser?.phone) : 'RM';

  const [razorpay, setRazorpay] = useState({ key_id: '', key_secret: '' });
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchGateway = currentUser?.role === 'SupremeAdmin' ? API.settings.getSupremeRazorpay() : API.settings.getRazorpay();
    fetchGateway
      .then(data => setRazorpay(data || { key_id: '', key_secret: '' }))
      .catch(() => setRazorpay({ key_id: '', key_secret: '' }))
      .finally(() => setLoading(false));
  }, [currentUser]);

  const handleSave = async () => {
    if (!razorpay.key_id?.trim() || !razorpay.key_secret?.trim()) {
      if (notify) notify('Razorpay Key ID and Key Secret are required', 'error');
      return;
    }
    try {
      if (currentUser?.role === 'SupremeAdmin') {
        await API.settings.setSupremeRazorpay(razorpay);
      } else {
        await API.settings.setRazorpay(razorpay);
      }

      if (razorpay.key_secret && razorpay.key_secret !== '••••••••') {
        setRazorpay(prev => ({ ...prev, key_secret: '••••••••' }));
      }
      if (razorpay.webhook_secret && razorpay.webhook_secret !== '••••••••') {
        setRazorpay(prev => ({ ...prev, webhook_secret: '••••••••' }));
      }
      notify('Payment gateway settings updated!');
    } catch (err) { notify(err.message || 'Failed to update settings', 'error'); }
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Razorpay Configuration</h3>
        <p style={{ margin: '0 0 22px', fontSize: 13, color: 'var(--text-2)' }}>
          {currentUser?.role === 'SupremeAdmin'
            ? 'These keys are used to collect payments for Retailer subscription upgrades.'
            : 'These keys are used to collect online payments from your customers during wash checkout.'}
        </p>
        {loading ? <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
            <Inp label="Razorpay Key ID *" value={razorpay.key_id || ''} onChange={e => setRazorpay(b => ({ ...b, key_id: e.target.value }))} placeholder="rzp_live_xxx..." />
            <Inp label="Razorpay Key Secret *" value={razorpay.key_secret || ''} onChange={e => setRazorpay(b => ({ ...b, key_secret: e.target.value }))} placeholder="Enter your secret key" type="password" />
            <Inp label="Webhook Secret *" value={razorpay.webhook_secret || ''} onChange={e => setRazorpay(b => ({ ...b, webhook_secret: e.target.value }))} placeholder="Required for receiving QR webhooks (e.g. from Razorpay)" type="password" />
            <div style={{ marginTop: 8 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Webhook URL (Copy to Razorpay)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input readOnly value={BASE_URL + '/api/webhook/razorpay'} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text)', fontSize: 13 }} />
                <button type="button" onClick={() => { navigator.clipboard.writeText(BASE_URL + '/api/webhook/razorpay'); notify && notify('Copied Webhook URL!', 'success'); }} style={{ padding: '0 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Copy</button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div style={{ display: 'flex', gap: 10, padding: 10, background: 'var(--card)', borderRadius: 14, border: '1.5px solid var(--border)' }}>
        <Btn full onClick={handleSave} style={{ color: '#da1a32', background: 'white' }}><img src={SaveIcon} alt="" style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} />Save Payment Gateway</Btn>
      </div>
    </div>
  );
};

export const PaymentSettingsPage = ({ notify, currentUser }) => {
  const curr = (typeof currentUser !== 'undefined' && currentUser) ? getCurrency(currentUser?.phone) : 'RM';

  return (
    <div>
      <PaymentGatewaySettings notify={notify} currentUser={currentUser} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// REPORTS PAGE
// ═══════════════════════════════════════════════════════════
export const Reports = ({ sessions, packages, branches, branchSubscription, users = [], userRole, currentUser, onNav }) => {
  const curr = (typeof currentUser !== 'undefined' && currentUser) ? getCurrency(currentUser?.phone) : 'RM';

  const isSupremeAdmin = userRole === 'SupremeAdmin';
  const calculatedAccess = isSupremeAdmin ? 'All' : (branchSubscription?.report_access || 'All');
  const defaultPeriod = calculatedAccess === 'All' ? 'All' : calculatedAccess;
  const [periodFilt, setPeriodFilt] = useState(defaultPeriod);
  const [branchFilt, setBranchFilt] = useState('All');
  const [customDate, setCustomDate] = useState('');
  const [subscriptionHistory, setSubscriptionHistory] = useState([]);

  useEffect(() => {
    if (isSupremeAdmin) {
      import('../../utils/api').then(({ API }) => {
        API.subscriptions.history(true).then(data => {
          setSubscriptionHistory(data || []);
        }).catch(err => console.error("Failed to fetch subscription history", err));
      });
    }
  }, [isSupremeAdmin]);

  useEffect(() => {
    if (calculatedAccess === 'Monthly') {
      if (['All', 'Annually', 'Custom'].includes(periodFilt)) setPeriodFilt('Monthly');
    } else if (calculatedAccess === 'Annually') {
      if (['All', 'Custom'].includes(periodFilt)) setPeriodFilt('Annually');
    }
  }, [calculatedAccess, periodFilt]);

  const parseDate = (dStr) => {
    if (!dStr) return null;
    const dayStr = dStr.split(',')[0].trim();

    // Try native parsing first (works for "03 Jun 2026")
    const parsed = new Date(dayStr);
    if (!isNaN(parsed.getTime())) return parsed;

    const parts = dayStr.split(/[\/\-]/);
    if (parts.length !== 3) return null;
    if (parts[0].length === 4) return new Date(parts[0], parts[1] - 1, parts[2]);
    return new Date(parts[2], parts[1] - 1, parts[0]);
  };

  const filteredSessions = sessions.filter(s => {
    if (branchFilt !== 'All' && s.branchId !== branchFilt) return false;
    if (periodFilt !== 'All') {
      const d = parseDate(s.date);
      if (!d) return false;
      const now = new Date();
      if (periodFilt === 'Daily') {
        if (d.toDateString() !== now.toDateString()) return false;
      } else if (periodFilt === 'Weekly') {
        const diff = (now - d) / (1000 * 60 * 60 * 24);
        if (diff > 7 || diff < -1) return false; // within last 7 days
      } else if (periodFilt === 'Monthly') {
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      } else if (periodFilt === 'Annually') {
        if (d.getFullYear() !== now.getFullYear()) return false;
      } else if (periodFilt === 'Custom') {
        if (!customDate) return true;
        const [cYear, cMonth, cDay] = customDate.split('-');
        const cDate = new Date(cYear, cMonth - 1, cDay);
        if (d.toDateString() !== cDate.toDateString()) return false;
      }
    }
    return true;
  });

  const totalRev = filteredSessions.reduce((a, s) => a + (s.total || 0), 0);
  const washerMap = {};
  filteredSessions.forEach(s => { if (!washerMap[s.washer]) washerMap[s.washer] = { s: 0, r: 0 }; washerMap[s.washer].s++; washerMap[s.washer].r += s.total || 0; });
  const branchRev = branches.map(b => ({ name: b.name.split('–')[0].trim(), revenue: filteredSessions.filter(s => s.branchId === b.id).reduce((a, s) => a + (s.total || 0), 0), count: filteredSessions.filter(s => s.branchId === b.id).length }));

  // Supreme Admin Specific Data
  const superAdmins = users.filter(u => u.role === 'SuperAdmin');
  const superAdminRev = superAdmins.map(sa => {
    const ownedBranches = branches.filter(b => b.owner_id === sa.id || b.id === sa.branchId || b.id === sa.branch_id).map(b => b.id);
    const rev = filteredSessions.filter(s => ownedBranches.includes(s.branchId)).reduce((a, s) => a + (s.total || 0), 0);
    const count = filteredSessions.filter(s => ownedBranches.includes(s.branchId)).length;
    return { name: sa.name, revenue: rev, count: count, phone: sa.phone };
  });

  const filteredSubscriptions = subscriptionHistory.filter(tx => {
    if (periodFilt !== 'All') {
      const d = parseDate(new Date(tx.created_at).toLocaleDateString());
      if (!d) return false;
      const now = new Date();
      if (periodFilt === 'Daily') {
        if (d.toDateString() !== now.toDateString()) return false;
      } else if (periodFilt === 'Weekly') {
        const diff = (now - d) / (1000 * 60 * 60 * 24);
        if (diff > 7 || diff < -1) return false;
      } else if (periodFilt === 'Monthly') {
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      } else if (periodFilt === 'Annually') {
        if (d.getFullYear() !== now.getFullYear()) return false;
      } else if (periodFilt === 'Custom') {
        if (!customDate) return true;
        const [cYear, cMonth, cDay] = customDate.split('-');
        const cDate = new Date(cYear, cMonth - 1, cDay);
        if (d.toDateString() !== cDate.toDateString()) return false;
      }
    }
    return true;
  });

  const totalSubRev = filteredSubscriptions.reduce((a, tx) => a + (tx.amount || 0), 0);

  const exportCSV = () => {
    if (isSupremeAdmin) {
      const h = 'Type,ID,Date,User/Branch,Amount,Details\n';
      const washRows = filteredSessions.map(s => `Wash,${s.id},"${s.date}",${s.branchId || ''},${s.total},${s.washer}`).join('\n');
      const subRows = filteredSubscriptions.map(tx => `Subscription,${tx.transaction_id},"${new Date(tx.created_at).toLocaleDateString()}",${tx.user_name || ''},${tx.amount},${tx.plan_name}`).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([h + washRows + '\n' + subRows], { type: 'text/csv' })); a.download = `supreme-report-${periodFilt}.csv`; a.click();
    } else {
      const h = 'Invoice,Date,Branch,Washer,Package,Amount,Payment\n';
      const rows = filteredSessions.map(s => [s.id, `"${s.date}"`, s.branchId || '', s.washer, s.package?.name, s.total, s.payment?.mode].join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([h + rows], { type: 'text/csv' })); a.download = `washpro-report-${periodFilt}-${branchFilt}.csv`; a.click();
    }
  };

  const dailyRevMap = {};
  const monthlyRevMap = {};

  if (isSupremeAdmin) {
    filteredSubscriptions.forEach(tx => {
      if (!tx.created_at) return;
      const dateObj = new Date(tx.created_at);
      const dayStr = dateObj.toLocaleDateString();
      const monthStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

      if (!dailyRevMap[dayStr]) dailyRevMap[dayStr] = 0;
      dailyRevMap[dayStr] += (tx.amount || 0);

      if (!monthlyRevMap[monthStr]) monthlyRevMap[monthStr] = 0;
      monthlyRevMap[monthStr] += (tx.amount || 0);
    });
  } else {
    filteredSessions.forEach(s => {
      if (!s.date) return;
      const dayStr = s.date.split(',')[0].trim();
      const parts = dayStr.split(/[\/\-]/);
      let monthStr = dayStr;
      if (parts.length === 3) {
        if (parts[0].length === 4) monthStr = `${parts[0]}-${parts[1]}`;
        else monthStr = `${parts[2]}-${parts[1]}`; // assumes DD/MM/YYYY
      }

      if (!dailyRevMap[dayStr]) dailyRevMap[dayStr] = 0;
      dailyRevMap[dayStr] += (s.total || 0);

      if (!monthlyRevMap[monthStr]) monthlyRevMap[monthStr] = 0;
      monthlyRevMap[monthStr] += (s.total || 0);
    });
  }

  const dailyData = Object.entries(dailyRevMap).map(([d, r]) => ({ name: d, revenue: r })).slice(-14);
  const monthlyData = Object.entries(monthlyRevMap).map(([m, r]) => ({ name: m, revenue: r })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', background: 'var(--card)', padding: '12px 16px', borderRadius: 14, border: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginRight: 6 }}>Filters:</span>
        <Dropdown value={periodFilt} onChange={setPeriodFilt} options={[
          ...(calculatedAccess === 'Monthly' || calculatedAccess === 'Annually' ? [] : [{ value: 'All', label: 'All Time' }]),
          { value: 'Daily', label: 'Today (Daily)' },
          { value: 'Weekly', label: 'This Week (Weekly)' },
          { value: 'Monthly', label: 'This Month (Monthly)' },
          ...(calculatedAccess === 'Monthly' ? [] : [{ value: 'Annually', label: 'This Year (Annually)' }]),
          ...(calculatedAccess === 'Monthly' || calculatedAccess === 'Annually' ? [] : [{ value: 'Custom', label: 'Custom Date' }])
        ]} style={{ minWidth: 160 }} />
        {periodFilt === 'Custom' && (
          <input
            type="date"
            value={customDate}
            onChange={e => setCustomDate(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, outline: 'none', cursor: 'pointer' }}
          />
        )}
        {branches.length > 1 && (
          <Dropdown value={branchFilt} onChange={setBranchFilt} options={[
            { value: 'All', label: 'All Branches' },
            ...branches.map(b => ({ value: b.id, label: b.name.split('–')[0].trim() }))
          ]} style={{ minWidth: 160 }} />
        )}
        <Btn variant="ghost" onClick={exportCSV} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}><img src={DownloadIcon} alt="" style={{ width: 14, height: 14, marginRight: 6 }} />Export CSV</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard icon={<img src={RevenueIcon} alt="" style={{ width: 24, height: 24 }} />} label={isSupremeAdmin ? "Filtered Wash Revenue" : "Filtered Revenue"} value={`${curr} ${totalRev.toLocaleString()}`} color="var(--accent)" />
        {isSupremeAdmin && (
          <StatCard icon={<img src={ReceiptIcon} alt="" style={{ width: 24, height: 24 }} />} label="Filtered Sub Revenue" value={`${curr} ${totalSubRev.toLocaleString()}`} color="var(--green)" />
        )}
        <StatCard icon={<img src={CarIcon} alt="" style={{ width: 24, height: 24 }} />} label="Filtered Sessions" value={filteredSessions.length} color="var(--accent-2)" />

      </div>

      <div className="responsive-split-1-1" style={{ gap: 14 }}>
        {isSupremeAdmin ? (
          <>
            <Card>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Wash Revenue by Super Admin</h3>
              {superAdminRev.every(sa => sa.revenue === 0)
                ? <EmptyState icon={<img src={ChartIcon} alt="" style={{ width: 32, height: 32 }} />} title="No data yet" />
                : (
                  <div style={{ maxHeight: '540px', overflowY: 'auto', paddingRight: 4 }}>
                    {superAdminRev.sort((a, b) => b.revenue - a.revenue).map((sa, i) => (
                      <div key={i} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                          <span style={{ color: 'var(--text)' }}>{sa.name}</span>
                          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{getCurrency(sa.phone)} {sa.revenue.toFixed(2)} · {sa.count} jobs</span>
                        </div>
                        <div style={{ background: 'var(--bg-3)', borderRadius: 99, height: 7 }}>
                          <div style={{ width: `${Math.min(100, (sa.revenue / (totalRev || 1)) * 100)}%`, height: '100%', background: 'var(--accent)', borderRadius: 99 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </Card>

            <Card>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Subscription Revenue Breakdown</h3>
              {filteredSubscriptions.length === 0
                ? <EmptyState icon={<img src={ReceiptIcon} alt="" style={{ width: 32, height: 32 }} />} title="No subscription data" />
                : (
                  <div style={{ maxHeight: '540px', overflowY: 'auto' }}>
                    {filteredSubscriptions.map((tx, i) => {
                      const subscriber = users.find(u => u.id === tx.user_id) || users.find(u => u.name === tx.user_name);
                      const displayCurrency = subscriber ? getCurrency(subscriber.phone) : (tx.currency || curr);
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{tx.user_name || '-'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{tx.plan_name} - {new Date(tx.created_at).toLocaleDateString()}</div>
                          </div>
                          <div style={{ fontWeight: 800, color: 'var(--green)', fontSize: 14 }}>{displayCurrency} {tx.amount.toFixed(2)}</div>
                        </div>
                      );
                    })}
                  </div>
                )
              }
            </Card>
          </>
        ) : (
          <>
            {/* Washer performance */}
            <Card>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Revenue by Washer</h3>
              {Object.keys(washerMap).length === 0
                ? <EmptyState icon={<img src={ChartIcon} alt="" style={{ width: 32, height: 32 }} />} title="No data yet" />
                : Object.entries(washerMap).sort((a, b) => b[1].r - a[1].r).map(([name, stat]) => (
                  <div key={name} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                      <span style={{ color: 'var(--text)' }}>{name}</span>
                      <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{curr} {stat.r} · {stat.s} jobs</span>
                    </div>
                    <div style={{ background: 'var(--bg-3)', borderRadius: 99, height: 7 }}>
                      <div style={{ width: `${Math.min(100, (stat.r / (totalRev || 1)) * 100)}%`, height: '100%', background: 'var(--accent)', borderRadius: 99 }} />
                    </div>
                  </div>
                ))
              }
            </Card>

            {/* Branch performance */}
            <Card>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Revenue by Branch</h3>
              {branchRev.every(b => b.revenue === 0)
                ? <EmptyState icon={<img src={BranchIcon} alt="" style={{ width: 32, height: 32 }} />} title="No branch data yet" />
                : branchRev.map((b, i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                      <span style={{ color: 'var(--text)' }}>{b.name}</span>
                      <span style={{ fontWeight: 700, color: 'var(--green)' }}>{curr} {b.revenue} · {b.count} jobs</span>
                    </div>
                    <div style={{ background: 'var(--bg-3)', borderRadius: 99, height: 7 }}>
                      <div style={{ width: `${Math.min(100, (b.revenue / (totalRev || 1)) * 100)}%`, height: '100%', background: 'var(--accent)', borderRadius: 99 }} />
                    </div>
                  </div>
                ))
              }
            </Card>
          </>
        )}

        {/* Daily Revenue */}
        <Card>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
            {isSupremeAdmin ? 'Daily Subscription Revenue' : 'Daily Revenue'}
          </h3>
          {(isSupremeAdmin ? filteredSubscriptions : filteredSessions).length === 0
            ? <EmptyState icon={<img src={ChartIcon} alt="" style={{ width: 32, height: 32 }} />} title={isSupremeAdmin ? "No subscription data yet" : "No session data yet"} />
            : <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyData}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${curr} ${v}`} />
                <Tooltip formatter={v => `${curr} ${v}`} contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 10 }} />
                <Bar dataKey="revenue" fill="var(--accent)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          }
        </Card>

        {/* Monthly Revenue */}
        <Card>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
            {isSupremeAdmin ? 'Monthly Subscription Revenue' : 'Monthly Revenue'}
          </h3>
          {(isSupremeAdmin ? filteredSubscriptions : filteredSessions).length === 0
            ? <EmptyState icon={<img src={ChartIcon} alt="" style={{ width: 32, height: 32 }} />} title={isSupremeAdmin ? "No subscription data yet" : "No session data yet"} />
            : <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${curr} ${v}`} />
                <Tooltip formatter={v => `${curr} ${v}`} contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 10 }} />
                <Bar dataKey="revenue" fill="var(--accent)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          }
        </Card>

        {/* Package / Plan revenue */}
        <Card style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
            {isSupremeAdmin ? 'Revenue by Subscription Plan' : 'Revenue by Package'}
          </h3>
          {(isSupremeAdmin ? filteredSubscriptions : filteredSessions).length === 0
            ? <EmptyState icon={<img src={SoapIcon} alt="" style={{ width: 32, height: 32 }} />} title={isSupremeAdmin ? "No subscription data yet" : "No session data yet"} />
            : <ResponsiveContainer width="100%" height={220}>
              <BarChart data={isSupremeAdmin 
                ? Object.entries(
                    filteredSubscriptions.reduce((acc, tx) => {
                      const planName = tx.plan_name || 'Unknown';
                      if (!acc[planName]) acc[planName] = 0;
                      acc[planName] += tx.amount || 0;
                      return acc;
                    }, {})
                  ).map(([name, revenue]) => ({ name, revenue }))
                : packages.map(p => ({ name: p.name, revenue: filteredSessions.filter(s => s.package?.id === p.id).reduce((a, s) => a + (s.total || 0), 0) }))
              }>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${curr} ${v}`} />
                <Tooltip formatter={v => `${curr} ${v}`} contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 10 }} />
                <Bar dataKey="revenue" fill="var(--accent)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          }
        </Card>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// LIVE MAP PAGE
// ═══════════════════════════════════════════════════════════
export const LiveMap = ({ currentUser, sessions, pendingJobs, branches, onNav }) => {
  const curr = (typeof currentUser !== 'undefined' && currentUser) ? getCurrency(currentUser?.phone) : 'RM';

  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
  });

  const activeJobs = useMemo(() => {
    return (pendingJobs || []).filter(j => j.status !== 'Completed' && j.geo);
  }, [pendingJobs]);

  const mapOptions = useMemo(() => ({
    mapTypeId: 'roadmap',
    disableDefaultUI: false,
    styles: [
      { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
      { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
      { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
      { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
      { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
      { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
      { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
      { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b1' }] },
      { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
      { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
      { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
      { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] }
    ],
  }), []);

  const [map, setMap] = useState(null);

  const onLoad = React.useCallback(function callback(mapInstance) {
    setMap(mapInstance);
  }, []);

  const onUnmount = React.useCallback(function callback() {
    setMap(null);
  }, []);

  useEffect(() => {
    if (map && activeJobs.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      let hasValidGeo = false;
      activeJobs.forEach((s) => {
        let lat = parseFloat(s.geo?.lat);
        let lng = parseFloat(s.geo?.lng);
        if (!isNaN(lat) && !isNaN(lng)) {
          bounds.extend({ lat, lng });
          hasValidGeo = true;
        }
      });

      if (hasValidGeo) {
        map.fitBounds(bounds, 50);

        // Remove listener after first zoom adjustment to allow manual zooming afterwards
        const listener = map.addListener('bounds_changed', () => {
          if (map.getZoom() > 15) {
            map.setZoom(15);
          }
          window.google.maps.event.removeListener(listener);
        });
      }
    }
  }, [map, activeJobs]);

  const getPosition = (s, index) => {
    let lat = parseFloat(s.geo?.lat);
    let lng = parseFloat(s.geo?.lng);
    const jitterAmount = 0.0002;
    lat += Math.cos(index * Math.PI / 4) * jitterAmount * (Math.floor(index / 8) + 1);
    lng += Math.sin(index * Math.PI / 4) * jitterAmount * (Math.floor(index / 8) + 1);
    return { lat, lng };
  };

  const svgMarker = {
    path: 'M 16 2 C 8.268 2 2 8.268 2 16 C 2 23.732 8.268 30 16 30 C 23.732 30 30 23.732 30 16 C 30 8.268 23.732 2 16 2 z M 16 22 C 12.686 22 10 19.314 10 16 C 10 12.686 12.686 10 16 10 C 19.314 10 22 12.686 22 16 C 22 19.314 19.314 22 16 22 z',
    fillColor: '#da1a31',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 1,
    anchor: isLoaded ? new window.google.maps.Point(16, 16) : null,
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 18 }}>
        <StatCard icon={<img src={MapIcon} alt="" style={{ width: 24, height: 24 }} />} label="GPS Points" value={sessions.length} color="var(--accent)" />
        <StatCard icon={<img src={ActiveIcon} alt="" style={{ width: 24, height: 24 }} />} label="Completed" value={sessions.filter(s => s.status === 'Completed').length} color="var(--green)" />
        <StatCard icon={<img src={BranchIcon} alt="" style={{ width: 24, height: 24 }} />} label="Branches" value={branches.length} color="var(--accent-2)" />
      </div>

      <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src={MapIcon} alt="" style={{ width: 18, height: 18 }} />
            Live Session Map
          </h3>
          <Chip color="var(--green)">● Live</Chip>
        </div>
        <div style={{ position: 'relative', height: 360, background: '#0a1a0a', overflow: 'hidden' }}>
          {loadError ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--red)' }}>
              Error loading Google Maps
            </div>
          ) : !isLoaded ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)' }}>
              Loading map...
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={{ lat: 3.1412, lng: 101.68653 }}
              zoom={12}
              options={mapOptions}
              onLoad={onLoad}
              onUnmount={onUnmount}
            >
              {activeJobs.map((s, idx) => (
                <Marker
                  key={s.id}
                  position={getPosition(s, idx)}
                  icon={svgMarker}
                  onClick={() => setSelected(s)}
                  onMouseOver={() => setHovered(s.id)}
                  onMouseOut={() => setHovered(null)}
                >
                  {(selected?.id === s.id || hovered === s.id) && (
                    <InfoWindow
                      onCloseClick={() => setSelected(null)}
                      options={{ disableAutoPan: false }}
                    >
                      <div style={{ color: '#000', padding: '8px', fontFamily: 'sans-serif', textAlign: 'left', minWidth: '200px' }}>
                        <div style={{ fontWeight: 700, marginBottom: '3px', fontSize: '13px' }}>{s.id}</div>
                        <div style={{ fontSize: '12px', marginBottom: '2px' }}>{s.vehicle?.colour || ''} {s.vehicle?.make || ''} {s.vehicle?.model || ''}</div>
                        <div style={{ color: '#da1a31', fontSize: '11px' }}>📌 {s.locationName || 'Unknown'}</div>
                        <div style={{ fontSize: '11px', marginTop: '3px', color: '#666' }}>
                          {parseFloat(s.geo?.lat).toFixed(6)}, {parseFloat(s.geo?.lng).toFixed(6)}
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </Marker>
              ))}
            </GoogleMap>
          )}

          {activeJobs.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,26,10,0.6)', color: 'rgba(255,255,255,0.7)', fontSize: 13, zIndex: 10, pointerEvents: 'none' }}>
              No active live jobs right now.
            </div>
          )}
        </div>
      </Card>

      <Card>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>GPS Session Log</h3>
        <div className="table-responsive-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--bg-3)' }}>
              {['Invoice', 'Washer', 'Vehicle', 'Location Name', 'Coordinates', 'Time'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '9px 13px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {sessions.length === 0
                ? <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No GPS data yet.</td></tr>
                : sessions.map(s => (
                  <React.Fragment key={s.id}>
                    <tr onClick={() => setSelected(selected?.id === s.id ? null : s)} style={{ cursor: 'pointer', background: selected?.id === s.id ? 'var(--card-hover)' : '' }}
                      onMouseEnter={e => { if (selected?.id !== s.id) e.currentTarget.style.background = 'var(--card-hover)' }}
                      onMouseLeave={e => { if (selected?.id !== s.id) e.currentTarget.style.background = '' }}>
                      <td style={{ padding: '10px 13px', borderBottom: '1px solid var(--border)', color: 'var(--accent)', fontWeight: 700, fontSize: 13 }}>{s.id}</td>
                      <td style={{ padding: '10px 13px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text)' }}>{s.washer}</td>
                      <td style={{ padding: '10px 13px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text)' }}>
                        {`${s.vehicle?.colour || ''} ${s.vehicle?.make || ''} ${s.vehicle?.model || ''}`.trim() || <span style={{ color: 'var(--amber)' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 13px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--accent)' }}>{s.locationName || s.branch || <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                      <td style={{ padding: '10px 13px', borderBottom: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 10, color: 'var(--text-2)' }}>{s.location}</td>
                      <td style={{ padding: '10px 13px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-2)' }}>{s.date}</td>
                    </tr>
                    {selected?.id === s.id && (
                      <tr style={{ background: 'var(--bg)' }}>
                        <td colSpan={6} style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
                          {(s.lat && s.lng) ? (
                            <div style={{ maxWidth: 500, background: 'var(--card)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', margin: '0 auto' }}>
                              <div style={{ background: 'var(--bg)', borderRadius: 12, overflow: 'hidden', marginBottom: 16, border: '1px solid var(--border)' }}>
                                <iframe title="map" width="100%" height="150" frameBorder="0" style={{ border: 0, borderRadius: 10 }}
                                  src={`https://maps.google.com/maps?q=${parseFloat(s.lat)},${parseFloat(s.lng)}&t=&z=15&ie=UTF8&iwloc=&output=embed`} />
                              </div>
                              <div style={{ background: 'var(--bg-3)', borderRadius: 12, padding: '10px 16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.04em' }}>Coordinates</div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{parseFloat(s.lat).toFixed(5)}, {parseFloat(s.lng).toFixed(5)}</div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-3)' }}>No GPS coordinates available for this session.</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              }
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// LOYALTY SETTINGS PAGE
// ═══════════════════════════════════════════════════════════
export const LoyaltySettings = ({ currentUser, customers, sessions, loyalty, updateLoyalty, notify, onNav }) => {
  const curr = (typeof currentUser !== 'undefined' && currentUser) ? getCurrency(currentUser?.phone) : 'RM';

  const DEFAULT_CFG = { enabled: true, visitThreshold: 3, discountType: 'percent', discountValue: 10, alertMessage: 'Congratulations! You have earned a loyalty reward.', couponPrefix: 'WASH', validityDays: 30 };
  const [cfg, setCfg] = React.useState({ ...DEFAULT_CFG, ...loyalty });
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (loyalty && Object.keys(loyalty).length > 0) setCfg({ ...DEFAULT_CFG, ...loyalty });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loyalty]);

  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateLoyalty(cfg);
      setSaved(true);
      notify('Loyalty settings saved!');
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { notify(err.message || 'Failed to save', 'error'); }
    setSaving(false);
  };

  // Stats
  const eligibleNow = customers.filter(c => (c.visits?.length || 0) >= cfg.visitThreshold).length;
  const totalRedeemed = customers.reduce((a, c) => a + (c.couponsRedeemed || 0), 0);
  const recentCoupons = customers
    .flatMap(c => (c.couponHistory || []).map(h => ({ ...h, customer: c.name, phone: c.phone })))
    .sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt))
    .slice(0, 10);

  return (
    <>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 22 }}>
        <StatCard icon={<img src={EligibleIcon} alt="" style={{ width: 24, height: 24 }} />} label="Eligible Now" value={eligibleNow} sub={`≥${cfg.visitThreshold} visits`} color="var(--green)" />
        <StatCard icon={<img src={RedeemIcon} alt="" style={{ width: 24, height: 24 }} />} label="Total Redeemed" value={totalRedeemed} sub="all time" color="var(--accent)" />
        <StatCard icon={<img src={GroupIcon} alt="" style={{ width: 24, height: 24 }} />} label="Total Customers" value={customers.length} sub="registered" color="var(--accent-2)" />
        <StatCard icon={<img src={CartIcon} alt="" style={{ width: 24, height: 24 }} />} label="Total Sessions" value={sessions.length} sub="all time" color="var(--amber)" />
      </div>

      <div className="responsive-split-1-1" style={{ gap: 14 }}>
        {/* Config form */}
        <Card>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Loyalty Configuration</h3>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-2)' }}>Customise how the reward programme works</p>

          {/* Enable toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-3)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Enable Loyalty Programme</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>Show rewards in Washer App checkout</div>
            </div>
            <div onClick={() => set('enabled', !cfg.enabled)} style={{
              width: 48, height: 26, borderRadius: 99, border: 'none', padding: 0, cursor: 'pointer',
              background: cfg.enabled ? 'var(--accent)' : 'var(--border-2)', position: 'relative', transition: 'background 0.2s',
            }}>
              <div style={{ position: 'absolute', top: 3, left: cfg.enabled ? 25 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
            </div>
          </div>

          <div style={{ opacity: cfg.enabled ? 1 : 0.45, pointerEvents: cfg.enabled ? 'auto' : 'none' }}>
            {/* Visit threshold */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Visits Required to Earn Reward
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[2, 3, 4, 5, 6, 8, 10].map(n => (
                  <button key={n} onClick={() => set('visitThreshold', n)} style={{ padding: '8px 14px', borderRadius: 9, border: `2px solid ${cfg.visitThreshold === n ? 'var(--accent)' : 'var(--border-2)'}`, background: cfg.visitThreshold === n ? 'var(--accent-dim)' : 'var(--bg-3)', color: cfg.visitThreshold === n ? 'var(--accent)' : 'var(--text-2)', fontWeight: cfg.visitThreshold === n ? 800 : 500, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Discount type + value */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Discount Type</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {[['percent', 'Percentage (%)'], ['fixed', 'Fixed Amount ({curr})']].map(([v, l]) => (
                  <button key={v} onClick={() => set('discountType', v)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${cfg.discountType === v ? 'var(--accent)' : 'var(--border-2)'}`, background: cfg.discountType === v ? 'var(--accent-dim)' : 'var(--bg-3)', color: cfg.discountType === v ? 'var(--accent)' : 'var(--text-2)', fontWeight: cfg.discountType === v ? 700 : 500, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                    {l}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                Discount Value {cfg.discountType === 'percent' ? '(%)' : `(${curr})`}
              </div>
              <input id="discount-value" name="discountValue" type="number" value={cfg.discountValue} min={1} max={cfg.discountType === 'percent' ? 100 : 999}
                onChange={e => set('discountValue', Number(e.target.value))}
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-3)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', fontWeight: 700, outline: 'none', marginBottom: 4 }} />
              <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4 }}>
                Preview: {cfg.discountType === 'percent' ? `${cfg.discountValue}% off any package` : `${curr} ${cfg.discountValue} off any package`}
              </div>
            </div>

            {/* Coupon prefix */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Coupon Code Prefix</div>
              <input id="coupon-prefix" name="couponPrefix" value={cfg.couponPrefix} onChange={e => set('couponPrefix', e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 8))}
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-3)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'monospace', fontWeight: 700, outline: 'none', textTransform: 'uppercase' }} />
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>e.g. coupon will look like: {cfg.couponPrefix}-A12B-XY9Z</div>
            </div>

            {/* Validity days */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Coupon Validity (Days)</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[7, 14, 30, 60, 90].map(n => (
                  <button key={n} onClick={() => set('validityDays', n)} style={{ padding: '8px 14px', borderRadius: 9, border: `2px solid ${cfg.validityDays === n ? 'var(--accent)' : 'var(--border-2)'}`, background: cfg.validityDays === n ? 'var(--accent-dim)' : 'var(--bg-3)', color: cfg.validityDays === n ? 'var(--accent)' : 'var(--text-2)', fontWeight: cfg.validityDays === n ? 800 : 500, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                    {n}d
                  </button>
                ))}
              </div>
            </div>

            {/* Alert message */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Reward Alert Message</div>
              <textarea id="alert-message" name="alertMessage" value={cfg.alertMessage} onChange={e => set('alertMessage', e.target.value)} rows={3}
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-3)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Shown to washer in checkout when customer is eligible</div>
            </div>
          </div>

          <Btn full onClick={handleSave} variant={saved ? 'success' : 'primary'}>
            {saved ? 'Saved!' : <><img src={SaveIcon} alt="" style={{ width: 14, height: 14, marginRight: 6, verticalAlign: 'middle' }} />Save Settings</>}
          </Btn>

          {/* Live preview card */}
          <div style={{ marginTop: 16, background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(0,212,188,0.08))', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 14, padding: '14px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--green)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src={SearchIcon} alt="" style={{ width: 14, height: 14 }} />
              Washer App Preview
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>{cfg.alertMessage}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip color="var(--green)">{cfg.discountType === 'percent' ? `${cfg.discountValue}% off` : `${curr} ${cfg.discountValue} off`}</Chip>
              <Chip color="var(--accent)">After {cfg.visitThreshold} visits</Chip>
              <Chip color="var(--accent-2)">Valid {cfg.validityDays} days</Chip>
            </div>
          </div>
        </Card>

        {/* Redemption history */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Recent Redemptions</h3>
            {recentCoupons.length === 0
              ? <EmptyState icon={<img src={RedeemIcon} alt="" style={{ width: 48, height: 48 }} />} title="No coupons redeemed yet" sub="Coupons appear here after checkout" />
              : recentCoupons.map((c, i) => (
                <div key={i} style={{ background: 'var(--bg-3)', borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', fontFamily: 'monospace' }}>{c.code}</span>
                    <Chip color="var(--green)" size="sm">Redeemed</Chip>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}><img src={WorkerIcon} alt="" style={{ width: 12, height: 12, marginRight: 4 }} /> {c.customer} · {c.phone}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}><img src={calenderIcon} alt="" style={{ width: 12, height: 12, marginRight: 4 }} />{new Date(c.usedAt).toLocaleDateString('en-MY')}</div>
                </div>
              ))
            }
          </Card>

          <Card>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Top Loyal Customers</h3>
            {customers.length === 0
              ? <EmptyState icon={<img src={GroupIcon} alt="" style={{ width: 48, height: 48 }} />} title="No customers yet" />
              : customers.sort((a, b) => (b.visits?.length || 0) - (a.visits?.length || 0)).slice(0, 8).map((c, i) => {
                const visits = c.visits?.length || 0;
                const eligible = visits >= cfg.visitThreshold;
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12, color: '#fff', flexShrink: 0 }}>
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{visits} visits · {curr} {(c.totalSpend || 0).toFixed(2)}</div>
                    </div>
                    <Chip color={eligible ? 'var(--green)' : 'var(--text-3)'} size="sm">
                      {eligible ? ' Eligible' : `${cfg.visitThreshold - visits} more`}
                    </Chip>
                  </div>
                );
              })
            }
          </Card>
        </div>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// SUBSCRIPTION PLANS PAGE (SUPREME ADMIN ONLY)
// ═══════════════════════════════════════════════════════════
export const SubscriptionPlans = ({ currentUser, plans, createPlan, updatePlan, deletePlan, notify, onNav }) => {
  const curr = (typeof currentUser !== 'undefined' && currentUser) ? getCurrency(currentUser?.phone) : 'RM';

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewCountry, setViewCountry] = useState('Malaysia');
  const [newPlan, setNewPlan] = useState({ label: '', price: '', price_inr: '', monthly_price: '', monthly_price_inr: '', annual_price: '', annual_price_inr: '', duration: '', color: '#6366f1', max_washers: 0, max_sessions: 0, max_branches: 0, has_loyalty: false, has_qr: false, has_reports: false, report_access: 'All', has_ai_scanning: false, has_multiple_branches: false });

  const handleAddOpen = () => {
    setNewPlan({ label: '', price: '', price_inr: '', monthly_price: '', monthly_price_inr: '', annual_price: '', annual_price_inr: '', duration: '', color: '#6366f1', max_washers: 0, max_sessions: 0, max_branches: 0, has_loyalty: false, has_qr: false, has_reports: false, report_access: 'All', has_ai_scanning: false, has_multiple_branches: false, has_payment_gateway: false });
    setShowAdd(true);
  };

  const handleEditClick = (plan) => {
    setEditing({ ...plan, max_washers: plan.max_washers || 0, max_sessions: plan.max_sessions || 0, max_branches: plan.max_branches || 0, has_loyalty: !!plan.has_loyalty, has_qr: !!plan.has_qr, has_reports: !!plan.has_reports, report_access: plan.report_access || 'All', has_ai_scanning: !!plan.has_ai_scanning, has_multiple_branches: !!plan.has_multiple_branches, has_payment_gateway: !!plan.has_payment_gateway });
  };

  const handleAdd = async () => {
    if (!newPlan.label || !newPlan.price || !newPlan.duration) { notify('Label, price, and duration are required', 'error'); return; }
    try {
      await createPlan({
        label: newPlan.label, price: newPlan.price, price_inr: newPlan.price_inr, monthly_price: Number(newPlan.monthly_price) || 0, monthly_price_inr: Number(newPlan.monthly_price_inr) || 0, annual_price: Number(newPlan.annual_price) || 0, annual_price_inr: Number(newPlan.annual_price_inr) || 0, duration: newPlan.duration,
        color: newPlan.color,
        max_washers: Number(newPlan.max_washers) || 0, max_sessions: Number(newPlan.max_sessions) || 0, max_branches: Number(newPlan.max_branches) || 0,
        has_loyalty: newPlan.has_loyalty, has_qr: newPlan.has_qr, has_reports: newPlan.has_reports, report_access: newPlan.report_access,
        has_ai_scanning: newPlan.has_ai_scanning, has_multiple_branches: newPlan.has_multiple_branches, has_payment_gateway: newPlan.has_payment_gateway
      });
      setShowAdd(false);
      notify('Subscription Plan added!');
    } catch (err) { notify(err.message || 'Failed to add plan', 'error'); }
  };

  const handleUpdate = async () => {
    try {
      await updatePlan(editing.id, {
        label: editing.label, price: editing.price, price_inr: editing.price_inr, monthly_price: Number(editing.monthly_price) || 0, monthly_price_inr: Number(editing.monthly_price_inr) || 0, annual_price: Number(editing.annual_price) || 0, annual_price_inr: Number(editing.annual_price_inr) || 0, duration: editing.duration,
        color: editing.color,
        max_washers: Number(editing.max_washers) || 0, max_sessions: Number(editing.max_sessions) || 0, max_branches: Number(editing.max_branches) || 0,
        has_loyalty: editing.has_loyalty, has_qr: editing.has_qr, has_reports: editing.has_reports, report_access: editing.report_access,
        has_ai_scanning: editing.has_ai_scanning, has_multiple_branches: editing.has_multiple_branches, has_payment_gateway: editing.has_payment_gateway
      });
      setEditing(null);
      notify('Subscription Plan updated!');
    } catch (err) { notify(err.message || 'Failed to update plan', 'error'); }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this subscription plan?")) {
      try {
        await deletePlan(id);
        notify('Subscription Plan removed!');
      } catch (err) { notify(err.message || 'Failed to delete plan', 'error'); }
    }
  };

  const renderForm = (isEdit) => {
    const state = isEdit ? editing : newPlan;
    const setState = isEdit ? setEditing : setNewPlan;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Inp label="Plan Name" value={state.label} onChange={e => setState({ ...state, label: e.target.value })} placeholder="e.g. Pro Plan" />
          <Inp label="Display Price (MYR)" value={state.price} onChange={e => setState({ ...state, price: e.target.value })} placeholder="e.g. RM 99" />
          <Inp label="Display Price (INR)" value={state.price_inr} onChange={e => setState({ ...state, price_inr: e.target.value })} placeholder="e.g. INR 1499" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <Inp label="MYR/mo" type="number" value={state.monthly_price} onChange={e => {
              const val = e.target.value;
              let newDur = state.duration;
              let newAccess = state.report_access;
              if (Number(val) > 0) { newDur = '/month'; newAccess = 'Monthly'; }
              else if (Number(state.annual_price) > 0) { newDur = '/year'; newAccess = 'Annually'; }
              setState({ ...state, monthly_price: val, duration: newDur, report_access: newAccess });
            }} />
            <Inp label="INR/mo" type="number" value={state.monthly_price_inr} onChange={e => setState({ ...state, monthly_price_inr: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Inp label="MYR/yr" type="number" value={state.annual_price} onChange={e => {
              const val = e.target.value;
              let newDur = state.duration;
              let newAccess = state.report_access;
              if (Number(val) > 0 && !Number(state.monthly_price)) { newDur = '/year'; newAccess = 'Annually'; }
              else if (Number(state.monthly_price) > 0) { newDur = '/month'; newAccess = 'Monthly'; }
              setState({ ...state, annual_price: val, duration: newDur, report_access: newAccess });
            }} />
            <Inp label="INR/yr" type="number" value={state.annual_price_inr} onChange={e => setState({ ...state, annual_price_inr: e.target.value })} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration Type</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <Dropdown
                value={state.duration?.toLowerCase().includes('month') ? 'month' : state.duration?.toLowerCase().includes('year') ? 'year' : 'days'}
                onChange={type => {
                  let val = '';
                  let newAccess = state.report_access;
                  if (type === 'month') { val = '/month'; newAccess = 'Monthly'; }
                  else if (type === 'year') { val = '/year'; newAccess = 'Annually'; }
                  else { val = '14 days'; newAccess = 'All'; }
                  setState({ ...state, duration: val, report_access: newAccess });
                }}
                options={[
                  { value: 'days', label: 'Days' },
                  { value: 'month', label: 'Monthly' },
                  { value: 'year', label: 'Yearly' }
                ]}
                style={{ flex: 1 }}
              />
              {(!state.duration?.toLowerCase().includes('month') && !state.duration?.toLowerCase().includes('year')) && (
                <input
                  type="number"
                  min="1"
                  value={parseInt(state.duration) || 14}
                  onChange={e => setState({ ...state, duration: `${e.target.value} days` })}
                  style={{ width: 70, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-2)', background: 'var(--bg-3)', color: 'var(--text)', fontSize: 13, outline: 'none' }}
                />
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Inp label="Max Washers (0=Unlimited)" type="number" value={state.max_washers} onChange={e => setState({ ...state, max_washers: e.target.value })} />
          </div>
          <div style={{ flex: 1 }}>
            <Inp label="Max Sessions (0=Unlimited)" type="number" value={state.max_sessions} onChange={e => setState({ ...state, max_sessions: e.target.value })} />
          </div>
          <div style={{ flex: 1 }}>
            <Inp label="Max Branches (0=Unlimited)" type="number" value={state.max_branches} onChange={e => setState({ ...state, max_branches: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Module Access</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text)' }}>
                <input id="plan-has-loyalty" name="has_loyalty" type="checkbox" checked={state.has_loyalty} onChange={e => setState({ ...state, has_loyalty: e.target.checked })} /> Enable Loyalty Settings
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text)' }}>
                <input id="plan-has-qr" name="has_qr" type="checkbox" checked={state.has_qr} onChange={e => setState({ ...state, has_qr: e.target.checked })} /> Enable QR Manager
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text)' }}>
                <input id="plan-has-reports" name="has_reports" type="checkbox" checked={state.has_reports} onChange={e => setState({ ...state, has_reports: e.target.checked })} /> Enable Reports
              </label>
              {state.has_reports && (
                <div style={{ marginLeft: 22, marginTop: -4 }}>
                  <Dropdown
                    value={state.report_access || 'All'}
                    onChange={val => {
                      let newDuration = state.duration;
                      if (val === 'Monthly') newDuration = '/month';
                      else if (val === 'Annually') newDuration = '/year';
                      setState({ ...state, report_access: val, duration: newDuration });
                    }}
                    options={[
                      { value: 'All', label: 'All Time Access' },
                      { value: 'Annually', label: 'Annually Limit' },
                      { value: 'Monthly', label: 'Monthly Limit' }
                    ]}
                  />
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text)' }}>
                <input id="plan-has-ai-scanning" name="has_ai_scanning" type="checkbox" checked={state.has_ai_scanning} onChange={e => setState({ ...state, has_ai_scanning: e.target.checked })} /> AI Scanning
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text)' }}>
                <input id="plan-has-multiple-branches" name="has_multiple_branches" type="checkbox" checked={state.has_multiple_branches} onChange={e => setState({ ...state, has_multiple_branches: e.target.checked })} /> Enable Multiple Branches
              </label>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase' }}>Theme Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['#6366f1', '#059669', '#d97706', '#dc2626', '#3b82f6', '#8b5cf6'].map(c => (
                <div key={c} onClick={() => setState({ ...state, color: c })}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: state.color === c ? '3px solid var(--text)' : '2px solid transparent', transition: 'all 0.15s' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Subscription Plans</h2>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Manage platform subscription tiers for branches</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 10, padding: 4 }}>
            <button onClick={() => setViewCountry('Malaysia')} style={{ padding: '6px 14px', border: 'none', background: viewCountry === 'Malaysia' ? 'var(--card)' : 'transparent', color: viewCountry === 'Malaysia' ? 'var(--text)' : 'var(--text-3)', fontWeight: 600, fontSize: 13, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s', boxShadow: viewCountry === 'Malaysia' ? 'var(--shadow)' : 'none' }}>Malaysia</button>
            <button onClick={() => setViewCountry('India')} style={{ padding: '6px 14px', border: 'none', background: viewCountry === 'India' ? 'var(--card)' : 'transparent', color: viewCountry === 'India' ? 'var(--text)' : 'var(--text-3)', fontWeight: 600, fontSize: 13, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s', boxShadow: viewCountry === 'India' ? 'var(--shadow)' : 'none' }}>India</button>
          </div>
          <Btn onClick={handleAddOpen}>+ Add Plan</Btn>
        </div>
      </div>

      {plans.length === 0 ? (
        <EmptyState title="No subscription plans" sub="Click 'Add Plan' to create one." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
          {plans.map(p => {
            const feats = Array.isArray(p.features) ? p.features : [];
            const displayPrice = viewCountry === 'India' ? (p.price_inr || 'N/A') : (p.price || 'N/A');
            const displayMonthly = viewCountry === 'India' ? (p.monthly_price_inr || 0) : (p.monthly_price || 0);
            const displayAnnual = viewCountry === 'India' ? (p.annual_price_inr || 0) : (p.annual_price || 0);
            const currPrefix = viewCountry === 'India' ? 'INR ' : 'RM ';
            return (
              <Card key={p.id} style={{ borderTop: `4px solid ${p.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{p.label}</h3>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 20, fontWeight: 900, color: p.color }}>{displayPrice}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>{p.duration}</span>
                    </div>
                    {(displayMonthly > 0 || displayAnnual > 0) && (
                      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                        {displayMonthly > 0 && <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--bg-3)', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>{currPrefix}{displayMonthly}/mo</span>}
                        {displayAnnual > 0 && <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--bg-3)', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>{currPrefix}{displayAnnual}/yr</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn variant="ghost" size="sm" onClick={() => handleEditClick(p)} style={{ padding: 6, minWidth: 32 }}><img src={EditIcon} alt="edit" style={{ width: 14, height: 14 }} /></Btn>
                    <Btn variant="ghost" size="sm" onClick={() => handleDelete(p.id)} style={{ padding: 6, minWidth: 32 }}><img src={DeleteIcon} alt="delete" style={{ width: 14, height: 14 }} /></Btn>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Included Features</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', gap: 8 }}>
                      <span style={{ color: p.color, fontWeight: 800 }}>✓</span> {p.max_washers ? `${p.max_washers} Washers` : 'Unlimited Washers'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', gap: 8 }}>
                      <span style={{ color: p.color, fontWeight: 800 }}>✓</span> {p.max_sessions ? `${p.max_sessions} Sessions/mo` : 'Unlimited Sessions'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', gap: 8 }}>
                      <span style={{ color: p.color, fontWeight: 800 }}>✓</span> {p.max_branches ? `${p.max_branches} Branches` : 'Unlimited Branches'}
                    </div>
                    {p.has_loyalty && <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', gap: 8 }}><span style={{ color: p.color, fontWeight: 800 }}>✓</span> Loyalty Programme</div>}
                    {p.has_qr && <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', gap: 8 }}><span style={{ color: p.color, fontWeight: 800 }}>✓</span> QR Manager</div>}
                    {p.has_reports && <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', gap: 8 }}><span style={{ color: p.color, fontWeight: 800 }}>✓</span> Full Reports</div>}
                    {p.has_ai_scanning && <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', gap: 8 }}><span style={{ color: p.color, fontWeight: 800 }}>✓</span> AI Scanning</div>}
                    {p.has_multiple_branches && <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', gap: 8 }}><span style={{ color: p.color, fontWeight: 800 }}>✓</span> Multiple Branches</div>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <Modal title="Add Subscription Plan" open={showAdd} onClose={() => setShowAdd(false)} maxWidth={500}>
        {renderForm(false)}
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <Btn onClick={handleAdd} style={{ flex: 1 }}>Create Plan</Btn>
          <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
        </div>
      </Modal>

      <Modal title="Edit Subscription Plan" open={!!editing} onClose={() => setEditing(null)} maxWidth={500}>
        {editing && renderForm(true)}
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <Btn onClick={handleUpdate} style={{ flex: 1 }}>Save Changes</Btn>
          <Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
        </div>
      </Modal>
    </>
  );
};
