// ═══════════════════════════════════════════════════════════
// WASHERS PAGE
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef } from 'react';
import { Card, StatCard, Chip, Btn, Inp, Sel, Dropdown, Modal, EmptyState, BackButton } from '../../components/common/UI';
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
import { API } from '../../utils/api';
import CartIcon from '../../assets/icons/cart-icon.png';
import AlertIcon from '../../assets/icons/low-stack-alert-icon.png';
import MapIcon from '../../assets/icons/map-icon.png';
import BarcodeScannerIcon from '../../assets/icons/barcode-scanner-icon.png';
import BoxIcon from '../../assets/icons/circle-icon.png';
import SearchIcon from '../../assets/icons/search-icon.png';
import calenderIcon from '../../assets/icons/calendar-icon.png';
export const Washers = ({
  users,
  sessions,
  branches,
  createUser,
  updateUser,
  deleteUser,
  notify,
  userRole,
  currentUser,
  branchSubscription,
  onNav
}) => {
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
  if (isSuperAdmin && branchSubscription?.max_washers > 0) {
    if (washerCount >= branchSubscription.max_washers) {
      canAddWasher = false;
      addWasherMsg = `Your plan is limited to ${branchSubscription.max_washers} washers. Upgrade to add more.`;
    }
  }
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [newW, setNewW] = useState({
    username: '',
    password: '',
    name: '',
    phone: '',
    role: 'Washer',
    branchId: ''
  });
  const ROLE_OPTIONS = isSupremeAdmin ? [{
    value: 'Washer',
    label: 'Washer'
  }, {
    value: 'SuperAdmin',
    label: 'Super Admin'
  }, {
    value: 'Admin',
    label: 'Branch Admin'
  }] : [{
    value: 'Washer',
    label: 'Washer'
  }];
  const set = (k, v) => setNewW(f => ({
    ...f,
    [k]: v
  }));
  const washers = visibleWashers;
  const branchAdmins = users.filter(u => u.role === 'SuperAdmin' || u.role === 'Admin');
  const washerStats = {};
  sessions.forEach(s => {
    if (!washerStats[s.washer]) washerStats[s.washer] = {
      sessions: 0,
      revenue: 0
    };
    washerStats[s.washer].sessions++;
    washerStats[s.washer].revenue += s.total || 0;
  });
  const handleAdd = async () => {
    if (!newW.username || !newW.password || !newW.name) {
      notify('Fill in all required fields', 'error');
      return;
    }
    if (users.find(u => u.username === newW.username)) {
      notify('Username already exists!', 'error');
      return;
    }
    try {
      if (newW.role === 'SuperAdmin' && !newW.branchId) {
        notify('Branch is required for Branch Admin', 'error');
        return;
      }
      await createUser({
        username: newW.username,
        password: newW.password,
        role: newW.role,
        name: newW.name,
        phone: newW.phone,
        branch_id: newW.branchId
      });
      setNewW({
        username: '',
        password: '',
        name: '',
        phone: '',
        role: 'Washer',
        branchId: ''
      });
      setShowAdd(false);
      notify(`✅ ${newW.name} added!`);
    } catch (err) {
      notify(err.message || 'Failed to add washer', 'error');
    }
  };
  const handleUpdate = async () => {
    try {
      const payload = {
        name: editing.name,
        username: editing.username,
        phone: editing.phone,
        branch_id: editing.branchId
      };
      if (editing._newPwd) payload.password = editing._newPwd;
      await updateUser(editing.id, payload);
      setEditing(null);
      notify('✅ Washer updated!');
    } catch (err) {
      notify(err.message || 'Failed to update', 'error');
    }
  };
  const handleToggle = async id => {
    const u = users.find(u => u.id === id);
    try {
      await updateUser(id, {
        status: u.status === 'Active' ? 'Suspended' : 'Active'
      });
      notify(`${u.status === 'Active' ? '⚠️ Suspended' : '✅ Reactivated'}: ${u.name}`);
    } catch (err) {
      notify(err.message || 'Failed to update status', 'error');
    }
  };
  const handleDelete = async id => {
    const u = users.find(u => u.id === id);
    if (u.role === 'SupremeAdmin') {
      notify('Cannot delete Supreme Admin', 'error');
      return;
    }
    try {
      await deleteUser(id);
      notify(`X Removed: ${u.name}`);
    } catch (err) {
      notify(err.message || 'Failed to delete', 'error');
    }
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
      gap: 12,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: WorkerIcon,
      alt: "Worker",
      style: {
        width: 24,
        height: 24
      }
    }),
    label: "Total Staff",
    value: washers.length,
    color: "var(--accent)"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: ActiveIcon,
      alt: "Active",
      style: {
        width: 24,
        height: 24
      }
    }),
    label: "Active",
    value: washers.filter(w => w.status === 'Active').length,
    sub: "operational",
    color: "var(--green)"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: SuspendIcon,
      alt: "Suspended",
      style: {
        width: 24,
        height: 24
      }
    }),
    label: "Suspended",
    value: washers.filter(w => w.status === 'Suspended').length,
    sub: "",
    color: "var(--red)"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: JobIcon,
      alt: "Total Jobs",
      style: {
        width: 24,
        height: 24
      }
    }),
    label: "Total Jobs",
    value: sessions.length,
    sub: "across all staff",
    color: "var(--accent-2)"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: BranchIcon,
      alt: "Branch",
      style: {
        width: 24,
        height: 24
      }
    }),
    label: "Branch Admins",
    value: branchAdmins.length,
    sub: "branch managers",
    color: "var(--amber)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginBottom: 16
    }
  }, !canAddWasher && /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--amber)',
      fontSize: 13,
      fontWeight: 700,
      marginRight: 16,
      background: 'var(--amber)22',
      padding: '6px 12px',
      borderRadius: 8
    }
  }, "\u26A0\uFE0F ", addWasherMsg), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      setNewW(prev => ({
        ...prev,
        role: 'Washer',
        branchId: branches.length === 1 ? branches[0].id : ''
      }));
      setShowAdd(true);
    },
    disabled: !canAddWasher
  }, "+ Add Washer")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
      gap: 14
    }
  }, washers.map(w => {
    const ws = washerStats[w.name] || {
      sessions: 0,
      revenue: 0
    };
    const br = branches.find(b => String(b.id) === String(w.branchId || w.branch_id));
    return /*#__PURE__*/React.createElement(Card, {
      key: w.id,
      style: {
        borderLeft: `4px solid ${w.status === 'Active' ? 'var(--green)' : 'var(--red)'}`,
        opacity: w.status === 'Suspended' ? 0.72 : 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 46,
        height: 46,
        borderRadius: '50%',
        background: 'linear-gradient(135deg,var(--accent),var(--accent-2))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        fontSize: 15,
        color: '#fff',
        flexShrink: 0
      }
    }, w.avatar), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 800,
        fontSize: 15,
        color: 'var(--text)'
      }
    }, w.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--text-2)',
        marginTop: 1
      }
    }, w.role, " \xB7 @", w.username), br && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--accent)',
        marginTop: 1
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: BranchIcon,
      alt: "Branch",
      style: {
        width: 16,
        height: 16
      }
    }), br.name.split('–')[0].trim())), /*#__PURE__*/React.createElement(Chip, {
      color: w.status === 'Active' ? 'var(--green)' : 'var(--red)'
    }, w.status)), /*#__PURE__*/React.createElement("div", {
      className: "responsive-split-3",
      style: {
        gap: 8,
        marginBottom: 14
      }
    }, [['Sessions', ws.sessions, 'var(--accent)'], ['Revenue', `RM ${ws.revenue}`, 'var(--green)'], ['Joined', w.joined, 'var(--text-2)']].map(([l, v, c]) => /*#__PURE__*/React.createElement("div", {
      key: l,
      style: {
        background: 'var(--bg-3)',
        borderRadius: 10,
        padding: '9px',
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 9,
        color: 'var(--text-3)',
        fontWeight: 700,
        textTransform: 'uppercase',
        marginBottom: 3
      }
    }, l), /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 800,
        fontSize: 13,
        color: c
      }
    }, v)))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      size: "sm",
      style: {
        flex: 1
      },
      onClick: () => setEditing({
        ...w
      })
    }, /*#__PURE__*/React.createElement("img", {
      src: EditIcon,
      alt: "Edit",
      style: {
        width: 16,
        height: 16,
        marginRight: 6,
        verticalAlign: 'middle'
      }
    }), "Edit"), /*#__PURE__*/React.createElement(Btn, {
      variant: w.status === 'Active' ? 'danger' : 'ghost',
      size: "sm",
      style: {
        flex: 1
      },
      onClick: () => handleToggle(w.id)
    }, /*#__PURE__*/React.createElement("img", {
      src: w.status === 'Active' ? SuspendIcon : ActiveIcon,
      alt: w.status === 'Active' ? 'Suspend' : 'Reactivate',
      style: {
        width: 16,
        height: 16,
        marginRight: 6,
        verticalAlign: 'middle'
      }
    }), w.status === 'Active' ? 'Suspend' : 'Reactivate'), /*#__PURE__*/React.createElement(Btn, {
      variant: "danger",
      size: "sm",
      onClick: () => handleDelete(w.id)
    }, /*#__PURE__*/React.createElement("img", {
      src: DeleteIcon,
      alt: "Delete",
      style: {
        width: 16,
        height: 16,
        marginRight: 6,
        verticalAlign: 'middle'
      }
    }), "Delete")));
  })), /*#__PURE__*/React.createElement(Modal, {
    title: "\u2795 Add Washer",
    open: showAdd,
    onClose: () => setShowAdd(false)
  }, /*#__PURE__*/React.createElement(Inp, {
    label: "Full Name *",
    value: newW.name,
    onChange: e => set('name', e.target.value),
    placeholder: "Full name"
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "Username *",
    value: newW.username,
    onChange: e => set('username', e.target.value),
    placeholder: "Login username"
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "Password *",
    type: "password",
    value: newW.password,
    onChange: e => set('password', e.target.value),
    placeholder: "Password"
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "Phone",
    value: newW.phone,
    onChange: e => set('phone', e.target.value),
    placeholder: "e.g. 012-3456789"
  }), isSupremeAdmin && /*#__PURE__*/React.createElement(Dropdown, {
    label: "Role",
    value: newW.role,
    onChange: v => set('role', v),
    options: ROLE_OPTIONS
  }), branches.length === 1 ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--text-3)',
      textTransform: 'uppercase',
      marginBottom: 5
    }
  }, "Branch"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-3)',
      padding: '10px 14px',
      borderRadius: 10,
      fontSize: 13,
      color: 'var(--text)',
      border: '1px solid var(--border)',
      fontWeight: 600
    }
  }, branches[0].name)) : /*#__PURE__*/React.createElement(Dropdown, {
    label: "Branch",
    value: newW.branchId,
    onChange: v => set('branchId', v),
    options: [{
      value: '',
      label: '— Select Branch —'
    }, ...branches.map(b => ({
      value: b.id,
      label: b.name
    }))]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    full: true,
    onClick: handleAdd
  }, "Save Washer"), /*#__PURE__*/React.createElement(Btn, {
    full: true,
    variant: "ghost",
    onClick: () => setShowAdd(false)
  }, "Cancel"))), /*#__PURE__*/React.createElement(Modal, {
    title: ` Edit — ${editing?.name}`,
    open: !!editing,
    onClose: () => setEditing(null)
  }, editing && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Inp, {
    label: "Full Name",
    value: editing.name || '',
    onChange: e => setEditing(p => ({
      ...p,
      name: e.target.value
    }))
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "Username",
    value: editing.username || '',
    onChange: e => setEditing(p => ({
      ...p,
      username: e.target.value
    }))
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "Phone",
    value: editing.phone || '',
    onChange: e => setEditing(p => ({
      ...p,
      phone: e.target.value
    }))
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "New Password (leave blank to keep)",
    type: "password",
    value: editing._newPwd || '',
    onChange: e => setEditing(p => ({
      ...p,
      _newPwd: e.target.value
    }))
  }), branches.length === 1 ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--text-3)',
      textTransform: 'uppercase',
      marginBottom: 5
    }
  }, "Branch"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-3)',
      padding: '10px 14px',
      borderRadius: 10,
      fontSize: 13,
      color: 'var(--text)',
      border: '1px solid var(--border)',
      fontWeight: 600
    }
  }, branches[0].name)) : /*#__PURE__*/React.createElement(Dropdown, {
    label: "Branch",
    value: editing.branchId || '',
    onChange: v => setEditing(p => ({
      ...p,
      branchId: v
    })),
    options: [{
      value: '',
      label: '— No Branch —'
    }, ...branches.map(b => ({
      value: b.id,
      label: b.name
    }))]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    full: true,
    onClick: handleUpdate
  }, "Save Changes"), /*#__PURE__*/React.createElement(Btn, {
    full: true,
    variant: "ghost",
    onClick: () => setEditing(null)
  }, "Cancel")))));
};

