
(function() {
    
    const debugLog = window.debugLog || (() => {});
    const debugWarn = window.debugWarn || (() => {});
    const debugError = window.debugError || console.error.bind(console);

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    ready(function() {
        const accountDropdown = document.getElementById('accountDropdown');
        const accountLink = document.getElementById('account-link');
        const accountIcon = document.getElementById('accountIcon');
        const accountInitial = document.getElementById('accountInitial');
        const accountMenu = document.getElementById('accountMenu');
        if (!accountDropdown || !accountLink || !accountMenu || !accountInitial || !accountIcon) return;

        function getLoginState() {
            if (window.authUtils && typeof window.authUtils.isLoggedIn === 'function') {
                return {
                    loggedIn: window.authUtils.isLoggedIn(),
                    user: window.authUtils.getCurrentUser ? window.authUtils.getCurrentUser() : null
                };
            }
            const token = localStorage.getItem('authToken');
            const loggedIn = !!token;
            const user = loggedIn ? {
                firstName: localStorage.getItem('userFirstName') || '',
                email: localStorage.getItem('userEmail') || ''
            } : null;
            return { loggedIn, user };
        }

        function renderAccountDropdown() {
            accountMenu.innerHTML = '';
            const { loggedIn, user } = getLoginState();

            if (loggedIn) {
                
                const initial = (user.firstName?.[0] || user.email?.[0] || '?').toUpperCase();
                accountIcon.style.display = 'none';
                accountInitial.style.display = 'flex';
                accountInitial.textContent = initial;

                const settings = document.createElement('a');
                settings.href = 'user_account.html';
                settings.innerHTML = '<i class="fi fi-rr-settings"></i> Settings';
                accountMenu.appendChild(settings);
                
                const logoutBtn = document.createElement('button');
                logoutBtn.className = 'logout-btn';
                logoutBtn.innerHTML = '<i class="fi fi-rr-sign-out-alt"></i> Logout';
                logoutBtn.onclick = function() {
                    
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('userFirstName');
                    localStorage.removeItem('userLastName');
                    localStorage.removeItem('userEmail');
                    localStorage.removeItem('userId');
                    localStorage.removeItem('userAvatar');
                    localStorage.removeItem('userPhone');
                    
                    window.dispatchEvent(new CustomEvent('userLogout'));
                    
                    window.location.href = 'user_login.html?logout=success';
                };
                accountMenu.appendChild(logoutBtn);
            } else {
                
                accountIcon.style.display = 'inline-block';
                accountInitial.style.display = 'none';

                const signup = document.createElement('a');
                signup.href = 'user_signup.html';
                signup.innerHTML = '<i class="fi fi-rr-user-add"></i> Sign Up';
                accountMenu.appendChild(signup);
                
                const login = document.createElement('a');
                login.href = 'user_login.html';
                login.innerHTML = '<i class="fi fi-rr-sign-in-alt"></i> Log In';
                accountMenu.appendChild(login);
            }
        }

        let initialized = false;
        function showDropdown() {
            renderAccountDropdown();
            accountDropdown.classList.add('open');
            accountLink.setAttribute('aria-expanded', 'true');
        }

        function hideDropdown() {
            accountDropdown.classList.remove('open');
            accountLink.setAttribute('aria-expanded', 'false');
        }

        function toggleDropdown(e) {
            const isMenuClick = e.target.closest('.account-menu a, .account-menu button');

            if (isMenuClick) {
                
                hideDropdown();
                return; 
            }

            e.preventDefault();
            const isOpen = accountDropdown.classList.contains('open');
            if (isOpen) {
                hideDropdown();
            } else {
                showDropdown();
            }
        }

        if (!initialized) {
            accountDropdown.addEventListener('click', toggleDropdown);
            initialized = true;
        }

        accountDropdown.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideDropdown();
                accountLink.focus(); 
            }
        });

        document.addEventListener('click', (e) => {
            if (!accountDropdown.contains(e.target)) {
                hideDropdown();
            }
        });

        window.addEventListener('storage', renderAccountDropdown);
        document.addEventListener('user:login', renderAccountDropdown);
        document.addEventListener('user:logout', renderAccountDropdown);
        window.addEventListener('userLogin', renderAccountDropdown);
        window.addEventListener('userLogout', renderAccountDropdown);

        renderAccountDropdown();
    });
})();

