

const productsTableBody = document.querySelector('#productsTable tbody');
const productGrid = document.getElementById('productGrid');
const productsSpinner = document.getElementById('productsLoadingSpinner');
const statusMsg = document.getElementById('productsStatusMessage');
const productModal = document.getElementById('productModal');
const productForm = document.getElementById('productForm');
const addProductBtn = document.getElementById('addProductBtn');
const modalTitle = document.getElementById('productModalTitle');
const fileInput = document.getElementById('productImage');

const uploadArea = document.getElementById('productUploadArea');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const productUploadProgress = document.getElementById('productUploadProgress');
const productUploadBar = document.getElementById('productUploadBar');
const searchInput = document.getElementById('productSearch');
const categoryFilter = document.getElementById('categoryFilter');
const stockFilter = document.getElementById('stockFilter');
const sortFilter = document.getElementById('sortFilter');
const tableViewBtn = document.getElementById('tableViewBtn');
const cardViewBtn = document.getElementById('cardViewBtn');
const tableView = document.getElementById('tableView');
const cardView = document.getElementById('cardView');
const itemsPerPage = document.getElementById('itemsPerPage');
const pagination = document.getElementById('pagination');

let compressedImageBlob = null;
let compressedImageName = null;

const state = {
    products: [],
    filteredProducts: [],
    currentPage: 1,
    itemsPerPage: 10,
    currentView: 'card', 
    filters: {
        search: '',
        category: '',
        stock: '',
        sort: 'name-asc'
    }
};

const API_URL = (typeof CONFIG !== 'undefined' && CONFIG.API_URL) ? CONFIG.API_URL : '/api';

function showSpinner() { 
    if (productsSpinner) productsSpinner.style.display = 'block'; 
}
function hideSpinner() { 
    if (productsSpinner) productsSpinner.style.display = 'none'; 
}
function showMsg(text, type) { 
    if (statusMsg) {
        statusMsg.textContent = text; 
        statusMsg.className = `status-message ${type}`; 
        statusMsg.style.display = 'block'; 
        if (type === 'success') setTimeout(() => statusMsg.style.display = 'none', 4000);
    }
}

function openConfirmModal(options = {}) {
    return new Promise(resolve => {
        let modal = document.getElementById('genericConfirmModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'genericConfirmModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header"><h2 id="genericConfirmTitle"></h2><button type="button" class="close-modal" aria-label="Close">&times;</button></div>
                    <div class="modal-body"><p id="genericConfirmMessage"></p>
                        <div class="form-actions modal-actions">
                            <button type="button" class="btn btn-secondary close-modal">Cancel</button>
                            <button id="genericConfirmOk" class="btn btn-primary">OK</button>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(modal);

            modal.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => {
                modal.style.display = 'none';
                resolve(false);
            }));
        }

        document.getElementById('genericConfirmTitle').textContent = options.title || 'Confirm Action';
        document.getElementById('genericConfirmMessage').textContent = options.message || 'Are you sure you want to proceed?';

        const okButton = document.getElementById('genericConfirmOk');
        okButton.textContent = options.okText || 'OK';

        if (options.okClass) {
            okButton.className = `btn ${options.okClass}`;
        }

        okButton.onclick = () => {
            modal.style.display = 'none';
            resolve(true);
        };

        modal.style.display = 'flex';

        if (options.closeOnOutsideClick !== false) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                    resolve(false);
                }
            });
        }

        okButton.focus();
    });
}

window.openConfirmModal = openConfirmModal;