// ═══════════════════════════════════════════════════════════
// CREDENTIALS PAGE
// ═══════════════════════════════════════════════════════════
export const Credentials = ({
  users,
  updateUser,
  deleteUser,
  notify,
  userRole,
  currentUser,
  onNav
}) => {
  const isSupremeAdmin = userRole === 'SupremeAdmin';
  const isSuperAdmin = userRole === 'SuperAdmin';
  const isBranchAdmin = userRole === 'Admin';
  const visibleUsers = users.filter(u => {
    if (isSupremeAdmin) return u.role !== 'Washer' && u.role !== 'SupremeAdmin';
    if (isSuperAdmin) return u.role === 'Admin' || u.role === 'Washer';
    if (isBranchAdmin) return u.role === 'Washer';
    return false;
  });
  const [editing, setEditing] = useState(null);
  const handleUpdate = async () => {
    try {
      const payload = {
        name: editing.name,
        username: editing.username,
        phone: editing.phone
      };
      if (editing._newPwd) payload.password = editing._newPwd;
      await updateUser(editing.id, payload);
      setEditing(null);
      notify('Credentials updated!');
    } catch (err) {
      notify(err.message || 'Failed to update', 'error');
    }
  };
  const handleDelete = async id => {
    const u = visibleUsers.find(u => u.id === id);
    if (!u) return;
    if (u.role === 'SupremeAdmin') {
      notify('Cannot delete Supreme Admin', 'error');
      return;
    }
    try {
      await deleteUser(id);
      notify(`Removed: ${u.name}`);
    } catch (err) {
      notify(err.message || 'Failed', 'error');
    }
  };
  const handleToggle = async id => {
    const u = visibleUsers.find(u => u.id === id);
    try {
      await updateUser(id, {
        status: u.status === 'Active' ? 'Suspended' : 'Active'
      });
      notify(`${u.status === 'Active' ? 'Suspended' : 'Activated'}: ${u.name}`);
    } catch (err) {
      notify(err.message || 'Failed to update status', 'error');
    }
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(245,158,11,0.08)',
      border: '1px solid rgba(245,158,11,0.25)',
      borderRadius: 14,
      padding: '12px 16px',
      marginBottom: 20,
      fontSize: 13,
      color: 'var(--amber)',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: AlertIcon,
    alt: "",
    style: {
      width: 18,
      height: 18
    }
  }), "Changes are saved persistently. Washers must re-login to use new credentials."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "table-responsive-wrapper"
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: 'var(--bg-3)'
    }
  }, ['Name', 'Username', 'Role', 'Branch', 'Phone', 'Status', 'Password', 'Actions'].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      textAlign: 'left',
      padding: '10px 14px',
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--text-3)',
      borderBottom: '1px solid var(--border)',
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, visibleUsers.map(u => /*#__PURE__*/React.createElement("tr", {
    key: u.id,
    style: {
      transition: 'background 0.15s'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'var(--card-hover)',
    onMouseLeave: e => e.currentTarget.style.background = ''
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      borderBottom: '1px solid var(--border)',
      fontWeight: 700,
      fontSize: 13,
      color: 'var(--text)'
    }
  }, u.name), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      borderBottom: '1px solid var(--border)',
      fontFamily: 'monospace',
      fontSize: 12,
      color: 'var(--accent)'
    }
  }, u.username), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement(Chip, {
    color: u.role === 'Admin' ? 'var(--amber)' : 'var(--accent)'
  }, u.role)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      borderBottom: '1px solid var(--border)',
      fontSize: 12,
      color: 'var(--text-2)'
    }
  }, u.branchId || '—'), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      borderBottom: '1px solid var(--border)',
      fontSize: 12,
      color: 'var(--text-2)'
    }
  }, u.phone || '—'), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement(Chip, {
    color: u.status === 'Active' ? 'var(--green)' : 'var(--red)'
  }, u.status)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      borderBottom: '1px solid var(--border)',
      fontFamily: 'monospace',
      color: 'var(--text-3)',
      fontSize: 13
    }
  }, '•'.repeat(8)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    onClick: () => setEditing({
      ...u
    })
  }, /*#__PURE__*/React.createElement("img", {
    src: EditIcon,
    alt: "",
    style: {
      width: 14,
      height: 14,
      marginRight: 4,
      verticalAlign: 'middle'
    }
  }), "Edit"), u.role !== 'SupremeAdmin' && /*#__PURE__*/React.createElement(Btn, {
    variant: u.status === 'Active' ? 'danger' : 'ghost',
    size: "sm",
    onClick: () => handleToggle(u.id)
  }, u.status === 'Active' ? 'Suspend' : 'Activate'), u.role !== 'SupremeAdmin' && /*#__PURE__*/React.createElement(Btn, {
    variant: "danger",
    size: "sm",
    onClick: () => handleDelete(u.id)
  }, "\u2715"))))))))), /*#__PURE__*/React.createElement(Modal, {
    title: ` Edit — ${editing?.name}`,
    open: !!editing,
    onClose: () => setEditing(null)
  }, editing && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Inp, {
    label: "Full Name",
    value: editing.name || '',
    onChange: e => setEditing(p => ({
      ...p,
      name: e.target.value
    }))
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "Username",
    value: editing.username || '',
    onChange: e => setEditing(p => ({
      ...p,
      username: e.target.value
    }))
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "Phone",
    value: editing.phone || '',
    onChange: e => setEditing(p => ({
      ...p,
      phone: e.target.value
    }))
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "New Password (blank = keep current)",
    type: "password",
    value: editing._newPwd || '',
    onChange: e => setEditing(p => ({
      ...p,
      _newPwd: e.target.value
    }))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    full: true,
    onClick: handleUpdate
  }, /*#__PURE__*/React.createElement("img", {
    src: SaveIcon,
    alt: "",
    style: {
      width: 14,
      height: 14,
      marginRight: 6,
      verticalAlign: 'middle'
    }
  }), "Save"), /*#__PURE__*/React.createElement(Btn, {
    full: true,
    variant: "ghost",
    onClick: () => setEditing(null)
  }, "Cancel")))));
};

