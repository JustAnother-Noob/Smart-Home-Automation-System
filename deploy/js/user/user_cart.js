console.log('[user_cart] script loaded');
(function(){
  const API = (typeof CONFIG !== 'undefined' ? CONFIG.API_URL : '/api').replace(/\/$/, '');
  const sessionKey = 'cartSessionId';

  if (window.CartClient && typeof window.CartClient.getSessionId === 'function') {
    const cartClientSession = window.CartClient.getSessionId();
    if (cartClientSession) {
      localStorage.setItem(sessionKey, cartClientSession);
    }
  }

  let sessionId = localStorage.getItem(sessionKey);

  let currentCartData = null;

  function updateSessionFromResponse(response) {
    const backendSessionId = response.headers.get('X-Session-ID');
    if (backendSessionId && backendSessionId !== sessionId) {
      sessionId = backendSessionId;
      localStorage.setItem(sessionKey, sessionId);
      console.log('🔄 Session updated from backend:', backendSessionId.slice(-8));
    }
  }

  const els = {
    container: document.getElementById('cartItems'),
    empty: document.getElementById('emptyState'),
    status: document.getElementById('cartStatus'), 
    summary: {
      items: document.getElementById('summaryItems'),
      subtotal: document.getElementById('summarySubtotal'),
      discount: document.getElementById('summaryDiscount'),
      discountRow: document.getElementById('discountRow'),
      total: document.getElementById('summaryTotal')
    },
    couponInput: document.getElementById('couponInput'),
    couponMsg: document.getElementById('couponMessage'),
    removeCouponBtn: document.getElementById('removeCouponBtn')
  };

  function format(amount){ return `$${(amount||0).toFixed(2)}`; }

  function extractUrl(val) {
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      
      try {
        const keys = Object.keys(val || {});
        if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
          const str = keys.sort((a,b) => Number(a) - Number(b)).map(k => val[k]).join('');
          if (str && str.length) return str;
        }
      } catch (e) {  }
      
      return val.url || val.path || val.src || val.imageUrl || null;
    }
    return null;
  }

  function showCouponMessage(message, type = 'info') {
    if (!els.couponMsg) return;
    
    els.couponMsg.style.display = 'block';
    els.couponMsg.textContent = message;

    const colors = {
      success: '#16a34a',
      error: '#dc2626',
      warning: '#f59e0b',
      info: '#6b7280'
    };
    
    els.couponMsg.style.color = colors[type] || colors.info;
  }

  function hideCouponMessage() {
    if (!els.couponMsg) return;
    els.couponMsg.style.display = 'none';
    els.couponMsg.textContent = '';
  }

  const rateLimiter = {
    operations: new Map(),
    isAllowed(key, cooldownMs = 500) {
      const now = Date.now();
      const lastCall = this.operations.get(key);
      
      if (lastCall && (now - lastCall) < cooldownMs) {
        return false;
      }
      
      this.operations.set(key, now);
      return true;
    }
  };

  function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showErrorNotification(message) {
    
    let errorEl = document.getElementById('cart-error-notification');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.id = 'cart-error-notification';
      errorEl.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        background: #dc2626; color: white; padding: 12px 16px;
        border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 300px; font-size: 0.9rem; line-height: 1.4;
        transform: translateX(100%); transition: transform 0.3s ease;
      `;
      document.body.appendChild(errorEl);
    }
    
    errorEl.textContent = message;
    errorEl.style.transform = 'translateX(0)';

    clearTimeout(errorEl._timeout);
    errorEl._timeout = setTimeout(() => {
      errorEl.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (errorEl.parentNode) errorEl.remove();
      }, 300);
    }, 4000);
  }

  async function fetchCart(){
    try {
      if (els.status) els.status.textContent = 'Loading…';
      const token = localStorage.getItem('authToken');
      const headers = {};
      
      if (!token && sessionId) {
        headers['x-session-id'] = sessionId;
        console.log('[user_cart] 📤 Fetching cart with session ID:', sessionId.slice(-8));
      } else if (!token) {
        console.log('[user_cart] 📤 Fetching cart without session ID (backend will generate)');
      }
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`${API}/cart`, { headers, credentials: 'include' });

      if (!token) {
        updateSessionFromResponse(res);
      }
      
      if (!res.ok) {
        let errorMsg = 'Failed to load cart';
        if (res.status === 401) errorMsg = 'Please login to view your cart';
        else if (res.status === 404) errorMsg = 'Cart not found';
        else if (res.status >= 500) errorMsg = 'Server error. Please try again later';
        
        throw new Error(errorMsg);
      }
      
      const data = await res.json();
      if(!data.success){ 
        throw new Error(data.message || 'Failed to load cart'); 
      }
      
      renderCart(data.cart||{});
      window.dispatchEvent(new CustomEvent('cart:updated', { detail: data.cart }));
    } catch (e){
      console.error('Cart load error:', e);
      if (els.status) els.status.textContent = `Error: ${e.message}`;

      if (els.container) {
        els.container.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: var(--danger-color);">
            <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
            <p><strong>Unable to load cart</strong></p>
            <p style="font-size: 0.9rem;">${e.message}</p>
            <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;">
              Try Again
            </button>
          </div>
        `;
      }
    }
  }

  function renderCart(cart){
    
    if (!cart || typeof cart !== 'object') {
      console.error('Invalid cart data received:', cart);
      cart = { items: [], subtotal: 0, total: 0 };
    }

    currentCartData = cart;
    
    const items = Array.isArray(cart.items) ? cart.items : [];
    els.container.innerHTML = '';
    
    if(items.length === 0){
      els.empty.style.display = 'block';
      if (els.status) els.status.textContent = 'Empty';
    } else {
      els.empty.style.display = 'none';
      if (els.status) els.status.textContent = `${items.length} item${items.length>1?'s':''}`;
      
      items.forEach(i => {
        
        if (!i || typeof i !== 'object') {
          console.warn('Invalid cart item:', i);
          return;
        }
        
        const li = document.createElement('div');
        li.className = 'cart-item';

        const prod = (i.productId && typeof i.productId === 'object') ? i.productId : {
          _id: typeof i.productId === 'string' ? i.productId : i.productId?._id,
          name: 'Loading...',
          images: [],
          imageUrl: ''
        };

        const productName = escapeHtml(prod.name || 'Unknown Product');
        const productId = prod._id || i.productId;
        const quantity = Math.max(1, parseInt(i.quantity) || 1);
        const price = parseFloat(i.price) || 0;
        const itemTotal = price * quantity;

        let img = '../assets/images/placeholder.png';
        if (prod.images && Array.isArray(prod.images) && prod.images.length > 0) {
          const extractedUrl = extractUrl(prod.images[0]);
          if (extractedUrl) {
            
            img = extractedUrl.startsWith('http') ? extractedUrl : `${API}${extractedUrl.startsWith('/') ? '' : '/'}${extractedUrl}`;
          }
        } else if (prod.imageUrl) {
          const extractedUrl = extractUrl(prod.imageUrl);
          if (extractedUrl) {
            img = extractedUrl.startsWith('http') ? extractedUrl : `${API}${extractedUrl.startsWith('/') ? '' : '/'}${extractedUrl}`;
          }
        }
        
        li.innerHTML = `
          <div class="cart-item-image-wrapper">
            <img src="${img}" 
                 alt="${productName}"
                 loading="lazy"
                 onerror="this.src='../assets/images/placeholder.png'">
          </div>
          <div class="cart-item-details">
            <h3 class="cart-item-name">${productName}</h3>
            <p class="cart-item-price">${format(price)} each</p>
            <div class="cart-item-meta">
              <div class="qty-controls" data-id="${productId}">
                <button class="qty-btn" data-delta="-1" aria-label="Decrease quantity" ${quantity <= 1 ? 'disabled' : ''}>
                  <span>−</span>
                </button>
                <span class="qty-display" aria-label="Quantity">${quantity}</span>
                <button class="qty-btn" data-delta="1" aria-label="Increase quantity">
                  <span>+</span>
                </button>
              </div>
              <button class="remove-btn" data-remove="${productId}" aria-label="Remove from cart">
                <i class="fi fi-rr-trash"></i>
                <span>Remove</span>
              </button>
            </div>
          </div>
          <div class="cart-item-total">
            <div class="cart-item-total-price">${format(itemTotal)}</div>
            ${quantity > 1 ? `<div class="cart-item-unit-price">${quantity} × ${format(price)}</div>` : ''}
          </div>`;
        
        els.container.appendChild(li);
      });
    }

  const totalItems = items.reduce((s,i)=> s + (parseInt(i.quantity) || 0), 0);
  const subtotal = parseFloat(cart.subtotal) || items.reduce((s,i)=> s + ((parseFloat(i.price) || 0) * (parseInt(i.quantity) || 0)), 0);
  const discountVal = parseFloat(cart.discount) || 0;
  const total = isNaN(parseFloat(cart.total)) ? (subtotal - discountVal) : parseFloat(cart.total);
    
    if (els.summary.items) els.summary.items.textContent = totalItems;
    if (els.summary.subtotal) els.summary.subtotal.textContent = format(subtotal);
    
    if(discountVal > 0){
      if (els.summary.discount) els.summary.discount.textContent = `- ${format(discountVal)}`;
      if (els.summary.discountRow) els.summary.discountRow.style.display = 'flex';
    } else {
      if (els.summary.discountRow) els.summary.discountRow.style.display = 'none';
    }
    
    if (els.summary.total) els.summary.total.textContent = format(total);

    const couponRow = document.getElementById('couponAppliedRow');
    const couponCodeEl = document.getElementById('couponAppliedCode');
    if (cart.appliedCoupon && cart.appliedCoupon.code) {
      if (couponRow && couponCodeEl) {
        couponRow.style.display = 'flex';
        couponCodeEl.textContent = escapeHtml(cart.appliedCoupon.code);
      }
      if (els.removeCouponBtn) {
        els.removeCouponBtn.style.display = 'inline-block';
        els.removeCouponBtn.disabled = false;
      }
      if (els.couponInput) els.couponInput.disabled = true;
      if (document.getElementById('applyCouponBtn')) document.getElementById('applyCouponBtn').disabled = true;
      hideCouponMessage();
    } else {
      if (couponRow) couponRow.style.display = 'none';
      if (els.removeCouponBtn) {
        els.removeCouponBtn.style.display = 'none';
      }
      if (els.couponInput) els.couponInput.disabled = false;
      if (document.getElementById('applyCouponBtn')) document.getElementById('applyCouponBtn').disabled = false;
    }
  }

  if (els.removeCouponBtn) {
    els.removeCouponBtn.addEventListener('click', async () => {
      const token = localStorage.getItem('authToken');
      const headers = { 'Content-Type': 'application/json' };
      if (!token && sessionId) headers['x-session-id'] = sessionId;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const originalText = els.removeCouponBtn.textContent;
      els.removeCouponBtn.disabled = true;
      els.removeCouponBtn.textContent = 'Removing...';
      
      try {
        const res = await fetch(`${API}/cart/remove-coupon`, {
          method: 'POST',
          headers,
          credentials: 'include'
        });

        if (!token) {
          updateSessionFromResponse(res);
        }
        
        if (!res.ok) {
          let errorMsg = 'Failed to remove coupon';
          try {
            const errorData = await res.json();
            errorMsg = errorData.message || errorMsg;
          } catch (e) {  }
          throw new Error(errorMsg);
        }
        
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Failed to remove coupon');

        showCouponMessage('Coupon removed', 'success');
        
        if (typeof window.showNotification === 'function') {
          window.showNotification('Coupon removed', 'info');
        }
        
        fetchCart();
      } catch (e) {
        const errorMsg = e.message || 'Failed to remove coupon';
        showCouponMessage(errorMsg, 'error');
        
        if (typeof window.showNotification === 'function') {
          window.showNotification(errorMsg, 'error');
        }
      } finally {
        els.removeCouponBtn.disabled = false;
        els.removeCouponBtn.textContent = originalText;
      }
    });
  }
  
  els.container.addEventListener('click', async (e)=>{
    const btn = e.target.closest('.qty-btn');
    const removeBtn = e.target.closest('.remove-btn');
    if(btn){
      const wrap = btn.closest('[data-id]');
      if (!wrap) {
        console.warn('Missing data-id for quantity button');
        return;
      }
      
      const id = wrap.dataset.id;
      if (!id) {
        console.warn('Invalid product ID for quantity update');
        showErrorNotification('Invalid product ID');
        return;
      }
      
      const delta = parseInt(btn.dataset.delta, 10);
      if (isNaN(delta)) {
        console.warn('Invalid delta value for quantity button');
        return;
      }
      
      const qtySpan = wrap.querySelector('.qty-display');
      if (!qtySpan) {
        console.warn('Missing quantity display element');
        return;
      }
      
      const current = parseInt(qtySpan.textContent, 10) || 1;
      const newQty = Math.max(1, Math.min(999, current + delta)); 
      
      if(newQty === current) return; 

      if (newQty < 1 || newQty > 999) {
        showErrorNotification('Quantity must be between 1 and 999');
        return;
      }

      const minusBtn = wrap.querySelector('[data-delta="-1"]');
      const plusBtn = wrap.querySelector('[data-delta="1"]');
      if (minusBtn) minusBtn.disabled = (newQty <= 1);
      
      await updateQuantity(id, newQty);
    } else if(removeBtn){
      const productId = removeBtn.dataset.remove;
      if (!productId) {
        console.warn('Invalid product ID for remove operation');
        showErrorNotification('Invalid product ID');
        return;
      }
      await removeItem(productId);
    }
  });

  async function updateQuantity(productId, quantity){
    
    const rateLimitKey = `update_${productId}`;
    if (!rateLimiter.isAllowed(rateLimitKey, 500)) {
      console.log('Rate limit: Update quantity request ignored');
      return;
    }

    if (!productId || typeof productId !== 'string') {
      console.error('Invalid product ID for quantity update:', productId);
      showErrorNotification('Invalid product ID');
      return;
    }

    const qtyDisplay = document.querySelector(`[data-id="${productId}"] .qty-display`);
    const originalText = qtyDisplay?.textContent;
    
    try {
      
      const originalQuantity = quantity;
      const parsedQty = parseInt(quantity, 10);
      
      if (isNaN(parsedQty) || parsedQty < 1 || parsedQty > 999) {
        throw new Error('Quantity must be between 1 and 999');
      }
      
      quantity = Math.max(1, Math.min(999, parsedQty));

      if (qtyDisplay) qtyDisplay.textContent = '...';
      
      const token = localStorage.getItem('authToken');
      const headers = { 'Content-Type':'application/json' };
      
      if (!token && sessionId) headers['x-session-id'] = sessionId;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`${API}/cart/items/${encodeURIComponent(productId)}`, { 
        method:'PUT', 
        headers, 
        credentials: 'include', 
        body: JSON.stringify({ quantity })
      });

      if (!token) {
        updateSessionFromResponse(res);
      }
      
      if (!res.ok) {
        throw new Error(res.status === 404 ? 'Item not found in cart' : 'Failed to update quantity');
      }
      
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to update quantity');
      }

      if (data.cart) {
        renderCart(data.cart);
        window.dispatchEvent(new CustomEvent('cart:updated', { detail: data.cart }));
      } else {
        fetchCart();
      }
    } catch(e){ 
      console.error('Update qty failed:', e);
      
      if (qtyDisplay && originalText) qtyDisplay.textContent = originalText;

      showErrorNotification(e.message || 'Failed to update quantity');
    }
  }
  async function removeItem(productId){
    
    const rateLimitKey = `remove_${productId}`;
    if (!rateLimiter.isAllowed(rateLimitKey, 1000)) {
      console.log('Rate limit: Remove item request ignored');
      return;
    }

    if (!productId || typeof productId !== 'string') {
      console.error('Invalid product ID for remove operation:', productId);
      showErrorNotification('Invalid product ID');
      return;
    }

    const itemElement = document.querySelector(`[data-id="${productId}"]`)?.closest('.cart-item');
    
    try {
      
      if (itemElement) {
        itemElement.classList.add('removing');
      }
      
      const token = localStorage.getItem('authToken');
      const headers = {};
      
      if (!token && sessionId) headers['x-session-id'] = sessionId;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`${API}/cart/items/${encodeURIComponent(productId)}`, { 
        method:'DELETE', 
        headers, 
        credentials: 'include' 
      });

      if (!token) {
        updateSessionFromResponse(res);
      }
      
      if (!res.ok) {
        throw new Error(res.status === 404 ? 'Item not found in cart' : 'Failed to remove item');
      }
      
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to remove item');
      }

      setTimeout(() => {
        fetchCart();
      }, 300);
      
    } catch(e){ 
      console.error('Remove failed:', e);
      
      if (itemElement) {
        itemElement.classList.remove('removing');
      }
      
      showErrorNotification(e.message || 'Failed to remove item');
    }
  }

  document.getElementById('applyCouponBtn').addEventListener('click', async ()=>{
    const code = els.couponInput?.value?.trim();
    
    console.log('[Coupon] Apply button clicked, code:', code);
    
    if(!code) {
      const errorMsg = 'Please enter a coupon code';
      showCouponMessage(errorMsg, 'error');
      if (typeof window.showNotification === 'function') {
        window.showNotification(errorMsg, 'error');
      }
      return;
    }
    
    const applyBtn = document.getElementById('applyCouponBtn');
    if (!applyBtn) return;

    if (applyBtn.disabled) return;
    
    const originalText = applyBtn.textContent;
    
    try {
      
      applyBtn.disabled = true;
      applyBtn.textContent = 'Applying...';
      hideCouponMessage();
      
      const token = localStorage.getItem('authToken');
      const headers = { 'Content-Type':'application/json' };
      
      if (!token && sessionId) headers['x-session-id'] = sessionId;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      console.log('[Coupon] Sending request with code:', code);
      
      const res = await fetch(`${API}/cart/apply-coupon`, { 
        method:'POST', 
        headers, 
        credentials: 'include', 
        body: JSON.stringify({ code: code.toUpperCase() })
      });
      
      console.log('[Coupon] Response status:', res.status);

      if (!token) {
        updateSessionFromResponse(res);
      }
      
      if (!res.ok) {
        let errorMsg = 'Failed to apply coupon';
        
        try {
          const errorData = await res.json();
          console.log('[Coupon] Error response:', errorData);
          errorMsg = errorData.message || errorData.error || errorMsg;

          if (errorMsg.toLowerCase().includes('invalid') || errorMsg.toLowerCase().includes('not found')) {
            errorMsg = 'Invalid coupon code';
          } else if (errorMsg.toLowerCase().includes('expired')) {
            errorMsg = 'This coupon has expired';
          } else if (errorMsg.toLowerCase().includes('usage limit reached')) {
            errorMsg = 'Coupon usage limit reached';
          } else if (errorMsg.toLowerCase().includes('you have reached') || errorMsg.toLowerCase().includes('per user')) {
            errorMsg = 'You have already used this coupon';
          } else if (errorMsg.toLowerCase().includes('minimum')) {
            errorMsg = 'Minimum order amount not met';
          } else if (errorMsg.toLowerCase().includes('empty')) {
            errorMsg = 'Cart is empty';
          } else if (errorMsg.toLowerCase().includes('active')) {
            errorMsg = 'Coupon is not active';
          } else if (errorMsg.toLowerCase().includes('required')) {
            errorMsg = 'Please enter a coupon code';
          }
          
        } catch(e) { 
          console.error('[Coupon] Failed to parse error response:', e);
        }
        
        throw new Error(errorMsg);
      }
      
      const data = await res.json();
      console.log('[Coupon] Success response:', data);
      
      if(!data.success) {
        throw new Error(data.message || 'Failed to apply coupon');
      }

      const successMsg = `Coupon applied successfully`;
      showCouponMessage(successMsg, 'success');
      
      if (typeof window.showNotification === 'function') {
        const discountInfo = data.cart?.discount ? ` - Saved $${data.cart.discount.toFixed(2)}` : '';
        window.showNotification(`Coupon applied${discountInfo}`, 'success');
      }
      
      els.couponInput.value = ''; 
      fetchCart();
      
    } catch(e){
      const errorMsg = e.message || 'Failed to apply coupon';
      console.error('[Coupon] Error:', errorMsg);
      showCouponMessage(errorMsg, 'error');
      
      if (typeof window.showNotification === 'function') {
        window.showNotification(errorMsg, 'error');
      }
    } finally {
      
      if (applyBtn) {
        applyBtn.disabled = false;
        applyBtn.textContent = originalText;
      }
    }
  });

  if (els.couponInput) {
    els.couponInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('applyCouponBtn').click();
      }
    });
  }

  document.getElementById('clearCartBtn')?.addEventListener('click', async ()=>{
    
    if (!confirm('Are you sure you want to clear your entire cart? This action cannot be undone.')) {
      return;
    }
    
    const clearBtn = document.getElementById('clearCartBtn');
    const originalText = clearBtn?.textContent;
    
    try {
      
      if (clearBtn) {
        clearBtn.disabled = true;
        clearBtn.textContent = 'Clearing...';
      }
      
      const token = localStorage.getItem('authToken');
      const headers = {};
      
      if (!token && sessionId) headers['x-session-id'] = sessionId;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`${API}/cart`, { 
        method:'DELETE', 
        headers, 
        credentials: 'include' 
      });

      if (!token) {
        updateSessionFromResponse(res);
      }
      
      if (!res.ok) {
        throw new Error('Failed to clear cart');
      }
      
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to clear cart');
      }

      showCouponMessage('Cart cleared successfully', '#16a34a');
      fetchCart();
      
    } catch(e){
      console.error('Clear cart failed:', e);
      showErrorNotification(e.message || 'Failed to clear cart');
    } finally {
      
      if (clearBtn && originalText) {
        clearBtn.disabled = false;
        clearBtn.textContent = originalText;
      }
    }
  });
  document.getElementById('shopNowBtn')?.addEventListener('click', ()=>{ window.location.href = 'user_products.html'; });
  document.getElementById('continueShoppingBtn')?.addEventListener('click', ()=>{ window.location.href = 'user_products.html'; });

  function showStockModal(outOfStockItems, insufficientStockItems) {
    const modal = document.getElementById('stockValidationModal');
    const itemsContainer = document.getElementById('stockModalItems');
    const message = document.getElementById('stockModalMessage');
    
    if (!modal || !itemsContainer || !message) return;

    itemsContainer.innerHTML = '';

    const totalIssues = outOfStockItems.length + insufficientStockItems.length;
    message.textContent = totalIssues === 1 
      ? 'One item in your cart is unavailable.'
      : `${totalIssues} items in your cart are unavailable or have insufficient stock.`;

    outOfStockItems.forEach(itemName => {
      const itemEl = document.createElement('div');
      itemEl.className = 'stock-modal-item';
      itemEl.innerHTML = `
        <div class="stock-modal-item-icon">
          <i class="fas fa-times-circle"></i>
        </div>
        <div class="stock-modal-item-content">
          <h4 class="stock-modal-item-name">${escapeHtml(itemName)}</h4>
          <p class="stock-modal-item-details">This item is currently unavailable</p>
        </div>
        <div class="stock-modal-item-badge out-of-stock">
          <i class="fas fa-ban"></i>
          Out of Stock
        </div>
      `;
      itemsContainer.appendChild(itemEl);
    });

    insufficientStockItems.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'stock-modal-item';
      itemEl.innerHTML = `
        <div class="stock-modal-item-icon">
          <i class="fas fa-exclamation-circle"></i>
        </div>
        <div class="stock-modal-item-content">
          <h4 class="stock-modal-item-name">${escapeHtml(item.name)}</h4>
          <p class="stock-modal-item-details">You want ${item.requested}, but only ${item.available} available</p>
        </div>
        <div class="stock-modal-item-badge low-stock">
          <i class="fas fa-box"></i>
          Low Stock
        </div>
      `;
      itemsContainer.appendChild(itemEl);
    });

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    if (typeof window.showNotification === 'function') {
      window.showNotification('Stock validation failed', 'error');
    }
  }
  
  function hideStockModal() {
    const modal = document.getElementById('stockValidationModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  document.getElementById('closeStockModal')?.addEventListener('click', hideStockModal);
  document.getElementById('reviewCartBtn')?.addEventListener('click', () => {
    hideStockModal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('stockValidationModal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('stock-modal-overlay')) {
      hideStockModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('stockValidationModal');
      if (modal && modal.style.display === 'flex') {
        hideStockModal();
      }
    }
  });
  
  document.getElementById('checkoutBtn')?.addEventListener('click', async ()=>{ 
    
    const cartItems = document.querySelectorAll('.cart-item');
    if (cartItems.length === 0) {
      return;
    }

    if (!currentCartData || !currentCartData.items || currentCartData.items.length === 0) {
      if (typeof window.showNotification === 'function') {
        window.showNotification('Unable to validate cart items. Please refresh the page.', 'error');
      } else {
        showErrorNotification('Unable to validate cart items. Please refresh the page.');
      }
      return;
    }

    const outOfStockItems = [];
    const insufficientStockItems = [];
    
    for (const item of currentCartData.items) {
      const product = (item.productId && typeof item.productId === 'object') ? item.productId : null;
      
      if (!product) {
        console.warn('Product data not populated for item:', item);
        continue;
      }
      
      const productName = product.name || 'Unknown Product';
      const requestedQty = parseInt(item.quantity) || 1;
      const availableStock = parseInt(product.stock) || 0;

      if (availableStock === 0) {
        outOfStockItems.push(productName);
      }
      
      else if (requestedQty > availableStock) {
        insufficientStockItems.push({
          name: productName,
          requested: requestedQty,
          available: availableStock
        });
      }
    }

    if (outOfStockItems.length > 0 || insufficientStockItems.length > 0) {
      showStockModal(outOfStockItems, insufficientStockItems);
      return;
    }

    window.location.href = 'user_checkout.html'; 
  });

  document.addEventListener('cart:updated', (event) => {
    console.log('Cart updated event received, refreshing cart display');
    fetchCart();
  });

  let initialFetchStarted = false;

  function initializeCart() {
    if (initialFetchStarted) {
      console.log('[user_cart] Initial fetch already started, skipping duplicate');
      return;
    }
    initialFetchStarted = true;

    if (window.CartClient && typeof window.CartClient.getSessionId === 'function') {
      const cartClientSession = window.CartClient.getSessionId();
      if (cartClientSession && cartClientSession !== sessionId) {
        sessionId = cartClientSession;
        localStorage.setItem(sessionKey, cartClientSession);
        console.log('[user_cart] Synced session with CartClient before fetch');
      }
    }
    
    fetchCart();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initializeCart, 50); 
    });
  } else {
    setTimeout(initializeCart, 50);
  }

  async function loadBestsellers() {
    const section = document.getElementById('cart-bestsellers-section');
    const loading = document.getElementById('cart-bestsellers-loading');
    const grid = document.getElementById('cart-bestsellers-grid');
    const empty = document.getElementById('cart-bestsellers-empty');
    const error = document.getElementById('cart-bestsellers-error');

    if (!section || !grid) return;

    try {
      
      section.style.display = 'block';
      loading.style.display = 'block';
      grid.style.display = 'none';
      empty.style.display = 'none';
      error.style.display = 'none';

      const response = await fetch(`${API}/products`);
      if (!response.ok) throw new Error('Failed to fetch products');
      
      const data = await response.json();

      const products = Array.isArray(data) ? data : (data.products || []);
      
      if (!Array.isArray(products) || products.length === 0) {
        loading.style.display = 'none';
        empty.style.display = 'block';
        return;
      }

      const bestsellers = products
        .filter(p => p.status === 'active') 
        .sort((a, b) => {
          
          const salesDiff = (b.salesCount || 0) - (a.salesCount || 0);
          if (salesDiff !== 0) return salesDiff;
          
          const ratingDiff = (b.rating || 0) - (a.rating || 0);
          if (ratingDiff !== 0) return ratingDiff;
          
          return (b.numReviews || 0) - (a.numReviews || 0);
        })
        .slice(0, 4); 

      loading.style.display = 'none';

      if (bestsellers.length === 0) {
        empty.style.display = 'block';
        return;
      }

      grid.style.display = 'grid';

      if (typeof window.renderProductGrid === 'function') {
        window.renderProductGrid(grid, bestsellers, {
          idKey: '_id',
          detailUrl: (id) => `user_product-detail.html?id=${encodeURIComponent(id)}`,
          onAddToCart: async (id) => {
            
            if (window.CartClient && typeof window.CartClient.addToCart === 'function') {
              await window.CartClient.addToCart(id, 1);
            }
          },
          apiBase: API
        });
      } else {
        
        grid.innerHTML = bestsellers.map(product => {
          const img = extractUrl(product.images?.[0]) || product.imageUrl || '../assets/images/placeholder.png';
          const imgUrl = img.startsWith('http') ? img : `${API}${img.startsWith('/') ? '' : '/'}${img}`;
          
          return `
            <div class="product-card" onclick="window.location.href='user_product-detail.html?id=${product._id}'">
              <img src="${imgUrl}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.src='../assets/images/placeholder.png'">
              <div class="product-info">
                <h3 class="product-name">${escapeHtml(product.name)}</h3>
                <div class="product-rating">
                  <span class="stars">${'★'.repeat(Math.round(product.rating || 0))}${'☆'.repeat(5 - Math.round(product.rating || 0))}</span>
                  <span class="review-count">(${product.numReviews || 0})</span>
                </div>
                <div class="product-price">${format(product.price)}</div>
              </div>
            </div>
          `;
        }).join('');
      }

    } catch (err) {
      console.error('Failed to load bestsellers:', err);
      loading.style.display = 'none';
      error.style.display = 'block';
    }
  }

  setTimeout(loadBestsellers, 500);
})();
