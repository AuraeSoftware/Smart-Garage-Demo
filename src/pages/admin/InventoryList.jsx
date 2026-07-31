import React, { useMemo, useState } from 'react';
import { Card, StatCard, Inp, Chip } from '../../components/common/UI';
import AlertIcon from '../../assets/icons/low-stack-alert-icon.png';
import BoxIcon from '../../assets/icons/circle-icon.png';
import CurrencyIcon from '../../assets/icons/currancy-icon.png';
import CategoriesIcon from '../../assets/icons/Categories-icon.png';
import PostboxIcon from '../../assets/icons/postbox-icon.png';
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
    textTransform: 'uppercase', letterSpacing: '0.05em'
  }}>Low</span>
);

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export const InventoryList = ({inventory, branches, userRole, currentUser, onNav}) => {
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
        <StatCard icon={<img src={AlertIcon} alt="" style={{ width: 24, height: 24 }} />} label="Low Stock"       value={lowStockCount}                 color={lowStockCount > 0 ? 'var(--red)' : 'var(--text-3)'} />
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
        </div>
      </div>

      {/* Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-3)' }}>
                {['Name', 'Barcode', 'Category', 'Qty/Unit', 'Clicks', 'Cost/Unit', 'Price', 'Branch', 'Status'].map(h => (
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
                  <td colSpan={8}>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>


    </>
  );
};