async function api(endpoint, method = 'GET', body = null, isForm = false) {
    const token = localStorage.getItem('authToken');
    const headers = isForm 
        ? { Authorization: `Bearer ${token}` } 
        : { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    
    const options = { method, headers };
    if (body) options.body = isForm ? body : JSON.stringify(body);
    
    try {
        const fullUrl = `${API_URL}${endpoint}`;
        const response = await fetch(fullUrl, options);
        
        if (response.status === 401) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userRole');
            window.location.href = 'login.html?session=expired';
            return null;
        }
        
        const text = await response.text();
        let data = null;
        if (text) {
            try { data = JSON.parse(text); } catch (_) { throw new Error(`Invalid JSON from ${fullUrl}: ${text.substring(0,120)}`); }
        }
        if (!response.ok) {
            const errorMessage = data?.message || `HTTP ${response.status}: ${response.statusText}`;
            throw new Error(errorMessage);
        }
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

async function compressImage(file, { maxWidth = 1200, maxHeight = 1200, quality = 0.8 } = {}) {
  if (!file || !file.type.startsWith('image/')) return null;
  const img = document.createElement('img');
  const reader = new FileReader();
  const dataUrl = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  await new Promise((resolve) => { img.onload = resolve; img.src = dataUrl; });

  let { width, height } = img;
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0,0,canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  return new File([blob], file.name.replace(/\.(png|jpg|jpeg|gif)$/i, type === 'image/png' ? '.png' : '.jpg'), { type });
}

function getProductImageUrl(product) {
    
    console.log('🖼️ Getting image URL for product:', product?.name, product?._id);
    console.log('🖼️ Product data:', {
        imageUrl: product?.imageUrl,
        images: product?.images,
        usingImageKit: product?.usingImageKit,
        thumbnailUrl: product?.thumbnailUrl
    });

    if (typeof product === 'object') {
        
        if (product.usingImageKit && product.imageUrl && product.imageUrl.startsWith('http')) {
            console.log('✅ Using ImageKit URL:', product.imageUrl);
            return product.imageUrl;
        }

        if (product.thumbnailUrl && product.thumbnailUrl.startsWith('http')) {
            console.log('✅ Using thumbnail URL:', product.thumbnailUrl);
            return product.thumbnailUrl;
        }

        if (product.imageUrl) {
            let fullUrl;
            if (product.imageUrl.startsWith('http')) {
                fullUrl = product.imageUrl;
            } else {
                
                const baseUrl = API_URL.replace('/api', '');
                const imagePath = product.imageUrl.startsWith('/') ? product.imageUrl : `/${product.imageUrl}`;
                fullUrl = `${baseUrl}${imagePath}`;
            }
            console.log('✅ Using regular image URL:', fullUrl);
            return fullUrl;
        }

        if (product.images && Array.isArray(product.images) && product.images.length > 0) {
            const first = product.images[0];
            let fullUrl;
            if (first.startsWith('http')) {
                fullUrl = first;
            } else {
                
                const baseUrl = API_URL.replace('/api', '');
                const imagePath = first.startsWith('/') ? first : `/${first}`;
                fullUrl = `${baseUrl}${imagePath}`;
            }
            console.log('✅ Using first image from array:', fullUrl);
            return fullUrl;
        }

        const productId = product._id || product.id;
        if (productId) {
            const apiUrl = `${API_URL}/products/image/${productId}`;
            console.log('⚠️ Using API fallback URL:', apiUrl);
            return apiUrl;
        }
    }

    if (typeof product === 'string') {
        const apiUrl = `${API_URL}/products/image/${product}`;
        console.log('⚠️ Using legacy API URL:', apiUrl);
        return apiUrl;
    }

    console.log('❌ No image found, using placeholder for product:', product);
    return 'assets/images/placeholder.png';
}

function getAllProductImages(product) {
    if (!product) {
        console.log('❌ getAllProductImages: No product provided');
        return [];
    }
    
    console.log('🖼️ Getting all images for product:', product?.name, product?._id);
    console.log('🖼️ Product image data:', {
        imageUrl: product?.imageUrl,
        images: product?.images,
        thumbnailUrl: product?.thumbnailUrl,
        usingImageKit: product?.usingImageKit
    });
    
    const images = [];

    if (product.imageUrl) {
        let url = product.imageUrl;
        if (!url.startsWith('http') && !url.startsWith('data:')) {
            const baseUrl = API_URL.replace('/api', '');
            const imagePath = url.startsWith('/') ? url : `/${url}`;
            url = `${baseUrl}${imagePath}`;
        }
        images.push({ url, type: 'primary', hasImageKit: product.usingImageKit || false, title: 'Primary Image' });
        console.log('✅ Added primary image:', url);
    }

    if (product.images && Array.isArray(product.images)) {
        product.images.forEach((img, idx) => {
            let url = img;
            if (!url.startsWith('http') && !url.startsWith('data:')) {
                const baseUrl = API_URL.replace('/api', '');
                const imagePath = url.startsWith('/') ? url : `/${url}`;
                url = `${baseUrl}${imagePath}`;
            }
            if (!images.some(i => i.url === url)) {
                images.push({ url, type: 'gallery', hasImageKit: false, title: `Image ${idx+1}` });
                console.log('✅ Added gallery image:', url);
            }
        });
    }

    if (product.thumbnailUrl && product.thumbnailUrl !== product.imageUrl) {
        let url = product.thumbnailUrl;
        if (!url.startsWith('http') && !url.startsWith('data:')) {
            const baseUrl = API_URL.replace('/api', '');
            const imagePath = url.startsWith('/') ? url : `/${url}`;
            url = `${baseUrl}${imagePath}`;
        }
        if (!images.some(i => i.url === url)) {
            images.push({ url, type: 'thumbnail', hasImageKit: product.usingImageKit || false, title: 'Thumbnail' });
            console.log('✅ Added thumbnail image:', url);
        }
    }

    if (images.length === 0 && (product._id || product.id)) {
        const url = `${API_URL}/products/image/${product._id || product.id}`;
        images.push({ url, type: 'legacy', hasImageKit: false, title: 'Product Image' });
        console.log('⚠️ Using API fallback image:', url);
    }
    
    console.log('🖼️ Total images found:', images.length, images);
    return images;
}

async function loadProducts() {
    showSpinner();
    try {
        const response = await api('/products');

        let products = [];
        if (response) {
            if (Array.isArray(response)) {
                products = response;
            } else if (response.products && Array.isArray(response.products)) {
                products = response.products;
            } else if (response.data && Array.isArray(response.data)) {
                products = response.data;
            }
        }

        state.products = products.map(product => ({
            _id: product._id || product.id,
            name: product.name || 'Unnamed Product',
            description: product.description || '',
            price: parseFloat(product.price) || 0,
            quantity: parseInt(product.quantity) || parseInt(product.stock) || 0,
            category: product.category || 'Uncategorized',
            rating: parseFloat(product.rating) || 0,
            tags: product.tags || [],
            status: ['active','inactive'].includes(product.status) ? product.status : 'active',
            clearance: !!product.clearance,
            discountedPrice: product.discountedPrice ? parseFloat(product.discountedPrice) : null,
            imageUrl: product.imageUrl || (Array.isArray(product.images) && product.images[0]) || null,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt
        }));
        
        console.log('Processed products:', state.products.length, state.products);
        applyFilters();
        hideSpinner();
    } catch (error) {
        console.error('Load products error:', error);
        hideSpinner();
        showMsg(error.message || 'Failed to load products', 'error');
        state.products = [];
        applyFilters();
    }
}

function applyFilters() {
    const { search, category, stock, sort } = state.filters;

    let filtered = state.products.filter(product => {
        
        const searchMatch = !search || 
            product.name.toLowerCase().includes(search.toLowerCase()) ||
            (product.description && product.description.toLowerCase().includes(search.toLowerCase()));

        const categoryMatch = !category || product.category === category;

        let stockMatch = true;
        if (stock === 'in-stock') stockMatch = product.quantity > 10;
        else if (stock === 'low-stock') stockMatch = product.quantity > 0 && product.quantity <= 10;
        else if (stock === 'out-of-stock') stockMatch = product.quantity === 0;
        
        return searchMatch && categoryMatch && stockMatch;
    });

    filtered.sort((a, b) => {
        if (sort === 'name-asc') return a.name.localeCompare(b.name);
        if (sort === 'name-desc') return b.name.localeCompare(a.name);
        if (sort === 'price-asc') {
          const aPrice = (a.discountedPrice && a.discountedPrice < a.price) ? a.discountedPrice : a.price;
          const bPrice = (b.discountedPrice && b.discountedPrice < b.price) ? b.discountedPrice : b.price;
          return aPrice - bPrice;
        }
        if (sort === 'price-desc') {
          const aPrice = (a.discountedPrice && a.discountedPrice < a.price) ? a.discountedPrice : a.price;
          const bPrice = (b.discountedPrice && b.discountedPrice < b.price) ? b.discountedPrice : b.price;
          return bPrice - aPrice;
        }
        if (sort === 'stock-asc') return a.quantity - b.quantity;
        if (sort === 'stock-desc') return b.quantity - a.quantity;
        return 0;
    });
    
    state.filteredProducts = filtered;
    renderPagination();
    renderProducts();
}

function renderProducts() {
    const { filteredProducts, currentPage, itemsPerPage, currentView } = state;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
    
    console.log('Rendering products:', paginatedProducts.length, 'of', filteredProducts.length);

    if (currentView === 'table') {
        renderTableView(paginatedProducts);
    } else {
        renderCardView(paginatedProducts);
    }
}

function renderTableView(products) {
    if (!productsTableBody) return;
    
    productsTableBody.innerHTML = '';
    
    if (products.length === 0) {
        productsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="no-data">
                    <div class="no-products-message">
                        <i class="fas fa-box-open"></i>
                        <h3>No products found</h3>
                        <p>Try adjusting your search or filters</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    products.forEach(product => {
        const stockText = product.quantity > 10 ? 'In Stock' : (product.quantity > 0 ? 'Low Stock' : 'Out of Stock');
        
        const imageUrl = getProductImageUrl(product);
        const hasImageKit = product.usingImageKit;

        const truncatedName = (product.name || 'Unnamed Product').length > 30 
            ? (product.name || 'Unnamed Product').substring(0, 30) + '...' 
            : (product.name || 'Unnamed Product');
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="product-name-cell">
                    <div class="product-name" title="${product.name || 'Unnamed Product'}">${truncatedName}</div>
                    <small class="product-meta">Created: ${product.createdAt ? new Date(product.createdAt).toLocaleDateString() : 'N/A'} | ID: ${product._id}</small>
                </div>
            </td>
            <td>
                <div style="position: relative; display: inline-block;">
                    <img src="${imageUrl}" 
                         alt="${product.name}" 
                         class="product-thumbnail"
                         style="width: 60px; height: 60px; object-fit: contain; border-radius: 4px; ${hasImageKit ? 'border: 2px solid #3498db;' : ''} background-color: #f8f9fa;"
                         onerror="this.src='assets/images/placeholder.png'; this.onerror=null;"
                         loading="lazy">
                    ${hasImageKit ? '<span style="position: absolute; top: -5px; right: -5px; background: #3498db; color: white; border-radius: 50%; width: 12px; height: 12px; font-size: 8px; display: flex; align-items: center; justify-content: center;" title="ImageKit CDN">✓</span>' : ''}
                </div>
            </td>
            <td>
                ${product.clearance && product.discountedPrice ? 
                    `<span style="text-decoration: line-through; color: #999; font-size: 0.9em;">$${product.price.toFixed(2)}</span><br>
                     <span style="color: #e74c3c; font-weight: bold;">$${product.discountedPrice.toFixed(2)}</span>` :
                    `$${product.price.toFixed(2)}`
                }
            </td>
            <td>${product.category}</td>
            <td class="stock-cell">${product.quantity} (${stockText})</td>
            <td>
                ${product.clearance ? 
                  '<span style="background: #e74c3c; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">CLEARANCE</span>' : 
                  '<span style="color: #999;">-</span>'
                }
            </td>
            <td class="actions-cell">
                <button class="action-btn edit-btn" data-id="${product._id}" title="Edit Product">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete-btn" data-id="${product._id}" title="Delete Product">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        productsTableBody.appendChild(tr);
    });
}

function renderCardView(products) {
    if (!productGrid) return;
    
    productGrid.innerHTML = '';
    
    if (products.length === 0) {
        productGrid.innerHTML = `
            <div class="no-products-message">
                <i class="fas fa-box-open"></i>
                <h3>No products found</h3>
                <p>Try adjusting your search or filters</p>
            </div>
        `;
        return;
    }
    
    products.forEach(product => {
        const stockClass = product.quantity > 10 ? 'in-stock' : (product.quantity > 0 ? 'low-stock' : 'out-of-stock');
        const stockText = product.quantity > 10 ? 'In Stock' : (product.quantity > 0 ? 'Low Stock' : 'Out of Stock');
        
        const imageUrl = getProductImageUrl(product);
        const hasImageKit = product.usingImageKit;
        
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-card-image">
                <img src="${imageUrl}" 
                     alt="${product.name}" 
                     onerror="this.src='assets/images/placeholder.png'; this.onerror=null;"
                     loading="lazy"
                     style="width: 100%; height: 180px; object-fit: contain; background-color: #f8f9fa; ${hasImageKit ? 'border: 2px solid #3498db;' : ''}">
                ${hasImageKit ? '<span class="imagekit-badge" title="Using ImageKit CDN"><i class="fas fa-cloud"></i> CDN</span>' : ''}
                ${product.status === 'inactive' ? '<span style="background:#95a5a6;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">INACTIVE</span>' : ''}
                ${((product.clearance === true || String(product.clearance).toLowerCase() === 'true') || (product.discountedPrice !== undefined && product.discountedPrice !== null && !Number.isNaN(Number(product.discountedPrice)) && Number(product.discountedPrice) < Number(product.price || 0))) ? '<span class="clearance-badge" title="Clearance Sale"><i class="fas fa-percentage"></i> CLEARANCE</span>' : ''}
            </div>
            <div class="product-card-body">
                <h3 class="product-card-title">${product.name}</h3>
                <div class="product-meta">
                    <div class="product-date">Created: ${product.createdAt ? new Date(product.createdAt).toLocaleDateString() : 'N/A'}</div>
                    <small class="product-id" style="color:#777; display:block; margin-top:2px;">ID: ${product._id}</small>
                </div>
                <div class="product-card-price">
                    ${product.clearance && product.discountedPrice ? 
                        `<span style="text-decoration: line-through; color: #999; font-size: 0.9em;">$${product.price.toFixed(2)}</span><br>
                         <span style="color: #e74c3c; font-weight: bold;">$${product.discountedPrice.toFixed(2)}</span>` :
                        `$${product.price.toFixed(2)}`
                    }
                </div>
                <div class="product-card-details">
                    <div class="product-card-stock ${stockClass}">
                        <i class="fas fa-circle"></i> ${stockText} (${product.quantity})
                    </div>
                    <div class="product-card-rating">
                        <i class="fas fa-star"></i> ${product.rating.toFixed(1)}
                    </div>
                </div>
                <div class="product-card-category">Category: ${product.category}</div>
            </div>
            <div class="product-card-actions">
                <!-- View action removed -->
                <button class="action-btn edit-btn" data-id="${product._id}" title="Edit Product">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete-btn" data-id="${product._id}" title="Delete Product">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        productGrid.appendChild(card);
    });
}

function renderPagination() {
    if (!pagination) return;
    
    const { filteredProducts, currentPage, itemsPerPage } = state;
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    
    pagination.innerHTML = '';

    const prevButton = document.createElement('div');
    prevButton.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            state.currentPage = currentPage - 1;
            renderProducts();
            renderPagination();
        }
    });
    pagination.appendChild(prevButton);

    const maxPages = 5; 
    const startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
    const endPage = Math.min(totalPages, startPage + maxPages - 1);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageItem = document.createElement('div');
        pageItem.className = `page-item ${i === currentPage ? 'active' : ''}`;
        pageItem.textContent = i;
        pageItem.addEventListener('click', () => {
            if (i !== currentPage) {
                state.currentPage = i;
                renderProducts();
                renderPagination();
            }
        });
        pagination.appendChild(pageItem);
    }

    const nextButton = document.createElement('div');
    nextButton.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            state.currentPage = currentPage + 1;
            renderProducts();
            renderPagination();
        }
    });
    pagination.appendChild(nextButton);
}

