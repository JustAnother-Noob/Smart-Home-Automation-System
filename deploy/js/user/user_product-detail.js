

import { renderProductGrid } from '../user_components/product-card-renderer.js';

const API_BASE = window.CONFIG?.API_URL || '/api';

let currentProduct = null;
let currentImageIndex = 0;
let productImages = [];

const loadingContainer = document.getElementById('loading-container');
const errorContainer = document.getElementById('error-container');
const errorMessage = document.getElementById('error-message');
const productContainer = document.getElementById('product-detail-container');

const mainImage = document.getElementById('main-image');
const thumbnailGallery = document.getElementById('thumbnail-gallery');
const prevBtn = document.getElementById('prev-image-btn');
const nextBtn = document.getElementById('next-image-btn');

function updateBreadcrumb(text) {
  try {
    
    const current = document.getElementById('breadcrumb-current');
    if (current) {
      current.textContent = text;
      return;
    }
    
    const legacy = document.getElementById('breadcrumb-product');
    if (legacy) legacy.textContent = text;
  } catch (e) {
    
    console.warn('Failed to update breadcrumb', e);
  }
}
const priceContainer = document.querySelector('.price-container');

const productName = document.getElementById('product-name');
const productStars = document.getElementById('product-stars');
const productRatingText = document.getElementById('product-rating-text');
const productSku = document.getElementById('product-sku');
const productPrice = document.getElementById('product-price');
const productOriginalPrice = document.getElementById('product-original-price');
const clearanceBadge = document.getElementById('clearance-badge');
const stockStatus = document.getElementById('stock-status');

const tabDetailsContent = document.getElementById('tab-details-content');
const tabShippingContent = document.getElementById('tab-shipping-content');
const tabRefundContent = document.getElementById('tab-refund-content');
const productCategory = document.getElementById('product-category');
const productBrand = document.getElementById('product-brand');
const brandAttribute = document.getElementById('brand-attribute');

const quantityInput = document.getElementById('quantity');
const decreaseBtn = document.getElementById('decrease-qty');
const increaseBtn = document.getElementById('increase-qty');
const addToCartBtn = document.getElementById('add-to-cart-btn');

function extractUrl(img) {
  if (!img) return null;
  if (typeof img === 'string') return img;
  if (typeof img === 'object') return img.medium || img.small || img.url || img.thumbnail || null;
  return null;
}

