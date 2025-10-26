

(function(){
  const CSS_PATH = '../css/components/notification.css';
  async function ensureCss(){
    if(document.getElementById('global-notification-css')) return;
    const link = document.createElement('link');
    link.id = 'global-notification-css';
    link.rel = 'stylesheet';
    link.href = CSS_PATH;
    document.head.appendChild(link);
  }

  async function init(){
    try {
      await ensureCss();
      const root = document.getElementById('notification-root');
      if(!root) return;
      const resp = await fetch('../html/components/notification.html');
      if(!resp.ok) return;
      const html = await resp.text();
      root.innerHTML = html;

      window.showNotification = function(message, type='info', options={}){
        try {
          const container = document.getElementById('global-notifications');
          if(!container) return null;
          
          const existing = container.querySelectorAll('.global-notification');
          
          const REMOVE_ANIM_MS = 240;
          const BUFFER_MS = 20; 
          let removalDelay = 0;
          if (existing.length >= 3) {
            const first = existing[0];
            
            try {
              const tid = first.dataset && first.dataset.timeoutId;
              if (tid) clearTimeout(Number(tid));
            } catch (e) {  }
            first.classList.add('hide');
            
            setTimeout(() => { if (first.parentNode) first.remove(); }, REMOVE_ANIM_MS);
            removalDelay = REMOVE_ANIM_MS + BUFFER_MS;
          }

          const id = 'notif-' + Date.now() + '-' + Math.floor(Math.random()*1000);
          const el = document.createElement('div');
          el.className = 'global-notification ' + (type||'info');
          el.id = id;
          el.setAttribute('role','status');
          el.innerHTML = `
            <div class="notif-body">
              <div class="notif-message">${String(message)}</div>
              <button class="notif-close" aria-label="Dismiss">&times;</button>
            </div>
          `;

          let timeout = null;
          const appendAndWire = () => {
            container.appendChild(el);

            const ttl = (options.ttl && Number(options.ttl)) || (type==='error' ? 6000 : 3500);
            timeout = setTimeout(()=> { if(el.parentNode) el.classList.add('hide'); setTimeout(()=> el.remove(), 400); }, ttl);
            
            try { el.dataset.timeoutId = timeout; } catch (e) {  }

            const closeBtn = el.querySelector('.notif-close');
            closeBtn.addEventListener('click', () => { clearTimeout(timeout); el.classList.add('hide'); setTimeout(()=> el.remove(), 240); });

            requestAnimationFrame(()=> el.classList.add('show'));
          };

          if (removalDelay > 0) {
            
            setTimeout(appendAndWire, removalDelay);
          } else {
            appendAndWire();
          }

          return el;
        } catch (e) { console.warn('showNotification failed', e); return null; }
      };

      window.showCartNotification = function(message, type='success'){
        return window.showNotification(message, type);
      };

    } catch (e) { console.warn('notification-loader init failed', e); }
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