function openModal() { 
    if (productModal) productModal.style.display = 'flex'; 
}

function closeModal() { 
    if (productModal) {
        productModal.style.display = 'none'; 
        if (productForm) productForm.reset();
        if (document.getElementById('productId')) document.getElementById('productId').value = '';

        const currentImageContainer = document.getElementById('currentImageContainer');
        if (currentImageContainer) currentImageContainer.style.display = 'none';
    }
}

function switchView(view) {
    state.currentView = view;
    if (tableViewBtn) tableViewBtn.classList.toggle('active', view === 'table');
    if (cardViewBtn) cardViewBtn.classList.toggle('active', view === 'card');
    if (tableView) tableView.classList.toggle('active', view === 'table');
    if (cardView) cardView.classList.toggle('active', view === 'card');
    renderProducts();
}

async function handleDeleteProduct(id) {
    if (!id) {
        console.error('Delete failed: No product ID provided');
        showMsg('Delete failed: No product ID found', 'error');
        return;
    }
    const confirmed = await openConfirmModal({
        title: 'Confirm Delete',
        message: 'Are you sure you want to delete this product? This action cannot be undone.',
        confirmText: 'Delete',
        danger: true
    });
    if (!confirmed) return;
    showSpinner();
    try {
        console.log('Attempting to delete product with ID:', id);
        const response = await api(`/products/${id}`, 'DELETE');
        console.log('Delete API response:', response);
        if (response && response.success === false) {
            showMsg(response.message || 'Delete failed', 'error');
            return;
        }
        showMsg('Product deleted successfully', 'success');
        await loadProducts();
    } catch (error) {
        console.error('Delete product error:', error);
        showMsg(error.message || 'Failed to delete product', 'error');
    } finally {
        hideSpinner();
    }
}