// ═══════════════════════════════════════════════════════════
// PACKAGES PAGE
// ═══════════════════════════════════════════════════════════
export const Packages = ({
  packages,
  sessions,
  inventory,
  createPackage,
  updatePackage,
  deletePackage,
  notify,
  onNav,
  branchSubscription
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [newP, setNewP] = useState({
    name: '',
    desc: '',
    price: '',
    time: '',
    color: '#22d3ee',
    products: []
  });
  const [scannerTarget, setScannerTarget] = useState(null); // 'new' | 'edit' | null
  const setN = (k, v) => setNewP(p => ({
    ...p,
    [k]: v
  }));
  const handleEditClick = pkg => {
    let prods = [];
    if (pkg.products) {
      try {
        prods = JSON.parse(pkg.products);
      } catch (e) {
        console.error("Failed to parse package products", e);
      }
    }
    setEditing({
      ...pkg,
      products: prods
    });
  };
  const handleAddOpen = () => {
    setNewP({
      name: '',
      desc: '',
      price: '',
      time: '',
      color: '#22d3ee',
      products: []
    });
    setShowAdd(true);
  };
  const handleAdd = async () => {
    if (!newP.name || !newP.price) {
      notify('Name and price are required', 'error');
      return;
    }
    try {
      await createPackage({
        name: newP.name,
        desc: newP.desc,
        price: Number(newP.price),
        time: newP.time,
        color: newP.color,
        products: JSON.stringify(newP.products || [])
      });
      setNewP({
        name: '',
        desc: '',
        price: '',
        time: '',
        color: '#22d3ee',
        products: []
      });
      setShowAdd(false);
      notify('Package added!');
    } catch (err) {
      notify(err.message || 'Failed to add package', 'error');
    }
  };
  const handleUpdate = async () => {
    try {
      await updatePackage(editing.id, {
        name: editing.name,
        desc: editing.desc,
        price: Number(editing.price),
        time: editing.time,
        color: editing.color,
        products: JSON.stringify(editing.products || [])
      });
      setEditing(null);
      notify(' Package updated!');
    } catch (err) {
      notify(err.message || 'Failed to update package', 'error');
    }
  };
  const handleDelete = async id => {
    try {
      await deletePackage(id);
      notify(' Package removed!');
    } catch (err) {
      notify(err.message || 'Failed to delete package', 'error');
    }
  };

  // --- Sub-form Handlers ---
  const handleSelectProduct = (val, target) => {
    if (!val) return;
    const item = (inventory || []).find(i => i.id === val);
    if (!item) return;
    const state = target === 'new' ? newP : editing;
    const exists = (state.products || []).find(p => p.id === item.id);
    if (exists) {
      notify(`⚠️ ${item.name} is already attached.`, 'warn');
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
      setNewP(prev => ({
        ...prev,
        products: updatedProds
      }));
    } else {
      setEditing(prev => ({
        ...prev,
        products: updatedProds
      }));
    }
    notify(`✓ Attached ${item.name}!`);
  };
  const addPlaceholder = target => {
    const state = target === 'new' ? newP : editing;
    const updatedProds = [...(state.products || []), {
      id: 'custom_' + Date.now() + Math.random().toString(36).slice(2, 6),
      name: '',
      quantity: 1,
      price: 0,
      isCustom: true
    }];
    if (target === 'new') {
      setNewP(prev => ({
        ...prev,
        products: updatedProds
      }));
    } else {
      setEditing(prev => ({
        ...prev,
        products: updatedProds
      }));
    }
  };
  const updateProduct = (index, field, value, target) => {
    const state = target === 'new' ? newP : editing;
    const updated = [...(state.products || [])];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    if (target === 'new') {
      setNewP(prev => ({
        ...prev,
        products: updated
      }));
    } else {
      setEditing(prev => ({
        ...prev,
        products: updated
      }));
    }
  };
  const deleteProduct = (index, target) => {
    const state = target === 'new' ? newP : editing;
    const updated = (state.products || []).filter((_, i) => i !== index);
    if (target === 'new') {
      setNewP(prev => ({
        ...prev,
        products: updated
      }));
    } else {
      setEditing(prev => ({
        ...prev,
        products: updated
      }));
    }
  };
  const handleBarcodeConfirm = code => {
    if (!code) return;
    const item = (inventory || []).find(i => i.barcode && String(i.barcode) === code || String(i.id) === code);
    if (!item) {
      notify(`❌ Product not found in inventory for barcode: ${code}. Try adding it as a placeholder.`, 'error');
      setScannerTarget(null);
      return;
    }
    const state = scannerTarget === 'new' ? newP : editing;
    const exists = (state.products || []).find(p => p.id === item.id);
    if (exists) {
      notify(`⚠️ ${item.name} is already attached.`, 'warn');
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
      setNewP(prev => ({
        ...prev,
        products: updatedProds
      }));
    } else {
      setEditing(prev => ({
        ...prev,
        products: updatedProds
      }));
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
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 22,
        marginBottom: 16,
        borderTop: '1px dashed var(--border)',
        paddingTop: 18
      }
    }, /*#__PURE__*/React.createElement("label", {
      style: {
        display: 'block',
        fontSize: 11,
        fontWeight: 800,
        color: 'var(--text-3)',
        textTransform: 'uppercase',
        marginBottom: 10,
        letterSpacing: '0.06em'
      }
    }, "Products Consumed / Attached Products"), prods.length === 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '16px',
        background: 'var(--bg-3)',
        borderRadius: 12,
        border: '1.5px dashed var(--border)',
        color: 'var(--text-3)',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 14
      }
    }, "No products attached yet. Scan, choose from dropdown, or add placeholder.") : /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1.2fr auto',
        gap: 8,
        marginBottom: 6,
        padding: '0 4px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: 'var(--text-3)',
        textTransform: 'uppercase'
      }
    }, "Product Name"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: 'var(--text-3)',
        textTransform: 'uppercase'
      }
    }, "Washes Count"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: 'var(--text-3)',
        textTransform: 'uppercase'
      }
    }, "Price (RM)"), /*#__PURE__*/React.createElement("span", {
      style: {
        width: 28
      }
    })), prods.map((item, index) => /*#__PURE__*/React.createElement("div", {
      key: item.id,
      style: {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1.2fr auto',
        gap: 8,
        alignItems: 'center',
        marginBottom: 8
      }
    }, item.isCustom ? /*#__PURE__*/React.createElement("input", {
      type: "text",
      placeholder: "Custom item name...",
      value: item.name,
      onChange: e => updateProduct(index, 'name', e.target.value, target),
      style: customInputStyle
    }) : /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--text)',
        padding: '8px 10px',
        background: 'var(--bg)',
        borderRadius: 8,
        border: '1.5px solid var(--border)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: 6
      },
      title: item.name
    }, /*#__PURE__*/React.createElement("img", {
      src: BoxIcon,
      alt: "",
      style: {
        width: 14,
        height: 14
      }
    }), " ", item.name), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "number",
      min: "0.1",
      step: "any",
      placeholder: "Washes",
      value: item.quantity,
      onChange: e => updateProduct(index, 'quantity', Number(e.target.value), target),
      style: customInputStyle
    }), !item.isCustom && (() => {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 10,
          color: 'var(--amber)',
          fontWeight: 600,
          lineHeight: 1.1
        }
      }, "~ ", item.quantity, " washes to reduce the 1 stock");
    })()), /*#__PURE__*/React.createElement("input", {
      type: "number",
      min: "0",
      step: "any",
      placeholder: "Price",
      value: item.price,
      onChange: e => updateProduct(index, 'price', Number(e.target.value), target),
      style: customInputStyle
    }), /*#__PURE__*/React.createElement(Btn, {
      variant: "danger",
      size: "sm",
      onClick: () => deleteProduct(index, target),
      style: {
        padding: '8px 10px',
        height: '100%',
        minWidth: 32
      }
    }, "\u2715")))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement(Dropdown, {
      onChange: v => handleSelectProduct(v, target),
      value: "",
      options: [{
        value: "",
        label: "— Attach Product —"
      }, ...(inventory || []).map(i => ({
        value: i.id,
        label: `${i.name} (Stock: ${i.quantity} · RM ${i.price || i.cost})`
      }))],
      style: {
        flex: 1,
        minWidth: 160
      }
    }), branchSubscription?.has_ai_scanning !== false && /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      size: "sm",
      onClick: () => setScannerTarget(target),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px'
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: BarcodeScannerIcon,
      alt: "",
      style: {
        width: 14,
        height: 14
      }
    }), " Scan Barcode"), /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      size: "sm",
      onClick: () => addPlaceholder(target),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px'
      }
    }, "+ Add Placeholder")));
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      color: 'var(--text-2)'
    }
  }, packages.length, " packages \u2014 changes reflect immediately in Washer App"), /*#__PURE__*/React.createElement(Btn, {
    onClick: handleAddOpen
  }, "+ Add Package")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))',
      gap: 14
    }
  }, packages.map(pkg => {
    const count = sessions.filter(s => s.package?.id === pkg.id).length;
    const rev = sessions.filter(s => s.package?.id === pkg.id).reduce((a, s) => a + (s.total || 0), 0);
    let attachedCount = 0;
    if (pkg.products) {
      try {
        const list = JSON.parse(pkg.products);
        if (Array.isArray(list)) attachedCount = list.length;
      } catch (e) {}
    }
    return /*#__PURE__*/React.createElement(Card, {
      key: pkg.id,
      accent: pkg.color
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 800,
        fontSize: 16,
        color: 'var(--text)'
      }
    }, pkg.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 900,
        fontSize: 20,
        color: pkg.color
      }
    }, "RM ", pkg.price)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'var(--text-2)',
        marginBottom: 12
      }
    }, pkg.desc), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        marginBottom: 14,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        background: `${pkg.color}15`,
        color: pkg.color,
        borderRadius: 6,
        padding: '3px 9px',
        fontSize: 11,
        fontWeight: 600,
        border: `1px solid ${pkg.color}30`
      }
    }, "\u23F1 ", pkg.time), /*#__PURE__*/React.createElement("span", {
      style: {
        background: 'var(--bg-3)',
        color: 'var(--text-2)',
        borderRadius: 6,
        padding: '3px 9px',
        fontSize: 11,
        fontWeight: 600
      }
    }, count, " uses \xB7 RM ", rev), attachedCount > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        background: 'rgba(59,130,246,0.1)',
        color: 'var(--accent)',
        borderRadius: 6,
        padding: '3px 9px',
        fontSize: 11,
        fontWeight: 600,
        border: '1px solid rgba(59,130,246,0.2)'
      }
    }, attachedCount, " products")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      size: "sm",
      style: {
        flex: 1
      },
      onClick: () => handleEditClick(pkg)
    }, /*#__PURE__*/React.createElement("img", {
      src: EditIcon,
      alt: "",
      style: {
        width: 14,
        height: 14,
        marginRight: 4,
        verticalAlign: 'middle'
      }
    }), "Edit"), /*#__PURE__*/React.createElement(Btn, {
      variant: "danger",
      size: "sm",
      onClick: () => handleDelete(pkg.id)
    }, /*#__PURE__*/React.createElement("img", {
      src: DeleteIcon,
      alt: "",
      style: {
        width: 14,
        height: 14
      }
    }))));
  })), /*#__PURE__*/React.createElement(Modal, {
    title: "\u2795 New Package",
    open: showAdd,
    onClose: () => setShowAdd(false)
  }, /*#__PURE__*/React.createElement(Inp, {
    label: "Package Name *",
    value: newP.name,
    onChange: e => setN('name', e.target.value),
    placeholder: "e.g. Foam Wash"
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "Description",
    value: newP.desc,
    onChange: e => setN('desc', e.target.value),
    placeholder: "Short description"
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "Price (RM) *",
    value: newP.price,
    onChange: e => setN('price', e.target.value),
    type: "number",
    placeholder: "0"
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "Duration",
    value: newP.time,
    onChange: e => setN('time', e.target.value),
    placeholder: "e.g. 30 min"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "pkg-color",
    style: {
      display: 'block',
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--text-3)',
      textTransform: 'uppercase',
      marginBottom: 5
    }
  }, "COLOUR"), /*#__PURE__*/React.createElement("input", {
    id: "pkg-color",
    name: "pkgColor",
    type: "color",
    value: newP.color,
    onChange: e => setN('color', e.target.value),
    style: {
      width: '100%',
      height: 42,
      border: 'none',
      borderRadius: 10,
      cursor: 'pointer',
      background: 'transparent'
    }
  })), renderProductsSubform(newP, 'new'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    full: true,
    onClick: handleAdd
  }, /*#__PURE__*/React.createElement("img", {
    src: SaveIcon,
    alt: "",
    style: {
      width: 14,
      height: 14,
      marginRight: 6,
      verticalAlign: 'middle'
    }
  }), "Save Package"), /*#__PURE__*/React.createElement(Btn, {
    full: true,
    variant: "ghost",
    onClick: () => setShowAdd(false)
  }, "Cancel"))), /*#__PURE__*/React.createElement(Modal, {
    title: ` Edit — ${editing?.name}`,
    open: !!editing,
    onClose: () => setEditing(null)
  }, editing && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Inp, {
    label: "Name",
    value: editing.name,
    onChange: e => setEditing(p => ({
      ...p,
      name: e.target.value
    }))
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "Desc",
    value: editing.desc,
    onChange: e => setEditing(p => ({
      ...p,
      desc: e.target.value
    }))
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "Price",
    value: editing.price,
    onChange: e => setEditing(p => ({
      ...p,
      price: Number(e.target.value)
    })),
    type: "number"
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "Duration",
    value: editing.time,
    onChange: e => setEditing(p => ({
      ...p,
      time: e.target.value
    }))
  }), renderProductsSubform(editing, 'edit'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    full: true,
    onClick: handleUpdate
  }, "Save Changes"), /*#__PURE__*/React.createElement(Btn, {
    full: true,
    variant: "ghost",
    onClick: () => setEditing(null)
  }, "Cancel")))), scannerTarget && /*#__PURE__*/React.createElement(BarcodeScanner, {
    onClose: () => setScannerTarget(null),
    onConfirm: handleBarcodeConfirm
  }));
};

