import React, { useState, useMemo } from 'react';
import { Card, StatCard, Btn, Inp, Dropdown, Modal, Chip } from '../../components/common/UI';
import AddProductModal from './AddProductModal';
import { API } from '../../utils/api';
import AlertIcon from '../../assets/icons/low-stack-alert-icon.png';
import BoxIcon from '../../assets/icons/circle-icon.png';
import CurrencyIcon from '../../assets/icons/currancy-icon.png';
import CategoriesIcon from '../../assets/icons/Categories-icon.png';
import PostboxIcon from '../../assets/icons/postbox-icon.png';
import ReceiptIcon from '../../assets/icons/receipt-icon.png';
import SearchIcon from '../../assets/icons/search-icon.png';

// ─── Empty state ──────────────────────────────────────────────────────────────
const Empty = ({ icon, title, sub }) => (
  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)' }}>
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>{icon}</div>
    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: 'var(--text-2)' }}>{title}</div>
    {sub && <div style={{ fontSize: 13 }}>{sub}</div>}
  </div>
);

// ─── Low‑stock badge ──────────────────────────────────────────────────────────
const LowBadge = () => (
  <span style={{
    background: 'rgba(239,68,68,0.15)', color: '#f87171',
    border: '1px solid rgba(239,68,68,0.35)', borderRadius: 6,
    padding: '2px 8px', fontSize: 10, fontWeight: 700,
    letterSpacing: '0.06em', textTransform: 'uppercase',
  }}>LOW</span>
);

