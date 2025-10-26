

(function() {
  'use strict';

  const navbarContainer = document.getElementById('navbar');
  const footerContainer = document.getElementById('footer');

  function emitComponentLoaded(componentName) {
    const event = new CustomEvent('componentLoaded', {
      detail: { component: componentName, timestamp: Date.now() }
    });
    window.dispatchEvent(event);
    console.log(`✅ ${componentName} loaded`);
  }

  async function loadComponents() {
    const loadPromises = [];

    if (navbarContainer) {
      const navPromise = fetch('./user_nav.html')
        .then(response => {
          if (!response.ok) throw new Error('Navbar load failed');
          return response.text();
        })
        .then(html => {
          navbarContainer.innerHTML = html;
          emitComponentLoaded('navbar');

          return loadNavbarScripts();
        })
        .catch(error => {
          console.error('Error loading navbar:', error);
          navbarContainer.innerHTML = '<div style="padding:1rem;background:#fee;color:#c00;">Navbar failed to load</div>';
        });
      
      loadPromises.push(navPromise);
    }

    if (footerContainer) {
      const footerPromise = fetch('./user_footer.html')
        .then(response => {
          if (!response.ok) throw new Error('Footer load failed');
          return response.text();
        })
        .then(html => {
          footerContainer.innerHTML = html;
          emitComponentLoaded('footer');
        })
        .catch(error => {
          console.error('Error loading footer:', error);
          footerContainer.innerHTML = '<div style="padding:1rem;background:#fee;color:#c00;text-align:center;">Footer failed to load</div>';
        });
      
      loadPromises.push(footerPromise);
    }

    await Promise.all(loadPromises);
  }

  function loadNavbarScripts() {
    return new Promise((resolve) => {
      
      const navScript = document.createElement('script');
      navScript.src = '../js/nav.js';
      navScript.onload = () => {
        console.log('✅ nav.js loaded');

        const userNavScript = document.createElement('script');
        userNavScript.src = '../js/user/user_nav.js';
        userNavScript.defer = true;
        userNavScript.onload = () => {
          console.log('✅ user_nav.js loaded');
          emitComponentLoaded('navbar-scripts');
          resolve();
        };
        userNavScript.onerror = () => {
          console.error('❌ user_nav.js failed to load');
          resolve(); 
        };
        document.body.appendChild(userNavScript);
      };
      navScript.onerror = () => {
        console.error('❌ nav.js failed to load');
        resolve(); 
      };
      document.body.appendChild(navScript);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadComponents);
  } else {
    loadComponents();
  }

})();
