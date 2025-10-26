document.addEventListener('DOMContentLoaded', function() {
  const productsGrid = document.getElementById('products-grid');
  const productCount = document.getElementById('product-count');
  const sortSelect = document.getElementById('sort-options');
  const categoryButtons = Array.from(document.querySelectorAll('.category-btn'));
  const API_URL = window.CONFIG?.API_URL || '/api';
  let allProducts = [];
  let filteredProducts = [];
  let currentCategory = '';
  let currentSort = 'name-asc';

  async function loadProducts() {
    try {
      const response = await fetch(`${API_URL}/products`);
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
      allProducts = (data.products || []).filter(product =>
        product.clearance && product.discountedPrice && product.isActive !== false && product.status !== 'inactive' && product.status !== 'discontinued' && (product.quantity > 0 || product.stock > 0)
      );
      applyFilters();
    } catch (err) {
      productsGrid.innerHTML = '<div class="empty-state">Failed to load products.</div>';
    }
  }

  function applyFilters() {
    filteredProducts = allProducts.filter(product => {
      if (currentCategory && product.category) {
        const aliasMap = {
          'climate control': 'climate',
          'hubs & bridges': 'hubs',
          'automation kits': 'automation'
        };
        const canonicalCategory = aliasMap[currentCategory.toLowerCase()] || currentCategory;
        if (!product.category.toLowerCase().includes(canonicalCategory.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
    filteredProducts = sortProducts(filteredProducts, currentSort);
    renderProducts();
  }

  function sortProducts(products, sortOption) {
    switch (sortOption) {
      case 'name-asc':
        return [...products].sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc':
        return [...products].sort((a, b) => b.name.localeCompare(a.name));
      case 'price-asc':
        return [...products].sort((a, b) => parseFloat(a.discountedPrice) - parseFloat(b.discountedPrice));
      case 'price-desc':
        return [...products].sort((a, b) => parseFloat(b.discountedPrice) - parseFloat(a.discountedPrice));
      case 'rating-desc':
        return [...products].sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
      default:
        return products;
    }
  }

  function renderProducts() {
    productCount.textContent = `${filteredProducts.length} clearance products found`;
    if (filteredProducts.length === 0) {
      productsGrid.innerHTML = '<div class="empty-state">No clearance products available.</div>';
      return;
    }
    productsGrid.innerHTML = '';
    filteredProducts.forEach(product => {
      const productCard = document.createElement('div');
      productCard.className = 'product-card';
      
      function getImageUrl(product) {
        const baseUrl = window.CONFIG?.API_BASE || '';
        function extractUrl(val) {
          if (!val) return null;
          if (typeof val === 'string') return val;
          if (typeof val === 'object') {
            return val.url || val.path || val.src || val.imageUrl || null;
          }
          return null;
        }

        if (product.images && Array.isArray(product.images) && product.images.length > 0) {
          const firstImageRaw = product.images[0];
          const firstImage = extractUrl(firstImageRaw);
          if (firstImage) {
            if (firstImage.startsWith('http')) {
              return firstImage;
            } else {
              const imagePath = firstImage.startsWith('/') ? firstImage : `/${firstImage}`;
              return `${baseUrl}${imagePath}`;
            }
          }
        }

        const imageUrlRaw = product.imageUrl;
        const imageUrlStr = extractUrl(imageUrlRaw);
        if (imageUrlStr) {
          if (imageUrlStr.startsWith('http')) {
            return imageUrlStr;
          } else {
            const imagePath = imageUrlStr.startsWith('/') ? imageUrlStr : `/${imageUrlStr}`;
            return `${baseUrl}${imagePath}`;
          }
        }

        return '../assets/images/placeholder.png';
      }
      const imageUrl = getImageUrl(product);
      
      const basePrice = Number(product.price || 0);
      const hasDiscountedPrice = (product.discountedPrice !== undefined && product.discountedPrice !== null && !Number.isNaN(Number(product.discountedPrice)) && Number(product.discountedPrice) < basePrice);
      const isSaleBadge = (product.clearance === true || String(product.clearance).toLowerCase() === 'true') || hasDiscountedPrice;

      productCard.innerHTML = `
        <div class="product-card-inner" role="button" tabindex="0" aria-label="View details for ${product.name}">
          <div class="product-image" role="img" aria-label="${product.name}">
            <img src="${imageUrl}" alt="${product.name}" loading="lazy" onerror="this.src='../assets/images/placeholder.png'">
            ${isSaleBadge ? '<span class="clearance-badge">SALE</span>' : ''}
          </div>
          <div class="product-info">
            <div class="product-category">${product.category || 'Uncategorized'}</div>
            <div class="product-name-container">
              <h3 class="product-name">${product.name}</h3>
            </div>
            <div class="product-rating-price">
              <div class="product-rating-container">
                <div class="product-rating">${generateStarRating(product.rating || 0)}</div>
                <span class="review-count">(${product.numReviews || 0})</span>
              </div>
              <div class="product-price">
                <span class="discounted-price">$${product.discountedPrice.toFixed(2)}</span>
                <span class="original-price">$${product.price.toFixed(2)}</span>
              </div>
            </div>
            <button class="add-to-cart-btn" data-id="${product._id}" aria-label="Add ${product.name} to cart">
              <i class="fas fa-shopping-cart"></i>
              Add to Cart
            </button>
          </div>
        </div>`;
      
      productCard.addEventListener('click', (e) => {
        if (e.target.closest('.add-to-cart-btn')) return;
        window.location.href = `user_product-detail.html?id=${product._id}`;
      });
      productCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (document.activeElement === productCard.querySelector('.product-card-inner')) {
            window.location.href = `user_product-detail.html?id=${product._id}`;
          }
        }
      });
      productsGrid.appendChild(productCard);
    });
  }

  function generateStarRating(rating) {
    let starsHtml = '';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < fullStars; i++) starsHtml += '<i class="fas fa-star"></i>';
    if (hasHalfStar) starsHtml += '<i class="fas fa-star-half-alt"></i>';
    for (let i = 0; i < emptyStars; i++) starsHtml += '<i class="far fa-star"></i>';
    return starsHtml;
  }

  if (productsGrid) {
    productsGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.add-to-cart-btn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const productId = btn.getAttribute('data-id');
      if (productId) {
        alert('Added to cart: ' + productId); 
      }
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', function() {
      currentSort = this.value;
      applyFilters();
    });
  }

  if (categoryButtons && categoryButtons.length) {
    categoryButtons.forEach(function(button) {
      button.addEventListener('click', function() {
        categoryButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        currentCategory = this.getAttribute('data-category');
        applyFilters();
      });
    });
  }

  loadProducts();
});
