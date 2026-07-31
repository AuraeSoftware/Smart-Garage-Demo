export const checkSessionLimit = (sessions, branchSubscription, navigate) => {
  const maxSessions = branchSubscription?.max_sessions || 0;
  if (maxSessions <= 0) return true;

  if (sessions.length >= maxSessions) {
    window.dispatchEvent(new CustomEvent('show_limit_modal'));
    return false;
  }
  return true;
};
