export const DEFAULT_API_BASE = (typeof CONFIG !== 'undefined' && CONFIG.API_URL)
  ? String(CONFIG.API_URL).replace(/\/$/, '')
  : '';

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s = '') { return escapeHtml(s); }

function extractUrl(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    try {
      const prim = val.valueOf && val.valueOf();
      if (typeof prim === 'string' && prim.length) return prim;
    } catch (e) {  }
    
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

export function getImageUrl(product = {}, apiBase = DEFAULT_API_BASE) {
  try {
    if (product.images && Array.isArray(product.images) && product.images.length) {
      const u = extractUrl(product.images[0]);
      if (u) return u.startsWith('http') ? u : `${apiBase}${u.startsWith('/') ? '' : '/'}${u}`;
    }
    const raw = extractUrl(product.imageUrl) || extractUrl(product.image);
    if (raw) return raw.startsWith('http') ? raw : `${apiBase}${raw.startsWith('/') ? '' : '/'}${raw}`;
  } catch (e) {  }
  return '../assets/images/placeholder.png';
}

export function generateStarRating(rating = 0) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  const full = Math.floor(r);
  const half = (r % 1) >= 0.5 ? 1 : 0;
  let html = '';
  for (let i = 0; i < full; i++) html += '<i class="fas fa-star" aria-hidden="true"></i>';
  if (half) html += '<i class="fas fa-star-half-alt" aria-hidden="true"></i>';
  for (let i = 0; i < 5 - full - half; i++) html += '<i class="far fa-star" aria-hidden="true"></i>';
  return html;
}

export function renderProductGrid(container, products = [], options = {}) {
  if (!container) return;
  const {
    idKey = '_id',
    detailUrl = (id) => `user_product-detail.html?id=${encodeURIComponent(id)}`,
    onAddToCart = (id) => (window.CartClient ? window.CartClient.addToCart(id, 1) : null),
    apiBase = DEFAULT_API_BASE
  } = options;

  container.innerHTML = '';

  if (!Array.isArray(products) || products.length === 0) {
    container.innerHTML = `<div class="empty-state">No products found.</div>`;
    return;
  }

  products.forEach(product => {
    const id = product[idKey] || product.id || '';
    const name = product.name || 'Unnamed';
    const imageUrl = getImageUrl(product, apiBase);
  const price = Number(product.price || 0);
  
  const discounted = (product.discountedPrice !== undefined && product.discountedPrice !== null && !Number.isNaN(Number(product.discountedPrice)) && Number(product.discountedPrice) < price);
  const discountedPrice = discounted ? Number(product.discountedPrice || price) : null;

  const isSaleBadge = (product.clearance === true || String(product.clearance).toLowerCase() === 'true') || discounted;

    const card = document.createElement('article');
    card.className = 'product-card';

    card.innerHTML = `
      <div class="product-card-inner" role="button" tabindex="0" aria-label="View details for ${escapeHtml(name)}">
        <div class="product-image" role="img" aria-label="${escapeHtml(name)}">
          <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(name)}" loading="lazy" onerror="this.src='../assets/images/placeholder.png'">
          ${isSaleBadge ? '<span class="clearance-badge">SALE</span>' : ''}
        </div>
        <div class="product-info">
          <div class="product-category">${escapeHtml(product.category || 'Uncategorized')}</div>
          <h3 class="product-name">${escapeHtml(name)}</h3>
          <div class="product-meta">
            <div class="meta-top">
              <div class="product-rating">${generateStarRating(product.rating)}<span class="review-count">(${Number(product.numReviews || 0)})</span></div>
            </div>
            <div class="meta-bottom">
              <div class="product-price ${discounted ? 'discounted' : 'regular'}">
                ${discounted ? `<span class="discounted-price">$${discountedPrice.toFixed(2)}</span><span class="original-price">$${price.toFixed(2)}</span>` : `<span class="price">$${price.toFixed(2)}</span>`}
              </div>
            </div>
          </div>
          <div class="product-actions">
            ${ (product.quantity || product.stock || 0) === 0 ?
              `<button class="add-to-cart-btn" data-id="${escapeAttr(id)}" aria-label="Out of stock" disabled>
                 <span class="btn-content"><i class="fas fa-ban icon" aria-hidden="true"></i><span class="label">Out of Stock</span></span>
               </button>` :
              `<button class="add-to-cart-btn" data-id="${escapeAttr(id)}" aria-label="Add ${escapeHtml(name)} to cart" aria-live="polite">
                 <span class="btn-content"><i class="fas fa-shopping-cart icon" aria-hidden="true"></i><span class="label">Add to Cart</span></span>
               </button>`
            }
          </div>
        </div>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.add-to-cart-btn')) return;
      window.location.href = detailUrl(id);
    });

    const inner = card.querySelector('.product-card-inner');
    if (inner) {
      inner.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.location.href = detailUrl(id);
        }
      });
    }

    const addBtn = card.querySelector('.add-to-cart-btn');
    if (addBtn) {
      
      if (addBtn.disabled) {
        
        addBtn.setAttribute('aria-disabled', 'true');
      } else {
        addBtn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const icon = addBtn.querySelector('.icon');
          const label = addBtn.querySelector('.label');
          try {
            addBtn.disabled = true;
            addBtn.classList.add('loading');
            addBtn.setAttribute('aria-busy', 'true');
            if (icon) { icon.classList.remove('fa-shopping-cart'); icon.classList.add('fa-spinner','fa-spin'); }
            if (label) label.textContent = 'Adding...';
            await onAddToCart(id);
          } catch (err) { console.error(err); }
          finally {
            addBtn.disabled = false;
            addBtn.classList.remove('loading');
            addBtn.removeAttribute('aria-busy');
            if (icon) { icon.classList.remove('fa-spinner','fa-spin'); icon.classList.add('fa-shopping-cart'); }
            if (label) label.textContent = 'Add to Cart';
          }
        });
      }
    }

    container.appendChild(card);
  });
}

export function attachProductDelegation(root = document, handlers = {}) {
  const onAdd = handlers.onAddToCart || ((id) => (window.CartClient ? window.CartClient.addToCart(id, 1) : null));
  function listener(e) {
    const btn = e.target.closest('.add-to-cart-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const id = btn.getAttribute('data-id');
    if (!id) return;
    const icon = btn.querySelector('.icon');
    const label = btn.querySelector('.label');
    btn.disabled = true;
    btn.classList.add('loading');
    btn.setAttribute('aria-busy', 'true');
    if (icon) { icon.classList.remove('fa-shopping-cart'); icon.classList.add('fa-spinner','fa-spin'); }
    if (label) label.textContent = 'Adding...';
    Promise.resolve(onAdd(id)).catch(err => console.error(err)).finally(() => {
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.removeAttribute('aria-busy');
      if (icon) { icon.classList.remove('fa-spinner','fa-spin'); icon.classList.add('fa-shopping-cart'); }
      if (label) label.textContent = 'Add to Cart';
    });
  }
  root.addEventListener('click', listener);
  return () => root.removeEventListener('click', listener);
}