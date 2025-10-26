

class HomePage {
    constructor() {
        this.API_BASE = window.CONFIG?.API_URL || '/api';
        this.categories = [];
        this.featuredProducts = [];
        this.isLoading = false;

        this.currentSlide = 0;
        this.totalSlides = 5;
        this.autoPlayInterval = null;
        this.autoPlayDelay = 5000; 

        this.cache = {
            products: null,
            lastFetch: null,
            cacheTimeout: 5 * 60 * 1000 
        };
        
        this.init();
    }

    async init() {
        
        this.checkAuthStatus();

        this.initCarousel();

        await this.loadCategoryProducts();

        this.initScrollButtons();

        await this.loadCategories();
        await this.loadFeaturedProducts();
        this.initAnimations();
        this.initScrollEffects();

        this.ensureCartCountLoaded();
        
        console.log('✅ Home page initialized successfully');
    }

    async ensureCartCountLoaded() {
        
        let retries = 0;
        const maxRetries = 20;
        
        const checkAndLoad = async () => {
            const cartCountElements = document.querySelectorAll('.cart-count, #cart-count, #mobile-cart-count');
            
            if (cartCountElements.length > 0) {
                console.log('✅ Cart count elements found, refreshing cart...');
                
                if (typeof window.refreshCartCount === 'function') {
                    await window.refreshCartCount();
                } else if (window.CartClient && typeof window.CartClient.getCart === 'function') {
                    try {
                        const cart = await window.CartClient.getCart();
                        
                        document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
                    } catch (e) {
                        console.warn('Failed to get cart:', e);
                    }
                }
            } else if (retries < maxRetries) {
                retries++;
                console.log(`⏳ Waiting for cart elements... (attempt ${retries}/${maxRetries})`);
                setTimeout(checkAndLoad, 100);
            } else {
                console.warn('❌ Cart count elements not found after maximum retries');
            }
        };
        
        checkAndLoad();
    }

