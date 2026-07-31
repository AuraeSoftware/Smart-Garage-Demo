import { useState, useEffect } from 'react';

export function useHashNav(defaultNav = '') {
  const getHash = () => {
    const hash = window.location.hash.replace('#', '');
    return hash || defaultNav;
  };

  const [nav, setNavState] = useState(getHash());

  useEffect(() => {
    const handleHashChange = () => {
      setNavState(getHash());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [defaultNav]);

  const setNav = (newNav) => {
    if (newNav !== getHash()) {
      window.location.hash = newNav;
    } else if (newNav !== nav) {
      setNavState(newNav);
    }
  };

  return [nav, setNav];
}