// ═══════════════════════════════════════════════════════════
// QR MANAGER PAGE
// ═══════════════════════════════════════════════════════════
export const PaymentSettings = ({
  qr,
  updateQr,
  notify,
  currentUser
}) => {
  const [localQr, setLocalQr] = useState({
    upi_id: qr?.upi_id || (typeof qr === 'string' ? qr : ''),
    payee_name: qr?.payee_name || 'WashPro Payment'
  });
  const handleSave = async () => {
    try {
      await updateQr(localQr);
      notify('QR settings updated!');
    } catch (err) {
      notify(err.message || 'Failed to update settings', 'error');
    }
  };
  const getUpiString = () => `upi://pay?pa=${localQr.upi_id}&pn=${encodeURIComponent(localQr.payee_name)}`;
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(getUpiString())}`;
    a.download = 'washpro-upi-qr.png';
    a.click();
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 800
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 6px',
      fontSize: 17,
      fontWeight: 800,
      color: 'var(--text)'
    }
  }, "Dynamic UPI QR Code"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 22px',
      fontSize: 13,
      color: 'var(--text-2)'
    }
  }, currentUser?.role === 'SupremeAdmin' ? 'Configure your Global Subscription UPI details here. A dynamic QR code will be generated for branch admins during subscription payment.' : 'Configure your Branch UPI details here. A dynamic QR code (with amount) will be generated for customers during checkout.'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 24,
      flexWrap: 'wrap',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#f0fdf4',
      borderRadius: 16,
      padding: 14,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getUpiString())}&color=0a1020&bgcolor=f0fdf4`,
    alt: "UPI QR Code Preview",
    style: {
      display: 'block',
      borderRadius: 8
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 220
    }
  }, /*#__PURE__*/React.createElement(Inp, {
    label: "Merchant UPI ID",
    value: localQr.upi_id,
    onChange: e => setLocalQr(p => ({
      ...p,
      upi_id: e.target.value
    })),
    placeholder: "e.g. merchant@upi"
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "Payee Name",
    value: localQr.payee_name,
    onChange: e => setLocalQr(p => ({
      ...p,
      payee_name: e.target.value
    })),
    placeholder: "e.g. WashPro Payment"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 16px',
      fontSize: 12,
      color: 'var(--text-3)'
    }
  }, "Edit to update the QR preview instantly."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(34,197,94,0.1)',
      border: '1px solid rgba(34,197,94,0.25)',
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 12,
      color: 'var(--green)',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: ActiveIcon,
    alt: "",
    style: {
      width: 14,
      height: 14
    }
  }), currentUser?.role === 'SupremeAdmin' ? 'Live — displayed to branch admins during subscription payment.' : 'Live — displayed to customers in the Washer App payment step.'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: handleDownload,
    style: {
      color: '#da1a32'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: DownloadIcon,
    alt: "",
    style: {
      width: 14,
      height: 14,
      marginRight: 4,
      verticalAlign: 'middle'
    }
  }), "Download QR Preview"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      padding: 10,
      background: 'var(--card)',
      borderRadius: 14,
      border: '1.5px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    full: true,
    onClick: handleSave,
    style: {
      color: '#da1a32',
      background: 'white'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: SaveIcon,
    alt: "",
    style: {
      width: 14,
      height: 14,
      marginRight: 4,
      verticalAlign: 'middle'
    }
  }), "Save QR Settings")));
};

// ═══════════════════════════════════════════════════════════
// BANK TRANSFER SETTINGS PAGE
// ═══════════════════════════════════════════════════════════
export const BankTransferSettings = ({
  notify,
  currentUser
}) => {
  const [bank, setBank] = useState({
    bankName: '',
    accountNumber: '',
    accountHolder: ''
  });
  const [loading, setLoading] = useState(true);
  React.useEffect(() => {
    API.settings.getBankDetails().then(data => setBank(data || {
      bankName: '',
      accountNumber: '',
      accountHolder: ''
    })).catch(() => setBank({
      bankName: '',
      accountNumber: '',
      accountHolder: ''
    })).finally(() => setLoading(false));
  }, [currentUser]);
  const handleSave = async () => {
    try {
      await API.settings.setBankDetails(bank);
      notify('Bank transfer settings updated!');
    } catch (err) {
      notify(err.message || 'Failed to update settings', 'error');
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 800
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 6px',
      fontSize: 17,
      fontWeight: 800,
      color: 'var(--text)'
    }
  }, "Bank Transfer Details"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 22px',
      fontSize: 13,
      color: 'var(--text-2)'
    }
  }, currentUser?.role === 'SupremeAdmin' ? 'These details are displayed to users when they choose "Manual Transfer" for subscription upgrades or branch registration.' : 'These details are displayed to customers in the Washer App during checkout.'), loading ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-3)'
    }
  }, "Loading...") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      maxWidth: 400
    }
  }, /*#__PURE__*/React.createElement(Inp, {
    label: "Bank Name",
    value: bank.bankName,
    onChange: e => setBank(b => ({
      ...b,
      bankName: e.target.value
    })),
    placeholder: "e.g. Maybank"
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "Account Number",
    value: bank.accountNumber,
    onChange: e => setBank(b => ({
      ...b,
      accountNumber: e.target.value
    })),
    placeholder: "e.g. 1234 5678 9012"
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "Account Holder Name",
    value: bank.accountHolder,
    onChange: e => setBank(b => ({
      ...b,
      accountHolder: e.target.value
    })),
    placeholder: "e.g. RWash360 Sdn Bhd"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      padding: 10,
      background: 'var(--card)',
      borderRadius: 14,
      border: '1.5px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    full: true,
    onClick: handleSave,
    style: {
      color: '#da1a32',
      background: 'white'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: SaveIcon,
    alt: "",
    style: {
      width: 14,
      height: 14,
      marginRight: 4,
      verticalAlign: 'middle'
    }
  }), "Save Bank Details")));
};

// ═══════════════════════════════════════════════════════════
// PAYMENT GATEWAY SETTINGS PAGE
// ═══════════════════════════════════════════════════════════
export const PaymentGatewaySettings = ({
  notify,
  currentUser
}) => {
  const [razorpay, setRazorpay] = useState({
    key_id: '',
    key_secret: ''
  });
  const [loading, setLoading] = useState(true);
  React.useEffect(() => {
    const fetchGateway = currentUser?.role === 'SupremeAdmin' ? API.settings.getSupremeRazorpay() : API.settings.getRazorpay();
    fetchGateway.then(data => setRazorpay(data || {
      key_id: '',
      key_secret: ''
    })).catch(() => setRazorpay({
      key_id: '',
      key_secret: ''
    })).finally(() => setLoading(false));
  }, [currentUser]);
  const handleSave = async () => {
    try {
      if (currentUser?.role === 'SupremeAdmin') {
        await API.settings.setSupremeRazorpay(razorpay);
      } else {
        await API.settings.setRazorpay(razorpay);
      }
      if (razorpay.key_secret && razorpay.key_secret !== '••••••••') {
        setRazorpay(prev => ({
          ...prev,
          key_secret: '••••••••'
        }));
      }
      notify('Payment gateway settings updated!');
    } catch (err) {
      notify(err.message || 'Failed to update settings', 'error');
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 800
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 6px',
      fontSize: 17,
      fontWeight: 800,
      color: 'var(--text)'
    }
  }, "Razorpay Configuration"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 22px',
      fontSize: 13,
      color: 'var(--text-2)'
    }
  }, currentUser?.role === 'SupremeAdmin' ? 'These keys are used to collect payments for Retailer subscription upgrades.' : 'These keys are used to collect online payments from your customers during wash checkout.'), loading ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-3)'
    }
  }, "Loading...") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      maxWidth: 400
    }
  }, /*#__PURE__*/React.createElement(Inp, {
    label: "Razorpay Key ID",
    value: razorpay.key_id,
    onChange: e => setRazorpay(b => ({
      ...b,
      key_id: e.target.value
    })),
    placeholder: "rzp_live_xxx..."
  }), /*#__PURE__*/React.createElement(Inp, {
    label: "Razorpay Key Secret",
    value: razorpay.key_secret,
    onChange: e => setRazorpay(b => ({
      ...b,
      key_secret: e.target.value
    })),
    placeholder: "Enter your secret key",
    type: "password"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      padding: 10,
      background: 'var(--card)',
      borderRadius: 14,
      border: '1.5px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    full: true,
    onClick: handleSave,
    style: {
      color: '#da1a32',
      background: 'white'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: SaveIcon,
    alt: "",
    style: {
      width: 14,
      height: 14,
      marginRight: 4,
      verticalAlign: 'middle'
    }
  }), "Save Payment Gateway")));
};

