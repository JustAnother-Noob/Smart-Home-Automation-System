
(function(){
  const sessionKey = 'cartSessionId';

  function getStoredSessionId() {
    return localStorage.getItem(sessionKey);
  }
  
  const API = (window.CONFIG && window.CONFIG.API_URL ? window.CONFIG.API_URL : '/api');
  const selectors = ['cart-count','mobile-cart-count'];

  function updateSessionFromResponse(response) {
    const backendSessionId = response.headers.get('X-Session-ID');
    const currentSessionId = getStoredSessionId();
    if (backendSessionId && backendSessionId !== currentSessionId) {
      localStorage.setItem(sessionKey, backendSessionId);
      console.log('🔄 Nav: Session updated from backend:', backendSessionId.slice(-8));
    }
  }

  async function recoverCartSession() {
    try {
      const token = localStorage.getItem('authToken');
      if (token) return; 
      
      const sessionId = getStoredSessionId();
      if (!sessionId) return; 

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); 
      
      const res = await fetch(`${API}/cart`, { 
        headers: { 'x-session-id': sessionId },
        credentials: 'include',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok && (res.status === 404 || res.status === 400)) {
        
        console.log('🔄 [nav.js] Invalid session detected, clearing...');
        localStorage.removeItem(sessionKey);
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.warn('Session recovery failed:', e);
      }
    }
  }
  
  async function refreshCartCount(){
    try {
      const token = localStorage.getItem('authToken');
      const sessionId = getStoredSessionId(); 
      
      console.log('🔄 [nav.js] refreshCartCount called:', { 
        hasToken: !!token, 
        hasSession: !!sessionId,
        sessionId: sessionId?.slice(-8) 
      });

      const headers = {};

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('👤 [nav.js] Fetching cart with auth token (logged in)');
      } else if (sessionId) {
        headers['x-session-id'] = sessionId;
        console.log('🔍 [nav.js] Fetching cart with session ID (guest):', sessionId.slice(-8));
      }
      
      const res = await fetch(`${API}/cart`, { headers, credentials: 'include' });
      
      console.log('📡 [nav.js] Cart fetch response:', { 
        status: res.status, 
        ok: res.ok 
      });

      if (!token) {
        updateSessionFromResponse(res);
      }
      
      if (!res.ok) {
        console.warn('❌ [nav.js] Cart fetch failed:', res.status);
        if (res.status === 401 || res.status === 403) {
          
          selectors.forEach(id => { const el = document.getElementById(id); if(el) el.textContent = '0'; });
        }
        return;
      }
      
      const data = await res.json();
      console.log('📦 [nav.js] Cart data received:', { 
        success: data.success, 
        itemCount: data.cart?.items?.length || 0,
        totalQuantity: (data.cart?.items||[]).reduce((s,i)=> s + (i.quantity||0), 0)
      });
      
      if (data.success && data.cart) {
        const count = (data.cart.items||[]).reduce((s,i)=> s + (i.quantity||0), 0);
        console.log('✅ [nav.js] Setting cart count to:', count);
        selectors.forEach(id => { 
          const el = document.getElementById(id); 
          if(el) {
            el.textContent = count;
            console.log(`   Updated #${id} to ${count}`);
          } else {
            console.warn(`   Element #${id} not found`);
          }
        });
      } else {
        
        console.warn('⚠️ [nav.js] Cart endpoint not available:', data.message || 'Unknown error');
        console.warn('💡 [nav.js] Backend needs deployment - using fallback count of 0');
        selectors.forEach(id => { 
          const el = document.getElementById(id); 
          if(el) el.textContent = '0'; 
        });
      }
    } catch(e){ 
      
      console.error('❌ [nav.js] Cart count refresh failed:', e.message, e);
    }
  }

  function handleCartUpdate(event) {
    try {
      const cartData = event.detail;
      if (cartData && cartData.items) {
        const count = cartData.items.reduce((s,i)=> s + (i.quantity||0), 0);
        selectors.forEach(id => { 
          const el = document.getElementById(id); 
          if(el) el.textContent = count; 
        });
      } else {
        
        setTimeout(refreshCartCount, 100);
      }
    } catch(e) {
      console.warn('Cart update handling failed:', e.message);
      
      setTimeout(refreshCartCount, 100);
    }
  }

  ['cart:updated','cart:changed'].forEach(evt => {
    window.addEventListener(evt, handleCartUpdate);
    document.addEventListener(evt, handleCartUpdate);
  });

  function initCartCount() {
    const cartElements = document.querySelectorAll('.cart-count, #cart-count, #mobile-cart-count');
    console.log(`🔍 [nav.js] initCartCount - found ${cartElements.length} cart elements`);
    
    if (cartElements.length > 0) {
      
      console.log('✅ [nav.js] Cart elements found, calling refreshCartCount() immediately');
      refreshCartCount();
      
      recoverCartSession();
    } else {
      
      console.log('⏳ [nav.js] Cart elements not found, waiting...');
      setTimeout(initCartCount, 100);
    }
  }
  
  if(document.readyState === 'loading'){
    console.log('📄 [nav.js] DOM still loading, adding DOMContentLoaded listener');
    document.addEventListener('DOMContentLoaded', initCartCount);
  } else {
    console.log('📄 [nav.js] DOM already loaded, calling initCartCount immediately');
    initCartCount();
  }

  window.refreshCartCount = refreshCartCount;
})();