function getImageUrl(imageObj) {
  const url = extractUrl(imageObj);
  if (!url) return '../assets/images/placeholder.png';
  return url.startsWith('http') ? url : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

async function init() {
  
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  if (!productId) {
    showError('No product ID provided');
    return;
  }

  try {
    await fetchProduct(productId);
  } catch (error) {
    console.error('Error initializing product detail:', error);
    showError('Failed to load product details');
  }
}

async function fetchProduct(productId) {
  try {
    const response = await fetch(`${API_BASE}/products/${productId}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.product) {
      throw new Error(data.message || 'Product not found');
    }

    currentProduct = data.product;
    displayProduct(currentProduct);
    
  } catch (error) {
    console.error('Error fetching product:', error);
    showError(error.message || 'Failed to load product');
  }
}

function displayProduct(product) {
  
  loadingContainer.style.display = 'none';
  errorContainer.style.display = 'none';
  productContainer.style.display = 'block';

  if (typeof window.updateBreadcrumb === 'function') {
    try { window.updateBreadcrumb(product.name); } catch (e) { updateBreadcrumb(product.name); }
  } else {
    updateBreadcrumb(product.name);
  }

  document.title = `${product.name} - Smart Living Tech`;

  setupImageGallery(product);

  productName.textContent = product.name;

  const rating = product.rating || 0;
  const numReviews = product.numReviews || 0;
  productStars.innerHTML = generateStarRating(rating);
  productRatingText.textContent = `${rating.toFixed(1)} (${numReviews} reviews)`;

  productSku.textContent = product.sku || 'N/A';

  const basePrice = Number(product.price || 0);
  const hasDiscountedPrice = (product.discountedPrice !== undefined && product.discountedPrice !== null && !Number.isNaN(Number(product.discountedPrice)) && Number(product.discountedPrice) < basePrice);
  const isClearance = (product.clearance === true || String(product.clearance).toLowerCase() === 'true') || hasDiscountedPrice;

  if (isClearance) {
    
    if (hasDiscountedPrice) {
      productPrice.textContent = `$${Number(product.discountedPrice).toFixed(2)}`;
      productOriginalPrice.textContent = `$${basePrice.toFixed(2)}`;
      productOriginalPrice.style.display = 'inline';
    } else {
      productPrice.textContent = `$${basePrice.toFixed(2)}`;
      productOriginalPrice.style.display = 'none';
    }
  clearanceBadge.style.setProperty('display', 'inline-flex', 'important');
    if (priceContainer) {
      priceContainer.classList.remove('price-regular');
      priceContainer.classList.add('price-discount');
    }
  } else {
    productPrice.textContent = `$${basePrice.toFixed(2)}`;
    productOriginalPrice.style.display = 'none';
  clearanceBadge.style.setProperty('display', 'none', 'important');
    if (priceContainer) {
      priceContainer.classList.remove('price-discount');
      priceContainer.classList.add('price-regular');
    }
  }

  displayStockStatus(product);

  if (tabDetailsContent) tabDetailsContent.textContent = product.description || 'No description available.';

  productCategory.textContent = product.category || 'N/A';

  if (product.brand) {
    productBrand.textContent = product.brand;
    brandAttribute.style.display = 'flex';
  } else {
    brandAttribute.style.display = 'none';
  }

  setupQuantityControls(product);

  setupAddToCart(product);

  if (tabShippingContent) {
    
    if (product.shippingInfo && String(product.shippingInfo).trim().length) {
      
      try { tabShippingContent.innerHTML = product.shippingInfo; } catch (e) { tabShippingContent.textContent = product.shippingInfo; }
    }
  }
  if (tabRefundContent) {
    
    if (product.refundPolicy && String(product.refundPolicy).trim().length) {
      try { tabRefundContent.innerHTML = product.refundPolicy; } catch (e) { tabRefundContent.textContent = product.refundPolicy; }
    }
  }

  if (product.category && product._id) {
    loadSimilarProducts(product.category, product._id);
  }
}

function setupTabs() {
  const tabButtons = Array.from(document.querySelectorAll('#product-tabs [role="tab"]'));
  const panels = Array.from(document.querySelectorAll('#product-tabs [role="tabpanel"]'));

  function activate(index) {
    tabButtons.forEach((b, i) => b.setAttribute('aria-selected', String(i === index)));
    panels.forEach((p, i) => {
      const hidden = i !== index;
      p.setAttribute('aria-hidden', String(hidden));
    });
    
    const activeBtn = tabButtons[index];
    if (activeBtn) activeBtn.focus();
  }

  tabButtons.forEach((btn, idx) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      activate(idx);
    });

    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        activate((idx + 1) % tabButtons.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        activate((idx - 1 + tabButtons.length) % tabButtons.length);
      }
    });
  });

  let start = tabButtons.findIndex(b => b.getAttribute('aria-selected') === 'true');
  if (start < 0) start = 0;
  activate(start);
}

function setupImageGallery(product) {
  productImages = [];

  if (product.images && Array.isArray(product.images) && product.images.length > 0) {
    productImages = product.images.filter((img) => {
      const url = extractUrl(img);
      const keep = url !== null && url !== undefined && String(url).length > 0;
      return keep;
    });
  }

  if (productImages.length === 0 && product.imageUrl) {
    productImages = [product.imageUrl];
  }

  if (productImages.length === 0) {
    productImages = ['../assets/images/placeholder.png'];
  }

  try {
    const preview = productImages.map((img, i) => ({ index: i, raw: img, extracted: extractUrl(img) }));
  } catch (e) {  }

  currentImageIndex = 0;
  updateMainImage();

  if (productImages.length > 1) {
    renderThumbnails();
    prevBtn.style.display = 'flex';
    nextBtn.style.display = 'flex';
    updateNavigationButtons();
  } else {
    thumbnailGallery.innerHTML = '';
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
  }

  setupImageNavigation();
}

function updateMainImage() {
  if (productImages.length === 0) return;
  const raw = productImages[currentImageIndex];
  const imageUrl = getImageUrl(raw);
  mainImage.src = imageUrl;
  mainImage.alt = currentProduct?.name || 'Product Image';

  updateActiveThumbnail();
  updateNavigationButtons();
}

function renderThumbnails() {
  thumbnailGallery.innerHTML = '';
  
  productImages.forEach((image, index) => {
    const thumbnail = document.createElement('div');
    thumbnail.className = 'thumbnail-item';
    if (index === currentImageIndex) {
      thumbnail.classList.add('active');
    }

    const img = document.createElement('img');
    const thumbUrl = getImageUrl(image);
    img.src = thumbUrl;
    img.alt = `${currentProduct.name} - Image ${index + 1}`;
    img.loading = 'lazy';

    thumbnail.appendChild(img);
    thumbnail.addEventListener('click', () => {
      currentImageIndex = index;
      updateMainImage();
    });

    thumbnailGallery.appendChild(thumbnail);
  });
}

function updateActiveThumbnail() {
  const thumbnails = thumbnailGallery.querySelectorAll('.thumbnail-item');
  thumbnails.forEach((thumb, index) => {
    if (index === currentImageIndex) {
      thumb.classList.add('active');
    } else {
      thumb.classList.remove('active');
    }
  });
}

function updateNavigationButtons() {
  if (productImages.length <= 1) return;

  prevBtn.disabled = currentImageIndex === 0;
  nextBtn.disabled = currentImageIndex === productImages.length - 1;
}

function setupImageNavigation() {
  prevBtn.addEventListener('click', () => {
    if (currentImageIndex > 0) {
      currentImageIndex--;
      updateMainImage();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentImageIndex < productImages.length - 1) {
      currentImageIndex++;
      updateMainImage();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (productImages.length <= 1) return;

    if (e.key === 'ArrowLeft' && currentImageIndex > 0) {
      currentImageIndex--;
      updateMainImage();
    } else if (e.key === 'ArrowRight' && currentImageIndex < productImages.length - 1) {
      currentImageIndex++;
      updateMainImage();
    }
  });
}

function displayStockStatus(product) {
  const quantity = product.quantity || product.stock || 0;
  let statusClass = 'out-of-stock';
  let statusText = 'Out of Stock';
  let icon = 'fa-times-circle';

  if (quantity > 10) {
    statusClass = 'in-stock';
    statusText = 'In Stock';
    icon = 'fa-check-circle';
  } else if (quantity > 0) {
    
    statusClass = 'low-stock';
    statusText = 'Low stock';
    icon = 'fa-exclamation-circle';
  }

  stockStatus.className = `stock-status ${statusClass}`;
  stockStatus.innerHTML = `<i class="fas ${icon}"></i> ${statusText}`;

  if (quantity === 0) {
    addToCartBtn.disabled = true;
    addToCartBtn.innerHTML = '<i class="fas fa-ban"></i> Out of Stock';
  }
}

function generateStarRating(rating = 0) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  const full = Math.floor(r);
  const half = (r % 1) >= 0.5 ? 1 : 0;
  let html = '';
  
  for (let i = 0; i < full; i++) {
    html += '<i class="fas fa-star" aria-hidden="true"></i>';
  }
  if (half) {
    html += '<i class="fas fa-star-half-alt" aria-hidden="true"></i>';
  }
  for (let i = 0; i < 5 - full - half; i++) {
    html += '<i class="far fa-star" aria-hidden="true"></i>';
  }
  
  return html;
}

function setupQuantityControls(product) {
  const maxQuantity = product.quantity || product.stock || 999;
  quantityInput.max = maxQuantity;

  decreaseBtn.addEventListener('click', () => {
    let value = parseInt(quantityInput.value) || 1;
    if (value > 1) {
      quantityInput.value = value - 1;
    }
  });

  increaseBtn.addEventListener('click', () => {
    let value = parseInt(quantityInput.value) || 1;
    if (value < maxQuantity) {
      quantityInput.value = value + 1;
    }
  });

  quantityInput.addEventListener('change', () => {
    let value = parseInt(quantityInput.value) || 1;
    if (value < 1) value = 1;
    if (value > maxQuantity) value = maxQuantity;
    quantityInput.value = value;
  });
}

function setupAddToCart(product) {
  
  const newBtn = addToCartBtn.cloneNode(true);
  addToCartBtn.parentNode.replaceChild(newBtn, addToCartBtn);
  
  const btn = document.getElementById('add-to-cart-btn');
  
  if (addToCartBtn.disabled) {
    btn.disabled = true;
    const iconOld = btn.querySelector('.icon');
    const labelOld = btn.querySelector('.label');
    if (iconOld) { iconOld.className = 'fas fa-ban icon'; }
    if (labelOld) { labelOld.textContent = 'Out of Stock'; }
  }
  btn.addEventListener('click', async (ev) => {
    ev.preventDefault();
    
    const quantity = parseInt(quantityInput.value) || 1;
    const available = product.quantity || product.stock || 0;

    if (available === 0) {
      
      if (window.showCartNotification) window.showCartNotification('Item is out of stock', 'error');
      return;
    }

    if (quantity > available) {
      
      quantityInput.value = available;
      if (window.showCartNotification) window.showCartNotification('Requested quantity exceeds available stock', 'error');
      return;
    }
    const productId = product._id || product.productId;
    const icon = btn.querySelector('.icon');
    const labelEl = btn.querySelector('.label');

    try {
      btn.disabled = true;
      if (icon) { icon.classList.remove('fa-shopping-cart'); icon.classList.add('fa-spinner','fa-spin'); }
      if (labelEl) labelEl.textContent = 'Adding...';
      
      const cart = await addToCart(productId, quantity);

      if (icon) { icon.classList.remove('fa-spinner','fa-spin'); icon.classList.add('fa-shopping-cart'); }
      if (labelEl) labelEl.textContent = 'Add to Cart';
      
      if (window.updateCartCount) window.updateCartCount();
      if (window.showCartNotification) window.showCartNotification('Added to cart');

      try { window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart: cart || null } })); } catch(e) {  }

      btn.disabled = false;

    } catch (error) {
      console.error('Error adding to cart:', error);
      if (icon) { icon.classList.remove('fa-spinner','fa-spin'); icon.classList.add('fa-times'); }
      if (labelEl) labelEl.textContent = 'Failed';
      if (window.showCartNotification) window.showCartNotification(error.message || 'Failed to add to cart', 'error');
      setTimeout(() => {
        if (icon) { icon.classList.remove('fa-times'); icon.classList.add('fa-shopping-cart'); }
        if (labelEl) labelEl.textContent = 'Add to Cart';
        btn.disabled = false;
      }, 2000);
    }
  });
}

async function addToCart(productId, quantity) {
  
  try {
    if (window.CartClient && typeof window.CartClient.addToCart === 'function') {
      return await window.CartClient.addToCart(String(productId), Number(quantity || 1));
    }

    const API = (window.CONFIG && window.CONFIG.API_URL ? window.CONFIG.API_URL : '/api').replace(/\/$/, '');
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    const sessionId = localStorage.getItem('cartSessionId');
    if (!token && sessionId) headers['x-session-id'] = sessionId;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API}/cart/items`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ productId: String(productId), quantity: Number(quantity || 1) })
    });

    try {
      const backendSession = res.headers.get('X-Session-ID');
      if (backendSession) localStorage.setItem('cartSessionId', backendSession);
    } catch (e) {  }

    if (!res.ok) {
      let message = 'Failed to add item to cart';
      if (res.status === 401) message = 'Please login to add items to cart';
      else if (res.status === 404) message = 'Product not found';
      else if (res.status === 400) {
        try { const dd = await res.json(); message = dd.message || message; } catch(e){}
      }
      throw new Error(message);
    }

    const data = await res.json();
    if (window.updateCartCount) window.updateCartCount();
    if (window.showCartNotification) window.showCartNotification('Added to cart', 'success');
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: data.cart }));
    return data.cart || data;
  } catch (err) {
    console.error('addToCart fallback error:', err);
    if (window.showCartNotification) window.showCartNotification(err.message || 'Could not add to cart', 'error');
    throw err;
  }
}

