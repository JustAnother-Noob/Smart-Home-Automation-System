

const config = {
  apiUrl: window.CONFIG?.API_URL || '/api',
  debug: !!(window.CONFIG?.DEBUG)
};

const adminProducts = {
  
  products: [],
  currentPage: 1,
  totalPages: 1,
  itemsPerPage: 10,
  
  pendingImages: [],
  imagesToDelete: [],
  primarySelection: null,
  pendingObjectUrls: [],
  totalCount: 0,
  
  searchTimeout: null,
  lastSearchValue: '',

  async request(url, options = {}, { timeoutMs = 15000, retries = 1 } = {}) {
    const attempt = async (triesLeft) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      try {
        this.log('Making request to:', url, 'with options:', options);
        const res = await fetch(url, { ...options, signal: controller.signal });

        this.log('Response status:', res.status, 'for URL:', url);

        if (res.status === 401) {
          this.showTemporaryMessage('Your session has expired. Please log in again.', 'error');
          window.location.href = 'user_login.html?auth=required';
          throw new Error('Unauthorized');
        }

        if (!res.ok) {
          let msg = `Request failed with status ${res.status}`;
          let errorType = 'unknown';
          try {
            const data = await res.json();
            this.log('Error response data:', data);
            msg = data?.message ?? msg;
            errorType = data?.errorType ?? 'unknown';

            if (errorType === 'rate_limit_exceeded') {
              msg = 'Too many requests. Please wait a moment and try again.';
            } else if (errorType === 'ip_blocked') {
              msg = 'Your IP has been temporarily blocked. Please try again later.';
            } else if (res.status === 403) {
              msg = 'Access denied. Please check your admin permissions or try again later.';
            }
          } catch (err) {
            this.log('Request error parsing JSON', err);
            if (res.status === 403) {
              msg = 'Access denied. This might be due to rate limiting. Please try again later.';
            }
          }
          throw new Error(msg);
        }

        return res;
      } catch (err) {
        this.log('Request error:', err.message, 'for URL:', url);
        const isNetworkError = err.name === 'AbortError' || err instanceof TypeError || err.message?.includes('Network');
        if (triesLeft > 0 && isNetworkError) {
          this.log('Retrying request after failure', { url, triesLeft, error: err });
          return attempt(triesLeft - 1);
        }
        throw err;
      } finally {
        clearTimeout(id);
      }
    };

    return attempt(retries);
  },

  log(...args) {
    if (config.debug) {
      console.log('[adminProducts]', ...args);
    }
  },

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  decodeAttribute(value) {
    if (typeof value !== 'string' || value.length === 0) {
      return '';
    }
    try {
      return decodeURIComponent(value);
    } catch (err) {
      this.log('Failed to decode attribute value', { value, err });
      return value;
    }
  },

  showTemporaryMessage(message, type = 'info') {
    const existingMessage = document.querySelector('.temporary-message');
    if (existingMessage) {
      existingMessage.remove();
    }

    const iconClass = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    const background = type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#3498db';

    const messageEl = document.createElement('div');
    messageEl.className = `temporary-message ${type}`;
    messageEl.innerHTML = `
      <i class="fas ${iconClass}"></i>
      ${this.escapeHtml(message)}
    `;

    messageEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
      background: ${background};
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    document.body.appendChild(messageEl);

    setTimeout(() => {
      messageEl.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.remove();
        }
      }, 300);
    }, 3000);
  },

  resolveQuantity(product) {
    return product?.quantity ?? product?.stock ?? product?.stockQuantity ?? 0;
  },

  addPendingImage(file) {
    const previewUrl = URL.createObjectURL(file);
    this.pendingImages.push({ file, previewUrl });
    this.pendingObjectUrls.push(previewUrl);
    return previewUrl;
  },

  ensurePrimarySelectionValidity(product) {
    if (!this.primarySelection) return;

    if (this.primarySelection.type === 'existing') {
      const existingUrls = new Set();
      if (product?.imageUrl) existingUrls.add(product.imageUrl);
      if (Array.isArray(product?.images)) {
        product.images.forEach((img) => {
          const url = typeof img === 'string' ? img : img?.url;
          if (url) existingUrls.add(url);
        });
      }
      if (!existingUrls.has(this.primarySelection.url) || this.imagesToDelete.includes(this.primarySelection.url)) {
        this.primarySelection = null;
      }
    } else if (this.primarySelection.type === 'pending') {
      if (this.primarySelection.index >= this.pendingImages.length) {
        this.primarySelection = null;
      }
    }
  },

  isPrimaryImage(image, product) {
    if (this.primarySelection) {
      if (this.primarySelection.type === 'existing') {
        return image.type === 'existing' && image.originalUrl === this.primarySelection.url;
      }
      if (this.primarySelection.type === 'pending') {
        return image.type === 'pending' && image.pendingIndex === this.primarySelection.index;
      }
    }

    if (image.type === 'existing') {
      const productPrimary = product?.imageUrl
        || (Array.isArray(product?.images) ? (typeof product.images[0] === 'string' ? product.images[0] : product.images[0]?.url) : null);
      return image.originalUrl === productPrimary;
    }

    return false;
  },

  async applyPrimarySelection(productId) {
    if (!this.primarySelection) {
      this.log('No primary selection to apply');
      return;
    }

    this.log('Applying primary selection:', this.primarySelection);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`
    };

    try {
      if (this.primarySelection.type === 'existing') {
        this.log('Setting existing image as primary:', this.primarySelection.url);
        const response = await this.request(`${config.apiUrl}/products/${productId}/primary-image`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ url: this.primarySelection.url })
        });
        const result = await response.json();
        this.log('Primary image set result:', result);
        if (result.success) {
          this.showTemporaryMessage('Primary image updated successfully!', 'success');
        }
        return;
      }

      if (this.primarySelection.type === 'pending') {
        this.log('Setting pending image as primary, index:', this.primarySelection.index);

        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const response = await this.request(`${config.apiUrl}/products/${productId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        const data = await response.json();
        const product = data.product || data;
        const images = Array.isArray(product.images) ? product.images : [];

        this.log('Product images after upload:', images);
        this.log('Pending images count:', this.pendingImages.length);

        const targetIndex = images.length - this.pendingImages.length + this.primarySelection.index;
        const targetEntry = images[targetIndex];
        
        this.log('Target index:', targetIndex, 'Target entry:', targetEntry);

        const targetUrl = typeof targetEntry === 'string' ? targetEntry : targetEntry?.url;

        if (targetUrl) {
          this.log('Setting primary image URL:', targetUrl);
          const response = await this.request(`${config.apiUrl}/products/${productId}/primary-image`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ url: targetUrl })
          });
          const result = await response.json();
          this.log('Primary image set result:', result);
          if (result.success) {
            this.showTemporaryMessage('Primary image updated successfully!', 'success');
          }
        } else {
          this.log('Could not find target URL for pending image');
          this.showTemporaryMessage('Primary image could not be identified after upload. Please set it manually.', 'warning');
        }
      }
    } catch (error) {
      this.log('Failed to apply primary selection:', error);
      this.showTemporaryMessage('Failed to update primary image: ' + error.message, 'error');
    } finally {
      this.primarySelection = null;
    }
  },

  init() {
    this.log('Initializing admin products...');

    if (!window.auth || !window.auth.checkAdminAuth()) {
      this.log('Admin authentication failed, redirecting to login');
      window.location.href = 'user_login.html?auth=required';
      return;
    }
    
    if (typeof window.auth.checkAdminAuth !== 'function') {
      console.error('[adminProducts] checkAdminAuth function not available');
      window.location.href = 'user_login.html?auth=required';
      return;
    }
    
    if (!window.auth.checkAdminAuth()) {
      console.log('[adminProducts] Admin auth check failed');
      return;
    }

    this.log('Admin authentication passed');

    this.loadProducts();

    this.initProductForm();

    this.setupEventListeners();
    
    this.log('Admin products initialization completed');
  },

  async loadProducts(page = 1) {
    try {
      this.log('Loading products for page:', page);

      const sortFilter = document.getElementById('sortFilter')?.value || '';
      const categoryFilter = document.getElementById('categoryFilter')?.value || '';
      const stockFilter = document.getElementById('stockFilter')?.value || '';
      const searchQuery = document.getElementById('productSearch')?.value?.trim() || '';

      this.log('Current filters:', {
        sortFilter,
        categoryFilter,
        stockFilter,
        searchQuery,
        itemsPerPage: this.itemsPerPage
      });

      const params = new URLSearchParams({
        page: page,
        limit: this.itemsPerPage
      });

      if (sortFilter) {
        
        switch (sortFilter) {
          case 'name-asc':
            params.append('sort', 'name');
            break;
          case 'name-desc':
            params.append('sort', '-name');
            break;
          case 'price-asc':
            params.append('sort', 'price');
            break;
          case 'price-desc':
            params.append('sort', '-price');
            break;
          case 'stock-asc':
            params.append('sort', 'quantity');
            break;
          case 'stock-desc':
            params.append('sort', '-quantity');
            break;
        }
        this.log('Added sort parameter:', sortFilter);
      }

      if (categoryFilter && categoryFilter !== '' && categoryFilter !== 'all') {
        params.append('category', categoryFilter);
        this.log('Added category filter:', categoryFilter);
      }

      if (searchQuery) {
        params.append('search', searchQuery);
        this.log('Added search query:', searchQuery);
      }

      if (stockFilter && stockFilter !== '' && stockFilter !== 'all') {
        params.append('stock', stockFilter);
        this.log('Added stock filter:', stockFilter);
      }

      const apiUrl = `${config.apiUrl}/products?${params.toString()}`;
      this.log('Making API request to:', apiUrl);

      const response = await this.request(
        apiUrl,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      );

      console.log('[adminProducts] API response status:', response.status);
      const data = await response.json();
      this.log('API response received:', {
        success: data.success,
        productsCount: data.products?.length || 0,
        totalCount: data.totalCount,
        currentPage: data.currentPage,
        totalPages: data.totalPages
      });

      let products = Array.isArray(data.products) ? data.products : [];

      this.products = products;
      this.currentPage = data.currentPage || Math.max(1, parseInt(page, 10) || 1);
      this.totalCount = typeof data.totalCount === 'number' ? data.totalCount : this.totalCount;
      this.totalPages = data.totalPages || Math.max(1, Math.ceil((this.totalCount || this.products.length) / this.itemsPerPage));

      this.log('Updated state:', {
        productsCount: this.products.length,
        currentPage: this.currentPage,
        totalCount: this.totalCount,
        totalPages: this.totalPages
      });

      console.log('[adminProducts] Rendering product cards...');
      this.renderProductCards();
      this.addActionButtonListeners();

      console.log('[adminProducts] Updating pagination...');
      this.updatePagination();
      
      this.log('Products loaded successfully');
    } catch (error) {
      this.log('Error loading products:', error);
      this.showTemporaryMessage('Failed to load products. Please try again.', 'error');
    }
  },

  renderProductCards() {
    console.log('[adminProducts] renderProductCards called');
    const grid = document.getElementById('productGrid');
    if (!grid) {
      console.error('[adminProducts] Product grid container not found');
      return;
    }

    console.log('[adminProducts] Products to render:', this.products.length);
    grid.innerHTML = '';

    if (!Array.isArray(this.products) || this.products.length === 0) {
      console.log('[adminProducts] No products to display');
      grid.innerHTML = `
        <div class="empty-state" role="status" aria-live="polite" style="padding: 32px; text-align: center; color: #6c757d;">
          <i class="fas fa-box-open" aria-hidden="true" style="font-size: 32px; margin-bottom: 8px;"></i>
          <p style="margin: 0; font-weight: 500;">No products to display yet.</p>
          <small style="display: block; margin-top: 4px;">Click "Add New Product" to create your first catalog item.</small>
        </div>
      `;
      return;
    }

    this.products.forEach((product) => {
      const card = document.createElement('article');
      card.className = 'product-card';

      const rawId = String(product.id || product._id || '');
      const safeId = this.escapeHtml(rawId);
      const safeName = this.escapeHtml(product.name ?? 'Unnamed product');
      const safeCategory = this.escapeHtml(product.category ?? 'Uncategorized');
      const quantity = this.resolveQuantity(product);
      const stockStatus = quantity > 10 ? 'In Stock' : quantity > 0 ? 'Low Stock' : 'Out of Stock';
      const stockClass = quantity > 10 ? 'in-stock' : quantity > 0 ? 'low-stock' : 'out-of-stock';
      const imageUrl = this.escapeHtml(this.getProductImageUrl(product));
      const currency = (product.currency || 'INR').toUpperCase();
      const fmt = (val) => {
        try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(val || 0)); }
        catch { return `${currency} ${Number(val || 0).toFixed(2)}`; }
      };
      const priceHtml = product.clearance && product.discountedPrice
        ? `<span class="card-price discounted">${this.escapeHtml(fmt(product.discountedPrice))}</span>
           <span class="card-price original">${this.escapeHtml(fmt(product.price))}</span>`
        : `<span class="card-price">${this.escapeHtml(fmt(product.price))}</span>`;

      card.innerHTML = `
        <div class="product-card-image card-image-wrapper">
          <img src="${imageUrl}" alt="${safeName}" onerror="this.src='../assets/images/placeholder.png'" loading="lazy">
          ${product.clearance ? '<span class="card-badge clearance"><i class="fas fa-tag" aria-hidden="true"></i> Clearance</span>' : ''}
        </div>
        <div class="card-body">
          <div class="card-meta">
            <span class="card-category">${safeCategory}</span>
            <span class="card-stock ${stockClass}">
              <i class="fas fa-circle" aria-hidden="true"></i> ${this.escapeHtml(stockStatus)}
            </span>
          </div>
          <h3 class="card-title" title="${safeName}">${safeName}</h3>
          <div class="card-price-row">${priceHtml}</div>
          <div class="card-quantity">Stock: ${this.escapeHtml(quantity)}</div>
        </div>
        <footer class="card-actions">
          <button class="action-btn edit-btn" data-action="edit" data-id="${safeId}" title="Edit" aria-label="Edit product">
            <i class="fas fa-edit" aria-hidden="true"></i>
            <span class="action-text">Edit</span>
          </button>
          <button class="action-btn delete-btn" data-action="delete" data-id="${safeId}" title="Delete" aria-label="Delete product">
            <i class="fas fa-trash" aria-hidden="true"></i>
            <span class="action-text">Delete</span>
          </button>
        </footer>
      `;

      card.querySelectorAll('[data-id]').forEach((btn) => {
        btn.dataset.id = rawId;
      });

      grid.appendChild(card);
    });
  },

  getProductImageUrl(product) {
    if (config.debug) {
      console.log('🖼️ adminProducts.js - Getting image URL for product:', product?.name, product?._id);
      console.log('🖼️ Product image data:', {
        imageUrl: product?.imageUrl,
        images: product?.images,
        usingCloudinary: product?.usingCloudinary
      });
    }

    if (product.usingCloudinary && product.images && Array.isArray(product.images) && product.images.length > 0) {
      const firstImage = product.images[0];
      if (firstImage && firstImage.url) {
        this.log('Using Cloudinary image', firstImage.url);
        return firstImage.url;
      }
    }

    if (product.imageUrl && product.imageUrl.startsWith('http')) {
      this.log('Using external imageUrl', product.imageUrl);
      return product.imageUrl;
    }

    if (product.imageUrl) {
      
      const baseUrl = (window.CONFIG?.API_URL || '').replace(/\/api$/, '') || window.location.origin;
      const imagePath = product.imageUrl.startsWith('/') ? product.imageUrl : `/${product.imageUrl}`;
      const fullUrl = `${baseUrl}${imagePath}`;
      this.log('Using relative imageUrl', fullUrl);
      return fullUrl;
    }

    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      const firstImage = product.images[0];
      if (typeof firstImage === 'string') {
        if (firstImage.startsWith('http')) {
          this.log('Using external image from array', firstImage);
          return firstImage;
        } else {
          const baseUrl = (window.CONFIG?.API_URL || '').replace(/\/api$/, '') || window.location.origin;
          const imagePath = firstImage.startsWith('/') ? firstImage : `/${firstImage}`;
          const fullUrl = `${baseUrl}${imagePath}`;
          this.log('Using relative image from array', fullUrl);
          return fullUrl;
        }
      } else if (firstImage.url) {
        const url = firstImage.url.startsWith('http')
          ? firstImage.url
          : `${(window.CONFIG?.API_URL || '').replace(/\/api$/, '') || window.location.origin}${firstImage.url.startsWith('/') ? firstImage.url : '/' + firstImage.url}`;
        this.log('Using image object URL', url);
        return url;
      }
    }

    if (product.id || product._id) {
      const apiBase = window.CONFIG?.API_URL || `${window.location.origin}/api`;
      const apiUrl = `${apiBase}/products/image/${product.id || product._id}`;
      this.log('Using API endpoint fallback', apiUrl);
      return apiUrl;
    }

    this.log('Using placeholder image');
    return '../assets/images/placeholder.png';
  },

  updatePagination() {
    const paginationContainer = document.querySelector('.pagination');
    if (!paginationContainer) return;

    if (!this.__pager && window.Pagination) {
      this.__pager = window.Pagination.create({
        container: paginationContainer,
        onPage: (page) => this.loadProducts(page),
        getPageWindow: (current, total) => [Math.max(1, current - 2), Math.min(total, current + 2)]
      });
    }

    if (this.__pager) {
      this.__pager.render({
        currentPage: this.currentPage,
        totalPages: this.totalPages,
        totalItems: this.totalCount,
        limit: this.itemsPerPage
      });
    } else {
      
      paginationContainer.style.display = this.totalPages > 1 ? 'flex' : 'none';
    }
  },

  initProductForm() {
    console.log('[adminProducts] Initializing product form...');
    const productForm = document.getElementById('productForm');

    if (productForm) {
      console.log('[adminProducts] Product form found, initializing...');
      
      this.pendingImages = [];
      this.imagesToDelete = [];
      this.primarySelection = null;
      this.pendingObjectUrls = [];

      const categorySelect = productForm.querySelector('[name="category"]');
      if (categorySelect) {
        categorySelect.innerHTML = `
          <option value="">Select Category</option>
          <option value="Smart Lighting">Smart Lighting</option>
          <option value="Security">Security</option>
          <option value="Climate Control">Climate Control</option>
          <option value="Hubs & Bridges">Hubs & Bridges</option>
          <option value="Automation Kits">Automation Kits</option>
        `;
      }

      const clearanceCheckbox = document.getElementById('productClearance');
      const discountedPriceInput = document.getElementById('productDiscountedPrice');
      const clearanceGroup = document.getElementById('clearanceGroup');

      if (clearanceCheckbox && discountedPriceInput && clearanceGroup) {
        
        const setDisabledStyle = () => {
          discountedPriceInput.style.opacity = '0.5';
          discountedPriceInput.style.cursor = 'not-allowed';
          discountedPriceInput.style.backgroundColor = '#f5f5f5';
          discountedPriceInput.parentElement.style.opacity = '0.6';
          discountedPriceInput.placeholder = 'Enable clearance sale first';
        };

        const setEnabledStyle = () => {
          discountedPriceInput.style.opacity = '1';
          discountedPriceInput.style.cursor = 'text';
          discountedPriceInput.parentElement.style.opacity = '1';
          discountedPriceInput.placeholder = '0.00';
        };

        if (!clearanceCheckbox.checked) {
          setDisabledStyle();
        }

        clearanceCheckbox.addEventListener('change', (event) => {
          const isChecked = event.target.checked;

          if (isChecked) {
            clearanceGroup.classList.add('active');
            discountedPriceInput.disabled = false;
            discountedPriceInput.required = true;
            setEnabledStyle();
            discountedPriceInput.focus();

            discountedPriceInput.style.borderColor = '#e74c3c';
            discountedPriceInput.style.backgroundColor = '#fff5f5';

            this.showTemporaryMessage('Clearance mode enabled! Please set a discounted price.', 'info');
          } else {
            clearanceGroup.classList.remove('active');
            discountedPriceInput.disabled = true;
            discountedPriceInput.required = false;
            discountedPriceInput.value = '';

            discountedPriceInput.style.borderColor = '';
            setDisabledStyle();

            this.showTemporaryMessage('Clearance mode disabled.', 'info');
          }
        });

        discountedPriceInput.addEventListener('input', (event) => {
          const inputEl = event.target;
          const priceInput = document.getElementById('productPrice');
          const regularPrice = parseFloat(priceInput?.value || 0);
          const discountedPrice = parseFloat(inputEl.value || 0);

          if (clearanceCheckbox.checked && discountedPrice > 0) {
            if (discountedPrice >= regularPrice) {
              inputEl.style.borderColor = '#e74c3c';
              inputEl.style.backgroundColor = '#fff0f0';
              this.showTemporaryMessage('Discounted price must be lower than regular price!', 'error');
            } else {
              inputEl.style.borderColor = '#2ecc71';
              inputEl.style.backgroundColor = '#f0fff4';
              const savings = regularPrice - discountedPrice;
              const percentage = ((savings / regularPrice) * 100).toFixed(1);
              this.showTemporaryMessage(`Great! Customer saves $${savings.toFixed(2)} (${percentage}% off)`, 'success');
            }
          }
        });
      }

      productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitButton = productForm.querySelector('button[type="submit"]');
        if (submitButton) {
          submitButton.disabled = true;
          if (!window.adminLoader || !window.adminLoader.isOverlayActive()) {
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
          } else {
            submitButton.innerHTML = 'Saving...';
          }
        }

        try {
          
          const name = (productForm.elements['name']?.value || '').trim();
          const category = (productForm.elements['category']?.value || '').trim();
          const price = parseFloat(productForm.elements['price']?.value || '0');
          const qty = parseInt(productForm.elements['quantity']?.value || '0');
          const clearance = document.getElementById('productClearance')?.checked;
          const discounted = parseFloat(document.getElementById('productDiscountedPrice')?.value || '0');
          if (name.length < 3 || name.length > 120) {
            this.showTemporaryMessage('Product name must be between 3 and 120 characters.', 'error');
            return;
          }
          if (!/^[\w\s&'"()\-.,:+/]+$/.test(name)) {
            this.showTemporaryMessage('Product name contains invalid characters.', 'error');
            return;
          }
          if (!category) {
            this.showTemporaryMessage('Please select a category.', 'error');
            return;
          }
          if (isNaN(price) || price < 0 || price > 1000000) {
            this.showTemporaryMessage('Please enter a valid price (0 to 1,000,000).', 'error');
            return;
          }
          if (!Number.isInteger(qty) || qty < 0 || qty > 1000000) {
            this.showTemporaryMessage('Please enter a valid quantity (0 to 1,000,000).', 'error');
            return;
          }
          if (clearance && (!discounted || discounted >= price)) {
            this.showTemporaryMessage('Discounted price must be lower than regular price.', 'error');
            return;
          }
          const formData = new FormData(productForm);
          const productId = productForm.dataset.productId;

          const productData = {};
          for (const [key, value] of formData.entries()) {
            if (key !== 'productImage' && key !== 'images') { 
              productData[key] = value;
            }
          }

          productData.price = Number(productData.price);
          productData.quantity = Number(productData.quantity);
          if (clearance) {
            productData.discountedPrice = Number(productData.discountedPrice);
          } else {
            delete productData.discountedPrice;
          }
          productData.clearance = !!clearance;

          ['price', 'quantity', 'discountedPrice'].forEach((field) => {
            if (field in productData && (Number.isNaN(productData[field]) || !Number.isFinite(productData[field]))) {
              delete productData[field];
            }
          });

          let response;
          let savedProductId = productId;

          if (productId) {
            this.log('Updating product:', productId, productData);
            response = await this.request(`${config.apiUrl}/products/${productId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
              },
              body: JSON.stringify(productData)
            });

            const result = await response.json();
            this.log('Product update response:', result);
            if (!result.success) {
              throw new Error(result.message || 'Failed to update product');
            }
          } else {
            this.log('Creating product:', productData);
            response = await this.request(`${config.apiUrl}/products`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
              },
              body: JSON.stringify(productData)
            });

            const result = await response.json();
            this.log('Product creation response:', result);
            if (!result.success) {
              throw new Error(result.message || 'Failed to create product');
            }
            const createdProduct = result.product || result;
            savedProductId = createdProduct?._id || createdProduct?.id || savedProductId;
          }

          const hasPrimarySelection = !!this.primarySelection;
          if (savedProductId && (this.pendingImages?.length > 0 || this.imagesToDelete?.length > 0 || hasPrimarySelection)) {

            this.showImageProgress('Processing images...');

            if (this.imagesToDelete?.length > 0) {
              console.log('🗑️ Starting image deletion process:', {
                productId: savedProductId,
                imagesToDelete: this.imagesToDelete,
                count: this.imagesToDelete.length
              });
              
              for (const imageUrl of this.imagesToDelete) {
                try {
                  console.log('🔄 Processing image deletion:', { imageUrl, productId: savedProductId });

                  const fileId = this.extractCloudinaryFileId(imageUrl);
                  if (fileId) {
                    console.log('☁️ Deleting Cloudinary image:', { fileId, imageUrl });
                    
                    await this.deleteImageFromCloudinary(savedProductId, fileId);
                  } else {
                    console.log('💾 Deleting local image:', { imageUrl, productId: savedProductId });
                    
                    const deleteUrl = `${config.apiUrl}/products/${savedProductId}/images`;
                    const response = await this.request(deleteUrl, {
                      method: 'DELETE',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                      },
                      body: JSON.stringify({ url: imageUrl })
                    });
                    console.log('✅ Local image deletion response:', response);
                  }
                } catch (err) {
                  console.error('❌ Failed to delete image:', {
                    imageUrl,
                    productId: savedProductId,
                    error: err.message,
                    stack: err.stack
                  });
                  this.log('Failed to delete image', imageUrl, err);
                  
                  this.showTemporaryMessage(`Failed to delete image: ${err.message}`, 'error');
                }
              }
            }

            if (this.pendingImages?.length > 0) {
              const toUpload = this.pendingImages.slice(0, 10);

              this.showImageProgress(`Uploading ${toUpload.length} image${toUpload.length > 1 ? 's' : ''}...`);

              try {
                
                const uploadResult = await this.uploadImagesToCloudinary(savedProductId, toUpload);
                this.log('Cloudinary upload successful:', uploadResult);
              } catch (err) {
                this.log('Cloudinary upload failed, trying local upload:', err);

                try {
                  const localUploadResult = await this.uploadImagesLocally(savedProductId, toUpload);
                  this.log('Local upload successful:', localUploadResult);
                } catch (localErr) {
                  this.log('Both Cloudinary and local upload failed:', localErr);
                  this.showTemporaryMessage('Failed to upload images. Please try again.', 'error');
                }
              }
            }

            if (hasPrimarySelection) {
              await this.applyPrimarySelection(savedProductId);
            }

            this.hideImageProgress();
          }

          this.clearPendingChanges();

          productForm.reset();
          productForm.dataset.productId = '';
          this.hideProductModal();
          this.loadProducts(this.currentPage);

          this.showTemporaryMessage(
            productId ? 'Product updated successfully!' : 'Product created successfully!',
            'success'
          );

        } catch (error) {
          this.log('Form submission error:', error);
          this.hideImageProgress();
          this.showTemporaryMessage('Failed to save product: ' + error.message, 'error');
        } finally {
          
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-save" aria-hidden="true"></i> Save Product';
          }
        }
      });
    }
  },

  addActionButtonListeners() {
    if (this._handleActionClick) {
      return;
    }

    this._handleActionClick = (event) => {
      const button = event.target.closest('button[data-action][data-id]');
      if (!button) return;

      const { action, id } = button.dataset;
      if (!id) return;

      if (action === 'edit') {
        this.editProduct(id);
      } else if (action === 'delete') {
        this.deleteProduct(id);
      }
    };

    const grid = document.getElementById('productGrid');

    grid?.addEventListener('click', this._handleActionClick);
  },

  setupEventListeners() {
    this.log('Setting up event listeners...');

    const addProductBtn = document.getElementById('addProductBtn');
    if (addProductBtn) {
      this.log('Found add product button, attaching click listener');
      addProductBtn.addEventListener('click', () => {
        this.showProductModal({ mode: 'add' });
      });
    } else {
      this.log('Add product button not found');
    }

    const productSearchInput = document.getElementById('productSearch');
    if (productSearchInput) {
      this.log('Found search input, attaching event listeners');

      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = null;
      }
      
      productSearchInput.addEventListener('input', () => {
        const currentValue = productSearchInput.value.trim();
        this.log('Search input changed:', currentValue);

        if (currentValue === this.lastSearchValue) {
          this.log('Search value unchanged, skipping');
          return;
        }

        if (this.searchTimeout) {
          clearTimeout(this.searchTimeout);
        }
        
        this.searchTimeout = setTimeout(() => {
          this.log('Executing search with query:', currentValue);
          this.lastSearchValue = currentValue;
          this.searchTimeout = null;
          this.loadProducts(1);
        }, 500); 
      });

      productSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const currentValue = productSearchInput.value.trim();
          this.log('Search triggered by Enter key');

          if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = null;
          }
          
          this.lastSearchValue = currentValue;
          this.loadProducts(1);
        }
      });
    } else {
      this.log('Search input not found');
    }

    const itemsPerPageSelect = document.getElementById('itemsPerPage');
    if (itemsPerPageSelect) {
      this.log('Found items per page selector, attaching change listener');
      itemsPerPageSelect.addEventListener('change', (e) => {
        const value = parseInt(e.target.value, 10) || 10;
        this.log('Items per page changed to:', value);
        this.itemsPerPage = value;
        this.loadProducts(1);
      });
    } else {
      this.log('Items per page selector not found');
    }

    const sortFilter = document.getElementById('sortFilter');
    if (sortFilter) {
      this.log('Found sort filter, attaching change listener');
      sortFilter.addEventListener('change', (e) => {
        this.log('Sort filter changed to:', e.target.value);
        this.loadProducts(1);
      });
    } else {
      this.log('Sort filter not found');
    }

    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
      this.log('Found category filter, attaching change listener');
      categoryFilter.addEventListener('change', (e) => {
        this.log('Category filter changed to:', e.target.value);
        this.loadProducts(1);
      });
    } else {
      this.log('Category filter not found');
    }

    const stockFilter = document.getElementById('stockFilter');
    if (stockFilter) {
      this.log('Found stock filter, attaching change listener');
      stockFilter.addEventListener('change', (e) => {
        this.log('Stock filter changed to:', e.target.value);
        this.loadProducts(1);
      });
    } else {
      this.log('Stock filter not found');
    }

    const refreshBtn = document.getElementById('refreshProducts');
    if (refreshBtn) {
      this.log('Found refresh button, attaching click listener');
      refreshBtn.addEventListener('click', () => {
        this.log('Refresh button clicked');
        this.loadProducts(1);
      });
    } else {
      this.log('Refresh button not found');
    }

    document.querySelectorAll('#productModal .close-modal').forEach(btn => {
      btn.addEventListener('click', () => this.hideProductModal());
    });

    this.log('Event listeners setup completed');
  },

  async showProductModal({ mode = 'add', productId = null } = {}) {
    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');

    if (!modal || !form) {
      return;
    }

    const titleEl = document.getElementById('productModalTitle');
    const galleryContainer = document.getElementById('productImageGallery');

    if (mode === 'add') {
      form.reset();
      form.dataset.productId = '';
      this.clearPendingChanges();
      if (titleEl) titleEl.textContent = 'Add New Product';
      if (galleryContainer) {
        this.renderProductImagesGallery({}, galleryContainer);
      }
      form.querySelectorAll('input, textarea, select').forEach(el => el.disabled = false);

      const discountedPriceInput = document.getElementById('productDiscountedPrice');
      const clearanceCheckbox = document.getElementById('productClearance');
      if (discountedPriceInput && clearanceCheckbox) {
        discountedPriceInput.disabled = true;
        discountedPriceInput.style.opacity = '0.5';
        discountedPriceInput.style.cursor = 'not-allowed';
        discountedPriceInput.style.backgroundColor = '#f5f5f5';
        discountedPriceInput.parentElement.style.opacity = '0.6';
        discountedPriceInput.placeholder = 'Enable clearance sale first';
        clearanceCheckbox.checked = false;
      }
    } else if (mode === 'edit') {
      if (titleEl) titleEl.textContent = 'Edit Product';
      form.querySelectorAll('input, textarea, select').forEach(el => el.disabled = false);
    }

    if (typeof ModalUtils !== 'undefined') {
      ModalUtils.openModal('productModal', {
        animation: 'scale-in',
        trapFocus: true,
        closeOnEscape: true,
        closeOnBackdrop: false,
        onOpen: () => {
          
          const firstInput = modal.querySelector('input:not([type="hidden"])');
          if (firstInput) firstInput.focus();
        }
      });
    } else {
      
      modal.classList.add('active');

      const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (firstEl) firstEl.focus();
      const trap = (e) => {
        if (e.key === 'Tab') {
          if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
          else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
        } else if (e.key === 'Escape') {
          this.hideProductModal();
        }
      };
      modal.addEventListener('keydown', trap);
      modal._trapHandler = trap;
    }
  },

  hideProductModal() {
    const modal = document.getElementById('productModal');

    if (modal) {
      
      if (typeof ModalUtils !== 'undefined') {
        ModalUtils.closeModal('productModal');
      } else {
        
        modal.classList.remove('active');
        
        if (modal._trapHandler) {
          modal.removeEventListener('keydown', modal._trapHandler);
          delete modal._trapHandler;
        }
      }

      if (typeof clearPendingChanges === 'function') {
        clearPendingChanges();
      }
    }
  },

  showImageProgress(message) {
    const statusMessage = document.getElementById('productStatusMessage');
    if (statusMessage) {
      statusMessage.textContent = message;
      statusMessage.className = 'status-message info';
      statusMessage.style.display = 'block';
    }
  },

  hideImageProgress() {
    const statusMessage = document.getElementById('productStatusMessage');
    if (statusMessage) {
      statusMessage.style.display = 'none';
    }
  },

  clearPendingChanges() {
    [...(this.pendingImages || [])].forEach(({ previewUrl }) => {
      if (previewUrl) {
        try { URL.revokeObjectURL(previewUrl); } catch { }
      }
    });

    if (this.pendingObjectUrls?.length) {
      this.pendingObjectUrls.forEach(url => {
        try { URL.revokeObjectURL(url); } catch { }
      });
    }

    this.pendingImages = [];
    this.imagesToDelete = [];
    this.primarySelection = null;
    this.pendingObjectUrls = [];

    document.querySelectorAll('img[src^="blob:"]').forEach(img => {
      URL.revokeObjectURL(img.src);
    });
  },

  renderProductImagesGallery(product = {}, container) {
    if (!container) return;

    this.ensurePrimarySelectionValidity(product);

    const imagesToDeleteSet = new Set(this.imagesToDelete || []);
    const allImages = [];
    const addedUrls = new Set();

    const registerExistingImage = (source, { primaryCandidate = false } = {}) => {
      if (!source) return;
      const url = typeof source === 'string' ? source : source?.url;
      if (!url || addedUrls.has(url)) return;
      addedUrls.add(url);
      allImages.push({
        url,
        originalUrl: url,
        type: 'existing',
        isExisting: true,
        primaryCandidate
      });
    };

    registerExistingImage(product?.imageUrl, { primaryCandidate: true });

    if (Array.isArray(product?.images)) {
      product.images.forEach((img, index) => {
        const primaryCandidate = !product?.imageUrl && index === 0;
        registerExistingImage(img, { primaryCandidate });
      });
    }

    const pendingEntries = (this.pendingImages || []).map(({ file, previewUrl }, index) => ({
      url: previewUrl,
      originalUrl: previewUrl,
      type: 'pending',
      isExisting: false,
      filename: file.name,
      size: file.size,
      pendingIndex: index
    }));

    const combinedImages = [...allImages, ...pendingEntries].map((image) => {
      const markedForDeletion = image.type === 'existing' && imagesToDeleteSet.has(image.originalUrl);
      return {
        ...image,
        markedForDeletion,
        isPrimary: this.isPrimaryImage(image, product)
      };
    });

    const timestamp = Date.now();
    const imagesHtml = combinedImages.length > 0 ? combinedImages.map((image, index) => {
      const imageId = `img_${timestamp}_${index}`;
      const isPending = image.type === 'pending';
      const isMarkedForDeletion = image.markedForDeletion;
      const isPrimary = image.isPrimary;
      const rawUrl = image.originalUrl || image.url;
      const encodedUrl = encodeURIComponent(rawUrl);
      const safeUrl = this.escapeHtml(image.url);
      const rawFilename = image.filename || 'Product Image';
      const encodedFilename = encodeURIComponent(rawFilename);
      const safeFilename = this.escapeHtml(rawFilename);
      const placeholderUrl = this.escapeHtml('../assets/images/placeholder.png');
      const borderStyle = isPrimary
        ? '3px solid #3498db'
        : isPending
          ? '2px dashed #f39c12'
          : isMarkedForDeletion
            ? '2px dashed #e74c3c'
            : '1px solid #ddd';

      return `
        <div class="image-item ${isPending ? 'pending' : ''} ${isMarkedForDeletion ? 'marked-for-deletion' : ''}" 
             style="position: relative; display: inline-block; margin: 8px; border-radius: 8px; overflow: hidden; 
                    border: ${borderStyle}; 
                    background: #fff; opacity: ${isMarkedForDeletion ? '0.5' : '1'};">
          
          <div style="position: relative; width: 150px; height: 150px;">
            <div id="${imageId}_loading" class="loading-indicator" 
                 style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #666; z-index: 2;">
              <i class="fas fa-spinner fa-spin"></i>
            </div>
            
      <img src="${safeUrl}" 
        data-url="${encodedUrl}" 
        data-filename="${encodedFilename}" 
        data-loading-id="${imageId}_loading"
        data-placeholder="${placeholderUrl}"
                 alt="Product image preview" 
                 style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; 
                        background-color: #f8f9fa; opacity: 0; transition: opacity 0.3s; cursor: pointer;"
                 loading="${index < 4 ? 'eager' : 'lazy'}">
            
            ${isPrimary ? '<div class="badge primary-badge" style="position: absolute; top: 4px; left: 4px; background: #3498db; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">PRIMARY</div>' : ''}
            ${isPending ? '<div class="badge pending-badge" style="position: absolute; bottom: 4px; left: 4px; background: #f39c12; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">PREVIEW</div>' : ''}
            ${isMarkedForDeletion ? '<div class="badge delete-badge" style="position: absolute; bottom: 4px; left: 4px; background: #e74c3c; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">DELETE</div>' : ''}

            ${isPending ? `
              <div class="image-info" style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); color: white; padding: 4px; font-size: 10px;">
                <div>${safeFilename}</div>
                <div>${this.formatFileSize(image.size)}</div>
              </div>
            ` : ''}
          </div>
          
          <div class="action-buttons" style="position: absolute; top: 4px; right: 4px; display: flex; gap: 4px;">
            ${!isMarkedForDeletion ? `
              <button class="btn-action remove-image" data-url="${encodedUrl}" data-type="${image.type}" data-index="${image.pendingIndex ?? ''}" 
                      style="background:#e74c3c; color:#fff; border:none; border-radius:4px; padding:4px 6px; cursor:pointer; font-size:11px;" 
                      title="Remove image" aria-label="Remove image">
                <i class='fas fa-trash' aria-hidden="true"></i>
              </button>
            ` : `
              <button class="btn-action undo-delete" data-url="${encodedUrl}" 
                      style="background:#2ecc71; color:#fff; border:none; border-radius:4px; padding:4px 6px; cursor:pointer; font-size:11px;" 
                      title="Undo delete" aria-label="Undo delete">
                <i class='fas fa-undo' aria-hidden="true"></i>
              </button>
            `}
            
            ${!isPrimary && !isMarkedForDeletion ? `
              <button class="btn-action set-primary" data-url="${encodedUrl}" data-type="${image.type}" data-index="${image.pendingIndex ?? ''}" 
                      style="background:#2ecc71; color:#fff; border:none; border-radius:4px; padding:4px 6px; cursor:pointer; font-size:11px;" 
                      title="Set as primary" aria-label="Set as primary image">
                <i class='fas fa-star' aria-hidden="true"></i>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('') : '<p style="color: #666; font-style: italic; text-align: center; padding: 40px;">No images selected yet</p>';

    const pendingCount = this.pendingImages?.length ?? 0;
    const deleteCount = this.imagesToDelete?.length ?? 0;
    const changesSummary = pendingCount > 0 || deleteCount > 0 ?
      `<div class="changes-summary" style="font-size: 0.85em; color: #f39c12; margin-bottom: 10px; padding: 8px; background: #fff8e1; border-radius: 4px; border-left: 4px solid #f39c12;">
        <i class="fas fa-info-circle"></i> 
        ${pendingCount > 0 ? `${pendingCount} new image${pendingCount > 1 ? 's' : ''} to upload` : ''}
        ${pendingCount > 0 && deleteCount > 0 ? ', ' : ''}
        ${deleteCount > 0 ? `${deleteCount} image${deleteCount > 1 ? 's' : ''} to delete` : ''}
        - Changes will be saved when you submit the form
      </div>` : '';

    const savedCount = combinedImages.filter(img => img.isExisting && !img.markedForDeletion).length;

    container.innerHTML = `
      <div style="margin-bottom: 15px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <div style="font-weight: 600; color: #2c3e50;">
            Product Images
            <span style="margin-left: 10px; font-size: 0.85em; color: #6c757d;">
              (${savedCount} saved, ${pendingCount} pending)
            </span>
          </div>
          <label class="add-images-btn" style="display:inline-flex; align-items:center; gap:6px; font-size:.9em; cursor:pointer; 
                 background:#3498db; color:white; padding:8px 12px; border-radius:6px; border:none; transition: background 0.2s;">
            <i class="fas fa-plus" aria-hidden="true"></i> Add Images
            <input id="galleryAddInput" type="file" accept="image/*" multiple style="display:none;">
          </label>
        </div>
      `;
      
      container.innerHTML = galleryHTML;
      
      this.setupImageGalleryEvents(container, product);
    },
    
    setupImageGalleryEvents(container, product) {
        const addInput = container.querySelector('#galleryAddInput');
        if (addInput) {
            addInput.addEventListener('change', async (e) => {
                if (!e.target.files || e.target.files.length === 0) return;
                
                const files = Array.from(e.target.files);
                const availableSlots = Math.max(0, 10 - (this.pendingImages?.length || 0));
                const selected = files.slice(0, availableSlots);
                if (files.length > selected.length) {
                    this.showTemporaryMessage('Maximum 10 images can be added at once.', 'info');
                }

                if (!this.pendingImages) this.pendingImages = [];

                for (const file of selected) {
                    if (!file.type.startsWith('image/')) {
                        this.showTemporaryMessage(`${file.name} is not an image file`, 'error');
                        continue;
                    }

                    if (file.size > 5 * 1024 * 1024) {
                        try {
                            this.showImageProgress(`Compressing ${file.name} ...`);
                            const compressed = await this.compressImage(file, {
                                maxWidth: 1600,
                                maxHeight: 1600,
                                quality: 0.85
                            });
                            if (compressed && compressed.size <= 5 * 1024 * 1024) {
                                this.addPendingImage(compressed);
                                this.renderProductImagesGallery(product, container);
                            } else {
                                this.showTemporaryMessage(`${file.name} is too large even after compression`, 'error');
                            }
                        } catch (err) {
                            this.showTemporaryMessage(`Failed to compress ${file.name}`, 'error');
                        }
                    } else {
                        this.addPendingImage(file);
                        this.renderProductImagesGallery(product, container);
                    }
                }
                this.hideImageProgress();

                addInput.value = ''; 
            });
        }

        this.setupGalleryImageLifecycle(container);
        this.setupImageActionEvents(container, product);
    },

    setupImageActionEvents(container, product) {
        container.querySelectorAll('.remove-image').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const url = this.decodeAttribute(btn.getAttribute('data-url'));
        const type = btn.getAttribute('data-type');
        const indexAttr = btn.getAttribute('data-index');
        const index = indexAttr === '' || indexAttr == null ? null : Number(indexAttr);

        if (type === 'pending') {
          
          if (this.pendingImages && index !== null && index >= 0 && index < this.pendingImages.length) {
            const [removed] = this.pendingImages.splice(index, 1);
            if (removed?.previewUrl) {
              try { URL.revokeObjectURL(removed.previewUrl); } catch { }
              this.pendingObjectUrls = this.pendingObjectUrls.filter(u => u !== removed.previewUrl);
            }
            if (this.primarySelection?.type === 'pending') {
              if (this.primarySelection.index === index) {
                this.primarySelection = null;
              } else if (this.primarySelection.index > index) {
                this.primarySelection.index -= 1;
              }
            }
            this.renderProductImagesGallery(product, container);
          }
        } else {
          
          if (!this.imagesToDelete) this.imagesToDelete = [];
          if (url && !this.imagesToDelete.includes(url)) {
            this.imagesToDelete.push(url);
            if (this.primarySelection?.type === 'existing' && this.primarySelection.url === url) {
              this.primarySelection = null;
            }
            this.renderProductImagesGallery(product, container);
          }
        }
      });
    });

    container.querySelectorAll('.undo-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const url = this.decodeAttribute(btn.getAttribute('data-url'));

        if (this.imagesToDelete) {
          this.imagesToDelete = this.imagesToDelete.filter(u => u !== url);
          this.renderProductImagesGallery(product, container);
        }
      });
    });

    container.querySelectorAll('.set-primary').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const type = btn.getAttribute('data-type');
        const indexAttr = btn.getAttribute('data-index');
        const index = indexAttr === '' || indexAttr == null ? null : Number(indexAttr);
        const url = this.decodeAttribute(btn.getAttribute('data-url'));

        this.log('Set primary clicked:', { type, index, url });

        if (type === 'pending') {
          if (index !== null && !Number.isNaN(index)) {
            this.primarySelection = { type: 'pending', index };
            this.log('Primary selection set to pending image:', index);
            this.showTemporaryMessage('Primary image selected! Click "Save Product" to apply changes.', 'info');
          }
        } else {
          if (url) {
            this.primarySelection = { type: 'existing', url };
            this.log('Primary selection set to existing image:', url);
            this.showTemporaryMessage('Primary image selected! Click "Save Product" to apply changes.', 'info');
          }
        }

        this.renderProductImagesGallery(product, container);
      });
    });

    container.querySelectorAll('.image-item img').forEach(img => {
      img.addEventListener('click', () => {
        const url = this.decodeAttribute(img.getAttribute('data-url'));
        const filename = this.decodeAttribute(img.getAttribute('data-filename'));
        if (url) {
          this.openImagePreview(url, filename);
        }
      });
    });
  },

  setupGalleryImageLifecycle(container) {
    const images = container.querySelectorAll('.image-item img');
    images.forEach(img => {
      const loadingId = img.getAttribute('data-loading-id');
      const placeholder = img.getAttribute('data-placeholder');
      const loadingIndicator = loadingId ? document.getElementById(loadingId) : null;

      const handleLoad = () => {
        if (loadingIndicator) {
          loadingIndicator.style.display = 'none';
        }
        img.style.opacity = '1';
      };

      const handleError = () => {
        if (placeholder && img.src !== placeholder) {
          img.src = placeholder;
        }
        if (loadingIndicator) {
          loadingIndicator.style.display = 'none';
        }
        img.style.opacity = '1';
      };

      img.addEventListener('load', handleLoad, { once: true });
      img.addEventListener('error', handleError, { once: true });

      if (img.complete) {
        if (img.naturalWidth > 0) {
          handleLoad();
        } else {
          handleError();
        }
      }
    });
  },

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  openImagePreview(imageUrl, filename) {
    if (!imageUrl) return;
    
    let modal = document.getElementById('imagePreviewModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'imagePreviewModal';
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.9); display: flex; align-items: center; 
        justify-content: center; z-index: 10000; opacity: 0; 
        transition: opacity 0.3s ease;
      `;

      modal.innerHTML = `
        <div style="position: relative; max-width: 90%; max-height: 90%; text-align: center;">
          <img id="previewModalImage" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;" />
          <div style="color: white; margin-top: 10px; font-size: 14px;" id="previewModalFilename"></div>
          <button id="previewModalClose" style="position: absolute; top: -40px; right: 0; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-size: 16px;">×</button>
        </div>
      `;

      document.body.appendChild(modal);

      const closeButton = modal.querySelector('#previewModalClose');
      if (closeButton) {
        closeButton.addEventListener('click', (event) => {
          event.preventDefault();
          this.closeImagePreview();
        });
      }

      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeImagePreview();
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
          this.closeImagePreview();
        }
      });
    }

    const imageEl = document.getElementById('previewModalImage');
    const nameEl = document.getElementById('previewModalFilename');
    if (imageEl) {
      imageEl.src = imageUrl;
    }
    if (nameEl) {
      nameEl.textContent = filename || 'Product Image';
    }
    modal.style.display = 'flex';
    setTimeout(() => modal.style.opacity = '1', 10);
  },

  closeImagePreview() {
    const modal = document.getElementById('imagePreviewModal');
    if (modal) {
      modal.style.opacity = '0';
      setTimeout(() => modal.style.display = 'none', 300);
    }
  },

  async compressImage(file, options = {}) {
    if (window.AdminImageService?.compress) {
      const blob = await window.AdminImageService.compress(file, options);
      return blob || file;
    }
    return file;
  },

  async editProduct(productId) {
    try {
      
      const loadingOverlay = document.getElementById('loading-overlay');
      if (loadingOverlay) loadingOverlay.style.display = 'flex';

      this.log('Fetching product for edit:', productId);

      const response = await this.request(`${config.apiUrl}/products/${productId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      this.log('Product fetch response:', data);

      if (data.success && data.product) {
        const product = data.product;

        const form = document.getElementById('productForm');
        if (form) {
          form.elements['name'].value = product.name || '';
          form.elements['price'].value = product.price || 0;
          form.elements['category'].value = product.category || '';
          if (form.elements['quantity']) {
            form.elements['quantity'].value = product.quantity || product.stock || product.stockQuantity || 0;
          }
          form.elements['description'].value = product.description || '';

          const clearanceCheckbox = document.getElementById('productClearance');
          const discountedPriceInput = document.getElementById('productDiscountedPrice');
          const clearanceGroup = document.getElementById('clearanceGroup');

          if (clearanceCheckbox && discountedPriceInput && clearanceGroup) {
            clearanceCheckbox.checked = product.clearance || false;

            if (product.clearance) {
              
              clearanceGroup.classList.add('active');
              discountedPriceInput.disabled = false;
              discountedPriceInput.required = true;
              discountedPriceInput.value = product.discountedPrice || '';

              discountedPriceInput.style.opacity = '1';
              discountedPriceInput.style.cursor = 'text';
              discountedPriceInput.parentElement.style.opacity = '1';
              discountedPriceInput.placeholder = '0.00';
              discountedPriceInput.style.borderColor = '#e74c3c';
              discountedPriceInput.style.backgroundColor = '#fff5f5';
            } else {
              
              clearanceGroup.classList.remove('active');
              discountedPriceInput.disabled = true;
              discountedPriceInput.required = false;
              discountedPriceInput.value = '';

              discountedPriceInput.style.opacity = '0.5';
              discountedPriceInput.style.cursor = 'not-allowed';
              discountedPriceInput.style.backgroundColor = '#f5f5f5';
              discountedPriceInput.parentElement.style.opacity = '0.6';
              discountedPriceInput.placeholder = 'Enable clearance sale first';
              discountedPriceInput.style.borderColor = '';
            }
          }

          form.dataset.productId = productId;

          this.clearPendingChanges();
          this.imagesToDelete = [];
          this.primarySelection = null;

          const galleryContainer = document.getElementById('productImageGallery');
          if (galleryContainer) {
            this.renderProductImagesGallery(product, galleryContainer);
          }

          this.showProductModal({ mode: 'edit' });
        } else {
          throw new Error('Product data not found in response');
        }
      } else {
        throw new Error(data.message || 'Failed to fetch product details');
      }
    } catch (error) {
      this.log('Error fetching product:', error);
      this.showTemporaryMessage(error.message || 'Failed to fetch product details', 'error');
    } finally {
      
      const loadingOverlay = document.getElementById('loading-overlay');
      if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
  },

  async deleteProduct(productId) {
    
    if (typeof ModalUtils !== 'undefined') {
      const confirmed = await ModalUtils.warning({
        title: 'Delete Product',
        message: 'Are you sure you want to delete this product? This action cannot be undone.',
        okText: 'Delete Product',
        okClass: 'btn-danger'
      });
      if (!confirmed) return;
    } else if (typeof window.openConfirmModal === 'function') {
      const confirmed = await window.openConfirmModal({
        title: 'Confirm Delete',
        message: 'Are you sure you want to delete this product?',
        confirmText: 'Delete',
        danger: true
      });
      if (!confirmed) return;
    } else {
      if (!confirm('Are you sure you want to delete this product?')) return;
    }

    try {
      const response = await this.request(`${config.apiUrl}/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        
        this.loadProducts(this.currentPage);

        this.showTemporaryMessage('Product deleted successfully', 'success');
      } else {
        throw new Error('Failed to delete product');
      }
    } catch (error) {
      this.log('Error deleting product:', error);
      this.showTemporaryMessage(error.message || 'Failed to delete product', 'error');
    }
  },

  async uploadImagesToCloudinary(productId, images) {
    try {
      const formData = new FormData();
      images.forEach((image, index) => {
        formData.append('images', image.file);
      });

      const response = await this.request(`${config.apiUrl}/products/${productId}/images/cloudinary/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: formData
      });

      const data = await response.json();
      return data;
    } catch (error) {
      this.log('Error uploading images to Cloudinary:', error);
      throw error;
    }
  },

  async uploadImagesLocally(productId, images) {
    try {
      const formData = new FormData();
      images.forEach((image, index) => {
        formData.append('images', image.file);
      });

      const response = await this.request(`${config.apiUrl}/products/${productId}/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: formData
      });

      const data = await response.json();
      return data;
    } catch (error) {
      this.log('Error uploading images locally:', error);
      throw error;
    }
  },

  async deleteImageFromCloudinary(productId, fileId) {
    try {
      const response = await this.request(`${config.apiUrl}/products/${productId}/images/cloudinary`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ fileId })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      this.log('Error deleting image from Cloudinary:', error);
      throw error;
    }
  },

  extractCloudinaryFileId(url) {
    if (!url || typeof url !== 'string') return null;

    try {
      
      const patterns = [
        /\/v\d+\/(.+)\.(jpg|jpeg|png|gif|webp)/i,
        /\/image\/upload\/v\d+\/(.+)\.(jpg|jpeg|png|gif|webp)/i,
        /\/image\/upload\/(.+)\.(jpg|jpeg|png|gif|webp)/i
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          return match[1];
        }
      }

      return null;
    } catch (error) {
      this.log('Error extracting Cloudinary file ID:', error);
      return null;
    }
  },

  refreshProductList() {
    this.loadProducts(this.currentPage);
  },

  log(...args) {
    if (config.debug) {
      console.log('[adminProducts]', ...args);
    }
  },

  showTemporaryMessage(message, type = 'info') {
    const messageContainer = document.getElementById('admin-message-container');
    if (!messageContainer) {
      console.warn('Message container not found');
      return;
    }

    const messageEl = document.createElement('div');
    messageEl.className = `admin-message ${type}`;
    messageEl.textContent = message;
    
    messageContainer.innerHTML = '';
    messageContainer.appendChild(messageEl);
    messageContainer.style.display = 'block';

    setTimeout(() => {
      messageEl.style.opacity = '0';
      setTimeout(() => {
        if (messageContainer.contains(messageEl)) {
          messageContainer.removeChild(messageEl);
        }
        if (messageContainer.children.length === 0) {
          messageContainer.style.display = 'none';
        }
      }, 300);
    }, 3000);
  },

  showImageProgress(message) {
    const progressContainer = document.getElementById('image-progress-container');
    if (!progressContainer) {
      console.warn('Image progress container not found');
      return;
    }

    const progressEl = document.createElement('div');
    progressEl.className = 'image-progress';
    progressEl.innerHTML = `
      <div class="progress-spinner"></div>
      <span class="progress-message">${message}</span>
    `;
    
    progressContainer.innerHTML = '';
    progressContainer.appendChild(progressEl);
    progressContainer.style.display = 'block';
  },

  hideImageProgress() {
    const progressContainer = document.getElementById('image-progress-container');
    if (progressContainer) {
      progressContainer.style.display = 'none';
      progressContainer.innerHTML = '';
    }
  },

  addPendingImage(file) {
    if (!this.pendingImages) {
      this.pendingImages = [];
    }
    this.pendingImages.push(file);
  },

  async compressImage(file, options = {}) {
    const { maxWidth = 1600, maxHeight = 1600, quality = 0.85 } = options;
    
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', quality);
      };
      
      img.onerror = () => {
        resolve(null);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  
  if (document.readyState === 'complete') {
    initializeAdminProducts();
  } else {
    window.addEventListener('load', initializeAdminProducts);
  }
});

