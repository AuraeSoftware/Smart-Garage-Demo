import React, { useState } from 'react';
import { getCurrency } from '../../utils/messaging';
import { Card, Chip, Btn, Inp, StatCard, EmptyState , BackButton, Dropdown} from '../../components/common/UI';
import { generateInvoicePDF } from '../../utils/pdf';
import { openWhatsApp } from '../../utils/messaging';
import ReceiptIcon from '../../assets/icons/receipt-icon.png';
import RevenueIcon from '../../assets/icons/revenue-icon-vec.png';
import CurrencyIcon from '../../assets/icons/currancy-icon.png';
import DownloadIcon from '../../assets/icons/download-icon.png';
import SearchIcon from '../../assets/icons/search-icon.png';
import CarIcon from '../../assets/icons/car-icon.png';

const PAY_CLR = { Cash: '#22C55E', 'QR Payment': '#22D3EE', 'Online Transfer': '#A78BFA', 'Dynamic QR': '#F43F5E' };

const normalizePay = (m) => {
  if (!m) return '';
  if (m === 'QR Pay') return 'QR Payment';
  if (m === 'Transfer') return 'Online Transfer';
  return m;
};

export const Sessions = ({ currentUser,sessions, users, branches, onNav}) => {
  const curr = getCurrency(currentUser?.phone);

  const [search, setSearch] = useState('');
  const [periodFilt, setPeriodFilt] = useState('All');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [payFilt, setPayFilt] = useState('All');
  const [washFilt, setWashFilt] = useState('All');
  const [brFilt, setBrFilt] = useState('All');
  const [selected, setSelected] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const washers = users.filter(u => u.role === 'Washer');

  const parseDate = (dStr) => {
    if (!dStr) return null;
    
    const dayStr = dStr.split(',')[0].trim();
    
    // Check for numerical DD/MM/YYYY or DD-MM-YYYY
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(dayStr)) {
      const parts = dayStr.split(/[\/\-]/);
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    
    // Check for numerical YYYY/MM/DD or YYYY-MM-DD
    if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(dayStr)) {
      const parts = dayStr.split(/[\/\-]/);
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    
    // Fallback to native parsing (handles "1 Jul 2026, 4:19 pm", ISO strings, etc.)
    const d = new Date(dStr);
    if (!isNaN(d)) return d;
    
    return null;
  };

  const filtered = sessions.filter(s => {
    const q = search.toLowerCase();
    const searchStr = `${s.vehicle?.colour || ''} ${s.vehicle?.make || ''} ${s.vehicle?.model || ''} ${s.vehicle?.plate || ''} ${s.washer || ''} ${s.id || ''}`.toLowerCase();
    const matchQ = !q || searchStr.includes(q);
    const matchP = payFilt === 'All' || normalizePay(s.payment?.mode) === normalizePay(payFilt);
    const matchW = washFilt === 'All' || s.washer === washFilt;
    const matchBr = brFilt === 'All' || s.branchId === brFilt;
    let matchPeriod = true;
    if (periodFilt !== 'All') {
      const d = parseDate(s.date);
      if (!d) { matchPeriod = false; }
      else {
        const now = new Date();
        if (periodFilt === 'Daily') matchPeriod = d.toDateString() === now.toDateString();
        else if (periodFilt === 'Weekly') { const diff = (now - d) / (1000 * 60 * 60 * 24); matchPeriod = diff >= 0 && diff <= 7; }
        else if (periodFilt === 'Monthly') matchPeriod = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        else if (periodFilt === 'Custom') {
          if (customStartDate && customEndDate) {
            const start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            matchPeriod = d >= start && d <= end;
          }
        }
      }
    }
    return matchQ && matchP && matchW && matchBr && matchPeriod;
  });

  const filteredRev = filtered.reduce((a, s) => a + (s.total || 0), 0);
  const totalRev = sessions.reduce((a, s) => a + (s.total || 0), 0);

  const exportCSV = () => {
    const h = 'Invoice,Date,Branch,Worker,Make,Model,Colour,Plate,Package,Amount,Payment,Ref\n';
    const rows = filtered.map(s => [s.id, s.date, s.branchId || '', s.washer, s.vehicle?.make, s.vehicle?.model, s.vehicle?.colour, s.vehicle?.plate, s.package?.name, s.total, s.payment?.mode, s.payment?.ref].join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([h + rows], { type: 'text/csv' }));
    a.download = 'washpro-sessions.csv';
    a.click();
  };

  const handlePDF = async (s) => {
    const branch = branches.find(b => String(b.id) === String(s.branchId));
    setPdfLoading(s.id);
    await generateInvoicePDF({ ...s, branch: branch?.name });
    setPdfLoading(false);
  };

  return (
    <>
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard icon={<img src={ReceiptIcon} alt="" style={{ width: 24, height: 24 }} />} label="Filtered" value={filtered.length} sub={`of ${sessions.length} total`} color="var(--accent)" />
        <StatCard icon={<img src={RevenueIcon} alt="" style={{ width: 24, height: 24 }} />} label="Filtered Rev" value={`${curr} ${filteredRev.toLocaleString()}`} sub="in selection" color="var(--green)" />
        <StatCard icon={<img src={CurrencyIcon} alt="" style={{ width: 24, height: 24 }} />} label="All-Time Rev" value={`${curr} ${totalRev.toLocaleString()}`} sub="since launch" color="var(--amber)" />
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Inp
          id="search-invoice"
          name="searchInvoice"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search invoice, vehicle, plate, washer…"
          icon={<img src={SearchIcon} alt="" style={{ width: 14, height: 14 }} />}
          style={{ margin: 0, flex: '1 1 240px', minWidth: 200 }}
        />
        {[
          { id: 'period', label: 'periodFilt', val: periodFilt, set: setPeriodFilt, opts: [
            { value: 'All', label: 'All Time' },
            { value: 'Daily', label: 'Today (Daily)' },
            { value: 'Weekly', label: 'This Week (Weekly)' },
            { value: 'Monthly', label: 'This Month (Monthly)' },
            { value: 'Custom', label: 'Custom Date' },
          ]},
          { id: 'pay', label: 'payFilt', val: payFilt, set: setPayFilt, opts: [
            { value: 'All', label: 'All Payments' },
            { value: 'Cash', label: 'Cash' },
            { value: 'QR Payment', label: 'QR Payment' },
            { value: 'Dynamic QR', label: 'Dynamic QR' },
            { value: 'Online Transfer', label: 'Online Transfer' },
          ]},
          { id: 'washer', label: 'washFilt', val: washFilt, set: setWashFilt, opts: [
            { value: 'All', label: 'All Workers' },
            ...Array.from(new Set(washers.map(w => w.name).filter(Boolean))).map(n => ({ value: n, label: n }))
          ]},
          { id: 'branch', label: 'brFilt', val: brFilt, set: setBrFilt, opts: [
            { value: 'All', label: 'All Branches' },
            ...branches.map(b => ({ value: b.id, label: b.name }))
          ]},
        ].filter(f => f.id !== 'branch' || branches.length > 1).map(({ id, label, val, set, opts }) => (
          <Dropdown 
            key={id} 
            id={`${id}-filter`} 
            name={`${label}Filt`} 
            value={val} 
            onChange={set} 
            options={opts}
            style={{ flex: '1 1 140px', minWidth: 160 }}
          />
        ))}
        <Btn variant="ghost" onClick={exportCSV}><img src={DownloadIcon} alt="" style={{ width: 14, height: 14, marginRight: 6, verticalAlign: 'middle' }} />Export CSV</Btn>
        {periodFilt === 'Custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
            <span style={{ color: 'var(--text-3)', fontSize: 13, fontWeight: 600 }}>to</span>
            <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Table Container */}
        <div style={{ flex: '1 1 320px', minWidth: 280, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow)', maxHeight: 'calc(100vh - 220px)', display: 'flex', flexDirection: 'column' }}>
          <div className="table-responsive-wrapper" style={{ overflowY: 'auto', flex: 1, marginBottom: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ background: 'var(--bg-3)' }}>
                  {['Invoice', 'Date', 'Branch', 'Worker', 'Vehicle', 'Plate', 'Package', 'Amount', 'Payment'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={10} style={{ padding: 40 }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 14 }}><img src={CarIcon} alt="" style={{ width: 14, height: 14, marginRight: 6 }} />{sessions.length === 0 ? 'No sessions yet.' : 'No sessions match your filters.'}</div></td></tr>
                  : filtered.map(s => {
                    const isActive = selected?.id === s.id; 
                    return (
                      <React.Fragment key={s.id}>
                        <tr onClick={() => setSelected(isActive ? null : s)} style={{ cursor: 'pointer', transition: 'background 0.15s', background: isActive ? 'var(--accent-dim)' : 'transparent' }}
                          onMouseEnter={e => e.currentTarget.style.background = isActive ? 'var(--accent-dim)' : 'var(--card-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = isActive ? 'var(--accent-dim)' : ''}
                        >
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', color: 'var(--accent)', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>{s.id}</td>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{s.date}</td>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-2)' }}>{branches.find(b => String(b.id) === String(s.branchId))?.name?.split('–')[0]?.trim() || '—'}</td>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text)' }}>{s.washer}</td>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text)' }}>
                          {`${s.vehicle?.colour || ''} ${s.vehicle?.make || ''} ${s.vehicle?.model || ''}`.trim() || <span style={{ color: 'var(--amber)' }}>—</span>}
                        </td>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'monospace', color: 'var(--amber)', fontSize: 12 }}>{s.vehicle?.plate || '—'}</td>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ marginBottom: 4 }}><Chip color="var(--accent-2)">{s.package?.name}</Chip></div>
                          {s.package?.price && <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>Cost: {curr} {s.package.price}</span>}
                        </td>
                        <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontWeight: 800, color: 'var(--green)', fontSize: 13 }}>{curr} {s.total}</td>
                        <td style={{ padding: '11px 14px', borderBottom: isActive ? 'none' : '1px solid var(--border)' }}><Chip color={PAY_CLR[normalizePay(s.payment?.mode)] || 'var(--text-3)'}>{s.payment?.mode}</Chip></td>
                      </tr>
                      {isActive && (
                        <tr style={{ background: 'var(--accent-dim)' }}>
                          <td colSpan={9} style={{ padding: '0 14px 14px', borderBottom: '1px solid var(--border)' }}>
                            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', borderRadius: 12, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
                                  Invoice Details
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <Btn variant="ghost" size="sm" onClick={() => handlePDF(s)} disabled={pdfLoading === s.id}>
                                    {pdfLoading === s.id ? '…' : 'PDF'}
                                  </Btn>
                                  <Btn variant="success" size="sm" onClick={() => openWhatsApp(s.customer?.phone, s)}>
                                     WhatsApp
                                  </Btn>
                                </div>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                                {[['GPS', s.location || '—'], ['Payment', normalizePay(s.payment?.mode) || '—'], ['Ref / Amount', s.payment?.mode === 'Cash' ? `${curr} ${s.payment?.ref || '—'}` : (s.payment?.ref || '—')], ['Customer', s.customer?.name || 'Walk-in'], ['Phone', s.customer?.phone || '—']].map(([l, v]) => (
                                  <div key={l} style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>{l}</span>
                                    <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13, wordBreak: 'break-word' }}>{v}</span>
                                  </div>
                                ))}
                              </div>
                              {s.products && s.products.filter(p => p.isIncluded).length > 0 && (
                                <div style={{ marginTop: 16, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 6 }}>Included Retail Products</div>
                                  {s.products.filter(p => p.isIncluded).map(p => (
                                    <div key={p.cartId || p.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                                      <span style={{ color: 'var(--text-2)' }}>{p.name}</span>
                                      <span style={{ fontWeight: 700, color: 'var(--text)' }}>Qty: {p.quantity} · {curr} {(p.price || 0) * p.quantity}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {s.products && s.products.filter(p => !p.isIncluded).length > 0 && (
                                <div style={{ marginTop: 16, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 6 }}>Addon Products</div>
                                  {s.products.filter(p => !p.isIncluded).map(p => (
                                    <div key={p.cartId || p.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                                      <span style={{ color: 'var(--text-2)' }}>{p.name}</span>
                                      <span style={{ fontWeight: 700, color: 'var(--text)' }}>Qty: {p.quantity} · {curr} {(p.price || 0) * p.quantity}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};