// ─── Two-column field row ─────────────────────────────────────────────────────
const FieldRow = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
    {children}
  </div>
);

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export const RetailProducts = ({
  inventory, branches,
  createInventoryItem, updateInventoryItem, deleteInventoryItem,
  restockInventoryItem, consumeInventoryItem,
  notify, userRole, currentUser, branchSubscription,
}) => {
  const isSuperAdmin = userRole === 'SuperAdmin';
  // ── Currency Helper ─────────────────────────────────────────────────────────
  const getCurrency = (phone) => {
    if (!phone) return 'RM';
    const p = phone.replace(/\s|-/g, '');
    if (p.startsWith('+91')) return 'INR';
    if (p.startsWith('+65')) return 'SGD';
    if (p.startsWith('+62')) return 'Rp';
    if (p.startsWith('+1')) return '$';
    return 'RM';
  };
  const curr = getCurrency(currentUser?.phone);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState('All');

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [showProductOptions, setShowProductOptions] = useState(false);
  const [showAdd,    setShowAdd]    = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [actionItem, setActionItem] = useState(null);
  const [actionQty,  setActionQty]  = useState('');

  // ── History ─────────────────────────────────────────────────────────────────
  const [historyItem,    setHistoryItem]    = useState(null);
  const [historyData,    setHistoryData]    = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── New‑item form ──────────────────────────────────────────────────────────
  const BLANK = {
    name: '', category: '',
    quantity: 0, threshold: 3, description: '', cost: 0,
    barcode: '', branch_id: '',
  };
  const [newItem, setNewItem] = useState(BLANK);
  const setN = (k, v) => setNewItem(p => ({ ...p, [k]: v }));

  const handleSelectMode = (mode, data) => {
    if (mode === 'manual') {
      setShowAdd(true);
    } else if (mode === 'scanner') {
      setNewItem({ ...BLANK, barcode: data });
      setShowAdd(true);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => (inventory || []).filter(item => {
    const matchCat  = category === 'All' || item.category === category;
    const matchSrch = !search  || item.name.toLowerCase().includes(search.toLowerCase()) || (item.barcode || '').includes(search);
    return matchCat && matchSrch;
  }), [inventory, category, search]);

  const lowStockCount = (inventory || []).filter(i => i.low_stock).length;
  const totalItems    = (inventory || []).length;
  const totalValue    = (inventory || []).reduce((a, i) => a + (i.price || 0), 0);
  const categories    = ['All', ...new Set((inventory || []).map(i => i.category))];

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!newItem.name?.trim() || !newItem.category?.trim() || !newItem.description?.trim() || newItem.price === '' || newItem.price === undefined || newItem.quantity === '' || newItem.quantity === undefined || newItem.threshold === '' || newItem.threshold === undefined || newItem.cost === '' || newItem.cost === undefined) {
      notify('All fields except barcode are mandatory', 'error'); return;
    }
    try {
      await createInventoryItem({
        ...newItem,
        quantity:  Number(newItem.quantity),
        threshold: Number(newItem.threshold),
        cost:      Number(newItem.cost),
        barcode:   newItem.barcode || null,
        branch_id: newItem.branch_id || null,
      });
      setNewItem(BLANK);
      setShowAdd(false);
      notify('Item added to inventory!');
    } catch (err) { notify(err.message || 'Failed to add item', 'error'); }
  };

  const handleEdit = async () => {
    if (!editing.name?.trim() || !editing.category?.trim() || !editing.description?.trim() || editing.price === '' || editing.price === undefined || editing.quantity === '' || editing.quantity === undefined || editing.threshold === '' || editing.threshold === undefined || editing.cost === '' || editing.cost === undefined) {
      notify('All fields except barcode are mandatory', 'error'); return;
    }
    try {
      await updateInventoryItem(editing.id, {
        name:        editing.name,
        category:    editing.category,
        quantity:    Number(editing.quantity),
        threshold:   Number(editing.threshold),
        description: editing.description,
        cost:        Number(editing.cost),
        barcode:     editing.barcode || null,
        branch_id:   editing.branch_id || null,
      });
      setEditing(null);
      notify('Item updated!');
    } catch (err) { notify(err.message || 'Failed to update', 'error'); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"? It will be hidden from inventory.`)) return;
    try {
      await deleteInventoryItem(item.id);
      notify('Item removed from inventory.');
    } catch (err) { notify(err.message || 'Failed to delete', 'error'); }
  };

  const handleAction = async () => {
    const qty = Number(actionQty);
    if (!qty || qty <= 0) { notify('Enter a valid quantity', 'error'); return; }
    try {
      if (actionItem.mode === 'restock') {
        await restockInventoryItem(actionItem.item.id, { quantity: qty });
        notify(`Restocked ${qty}.`);
      } else {
        await consumeInventoryItem(actionItem.item.id, { quantity: qty });
        notify(`Used ${qty}.`);
      }
      setActionItem(null);
      setActionQty('');
    } catch (err) { notify(err.message || 'Action failed', 'error'); }
  };

  const openHistory = async (item) => {
    setHistoryItem(item);
    setHistoryLoading(true);
    try {
      const data = await API.inventory.history(item.id);
      setHistoryData(data || []);
    } catch { setHistoryData([]); }
    setHistoryLoading(false);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Low‑stock banner */}
      {lowStockCount > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 20,
          color: '#f87171', fontWeight: 600, fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <img src={AlertIcon} alt="" style={{ width: 18, height: 18 }} />
          {lowStockCount} item{lowStockCount > 1 ? 's are' : ' is'} low on stock — restock soon!
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard icon={<img src={BoxIcon} alt="" style={{ width: 24, height: 24 }} />} label="Total Items"     value={totalItems}                    color="var(--accent)"   />
        <StatCard icon={<img src={CurrencyIcon} alt="" style={{ width: 24, height: 24 }} />} label="Inventory Value"  value={`${curr} ${totalValue.toFixed(2)}`} color="var(--green)"    />
        <StatCard icon={<img src={AlertIcon} alt="" style={{ width: 24, height: 24 }} />} label="Low Stock"        value={lowStockCount}                 color={lowStockCount > 0 ? 'var(--red)' : 'var(--text-3)'} />
        <StatCard icon={<img src={CategoriesIcon} alt="" style={{ width: 24, height: 24 }} />} label="Categories"       value={categories.length}             color="var(--accent-2)" />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18, justifyContent: 'space-between' }}>
        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['All', ...new Set((inventory || []).map(i => i.category))].map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s',
              background: category === cat ? 'var(--accent)' : 'var(--bg-3)',
              color:      category === cat ? '#fff'          : 'var(--text-2)',
            }}>
              {cat}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Inp
            placeholder="Search name or barcode..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            icon={<img src={SearchIcon} alt="" style={{ width: 14, height: 14 }} />}
            style={{ margin: 0, minWidth: 220 }}
          />
          {['SuperAdmin', 'SuperAdmin', 'Admin'].includes(userRole) && (
            <Btn onClick={() => setShowProductOptions(true)}>+ Add Item</Btn>
          )}
        </div>
      </div>

      {/* Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-3)' }}>
                {['Name', 'Barcode', 'Category', 'Qty/Unit', 'Clicks', 'Cost/Unit', 'Price', 'Branch', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '11px 14px', fontSize: 10, fontWeight: 700,
                    color: 'var(--text-3)', borderBottom: '1px solid var(--border)',
                    letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <Empty icon={<img src={PostboxIcon} alt="" style={{ width: 48, height: 48 }} />} title="No items found" sub="Try changing your search or category filter" />
                  </td>
                </tr>
              ) : filtered.map(item => {
                const br = item.branch_id ? branches?.find(b => b.id === item.branch_id) : null;
                const availableClicks = item.clicks ?? 0;
                
                return (
                  <tr key={item.id}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                    style={{ transition: 'background 0.15s' }}
                  >
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                      {item.name}
                      {item.description && (
                        <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400, marginTop: 2 }}>{item.description}</div>
                      )}
                    </td>
                    {/* Barcode column */}
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
                      {item.barcode ? (
                        <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text)', letterSpacing: 1 }}>{item.barcode}</span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
                      <Chip color="var(--accent-2)">{item.category}</Chip>
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 15, color: item.low_stock ? '#f87171' : 'var(--text)' }}>
                          {Number((item.quantity || 0).toFixed(2))}
                        </span>
                        {item.low_stock && <LowBadge />}
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent)' }}>
                        {availableClicks}
                      </span>
                    </td>

                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>
                      {curr} {(item.cost || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>
                      {curr} {(item.price || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-2)' }}>
                      {br ? br.name.split('–')[0].trim() : <span style={{ color: 'var(--accent)', fontSize: 11 }}>Global</span>}
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
                      <Chip color={item.low_stock ? 'var(--red)' : 'var(--green)'}>
                        {item.low_stock ? 'Low' : 'OK'}
                      </Chip>
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
                          <Btn variant="ghost" size="sm" onClick={() => setActionItem({ item, mode: 'restock' })}>+Stock</Btn>
                          <Btn variant="ghost" size="sm" onClick={() => openHistory(item)}>Log</Btn>
                          <Btn variant="ghost" size="sm" onClick={() => setEditing({ ...item, branch_id: item.branch_id || '', barcode: item.barcode || '' })}>Edit</Btn>
                          <Btn variant="danger"  size="sm" onClick={() => handleDelete(item)}>Del</Btn>
                        </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════
          OPTIONS MODAL (Scanner / Manual / Generator)
      ══════════════════════════════════════════════════════ */}
      {showProductOptions && (
        <AddProductModal 
          userRole={userRole}
          branchSubscription={branchSubscription}
          onSelectMode={handleSelectMode}
          onClose={() => setShowProductOptions(false)}
        />
      )}

      {/* ══════════════════════════════════════════════════════
          ADD MODAL
      ══════════════════════════════════════════════════════ */}
      <Modal title="+ Add Inventory Item" open={showAdd} onClose={() => { setShowAdd(false); setNewItem(BLANK); }}>

        <Inp label="Item Name *" value={newItem.name} onChange={e => setN('name', e.target.value)}/>
        <Inp label="Description *" value={newItem.description} onChange={e => setN('description', e.target.value)} placeholder="Short description" />
        <FieldRow>
          <Inp label="Category *" value={newItem.category} onChange={e => setN('category', e.target.value)} />
          <Inp label="Price (RM) *" value={newItem.price ?? ''} onChange={e => setN('price', e.target.value)} type="number" min="0"  />
        </FieldRow>
        <Inp label="Barcode (Optional)" value={newItem.barcode || ''} onChange={e => setN('barcode', e.target.value)} placeholder="Scan or enter barcode" />
        <FieldRow>
          <Inp label="Qty/Unit *"    value={newItem.quantity ?? ''}  onChange={e => setN('quantity',  e.target.value)} type="number" min="0" step="1" />
          <Inp label="Low Clicks Threshold *" value={newItem.threshold ?? ''} onChange={e => setN('threshold', e.target.value)} type="number" min="3"  />
        </FieldRow>
        <FieldRow>
          <Inp label="Unit Cost (RM) *" value={newItem.cost ?? ''} onChange={e => setN('cost', e.target.value)} type="number" min="0"  />
        </FieldRow>
        {isSuperAdmin && (
          <Dropdown
            label="Assign to Branch"
            value={newItem.branch_id}
            onChange={v => setN('branch_id', v)}
            options={[{ value: '', label: 'Global (all branches)' }, ...(branches || []).map(b => ({ value: b.id, label: b.name }))]}
          />
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <Btn full onClick={handleAdd}>Save Item</Btn>
          <Btn full variant="ghost" onClick={() => { setShowAdd(false); setNewItem(BLANK); }}>Cancel</Btn>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════
          EDIT MODAL
      ══════════════════════════════════════════════════════ */}
      <Modal title={`Edit — ${editing?.name}`} open={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <>

            <Inp label="Item Name *"   value={editing.name}        onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} />
            <Inp label="Description *" value={editing.description} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} />
            <FieldRow>
              <Inp label="Category *" value={editing.category} onChange={e => setEditing(p => ({ ...p, category: e.target.value }))}
                options={categories.filter(c => c !== 'All').map(c => ({ value: c, label: c }))} />
              <Inp label="Price (RM) *" value={editing.price ?? ''} onChange={e => setEditing(p => ({ ...p, price: e.target.value === '' ? '' : Number(e.target.value) }))} type="number" min="0" step="0.01" />
            </FieldRow>
            <FieldRow>
              <Inp label="Qty/Unit *"  value={editing.quantity ?? ''}  onChange={e => setEditing(p => ({ ...p, quantity:  e.target.value === '' ? '' : Number(e.target.value) }))} type="number" min="0" />
              <Inp label="Low Clicks Threshold *" value={editing.threshold ?? ''} onChange={e => setEditing(p => ({ ...p, threshold: e.target.value === '' ? '' : Number(e.target.value) }))} type="number" min="3" />
            </FieldRow>
            <FieldRow>
              <Inp label="Cost/Unit (RM) *" value={editing.cost ?? ''} onChange={e => setEditing(p => ({ ...p, cost: e.target.value === '' ? '' : Number(e.target.value) }))} type="number" min="0"  />
            </FieldRow>
            {isSuperAdmin && (
              <Dropdown label="Branch" value={editing.branch_id || ''} onChange={v => setEditing(p => ({ ...p, branch_id: v }))}
                options={[{ value: '', label: 'Global' }, ...(branches || []).map(b => ({ value: b.id, label: b.name }))]} />
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <Btn full onClick={handleEdit}>Save Changes</Btn>
              <Btn full variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
            </div>
          </>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════
          RESTOCK / USE MODAL
      ══════════════════════════════════════════════════════ */}
      <Modal
        title={actionItem?.mode === 'restock' ? `Restock — ${actionItem?.item?.name}` : `Use Stock — ${actionItem?.item?.name}`}
        open={!!actionItem}
        onClose={() => { setActionItem(null); setActionQty(''); }}
      >
        {actionItem && (
          <>
            <div style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Current Stock</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: actionItem.item.low_stock ? '#f87171' : 'var(--text)' }}>
                {actionItem.item.quantity}
              </div>
              {actionItem.item.barcode && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-3)' }}>Barcode: {actionItem.item.barcode}</span>
                </div>
              )}
            </div>
            <Inp
              label={actionItem.mode === 'restock' ? 'Quantity to Add' : 'Quantity to Use'}
              value={actionQty}
              onChange={e => setActionQty(e.target.value)}
              type="number" min="0" 
              placeholder="Enter quantity"
            />
            {actionItem.mode === 'use' && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
                After use: <strong style={{ color: 'var(--text)' }}>
                  {Math.max(0, actionItem.item.quantity - Number(actionQty || 0))}
                </strong>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <Btn full onClick={handleAction} style={{ background: actionItem.mode === 'use' ? 'var(--red)' : '#da1a31', color: '#fff', border: 'none' }}>
                {actionItem.mode === 'restock' ? 'Confirm Restock' : 'Confirm Use'}
              </Btn>
              <Btn full variant="ghost" onClick={() => { setActionItem(null); setActionQty(''); }}>Cancel</Btn>
            </div>
          </>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════
          HISTORY MODAL
      ══════════════════════════════════════════════════════ */}
      <Modal title={`Stock History — ${historyItem?.name}`} open={!!historyItem} onClose={() => { setHistoryItem(null); setHistoryData([]); }}>
        {historyLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Loading...</div>
        ) : historyData.length === 0 ? (
          <Empty icon={<img src={ReceiptIcon} alt="" style={{ width: 48, height: 48 }} />} title="No history yet" sub="Use the Restock or Use buttons to record stock events." />
        ) : (
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {historyData.map(h => (
              <div key={h.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid var(--border)',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: h.event_type === 'stock_in' ? 'var(--green)' : '#f87171' }}>
                    {h.event_type === 'stock_in' ? '+' : ''}{h.quantity_change}
                    <span style={{
                      marginLeft: 8, fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                      background: h.event_type === 'stock_in' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                      color:      h.event_type === 'stock_in' ? 'var(--green)' : '#f87171',
                      padding: '2px 7px', borderRadius: 5,
                    }}>
                      {h.event_type === 'stock_in' ? 'Restock' : 'Used'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>by {h.created_by || '—'}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'right' }}>
                  {h.created_at ? new Date(h.created_at).toLocaleString() : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
};
