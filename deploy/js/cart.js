
(function(){
  const API = (window.CONFIG && CONFIG.API_URL ? CONFIG.API_URL : '/api').replace(/\/$/, '');
  const sessionKey = 'cartSessionId';

  let sessionId = localStorage.getItem(sessionKey);

  function updateSessionFromResponse(response, data) {
    
    const backendSessionId = response.headers.get('X-Session-ID') || response.headers.get('x-session-id');

    const sessionIdFromBody = data?.sessionId || data?.cart?.sessionId;
    
    const finalSessionId = backendSessionId || sessionIdFromBody;
    
    console.log('🔍 [cart.js] Checking for session:', {
      'fromHeader': backendSessionId,
      'fromBody-topLevel': data?.sessionId,
      'fromBody-cart': data?.cart?.sessionId,
      'finalValue': finalSessionId
    });
    
    if (finalSessionId && finalSessionId !== sessionId) {
      sessionId = finalSessionId;
      localStorage.setItem(sessionKey, sessionId);
      console.log('🔄 Session updated from backend:', sessionId.slice(-8));
    } else if (!finalSessionId) {
      console.warn('❌ No session ID found in response header or body');
    }
  }

  function notify(msg, type='info'){
    console.log('[cart]', msg);
    try {
      if (typeof window.showNotification === 'function') {
        const res = window.showNotification(msg, type, { ttl: type === 'error' ? 6000 : 3500 });
        if (res) return;
      }
    } catch (e) {
      console.warn('showNotification failed, falling back to inline toasts', e);
    }

    let bar = document.getElementById('cart-toast');
    if(!bar){
      bar = document.createElement('div');
      bar.id = 'cart-toast';
      bar.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;max-width:320px;';
      document.body.appendChild(bar);
    }
    
    while(bar.children.length >= 3) bar.removeChild(bar.firstChild);

    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'background:#0f172a;color:#fff;padding:10px 14px;border-radius:8px;box-shadow:0 4px 10px -2px rgba(0,0,0,.4);font-size:.8rem;opacity:0;transform:translateY(6px);transition:all .25s;word-wrap:break-word;';
    if(type==='error') el.style.background = '#dc2626';
    if(type==='success') el.style.background = '#15803d';
    if(type==='info') el.style.background = '#2563eb';

    bar.appendChild(el);
    requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.transform='translateY(0)'; });

    setTimeout(()=>{ 
      if(el.parentNode) {
        el.style.opacity='0'; 
        el.style.transform='translateY(6px)'; 
        setTimeout(()=>{ if(el.parentNode) el.remove(); }, 250); 
      }
    }, type === 'error' ? 5000 : 3000); 
  }

  async function addToCart(productId, quantity=1){
    
    if (!productId || typeof productId !== 'string' || productId.trim() === '') {
      console.error('Invalid product ID provided to addToCart');
      notify('Invalid product ID', 'error');
      return;
    }
    
    try {
      
      const originalQuantity = quantity;
      const parsedQty = parseInt(quantity, 10);
      
      if (isNaN(parsedQty) || parsedQty < 1) {
        notify('Quantity must be at least 1', 'error');
        return;
      }
      
      quantity = Math.max(1, Math.min(999, parsedQty));

      if (quantity !== originalQuantity) {
        notify(`Quantity adjusted to ${quantity} (limit: 1-999)`, 'info');
      }
      
      const token = localStorage.getItem('authToken');
      const headers = { 'Content-Type':'application/json' };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('👤 [cart.js] Adding item with auth token (logged in)');
      } else if (sessionId) {
        headers['x-session-id'] = sessionId;
        console.log('🔍 [cart.js] Adding item with session ID (guest):', sessionId.slice(-8));
      } else {
        console.log('🆕 [cart.js] Adding item without session (backend will generate)');
      }
      
      const res = await fetch(`${API}/cart/items`, {
        method:'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ productId: productId.trim(), quantity })
      });
      
      if (!res.ok) {
        let errorMsg = 'Failed to add item to cart';
        if (res.status === 401) errorMsg = 'Please login to add items to cart';
        else if (res.status === 404) errorMsg = 'Product not found';
        else if (res.status === 400) {
          try {
            const errorData = await res.json();
            errorMsg = errorData.message || errorMsg;
          } catch(e) {  }
        }
        throw new Error(errorMsg);
      }
      
      const data = await res.json();

      if (!token) {
        updateSessionFromResponse(res, data);
      }
      
      if(!data.success){ 
        throw new Error(data.message || 'Failed to add item'); 
      }

      document.dispatchEvent(new CustomEvent('cart:updated', { detail: data.cart }));
      
      return data.cart;
    } catch(e){
      console.error('Error in addToCart:', e);

      throw e;
    }
  }

  async function getCart() {
    try {
      const token = localStorage.getItem('authToken');
      const headers = {};
      if (!token && sessionId) headers['x-session-id'] = sessionId;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API}/cart`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      const backendSession = res.headers.get('X-Session-ID') || res.headers.get('x-session-id');
      if (backendSession && backendSession !== sessionId) {
        sessionId = backendSession;
        localStorage.setItem(sessionKey, sessionId);
        console.log('🔄 Session updated from backend (getCart):', backendSession.slice(-8));
      }

      if (!res.ok) {
        let msg = 'Failed to fetch cart';
        if (res.status === 401) msg = 'Not authenticated';
        throw new Error(msg);
      }

      const data = await res.json();
      const cartObj = data.cart || data;

      try { document.dispatchEvent(new CustomEvent('cart:updated', { detail: cartObj })); } catch (e) {  }
      try { window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart: cartObj } })); } catch (e) {  }

      return cartObj;
    } catch (e) {
      console.error('Error fetching cart:', e);
      throw e;
    }
  }

  window.CartClient = { addToCart, getSessionId: () => sessionId, getCart };

  window.refreshCartCount = async function() {
    try {
      return await getCart();
    } catch (e) {
      
      return null;
    }
  };

  function bindButtons(root=document){
    root.querySelectorAll('[data-add-to-cart]').forEach(btn => {
      if(btn._cartBound) return; btn._cartBound = true;
      
      let isProcessing = false; 
      
      btn.addEventListener('click', async () => {
        if (isProcessing) {
          console.log('Add to cart already in progress, ignoring click');
          return;
        }
        
        const id = btn.getAttribute('data-product-id') || btn.getAttribute('data-add-to-cart');
        const qty = parseInt(btn.getAttribute('data-qty')||'1',10) || 1;
        
        if(!id) return notify('Missing product id','error');
        
        isProcessing = true;
        btn.disabled = true; 
        const old = btn.textContent; 
        btn.textContent = 'Adding…';
        
        try { 
          await addToCart(id, qty); 
          btn.textContent='Added'; 
          setTimeout(()=> {
            btn.textContent = old;
            btn.disabled = false;
            isProcessing = false;
          }, 1500);
        } catch(err) { 
          console.error('Error adding to cart:', err);
          btn.textContent='Error'; 
          setTimeout(()=> {
            btn.textContent = old;
            btn.disabled = false;
            isProcessing = false;
          }, 1500);
        }
      });
    });
  }
  bindButtons();
  document.addEventListener('DOMContentLoaded', ()=> bindButtons());
  document.addEventListener('products:rendered', e => bindButtons(e.detail?.root || document));
})();
