import React from 'react';
import { token } from '../../utils/api';
import giftIcon from '../../assets/icons/gift-icon.png';

export function FloatingSignupHook() {
  return (
    <div 
      className="floating-signup-hook"
      onClick={() => {
        token.clear();
        sessionStorage.setItem('rwash_login_tab', 'signup-individual');
        window.location.href = window.location.pathname + '?t=' + Date.now() + '#/';
      }}
    >
      <div className="fsh-icon"><img src={giftIcon} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} /></div>
      <div className="fsh-text">
        <span className="fsh-title">Unlock Loyalty Discounts!</span>
        <span className="fsh-sub">Register now to track your washes & earn rewards</span>
      </div>
    </div>
  );
}