function setupMobileMenu() {
    console.log("Setting up mobile menu...");
    
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navbarLinks = document.querySelector('.navbar-links');

    if (mobileMenuBtn && navbarLinks) {
        mobileMenuBtn.addEventListener('click', function() {
            navbarLinks.classList.toggle('show');
        });
    } else {
        console.warn("Mobile menu button or navbar links not found for toggle.");
    }

    setupMobileBottomMenu();
}

function setupMobileBottomMenu() {
    console.log("Setting up mobile bottom menu...");

    setTimeout(() => {
        const mobileNavItems = document.querySelectorAll('.mobile-nav-item[data-menu]');
        const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
        const mobileBottomMenu = document.getElementById('mobile-bottom-menu');
        const mobileMenuClose = document.getElementById('mobile-menu-close');
        const mobileMenuTitle = document.getElementById('mobile-menu-title');
        const mobileMenuContent = document.getElementById('mobile-menu-content');

        console.log("Found mobile nav items:", mobileNavItems.length);
        console.log("Mobile menu overlay:", !!mobileMenuOverlay);
        console.log("Mobile bottom menu:", !!mobileBottomMenu);

        const menuData = {
            products: {
                title: 'Products',
                items: [
                    { icon: 'fi fi-rr-shield', text: 'Security Cameras', link: '../products.html?category=security' },
                    { icon: 'fi fi-rr-temperature-high', text: 'Thermostats', link: '../products.html?category=climate' },
                    { icon: 'fi fi-rr-bulb', text: 'Smart Lighting', link: '../products.html?category=lighting' },
                    { icon: 'fi fi-rr-home', text: 'Home Automation Kits', link: '../products.html?category=automation' }
                ]
            },
            services: {
                title: 'Services',
                items: [
                    { icon: 'fi fi-rr-search', text: 'Track Orders', link: '../track-order.html' },
                    { icon: 'fi fi-rr-tool-box', text: 'Installation', link: '../installation.html' },
                    { icon: 'fi fi-rr-headset', text: 'Contact Us', link: '../contact.html' }
                ]
            }
        };

        function showMenu(menuType) {
            console.log("Showing menu for:", menuType);
            
            const menuInfo = menuData[menuType];
            if (!menuInfo) {
                console.error("Menu info not found for:", menuType);
                return;
            }

            if (mobileMenuTitle) {
                mobileMenuTitle.textContent = menuInfo.title;
            }

            let menuHTML = '<div class="mobile-menu-section">';
            menuHTML += '<ul class="mobile-menu-links">';
            
            menuInfo.items.forEach(item => {
                menuHTML += `
                    <li>
                        <a href="${item.link}">
                            <i class="${item.icon}"></i>
                            ${item.text}
                        </a>
                    </li>
                `;
            });
            
            menuHTML += '</ul></div>';
            
            if (mobileMenuContent) {
                mobileMenuContent.innerHTML = menuHTML;
            }

            if (mobileMenuOverlay) {
                mobileMenuOverlay.classList.add('active');
                console.log("Added active class to overlay");
            }
            if (mobileBottomMenu) {
                mobileBottomMenu.classList.add('active');
                console.log("Added active class to bottom menu");
            }
            document.body.style.overflow = 'hidden';
        }

        function hideMenu() {
            console.log("Hiding menu");
            
            if (mobileMenuOverlay) {
                mobileMenuOverlay.classList.remove('active');
            }
            if (mobileBottomMenu) {
                mobileBottomMenu.classList.remove('active');
            }
            document.body.style.overflow = '';
        }

        mobileNavItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const menuType = this.getAttribute('data-menu');
                console.log("Mobile nav item clicked:", menuType);
                showMenu(menuType);
            });
        });

        if (mobileMenuClose) {
            mobileMenuClose.addEventListener('click', hideMenu);
        }
        if (mobileMenuOverlay) {
            mobileMenuOverlay.addEventListener('click', hideMenu);
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                hideMenu();
            }
        });

        console.log("Mobile bottom menu setup completed");
    }, 200);
}