    initCarousel() {
        const prevBtn = document.querySelector('.carousel-btn-prev');
        const nextBtn = document.querySelector('.carousel-btn-next');
        const indicators = document.querySelectorAll('.indicator');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.previousSlide();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.nextSlide();
            });
        }

        indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => {
                this.goToSlide(index);
            });
        });

        this.startAutoPlay();

        const carousel = document.querySelector('.hero-carousel');
        if (carousel) {
            carousel.addEventListener('mouseenter', () => {
                this.stopAutoPlay();
            });

            carousel.addEventListener('mouseleave', () => {
                this.startAutoPlay();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                this.previousSlide();
            } else if (e.key === 'ArrowRight') {
                this.nextSlide();
            }
        });

        let touchStartX = 0;
        let touchEndX = 0;

        if (carousel) {
            carousel.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            });

            carousel.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                this.handleSwipe(touchStartX, touchEndX);
            });
        }

        console.log('✅ Carousel initialized');
    }

    goToSlide(slideIndex) {
        const slides = document.querySelectorAll('.carousel-slide');
        const indicators = document.querySelectorAll('.indicator');

        slides.forEach(slide => slide.classList.remove('active'));
        indicators.forEach(indicator => indicator.classList.remove('active'));

        if (slides[slideIndex]) {
            slides[slideIndex].classList.add('active');
        }
        if (indicators[slideIndex]) {
            indicators[slideIndex].classList.add('active');
        }

        this.currentSlide = slideIndex;
    }

    nextSlide() {
        this.currentSlide = (this.currentSlide + 1) % this.totalSlides;
        this.goToSlide(this.currentSlide);
    }

    previousSlide() {
        this.currentSlide = (this.currentSlide - 1 + this.totalSlides) % this.totalSlides;
        this.goToSlide(this.currentSlide);
    }

    handleSwipe(startX, endX) {
        const swipeThreshold = 50;
        const diff = startX - endX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                
                this.nextSlide();
            } else {
                
                this.previousSlide();
            }
        }
    }

    startAutoPlay() {
        this.stopAutoPlay(); 
        this.autoPlayInterval = setInterval(() => {
            this.nextSlide();
        }, this.autoPlayDelay);
    }

    stopAutoPlay() {
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
    }

    checkAuthStatus() {
        const authStatusDiv = document.getElementById('auth-status');
        const token = localStorage.getItem('authToken');
        const userFirstName = localStorage.getItem('userFirstName') || 'User';
        const userEmail = localStorage.getItem('userEmail') || 'No email';
        const userRole = localStorage.getItem('userRole') || 'user';

        if (token && userRole === 'admin' && window.location.pathname.endsWith('index.html')) {
            console.log('🚫 Admin user attempting to access main site, redirecting to admin dashboard');
            window.location.href = 'adminHome.html';
            return;
        }

        if (token && authStatusDiv) {
            authStatusDiv.style.display = 'block';
            authStatusDiv.className = 'auth-status-dev logged-in';
            authStatusDiv.innerHTML = `
                <div>
                    <p><strong>Status:</strong> ✅ Logged In Successfully</p>
                    <p><strong>Welcome:</strong> ${userFirstName}</p>
                    <p><strong>Email:</strong> ${userEmail}</p>
                    <p><strong>Role:</strong> ${userRole}</p>
                    <p><strong>Token:</strong> ${token.substring(0, 20)}... (${token.length} chars)</p>
                    <div style="margin-top: 10px;">
                        <button onclick="window.homePageInstance.logout()" style="background: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin-right: 10px;">Log Out</button>
                    </div>
                </div>
            `;
        }
    }

    logout() {
        
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userFirstName');
        localStorage.removeItem('userLastName');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userId');
        localStorage.removeItem('userAvatar');

        const authStatusDiv = document.getElementById('auth-status');
        if (authStatusDiv) {
            authStatusDiv.className = 'auth-status-dev logged-out';
            authStatusDiv.innerHTML = `
                <div>
                    <p><strong>Status:</strong> ❌ Logged Out Successfully</p>
                    <p>Refreshing page...</p>
                </div>
            `;
        }

        setTimeout(() => {
            window.location.reload();
        }, 1500);
    }

    async loadCategoryProducts() {
        console.log('🔄 Loading all category products with optimized approach...');
        
        try {
            
            if (this.isCacheValid()) {
                console.log('📦 Using cached products data');
                this.processAllCategoryProducts(this.cache.products);
                return;
            }

            const response = await fetch(`${this.API_BASE}/products`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (!result.success || !result.products) {
                throw new Error('Invalid API response');
            }

            console.log(`📦 Fetched ${result.products.length} total products`);

            this.cache.products = result.products;
            this.cache.lastFetch = Date.now();

            this.processAllCategoryProducts(result.products);
            
        } catch (error) {
            console.error('Error loading category products:', error);
            
            await this.loadCategoryProductsFallback();
        }
    }

    isCacheValid() {
        if (!this.cache.products || !this.cache.lastFetch) {
            return false;
        }
        
        const now = Date.now();
        const cacheAge = now - this.cache.lastFetch;
        
        return cacheAge < this.cache.cacheTimeout;
    }

    clearCache() {
        this.cache.products = null;
        this.cache.lastFetch = null;
        console.log('🗑️ Cache cleared');
    }

    processAllCategoryProducts(allProducts) {
        const categories = [
            { id: 'security', name: 'Security', apiCategory: 'Security' },
            { id: 'lighting', name: 'Smart Lighting', apiCategory: 'Smart Lighting' },
            { id: 'climate', name: 'Climate Control', apiCategory: 'Climate Control' },
            { id: 'automation', name: 'Automation Kits', apiCategory: 'Automation Kits' }
        ];

        this.showAllCategoryLoading();

        requestAnimationFrame(() => {
            
            this.processSalesProducts(allProducts);

            categories.forEach(category => {
                this.processCategoryProducts(category, allProducts);
            });

            console.log('✅ All categories processed from single API call');
        });
    }

    showAllCategoryLoading() {
        const categoryIds = ['sales', 'security', 'lighting', 'climate', 'automation'];
        
        categoryIds.forEach(categoryId => {
            const loadingEl = document.getElementById(`${categoryId}-loading`);
            const productsEl = document.getElementById(`${categoryId}-products`);
            
            if (loadingEl) loadingEl.style.display = 'flex';
            if (productsEl) productsEl.style.display = 'none';
        });
    }

    processSalesProducts(allProducts) {
        const loadingEl = document.getElementById('sales-loading');
        const productsEl = document.getElementById('sales-products');

        if (!productsEl) return;

        try {
            
            const saleProducts = allProducts.filter(product => {
                const isActive = product.isActive !== false && product.status !== 'inactive';
                const stockQuantity = product.quantity || product.stock || 0;
                const inStock = stockQuantity > 0;
                const onSale = product.clearance === true && product.discountedPrice > 0;
                return isActive && inStock && onSale;
            });

            const displayProducts = saleProducts.slice(0, 10);

            if (displayProducts.length > 0) {
                this.renderCategoryProducts(productsEl, displayProducts);
                productsEl.style.display = 'grid';
            } else {
                productsEl.innerHTML = '<div class="category-empty"><p>No products on sale at the moment</p></div>';
                productsEl.style.display = 'block';
            }

            if (loadingEl) loadingEl.style.display = 'none';

        } catch (error) {
            console.error('Error processing sales products:', error);
            if (loadingEl) loadingEl.style.display = 'none';
        }
    }

    processCategoryProducts(category, allProducts) {
        const loadingEl = document.getElementById(`${category.id}-loading`);
        const productsEl = document.getElementById(`${category.id}-products`);

        if (!productsEl) return;

        try {
            
            const categoryFilteredProducts = allProducts.filter(product => {
                const productCategory = (product.category || '').trim().toLowerCase();
                const targetCategory = category.apiCategory.trim().toLowerCase();
                return productCategory === targetCategory;
            });

            const activeProducts = categoryFilteredProducts.filter(product => {
                const isActive = product.isActive !== false && product.status !== 'inactive';
                const stockQuantity = product.quantity || product.stock || 0;
                const inStock = stockQuantity > 0;
                return isActive && inStock;
            });

            const bestsellers = activeProducts.slice(0, 10);

            if (bestsellers.length > 0) {
                this.renderCategoryProducts(productsEl, bestsellers);
                productsEl.style.display = 'grid';
            } else {
                productsEl.innerHTML = '<div class="category-empty"><p>No products available in this category</p></div>';
                productsEl.style.display = 'block';
            }

            if (loadingEl) loadingEl.style.display = 'none';

        } catch (error) {
            console.error(`Error processing ${category.name} products:`, error);
            if (loadingEl) loadingEl.style.display = 'none';
        }
    }

    async loadCategoryProductsFallback() {
        console.log('⚠️ Using fallback individual category loading...');

        await this.loadSalesProducts();

        const categories = [
            { id: 'security', name: 'Security', apiCategory: 'Security' },
            { id: 'lighting', name: 'Smart Lighting', apiCategory: 'Smart Lighting' },
            { id: 'climate', name: 'Climate Control', apiCategory: 'Climate Control' },
            { id: 'automation', name: 'Automation Kits', apiCategory: 'Automation Kits' }
        ];

        await Promise.allSettled(
            categories.map(category => this.loadCategoryBestsellers(category))
        );
        console.log('✅ All categories loaded via fallback method');
    }

    async loadSalesProducts() {
        const loadingEl = document.getElementById('sales-loading');
        const productsEl = document.getElementById('sales-products');
        const errorEl = document.getElementById('sales-error');

        if (!productsEl) return;

        try {
            
            if (loadingEl) loadingEl.style.display = 'flex';
            if (errorEl) errorEl.style.display = 'none';
            productsEl.style.display = 'none';

            const response = await fetch(`${this.API_BASE}/products`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success && result.products && result.products.length > 0) {
                
                const saleProducts = result.products.filter(product => {
                    const isActive = product.isActive !== false && product.status !== 'inactive';
                    const stockQuantity = product.quantity || product.stock || 0;
                    const inStock = stockQuantity > 0;
                    const onSale = product.clearance === true && product.discountedPrice > 0;
                    return isActive && inStock && onSale;
                });

                const displayProducts = saleProducts.slice(0, 10);

                if (displayProducts.length > 0) {
                    
                    this.renderCategoryProducts(productsEl, displayProducts);
                    productsEl.style.display = 'grid';
                } else {
                    
                    productsEl.innerHTML = '<div class="category-empty"><p>No products on sale at the moment</p></div>';
                    productsEl.style.display = 'block';
                }
            } else {
                
                productsEl.innerHTML = '<div class="category-empty"><p>No products available</p></div>';
                productsEl.style.display = 'block';
            }

            if (loadingEl) loadingEl.style.display = 'none';

        } catch (error) {
            console.error('Error loading sale products:', error);

            if (loadingEl) loadingEl.style.display = 'none';
            if (errorEl) {
                errorEl.style.display = 'flex';
            }
        }
    }

    async loadCategoryBestsellers(category) {
        const loadingEl = document.getElementById(`${category.id}-loading`);
        const productsEl = document.getElementById(`${category.id}-products`);
        const errorEl = document.getElementById(`${category.id}-error`);

        if (!productsEl) return;

        try {
            
            if (loadingEl) loadingEl.style.display = 'flex';
            if (errorEl) errorEl.style.display = 'none';
            productsEl.style.display = 'none';

            console.log(`🔍 Loading products for category: ${category.name} (API: ${category.apiCategory})`);

            const apiUrl = `${this.API_BASE}/products?category=${encodeURIComponent(category.apiCategory)}&limit=10`;
            console.log(`📡 API Request: ${apiUrl}`);
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            console.log(`📦 API Response for ${category.name}:`, {
                success: result.success,
                totalProducts: result.products?.length || 0,
                firstProduct: result.products?.[0]?.name || 'none',
                firstProductCategory: result.products?.[0]?.category || 'none'
            });
            
            if (result.success && result.products && result.products.length > 0) {

                const categoryFilteredProducts = result.products.filter(product => {
                    const productCategory = (product.category || '').trim().toLowerCase();
                    const targetCategory = category.apiCategory.trim().toLowerCase();
                    return productCategory === targetCategory;
                });
                
                console.log(`🔧 Client-side filtered: ${result.products.length} -> ${categoryFilteredProducts.length} products for ${category.name}`);

                const activeProducts = categoryFilteredProducts.filter(product => {
                    const isActive = product.isActive !== false && product.status !== 'inactive';
                    const stockQuantity = product.quantity || product.stock || 0;
                    const inStock = stockQuantity > 0;

                    const productCategory = (product.category || '').toLowerCase();
                    const targetCategory = category.apiCategory.toLowerCase();
                    const categoryMatch = productCategory.includes(targetCategory) || 
                                         targetCategory.includes(productCategory);
                    
                    const shouldInclude = isActive && inStock;
                    
                    if (!shouldInclude) {
                        console.log(`Filtered out ${product.name}: active=${isActive}, inStock=${inStock}`);
                    }
                    
                    return shouldInclude;
                });

                console.log(`✅ Filtered ${activeProducts.length} active products for ${category.name}`);

                const bestsellers = activeProducts.slice(0, 10);

                if (bestsellers.length > 0) {
                    
                    this.renderCategoryProducts(productsEl, bestsellers);
                    productsEl.style.display = 'grid';
                } else {
                    
                    productsEl.innerHTML = '<div class="category-empty"><p>No products available in this category</p></div>';
                    productsEl.style.display = 'block';
                }
            } else {
                
                productsEl.innerHTML = '<div class="category-empty"><p>No products available in this category</p></div>';
                productsEl.style.display = 'block';
            }

            if (loadingEl) loadingEl.style.display = 'none';

        } catch (error) {
            console.error(`Error loading ${category.name} products:`, error);

            if (error.name === 'AbortError' || error.message.includes('aborted')) {
                console.log(`⚠️ Request aborted for ${category.name} (likely user navigated away)`);
                return;
            }

            if (loadingEl) loadingEl.style.display = 'none';
            if (errorEl) {
                errorEl.style.display = 'flex';
            }
        }
    }

    renderCategoryProducts(container, products) {
        if (!container || !products || products.length === 0) return;

        if (typeof window.renderProductGrid === 'function') {
            try {
                window.renderProductGrid(container, products, {
                    idKey: '_id',
                    detailUrl: (id) => `user_product-detail.html?id=${encodeURIComponent(id)}`,
                    onAddToCart: async (id) => {

                        try {
                            if (window.cart) {
                                await window.cart.addToCart(id, 1);
                            } else if (window.CartClient) {
                                await window.CartClient.addToCart(id, 1);
                            } else {
                                throw new Error('Cart not available');
                            }
                            
                            if (window.showNotification) {
                                window.showNotification('Added to cart', 'success');
                            }
                        } catch (error) {
                            console.error('Error adding to cart:', error);
                            
                            if (window.showNotification) {
                                window.showNotification('Failed to add to cart', 'error');
                            }
                            throw error;
                        }
                    },
                    apiBase: this.API_BASE
                });
                return;
            } catch (error) {
                console.warn('Error using renderProductGrid, falling back to custom render:', error);
            }
        }

        container.innerHTML = products.map(product => {
            const id = product._id || product.id;
            const name = product.name || 'Unnamed Product';
            const price = Number(product.price || 0);
            const discountedPrice = product.discountedPrice && product.discountedPrice < price ? Number(product.discountedPrice) : null;
            const imageUrl = this.getProductImageUrl(product);
            const stockQuantity = product.quantity || product.stock || 0;
            const rating = product.rating || 4.5;
            const isClearance = product.clearance === true || String(product.clearance).toLowerCase() === 'true';

            return `
                <div class="product-card">
                    <a href="user_product-detail.html?id=${encodeURIComponent(id)}" class="product-card-link" style="text-decoration: none; color: inherit; display: block;">
                        <div class="product-card-image-wrap" style="position: relative; overflow: hidden;">
                            ${isClearance || discountedPrice ? '<span class="clearance-badge">SALE</span>' : ''}
                            <img src="${imageUrl}" alt="${this.escapeHtml(name)}" loading="lazy">
                        </div>
                        <div class="product-info">
                            <h4 class="product-name">${this.escapeHtml(name)}</h4>
                            <div class="product-rating">
                                <span class="stars">${this.generateStarRating(rating)}</span>
                                <span class="review-count">${rating.toFixed(1)}</span>
                            </div>
                            <div class="product-price">
                                ${discountedPrice ? `
                                    <span class="price-original">$${price.toFixed(2)}</span>
                                    <span class="price-current">$${discountedPrice.toFixed(2)}</span>
                                ` : `
                                    <span class="price-current">$${price.toFixed(2)}</span>
                                `}
                            </div>
                        </div>
                    </a>
                </div>
            `;
        }).join('');
    }

    initScrollButtons() {
        const scrollButtons = document.querySelectorAll('.scroll-btn');

        const updateButtonVisibility = (container, leftBtn, rightBtn) => {
            if (!container) return;
            
            const scrollLeft = container.scrollLeft;
            const scrollWidth = container.scrollWidth;
            const clientWidth = container.clientWidth;
            const maxScroll = scrollWidth - clientWidth;

            if (scrollLeft <= 10) {
                leftBtn?.classList.add('hidden');
            } else {
                leftBtn?.classList.remove('hidden');
            }

            if (scrollLeft >= maxScroll - 10) {
                rightBtn?.classList.add('hidden');
            } else {
                rightBtn?.classList.remove('hidden');
            }
        };

        const containers = new Map();
        
        scrollButtons.forEach(button => {
            const category = button.dataset.category;
            const target = button.dataset.target;
            const isLeft = button.classList.contains('scroll-left');
            
            let containerId;
            if (category) {
                containerId = `${category}-products`;
            } else if (target) {
                containerId = target;
            }
            
            if (!containerId) return;
            
            const container = document.getElementById(containerId);
            if (!container) return;

            if (!containers.has(containerId)) {
                containers.set(containerId, { leftBtn: null, rightBtn: null, container });
            }
            
            const containerData = containers.get(containerId);
            if (isLeft) {
                containerData.leftBtn = button;
            } else {
                containerData.rightBtn = button;
            }

            button.addEventListener('click', (e) => {
                const scrollAmount = target ? 374 : 280; 
                
                if (isLeft) {
                    container.scrollLeft -= scrollAmount;
                } else {
                    container.scrollLeft += scrollAmount;
                }

                setTimeout(() => {
                    updateButtonVisibility(container, containerData.leftBtn, containerData.rightBtn);
                }, 350);
            });
        });

        containers.forEach((data, containerId) => {
            const { container, leftBtn, rightBtn } = data;

            updateButtonVisibility(container, leftBtn, rightBtn);

            container.addEventListener('scroll', () => {
                updateButtonVisibility(container, leftBtn, rightBtn);
            });

            window.addEventListener('resize', () => {
                updateButtonVisibility(container, leftBtn, rightBtn);
            });
        });

        console.log('✅ Scroll buttons initialized with visibility control');
    }

    getProductImageUrl(product) {
        try {
            if (product.images && Array.isArray(product.images) && product.images.length > 0) {
                const firstImage = product.images[0];
                if (typeof firstImage === 'string') {
                    return firstImage.startsWith('http') ? firstImage : `${this.API_BASE}${firstImage}`;
                }
            }
            if (product.imageUrl) {
                return product.imageUrl.startsWith('http') ? product.imageUrl : `${this.API_BASE}${product.imageUrl}`;
            }
        } catch (error) {
            console.error('Error getting image URL:', error);
        }
        return '../assets/images/placeholder.png';
    }

    generateStarRating(rating = 0) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

        let html = '';
        for (let i = 0; i < fullStars; i++) {
            html += '<i class="fas fa-star"></i>';
        }
        if (hasHalfStar) {
            html += '<i class="fas fa-star-half-alt"></i>';
        }
        for (let i = 0; i < emptyStars; i++) {
            html += '<i class="far fa-star"></i>';
        }
        return html;
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    async addToCart(productId) {
        try {
            if (window.CartClient && typeof window.CartClient.addToCart === 'function') {
                await window.CartClient.addToCart(productId, 1);
            } else {
                console.warn('CartClient not available');
                alert('Please wait for the page to fully load before adding items to cart.');
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
            alert('Failed to add product to cart. Please try again.');
        }
    }

    async loadCategories() {
        try {
            
            this.categories = [
                {
                    id: 'security',
                    name: 'Security Cameras',
                    description: 'Advanced surveillance systems for complete home security',
                    icon: 'fi-rr-shield',
                    link: 'user_products.html?category=security'
                },
                {
                    id: 'climate',
                    name: 'Smart Thermostats',
                    description: 'Intelligent climate control for energy efficiency',
                    icon: 'fi-rr-temperature-high',
                    link: 'user_products.html?category=climate'
                },
                {
                    id: 'lighting',
                    name: 'Smart Lighting',
                    description: 'Automated lighting systems for mood and energy savings',
                    icon: 'fi-rr-bulb',
                    link: 'user_products.html?category=lighting'
                },
                {
                    id: 'automation',
                    name: 'Home Automation',
                    description: 'Complete smart home kits for total automation',
                    icon: 'fi-rr-home',
                    link: 'user_products.html?category=automation'
                }
            ];

            this.renderCategories();
        } catch (error) {
            console.error('Error loading categories:', error);
            this.showCategoriesError();
        }
    }

    renderCategories() {
        const categoriesGrid = document.getElementById('categoriesGrid');
        if (!categoriesGrid) return;

        categoriesGrid.innerHTML = this.categories.map(category => `
            <a href="${category.link}" class="category-card" data-category="${category.id}">
                <div class="category-icon">
                    <i class="fi ${category.icon}"></i>
                </div>
                <h3>${category.name}</h3>
                <p>${category.description}</p>
            </a>
        `).join('');

        categoriesGrid.addEventListener('click', (e) => {
            const categoryCard = e.target.closest('.category-card');
            if (categoryCard) {
                const categoryId = categoryCard.dataset.category;
                this.trackCategoryClick(categoryId);
            }
        });
    }

    async loadFeaturedProducts() {
        const productsGrid = document.getElementById('featuredProductsGrid');
        const productsLoading = document.getElementById('productsLoading');
        
        if (!productsGrid || !productsLoading) return;

        try {
            productsLoading.classList.add('active');
            productsGrid.style.display = 'none';

            const response = await fetch(`${this.API_BASE}/products`);
            
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.products) {
                    
                    const filteredProducts = result.products.filter(product => {
                        
                        if (!product.isActive || product.status === 'inactive' || product.status === 'discontinued') {
                            return false;
                        }

                        const stockQuantity = product.quantity || product.stock || 0;
                        if (stockQuantity <= 0 || product.stockStatus === 'out_of_stock' || product.status === 'out-of-stock') {
                            return false;
                        }
                        
                        return true;
                    });
                    
                    this.featuredProducts = filteredProducts.slice(0, 6); 
                } else {
                    throw new Error('No products found');
                }
            } else {
                throw new Error('API request failed');
            }
        } catch (error) {
            console.warn('API not available, using fallback products:', error);
            
            this.featuredProducts = this.getFallbackProducts();
        } finally {
            productsLoading.classList.remove('active');
            productsGrid.style.display = 'grid';
            this.renderFeaturedProducts();
        }
    }

    getFallbackProducts() {
        return [
            {
                id: 'security-cam-pro',
                name: 'SmartVision Pro Camera',
                description: '4K Ultra HD security camera with night vision and AI detection',
                price: 199.99,
                image: '../assets/images/products/security-camera.jpg',
                category: 'security'
            },
            {
                id: 'smart-thermostat-eco',
                name: 'EcoSmart Thermostat',
                description: 'Energy-efficient smart thermostat with learning capabilities',
                price: 149.99,
                image: '../assets/images/products/thermostat.jpg',
                category: 'climate'
            },
            {
                id: 'led-strip-rgb',
                name: 'RGB LED Strip Kit',
                description: '16 million colors LED strip with app control and voice commands',
                price: 79.99,
                image: '../assets/images/products/led-strip.jpg',
                category: 'lighting'
            },
            {
                id: 'smart-hub-central',
                name: 'SmartHub Central',
                description: 'Central control hub for all your smart home devices',
                price: 299.99,
                image: '../assets/images/products/smart-hub.jpg',
                category: 'automation'
            },
            {
                id: 'door-sensor-wireless',
                name: 'Wireless Door Sensor',
                description: 'Smart door and window sensor with instant notifications',
                price: 39.99,
                image: '../assets/images/products/door-sensor.jpg',
                category: 'security'
            },
            {
                id: 'smart-bulb-color',
                name: 'Color Changing Smart Bulb',
                description: 'WiFi enabled smart bulb with 16 million colors',
                price: 24.99,
                image: '../assets/images/products/smart-bulb.jpg',
                category: 'lighting'
            }
        ];
    }

    renderFeaturedProducts() {
        const productsGrid = document.getElementById('featuredProductsGrid');
        if (!productsGrid) return;

        productsGrid.innerHTML = this.featuredProducts.map(product => `
            <div class="product-card" data-product-id="${product._id || product.id}">
                <div class="product-image">
                    <img src="${product.images && product.images[0] ? product.images[0] : product.image}" alt="${product.name}" loading="lazy" 
                         onerror="this.src='../assets/images/placeholder-product.png'">
                    ${((product.clearance === true || String(product.clearance).toLowerCase() === 'true') || (product.discountedPrice !== undefined && product.discountedPrice !== null && !Number.isNaN(Number(product.discountedPrice)) && Number(product.discountedPrice) < Number(product.price || 0))) ? '<div class="clearance-badge-small">SALE</div>' : ''}
                </div>
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <p class="product-description">${product.description}</p>
                    <div class="product-price">
                        ${product.clearance && product.discountedPrice ? `
                            <span class="price-discounted">$${product.discountedPrice.toFixed(2)}</span>
                            <span class="price-original">$${product.price.toFixed(2)}</span>
                        ` : `$${product.price.toFixed(2)}`}
                    </div>
                    <div class="product-actions">
                        <button class="btn-add-cart" data-product-id="${product._id || product.id}">
                            <i class="fi fi-rr-shopping-cart"></i> Add to Cart
                        </button>
                        <button class="btn-view" data-product-id="${product._id || product.id}">
                            View Details
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        this.initProductActions();
    }

    initProductActions() {
        const productsGrid = document.getElementById('featuredProductsGrid');
        if (!productsGrid) return;

        productsGrid.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-add-cart') || e.target.closest('.btn-add-cart')) {
                const button = e.target.closest('.btn-add-cart');
                const productId = button.dataset.productId;
                await this.addToCart(productId, button);
            }

            if (e.target.classList.contains('btn-view') || e.target.closest('.btn-view')) {
                const button = e.target.closest('.btn-view');
                const productId = button.dataset.productId;
                this.viewProductDetails(productId);
            }
        });
    }

    async addToCart(productId, button = null, showNotif = null) {
        if (!productId || this.isLoading) return;

        const shouldShowNotif = showNotif !== null ? showNotif : (button !== null);
        const originalText = button ? button.innerHTML : null;
        
        try {
            this.isLoading = true;

            if (button) {
                button.innerHTML = '<i class="fi fi-rr-spinner"></i> Adding...';
                button.disabled = true;
            }

            if (window.cart) {
                await window.cart.addToCart(productId, 1);
                
                if (button) {
                    button.innerHTML = '<i class="fi fi-rr-check"></i> Added!';
                    setTimeout(() => {
                        button.innerHTML = originalText;
                        button.disabled = false;
                    }, 2000);
                }

                if (shouldShowNotif && window.showNotification) {
                    window.showNotification('Added to cart', 'success');
                }
            } else {
                throw new Error('Cart not available');
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
            
            if (button) {
                button.innerHTML = '<i class="fi fi-rr-cross"></i> Error';
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.disabled = false;
                }, 2000);
            }

            if (shouldShowNotif && window.showNotification) {
                window.showNotification('Failed to add to cart', 'error');
            }
        } finally {
            this.isLoading = false;
        }
    }

    viewProductDetails(productId) {
        
        window.location.href = `user_product-detail.html?id=${productId}`;
    }

    initAnimations() {
        
        this.animateStatsCounters();

        this.initScrollAnimations();
    }

    animateStatsCounters() {
        const statNumbers = document.querySelectorAll('.stat-number');
        
        const observerOptions = {
            threshold: 0.5,
            rootMargin: '0px 0px -100px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const target = parseInt(entry.target.dataset.target);
                    this.animateCounter(entry.target, target);
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        statNumbers.forEach(stat => observer.observe(stat));
    }

    animateCounter(element, target) {
        let current = 0;
        const increment = target / 100;
        const duration = 2000;
        const stepTime = duration / 100;

        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                element.textContent = target;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current);
            }
        }, stepTime);
    }

    initScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        const animateElements = document.querySelectorAll('.category-card, .feature-card, .product-card');
        animateElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(el);
        });
    }

    initScrollEffects() {
        
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    trackCategoryClick(categoryId) {
        console.log(`📊 Category clicked: ${categoryId}`);
        
    }

    showCategoriesError() {
        const categoriesGrid = document.getElementById('categoriesGrid');
        if (categoriesGrid) {
            categoriesGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
                    <i class="fi fi-rr-exclamation-triangle" style="font-size: 2rem; margin-bottom: 16px; color: #ffc107;"></i>
                    <p>Unable to load categories. Please try again later.</p>
                </div>
            `;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.homePageInstance = new HomePage();

    window.clearHomePageCache = () => {
        if (window.homePageInstance) {
            window.homePageInstance.clearCache();
        }
    };
    
    window.getHomePageCacheInfo = () => {
        if (window.homePageInstance) {
            const cache = window.homePageInstance.cache;
            return {
                hasProducts: !!cache.products,
                productCount: cache.products ? cache.products.length : 0,
                lastFetch: cache.lastFetch ? new Date(cache.lastFetch).toLocaleString() : 'Never',
                isCacheValid: window.homePageInstance.isCacheValid(),
                cacheAge: cache.lastFetch ? Math.round((Date.now() - cache.lastFetch) / 1000) : 'N/A'
            };
        }
        return null;
    };
});

window.HomePage = HomePage;