async function handleEditProduct(id) {
    console.log('🔧 Editing product with ID:', id);
    showSpinner();
    try {
        console.log('🔗 API_URL:', API_URL);
        console.log('🔑 Auth token exists:', !!localStorage.getItem('authToken'));
        
        const response = await api(`/products/${id}`);
        console.log('📦 Edit product response:', response);
        
        let product = null;
        if (response) {
            if (response.product) {
                product = response.product;
                console.log('📦 Found product in response.product');
            } 
            else if (response.success && response.data) {
                product = response.data;
                console.log('📦 Found product in response.data');
            }
            else if (response._id || response.id) {
                product = response;
                console.log('📦 Response itself is the product');
            }
            else if (Array.isArray(response) && response.length > 0) {
                product = response[0];
                console.log('📦 Found product as first item in array');
            }
        }
        
        if (!product) {
            console.error('❌ Product not found in response structure:', response);
            throw new Error('Product not found or invalid response structure. Check console for details.');
        }
        
        console.log('✅ Product data for editing:', product);
        
        if (modalTitle) modalTitle.textContent = 'Edit Product';
        
        const fields = {
            productId: product._id || product.id,
            productName: product.name,
            productDesc: product.description,
            productPrice: product.price,
            productQty: product.quantity || product.stock || 0,
            productCategory: product.category,
            productStatus: product.status || 'active'
        };
        
        console.log('📝 Form fields to populate:', fields);
        
        Object.entries(fields).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field) {
                if (value !== undefined && value !== null) {
                    field.value = value;
                    console.log(`✅ Set ${fieldId} = ${value}`);
                } else {
                    console.log(`⚠️ Skipping ${fieldId} - value is ${value}`);
                }
            } else {
                console.error(`❌ Field not found: ${fieldId}`);
            }
        });

        const clearanceCheckbox = document.getElementById('productClearance');
        const discountedPriceInput = document.getElementById('productDiscountedPrice');
        
        if (clearanceCheckbox && discountedPriceInput) {
            clearanceCheckbox.checked = product.clearance || false;
            if (product.clearance) {
                discountedPriceInput.disabled = false;
                discountedPriceInput.required = true;
                discountedPriceInput.value = product.discountedPrice || '';
                console.log('✅ Set clearance fields - clearance: true, discountedPrice:', product.discountedPrice);
            } else {
                discountedPriceInput.disabled = true;
                discountedPriceInput.required = false;
                discountedPriceInput.value = '';
                console.log('✅ Set clearance fields - clearance: false');
            }
        } else {
            console.error('❌ Clearance fields not found');
        }

        const productTagsField = document.getElementById('productTags');
        if (productTagsField && product.tags) {
            let tagsValue = '';
            if (Array.isArray(product.tags)) {
                tagsValue = product.tags.join(', ');
            } else if (typeof product.tags === 'string') {
                tagsValue = product.tags;
            }
            productTagsField.value = tagsValue;
            console.log('🏷️ Set tags:', tagsValue);
        }

        const currentImageContainer = document.getElementById('currentImageContainer');
        if (currentImageContainer && product) {
            renderProductImagesGallery(product, currentImageContainer);
        }
        
        openModal();
        console.log('✅ Edit modal opened successfully');
    } catch (error) {
        console.error('💥 Edit product error:', error);
        showMsg(error.message || 'Failed to load product for editing', 'error');

        console.log('🔄 Attempting fallback to local product data...');
        const localProduct = state.products.find(p => p._id === id);
        if (localProduct) {
            console.log('✅ Found product in local state, using as fallback');
            handleEditProductFallback(localProduct);
        } else {
            console.error('❌ Product not found in local state either');
        }
    } finally {
        hideSpinner();
    }
}