function initializeSearch() {
    
    const API_BASE = (window.CONFIG && window.CONFIG.API_URL) ? window.CONFIG.API_URL : '/api';
    
    const searchButton = document.querySelector('.navbar-search-desktop .search-button');
    const searchInput = document.querySelector('#search-input');
    const suggestionsContainer = document.getElementById('search-suggestions');
    const suggestionsList = suggestionsContainer?.querySelector('.suggestions-list');

    const mobileSearchButton = document.querySelector('.navbar-search-mobile .search-button');
    const mobileSearchInput = document.querySelector('#search-input-mobile');
    const mobileSuggestionsContainer = document.getElementById('search-suggestions-mobile');
    const mobileSuggestionsList = mobileSuggestionsContainer?.querySelector('.suggestions-list');
    
    let debounceTimer;
    let allProducts = [];
    let selectedIndex = -1;

    async function fetchProducts() {
        try {
            const response = await fetch(`${API_BASE}/products`, {
                method: 'GET',
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                allProducts = Array.isArray(data) ? data : (data.products || []);
            }
        } catch (error) {
            if (window.debugError) window.debugError('Failed to fetch products for search:', error);
        }
    }

    fetchProducts();

    function searchProducts(query) {
        if (!query || query.length < 2) return [];
        
        const lowerQuery = query.toLowerCase();

        const scoredProducts = allProducts
            .map(product => {
                const name = (product.name || '').toLowerCase();
                const category = (product.category || '').toLowerCase();
                const description = (product.description || '').toLowerCase();
                
                let score = 0;

                if (name === lowerQuery) score += 1000;
                
                else if (name.startsWith(lowerQuery)) score += 500;
                
                else if (name.includes(' ' + lowerQuery)) score += 300;
                
                else if (name.includes(lowerQuery)) score += 200;

                if (category === lowerQuery) score += 400;
                else if (category.startsWith(lowerQuery)) score += 250;
                else if (category.includes(lowerQuery)) score += 150;

                if (description.includes(lowerQuery)) score += 50;

                if (score > 0) {
                    const popularity = Number(product.rating || 0) * Number(product.numReviews || 0);
                    score += popularity * 2;

                    const stock = Number(product.stock || product.quantity || 0);
                    if (stock > 0) score += 20;
                }
                
                return { product, score };
            })
            .filter(item => item.score > 0) 
            .sort((a, b) => b.score - a.score) 
            .slice(0, 8) 
            .map(item => item.product); 
        
        return scoredProducts;
    }

    function renderSuggestions(products, isMobile = false) {
        const targetList = isMobile ? mobileSuggestionsList : suggestionsList;
        if (!targetList) return;
        
        if (products.length === 0) {
            targetList.innerHTML = '<div class="search-suggestions-empty">No products found</div>';
            return;
        }
        
        targetList.innerHTML = products.map((product, index) => `
            <div class="suggestion-item" data-index="${index}" data-product-id="${product._id}">
                <i class="fi fi-rr-box suggestion-icon"></i>
                <div class="suggestion-content">
                    <p class="suggestion-name">${escapeHtml(product.name)}</p>
                    <p class="suggestion-category">${escapeHtml(product.category || 'Uncategorized')}</p>
                </div>
                <span class="suggestion-price">$${(product.price || 0).toFixed(2)}</span>
            </div>
        `).join('');

        targetList.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const productId = item.dataset.productId;
                window.location.href = `user_product-detail.html?id=${encodeURIComponent(productId)}`;
            });
        });
    }

    function showSuggestions(isMobile = false) {
        const container = isMobile ? mobileSuggestionsContainer : suggestionsContainer;
        if (container) {
            container.style.display = 'block';
        }
    }

    function hideSuggestions(isMobile = false) {
        const container = isMobile ? mobileSuggestionsContainer : suggestionsContainer;
        if (container) {
            container.style.display = 'none';
        }
        selectedIndex = -1;
    }

    function handleInput(e, isMobile = false) {
        const query = e.target.value.trim();
        const targetList = isMobile ? mobileSuggestionsList : suggestionsList;
        
        clearTimeout(debounceTimer);
        selectedIndex = -1;
        
        if (query.length < 2) {
            hideSuggestions(isMobile);
            return;
        }

        if (targetList) {
            targetList.innerHTML = '<div class="search-suggestions-loading">Searching...</div>';
            showSuggestions(isMobile);
        }

        debounceTimer = setTimeout(() => {
            const results = searchProducts(query);
            renderSuggestions(results, isMobile);
            showSuggestions(isMobile);
        }, 300);
    }

    function handleKeyDown(e, isMobile = false) {
        const targetList = isMobile ? mobileSuggestionsList : suggestionsList;
        const items = targetList?.querySelectorAll('.suggestion-item');
        if (!items || items.length === 0) return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            updateSelection(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < items.length) {
                items[selectedIndex].click();
            } else {
                handleSearch(e);
            }
        } else if (e.key === 'Escape') {
            hideSuggestions(isMobile);
        }
    }

    function updateSelection(items) {
        items.forEach((item, index) => {
            if (index === selectedIndex) {
                item.classList.add('active');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    if (searchButton) {
        searchButton.addEventListener('click', handleSearch);
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => handleInput(e, false));
        searchInput.addEventListener('keydown', (e) => handleKeyDown(e, false));
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && selectedIndex === -1) {
                handleSearch(e);
            }
        });

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && 
                !suggestionsContainer?.contains(e.target) && 
                !searchButton?.contains(e.target)) {
                hideSuggestions(false);
            }
        });
    }

    if (mobileSearchButton) {
        mobileSearchButton.addEventListener('click', handleSearch);
    }
    
    if (mobileSearchInput) {
        mobileSearchInput.addEventListener('input', (e) => handleInput(e, true));
        mobileSearchInput.addEventListener('keydown', (e) => handleKeyDown(e, true));
        mobileSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && selectedIndex === -1) {
                handleSearch(e);
            }
        });

        document.addEventListener('click', (e) => {
            if (!mobileSearchInput.contains(e.target) && 
                !mobileSuggestionsContainer?.contains(e.target) && 
                !mobileSearchButton?.contains(e.target)) {
                hideSuggestions(true);
            }
        });
    }
}

