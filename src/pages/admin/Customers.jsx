import React, { useState } from 'react';
import { getCurrency } from '../../utils/messaging';
import { Card, StatCard, Chip, Btn, EmptyState, Inp , BackButton} from '../../components/common/UI';
import GroupIcon from '../../assets/icons/group-icon.png';
import ActiveIcon from '../../assets/icons/active-icon.png';
import RevenueIcon from '../../assets/icons/revenue-icon-vec.png';
import WalkInIcon from '../../assets/icons/walk-in-icon.png';
import EditIcon from '../../assets/icons/edit-icon.png';
import SearchIcon from '../../assets/icons/search-icon.png';
import CalendarIcon from '../../assets/icons/calendar-icon.png';
import CarIcon from '../../assets/icons/car-icon.png';
import WorkerIcon from '../../assets/icons/worker-icon.png';

export const Customers = ({customers, sessions, branches, updateCustomers, updateCustomer, notify, onNav, users = [], currentUser = {}}) => {
  const curr = getCurrency(currentUser?.phone);

  const [search,     setSearch]     = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [editNote,   setEditNote]   = useState('');
  const [editMode,   setEditMode]   = useState(false);
  const [saving,     setSaving]     = useState(false);

  const isSupremeAdmin = currentUser?.role === 'SupremeAdmin';

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return !q || ((c.name || '') + (c.phone || '') + (c.email || '')).toLowerCase().includes(q);
  });

  const getSuperAdminForCustomer = (c) => {
    if (!isSupremeAdmin) return null;
    const customerSession = sessions.find(s => 
      (c.phone && s.customer?.phone === c.phone) || 
      (c.id && s.customer?.id === c.id)
    );
    if (!customerSession) return null;
    const branch = branches.find(b => b.id === customerSession.branchId || b.id === customerSession.branch_id);
    if (!branch) return null;
    return users.find(u => u.role === 'SuperAdmin' && (u.id === branch.owner_id || u.branch_id === branch.id || u.branchId === branch.id));
  };

  // Always look up the selected customer from the LATEST data
  const selected = selectedId ? customers.find(c => c.id === selectedId) || null : null;

  const totalSpend   = customers.reduce((a, c) => a + (c.totalSpend || 0), 0);
  const returning    = customers.filter(c => (c.visits?.length || 0) > 1).length;
  const walkInSes    = sessions.filter(s => !s.customer?.phone).length;

  const handleSelect = (c) => {
    if (selectedId === c.id) {
      setSelectedId(null);
      setEditMode(false);
    } else {
      setSelectedId(c.id);
      setEditNote(c.notes || '');
      setEditMode(false);
    }
  };

  const saveNote = async () => {
    setSaving(true);
    try {
      if (updateCustomer) {
        await updateCustomer(selectedId, { notes: editNote });
      } else {
        const updated = customers.map(c => c.id === selectedId ? { ...c, notes: editNote } : c);
        updateCustomers(updated);
      }
      setEditMode(false);
      notify('✅ Note saved!');
    } catch (err) {
      notify('❌ Failed to save note: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard icon={<img src={GroupIcon} alt="" style={{ width: 24, height: 24 }} />} label="Total Customers"   value={customers.length}                          sub="registered" color="var(--accent)"   />
        <StatCard icon={<img src={ActiveIcon} alt="" style={{ width: 24, height: 24 }} />} label="Returning"         value={returning}                                 sub="2+ visits"  color="var(--accent-2)" />
        <StatCard icon={<img src={RevenueIcon} alt="" style={{ width: 24, height: 24 }} />} label="Customer Spend"    value={`${curr} ${totalSpend.toLocaleString()}`}       sub="all time"   color="var(--green)"    />
        <StatCard icon={<img src={WalkInIcon} alt="" style={{ width: 24, height: 24 }} />} label="Walk-ins"          value={walkInSes}                                 sub="no profile" color="var(--amber)"    />
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {/* Customer list */}
        <div style={{ flex: '1 1 320px', minWidth: 280 }}>
          <div style={{ marginBottom: 12 }}>
            <Inp
              id="search-customer"
              name="searchCustomer"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, phone, email…"
              icon={<img src={SearchIcon} alt="" style={{ width: 14, height: 14 }} />}
              style={{ margin: 0 }}
            />
          </div>

          {filtered.length === 0
            ? <EmptyState icon={<img src={GroupIcon} alt="" style={{ width: 48, height: 48 }} />} title="No customers yet" sub="Customers are created automatically when a phone number is entered during checkout" />
            : filtered.map(c => {
              const isActive = selectedId === c.id;
              return (
                <div key={c.id} onClick={() => handleSelect(c)}
                  style={{ background: isActive ? 'var(--accent-dim)' : 'var(--card)', border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 14, padding: '14px 16px', marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: '#fff', flexShrink: 0 }}>
                      {(c.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{c.phone}</div>
                      {isSupremeAdmin && (() => {
                        const sa = getSuperAdminForCustomer(c);
                        if (sa) {
                          return (
                            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <img src={GroupIcon} alt="" style={{ width: 10, height: 10, opacity: 0.6 }} />
                              Super Admin: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{sa.name || sa.username}</span> ({sa.phone || 'N/A'})
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--green)' }}>{curr} {c.totalSpend}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{c.visits?.length || 0} visits</div>
                    </div>
                  </div>
                  {isActive && (
                    <div onClick={e => e.stopPropagation()} style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--border)' }}>
                      {/* Stats */}
                      <div className="responsive-split-3" style={{ marginBottom: 20 }}>
                        {[['Total Visits', c.visits?.length || 0, 'var(--accent)'], ['Total Spend', `${curr} ${c.totalSpend || 0}`, 'var(--green)'], ['Last Visit', c.lastVisit ? c.lastVisit.split(',')[0] : '—', 'var(--text-2)']].map(([l, v, clr]) => (
                          <div key={l} style={{ background: 'var(--bg-3)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{l}</div>
                            <div style={{ fontWeight: 800, fontSize: 16, color: clr }}>{v}</div>
                          </div>
                        ))}
                      </div>

                      {/* Notes */}
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Notes</div>
                          <Btn variant="ghost" size="sm" onClick={() => setEditMode(!editMode)}>{editMode ? 'Cancel' : <><img src={EditIcon} alt="" style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} />Edit</>}</Btn>
                        </div>
                        {editMode
                          ? <>
                              <textarea
                                id={`edit-note-${c.id}`}
                                name="editNote"
                                value={editNote} onChange={e => setEditNote(e.target.value)} rows={3}
                                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-3)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', marginBottom: 8 }} />
                              <Btn onClick={saveNote} size="sm" disabled={saving}>{saving ? 'Saving…' : 'Save Note'}</Btn>
                            </>
                          : <div style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: c.notes ? 'var(--text)' : 'var(--text-3)', minHeight: 42 }}>
                              {c.notes || 'No notes. Click Edit to add.'}
                            </div>
                        }
                      </div>

                      {/* Visit history */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Visit History</div>
                        {(c.visits || []).length === 0
                          ? <div style={{ color: 'var(--text-3)', fontSize: 13 }}>No visits recorded.</div>
                          : (c.visits).map((v, i) => (
                            <div key={i} style={{ background: 'var(--bg-3)', borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{v.sessionId}</div>
                                <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--green)' }}>{curr} {v.amount}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-2)', alignItems: 'center' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center' }}><img src={CalendarIcon} alt="" style={{ width: 14, height: 14, marginRight: 4 }} /> {v.date?.split(',')[0]}</span>
                                <span style={{ display: 'inline-flex', alignItems: 'center' }}><img src={CarIcon} alt="" style={{ width: 14, height: 14, marginRight: 4 }} /> {v.vehicle?.colour} {v.vehicle?.make}</span>
                                <Chip color="var(--accent-2)" size="sm">{v.package}</Chip>
                                <span style={{ display: 'inline-flex', alignItems: 'center' }}><img src={WorkerIcon} alt="" style={{ width: 14, height: 14, marginRight: 4 }} /> {v.washer}</span>
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          }
        </div>
  </div>
    </>
  );
};

