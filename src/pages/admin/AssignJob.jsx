import React, { useState, useMemo, useEffect } from 'react';
import { Btn, BackButton, Dropdown } from '../../components/common/UI';

export const AssignJob = ({ users, packages, pendingJobs, branches, currentUser, addPendingJob, notify, onNav, branchSubscription, sessions }) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [locationName, setLocationName] = useState('');
  const [selectedWasher, setSelectedWasher] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('');

  const [selectedBranch, setSelectedBranch] = useState('');

  useEffect(() => {
    if (!selectedBranch) {
      if (currentUser?.branch_id || currentUser?.branchId) {
        setSelectedBranch(currentUser.branch_id || currentUser.branchId);
      } else if (branches && branches.length > 0) {
        setSelectedBranch(branches[0].id);
      }
    }
  }, [branches, currentUser, selectedBranch]);

  // Filter Washers based on selected branch
  const allWashers = useMemo(() => {
    return users.filter(u => {
      if (u.role !== 'Washer' || u.status !== 'Active') return false;
      return String(u.branch_id || u.branchId) === String(selectedBranch);
    }).map(w => {
      // Calculate pending jobs count for this washer
      const count = pendingJobs.filter(j => (j.washerId || j.washer_id) === w.id && j.status !== 'Completed').length;
      return { ...w, pendingCount: count };
    });
  }, [users, selectedBranch, pendingJobs]);

  // Only show washers with NO pending jobs (available washers)
  const washers = useMemo(() => allWashers.filter(w => w.pendingCount === 0), [allWashers]);
  const busyWashers = useMemo(() => allWashers.filter(w => w.pendingCount > 0), [allWashers]);

  // Session Limit Logic
  const now = new Date();
  const currentMonthSessions = (sessions || []).filter(s => {
    const d = s.createdAt ? new Date(s.createdAt) : null;
    return d && String(s.branchId) === String(selectedBranch) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const sessionLimit = branchSubscription?.max_sessions || 0;

  const selectedBranchData = branches?.find(b => String(b.id) === String(selectedBranch));
  const isExpired = selectedBranchData?.expiry_date ? new Date(selectedBranchData.expiry_date) < new Date() : false;

  const limitReached = (sessionLimit > 0 && currentMonthSessions >= sessionLimit) || isExpired;
  const refreshDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (limitReached) {
      window.dispatchEvent(new CustomEvent('show_limit_modal'));
      return;
    }
    if (!customerName || !customerPhone || !locationName || !selectedWasher) {
      notify('Please fill out Customer Info, Location, and Worker', 'warn');
      return;
    }

    const washer = washers.find(w => w.id === parseInt(selectedWasher));
    if (!washer) return;

    const branchId = selectedBranch;
    const branch = branches.find(b => b.id === branchId);

    const selPkg = packages?.find(p => p.id === selectedPackage);

    const job = {
      id: 'ASG-' + Date.now().toString().slice(-8),
      customer: { name: customerName, phone: customerPhone },
      vehicle: { make: vehicleMake, model: vehicleModel, plate: vehiclePlate },
      package: selPkg ? { ...selPkg } : { name: 'To be decided' },
      locationName: locationName,
      geo: null,
      branchId,
      branch: branch?.name,
      washerId: washer.id,
      washer: washer.name,
      status: 'assigned',
    };

    addPendingJob(job)
      .then(() => {
        notify(`Job assigned to ${washer.name} successfully!`, 'success');
        setCustomerName('');
        setCustomerPhone('');
        setVehicleMake('');
        setVehicleModel('');
        setVehiclePlate('');
        setLocationName('');
        setSelectedWasher('');
        setSelectedPackage('');
        if (onNav) onNav('dashboard');
      })
      .catch(err => notify(err.message, 'error'));
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.02em', color: 'var(--text)' }}>Assign a Job</h1>
        <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 14 }}>Pre-fill job details and assign them directly to an available worker.</p>
      </div>

      {limitReached && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)', borderRadius: 12, padding: '16px 20px', marginBottom: 22 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--red)', marginBottom: 4 }}>
            {isExpired ? 'Plan Expired!' : 'Session Limit Reached!'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {isExpired ? (
              <>Your subscription plan has expired. You cannot assign new jobs until you <strong style={{ color: 'var(--text)' }}>upgrade your plan</strong>.</>
            ) : (
              <>You have reached your limit of <strong style={{ color: 'var(--text)' }}>{sessionLimit} sessions</strong> for this month. You cannot assign new jobs until it refreshes on <strong>{refreshDate}</strong>.</>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: 'var(--card)', padding: 24, borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', opacity: limitReached ? 0.6 : 1, pointerEvents: limitReached ? 'none' : 'auto' }}>

        {branches && branches.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Branch</div>
            <Dropdown
              value={selectedBranch}
              onChange={v => { setSelectedBranch(v); setSelectedWasher(''); }}
              options={branches.map(b => ({ value: b.id, label: b.name }))}
              style={{ width: '100%' }}
            />
          </div>
        )}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Customer Information</div>
          <div className="responsive-split-1-1" style={{ gap: 12 }}>
            <input id="assign-customer-name" name="customerName" placeholder="Customer Name" value={customerName} onChange={e => setCustomerName(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
            <input id="assign-customer-phone" name="customerPhone" placeholder="Mobile Number" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Vehicle Information (Optional — Worker can use AI)</div>
          <div className="responsive-split-3" style={{ gap: 12 }}>
            <input id="assign-vehicle-make" name="vehicleMake" placeholder="Car Make (e.g. Toyota)" value={vehicleMake} onChange={e => setVehicleMake(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
            <input id="assign-vehicle-model" name="vehicleModel" placeholder="Car Model (e.g. Hilux)" value={vehicleModel} onChange={e => setVehicleModel(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
            <input id="assign-vehicle-plate" name="vehiclePlate" placeholder="Plate No. (e.g. WKL1234)" value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Package</div>
          <div className="responsive-split-1-1" style={{ gap: 10 }}>
            <div onClick={() => setSelectedPackage('')}
              style={{
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                border: selectedPackage === '' ? '2px solid var(--accent)' : '2px solid transparent',
                background: selectedPackage === '' ? 'var(--accent-dim)' : 'var(--bg-3)',
                display: 'flex', flexDirection: 'column', justifyContent: 'center'
              }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: selectedPackage === '' ? 'var(--accent)' : 'var(--text)' }}>To be decided</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Let the worker select</div>
            </div>
            {packages?.map(p => (
              <div key={p.id} onClick={() => setSelectedPackage(p.id)}
                style={{
                  padding: '12px 14px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                  border: selectedPackage === p.id ? `2px solid ${p.color || 'var(--accent)'}` : '2px solid transparent',
                  background: selectedPackage === p.id ? `${p.color || 'var(--accent)'}1A` : 'var(--bg-3)',
                  display: 'flex', flexDirection: 'column'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: selectedPackage === p.id ? (p.color || 'var(--accent)') : 'var(--text)' }}>{p.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: selectedPackage === p.id ? (p.color || 'var(--accent)') : 'var(--text-2)' }}>RM {p.price}</div>
                </div>
                {p.desc && <div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.desc}</div>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Location</div>
          <input id="assign-location-name" name="locationName" placeholder="Enter location area / address" value={locationName} onChange={e => setLocationName(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
        </div>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Assign To Worker</div>
          {washers.length === 0 && busyWashers.length === 0 ? (
            <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', color: 'var(--red)', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              No workers available in your branch!
            </div>
          ) : washers.length === 0 ? (
            <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', color: 'var(--red)', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              All workers are currently busy with pending jobs.
            </div>
          ) : (
            <div className="responsive-split-1-1" style={{ gap: 10 }}>
              {washers.map(w => (
                <div key={w.id}
                  onClick={() => setSelectedWasher(w.id.toString())}
                  style={{
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    border: selectedWasher === w.id.toString() ? '2px solid var(--accent)' : '2px solid transparent',
                    background: selectedWasher === w.id.toString() ? 'var(--accent-dim)' : 'var(--bg-3)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: selectedWasher === w.id.toString() ? 'var(--accent)' : 'var(--text)' }}>{w.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 2, fontWeight: 600 }}>✓ Available</div>
                  </div>
                  {selectedWasher === w.id.toString() && (
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>✓</div>
                  )}
                </div>
              ))}
            </div>
          )}
          {busyWashers.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>
              <span style={{ fontWeight: 600 }}>Busy:</span> {busyWashers.map(w => `${w.name} (${w.pendingCount} job)`).join(', ')}
            </div>
          )}
        </div>

        <Btn full size="lg" disabled={!selectedWasher} type="submit" style={{ fontFamily: 'inherit', fontWeight: 700 }}>Assign Job Now</Btn>
      </form>
    </div>
  );
};