function handleSearch(event) {
    event.preventDefault();

    const desktopSearchInput = document.querySelector('#search-input');
    const mobileSearchInput = document.querySelector('#search-input-mobile');
    
    const searchQuery = (desktopSearchInput?.value || mobileSearchInput?.value || '').trim();
    
    if (searchQuery) {
        
        window.location.href = `user_products.html?search=${encodeURIComponent(searchQuery)}`;
    }
}

function navigateToTrackOrder() {
    window.location.href = 'user_track_order.html';
}

window.handleSearch = handleSearch;
window.navigateToTrackOrder = navigateToTrackOrder;

function initCartNavigation() {
    console.log('Initializing cart navigation...');

    const checkCart = () => {
        
        if (window.CartClient || window.cart) {
            try {
                
                setupCartNavigation();
            } catch (e) {
                console.warn('Error starting caLrt navigation:', e);
            }
        } else {
            setTimeout(checkCart, 100);
        }
    };
    checkCart();
}
async function setupCartNavigation() {
    console.log('Setting up cart navigation...');

    window.addEventListener('cartUpdated', function(event) {
        try { updateCartDisplay(event.detail && event.detail.cart ? event.detail.cart : event.detail); } catch(e) { console.warn('cartUpdated handler error', e); }
    });

    document.addEventListener('cart:updated', function(event) {
        try {
            
            const cartPayload = event.detail || (event.detail && event.detail.cart) || null;
            updateCartDisplay(cartPayload);
        } catch (e) {
            console.warn('cart:updated handler error', e);
        }
    });

    console.log('📡 [user_nav.js] Fetching initial cart count...');
    try {
        if (typeof window.refreshCartCount === 'function') {
            await window.refreshCartCount();
        } else if (window.CartClient && typeof window.CartClient.getCart === 'function') {
            const cart = await window.CartClient.getCart();
            updateCartDisplay(cart);
        }
    } catch (e) {
        console.warn('Failed to fetch initial cart:', e);
    }

    console.log('✅ Cart navigation event listeners set up');

    const cartIcons = document.querySelectorAll('.cart-icon, .cart-link, [href*="cart"]');
    cartIcons.forEach(icon => {
        icon.addEventListener('click', function(e) {
            
            const href = this.getAttribute('href');
            if (!href || !href.includes('cart.html')) {
                e.preventDefault();
                window.location.href = '../cart.html';
            }
        });
    });
}

