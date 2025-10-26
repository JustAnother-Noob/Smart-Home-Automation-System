

(function() {
  'use strict';

  function createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'nav-loading-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 99999;
      pointer-events: none;
      transition: opacity 0.4s ease, visibility 0.4s ease;
    `;
    
    document.body.appendChild(overlay);
    return overlay;
  }

  function removeLoadingOverlay(overlay) {
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.visibility = 'hidden';
      
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.remove();
        }
      }, 400);
    }
  }

  function ensureBodyScroll() {
    
    document.body.style.cssText += 'overflow: visible !important; overflow-y: auto !important;';
    document.documentElement.style.cssText += 'overflow: visible !important; overflow-y: auto !important;';

    document.body.classList.remove('no-scroll', 'modal-open', 'overflow-hidden');
    document.documentElement.classList.remove('no-scroll', 'modal-open', 'overflow-hidden');
  }

  if (document.body) {
    ensureBodyScroll();
  }

  setTimeout(ensureBodyScroll, 100);
  setTimeout(ensureBodyScroll, 500);
  setTimeout(ensureBodyScroll, 1000);

  async function loadComponents() {
    const overlay = createLoadingOverlay();
    ensureBodyScroll(); 
    const navbarContainer = document.getElementById('navbar');
    const footerContainer = document.getElementById('footer');

    try {
      const promises = [];

      if (navbarContainer) {
        const navPromise = fetch('./user_nav.html')
          .then(r => r.text())
          .then(html => {
            navbarContainer.innerHTML = html;
            
            const navbarMain = navbarContainer.querySelector('.navbar-main');
            if (navbarMain) {
              requestAnimationFrame(() => {
                navbarMain.classList.add('loaded');
              });
            }
          });
        promises.push(navPromise);
      }

      if (footerContainer) {
        const footerPromise = fetch('./user_footer.html')
          .then(r => r.text())
          .then(html => {
            footerContainer.innerHTML = html;
          });
        promises.push(footerPromise);
      }

      await Promise.all(promises);

      if (navbarContainer) {
        await loadNavScripts();
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      removeLoadingOverlay(overlay);

      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.classList.add('loaded');
      }

      ensureBodyScroll();

    } catch (error) {
      console.error('Error loading components:', error);
      
      removeLoadingOverlay(overlay);

      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.classList.add('loaded');
      }
      
      ensureBodyScroll();
    }
  }

  function loadNavScripts() {
    return new Promise((resolve) => {
      const navScript = document.createElement('script');
      navScript.src = '../js/nav.js';
      navScript.onload = () => {
        const userNavScript = document.createElement('script');
        userNavScript.src = '../js/user/user_nav.js';
        userNavScript.defer = true;
        userNavScript.onload = resolve;
        userNavScript.onerror = resolve;
        document.body.appendChild(userNavScript);
      };
      navScript.onerror = resolve;
      document.body.appendChild(navScript);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadComponents);
  } else {
    loadComponents();
  }

})();
