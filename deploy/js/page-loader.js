

(function() {
  'use strict';

  function createPageLoader() {
    const loaderHTML = `
      <div id="page-loader">
        <div class="loader-content">
          <div class="loader-spinner"></div>
          <p class="loader-text">Loading<span class="loader-dots"></span></p>
        </div>
      </div>
    `;

    if (document.body) {
      document.body.insertAdjacentHTML('afterbegin', loaderHTML);
    } else {
      
      document.addEventListener('DOMContentLoaded', function() {
        document.body.insertAdjacentHTML('afterbegin', loaderHTML);
      });
    }
  }

  function hidePageLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) {
      
      loader.classList.add('loaded');

      document.body.classList.add('page-loaded');

      setTimeout(() => {
        if (loader.parentNode) {
          loader.remove();
        }
      }, 500);
    }
  }

  function checkPageReady() {

    const minLoadTime = 300; 
    const maxLoadTime = 5000; 
    const startTime = Date.now();
    
    function attemptHide() {
      const elapsedTime = Date.now() - startTime;

      if (elapsedTime >= maxLoadTime) {
        console.log('Page loader: Max wait time reached, hiding loader');
        hidePageLoader();
        return;
      }

      const hasNavbar = document.getElementById('navbar') && 
                       document.getElementById('navbar').children.length > 0;
      const hasFooter = document.getElementById('footer') && 
                       document.getElementById('footer').children.length > 0;
      const hasMainContent = document.querySelector('main') !== null;

      const needsNavbar = document.getElementById('navbar') !== null;
      const needsFooter = document.getElementById('footer') !== null;

      const navReady = !needsNavbar || hasNavbar;
      const footerReady = !needsFooter || hasFooter;
      const contentReady = hasMainContent || document.body.children.length > 2;
      const minTimeElapsed = elapsedTime >= minLoadTime;
      
      if (navReady && footerReady && contentReady && minTimeElapsed) {
        console.log('Page loader: All components loaded, hiding loader');
        hidePageLoader();
      } else {
        
        setTimeout(attemptHide, 100);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attemptHide);
    } else {
      attemptHide();
    }
  }

  window.addEventListener('componentLoaded', function(e) {
    console.log('Page loader: Component loaded -', e.detail);
  });

  createPageLoader();
  checkPageReady();

  window.hidePageLoader = hidePageLoader;

  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      
      const loader = document.getElementById('page-loader');
      if (loader && !loader.classList.contains('loaded')) {
        const pageAge = Date.now() - performance.timing.navigationStart;
        if (pageAge > 3000) {
          console.log('Page loader: User returned to tab, hiding loader');
          hidePageLoader();
        }
      }
    }
  });

  window.addEventListener('load', function() {
    setTimeout(hidePageLoader, 200);
  });

})();
