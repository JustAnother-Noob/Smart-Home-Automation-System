

(function() {
  'use strict';
  
  try {
    const savedTheme = localStorage.getItem('adminDarkMode');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (savedTheme === null && systemPrefersDark)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {
    
    console.warn('Could not access localStorage for theme preference:', e);
  }
})();