async function testImageUrl(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch (e) {
        return false;
    }
}

function renderProductImagesGallery(product, container) {
    if (!container || !product) return;
    container.style.display = 'block';
    const allImages = getAllProductImages(product);
    const hasImageKit = product.usingImageKit;

    let imagesHtml = '';
    if (allImages.length === 0) {
        imagesHtml = `
            <div class="no-images-message" style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px; border: 1px dashed #dee2e6;">
                <i class="fas fa-image" style="font-size: 48px; color: #adb5bd; margin-bottom: 10px;"></i>
                <p>No images available for this product</p>
                <div style="margin-top: 10px; font-size: 0.85em; color: #6c757d;">Product ID: ${product._id || product.id || 'Unknown'}</div>
            </div>
        `;
    } else {
        imagesHtml = `
            <div style="margin-bottom: 10px; display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
                <div>
                  <strong>Product Images:</strong> 
                  ${hasImageKit ? '<span style="color: #3498db; font-weight: bold;"><i class="fas fa-cloud"></i> Using ImageKit CDN</span>' : ''}
                  <span style="margin-left: 10px; font-size: 0.85em; color: #6c757d;">(${allImages.length} image${allImages.length !== 1 ? 's' : ''} available)</span>
                </div>
                <label style="display:inline-flex; align-items:center; gap:6px; font-size:.9em; cursor:pointer; background:#f3f6f9; padding:6px 10px; border-radius:6px; border:1px solid #e3e8ef;">
                  <i class="fas fa-plus"></i> Add gallery images
                  <input id="galleryAddInput" type="file" accept="image/*" multiple style="display:none;" />
                </label>
            </div>
            <div class="product-images-gallery" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; margin-bottom: 15px;">
        `;
        
        allImages.forEach((image, index) => {
            const imageId = `img_${Math.random().toString(36).substr(2, 9)}`;
            const isPrimary = index === 0;
            imagesHtml += `
                <div class="product-image-item" style="position: relative; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); background: #f8f9fa;">
                    <div style="padding-top: 100%; position: relative;">
                        <div id="${imageId}_loading" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f8f9fa;">
                            <div style="width: 30px; height: 30px; border: 3px solid #eee; border-top: 3px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        </div>
                        <img src="${image.url}" 
                             alt="${image.title}" 
                             title="${image.title}"
                             id="${imageId}"
                             onload="document.getElementById('${imageId}_loading').style.display='none';"
                             onerror="this.src='assets/images/placeholder.png'; document.getElementById('${imageId}_loading').style.display='none'; this.parentNode.classList.add('image-error');"
                             style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; background-color: #f8f9fa; ${image.hasImageKit ? 'border: 2px solid #3498db;' : ''}"
                             loading="${index < 4 ? 'eager' : 'lazy'}">
                        ${image.hasImageKit ? '<div style="position: absolute; top: 5px; right: 5px; background: #3498db; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;" title="ImageKit CDN">CDN</div>' : ''}
                        <div style="position:absolute; top:6px; left:6px; display:flex; gap:6px; z-index:10;">
                          <button class="remove-gallery-image-btn" data-url="${image.url}" data-primary="${isPrimary ? '1' : '0'}" style="background:#e74c3c; color:#fff; border:none; border-radius:4px; padding:4px 6px; cursor:pointer; font-size:11px; position:relative; z-index:11; pointer-events:auto;" title="Remove image" type="button">
                            <i class='fas fa-trash'></i>
                          </button>
                          ${!isPrimary ? `<button class="make-primary-image-btn" data-url="${image.url}" style="background:#2ecc71; color:#fff; border:none; border-radius:4px; padding:4px 6px; cursor:pointer; font-size:11px; position:relative; z-index:11; pointer-events:auto;" title="Set as primary" type="button">
                            <i class='fas fa-star'></i>
                          </button>` : ''}
                        </div>
                    </div>
                    <div style="padding: 5px; font-size: 11px; text-align: center; background: ${isPrimary ? '#e3f2fd' : '#f8f9fa'}; border-top: 1px solid #dee2e6;">
                        ${isPrimary ? '<strong>Primary</strong>' : image.title}
                    </div>
                </div>
            `;
        });
        
        imagesHtml += `</div>`;
        imagesHtml += `
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .image-error { border: 2px solid #e74c3c !important; }
            </style>
        `;
    }

    container.innerHTML = `
        <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
            ${imagesHtml}
        </div>
    `;

    console.log('🖼️ Gallery rendered, looking for delete buttons...');
    const deleteButtons = container.querySelectorAll('.remove-gallery-image-btn');
    console.log('🔍 Found delete buttons:', deleteButtons.length);
    deleteButtons.forEach((btn, index) => {
      console.log(`Button ${index}:`, {
        url: btn.getAttribute('data-url'),
        isPrimary: btn.getAttribute('data-primary'),
        element: btn
      });
    });

    const addInput = container.querySelector('#galleryAddInput');
    if (addInput) {
      addInput.addEventListener('change', async () => {
        if (!addInput.files || addInput.files.length === 0) return;
        try {
          showSpinner();
          const fd = new FormData();
          
          for (const f of addInput.files) {
            let cf = f;
            if (f.size > 1024 * 1024) {
              const tmp = await compressImage(f, { maxWidth: 1600, maxHeight: 1600, quality: 0.85 });
              if (tmp) cf = tmp;
            }
            fd.append('images', cf, cf.name);
          }
          const id = product._id || product.id;
          await api(`/products/${id}/images`, 'POST', fd, true);
          const resp = await api(`/products/${id}`);
          const updated = resp?.product || resp;
          renderProductImagesGallery(updated, container);
          showMsg('Images added', 'success');
        } catch (err) {
          showMsg(err.message || 'Failed to add images', 'error');
        } finally {
          hideSpinner();
        }
      });
    }

    container.querySelectorAll('.remove-gallery-image-btn').forEach((btn, index) => {
      console.log(`🔧 Attaching event listener to delete button ${index}`);
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const url = btn.getAttribute('data-url');
        const isPrimary = btn.getAttribute('data-primary') === '1';
        const id = product._id || product.id;
        
        console.log('🗑️ Delete image clicked:', { url, isPrimary, id, product });
        
        if (!url || !id) {
          console.error('❌ Missing required data:', { url, id });
          showMsg('Missing required data for image deletion', 'error');
          return;
        }
        
                const confirmed = await openConfirmModal({
                    title: 'Confirm Remove Image',
                    message: isPrimary ? 'Remove the primary image?' : 'Remove this image?',
                    confirmText: 'Remove',
                    danger: true
                });
                if (!confirmed) return;
        
        try {
          showSpinner();
          console.log('🚀 Starting image deletion...');
          
          let deleteResponse;
          if (isPrimary) {
            console.log('🎯 Deleting primary image via /products/' + id + '/image');
            deleteResponse = await api(`/products/${id}/image`, 'DELETE');
          } else {
            console.log('🎯 Deleting gallery image via /products/' + id + '/images with URL:', url);
            deleteResponse = await api(`/products/${id}/images`, 'DELETE', { url });
          }
          
          console.log('✅ Delete response:', deleteResponse);

          console.log('🔄 Refreshing product data...');
          const resp = await api(`/products/${id}`);
          const updated = resp?.product || resp;
          console.log('✅ Updated product data:', updated);
          
          renderProductImagesGallery(updated, container);
          showMsg('Image removed successfully', 'success');
        } catch (err) {
          console.error('❌ Error removing image:', err);
          showMsg(err.message || 'Failed to remove image', 'error');
        } finally { 
          hideSpinner(); 
        }
      });
    });

    container.addEventListener('click', async (e) => {
      
      if (e.target.closest('.remove-gallery-image-btn')) {
        console.log('🚨 Backup event delegation triggered for delete button');
        const btn = e.target.closest('.remove-gallery-image-btn');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation(); 
        
        const url = btn.getAttribute('data-url');
        const isPrimary = btn.getAttribute('data-primary') === '1';
        const id = product._id || product.id;
        
        console.log('🗑️ Delete image clicked (via delegation):', { url, isPrimary, id });
        
        if (!url || !id) {
          console.error('❌ Missing required data:', { url, id });
          showMsg('Missing required data for image deletion', 'error');
          return;
        }
        
                const confirmed = await openConfirmModal({
                    title: 'Confirm Remove Image',
                    message: isPrimary ? 'Remove the primary image?' : 'Remove this image?',
                    confirmText: 'Remove',
                    danger: true
                });
                if (!confirmed) return;
        
        try {
          showSpinner();
          console.log('🚀 Starting image deletion (via delegation)...');
          
          let deleteResponse;
          if (isPrimary) {
            console.log('🎯 Deleting primary image via /products/' + id + '/image');
            deleteResponse = await api(`/products/${id}/image`, 'DELETE');
          } else {
            console.log('🎯 Deleting gallery image via /products/' + id + '/images with URL:', url);
            deleteResponse = await api(`/products/${id}/images`, 'DELETE', { url });
          }
          
          console.log('✅ Delete response:', deleteResponse);

          console.log('🔄 Refreshing product data...');
          const resp = await api(`/products/${id}`);
          const updated = resp?.product || resp;
          console.log('✅ Updated product data:', updated);
          
          renderProductImagesGallery(updated, container);
          showMsg('Image removed successfully', 'success');
        } catch (err) {
          console.error('❌ Error removing image:', err);
          showMsg(err.message || 'Failed to remove image', 'error');
        } finally { 
          hideSpinner(); 
        }
        
        return false; 
      }
    });

    container.querySelectorAll('.make-primary-image-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const url = btn.getAttribute('data-url');
        const id = product._id || product.id;
        if (!url || !id) return;
        try {
          showSpinner();
          await api(`/products/${id}/primary-image`, 'PUT', { url });
          const resp = await api(`/products/${id}`);
          const updated = resp?.product || resp;
          renderProductImagesGallery(updated, container);
          showMsg('Primary image updated', 'success');
        } catch (err) {
          showMsg(err.message || 'Failed to set primary image', 'error');
        } finally { hideSpinner(); }
      });
    });
}