// ═══════════════════════════════════════════════════════════
// REPORTS PAGE
// ═══════════════════════════════════════════════════════════
export const Reports = ({
  sessions,
  packages,
  branches,
  onNav
}) => {
  const [periodFilt, setPeriodFilt] = useState('All');
  const [branchFilt, setBranchFilt] = useState('All');
  const [customDate, setCustomDate] = useState('');
  const parseDate = dStr => {
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
  filteredSessions.forEach(s => {
    if (!washerMap[s.washer]) washerMap[s.washer] = {
      s: 0,
      r: 0
    };
    washerMap[s.washer].s++;
    washerMap[s.washer].r += s.total || 0;
  });
  const branchRev = branches.map(b => ({
    name: b.name.split('–')[0].trim(),
    revenue: filteredSessions.filter(s => s.branchId === b.id).reduce((a, s) => a + (s.total || 0), 0),
    count: filteredSessions.filter(s => s.branchId === b.id).length
  }));
  const exportCSV = () => {
    const h = 'Invoice,Date,Branch,Washer,Package,Amount,Payment\n';
    const rows = filteredSessions.map(s => [s.id, `"${s.date}"`, s.branchId || '', s.washer, s.package?.name, s.total, s.payment?.mode].join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([h + rows], {
      type: 'text/csv'
    }));
    a.download = `washpro-report-${periodFilt}-${branchFilt}.csv`;
    a.click();
  };
  const dailyRevMap = {};
  const monthlyRevMap = {};
  filteredSessions.forEach(s => {
    if (!s.date) return;
    const dayStr = s.date.split(',')[0].trim();
    const parts = dayStr.split(/[\/\-]/);
    let monthStr = dayStr;
    if (parts.length === 3) {
      if (parts[0].length === 4) monthStr = `${parts[0]}-${parts[1]}`;else monthStr = `${parts[2]}-${parts[1]}`; // assumes DD/MM/YYYY
    }
    if (!dailyRevMap[dayStr]) dailyRevMap[dayStr] = 0;
    dailyRevMap[dayStr] += s.total || 0;
    if (!monthlyRevMap[monthStr]) monthlyRevMap[monthStr] = 0;
    monthlyRevMap[monthStr] += s.total || 0;
  });
  const dailyData = Object.entries(dailyRevMap).map(([d, r]) => ({
    name: d,
    revenue: r
  })).slice(-14);
  const monthlyData = Object.entries(monthlyRevMap).map(([m, r]) => ({
    name: m,
    revenue: r
  })).sort((a, b) => a.name.localeCompare(b.name));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginBottom: 16,
      flexWrap: 'wrap',
      alignItems: 'center',
      background: 'var(--card)',
      padding: '12px 16px',
      borderRadius: 14,
      border: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--text-2)',
      marginRight: 6
    }
  }, "Filters:"), /*#__PURE__*/React.createElement(Dropdown, {
    value: periodFilt,
    onChange: setPeriodFilt,
    options: [{
      value: 'All',
      label: 'All Time'
    }, {
      value: 'Daily',
      label: 'Today (Daily)'
    }, {
      value: 'Weekly',
      label: 'This Week (Weekly)'
    }, {
      value: 'Monthly',
      label: 'This Month (Monthly)'
    }, {
      value: 'Custom',
      label: 'Custom Date'
    }],
    style: {
      minWidth: 160
    }
  }), periodFilt === 'Custom' && /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: customDate,
    onChange: e => setCustomDate(e.target.value),
    style: {
      padding: '8px 14px',
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'var(--bg-3)',
      color: 'var(--text)',
      fontFamily: 'inherit',
      fontSize: 13,
      outline: 'none',
      cursor: 'pointer'
    }
  }), branches.length > 1 && /*#__PURE__*/React.createElement(Dropdown, {
    value: branchFilt,
    onChange: setBranchFilt,
    options: [{
      value: 'All',
      label: 'All Branches'
    }, ...branches.map(b => ({
      value: b.id,
      label: b.name.split('–')[0].trim()
    }))],
    style: {
      minWidth: 160
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: exportCSV,
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: DownloadIcon,
    alt: "",
    style: {
      width: 14,
      height: 14,
      marginRight: 6
    }
  }), "Export CSV")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
      gap: 12,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: RevenueIcon,
      alt: "",
      style: {
        width: 24,
        height: 24
      }
    }),
    label: "Filtered Revenue",
    value: `RM ${totalRev.toLocaleString()}`,
    color: "var(--accent)"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: CarIcon,
      alt: "",
      style: {
        width: 24,
        height: 24
      }
    }),
    label: "Filtered Sessions",
    value: filteredSessions.length,
    color: "var(--accent-2)"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: ReceiptIcon,
      alt: "",
      style: {
        width: 24,
        height: 24
      }
    }),
    label: "Avg per Session",
    value: filteredSessions.length ? `RM ${Math.round(totalRev / filteredSessions.length)}` : 'RM 0',
    color: "var(--amber)"
  })), /*#__PURE__*/React.createElement("div", {
    className: "responsive-split-1-1",
    style: {
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 14px',
      fontSize: 15,
      fontWeight: 800,
      color: 'var(--text)'
    }
  }, "Revenue by Washer"), Object.keys(washerMap).length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: ChartIcon,
      alt: "",
      style: {
        width: 32,
        height: 32
      }
    }),
    title: "No data yet"
  }) : Object.entries(washerMap).sort((a, b) => b[1].r - a[1].r).map(([name, stat]) => /*#__PURE__*/React.createElement("div", {
    key: name,
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 5,
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text)'
    }
  }, name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      color: 'var(--accent)'
    }
  }, "RM ", stat.r, " \xB7 ", stat.s, " jobs")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-3)',
      borderRadius: 99,
      height: 7
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${Math.min(100, stat.r / (totalRev || 1) * 100)}%`,
      height: '100%',
      background: 'var(--accent)',
      borderRadius: 99
    }
  }))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 14px',
      fontSize: 15,
      fontWeight: 800,
      color: 'var(--text)'
    }
  }, "Revenue by Branch"), branchRev.every(b => b.revenue === 0) ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: BranchIcon,
      alt: "",
      style: {
        width: 32,
        height: 32
      }
    }),
    title: "No branch data yet"
  }) : branchRev.map((b, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 5,
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text)'
    }
  }, b.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      color: 'var(--green)'
    }
  }, "RM ", b.revenue, " \xB7 ", b.count, " jobs")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-3)',
      borderRadius: 99,
      height: 7
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${Math.min(100, b.revenue / (totalRev || 1) * 100)}%`,
      height: '100%',
      background: 'var(--accent)',
      borderRadius: 99
    }
  }))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 14px',
      fontSize: 15,
      fontWeight: 800,
      color: 'var(--text)'
    }
  }, "Daily Revenue"), filteredSessions.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: ChartIcon,
      alt: "",
      style: {
        width: 32,
        height: 32
      }
    }),
    title: "No session data yet"
  }) : /*#__PURE__*/React.createElement(ResponsiveContainer, {
    width: "100%",
    height: 220
  }, /*#__PURE__*/React.createElement(BarChart, {
    data: dailyData
  }, /*#__PURE__*/React.createElement(XAxis, {
    dataKey: "name",
    tick: {
      fill: 'var(--text-3)',
      fontSize: 11
    },
    axisLine: false,
    tickLine: false
  }), /*#__PURE__*/React.createElement(YAxis, {
    tick: {
      fill: 'var(--text-3)',
      fontSize: 10
    },
    axisLine: false,
    tickLine: false,
    tickFormatter: v => `RM${v}`
  }), /*#__PURE__*/React.createElement(Tooltip, {
    formatter: v => `RM ${v}`,
    contentStyle: {
      background: 'var(--bg-2)',
      border: '1px solid var(--border-2)',
      borderRadius: 10
    }
  }), /*#__PURE__*/React.createElement(Bar, {
    dataKey: "revenue",
    fill: "var(--accent)",
    radius: [5, 5, 0, 0]
  })))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 14px',
      fontSize: 15,
      fontWeight: 800,
      color: 'var(--text)'
    }
  }, "Monthly Revenue"), filteredSessions.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: ChartIcon,
      alt: "",
      style: {
        width: 32,
        height: 32
      }
    }),
    title: "No session data yet"
  }) : /*#__PURE__*/React.createElement(ResponsiveContainer, {
    width: "100%",
    height: 220
  }, /*#__PURE__*/React.createElement(BarChart, {
    data: monthlyData
  }, /*#__PURE__*/React.createElement(XAxis, {
    dataKey: "name",
    tick: {
      fill: 'var(--text-3)',
      fontSize: 11
    },
    axisLine: false,
    tickLine: false
  }), /*#__PURE__*/React.createElement(YAxis, {
    tick: {
      fill: 'var(--text-3)',
      fontSize: 10
    },
    axisLine: false,
    tickLine: false,
    tickFormatter: v => `RM${v}`
  }), /*#__PURE__*/React.createElement(Tooltip, {
    formatter: v => `RM ${v}`,
    contentStyle: {
      background: 'var(--bg-2)',
      border: '1px solid var(--border-2)',
      borderRadius: 10
    }
  }), /*#__PURE__*/React.createElement(Bar, {
    dataKey: "revenue",
    fill: "var(--accent)",
    radius: [5, 5, 0, 0]
  })))), /*#__PURE__*/React.createElement(Card, {
    style: {
      gridColumn: '1 / -1'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 14px',
      fontSize: 15,
      fontWeight: 800,
      color: 'var(--text)'
    }
  }, "Revenue by Package"), filteredSessions.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: SoapIcon,
      alt: "",
      style: {
        width: 32,
        height: 32
      }
    }),
    title: "No session data yet"
  }) : /*#__PURE__*/React.createElement(ResponsiveContainer, {
    width: "100%",
    height: 220
  }, /*#__PURE__*/React.createElement(BarChart, {
    data: packages.map(p => ({
      name: p.name,
      revenue: sessions.filter(s => s.package?.id === p.id).reduce((a, s) => a + (s.total || 0), 0)
    }))
  }, /*#__PURE__*/React.createElement(XAxis, {
    dataKey: "name",
    tick: {
      fill: 'var(--text-3)',
      fontSize: 11
    },
    axisLine: false,
    tickLine: false
  }), /*#__PURE__*/React.createElement(YAxis, {
    tick: {
      fill: 'var(--text-3)',
      fontSize: 10
    },
    axisLine: false,
    tickLine: false,
    tickFormatter: v => `RM${v}`
  }), /*#__PURE__*/React.createElement(Tooltip, {
    formatter: v => `RM ${v}`,
    contentStyle: {
      background: 'var(--bg-2)',
      border: '1px solid var(--border-2)',
      borderRadius: 10
    }
  }), /*#__PURE__*/React.createElement(Bar, {
    dataKey: "revenue",
    fill: "var(--accent)",
    radius: [5, 5, 0, 0]
  }))))));
};

