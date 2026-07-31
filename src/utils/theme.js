export const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
};