(function() {
  
  function initMobileMenu() {
    const menuButton = document.getElementById('mobile-menu-button');
    const mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');
    const mobileBottomMenu = document.querySelector('.mobile-bottom-menu');
    const menuCloseButton = document.querySelector('.mobile-menu-close');
    const menuContent = document.getElementById('mobile-menu-content');
    
    if (!menuButton) {
      console.log('Mobile menu button not found, skipping mobile menu init');
      return;
    }

    function populateMobileMenu() {
      if (!menuContent) return;
      
      const navLinks = document.querySelectorAll('.navbar-links .nav-link');
      if (navLinks.length === 0) return;

      const categoriesSection = document.createElement('div');
      categoriesSection.className = 'mobile-menu-section';
      
      const categoriesTitle = document.createElement('h3');
      categoriesTitle.textContent = 'Browse Categories';
      categoriesSection.appendChild(categoriesTitle);
      
      const categoriesList = document.createElement('ul');
      categoriesList.className = 'mobile-menu-links';
      
      navLinks.forEach(link => {
        const text = link.textContent.trim();
        const lower = text.toLowerCase();
        
        if (lower.includes('installation') || lower.includes('track order')) return;
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = link.href;
        a.textContent = text;
        
        const icon = document.createElement('i');
        if (lower.includes('clearance') || lower.includes('sale')) {
          icon.className = 'fi fi-rr-badge-percent';
        } else if (lower.includes('camera') || lower.includes('security')) {
          icon.className = 'fi fi-rr-camera';
        } else if (lower.includes('thermostat') || lower.includes('climate')) {
          icon.className = 'fi fi-rr-temperature-high';
        } else if (lower.includes('light') || lower.includes('bulb')) {
          icon.className = 'fi fi-rr-bulb';
        } else if (lower.includes('lock') || lower.includes('door')) {
          icon.className = 'fi fi-rr-lock';
        } else if (lower.includes('speaker') || lower.includes('audio')) {
          icon.className = 'fi fi-rr-speaker';
        } else if (lower.includes('sensor') || lower.includes('detect')) {
          icon.className = 'fi fi-rr-sensor';
        } else if (lower.includes('hub') || lower.includes('control')) {
          icon.className = 'fi fi-rr-settings';
        } else if (lower.includes('plug') || lower.includes('outlet')) {
          icon.className = 'fi fi-rr-plug';
        } else {
          icon.className = 'fi fi-rr-apps';
        }
        a.prepend(icon);
        li.appendChild(a);
        categoriesList.appendChild(li);
      });
      
      categoriesSection.appendChild(categoriesList);
      menuContent.appendChild(categoriesSection);

      const servicesSection = document.createElement('div');
      servicesSection.className = 'mobile-menu-section';
      
      const servicesTitle = document.createElement('h3');
      servicesTitle.textContent = 'Services';
      servicesSection.appendChild(servicesTitle);
      
      const servicesList = document.createElement('ul');
      servicesList.className = 'mobile-menu-links';
      
      const services = [
        { text: 'Installation Service', href: 'user_installation.html', icon: 'fi fi-rr-tool-box' },
        { text: 'Track My Order', href: 'user_track_order.html', icon: 'fi fi-rr-box' }
      ];
      
      services.forEach(serviceData => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = serviceData.href;
        a.textContent = serviceData.text;
        
        const icon = document.createElement('i');
        icon.className = serviceData.icon;
        
        a.prepend(icon);
        li.appendChild(a);
        servicesList.appendChild(li);
      });
      
      servicesSection.appendChild(servicesList);
      menuContent.appendChild(servicesSection);

      const quickLinksSection = document.createElement('div');
      quickLinksSection.className = 'mobile-menu-section';
      
      const quickLinksTitle = document.createElement('h3');
      quickLinksTitle.textContent = 'Quick Links';
      quickLinksSection.appendChild(quickLinksTitle);
      
      const quickLinksList = document.createElement('ul');
      quickLinksList.className = 'mobile-menu-links';
      
      const quickLinks = [
        { text: 'All Products', href: 'user_products.html', icon: 'fi fi-rr-apps' },
        { text: 'My Account', href: 'user_account.html', icon: 'fi fi-rr-user' },
        { text: 'Shopping Cart', href: 'user_cart.html', icon: 'fi fi-rr-shopping-cart' },
        { text: 'Contact Us', href: 'user_contact.html', icon: 'fi fi-rr-headset' }
      ];
      
      quickLinks.forEach(linkData => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = linkData.href;
        a.textContent = linkData.text;
        
        const icon = document.createElement('i');
        icon.className = linkData.icon;
        
        a.prepend(icon);
        li.appendChild(a);
        quickLinksList.appendChild(li);
      });
      
      quickLinksSection.appendChild(quickLinksList);
      menuContent.appendChild(quickLinksSection);
    }

    function toggleMobileMenu() {
      const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
      
      if (isOpen) {
        
        menuButton.setAttribute('aria-expanded', 'false');
        if (mobileMenuOverlay) mobileMenuOverlay.classList.remove('active');
        if (mobileBottomMenu) mobileBottomMenu.classList.remove('active');
        document.body.style.overflow = '';
      } else {
        
        menuButton.setAttribute('aria-expanded', 'true');
        if (mobileMenuOverlay) mobileMenuOverlay.classList.add('active');
        if (mobileBottomMenu) mobileBottomMenu.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }

    function closeMobileMenu() {
      menuButton.setAttribute('aria-expanded', 'false');
      if (mobileMenuOverlay) mobileMenuOverlay.classList.remove('active');
      if (mobileBottomMenu) mobileBottomMenu.classList.remove('active');
      document.body.style.overflow = '';
    }

    if (menuButton) {
      menuButton.addEventListener('click', toggleMobileMenu);
    }
    
    if (menuCloseButton) {
      menuCloseButton.addEventListener('click', closeMobileMenu);
    }
    
    if (mobileMenuOverlay) {
      mobileMenuOverlay.addEventListener('click', closeMobileMenu);
    }

    if (mobileBottomMenu) {
      const menuLinks = mobileBottomMenu.querySelectorAll('a');
      menuLinks.forEach(link => {
        link.addEventListener('click', closeMobileMenu);
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMobileMenu();
      }
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        
        if (window.innerWidth > 828) {
          closeMobileMenu();
        }
      }, 250);
    });

    populateMobileMenu();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileMenu);
  } else {
    initMobileMenu();
  }
})();

