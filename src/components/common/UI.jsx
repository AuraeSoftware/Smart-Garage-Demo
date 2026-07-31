import React from 'react';
import LogoLightIcon from '../../assets/Rwash-Brand-Color/RWASH-icon.png';
import LogoDarkIcon from '../../assets/Rwash-Single-Color/RWASH-icon-White.png';
import LogoLightFull from '../../assets/Rwash-Brand-Color/RWASH-with-tagline.png';
import LogoDarkFull from '../../assets/Rwash-Single-Color/RWASH-with-tagline-White.png';
import BackArrowIcon from '../../assets/icons/back-arrow-icon.png';
import SunIcon from '../../assets/icons/sun-icon.png';
import MoonIcon from '../../assets/icons/moon-icon.png';

/* ══════════════════════════════════════════════════════════
   LOGO — Bold W + water arc, automotive badge style
══════════════════════════════════════════════════════════ */
export const Logo = ({ size = 36, showText = true, collapsed = false }) => {
  if (collapsed || !showText) {
    return (
      <div style={{ width: size, height: size, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'transparent' }}>
        <img
          src={LogoLightIcon}
          alt="Smart Garage"
          className="logo-light"
          style={{
            width: size * 1.45,
            height: size * 1.45,
            objectFit: 'contain',
            display: 'block'
          }}
        />
        <img
          src={LogoDarkIcon}
          alt="Smart Garage"
          className="logo-dark"
          style={{
            width: size * 1.45,
            height: size * 1.45,
            objectFit: 'contain',
            display: 'block'
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', width: '100%' }}>
      <img
        src={LogoLightFull}
        alt="Smart Garage"
        className="logo-light"
        style={{
          height: "75px",
          width: 'auto',
          objectFit: 'contain',
          display: 'block'
        }}
      />
      <img
        src={LogoDarkFull}
        alt="Smart Garage"
        className="logo-dark"
        style={{
          height: "75px",
          width: 'auto',
          objectFit: 'contain',
          display: 'block'
        }}
      />
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   BUTTON
══════════════════════════════════════════════════════════ */
export const Btn = ({ children, variant = 'primary', size = 'md', full = false, disabled, style, onClick, ...rest }) => {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, border: 'none', fontFamily: 'inherit',
    fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1, width: full ? '100%' : 'auto',
    letterSpacing: '-0.01em', whiteSpace: 'nowrap', transition: 'all 0.15s',
  };
  const sizes = {
    sm: { fontSize: 14, padding: '6px 12px', borderRadius: 8 },
    md: { fontSize: 13, padding: '9px 16px', borderRadius: 9 },
    lg: { fontSize: 14, padding: '12px 22px', borderRadius: 10 },
  };
  const variants = {
    primary: { background: 'var(--accent)', color: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    secondary: { background: 'var(--bg-3)', color: 'var(--text)', border: '1px solid var(--border)' },
    ghost: { background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border)' },
    danger: { background: 'rgba(220,38,38,0.07)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.18)' },
    success: { background: 'rgba(5,150,105,0.08)', color: 'var(--green)', border: '1px solid rgba(5,150,105,0.22)' },
    outline: { background: 'transparent', color: 'var(--accent)', border: '1.5px solid var(--accent)' },
    warn: { background: 'rgba(217,119,6,0.08)', color: 'var(--amber)', border: '1px solid rgba(217,119,6,0.2)' },
  };
  return (
    <button style={{ ...base, ...sizes[size], ...variants[variant], ...style }} disabled={disabled} onClick={onClick} {...rest}>
      {children}
    </button>
  );
};

/* ══════════════════════════════════════════════════════════
   INPUT
══════════════════════════════════════════════════════════ */
export const Inp = ({ label, error, hint, icon, prefix, style, id, name, ...props }) => {
  const generatedId = React.useId();
  const safeId = id || name || (label ? `inp-${label.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}` : `inp-${generatedId}`);
  const safeName = name || safeId;

  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label htmlFor={safeId} style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>{label}</label>}
      <div style={{ position: 'relative', display: 'flex' }}>
        {icon && <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 14, pointerEvents: 'none', zIndex: 1 }}>{icon}</span>}
        {prefix && <span style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-2)', border: `1.5px solid ${error ? 'var(--red)' : 'var(--border)'}`, borderRight: 'none', borderRadius: '9px 0 0 9px', padding: '10px 12px', color: 'var(--text-2)', fontSize: 14, fontWeight: 600 }}>{prefix}</span>}
        <input
          id={safeId}
          name={safeName}
          style={{
            flex: 1, width: '100%', boxSizing: 'border-box',
            background: 'var(--bg-3)', border: `1.5px solid ${error ? 'var(--red)' : 'var(--border)'}`,
            borderRadius: prefix ? '0 9px 9px 0' : 9, padding: icon ? '10px 14px 10px 38px' : '10px 14px',
            color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
            ...style,
          }}
          {...props}
        />
      </div>
      {error && <p style={{ fontSize: 13, color: 'var(--red)', marginTop: 4, fontWeight: 500 }}>{error}</p>}
      {hint && !error && <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>{hint}</p>}
    </div>
  );
};

export const PhoneInp = ({ label, error, hint, style, value = '', onChange, id, name, readOnly, type = 'tel', ...props }) => {
  const generatedId = React.useId();
  const safeId = id || name || (label ? `inp-${label.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}` : `inp-${generatedId}`);
  
  const CODES = ['+1','+7','+20','+27','+30','+31','+32','+33','+34','+36','+39','+40','+41','+43','+44','+45','+46','+47','+48','+49','+51','+52','+53','+54','+55','+56','+57','+58','+60','+61','+62','+63','+64','+65','+66','+81','+82','+84','+86','+90','+91','+92','+93','+94','+95','+98','+212','+213','+216','+218','+220','+221','+234','+254','+255','+256','+351','+353','+358','+380','+673','+852','+853','+880','+886','+966','+971','+972','+973','+974','+977'];
  const sortedCodes = [...CODES].sort((a, b) => b.length - a.length);

  let cc = '+60';
  let num = (value || '').trim();

  for (let c of sortedCodes) {
    if (num.startsWith(c)) {
      cc = c;
      num = num.substring(c.length).trim();
      break;
    }
  }

  const handleCcChange = (e) => { console.log('handleCcChange', e.target.value, num);
    const newCc = e.target.value;
    const isEmailOrUsername = /[a-zA-Z@]/.test(num);
    if (isEmailOrUsername) {
      if (onChange) onChange({ target: { name: name || id, value: num } });
    } else {
      if (onChange) onChange({ target: { name: name || id, value: `${newCc}${num}` } });
    }
  };

  const handleNumChange = (e) => {
    const newNum = e.target.value;
    const isEmailOrUsername = /[a-zA-Z@]/.test(newNum);
    if (isEmailOrUsername) {
      if (onChange) onChange({ target: { name: name || id, value: newNum } });
    } else {
      if (onChange) onChange({ target: { name: name || id, value: newNum ? `${cc}${newNum}` : `${cc}` } });
    }
  };

  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label htmlFor={safeId} style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>{label}</label>}
      <div style={{ display: 'flex' }}>
        <select
          value={cc}
          onChange={handleCcChange}
          disabled={readOnly}
          style={{
            background: readOnly ? 'var(--bg-2)' : 'var(--bg-3)', border: `1.5px solid ${error ? 'var(--red)' : 'var(--border)'}`, borderRight: 'none', borderRadius: '9px 0 0 9px', padding: '10px 4px 10px 10px', color: 'var(--text)', fontSize: 14, fontWeight: 600, outline: 'none', cursor: readOnly ? 'not-allowed' : 'pointer', opacity: readOnly ? 0.7 : 1
          }}
        >
          {[{ c: '+1', n: 'US/CA' }, { c: '+7', n: 'RU/KZ' }, { c: '+20', n: 'EG' }, { c: '+27', n: 'ZA' },
            { c: '+30', n: 'GR' }, { c: '+31', n: 'NL' }, { c: '+32', n: 'BE' }, { c: '+33', n: 'FR' },
            { c: '+34', n: 'ES' }, { c: '+36', n: 'HU' }, { c: '+39', n: 'IT' }, { c: '+40', n: 'RO' },
            { c: '+41', n: 'CH' }, { c: '+43', n: 'AT' }, { c: '+44', n: 'UK' }, { c: '+45', n: 'DK' },
            { c: '+46', n: 'SE' }, { c: '+47', n: 'NO' }, { c: '+48', n: 'PL' }, { c: '+49', n: 'DE' },
            { c: '+51', n: 'PE' }, { c: '+52', n: 'MX' }, { c: '+53', n: 'CU' }, { c: '+54', n: 'AR' },
            { c: '+55', n: 'BR' }, { c: '+56', n: 'CL' }, { c: '+57', n: 'CO' }, { c: '+58', n: 'VE' },
            { c: '+60', n: 'MY' }, { c: '+61', n: 'AU' }, { c: '+62', n: 'ID' }, { c: '+63', n: 'PH' },
            { c: '+64', n: 'NZ' }, { c: '+65', n: 'SG' }, { c: '+66', n: 'TH' }, { c: '+81', n: 'JP' },
            { c: '+82', n: 'KR' }, { c: '+84', n: 'VN' }, { c: '+86', n: 'CN' }, { c: '+90', n: 'TR' },
            { c: '+91', n: 'IN' }, { c: '+92', n: 'PK' }, { c: '+93', n: 'AF' }, { c: '+94', n: 'LK' },
            { c: '+95', n: 'MM' }, { c: '+98', n: 'IR' }, { c: '+212', n: 'MA' }, { c: '+213', n: 'DZ' },
            { c: '+216', n: 'TN' }, { c: '+218', n: 'LY' }, { c: '+220', n: 'GM' }, { c: '+221', n: 'SN' },
            { c: '+234', n: 'NG' }, { c: '+254', n: 'KE' }, { c: '+255', n: 'TZ' }, { c: '+256', n: 'UG' },
            { c: '+351', n: 'PT' }, { c: '+353', n: 'IE' }, { c: '+358', n: 'FI' }, { c: '+380', n: 'UA' },
            { c: '+673', n: 'BN' }, { c: '+852', n: 'HK' }, { c: '+853', n: 'MO' }, { c: '+880', n: 'BD' },
            { c: '+886', n: 'TW' }, { c: '+966', n: 'SA' }, { c: '+971', n: 'AE' }, { c: '+972', n: 'IL' },
            { c: '+973', n: 'BH' }, { c: '+974', n: 'QA' }, { c: '+977', n: 'NP' }
          ].sort((a, b) => a.c === '+60' ? -1 : b.c === '+60' ? 1 : a.n.localeCompare(b.n)).map(opt => (
            <option key={opt.c} value={opt.c}>{opt.n} {opt.c}</option>
          ))}
        </select>
        <input
          id={safeId}
          type={type}
          value={num}
          onChange={handleNumChange}
          readOnly={readOnly}
          style={{
            flex: 1, width: '100%', boxSizing: 'border-box',
            background: readOnly ? 'var(--bg-2)' : 'var(--bg-3)', border: `1.5px solid ${error ? 'var(--red)' : 'var(--border)'}`,
            borderRadius: '0 9px 9px 0', padding: '10px 14px',
            color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
            opacity: readOnly ? 0.7 : 1, cursor: readOnly ? 'not-allowed' : 'text',
            ...style,
          }}
          {...props}
        />
      </div>
      {error && <p style={{ fontSize: 13, color: 'var(--red)', marginTop: 4, fontWeight: 500 }}>{error}</p>}
      {hint && !error && <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>{hint}</p>}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   SELECT
══════════════════════════════════════════════════════════ */
export const Dropdown = ({ label, value, onChange, options = [], style, id, name }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef();

  React.useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedOpt = options.find(o => (typeof o === 'string' ? o : o.value) === value);
  const selectedLabel = typeof selectedOpt === 'string' ? selectedOpt : (selectedOpt?.label || value || 'Select...');

  const generatedId = React.useId();
  const safeId = id || name || (label ? `sel-${label.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}` : `sel-${generatedId}`);

  return (
    <div ref={ref} style={{ marginBottom: label ? 14 : 0, position: 'relative', ...style }}>
      {label && <label htmlFor={safeId} style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>{label}</label>}
      <button
        type="button"
        id={safeId}
        onClick={() => setOpen(!open)}
        style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-3)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 14px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, marginLeft: 8 }}><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 6, zIndex: 100, boxShadow: 'var(--shadow-lg)', maxHeight: 250, overflowY: 'auto' }}>
          {options.map((o, i) => {
            const val = typeof o === 'string' ? o : o.value;
            const lab = typeof o === 'string' ? o : o.label;
            const isActive = val === value;
            return (
              <div
                key={i}
                onClick={() => { onChange(val); setOpen(false); }}
                style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 8, fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--accent)' : 'var(--text)', background: isActive ? 'var(--accent-dim)' : 'transparent', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-3)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                {lab}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   NATIVE SELECT (Restored for compatibility)
══════════════════════════════════════════════════════════ */
export const Sel = ({ label, options = [], style, id, name, ...props }) => {
  const generatedId = React.useId();
  const safeId = id || name || (label ? `sel-${label.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}` : `sel-${generatedId}`);
  const safeName = name || safeId;
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label htmlFor={safeId} style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>{label}</label>}
      <select
        id={safeId}
        name={safeName}
        style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-3)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', cursor: 'pointer', ...style }}
        {...props}
      >
        {options.map(o => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   CHIP / BADGE
══════════════════════════════════════════════════════════ */
export const Chip = ({ children, color = 'var(--accent)' }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${color}12`, color, borderRadius: 6, padding: '2px 8px', fontSize: 13, fontWeight: 600, border: `1px solid ${color}22`, whiteSpace: 'nowrap' }}>
    {children}
  </span>
);

/* ══════════════════════════════════════════════════════════
   CARD
══════════════════════════════════════════════════════════ */
export const Card = ({ children, style, accent, padding }) => (
  <div style={{ background: 'var(--card)', border: `1px solid var(--card-border)`, borderRadius: 14, padding: padding ?? '20px', boxShadow: 'var(--shadow)', ...(accent ? { borderLeft: `3px solid ${accent}` } : {}), ...style }}>
    {children}
  </div>
);

/* ══════════════════════════════════════════════════════════
   STAT CARD — clean metric tile
══════════════════════════════════════════════════════════ */
export const StatCard = ({ icon, label, value, sub, color = 'var(--accent)', onClick }) => (
  <div onClick={onClick} style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '18px 20px', boxShadow: 'var(--shadow)', cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.15s, box-shadow 0.15s' }}
    onMouseEnter={onClick ? (e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.10)'; }) : undefined}
    onMouseLeave={onClick ? (e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }) : undefined}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}12`, border: `1px solid ${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{icon}</div>
    </div>
    <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1, letterSpacing: '-0.04em', marginBottom: 4 }}>{value}</div>
    {sub && <div style={{ fontSize: 14, color: 'var(--text-3)' }}>{sub}</div>}
  </div>
);

/* ══════════════════════════════════════════════════════════
   MODAL
══════════════════════════════════════════════════════════ */
export const Modal = ({ title, open, onClose, children, maxWidth = 480 }) => {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(6px)' }} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-content" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px', width: '100%', maxWidth, boxShadow: 'var(--shadow-lg)', animation: 'modalPop 0.2s ease both', maxHeight: '90vh', overflowY: 'auto' }}>
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{title}</h3>
            <button onClick={onClose} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-3)', cursor: 'pointer', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   TOAST STACK
══════════════════════════════════════════════════════════ */


export const ToastStack = ({ toasts, dismiss }) => (
  <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
    {toasts.map(t => {
      const C = { error: { bar: 'var(--red)', icon: '✕' }, warn: { bar: 'var(--amber)', icon: '!' }, success: { bar: 'var(--green)', icon: '✓' } }[t.type] || { bar: 'var(--green)', icon: '✓' };
      return (
        <div key={t.id} onClick={() => dismiss(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-2)', border: '1px solid var(--border)', borderLeft: `3px solid ${C.bar}`, borderRadius: 10, padding: '11px 14px', fontSize: 15, fontWeight: 500, color: 'var(--text)', boxShadow: 'var(--shadow-md)', cursor: 'pointer', animation: 'toastIn 0.25s ease both' }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: C.bar, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>{C.icon}</div>
          {t.msg}
        </div>
      );
    })}
  </div>
);

/* ══════════════════════════════════════════════════════════
   THEME TOGGLE
══════════════════════════════════════════════════════════ */
export const ThemeToggle = ({ isDark, onToggle }) => (
  <button onClick={onToggle} title="Toggle theme" style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', fontSize: 16, width: 34, height: 34 }}>
    <img src={isDark ? SunIcon : MoonIcon} alt="Toggle Theme" style={{ width: 22, height: 22 }} />
  </button>
);

/* ══════════════════════════════════════════════════════════
   SECTION TITLE
══════════════════════════════════════════════════════════ */
export const SectionTitle = ({ children, sub, action }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
    <div>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{children}</h2>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>{sub}</p>}
    </div>
    {action}
  </div>
);

/* ══════════════════════════════════════════════════════════
   TABLE HELPERS
══════════════════════════════════════════════════════════ */
export const Th = ({ children }) => (
  <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
    {children}
  </th>
);
export const Td = ({ children, style }) => (
  <td style={{ padding: '11px 14px', fontSize: 13, borderBottom: '1px solid var(--border)', verticalAlign: 'middle', color: 'var(--text)', ...style }}>
    {children}
  </td>
);

/* ══════════════════════════════════════════════════════════
   EMPTY STATE
══════════════════════════════════════════════════════════ */
export const EmptyState = ({ icon = '○', title, sub }) => (
  <div style={{ textAlign: 'center', padding: '48px 20px' }}>
    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg-3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 14px' }}>{icon}</div>
    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>{title}</div>
    {sub && <div style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 280, margin: '0 auto' }}>{sub}</div>}
  </div>
);

/* ══════════════════════════════════════════════════════════
   DIVIDER
══════════════════════════════════════════════════════════ */
export const Divider = ({ label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    {label && <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>}
    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
  </div>
);
