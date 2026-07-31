import { useState, useEffect, useCallback } from 'react';
import { applyTheme } from '../utils/theme';

const STORAGE_KEY = 'washpro:theme';

export const useTheme = () => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'light'; // default light
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { theme, toggleTheme, isDark: theme === 'dark' };
};