function updateCartDisplay(cart) {
    console.log('📊 [user_nav.js] Updating cart display:', cart);

    const cartCounts = document.querySelectorAll('.cart-count, #cart-count, #mobile-cart-count');
    console.log(`📊 [user_nav.js] Found ${cartCounts.length} cart count elements to update`);

    let itemCount = 0;
    try {
        if (!cart) {
            itemCount = 0;
        } else if (typeof cart.totalItems === 'number') {
            itemCount = cart.totalItems;
        } else if (typeof cart.totalQuantity === 'number') {
            itemCount = cart.totalQuantity;
        } else if (Array.isArray(cart.items)) {
            itemCount = cart.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
        } else if (cart.cart && Array.isArray(cart.cart.items)) {
            itemCount = cart.cart.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
        } else {
            itemCount = 0;
        }
    } catch (e) {
        console.warn('Error calculating cart count:', e);
        itemCount = 0;
    }
    
    console.log(`📊 [user_nav.js] Calculated cart count: ${itemCount}`);
    
    cartCounts.forEach((countElement, index) => {
        
        countElement.textContent = itemCount;
        console.log(`   - Updated element ${index + 1}/${cartCounts.length}: ${countElement.className || countElement.id} = ${itemCount}`);

        countElement.style.display = 'flex';

        if (itemCount > 0) {
            countElement.classList.add('active');
        } else {
            countElement.classList.remove('active');
        }
        
        countElement.setAttribute('data-count', itemCount);
    });

    if (itemCount > 0) {
        cartCounts.forEach(countElement => {
            
            countElement.classList.remove('bounce');
            
            void countElement.offsetWidth;
            
            countElement.classList.add('bounce');
            setTimeout(() => {
                countElement.classList.remove('bounce');
            }, 300);
        });
    }
    
    console.log(`✅ [user_nav.js] Cart display updated to ${itemCount}`);
}

function initAuthNavigation() {
    console.log('Initializing auth-based navigation...');
    
    const accountLink = document.getElementById('account-link');
    const mobileAccountLink = document.getElementById('mobile-account-link');

    const authToken = localStorage.getItem('authToken');
    const isLoggedIn = !!authToken;
    
    console.log('User logged in:', isLoggedIn);
    
    if (isLoggedIn) {
        if (accountLink) accountLink.setAttribute('aria-label', 'My Account Dashboard');
        updateUserIcon();
    } else {
        if (accountLink) accountLink.setAttribute('aria-label', 'Login to your account');
    }

    setupAccountLinkHandlers();
}

function updateUserIcon() {
    const authToken = localStorage.getItem('authToken');
    const userFirstName = localStorage.getItem('userFirstName');
    
    const accountIcon = document.getElementById('accountIcon');
    const accountInitial = document.getElementById('accountInitial');
    const accountButton = document.getElementById('account-link');
    
    if (!authToken || !userFirstName) {
        
        if (accountIcon) {
            accountIcon.style.display = 'inline';
        }
        if (accountInitial) {
            accountInitial.style.display = 'none';
        }
        return;
    }

    const initial = userFirstName.charAt(0).toUpperCase();
    
    if (accountIcon) {
        accountIcon.style.display = 'none';
    }
    
    if (accountInitial) {
        accountInitial.textContent = initial;
        accountInitial.style.display = 'flex';
    }

    if (accountButton) {
        accountButton.setAttribute('title', `Welcome, ${userFirstName}!`);
        accountButton.setAttribute('aria-label', `Account Dashboard - ${userFirstName}`);
    }

    const mobileAccountLink = document.getElementById('mobile-account-link');
    if (mobileAccountLink && userFirstName) {
        const accountSpan = mobileAccountLink.querySelector('span');
        if (accountSpan) {
            accountSpan.textContent = userFirstName.length > 8 ? userFirstName.substring(0, 8) + '...' : userFirstName;
        }
    }
}

function setupAccountLinkHandlers() {
    const accountButton = document.getElementById('account-link');
    const accountDropdown = document.getElementById('accountDropdown');
    const accountMenu = document.getElementById('accountMenu');
    const mobileAccountLink = document.getElementById('mobile-account-link');

    if (accountButton && accountDropdown && accountMenu) {
        
        accountButton.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = accountDropdown.classList.contains('open');
            
            if (isOpen) {
                closeAccountDropdown();
            } else {
                openAccountDropdown();
            }
        });

        document.addEventListener('click', function(e) {
            if (!accountDropdown.contains(e.target)) {
                closeAccountDropdown();
            }
        });

        updateAccountMenu();
    }

    if (mobileAccountLink) {
        mobileAccountLink.addEventListener('click', function(e) {
            handleMobileAccountClick(e, this);
        });
    }
}

