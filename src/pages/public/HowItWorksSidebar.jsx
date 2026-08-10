import React from 'react';
import step1 from '../../assets/steps-imgs/step1.png';
import step2 from '../../assets/steps-imgs/step2.png';
import step3 from '../../assets/steps-imgs/step3.png';
import step4 from '../../assets/steps-imgs/step4.png';

const steps = [
  {
    step: 'Step 1',
    title: 'Scan QR & Request a Job',
    desc: 'Scan the QR code and instantly create a car job request. No calls, no waiting.',
    img: step1
  },
  {
    step: 'Step 2',
    title: 'Job Assignment',
    desc: 'The system automatically creates a service job and prepares it for execution.',
    img: step2
  },
  {
    step: 'Step 3',
    title: 'Assign to Available Worker',
    desc: 'The nearest available worker is assigned to the job for faster service and efficient operations.',
    img: step3
  },
  {
    step: 'Step 4',
    title: 'Job Completed',
    desc: 'Receive confirmation once the job is completed successfully, along with service and payment details.',
    img: step4
  }
];

export function HowItWorksSidebar() {
  return (
    <div className="how-it-works-sidebar">
      <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>How it works in four simple steps</h2>
      <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 16 }}>Automated workflow for smarter car job operations.</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ background: 'var(--card)', padding: 12, borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{s.step}</h3>
            <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4, marginBottom: 8, minHeight: 46 }}>
              <strong style={{ color: 'var(--text-2)', fontWeight: 700 }}>{s.title}</strong> - {s.desc}
            </p>
            <div style={{ background: 'var(--bg-3)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <img src={s.img} alt={s.title} style={{ width: '100%', maxHeight: 110, objectFit: 'contain', display: 'block' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
