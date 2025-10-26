

class DarkModeManager {
  constructor() {
    this.storageKey = 'adminDarkMode';
    this.themeAttribute = 'data-theme';
    this.init();
  }

  init() {
    
    const savedTheme = this.getStoredTheme();
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme !== null) {
      this.setTheme(savedTheme === 'dark');
    } else {
      
      this.setTheme(systemPrefersDark);
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      
      if (this.getStoredTheme() === null) {
        this.setTheme(e.matches);
      }
    });

    this.bindToggleEvent();
  }

  setTheme(isDark) {
    const root = document.documentElement;
    
    if (isDark) {
      root.setAttribute(this.themeAttribute, 'dark');
    } else {
      root.removeAttribute(this.themeAttribute);
    }

    this.updateToggleState(isDark);

    this.storeTheme(isDark ? 'dark' : 'light');

    window.dispatchEvent(new CustomEvent('themeChanged', { 
      detail: { theme: isDark ? 'dark' : 'light' } 
    }));
  }

  toggleTheme() {
    const isCurrentlyDark = document.documentElement.hasAttribute(this.themeAttribute);
    this.setTheme(!isCurrentlyDark);
  }

  isDarkMode() {
    return document.documentElement.hasAttribute(this.themeAttribute);
  }

  bindToggleEvent() {
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) {
      toggle.addEventListener('change', (e) => {
        this.setTheme(e.target.checked);
      });
    }
  }

  updateToggleState(isDark) {
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) {
      toggle.checked = isDark;
    }
  }

  getStoredTheme() {
    try {
      return localStorage.getItem(this.storageKey);
    } catch (e) {
      console.warn('Could not access localStorage for theme preference:', e);
      return null;
    }
  }

  storeTheme(theme) {
    try {
      localStorage.setItem(this.storageKey, theme);
    } catch (e) {
      console.warn('Could not store theme preference:', e);
    }
  }

  resetToSystemPreference() {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.setTheme(systemPrefersDark);
    localStorage.removeItem(this.storageKey);
  }

  getCurrentTheme() {
    return this.isDarkMode() ? 'dark' : 'light';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.darkModeManager = new DarkModeManager();
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DarkModeManager;
}