// ═══════════════════════════════════════════════════════════
// LIVE MAP PAGE
// ═══════════════════════════════════════════════════════════
export const LiveMap = ({
  sessions,
  pendingJobs,
  branches,
  onNav
}) => {
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const [isGoogleMapsReady, setIsGoogleMapsReady] = useState(!!window.google?.maps);
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  useEffect(() => {
    if (!apiKey) {
      console.warn('Google Maps API key not found in environment variables');
      return;
    }
    if (!window.google?.maps) {
      if (!document.querySelector('#google-maps-script')) {
        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker`;
        script.async = true;
        script.defer = true;
        script.onload = () => setIsGoogleMapsReady(true);
        script.onerror = () => console.error('Failed to load Google Maps API');
        document.head.appendChild(script);
      }
    } else {
      setIsGoogleMapsReady(true);
    }
  }, [apiKey]);
  useEffect(() => {
    if (isGoogleMapsReady && mapRef.current && !mapInstance.current) {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: {
          lat: 3.1412,
          lng: 101.68653
        },
        // KL default
        zoom: 12,
        mapTypeId: 'roadmap',
        styles: [{
          elementType: 'geometry',
          stylers: [{
            color: '#242f3e'
          }]
        }, {
          elementType: 'labels.text.stroke',
          stylers: [{
            color: '#242f3e'
          }]
        }, {
          elementType: 'labels.text.fill',
          stylers: [{
            color: '#746855'
          }]
        }, {
          featureType: 'administrative.locality',
          elementType: 'labels.text.fill',
          stylers: [{
            color: '#d59563'
          }]
        }, {
          featureType: 'poi',
          elementType: 'labels.text.fill',
          stylers: [{
            color: '#d59563'
          }]
        }, {
          featureType: 'poi.park',
          elementType: 'geometry',
          stylers: [{
            color: '#263c3f'
          }]
        }, {
          featureType: 'road',
          elementType: 'geometry',
          stylers: [{
            color: '#38414e'
          }]
        }, {
          featureType: 'road',
          elementType: 'geometry.stroke',
          stylers: [{
            color: '#212a37'
          }]
        }, {
          featureType: 'road.highway',
          elementType: 'geometry',
          stylers: [{
            color: '#746855'
          }]
        }, {
          featureType: 'road.highway',
          elementType: 'geometry.stroke',
          stylers: [{
            color: '#1f2835'
          }]
        }, {
          featureType: 'road.local',
          elementType: 'labels.text.fill',
          stylers: [{
            color: '#9ca5b1'
          }]
        }, {
          featureType: 'transit',
          elementType: 'geometry',
          stylers: [{
            color: '#2f3948'
          }]
        }, {
          featureType: 'transit.station',
          elementType: 'labels.text.fill',
          stylers: [{
            color: '#d59563'
          }]
        }, {
          featureType: 'water',
          elementType: 'geometry',
          stylers: [{
            color: '#17263c'
          }]
        }, {
          featureType: 'water',
          elementType: 'labels.text.fill',
          stylers: [{
            color: '#515c6d'
          }]
        }, {
          featureType: 'water',
          elementType: 'labels.text.stroke',
          stylers: [{
            color: '#17263c'
          }]
        }]
      });
    }
  }, [isGoogleMapsReady]);
  useEffect(() => {
    if (!mapInstance.current || !window.google?.maps || !isGoogleMapsReady) return;

    // Remove old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    const activeJobs = (pendingJobs || []).filter(j => j.status !== 'Completed' && j.geo);
    if (activeJobs.length === 0) return;
    const bounds = new window.google.maps.LatLngBounds();
    let hasPoints = false;
    const seenCoords = {};
    const jitterAmount = 0.0002; // Roughly 20 meters

    activeJobs.forEach(s => {
      let lat = parseFloat(s.geo?.lat);
      let lng = parseFloat(s.geo?.lng);
      if (isNaN(lat) || isNaN(lng)) return;
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      if (seenCoords[key]) {
        const count = seenCoords[key];
        lat += Math.cos(count * Math.PI / 4) * jitterAmount * (Math.floor(count / 8) + 1);
        lng += Math.sin(count * Math.PI / 4) * jitterAmount * (Math.floor(count / 8) + 1);
        seenCoords[key]++;
      } else {
        seenCoords[key] = 1;
      }
      const position = {
        lat,
        lng
      };
      bounds.extend(position);
      hasPoints = true;

      // Create custom marker
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="14" fill="#da1a31" stroke="#ffffff" stroke-width="2"/>
        <circle cx="16" cy="16" r="6" fill="#ffffff"/>
      </svg>`;
      const marker = new window.google.maps.Marker({
        position,
        map: mapInstance.current,
        title: s.id,
        icon: {
          url: `data:image/svg+xml;base64,${btoa(svg)}`,
          scaledSize: new window.google.maps.Size(32, 32),
          anchor: new window.google.maps.Point(16, 16)
        }
      });

      // Create info window
      const infoContent = `
        <div style="color: #000; padding: 8px; font-family: sans-serif; text-align: left; min-width: 200px;">
          <div style="font-weight: 700; margin-bottom: 3px; font-size: 13px;">${s.id}</div>
          <div style="font-size: 12px; margin-bottom: 2px;">${s.vehicle?.colour || ''} ${s.vehicle?.make || ''} ${s.vehicle?.model || ''}</div>
          <div style="color: #da1a31; font-size: 11px;">📌 ${s.locationName || 'Unknown'}</div>
          <div style="font-size: 11px; margin-top: 3px; color: #666;">
            ${lat.toFixed(6)}, ${lng.toFixed(6)}
          </div>
        </div>
      `;
      const infoWindow = new window.google.maps.InfoWindow({
        content: infoContent,
        disableAutoPan: false
      });
      marker.addListener('click', () => {
        if (infoWindowRef.current) infoWindowRef.current.close();
        infoWindow.open(mapInstance.current, marker);
        infoWindowRef.current = infoWindow;
        setSelected(s);
      });
      marker.addListener('mouseover', () => {
        setHovered(s.id);
        if (infoWindowRef.current) infoWindowRef.current.close();
        infoWindow.open(mapInstance.current, marker);
        infoWindowRef.current = infoWindow;
      });
      marker.addListener('mouseout', () => {
        setHovered(null);
      });
      markersRef.current.push(marker);
    });
    if (hasPoints && markersRef.current.length > 0) {
      mapInstance.current.fitBounds(bounds, 50);
      // Add slight zoom adjustment
      const listener = mapInstance.current.addListener('bounds_changed', () => {
        if (mapInstance.current.getZoom() > 15) {
          mapInstance.current.setZoom(15);
        }
        window.google.maps.event.removeListener(listener);
      });
    }
  }, [pendingJobs, isGoogleMapsReady]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
      gap: 12,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: MapIcon,
      alt: "",
      style: {
        width: 24,
        height: 24
      }
    }),
    label: "GPS Points",
    value: sessions.length,
    color: "var(--accent)"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: ActiveIcon,
      alt: "",
      style: {
        width: 24,
        height: 24
      }
    }),
    label: "Completed",
    value: sessions.filter(s => s.status === 'Completed').length,
    color: "var(--green)"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: BranchIcon,
      alt: "",
      style: {
        width: 24,
        height: 24
      }
    }),
    label: "Branches",
    value: branches.length,
    color: "var(--accent-2)"
  })), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0,
      overflow: 'hidden',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 20px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 15,
      fontWeight: 800,
      color: 'var(--text)',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: MapIcon,
    alt: "",
    style: {
      width: 18,
      height: 18
    }
  }), "Live Session Map"), /*#__PURE__*/React.createElement(Chip, {
    color: "var(--green)"
  }, "\u25CF Live")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 360,
      background: '#0a1a0a',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: mapRef,
    style: {
      width: '100%',
      height: '100%'
    }
  }), (!pendingJobs || pendingJobs.filter(j => j.status !== 'Completed' && j.geo).length === 0) && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(10,26,10,0.6)',
      color: 'rgba(255,255,255,0.7)',
      fontSize: 13,
      zIndex: 10,
      pointerEvents: 'none'
    }
  }, "No active live jobs right now."))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 14px',
      fontSize: 15,
      fontWeight: 800,
      color: 'var(--text)'
    }
  }, "GPS Session Log"), /*#__PURE__*/React.createElement("div", {
    className: "table-responsive-wrapper"
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: 'var(--bg-3)'
    }
  }, ['Invoice', 'Washer', 'Vehicle', 'Location Name', 'Coordinates', 'Time'].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      textAlign: 'left',
      padding: '9px 13px',
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--text-3)',
      borderBottom: '1px solid var(--border)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      whiteSpace: 'nowrap'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, sessions.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 6,
    style: {
      padding: 30,
      textAlign: 'center',
      color: 'var(--text-3)',
      fontSize: 13
    }
  }, "No GPS data yet.")) : sessions.map(s => /*#__PURE__*/React.createElement(React.Fragment, {
    key: s.id
  }, /*#__PURE__*/React.createElement("tr", {
    onClick: () => setSelected(selected?.id === s.id ? null : s),
    style: {
      cursor: 'pointer',
      background: selected?.id === s.id ? 'var(--card-hover)' : ''
    },
    onMouseEnter: e => {
      if (selected?.id !== s.id) e.currentTarget.style.background = 'var(--card-hover)';
    },
    onMouseLeave: e => {
      if (selected?.id !== s.id) e.currentTarget.style.background = '';
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 13px',
      borderBottom: '1px solid var(--border)',
      color: 'var(--accent)',
      fontWeight: 700,
      fontSize: 13
    }
  }, s.id), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 13px',
      borderBottom: '1px solid var(--border)',
      fontSize: 13,
      color: 'var(--text)'
    }
  }, s.washer), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 13px',
      borderBottom: '1px solid var(--border)',
      fontSize: 13,
      color: 'var(--text)'
    }
  }, `${s.vehicle?.colour || ''} ${s.vehicle?.make || ''} ${s.vehicle?.model || ''}`.trim() || /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--amber)'
    }
  }, "\u2014")), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 13px',
      borderBottom: '1px solid var(--border)',
      fontSize: 12,
      color: 'var(--accent)'
    }
  }, s.locationName || /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-3)'
    }
  }, "\u2014")), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 13px',
      borderBottom: '1px solid var(--border)',
      fontFamily: 'monospace',
      fontSize: 10,
      color: 'var(--text-2)'
    }
  }, s.location), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 13px',
      borderBottom: '1px solid var(--border)',
      fontSize: 12,
      color: 'var(--text-2)'
    }
  }, s.date)), selected?.id === s.id && /*#__PURE__*/React.createElement("tr", {
    style: {
      background: 'var(--bg)'
    }
  }, /*#__PURE__*/React.createElement("td", {
    colSpan: 6,
    style: {
      padding: '20px',
      borderBottom: '1px solid var(--border)'
    }
  }, s.geo ? /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 500,
      background: 'var(--card)',
      padding: 16,
      borderRadius: 12,
      border: '1px solid var(--border)',
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg)',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 16,
      border: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("iframe", {
    title: "map",
    width: "100%",
    height: "150",
    frameBorder: "0",
    style: {
      border: 0,
      borderRadius: 10
    },
    src: `https://maps.google.com/maps?q=${parseFloat(s.geo.lat)},${parseFloat(s.geo.lng)}&t=&z=15&ie=UTF8&iwloc=&output=embed`
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-3)',
      borderRadius: 12,
      padding: '10px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--text-3)',
      letterSpacing: '0.04em'
    }
  }, "Coordinates"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 800,
      color: 'var(--text)'
    }
  }, parseFloat(s.geo.lat).toFixed(5), ", ", parseFloat(s.geo.lng).toFixed(5))))) : /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: 20,
      color: 'var(--text-3)'
    }
  }, "No GPS coordinates available for this session."))))))))));
};

