import React, { useState } from 'react';
import { getCurrency } from '../../utils/messaging';
import { Card, StatCard, Btn, Inp, Dropdown, Modal, EmptyState, Chip } from '../../components/common/UI';
import AlertIcon from '../../assets/icons/low-stack-alert-icon.png';
import BoxIcon from '../../assets/icons/circle-icon.png';
import CurrencyIcon from '../../assets/icons/currancy-icon.png';
import EditIcon from '../../assets/icons/edit-icon.png';
import DeleteIcon from '../../assets/icons/delete-icon.png';
import BranchIcon from '../../assets/icons/branch-icon.png';

export const SuperAdminProducts = ({ currentUser, products, branches, createProduct, updateProduct, deleteProduct, notify }) => {
  const curr = getCurrency(currentUser?.phone);

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [restocking, setRestocking] = useState(null);
  const [stockAdd, setStockAdd] = useState(0);

  const [newP, setNewP] = useState({ name: '', desc: '', size: '', qty_per_unit: 1, unit_cost: 0, branch_id: '' });
  const setN = (k, v) => setNewP(p => ({ ...p, [k]: v }));

  const LOW_STOCK_THRESHOLD = 10;
  const lowStockCount = products.filter(p => (p.clicks || 0) < LOW_STOCK_THRESHOLD).length;
  const totalValue = products.reduce((a, p) => a + ((p.clicks || 0) * (p.unit_cost || 0)), 0);

  const handleAdd = async () => {
    if (!newP.name) { notify('Name is required', 'error'); return; }
    try {
      await createProduct({ 
        name: newP.name, 
        desc: newP.desc, 
        size: newP.size,
        qty_per_unit: Number(newP.qty_per_unit),
        unit_cost: Number(newP.unit_cost), 
        clicks: Number(newP.qty_per_unit),
        branch_id: newP.branch_id || null
      });
      setNewP({ name: '', desc: '', size: '', qty_per_unit: 1, unit_cost: 0, branch_id: '' });
      setShowAdd(false);
      notify('✅ Product added!');
    } catch (err) { notify(err.message || 'Failed to add product', 'error'); }
  };

  const handleUpdate = async () => {
    try {
      await updateProduct(editing.id, { 
        name: editing.name, 
        desc: editing.desc, 
        size: editing.size,
        qty_per_unit: Number(editing.qty_per_unit),
        unit_cost: Number(editing.unit_cost), 
        clicks: Number(editing.clicks),
        branch_id: editing.branch_id || null
      });
      setEditing(null);
      notify('✅ Product updated!');
    } catch (err) { notify(err.message || 'Failed to update product', 'error'); }
  };

  const handleRestock = async () => {
    if (stockAdd <= 0) return;
    try {
      await updateProduct(restocking.id, { 
        ...restocking,
        clicks: (restocking.clicks || 0) + Number(stockAdd)
      });
      setRestocking(null);
      setStockAdd(0);
      notify('📦 Stock added successfully!');
    } catch (err) { notify(err.message || 'Failed to restock', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteProduct(id);
      notify(' Product removed!');
    } catch (err) { notify(err.message || 'Failed to delete product', 'error'); }
  };

  return (
    <>
      {lowStockCount > 0 && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 10, padding: 12, marginBottom: 20, color: 'var(--red)', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={AlertIcon} alt="" style={{ width: 18, height: 18 }} />
          You have {lowStockCount} product(s) with low stock (below {LOW_STOCK_THRESHOLD}).
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard icon={<img src={BoxIcon} alt="" style={{ width: 24, height: 24 }} />} label="Total Products" value={products.length} color="var(--accent)" />
        <StatCard icon={<img src={CurrencyIcon} alt="" style={{ width: 24, height: 24 }} />} label="Total Value" value={`${curr} ${totalValue.toFixed(2)}`} color="var(--green)" />
        <StatCard icon={<img src={AlertIcon} alt="" style={{ width: 24, height: 24 }} />} label="Low Stock" value={lowStockCount} color={lowStockCount > 0 ? "var(--red)" : "var(--text-3)"} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>Manage global and branch inventory</p>
        <Btn onClick={() => setShowAdd(true)}>+ Add Product</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
        {products.map(p => {
          const br = p.branch_id ? branches.find(b => b.id === p.branch_id) : null;
          const isLowStock = (p.clicks || 0) < LOW_STOCK_THRESHOLD;
          return (
            <Card key={p.id} style={{ borderLeft: isLowStock ? '4px solid var(--red)' : '4px solid var(--accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{p.name} {p.size ? `(${p.size})` : ''}</div>
                  {br ? <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><img src={BranchIcon} alt="" style={{ width: 14, height: 14 }} /> {br.name}</div> : <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><img src={BoxIcon} alt="" style={{ width: 14, height: 14 }} /> Global</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 900, fontSize: 18, color: 'var(--green)' }}>{curr} {p.unit_cost.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Unit Cost</div>
                </div>
              </div>
              
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, minHeight: 18 }}>{p.desc || "No description"}</div>
              
              <div style={{ background: 'var(--bg-3)', padding: 10, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Remaining Clicks</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: isLowStock ? 'var(--red)' : 'var(--text)' }}>{p.clicks || 0}</div>
                </div>
                <Btn size="sm" onClick={() => setRestocking(p)}><img src={BoxIcon} alt="" style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} />Restock</Btn>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="ghost" size="sm" style={{ flex: 1 }} onClick={() => setEditing({ ...p })}><img src={EditIcon} alt="" style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} />Edit</Btn>
                <Btn variant="danger" size="sm" onClick={() => handleDelete(p.id)}><img src={DeleteIcon} alt="" style={{ width: 12, height: 12 }} /></Btn>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add Modal */}
      <Modal title="New Product" open={showAdd} onClose={() => setShowAdd(false)}>
        <Inp label="Product Name *" value={newP.name} onChange={e=>setN('name',e.target.value)} placeholder="e.g. Car Shampoo" />
        <Inp label="Product Size" value={newP.size} onChange={e=>setN('size',e.target.value)} placeholder="e.g. 1 Liter" />
        <Inp label="Description" value={newP.desc} onChange={e=>setN('desc',e.target.value)} placeholder="Short description" />
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Inp label="Unit Cost (RM)" value={newP.unit_cost} onChange={e=>setN('unit_cost',e.target.value)} type="number" step="0.01" min="0" />
          </div>
          <div style={{ flex: 1 }}>
            <Inp label="Qty/Unit" value={newP.qty_per_unit} onChange={e=>setN('qty_per_unit',e.target.value)} type="number" min="1" />
          </div>
        </div>
        {branches.length > 1 && (
          <Dropdown label="Assign to Branch" value={newP.branch_id} onChange={v=>setN('branch_id',v)} options={[{value:'',label:'🌐 Global (All Branches)'}, ...branches.map(b=>({value:b.id,label:b.name}))]} />
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <Btn full onClick={handleAdd}>Save Product</Btn>
          <Btn full variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal title={`Edit — ${editing?.name}`} open={!!editing} onClose={() => setEditing(null)}>
        {editing && <>
          <Inp label="Name" value={editing.name} onChange={e=>setEditing(p=>({...p,name:e.target.value}))} />
          <Inp label="Product Size" value={editing.size || ''} onChange={e=>setEditing(p=>({...p,size:e.target.value}))} />
          <Inp label="Description" value={editing.desc} onChange={e=>setEditing(p=>({...p,desc:e.target.value}))} />
          <Inp label="Unit Cost (RM)" value={editing.unit_cost} onChange={e=>setEditing(p=>({...p,unit_cost:Number(e.target.value)}))} type="number" step="0.01" min="0" />
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Inp label="Qty/Unit" value={editing.qty_per_unit || 1} onChange={e=>setEditing(p=>({...p,qty_per_unit:Number(e.target.value)}))} type="number" min="1" />
            </div>
            <div style={{ flex: 1 }}>
              <Inp label="Clicks" value={editing.clicks || 0} onChange={e=>setEditing(p=>({...p,clicks:Number(e.target.value)}))} type="number" min="0" />
            </div>
          </div>
          {branches.length > 1 && (
            <Dropdown label="Branch" value={editing.branch_id || ''} onChange={v=>setEditing(p=>({...p,branch_id:v}))} options={[{value:'',label:'🌐 Global'}, ...branches.map(b=>({value:b.id,label:b.name}))]} />
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <Btn full onClick={handleUpdate}>Save</Btn>
            <Btn full variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
          </div>
        </>}
      </Modal>

      {/* Restock Modal */}
      <Modal title={`Restock — ${restocking?.name}`} open={!!restocking} onClose={() => {setRestocking(null); setStockAdd(0);}}>
        {restocking && <>
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-2)' }}>
            Remaining Clicks: <strong style={{ color: 'var(--text)' }}>{restocking.clicks || 0}</strong>
          </div>
          <Inp label="Clicks to Add" value={stockAdd} onChange={e=>setStockAdd(e.target.value)} type="number" min="1" />
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <Btn full onClick={handleRestock} style={{ background: '#da1a31', color: '#fff', border: 'none' }}>Confirm Restock</Btn>
            <Btn full variant="ghost" onClick={() => {setRestocking(null); setStockAdd(0);}}>Cancel</Btn>
          </div>
        </>}
      </Modal>
    </>
  );
};
