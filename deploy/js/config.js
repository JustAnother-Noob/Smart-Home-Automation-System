

const DEPLOYMENT_MODE = 'auto'; 

const CONFIG = {
  
  API_URL: (function() {
    
    try {
      const params = new URLSearchParams(window.location.search || '');
      const override = params.get('api') || params.get('apiBase');
      if (override) {
        const base = override.replace(/\/+$/, '');
        return base.endsWith('/api') ? base : `${base}/api`;
      }
    } catch (e) {}

    const host = (window.location && window.location.hostname) ? window.location.hostname : 'localhost';

    let mode = DEPLOYMENT_MODE;
    if (mode === 'auto') {
      
      mode = (host === 'localhost' || host === '127.0.0.1') ? 'development' : 'production';
    }

    if (mode === 'development') {
      
      return 'http://127.0.0.1:5002/api';
    } else {

      return '/api';
    }
  })(),

  get API_BASE() {
    return this.API_URL.replace(/\/api\/?$/, '');
  },

  get IS_DEVELOPMENT() {
    const host = window.location.hostname;
    return DEPLOYMENT_MODE === 'development' || 
           (DEPLOYMENT_MODE === 'auto' && (host === 'localhost' || host === '127.0.0.1'));
  },

  get IS_PRODUCTION() {
    return !this.IS_DEVELOPMENT;
  },

  get DEBUG() {
    return this.IS_DEVELOPMENT;
  },

  DEV_ALLOW_INSECURE_TOKEN_SOURCES: true,
  ENABLE_CONSOLE_LOGS: DEPLOYMENT_MODE === 'development' || DEPLOYMENT_MODE === 'auto'
};

window.debugLog = CONFIG.DEBUG ? console.log.bind(console) : () => {};
window.debugWarn = CONFIG.DEBUG ? console.warn.bind(console) : () => {};
window.debugError = console.error.bind(console); 

if (CONFIG.DEBUG) {
  console.log('🔧 CONFIG loaded:', {
    MODE: DEPLOYMENT_MODE,
    DETECTED_ENV: CONFIG.IS_DEVELOPMENT ? 'Development' : 'Production',
    API_URL: CONFIG.API_URL,
    API_BASE: CONFIG.API_BASE,
    HOSTNAME: window.location.hostname
  });
}

window.CONFIG = CONFIG;

Object.freeze(CONFIG);
