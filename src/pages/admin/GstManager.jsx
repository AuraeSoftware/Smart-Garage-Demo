import React, { useState, useEffect } from 'react';
import { Card, Btn, Inp } from '../../components/common/UI';
import { API, token } from '../../utils/api';

export const GstManager = ({ notify }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gstConfig, setGstConfig] = useState({
    enabled: false,
    number: '',
    percentage: 6
  });

  useEffect(() => {
    fetchGst();
  }, []);

  const fetchGst = async () => {
    try {
      setLoading(true);
      const data = await API.settings.getGst();
      if (data) setGstConfig(data);
    } catch (err) {
      console.error(err);
      if (notify) notify('Could not load GST configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (gstConfig.enabled) {
      if (!gstConfig.number?.trim()) {
        if (notify) notify('Please enter a GST Number', 'error');
        return;
      }
      if (!gstConfig.percentage || gstConfig.percentage <= 0) {
        if (notify) notify('Please enter a valid GST Percentage', 'error');
        return;
      }
    }

    try {
      setSaving(true);
      await API.settings.setGst({
        enabled: gstConfig.enabled,
        number: gstConfig.number,
        percentage: parseFloat(gstConfig.percentage) || 0
      });
      if (notify) notify('GST configuration saved successfully', 'success');
    } catch (err) {
      console.error(err);
      if (notify) notify('Failed to save GST configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading GST Configuration...</div>;
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px', color: 'var(--text)' }}>GST Manager</h1>
        <p style={{ margin: '0 0 24px', color: 'var(--text-3)', fontSize: 14 }}>
          Configure Goods and Services Tax for all generated invoices.
        </p>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>Enable GST</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Apply GST to all customer invoices automatically.</div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
            <input 
              type="checkbox" 
              checked={gstConfig.enabled} 
              onChange={e => setGstConfig(p => ({ ...p, enabled: e.target.checked }))}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: gstConfig.enabled ? 'var(--accent)' : 'var(--border)',
              transition: '.4s', borderRadius: 34
            }}>
              <span style={{
                position: 'absolute', content: '""', height: 18, width: 18, left: 3, bottom: 3,
                backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                transform: gstConfig.enabled ? 'translateX(20px)' : 'translateX(0)'
              }} />
            </span>
          </label>
        </div>

        {gstConfig.enabled && (
          <div style={{ padding: 16, background: 'var(--bg-3)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <Inp 
                  label="GST Number *" 
                  placeholder="e.g. 123456789" 
                  value={gstConfig.number} 
                  onChange={e => setGstConfig(p => ({ ...p, number: e.target.value }))}
                />
              </div>
              <div>
                <Inp 
                  type="number"
                  label="GST Percentage (%) *" 
                  placeholder="e.g. 6" 
                  value={gstConfig.percentage} 
                  onChange={e => setGstConfig(p => ({ ...p, percentage: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <Btn onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </Btn>
        </div>
      </Card>
    </div>
  );
};