function handleEditProductFallback(product) {
    console.log('🔄 Using fallback edit with local product data:', product);
    
    try {
        
        if (modalTitle) modalTitle.textContent = 'Edit Product (Offline Mode)';

        const fields = {
            productId: product._id,
            productName: product.name,
            productDesc: product.description,
            productPrice: product.price,
            productQty: product.quantity,
            productCategory: product.category,
            productStatus: product.status || 'active'
        };

        Object.entries(fields).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field && value !== undefined && value !== null) {
                field.value = value;
            }
        });

        const productTagsField = document.getElementById('productTags');
        if (productTagsField && product.tags) {
            let tagsValue = '';
            if (Array.isArray(product.tags)) {
                tagsValue = product.tags.join(', ');
            } else if (typeof product.tags === 'string') {
                tagsValue = product.tags;
            }
            productTagsField.value = tagsValue;
        }

        const currentImageContainer = document.getElementById('currentImageContainer');
        if (currentImageContainer && product) {
            
            product.offlineMode = true;
            renderProductImagesGallery(product, currentImageContainer);
        }
        
        openModal();
        console.log('✅ Fallback edit modal opened successfully');
    } catch (error) {
        console.error('💥 Fallback edit also failed:', error);
        showMsg('Failed to open edit form. Please try refreshing the page.', 'error');
    }
}