// ═══════════════════════════════════════════════════════════
// LOYALTY SETTINGS PAGE
// ═══════════════════════════════════════════════════════════
export const LoyaltySettings = ({
  customers,
  sessions,
  loyalty,
  updateLoyalty,
  notify,
  onNav
}) => {
  const DEFAULT_CFG = {
    enabled: true,
    visitThreshold: 3,
    discountType: 'percent',
    discountValue: 10,
    alertMessage: 'Congratulations! You have earned a loyalty reward.',
    couponPrefix: 'WASH',
    validityDays: 30
  };
  const [cfg, setCfg] = React.useState({
    ...DEFAULT_CFG,
    ...loyalty
  });
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    if (loyalty && Object.keys(loyalty).length > 0) setCfg({
      ...DEFAULT_CFG,
      ...loyalty
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loyalty]);
  const set = (k, v) => setCfg(c => ({
    ...c,
    [k]: v
  }));
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateLoyalty(cfg);
      setSaved(true);
      notify('Loyalty settings saved!');
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      notify(err.message || 'Failed to save', 'error');
    }
    setSaving(false);
  };

  // Stats
  const eligibleNow = customers.filter(c => (c.visits?.length || 0) >= cfg.visitThreshold).length;
  const totalRedeemed = customers.reduce((a, c) => a + (c.couponsRedeemed || 0), 0);
  const recentCoupons = customers.flatMap(c => (c.couponHistory || []).map(h => ({
    ...h,
    customer: c.name,
    phone: c.phone
  }))).sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt)).slice(0, 10);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
      gap: 12,
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: EligibleIcon,
      alt: "",
      style: {
        width: 24,
        height: 24
      }
    }),
    label: "Eligible Now",
    value: eligibleNow,
    sub: `≥${cfg.visitThreshold} visits`,
    color: "var(--green)"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: RedeemIcon,
      alt: "",
      style: {
        width: 24,
        height: 24
      }
    }),
    label: "Total Redeemed",
    value: totalRedeemed,
    sub: "all time",
    color: "var(--accent)"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: GroupIcon,
      alt: "",
      style: {
        width: 24,
        height: 24
      }
    }),
    label: "Total Customers",
    value: customers.length,
    sub: "registered",
    color: "var(--accent-2)"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: CartIcon,
      alt: "",
      style: {
        width: 24,
        height: 24
      }
    }),
    label: "Total Sessions",
    value: sessions.length,
    sub: "all time",
    color: "var(--amber)"
  })), /*#__PURE__*/React.createElement("div", {
    className: "responsive-split-1-1",
    style: {
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 4px',
      fontSize: 16,
      fontWeight: 800,
      color: 'var(--text)'
    }
  }, "Loyalty Configuration"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 20px',
      fontSize: 13,
      color: 'var(--text-2)'
    }
  }, "Customise how the reward programme works"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: 'var(--bg-3)',
      borderRadius: 12,
      padding: '12px 14px',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 14,
      color: 'var(--text)'
    }
  }, "Enable Loyalty Programme"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-2)',
      marginTop: 2
    }
  }, "Show rewards in Washer App checkout")), /*#__PURE__*/React.createElement("div", {
    onClick: () => set('enabled', !cfg.enabled),
    style: {
      width: 48,
      height: 26,
      borderRadius: 99,
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      background: cfg.enabled ? 'var(--accent)' : 'var(--border-2)',
      position: 'relative',
      transition: 'background 0.2s'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 3,
      left: cfg.enabled ? 25 : 3,
      width: 20,
      height: 20,
      borderRadius: '50%',
      background: '#fff',
      transition: 'left 0.2s',
      boxShadow: '0 1px 4px rgba(0,0,0,0.25)'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      opacity: cfg.enabled ? 1 : 0.45,
      pointerEvents: cfg.enabled ? 'auto' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--text-3)',
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      marginBottom: 6
    }
  }, "Visits Required to Earn Reward"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, [2, 3, 4, 5, 6, 8, 10].map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    onClick: () => set('visitThreshold', n),
    style: {
      padding: '8px 14px',
      borderRadius: 9,
      border: `2px solid ${cfg.visitThreshold === n ? 'var(--accent)' : 'var(--border-2)'}`,
      background: cfg.visitThreshold === n ? 'var(--accent-dim)' : 'var(--bg-3)',
      color: cfg.visitThreshold === n ? 'var(--accent)' : 'var(--text-2)',
      fontWeight: cfg.visitThreshold === n ? 800 : 500,
      cursor: 'pointer',
      fontSize: 13,
      fontFamily: 'inherit'
    }
  }, n)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--text-3)',
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      marginBottom: 6
    }
  }, "Discount Type"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 10
    }
  }, [['percent', 'Percentage (%)'], ['fixed', 'Fixed Amount (RM)']].map(([v, l]) => /*#__PURE__*/React.createElement("button", {
    key: v,
    onClick: () => set('discountType', v),
    style: {
      flex: 1,
      padding: '10px',
      borderRadius: 10,
      border: `2px solid ${cfg.discountType === v ? 'var(--accent)' : 'var(--border-2)'}`,
      background: cfg.discountType === v ? 'var(--accent-dim)' : 'var(--bg-3)',
      color: cfg.discountType === v ? 'var(--accent)' : 'var(--text-2)',
      fontWeight: cfg.discountType === v ? 700 : 500,
      cursor: 'pointer',
      fontSize: 12,
      fontFamily: 'inherit'
    }
  }, l))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--text-3)',
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      marginBottom: 4
    }
  }, "Discount Value ", cfg.discountType === 'percent' ? '(%)' : '(RM)'), /*#__PURE__*/React.createElement("input", {
    id: "discount-value",
    name: "discountValue",
    type: "number",
    value: cfg.discountValue,
    min: 1,
    max: cfg.discountType === 'percent' ? 100 : 999,
    onChange: e => set('discountValue', Number(e.target.value)),
    style: {
      width: '100%',
      boxSizing: 'border-box',
      background: 'var(--bg-3)',
      border: '1px solid var(--border-2)',
      borderRadius: 10,
      padding: '10px 14px',
      color: 'var(--text)',
      fontSize: 15,
      fontFamily: 'inherit',
      fontWeight: 700,
      outline: 'none',
      marginBottom: 4
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--accent)',
      marginTop: 4
    }
  }, "Preview: ", cfg.discountType === 'percent' ? `${cfg.discountValue}% off any package` : `RM ${cfg.discountValue} off any package`)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--text-3)',
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      marginBottom: 4
    }
  }, "Coupon Code Prefix"), /*#__PURE__*/React.createElement("input", {
    id: "coupon-prefix",
    name: "couponPrefix",
    value: cfg.couponPrefix,
    onChange: e => set('couponPrefix', e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 8)),
    style: {
      width: '100%',
      boxSizing: 'border-box',
      background: 'var(--bg-3)',
      border: '1px solid var(--border-2)',
      borderRadius: 10,
      padding: '10px 14px',
      color: 'var(--text)',
      fontSize: 14,
      fontFamily: 'monospace',
      fontWeight: 700,
      outline: 'none',
      textTransform: 'uppercase'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-3)',
      marginTop: 4
    }
  }, "e.g. coupon will look like: ", cfg.couponPrefix, "-A12B-XY9Z")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--text-3)',
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      marginBottom: 4
    }
  }, "Coupon Validity (Days)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, [7, 14, 30, 60, 90].map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    onClick: () => set('validityDays', n),
    style: {
      padding: '8px 14px',
      borderRadius: 9,
      border: `2px solid ${cfg.validityDays === n ? 'var(--accent)' : 'var(--border-2)'}`,
      background: cfg.validityDays === n ? 'var(--accent-dim)' : 'var(--bg-3)',
      color: cfg.validityDays === n ? 'var(--accent)' : 'var(--text-2)',
      fontWeight: cfg.validityDays === n ? 800 : 500,
      cursor: 'pointer',
      fontSize: 13,
      fontFamily: 'inherit'
    }
  }, n, "d")))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--text-3)',
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      marginBottom: 4
    }
  }, "Reward Alert Message"), /*#__PURE__*/React.createElement("textarea", {
    id: "alert-message",
    name: "alertMessage",
    value: cfg.alertMessage,
    onChange: e => set('alertMessage', e.target.value),
    rows: 3,
    style: {
      width: '100%',
      boxSizing: 'border-box',
      background: 'var(--bg-3)',
      border: '1px solid var(--border-2)',
      borderRadius: 10,
      padding: '10px 14px',
      color: 'var(--text)',
      fontSize: 13,
      fontFamily: 'inherit',
      resize: 'vertical',
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-3)',
      marginTop: 4
    }
  }, "Shown to washer in checkout when customer is eligible"))), /*#__PURE__*/React.createElement(Btn, {
    full: true,
    onClick: handleSave,
    variant: saved ? 'success' : 'primary'
  }, saved ? 'Saved!' : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("img", {
    src: SaveIcon,
    alt: "",
    style: {
      width: 14,
      height: 14,
      marginRight: 6,
      verticalAlign: 'middle'
    }
  }), "Save Settings")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(0,212,188,0.08))',
      border: '1px solid rgba(34,197,94,0.3)',
      borderRadius: 14,
      padding: '14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      color: 'var(--green)',
      marginBottom: 6,
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: SearchIcon,
    alt: "",
    style: {
      width: 14,
      height: 14
    }
  }), "Washer App Preview"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-2)',
      marginBottom: 8
    }
  }, cfg.alertMessage), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Chip, {
    color: "var(--green)"
  }, cfg.discountType === 'percent' ? `${cfg.discountValue}% off` : `RM ${cfg.discountValue} off`), /*#__PURE__*/React.createElement(Chip, {
    color: "var(--accent)"
  }, "After ", cfg.visitThreshold, " visits"), /*#__PURE__*/React.createElement(Chip, {
    color: "var(--accent-2)"
  }, "Valid ", cfg.validityDays, " days")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 14px',
      fontSize: 15,
      fontWeight: 800,
      color: 'var(--text)'
    }
  }, "Recent Redemptions"), recentCoupons.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: RedeemIcon,
      alt: "",
      style: {
        width: 48,
        height: 48
      }
    }),
    title: "No coupons redeemed yet",
    sub: "Coupons appear here after checkout"
  }) : recentCoupons.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: 'var(--bg-3)',
      borderRadius: 12,
      padding: '12px 14px',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      color: 'var(--text)',
      fontFamily: 'monospace'
    }
  }, c.code), /*#__PURE__*/React.createElement(Chip, {
    color: "var(--green)",
    size: "sm"
  }, "Redeemed")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-2)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: WorkerIcon,
    alt: "",
    style: {
      width: 12,
      height: 12,
      marginRight: 4
    }
  }), " ", c.customer, " \xB7 ", c.phone), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-3)',
      marginTop: 3
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: calenderIcon,
    alt: "",
    style: {
      width: 12,
      height: 12,
      marginRight: 4
    }
  }), new Date(c.usedAt).toLocaleDateString('en-MY'))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 14px',
      fontSize: 15,
      fontWeight: 800,
      color: 'var(--text)'
    }
  }, "Top Loyal Customers"), customers.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: GroupIcon,
      alt: "",
      style: {
        width: 48,
        height: 48
      }
    }),
    title: "No customers yet"
  }) : customers.sort((a, b) => (b.visits?.length || 0) - (a.visits?.length || 0)).slice(0, 8).map((c, i) => {
    const visits = c.visits?.length || 0;
    const eligible = visits >= cfg.visitThreshold;
    return /*#__PURE__*/React.createElement("div", {
      key: c.id,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'linear-gradient(135deg,var(--accent),var(--accent-2))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        fontSize: 12,
        color: '#fff',
        flexShrink: 0
      }
    }, c.name.slice(0, 2).toUpperCase()), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: 13,
        color: 'var(--text)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, c.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--text-2)'
      }
    }, visits, " visits \xB7 RM ", c.totalSpend)), /*#__PURE__*/React.createElement(Chip, {
      color: eligible ? 'var(--green)' : 'var(--text-3)',
      size: "sm"
    }, eligible ? ' Eligible' : `${cfg.visitThreshold - visits} more`));
  })))));
};

