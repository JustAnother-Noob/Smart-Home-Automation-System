import { renderProductGrid, attachProductDelegation } from '../user_components/product-card-renderer.js';

const API_ROOT = window.CONFIG?.API_URL || '/api';
const PRODUCTS_ENDPOINT = `${API_ROOT}/products`;

function initMobileFilterToggle() {
  const toggleBtn = document.getElementById('mobile-filter-toggle');
  const closeBtn = document.getElementById('mobile-filter-close');
  const filtersSidebar = document.getElementById('filters-sidebar');
  const overlay = document.getElementById('mobile-filter-overlay');
  
  if (!toggleBtn || !filtersSidebar || !overlay) return;

  const openFilters = () => {
    filtersSidebar.classList.add('active');
    overlay.classList.add('active');
    toggleBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden'; 
  };

  const closeFilters = () => {
    filtersSidebar.classList.remove('active');
    overlay.classList.remove('active');
    toggleBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = ''; 
  };

  toggleBtn.addEventListener('click', openFilters);
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeFilters);
  }
  
  overlay.addEventListener('click', closeFilters);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && filtersSidebar.classList.contains('active')) {
      closeFilters();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && filtersSidebar.classList.contains('active')) {
      closeFilters();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  console.debug && console.debug('user_products.js DOMContentLoaded');
  console.debug && console.debug('PRODUCTS_ENDPOINT=', PRODUCTS_ENDPOINT);

  initMobileFilterToggle();
  
  const productsGrid = document.getElementById('products-grid');
  const loadingSpinner = document.getElementById('loading-spinner');
  const emptyState = document.getElementById('empty-state');
  const categoryBtnsContainer = document.getElementById('filter-categories-list');
  const priceMinInput = document.getElementById('price-min');
  const priceMaxInput = document.getElementById('price-max');
  const priceRangeMin = document.getElementById('price-range-min');
  const priceRangeMax = document.getElementById('price-range-max');
  
  const ratingRadios = document.getElementsByName('minRating');
  const availabilityCheckbox = document.getElementById('availability-instock');
  const saleCheckbox = document.getElementById('filter-sale-checkbox');
  const appliedFiltersEl = document.getElementById('applied-filters');
  const appliedChips = appliedFiltersEl ? appliedFiltersEl.querySelector('.applied-filters-chips') : null;
  const productCountEl = document.getElementById('product-count');
  const sortSelect = document.getElementById('sort-options');
  const paginationEl = document.getElementById('pagination');

  let allProducts = [];
  
  const PAGE_SIZE = 20; 
  let currentPage = 1;
  let totalPages = 1;

  const debounce = (fn, wait = 150) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };
  const debouncedApply = debounce(() => applyFiltersAndRender(), 120);

  if (!productsGrid) {
    console.error('products-grid element not found');
    return;
  }

  showLoading(true);
  loadProducts().then(products => {
    showLoading(false);
    allProducts = Array.isArray(products) ? products : (products || []);
    if (!allProducts.length) {
      
      if (emptyState) emptyState.style.display = 'block';
      productsGrid.innerHTML = '';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';

      initCategoryCheckboxes();
      initPriceControls();
    attachHandlers();

    applyUrlParametersToFilters();

    applyFiltersAndRender();
    
    attachProductDelegation(document, { onAddToCart: addToCart });
  }).catch(err => {
    showLoading(false);
    console.error('Failed to load products', err);
    productsGrid.innerHTML = '<div class="empty-state">Failed to load products.</div>';
  });

  function applyUrlParametersToFilters() {
    const urlParams = new URLSearchParams(window.location.search);

    const categoryParam = urlParams.get('category');
    if (categoryParam && categoryBtnsContainer) {
      
      const decodedCategory = decodeURIComponent(categoryParam.replace(/\+/g, ' '));

      const allCheckbox = categoryBtnsContainer.querySelector('.filter-category-checkbox[data-category=""]');
      if (allCheckbox) allCheckbox.checked = false;

      const categoryCheckbox = categoryBtnsContainer.querySelector(`.filter-category-checkbox[data-category="${decodedCategory}"]`);
      if (categoryCheckbox) {
        categoryCheckbox.checked = true;
      }
    }

    const clearanceParam = urlParams.get('clearance');
    if (clearanceParam === 'true' && saleCheckbox) {
      saleCheckbox.checked = true;
    }

    const searchParam = urlParams.get('search');
    if (searchParam) {
      
      window.currentSearchQuery = decodeURIComponent(searchParam);
    }
  }

  function initCategoryCheckboxes() {
    if (!categoryBtnsContainer) return;
    
    const allCheckbox = categoryBtnsContainer.querySelector('.filter-category-checkbox[data-category=""]');
    categoryBtnsContainer.querySelectorAll('.filter-category-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const cat = cb.getAttribute('data-category') || '';
        if (cat === '') {
          if (cb.checked) {
            
            categoryBtnsContainer.querySelectorAll('.filter-category-checkbox').forEach(other => {
              if (other !== cb) other.checked = false;
            });
          }
        } else {
          
          if (cb.checked && allCheckbox) allCheckbox.checked = false;
          
          const anySelected = Array.from(categoryBtnsContainer.querySelectorAll('.filter-category-checkbox'))
            .some(x => (x.getAttribute('data-category') || '') !== '' && x.checked);
          if (!anySelected && allCheckbox) allCheckbox.checked = true;
        }
        
        debouncedApply();
      });
    });
  }

  function initPriceControls() {

  if (!priceRangeMin || !priceRangeMax || !priceMinInput || !priceMaxInput) {
    console.warn && console.warn('Price slider or inputs not found in DOM, skipping price controls initialization');
    return;
  }
  const clampRanges = () => {
    let min = Number(priceRangeMin.value || 0);
    let max = Number(priceRangeMax.value || 10000);
    if (min > max) {
      
      const tmp = min; min = Math.min(min, max); max = Math.max(tmp, max);
      priceRangeMin.value = min;
      priceRangeMax.value = max;
    }
    
    priceRangeMin.value = Math.max(0, Math.min(10000, Number(priceRangeMin.value)));
    priceRangeMax.value = Math.max(0, Math.min(10000, Number(priceRangeMax.value)));
  };

  function updateDisplays() {
    
    const min = Number(priceRangeMin.value || 0);
    const max = Number(priceRangeMax.value || 10000);
    if (priceMinInput) priceMinInput.value = min;
    if (priceMaxInput) priceMaxInput.value = max;
  }

  const sliderContainer = document.querySelector('.price-sliders');
  let activeRange = null; 

  const valueFromClientX = (clientX) => {
    const rect = sliderContainer.getBoundingClientRect();
    const min = Number(priceRangeMin.min || 0);
    const max = Number(priceRangeMin.max || 10000);
    let ratio = (clientX - rect.left) / rect.width;
    ratio = Math.max(0, Math.min(1, ratio));
    return Math.round(min + ratio * (max - min));
  };

  const nearestThumb = (clientX) => {
    const rect = sliderContainer.getBoundingClientRect();
    const min = Number(priceRangeMin.min || 0);
    const max = Number(priceRangeMin.max || 10000);
    const w = rect.width || 1;
    const xMin = rect.left + ((Number(priceRangeMin.value || min) - min) / (max - min)) * w;
    const xMax = rect.left + ((Number(priceRangeMax.value || max) - min) / (max - min)) * w;
    const dMin = Math.abs(clientX - xMin);
    const dMax = Math.abs(clientX - xMax);
    return dMin <= dMax ? priceRangeMin : priceRangeMax;
  };

  const onPointerMove = (e) => {
    if (!activeRange) return;
    const v = valueFromClientX(e.clientX);
    activeRange.value = v;
    clampRanges();
    updateDisplays();
    
    debouncedApply();
  };

  const onPointerUp = (e) => {
    if (activeRange && activeRange.releasePointerCapture && e && e.pointerId) {
      try { activeRange.releasePointerCapture(e.pointerId); } catch (err) {  }
    }
    activeRange = null;
    
    if (priceRangeMin) priceRangeMin.style.zIndex = '';
    if (priceRangeMax) priceRangeMax.style.zIndex = '';
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  if (sliderContainer) {
    sliderContainer.addEventListener('pointerdown', (e) => {
      
      activeRange = nearestThumb(e.clientX);
      
      if (activeRange === priceRangeMin) {
        priceRangeMin.style.zIndex = 3;
        priceRangeMax.style.zIndex = 2;
      } else {
        priceRangeMax.style.zIndex = 3;
        priceRangeMin.style.zIndex = 2;
      }
      
      const v = valueFromClientX(e.clientX);
      activeRange.value = v;
      try { activeRange.setPointerCapture && activeRange.setPointerCapture(e.pointerId); } catch (err) {  }
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      
      clampRanges();
      updateDisplays();
      debouncedApply();
      e.preventDefault();
    }, { passive: false });
  }

  priceRangeMin.addEventListener('input', function() {
    
    if (activeRange && activeRange !== priceRangeMin) return;
    if (Number(priceRangeMin.value) > Number(priceRangeMax.value)) priceRangeMin.value = priceRangeMax.value;
    clampRanges();
    updateDisplays();
    debouncedApply();
  });

  priceRangeMax.addEventListener('input', function() {
    if (activeRange && activeRange !== priceRangeMax) return;
    if (Number(priceRangeMax.value) < Number(priceRangeMin.value)) priceRangeMax.value = priceRangeMin.value;
    clampRanges();
    updateDisplays();
    debouncedApply();
  });

  if (priceMinInput) priceMinInput.addEventListener('input', () => {
    const v = Math.max(0, Math.min(10000, Math.round(Number(priceMinInput.value || 0))));
    priceMinInput.value = v;
    
    if (v > Number(priceRangeMax.value)) {
      priceRangeMin.value = priceRangeMax.value;
      priceMinInput.value = priceRangeMax.value;
    } else {
      priceRangeMin.value = v;
    }
    debouncedApply();
  });
  if (priceMaxInput) priceMaxInput.addEventListener('input', () => {
    const v = Math.max(0, Math.min(10000, Math.round(Number(priceMaxInput.value || 10000))));
    priceMaxInput.value = v;
    if (v < Number(priceRangeMin.value)) {
      priceRangeMax.value = priceRangeMin.value;
      priceMaxInput.value = priceRangeMin.value;
    } else {
      priceRangeMax.value = v;
    }
    debouncedApply();
  });

  updateDisplays();
}

  function attachHandlers() {

    if (ratingRadios) Array.from(ratingRadios).forEach(r => r.addEventListener('change', debouncedApply));
    if (availabilityCheckbox) availabilityCheckbox.addEventListener('change', debouncedApply);
    if (saleCheckbox) {
      
      saleCheckbox.addEventListener('change', debouncedApply);
      saleCheckbox.addEventListener('change', () => {
        try {
          const total = Array.isArray(allProducts) ? allProducts.length : 0;
          const potential = Array.isArray(allProducts) ? allProducts.filter(p => isProductOnSale(p)).length : 0;
          console.info && console.info(`Sale filter: checked=${!!saleCheckbox.checked} total=${total} possibleSale=${potential}`);
        } catch (e) {}
        try { applyFiltersAndRender(); } catch (e) {}
      });
    }
    if (sortSelect) sortSelect.addEventListener('change', debouncedApply);
  }

  function getSelectedCategories() {
    const container = document.getElementById('filter-categories-list');
    if (!container) return [];
    const checkboxes = Array.from(container.querySelectorAll('.filter-category-checkbox'));
    if (!checkboxes.length) return [];
    const allCb = container.querySelector('.filter-category-checkbox[data-category=""]');
    
    const specificChecked = checkboxes.filter(cb => (cb.getAttribute('data-category') || '') !== '' && cb.checked);
    if ((allCb && allCb.checked) || specificChecked.length === 0) return [];
    return specificChecked.map(cb => ((cb.getAttribute('data-category') || '').toLowerCase().trim())).filter(Boolean);
  }

  function getMinRating() {
    const sel = Array.from(ratingRadios).find(r => r.checked);
    return sel ? Number(sel.value) : 0;
  }

  function isProductOnSale(p) {
    if (!p) return false;
    if (p.clearance === true) return true;
    const price = Number(p.price || 0);
    const discounted = (p.discountedPrice !== undefined && p.discountedPrice !== null) ? Number(p.discountedPrice) : null;
    if (discounted !== null && !Number.isNaN(discounted) && discounted < price) return true;
    return false;
  }

  function applyFiltersAndRender() {
    const filtered = filterProducts(allProducts);
    const sorted = sortProducts(filtered);
    
    const total = sorted.length;
    productCountEl && (productCountEl.textContent = `${total} Product${total !== 1 ? 's' : ''}`);
    if (total === 0) {
      
      productsGrid.innerHTML = '';
      if (emptyState) {
        emptyState.innerHTML = `
          <div class="empty-state">
            <h3>No products match your filters</h3>
            <p>Try clearing filters to see all products.</p>
            <div style="margin-top:12px;">
              <button id="clear-filters-btn" type="button" class="secondary-btn">Clear filters</button>
            </div>
          </div>`;
        emptyState.style.display = 'block';
        
        const clearBtn = document.getElementById('clear-filters-btn');
        if (clearBtn) {
          clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            clearAllFilters();
            applyFiltersAndRender();
          });
        }
      }
      
      currentPage = 1; totalPages = 1; renderPagination();
    } else {
      if (emptyState) emptyState.style.display = 'none';
      
      totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (currentPage > totalPages) currentPage = totalPages;
      const start = (currentPage - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      const pageSlice = sorted.slice(start, end);
      renderProductGrid(productsGrid, pageSlice, {
        idKey: '_id',
        detailUrl: id => `user_product-detail.html?id=${encodeURIComponent(id)}`,
        onAddToCart: addToCart,
        apiBase: API_ROOT.replace(/\/api\/?$/, '')
      });
      renderPagination();
    }
    
    renderAppliedChips();
  }

  function clearAllFilters() {
    try {
      
      if (categoryBtnsContainer) {
        const allCb = categoryBtnsContainer.querySelector('.filter-category-checkbox[data-category=""]');
        categoryBtnsContainer.querySelectorAll('.filter-category-checkbox').forEach(cb => {
          if (cb === allCb) cb.checked = true; else cb.checked = false;
        });
      }

      if (priceRangeMin && priceRangeMax) {
        priceRangeMin.value = priceRangeMin.min || 0;
        priceRangeMax.value = priceRangeMax.max || 10000;
      }
      if (priceMinInput) priceMinInput.value = priceRangeMin ? priceRangeMin.value : 0;
      if (priceMaxInput) priceMaxInput.value = priceRangeMax ? priceRangeMax.value : (priceRangeMax ? priceRangeMax.max : 10000);

      if (ratingRadios) Array.from(ratingRadios).forEach(r => { r.checked = Number(r.value) === 0; });

      if (availabilityCheckbox) availabilityCheckbox.checked = false;
      if (saleCheckbox) saleCheckbox.checked = false;

      if (sortSelect) sortSelect.value = 'bestseller';

      if (appliedFiltersEl) appliedFiltersEl.style.display = 'none';
      
      debouncedApply();

      try {
        const productsCol = document.getElementById('products-column') || document.getElementById('products-grid');
        if (productsCol) {
          productsCol.classList.remove('cleared-anim');

          productsCol.offsetWidth;
          productsCol.classList.add('cleared-anim');
          
          setTimeout(() => productsCol.classList.remove('cleared-anim'), 900);
        }
      } catch (e) {  }
    } catch (e) { console.error('clearAllFilters error', e); }
  }

  function renderPagination() {
    if (!paginationEl) return;
    paginationEl.innerHTML = '';
    if (totalPages <= 1) return;

    const container = document.createElement('div');
    container.className = 'pagination-controls';

    const makeBtn = (label, page, opts = {}) => {
      const { disabled = false, ariaLabel = undefined } = opts;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'page-btn';
      b.dataset.page = page;
      b.textContent = label;
      b.disabled = !!disabled;
      if (page === currentPage) {
        b.classList.add('active');
        b.setAttribute('aria-current', 'page');
      }
      if (ariaLabel) b.setAttribute('aria-label', ariaLabel);
      return b;
    };

    container.appendChild(makeBtn('‹', Math.max(1, currentPage - 1), { disabled: currentPage === 1, ariaLabel: 'Previous page' }));

    const maxButtons = 3; 
    const side = Math.floor((maxButtons - 1) / 2);
    let start = Math.max(1, currentPage - side);
    let end = Math.min(totalPages, currentPage + side);
    
    if (end - start + 1 < maxButtons) {
      if (start === 1) {
        end = Math.min(totalPages, start + maxButtons - 1);
      } else if (end === totalPages) {
        start = Math.max(1, end - maxButtons + 1);
      } else {
        
        start = Math.max(1, start - (maxButtons - (end - start + 1)));
        end = Math.min(totalPages, end + (maxButtons - (end - start + 1)));
      }
    }

    if (start > 1) {
      container.appendChild(makeBtn('1', 1, { ariaLabel: 'Page 1' }));
      if (start > 2) {
        const dots = document.createElement('span');
        dots.className = 'ellipsis';
        dots.textContent = '…';
        container.appendChild(dots);
      }
    }

    for (let p = start; p <= end; p++) {
      container.appendChild(makeBtn(String(p), p, { ariaLabel: `Page ${p}` }));
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        const dots = document.createElement('span');
        dots.className = 'ellipsis';
        dots.textContent = '…';
        container.appendChild(dots);
      }
      container.appendChild(makeBtn(String(totalPages), totalPages, { ariaLabel: `Page ${totalPages}` }));
    }

    container.appendChild(makeBtn('›', Math.min(totalPages, currentPage + 1), { disabled: currentPage === totalPages, ariaLabel: 'Next page' }));

    paginationEl.appendChild(container);
  }

  if (paginationEl) {
    paginationEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.page-btn');
      if (!btn) return;
      const p = Number(btn.dataset.page || 1);
      if (!p || p === currentPage) return;
      currentPage = p;
      applyFiltersAndRender();
      
      const topAnchor = document.querySelector('.products-main') || document.body;
      topAnchor.scrollIntoView({ behavior: 'smooth' });
    });
  }

  function filterProducts(products = []) {
    const cats = getSelectedCategories(); 
    const minPrice = Number(priceMinInput.value || priceRangeMin.value || 0);
    const maxPrice = Number(priceMaxInput.value || priceRangeMax.value || priceRangeMax.max || 999999);
  const minRating = getMinRating();
  const instockOnly = availabilityCheckbox && availabilityCheckbox.checked;
  const saleOnly = saleCheckbox && saleCheckbox.checked;
  const searchQuery = window.currentSearchQuery || '';

    return products.filter(p => {
      
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        const name = (p.name || '').toLowerCase();
        const description = (p.description || '').toLowerCase();
        const category = (p.category || '').toLowerCase();
        
        const matchesSearch = name.includes(lowerQuery) || 
                            description.includes(lowerQuery) || 
                            category.includes(lowerQuery);
        
        if (!matchesSearch) return false;
      }

      const price = Number(p.price || 0);
      if (price < minPrice) return false;
      if (price > maxPrice) return false;
      
      const rating = Number(p.rating || 0);
      if (rating < minRating) return false;
      
      if (instockOnly) {
        
        const effectiveStock = (typeof p.stock === 'number') ? p.stock : (typeof p.quantity === 'number' ? p.quantity : (p.stockQuantity || 0));

        const stockStatus = (p.stockStatus || '').toString().toLowerCase();
        const status = (p.status || '').toString().toLowerCase();
        const inStockFlag = (typeof p.inStock === 'boolean') ? p.inStock : (effectiveStock > 0 && stockStatus !== 'out_of_stock' && status !== 'out-of-stock');
        if (!inStockFlag) return false;
      }
    
    if (saleOnly && !isProductOnSale(p)) return false;

      if (cats.length) {
        
        const prodCatRaw = p.category || '';
        const prodCats = new Set();
        try {
          if (Array.isArray(p.categories)) p.categories.forEach(c => prodCats.add(String(c || '').toLowerCase().trim()));
        } catch (e) {  }
        
        prodCats.add(String(prodCatRaw || '').toLowerCase().trim());

        Array.from(prodCats).forEach(pc => {
          if (!pc) return;
          pc.split(/[,\/&\-]/).map(s => s.trim()).forEach(s => prodCats.add(s));
        });

        const normalize = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const normalizedProd = Array.from(prodCats).map(normalize).filter(Boolean);
        const normalizedSel = cats.map(normalize).filter(Boolean);

        const matched = normalizedSel.some(sel => normalizedProd.some(pc => pc === sel || pc.split(' ').includes(sel) || pc.indexOf(sel) !== -1 || sel.indexOf(pc) !== -1));
        if (!matched) return false;
      }
      return true;
    });
  }

  function sortProducts(list = []) {
    const sort = (sortSelect && sortSelect.value) || 'bestseller';
    const copy = [...list];

    if (sort === 'price-asc' || sort === 'price-desc') {
      console.log(`🔍 Sorting ${copy.length} products by ${sort}`);
      const sampleProducts = copy.slice(0, 3).map(p => ({
        name: p.name,
        price: p.price,
        discountedPrice: p.discountedPrice,
        clearance: p.clearance
      }));
      console.log('Sample products before sort:', sampleProducts);
    }
    
    switch (sort) {
      case 'bestseller':
        
        return copy.sort((a,b)=> {
          const aSales = Number(a.salesCount || a.soldCount || 0);
          const bSales = Number(b.salesCount || b.soldCount || 0);
          if (bSales !== aSales) return bSales - aSales;
          const aScore = (Number(a.numReviews||0) * (Number(a.rating||0) + 1));
          const bScore = (Number(b.numReviews||0) * (Number(b.rating||0) + 1));
          return bScore - aScore;
        });
      case 'new-arrivals':
        
        return copy.sort((a,b) => {
          const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bT - aT;
        });
      case 'price-asc': 
      case 'price-desc': return copy.sort((a,b)=> {
        
        const getEffectivePrice = (product) => {
          const originalPrice = Number(product.price || 0);
          const discountedPrice = Number(product.discountedPrice || 0);

          if (product.discountedPrice !== undefined && 
              product.discountedPrice !== null && 
              !Number.isNaN(discountedPrice) && 
              discountedPrice < originalPrice) {
            return discountedPrice;
          }
          return originalPrice;
        };
        
        const aPrice = getEffectivePrice(a);
        const bPrice = getEffectivePrice(b);
        
        return sort === 'price-asc' ? aPrice - bPrice : bPrice - aPrice;
      });
      case 'rating-desc': return copy.sort((a,b)=> (Number(b.rating||0) - Number(a.rating||0)));
      default: return copy;
    }

    if (sort === 'price-asc' || sort === 'price-desc') {
      const sortedSample = copy.slice(0, 3).map(p => {
        const originalPrice = Number(p.price || 0);
        const discountedPrice = Number(p.discountedPrice || 0);
        const effectivePrice = (p.discountedPrice !== undefined && 
                               p.discountedPrice !== null && 
                               !Number.isNaN(discountedPrice) && 
                               discountedPrice < originalPrice) ? discountedPrice : originalPrice;
        return {
          name: p.name,
          price: p.price,
          discountedPrice: p.discountedPrice,
          effectivePrice: effectivePrice
        };
      });
      console.log('Sample products after sort:', sortedSample);
    }
    
    return copy;
  }

  function renderAppliedChips() {
    if (!appliedFiltersEl || !appliedChips) return;
    appliedChips.innerHTML = '';
    const chips = [];

    const searchQuery = window.currentSearchQuery || '';
    if (searchQuery) {
      chips.push({ type: 'search', value: searchQuery });
    }
    
    const cats = getSelectedCategories();
    if (cats.length) {
      
      const container = document.getElementById('filter-categories-list');
      const labels = cats.map(catKey => {
        try {
          
          const allCbs = container ? Array.from(container.querySelectorAll('.filter-category-checkbox')) : [];
          const cb = allCbs.find(x => ((x.getAttribute('data-category') || '').toLowerCase().trim()) === catKey);
          if (cb) {
            const lab = cb.closest('label');
            if (lab) return lab.textContent.trim();
            return cb.getAttribute('data-category');
          }
        } catch (e) {  }
        return capitalize(catKey);
      });
      
      labels.forEach(lbl => chips.push(lbl));
    }
    const min = Number(priceMinInput.value || priceRangeMin.value || 0);
    const max = Number(priceMaxInput.value || priceRangeMax.value || priceRangeMax.max || 5000);
    if (min !== 0 || max !== Number(priceRangeMax.max || 5000)) chips.push(`$${min} - $${max}`);
  const minRating = getMinRating();
  if (minRating > 0) chips.push({ type: 'rating', value: minRating });
  if (availabilityCheckbox && availabilityCheckbox.checked) chips.push('In stock');
    if (saleCheckbox && saleCheckbox.checked) chips.push('On sale');
  try { console.debug && console.debug('Applied chips:', chips); } catch (e) {}

    if (chips.length) {
      appliedFiltersEl.style.display = 'flex';
      
      chips.forEach(item => {
        const span = document.createElement('span');
        span.className = 'filter-chip';
        span.setAttribute('role', 'listitem');

        if (typeof item === 'object' && item.type === 'search') {
          span.innerHTML = `<i class="fas fa-search" style="color: #64748b; font-size: 0.85rem;"></i> ${escapeHtml(item.value)}`;
        }
        
        else if (typeof item === 'object' && item.type === 'rating') {
          span.innerHTML = generateStars(item.value);
        } else {
          span.textContent = item;
        }
        
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chip-remove-btn';
        btn.setAttribute('aria-label', `Remove filter`);
        btn.textContent = '×';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          
          if (typeof item === 'object' && item.type === 'search') {
            removeFilter('search:' + item.value);
          } else if (typeof item === 'object' && item.type === 'rating') {
            removeFilter(`${item.value}★`);
          } else {
            removeFilter(item);
          }
        });
        span.appendChild(btn);
        appliedChips.appendChild(span);
      });
    } else {
      appliedFiltersEl.style.display = 'none';
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function generateStars(count) {
    const c = Math.max(0, Math.min(5, Number(count) || 0));
    let out = '';
    for (let i = 0; i < c; i++) {
      out += '<i class="fas fa-star" aria-hidden="true"></i>';
    }
    return out;
  }

  function removeFilter(value) {
    
    if (String(value).startsWith('search:')) {
      window.currentSearchQuery = '';
      window.history.pushState({}, '', 'user_products.html');
      debouncedApply();
      return;
    }

    const container = document.getElementById('filter-categories-list');
    if (container) {
      const allLabels = Array.from(container.querySelectorAll('label.filter-category-label'));
      const found = allLabels.find(l => l.textContent.trim() === value || (l.querySelector('.filter-category-checkbox') && (l.querySelector('.filter-category-checkbox').getAttribute('data-category') || '').trim() === value));
      if (found) {
        const cb = found.querySelector('.filter-category-checkbox');
        if (cb) cb.checked = false;
        debouncedApply();
        return;
      }
    }

    const priceMatch = String(value).match(/\$(\d+)\s*-\s*\$(\d+)/);
    if (priceMatch) {
      if (priceRangeMin && priceRangeMax && priceMinInput && priceMaxInput) {
        priceRangeMin.value = priceRangeMin.min || 0;
        priceRangeMax.value = priceRangeMax.max || 10000;
        priceMinInput.value = priceRangeMin.value;
        priceMaxInput.value = priceRangeMax.value;
        
        try { if (typeof updateDisplays === 'function') updateDisplays(); } catch (e) {}
        debouncedApply();
        return;
      }
    }

    const ratingMatch = String(value).match(/(\d+)\s*★/);
    if (ratingMatch) {
      const num = Number(ratingMatch[1]);
      if (ratingRadios) {
        
        Array.from(ratingRadios).forEach(r => { if (Number(r.value) === 0) r.checked = true; });
        debouncedApply();
        return;
      }
    }

    if (value === 'In stock') {
      if (availabilityCheckbox) {
        availabilityCheckbox.checked = false;
        debouncedApply();
        return;
      }
    }

    if (value === 'On sale') {
      if (saleCheckbox) {
        saleCheckbox.checked = false;
        debouncedApply();
        return;
      }
    }
  }

  function capitalize(s='') { return s.charAt(0).toUpperCase() + s.slice(1); }

  async function loadProducts() {
    const res = await fetch(PRODUCTS_ENDPOINT, { method: 'GET', credentials: 'include' });
    if (!res.ok) throw new Error(`Products fetch failed: ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : (data.products || []);
  }

  async function addToCart(productId) {
    try {
      if (window.CartClient && typeof window.CartClient.addToCart === 'function') {
        await window.CartClient.addToCart(productId, 1);
        if (window.showCartNotification) window.showCartNotification('Added to cart');
        return;
      }
      const res = await fetch(`${API_ROOT}/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, quantity: 1 })
      });
      if (!res.ok) throw new Error('Add to cart failed');
      if (window.showCartNotification) window.showCartNotification('Added to cart');
    } catch (err) {
      console.error('addToCart error', err);
      if (window.showCartNotification) window.showCartNotification('Failed to add to cart');
    }
  }

  function showLoading(show) {
    if (!loadingSpinner) return;
    loadingSpinner.style.display = show ? 'flex' : 'none';
  }

  (function wireBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    const showThreshold = 300;
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      window.requestAnimationFrame(() => {
        if (window.scrollY > showThreshold) btn.classList.add('visible'); else btn.classList.remove('visible');
        ticking = false;
      });
      ticking = true;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    
    onScroll();
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) { document.documentElement.scrollTop = 0; }
    });
  })();
});