function openAccountDropdown() {
    const accountDropdown = document.getElementById('accountDropdown');
    const accountButton = document.getElementById('account-link');
    
    if (accountDropdown) {
        accountDropdown.classList.add('open');
    }
    if (accountButton) {
        accountButton.setAttribute('aria-expanded', 'true');
    }
}

function closeAccountDropdown() {
    const accountDropdown = document.getElementById('accountDropdown');
    const accountButton = document.getElementById('account-link');
    
    if (accountDropdown) {
        accountDropdown.classList.remove('open');
    }
    if (accountButton) {
        accountButton.setAttribute('aria-expanded', 'false');
    }
}

function updateAccountMenu() {
    const accountMenu = document.getElementById('accountMenu');
    if (!accountMenu) return;
    
    const authToken = localStorage.getItem('authToken');
    const isLoggedIn = !!authToken;
    const userFirstName = localStorage.getItem('userFirstName') || 'User';
    const userEmail = localStorage.getItem('userEmail') || '';
    
    if (isLoggedIn) {
        
        accountMenu.innerHTML = `
            <div class="account-menu-header">
                <div class="account-menu-avatar">
                    <span>${userFirstName.charAt(0).toUpperCase()}</span>
                </div>
                <div class="account-menu-info">
                    <div class="account-menu-name">${escapeHtml(userFirstName)}</div>
                    <div class="account-menu-email">${escapeHtml(userEmail)}</div>
                </div>
            </div>
            <div class="account-menu-divider"></div>
            <a href="user_account.html">
                <i class="fi fi-rr-settings"></i>
                <span>Account Settings</span>
            </a>
            <a href="user_track_order.html">
                <i class="fi fi-rr-shopping-bag"></i>
                <span>My Orders</span>
            </a>
            <div class="account-menu-divider"></div>
            <button class="logout-btn" id="logout-btn">
                <i class="fi fi-rr-sign-out-alt"></i>
                <span>Logout</span>
            </button>
        `;

        const logoutBtn = accountMenu.querySelector('#logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
    } else {
        
        accountMenu.innerHTML = `
            <a href="user_login.html">
                <i class="fi fi-rr-sign-in-alt"></i>
                <span>Login</span>
            </a>
            <a href="user_signup.html">
                <i class="fi fi-rr-user-add"></i>
                <span>Sign Up</span>
            </a>
        `;
    }
}

function handleLogout(e) {
    e.preventDefault();

    localStorage.removeItem('authToken');
    localStorage.removeItem('userFirstName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userId');

    if (window.CartClient && typeof window.CartClient.clearCart === 'function') {
        window.CartClient.clearCart();
    }

    closeAccountDropdown();

    if (window.showCartNotification) {
        window.showCartNotification('Logged out successfully');
    }

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 500);
}

function handleMobileAccountClick(event, linkElement) {
    const authToken = localStorage.getItem('authToken');
    const isLoggedIn = !!authToken;
    
    if (isLoggedIn) {
        
        window.location.href = 'user_account.html';
    } else {
        
        window.location.href = 'user_login.html';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function setupAuthEventListeners() {
    
    window.addEventListener('storage', function(e) {
        if (e.key === 'authToken') {
            console.log('Auth token changed, updating navigation...');
            initAuthNavigation();
        }
    });

    window.addEventListener('userLogin', function(e) {
        console.log('User logged in, updating navigation...');
        initAuthNavigation();
    });
    
    window.addEventListener('userLogout', function(e) {
        console.log('User logged out, updating navigation...');
        initAuthNavigation();
    });

    window.addEventListener('profileUpdated', function(e) {
        console.log('Profile updated, refreshing user icon...');
        updateUserIcon();
    });
}

function runNavInit() {
    console.log('Initializing nav (runNavInit)');
    
    setTimeout(() => {
        try {
            setupMobileMenu();
            initializeSearch();
            initCartNavigation();
            initAuthNavigation(); 
            setupAuthEventListeners(); 
        } catch (e) {
            console.warn('Error during nav initialization', e);
        }
    }, 100);

    const categoryLinks = document.querySelectorAll('.dropdown-menu a[data-category]');
    categoryLinks.forEach(link => {
        const category = link.getAttribute('data-category');
        if (category) {
            
            link.href = `../products.html?category=${encodeURIComponent(category)}`;
        }
    });
}

if (document.readyState !== 'loading') runNavInit();
else document.addEventListener('DOMContentLoaded', runNavInit);

console.log('nav.js loaded');