function showError(message) {
  loadingContainer.style.display = 'none';
  productContainer.style.display = 'none';
  errorContainer.style.display = 'block';
  errorMessage.textContent = message;
}

async function loadSimilarProducts(category, currentProductId) {
  const section = document.getElementById('similar-products-section');
  const loading = document.getElementById('similar-products-loading');
  const grid = document.getElementById('similar-products-grid');
  const empty = document.getElementById('similar-products-empty');
  const error = document.getElementById('similar-products-error');

  if (!section || !grid) return;

  try {
    
    section.style.display = 'block';
    loading.style.display = 'block';
    grid.style.display = 'none';
    empty.style.display = 'none';
    error.style.display = 'none';

    const response = await fetch(`${API_BASE}/products`);
    if (!response.ok) throw new Error('Failed to fetch products');
    
    const data = await response.json();

    const products = Array.isArray(data) ? data : (data.products || []);
    
    if (!Array.isArray(products) || products.length === 0) {
      loading.style.display = 'none';
      empty.style.display = 'block';
      return;
    }

    let similar = products
      .filter(p => 
        p.category && 
        p.category.toLowerCase() === category.toLowerCase() &&
        p._id !== currentProductId
      )
      .sort((a, b) => {
        
        const ratingDiff = (b.rating || 0) - (a.rating || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (b.numReviews || 0) - (a.numReviews || 0);
      })
      .slice(0, 4); 

    loading.style.display = 'none';

    if (similar.length === 0) {
      
      empty.style.display = 'block';
      return;
    }

    grid.style.display = 'grid';
    renderProductGrid(grid, similar, {
      idKey: '_id',
      detailUrl: (id) => `user_product-detail.html?id=${encodeURIComponent(id)}`,
      onAddToCart: async (id) => {
        
        await addToCart(id, 1);
      },
      apiBase: API_BASE
    });

  } catch (err) {
    console.error('Failed to load similar products:', err);
    loading.style.display = 'none';
    error.style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  
  const token = localStorage.getItem('authToken');
  const userRole = localStorage.getItem('userRole');
  if (token && userRole === 'admin') {
    console.log('🚫 Admin user attempting to access product detail page, redirecting to admin dashboard');
    window.location.href = 'adminHome.html';
    return;
  }
  
  init();
});

document.addEventListener('DOMContentLoaded', () => {
  try { setupTabs(); } catch (e) {  }
});
