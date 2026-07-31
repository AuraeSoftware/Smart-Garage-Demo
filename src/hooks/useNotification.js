import { useState, useCallback, useRef } from 'react';

export const useNotification = () => {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const notify = useCallback((msg, type = 'success', duration = 3500) => {
    const id = ++counter.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, notify, dismiss };
};