function setupEventListeners() {
    console.log('Setting up event listeners...');

    if (tableViewBtn) {
        tableViewBtn.addEventListener('click', () => switchView('table'));
    }
    
    if (cardViewBtn) {
        cardViewBtn.addEventListener('click', () => switchView('card'));
    }

    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => {
            if (modalTitle) modalTitle.textContent = 'Add New Product';
            const currentImageContainer = document.getElementById('currentImageContainer');
            if (currentImageContainer) currentImageContainer.style.display = 'none';
            openModal();
        });
    }

    const clearanceCheckbox = document.getElementById('productClearance');
    const discountedPriceInput = document.getElementById('productDiscountedPrice');
    
    if (clearanceCheckbox && discountedPriceInput) {
        clearanceCheckbox.addEventListener('change', function() {
            if (this.checked) {
                discountedPriceInput.disabled = false;
                discountedPriceInput.required = true;
                console.log('✅ Clearance enabled - discounted price field enabled');
            } else {
                discountedPriceInput.disabled = true;
                discountedPriceInput.required = false;
                discountedPriceInput.value = '';
                console.log('✅ Clearance disabled - discounted price field disabled');
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            state.filters.search = searchInput.value;
            state.currentPage = 1;
            applyFilters();
        });
    }

    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            state.filters.category = categoryFilter.value;
            state.currentPage = 1;
            applyFilters();
        });
    }
    
    if (stockFilter) {
        stockFilter.addEventListener('change', () => {
            state.filters.stock = stockFilter.value;
            state.currentPage = 1;
            applyFilters();
        });
    }
    
    if (sortFilter) {
        sortFilter.addEventListener('change', () => {
            state.filters.sort = sortFilter.value;
            applyFilters();
        });
    }

    if (itemsPerPage) {
        itemsPerPage.addEventListener('change', () => {
            state.itemsPerPage = parseInt(itemsPerPage.value);
            state.currentPage = 1;
            renderPagination();
            renderProducts();
        });
    }

    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('productId').value;
            const formData = new FormData(productForm);

            const clearanceCheckboxEl = document.getElementById('productClearance');
            const discountedPriceEl = document.getElementById('productDiscountedPrice');
            const priceEl = document.getElementById('productPrice');
            if (clearanceCheckboxEl) {
                
                formData.set('clearance', clearanceCheckboxEl.checked ? 'true' : 'false');
                if (clearanceCheckboxEl.checked) {
                    const rawDiscount = discountedPriceEl ? discountedPriceEl.value : '';
                    const rawPrice = priceEl ? parseFloat(priceEl.value) : NaN;
                    const discVal = rawDiscount === '' ? NaN : parseFloat(rawDiscount);
                    if (isNaN(discVal)) {
                        showMsg('Enter a discounted price for clearance item', 'error');
                        return;
                    }
                    if (!isNaN(rawPrice) && discVal >= rawPrice) {
                        showMsg('Discounted price must be lower than regular price', 'error');
                        return;
                    }
                    formData.set('discountedPrice', discVal.toString());
                } else {
                    formData.delete('discountedPrice');
                }
            }

            const statusEl = document.getElementById('productStatus');
            if (statusEl) {
                if (!['active','inactive'].includes(statusEl.value)) {
                    formData.set('status','active');
                }
            }

            if (formData.has('image') && !formData.has('productImage')) {
              const imgFile = formData.get('image');
              formData.delete('image');
              if (imgFile && imgFile.size) formData.append('productImage', imgFile);
            }

            if (compressedImageBlob) {
              formData.set('productImage', compressedImageBlob, compressedImageName || compressedImageBlob.name || 'image.jpg');
            }

            const method = id ? 'PUT' : 'POST';
            const endpoint = id ? `/products/${id}` : '/products';
            
            showSpinner();
            try {
              
              let timer;
              if (productUploadProgress && productUploadBar) {
                productUploadProgress.style.display = 'block';
                let p = 0; timer = setInterval(() => {
                  p = Math.min(p + (p < 60 ? 7 : 3), 92);
                  productUploadBar.style.width = p + '%';
                }, 150);
              }
              const response = await api(endpoint, method, formData, true);
              if (timer) { clearInterval(timer); productUploadBar.style.width = '100%'; }
              showMsg(`Product ${id ? 'updated' : 'added'} successfully`, 'success');
              closeModal();
              await loadProducts();
            } catch (error) {
              showMsg(error.message || 'Failed to save product', 'error');
            } finally {
              hideSpinner();
              if (productUploadProgress && productUploadBar) {
                setTimeout(() => {
                  productUploadProgress.style.display = 'none';
                  productUploadBar.style.width = '0%';
                }, 600);
              }
              
              compressedImageBlob = null; compressedImageName = null;
            }
        });
    }

    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', closeModal);
    });

    window.addEventListener('click', event => {
        if (event.target === productModal) closeModal();
    });

    document.addEventListener('click', event => {
        const actionBtn = event.target.closest('.action-btn');
        if (!actionBtn) return;

        const id = actionBtn.getAttribute('data-id');
        if (!id) return;

        console.log('Action clicked:', actionBtn.className, 'for product:', id);

        if (actionBtn.classList.contains('delete-btn')) {
            alert('Delete button clicked for product ID: ' + id);
            console.log('Delete button event fired for product:', id, actionBtn);
            handleDeleteProduct(id);
        } else if (actionBtn.classList.contains('edit-btn')) {
            console.log('Edit button event fired for product:', id, actionBtn);
            handleEditProduct(id);
        }
        
    });
}

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Product management page loaded');

    const token = localStorage.getItem('authToken');
    const role = localStorage.getItem('userRole');
    
    if (!token || role !== 'admin') {
        console.log('Not authenticated as admin, redirecting to login');
        window.location.href = 'login.html';
        return;
    }

    if (itemsPerPage) {
        state.itemsPerPage = parseInt(itemsPerPage.value);
    }

    setupEventListeners();

    if (fileInput && imagePreview && previewImg) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
          showMsg('Please select an image file', 'error');
          fileInput.value = '';
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          
          const compressed = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.8 });
          if (compressed && compressed.size <= 5 * 1024 * 1024) {
            compressedImageBlob = compressed;
            compressedImageName = compressed.name;
          } else {
            showMsg('Image must be under 5MB', 'error');
            fileInput.value = '';
            return;
          }
        } else {
          
          const compressed = await compressImage(file, { maxWidth: 1400, maxHeight: 1400, quality: 0.85 });
          if (compressed) { compressedImageBlob = compressed; compressedImageName = compressed.name; }
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          previewImg.style.filter = 'blur(2px)';
          previewImg.src = ev.target.result;
          imagePreview.style.display = 'block';
          setTimeout(() => {
            previewImg.style.transition = 'filter .4s ease';
            previewImg.style.filter = 'none';
          }, 200);
        };
        reader.readAsDataURL(compressedImageBlob || file);
      });

      imagePreview.addEventListener('dblclick', () => {
        fileInput.value = '';
        imagePreview.style.display = 'none';
        previewImg.src = '';
        compressedImageBlob = null;
        compressedImageName = null;
        showMsg('Cleared selected image', 'success');
      });
    }

    if (uploadArea && fileInput) {
      const hint = document.createElement('div');
      hint.className = 'upload-hint';
      hint.textContent = 'Drop image to upload';
      hint.style.opacity = '0';
      uploadArea.appendChild(hint);

      const setHint = (on) => { hint.style.opacity = on ? '1' : '0'; };
      ['dragenter','dragover'].forEach(evt => uploadArea.addEventListener(evt, (e) => {
        e.preventDefault(); e.stopPropagation();
        uploadArea.classList.add('dragging'); setHint(true);
      }));
      ['dragleave','dragend','drop'].forEach(evt => uploadArea.addEventListener(evt, (e) => {
        e.preventDefault(); e.stopPropagation();
        uploadArea.classList.remove('dragging'); setHint(false);
      }));
      uploadArea.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (!file) return;
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    await loadProducts();
    
    switchView(state.currentView);
});