function initializeAdminProducts() {
  
  const waitForStyles = () => {
    
    const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
    const allStylesLoaded = Array.from(stylesheets).every(link => {
      return link.sheet || link.href.includes('font-awesome'); 
    });
    
    if (!allStylesLoaded) {
      setTimeout(waitForStyles, 100);
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        console.log('🔧 Initializing admin products...');

        const requiredElements = [
          'productGrid',
          'productSearch',
          'sortFilter',
          'categoryFilter',
          'stockFilter'
        ];
        
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        if (missingElements.length > 0) {
          console.warn('⚠️ Missing required elements:', missingElements);
          
          setTimeout(() => {
            if (missingElements.every(id => document.getElementById(id))) {
              adminProducts.init();
            } else {
              console.error('❌ Required elements still missing after delay');
            }
          }, 500);
          return;
        }
        
        adminProducts.init();

        if (window.RefreshUtils && window.RefreshUtils.manager) {
          
          window.RefreshUtils.manager.register('refreshProducts', () => adminProducts.loadProducts(1), {
            normalText: 'Products',
            loadingText: 'Refreshing products...',
            successText: 'Products updated!',
            errorText: 'Failed to refresh'
          });
        }
      });
    });
  };
  
  waitForStyles();
}

window.adminProducts = adminProducts;