(function() {
  function syncSearchInputs() {
    const desktopSearch = document.getElementById('search-input');
    const mobileSearch = document.getElementById('search-input-mobile');
    const desktopButton = document.querySelector('.navbar-search-desktop .search-button');
    const mobileButton = document.querySelector('.navbar-search-mobile .search-button');
    
    if (!desktopSearch || !mobileSearch) return;

    desktopSearch.addEventListener('input', (e) => {
      mobileSearch.value = e.target.value;
    });

    mobileSearch.addEventListener('input', (e) => {
      desktopSearch.value = e.target.value;
    });

    function handleSearch(searchValue) {
      if (!searchValue || searchValue.trim() === '') return;

      const searchParams = new URLSearchParams();
      searchParams.set('search', searchValue.trim());
      window.location.href = `user_products.html?${searchParams.toString()}`;
    }

    desktopSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch(desktopSearch.value);
      }
    });
    
    if (desktopButton) {
      desktopButton.addEventListener('click', (e) => {
        e.preventDefault();
        handleSearch(desktopSearch.value);
      });
    }

    mobileSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch(mobileSearch.value);
      }
    });
    
    if (mobileButton) {
      mobileButton.addEventListener('click', (e) => {
        e.preventDefault();
        handleSearch(mobileSearch.value);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncSearchInputs);
  } else {
    syncSearchInputs();
  }
})();