// ═══════════════════════════════════════════════════════════
// SUBSCRIPTION PLANS PAGE (SUPREME ADMIN ONLY)
// ═══════════════════════════════════════════════════════════
export const SubscriptionPlans = ({
  plans,
  createPlan,
  updatePlan,
  deletePlan,
  notify,
  onNav
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [newPlan, setNewPlan] = useState({
    label: '',
    price: '',
    monthly_price: '',
    annual_price: '',
    duration: '',
    color: '#6366f1',
    max_washers: 0,
    max_sessions: 0,
    max_branches: 0,
    has_loyalty: false,
    has_qr: false,
    has_reports: false,
    has_ai_scanning: false,
    has_multiple_branches: false
  });
  const handleAddOpen = () => {
    setNewPlan({
      label: '',
      price: '',
      monthly_price: '',
      annual_price: '',
      duration: '',
      color: '#6366f1',
      max_washers: 0,
      max_sessions: 0,
      max_branches: 0,
      has_loyalty: false,
      has_qr: false,
      has_reports: false,
      has_ai_scanning: false,
      has_multiple_branches: false,
      has_payment_gateway: false
    });
    setShowAdd(true);
  };
  const handleEditClick = plan => {
    setEditing({
      ...plan,
      max_washers: plan.max_washers || 0,
      max_sessions: plan.max_sessions || 0,
      max_branches: plan.max_branches || 0,
      has_loyalty: !!plan.has_loyalty,
      has_qr: !!plan.has_qr,
      has_reports: !!plan.has_reports,
      has_ai_scanning: !!plan.has_ai_scanning,
      has_multiple_branches: !!plan.has_multiple_branches,
      has_payment_gateway: !!plan.has_payment_gateway
    });
  };
  const handleAdd = async () => {
    if (!newPlan.label || !newPlan.price || !newPlan.duration) {
      notify('Label, price, and duration are required', 'error');
      return;
    }
    try {
      await createPlan({
        label: newPlan.label,
        price: newPlan.price,
        monthly_price: Number(newPlan.monthly_price) || 0,
        annual_price: Number(newPlan.annual_price) || 0,
        duration: newPlan.duration,
        color: newPlan.color,
        max_washers: Number(newPlan.max_washers) || 0,
        max_sessions: Number(newPlan.max_sessions) || 0,
        max_branches: Number(newPlan.max_branches) || 0,
        has_loyalty: newPlan.has_loyalty,
        has_qr: newPlan.has_qr,
        has_reports: newPlan.has_reports,
        has_ai_scanning: newPlan.has_ai_scanning,
        has_multiple_branches: newPlan.has_multiple_branches,
        has_payment_gateway: newPlan.has_payment_gateway
      });
      setShowAdd(false);
      notify('Subscription Plan added!');
    } catch (err) {
      notify(err.message || 'Failed to add plan', 'error');
    }
  };
  const handleUpdate = async () => {
    try {
      await updatePlan(editing.id, {
        label: editing.label,
        price: editing.price,
        monthly_price: Number(editing.monthly_price) || 0,
        annual_price: Number(editing.annual_price) || 0,
        duration: editing.duration,
        color: editing.color,
        max_washers: Number(editing.max_washers) || 0,
        max_sessions: Number(editing.max_sessions) || 0,
        max_branches: Number(editing.max_branches) || 0,
        has_loyalty: editing.has_loyalty,
        has_qr: editing.has_qr,
        has_reports: editing.has_reports,
        has_ai_scanning: editing.has_ai_scanning,
        has_multiple_branches: editing.has_multiple_branches,
        has_payment_gateway: editing.has_payment_gateway
      });
      setEditing(null);
      notify('Subscription Plan updated!');
    } catch (err) {
      notify(err.message || 'Failed to update plan', 'error');
    }
  };
  const handleDelete = async id => {
    if (window.confirm("Are you sure you want to delete this subscription plan?")) {
      try {
        await deletePlan(id);
        notify('Subscription Plan removed!');
      } catch (err) {
        notify(err.message || 'Failed to delete plan', 'error');
      }
    }
  };
  const renderForm = isEdit => {
    const state = isEdit ? editing : newPlan;
    const setState = isEdit ? setEditing : setNewPlan;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(Inp, {
      label: "Plan Name",
      value: state.label,
      onChange: e => setState({
        ...state,
        label: e.target.value
      }),
      placeholder: "e.g. Pro Plan"
    }), /*#__PURE__*/React.createElement(Inp, {
      label: "Display Price",
      value: state.price,
      onChange: e => setState({
        ...state,
        price: e.target.value
      }),
      placeholder: "e.g. RM 99"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(Inp, {
      label: "Monthly Price (Number)",
      type: "number",
      value: state.monthly_price,
      onChange: e => setState({
        ...state,
        monthly_price: e.target.value
      })
    }), /*#__PURE__*/React.createElement(Inp, {
      label: "Annual Price (Number)",
      type: "number",
      value: state.annual_price,
      onChange: e => setState({
        ...state,
        annual_price: e.target.value
      })
    }), /*#__PURE__*/React.createElement(Inp, {
      label: "Duration",
      value: state.duration,
      onChange: e => setState({
        ...state,
        duration: e.target.value
      }),
      placeholder: "e.g. /month"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(Inp, {
      label: "Max Washers (0=\u221E)",
      type: "number",
      value: state.max_washers,
      onChange: e => setState({
        ...state,
        max_washers: e.target.value
      })
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(Inp, {
      label: "Max Sessions (0=\u221E)",
      type: "number",
      value: state.max_sessions,
      onChange: e => setState({
        ...state,
        max_sessions: e.target.value
      })
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(Inp, {
      label: "Max Branches (0=\u221E)",
      type: "number",
      value: state.max_branches,
      onChange: e => setState({
        ...state,
        max_branches: e.target.value
      })
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
      style: {
        display: 'block',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--text-3)',
        marginBottom: 6,
        textTransform: 'uppercase'
      }
    }, "Module Access"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("label", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        cursor: 'pointer',
        color: 'var(--text)'
      }
    }, /*#__PURE__*/React.createElement("input", {
      id: "plan-has-loyalty",
      name: "has_loyalty",
      type: "checkbox",
      checked: state.has_loyalty,
      onChange: e => setState({
        ...state,
        has_loyalty: e.target.checked
      })
    }), " Enable Loyalty Settings"), /*#__PURE__*/React.createElement("label", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        cursor: 'pointer',
        color: 'var(--text)'
      }
    }, /*#__PURE__*/React.createElement("input", {
      id: "plan-has-qr",
      name: "has_qr",
      type: "checkbox",
      checked: state.has_qr,
      onChange: e => setState({
        ...state,
        has_qr: e.target.checked
      })
    }), " Enable QR Manager"), /*#__PURE__*/React.createElement("label", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        cursor: 'pointer',
        color: 'var(--text)'
      }
    }, /*#__PURE__*/React.createElement("input", {
      id: "plan-has-reports",
      name: "has_reports",
      type: "checkbox",
      checked: state.has_reports,
      onChange: e => setState({
        ...state,
        has_reports: e.target.checked
      })
    }), " Enable Reports"), /*#__PURE__*/React.createElement("label", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        cursor: 'pointer',
        color: 'var(--text)'
      }
    }, /*#__PURE__*/React.createElement("input", {
      id: "plan-has-ai-scanning",
      name: "has_ai_scanning",
      type: "checkbox",
      checked: state.has_ai_scanning,
      onChange: e => setState({
        ...state,
        has_ai_scanning: e.target.checked
      })
    }), " AI Scanning"), /*#__PURE__*/React.createElement("label", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        cursor: 'pointer',
        color: 'var(--text)'
      }
    }, /*#__PURE__*/React.createElement("input", {
      id: "plan-has-multiple-branches",
      name: "has_multiple_branches",
      type: "checkbox",
      checked: state.has_multiple_branches,
      onChange: e => setState({
        ...state,
        has_multiple_branches: e.target.checked
      })
    }), " Enable Multiple Branches"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
      style: {
        display: 'block',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--text-3)',
        marginBottom: 6,
        textTransform: 'uppercase'
      }
    }, "Theme Color"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap'
      }
    }, ['#6366f1', '#059669', '#d97706', '#dc2626', '#3b82f6', '#8b5cf6'].map(c => /*#__PURE__*/React.createElement("div", {
      key: c,
      onClick: () => setState({
        ...state,
        color: c
      }),
      style: {
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: c,
        cursor: 'pointer',
        border: state.color === c ? '3px solid var(--text)' : '2px solid transparent',
        transition: 'all 0.15s'
      }
    }))))));
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 18,
      fontWeight: 800,
      color: 'var(--text)'
    }
  }, "Subscription Plans"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '3px 0 0',
      fontSize: 13,
      color: 'var(--text-3)'
    }
  }, "Manage platform subscription tiers for branches"))), /*#__PURE__*/React.createElement(Btn, {
    onClick: handleAddOpen
  }, "+ Add Plan")), plans.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    title: "No subscription plans",
    sub: "Click 'Add Plan' to create one."
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
      gap: 16
    }
  }, plans.map(p => {
    const feats = Array.isArray(p.features) ? p.features : [];
    return /*#__PURE__*/React.createElement(Card, {
      key: p.id,
      style: {
        borderTop: `4px solid ${p.color}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: '0 0 4px',
        fontSize: 16,
        fontWeight: 800,
        color: 'var(--text)'
      }
    }, p.label), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 20,
        fontWeight: 900,
        color: p.color
      }
    }, p.price), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: 'var(--text-3)',
        fontWeight: 600
      }
    }, p.duration)), (p.monthly_price > 0 || p.annual_price > 0) && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        marginTop: 6
      }
    }, p.monthly_price > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: 'var(--text-3)',
        background: 'var(--bg-3)',
        padding: '3px 8px',
        borderRadius: 6,
        fontWeight: 600
      }
    }, "RM", p.monthly_price, "/mo"), p.annual_price > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: 'var(--text-3)',
        background: 'var(--bg-3)',
        padding: '3px 8px',
        borderRadius: 6,
        fontWeight: 600
      }
    }, "RM", p.annual_price, "/yr"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      size: "sm",
      onClick: () => handleEditClick(p),
      style: {
        padding: 6,
        minWidth: 32
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: EditIcon,
      alt: "edit",
      style: {
        width: 14,
        height: 14
      }
    })), /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      size: "sm",
      onClick: () => handleDelete(p.id),
      style: {
        padding: 6,
        minWidth: 32
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: DeleteIcon,
      alt: "delete",
      style: {
        width: 14,
        height: 14
      }
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        borderTop: '1px solid var(--border)',
        paddingTop: 12,
        marginTop: 4
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--text-3)',
        textTransform: 'uppercase',
        marginBottom: 8
      }
    }, "Included Features"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'var(--text-2)',
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: p.color,
        fontWeight: 800
      }
    }, "\u2713"), " ", p.max_washers ? `${p.max_washers} Washers` : 'Unlimited Washers'), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'var(--text-2)',
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: p.color,
        fontWeight: 800
      }
    }, "\u2713"), " ", p.max_sessions ? `${p.max_sessions} Sessions/mo` : 'Unlimited Sessions'), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'var(--text-2)',
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: p.color,
        fontWeight: 800
      }
    }, "\u2713"), " ", p.max_branches ? `${p.max_branches} Branches` : 'Unlimited Branches'), p.has_loyalty && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'var(--text-2)',
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: p.color,
        fontWeight: 800
      }
    }, "\u2713"), " Loyalty Programme"), p.has_qr && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'var(--text-2)',
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: p.color,
        fontWeight: 800
      }
    }, "\u2713"), " QR Manager"), p.has_reports && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'var(--text-2)',
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: p.color,
        fontWeight: 800
      }
    }, "\u2713"), " Full Reports"), p.has_ai_scanning && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'var(--text-2)',
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: p.color,
        fontWeight: 800
      }
    }, "\u2713"), " AI Scanning"), p.has_multiple_branches && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'var(--text-2)',
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: p.color,
        fontWeight: 800
      }
    }, "\u2713"), " Multiple Branches"))));
  })), /*#__PURE__*/React.createElement(Modal, {
    title: "Add Subscription Plan",
    open: showAdd,
    onClose: () => setShowAdd(false),
    maxWidth: 500
  }, renderForm(false), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: handleAdd,
    style: {
      flex: 1
    }
  }, "Create Plan"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => setShowAdd(false)
  }, "Cancel"))), /*#__PURE__*/React.createElement(Modal, {
    title: "Edit Subscription Plan",
    open: !!editing,
    onClose: () => setEditing(null),
    maxWidth: 500
  }, editing && renderForm(true), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: handleUpdate,
    style: {
      flex: 1
    }
  }, "Save Changes"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => setEditing(null)
  }, "Cancel"))));
};