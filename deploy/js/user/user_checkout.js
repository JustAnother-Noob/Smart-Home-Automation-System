

class CheckoutManager {
    constructor() {
        this.API_BASE = (window.CONFIG && window.CONFIG.API_URL ? window.CONFIG.API_URL : '/api').replace(/\/+$/, '');
        this.sessionId = localStorage.getItem('cartSessionId');

        this.authToken = localStorage.getItem('authToken');
        this.isLoggedIn = !!(this.authToken && this.authToken.trim() !== '');
        this.userFirstName = localStorage.getItem('userFirstName');
        this.userLastName = localStorage.getItem('userLastName');
        this.userEmail = localStorage.getItem('userEmail');
        this.userPhone = localStorage.getItem('userPhone');
        
        console.log('🔍 Authentication status:', {
            hasToken: !!this.authToken,
            tokenPreview: this.authToken ? this.authToken.substring(0, 20) + '...' : 'none',
            isLoggedIn: this.isLoggedIn,
            userFirstName: this.userFirstName,
            userEmail: this.userEmail
        });
        
        this.currentStep = 'customer';
        this.placesInitialized = false;
        this.cartIsEmpty = true; 

        this.stripe = null;
        this.checkout = null;
        this.initializeStripe();

        this.init();
    }

    requireLogin() {
        if (!this.isLoggedIn) {
            console.log('🔐 Login required for checkout, redirecting...');
            
            localStorage.setItem('redirectAfterLogin', 'user_checkout.html');
            
            window.location.href = 'user_login.html?redirect=checkout&message=Please log in to proceed with checkout';
            return false;
        }
        return true;
    }

    preFilFormFromLocalStorage() {
        if (this.isLoggedIn && (this.userFirstName || this.userEmail)) {
            console.log('📋 Pre-filling form from localStorage...');
            
            const firstNameField = document.getElementById('firstName');
            const lastNameField = document.getElementById('lastName');
            const emailField = document.getElementById('email');
            const phoneField = document.getElementById('phone');
            
            if (firstNameField && this.userFirstName) {
                firstNameField.value = this.userFirstName;
            }
            if (lastNameField && this.userLastName) {
                lastNameField.value = this.userLastName;
            }
            if (emailField && this.userEmail) {
                emailField.value = this.userEmail;
                emailField.readOnly = true;
                emailField.style.backgroundColor = '#f8f9fa';
            }
            if (phoneField && this.userPhone) {
                phoneField.value = this.userPhone;
            }

            setTimeout(() => {
                this.validateCustomerStep();
            }, 100);
        }
    }

    updateAuthStatus() {
        const authStatusEl = document.getElementById('customer-auth-status');
        const saveAddressOption = document.getElementById('save-address-option');
        const savedAddresses = document.getElementById('saved-addresses');
        const noSavedAddresses = document.getElementById('no-saved-addresses');
        const addressFormContainer = document.getElementById('address-form-container');
        const addressSection = document.querySelector('.address-section');

        // Ensure address section is always visible
        if (addressSection) {
            addressSection.style.display = 'block';
            addressSection.style.visibility = 'visible';
            addressSection.style.opacity = '1';
        }

        if (authStatusEl) authStatusEl.style.display = 'none';
        
        if (this.isLoggedIn) {
            
            if (saveAddressOption) saveAddressOption.style.display = 'block';
            
            this.loadSavedAddresses();
        } else {

            if (savedAddresses) savedAddresses.style.display = 'none';
            if (noSavedAddresses) noSavedAddresses.style.display = 'none';
            if (saveAddressOption) saveAddressOption.style.display = 'none';
            if (addressFormContainer) {
                addressFormContainer.style.display = 'block';
                addressFormContainer.classList.add('visible');
                addressFormContainer.classList.remove('hidden');
            }
        }
    }

    async loadCustomerInfo() {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };

            if (this.isLoggedIn && this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
                console.log('🔑 Adding auth header for API call');
            } else if (this.sessionId) {
                headers['x-session-id'] = this.sessionId;
                console.log('🔄 Adding session ID for guest user');
            }
            
            console.log('📡 Fetching customer info from API...');
            const response = await fetch(`${this.API_BASE}/checkout/customer-info`, {
                method: 'GET',
                headers,
                credentials: 'include'
            });

            const backendSessionId = response.headers.get('X-Session-ID');
            if (backendSessionId && backendSessionId !== this.sessionId) {
                this.sessionId = backendSessionId;
                localStorage.setItem('cartSessionId', backendSessionId);
                console.log('🔄 Session updated from backend:', backendSessionId.slice(-8));
            }
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    console.log('✅ Customer info loaded from API:', data);
                    this.populateCustomerForm(data);
                } else {
                    console.warn('❌ API returned success=false:', data.message);
                }
            } else {
                console.warn('❌ Customer info request failed:', response.status, response.statusText);
                
            }
        } catch (error) {
            console.error('❌ Error loading customer info:', error);
            
            if (this.isLoggedIn) {
                this.showMessage('Using cached information. Some data may not be up-to-date.', 'info');
            }
        }
    }

    handlePlaceSelection(place, inputType) {
        if (!place.address_components) return;

        console.log('🗺️ Processing place selection:', { inputType, place });

        const components = {};

        place.address_components.forEach(component => {
            const types = component.types;
            
            if (types.includes('street_number')) {
                components.streetNumber = component.long_name;
            }
            if (types.includes('route')) {
                components.route = component.long_name;
            }
            if (types.includes('locality') || types.includes('sublocality_level_1')) {
                components.city = component.long_name;
            }
            if (types.includes('administrative_area_level_1')) {
                components.state = component.short_name;
            }
            if (types.includes('postal_code')) {
                components.postcode = component.long_name;
            }
            if (types.includes('country')) {
                components.country = component.long_name;
            }
        });

        console.log('📍 Parsed address components:', components);

        if (inputType === 'street') {
            
            if (components.streetNumber && components.route) {
                this.setFieldValue('street', `${components.streetNumber} ${components.route}`);
            } else if (components.route) {
                this.setFieldValue('street', components.route);
            }
            
            if (components.city) {
                this.setFieldValue('city', components.city);
            }
            
            if (components.state) {
                const stateMapping = {
                    'NSW': 'NSW',
                    'VIC': 'VIC', 
                    'QLD': 'QLD',
                    'WA': 'WA',
                    'SA': 'SA',
                    'TAS': 'TAS',
                    'ACT': 'ACT',
                    'NT': 'NT'
                };
                
                if (stateMapping[components.state]) {
                    this.setFieldValue('state', stateMapping[components.state]);
                }
            }
            
            if (components.postcode) {
                this.setFieldValue('zipCode', components.postcode);
            }

            this.setFieldValue('country', 'Australia');
            
        } else if (inputType === 'city') {
            
            if (components.city) {
                this.setFieldValue('city', components.city);
            }
            
            if (components.state) {
                const stateMapping = {
                    'NSW': 'NSW',
                    'VIC': 'VIC', 
                    'QLD': 'QLD',
                    'WA': 'WA',
                    'SA': 'SA',
                    'TAS': 'TAS',
                    'ACT': 'ACT',
                    'NT': 'NT'
                };
                
                if (stateMapping[components.state]) {
                    this.setFieldValue('state', stateMapping[components.state]);
                }
            }
        }

        setTimeout(() => {
            this.validateAllFields();
            this.validateCustomerStep();
        }, 100);
    }

    setFieldValue(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        field.value = value;

        const inputEvent = new Event('input', { bubbles: true });
        const changeEvent = new Event('change', { bubbles: true });
        
        field.dispatchEvent(inputEvent);
        field.dispatchEvent(changeEvent);

        const blurEvent = new Event('blur', { bubbles: true });
        field.dispatchEvent(blurEvent);
    }

    validateAllFields() {
        const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'street', 'city', 'state', 'zipCode'];
        let allValid = true;
        
        requiredFields.forEach(fieldId => {
            const isValid = this.validateField(fieldId);
            if (!isValid) {
                allValid = false;
            }
        });
        
        return allValid;
    }

    initializePlacesAutocomplete() {
        if (this.placesInitialized || !window.google) return;

        try {
            const streetInput = document.getElementById('street');
            const cityInput = document.getElementById('city');

            if (streetInput && window.google.maps && window.google.maps.places) {
                console.log('🗺️ Setting up Places Autocomplete...');

                const autocompleteStreet = new google.maps.places.Autocomplete(streetInput, {
                    types: ['address'],
                    componentRestrictions: { country: 'au' },
                    fields: ['address_components', 'formatted_address', 'geometry']
                });

                autocompleteStreet.addListener('place_changed', () => {
                    const place = autocompleteStreet.getPlace();
                    if (place.address_components) {
                        this.handlePlaceSelection(place, 'street');
                    }
                });

                if (cityInput) {
                    const autocompleteCity = new google.maps.places.Autocomplete(cityInput, {
                        types: ['(cities)'],
                        componentRestrictions: { country: 'au' },
                        fields: ['address_components', 'formatted_address']
                    });

                    autocompleteCity.addListener('place_changed', () => {
                        const place = autocompleteCity.getPlace();
                        if (place.address_components) {
                            this.handlePlaceSelection(place, 'city');
                        }
                    });
                }

                this.placesInitialized = true;
                console.log('✅ Google Places Autocomplete initialized');
            }
        } catch (error) {
            console.error('❌ Error initializing Places Autocomplete:', error);
        }
    }

    async initializeStripe() {
        try {
            
            const stripeKey = window.CONFIG?.STRIPE_PUBLIC_KEY || 'pk_test_51S7tllFJQNwSoxeFQH0CQUybCTNMMKx5Bfr0PXKMGHvbayfe4VzBOMqVXlIjGae4ngo1uhLBO5gzUlFrqQduYluY00a9OfSq91';
            
            if (typeof Stripe !== 'undefined') {
                this.stripe = Stripe(stripeKey);
                console.log('✅ Stripe initialized');
            } else {
                console.warn('⚠️ Stripe.js not loaded');
            }
        } catch (error) {
            console.error('❌ Error initializing Stripe:', error);
        }
    }

    async init() {
        console.log('🔄 Initializing checkout page...');

        await this.loadCartSummary();

        if (this.cartIsEmpty) {
            console.log('🚫 Cart is empty, stopping checkout initialization');
            return;
        }

        this.updateAuthStatus();

        this.preFilFormFromLocalStorage();

        await this.loadCustomerInfo();

        this.setupEventListeners();

        this.setupFormValidation();

        setTimeout(() => {
            this.initializePlacesAutocomplete();
        }, 1000);
        
        console.log('✅ Checkout page initialized');
    }

    populateCustomerForm(data) {
        const { customerInfo, shippingAddress, savedAddresses } = data;
        
        console.log('📝 Populating form with API data:', { customerInfo, shippingAddress, savedAddresses });

        if (customerInfo) {
            const firstNameField = document.getElementById('firstName');
            const lastNameField = document.getElementById('lastName');
            const emailField = document.getElementById('email');
            const phoneField = document.getElementById('phone');

            if (firstNameField && customerInfo.firstName) {
                firstNameField.value = customerInfo.firstName;
                
                localStorage.setItem('userFirstName', customerInfo.firstName);
                this.userFirstName = customerInfo.firstName;
            }
            if (lastNameField && customerInfo.lastName) {
                lastNameField.value = customerInfo.lastName;
                localStorage.setItem('userLastName', customerInfo.lastName);
                this.userLastName = customerInfo.lastName;
            }
            if (emailField && customerInfo.email) {
                emailField.value = customerInfo.email;
                localStorage.setItem('userEmail', customerInfo.email);
                this.userEmail = customerInfo.email;
                
                if (this.isLoggedIn) {
                    emailField.readOnly = true;
                    emailField.style.backgroundColor = '#f8f9fa';
                }
            }
            if (phoneField && customerInfo.phone) {
                phoneField.value = customerInfo.phone;
                localStorage.setItem('userPhone', customerInfo.phone);
                this.userPhone = customerInfo.phone;
            }
        }

        if (shippingAddress) {
            const streetField = document.getElementById('street');
            const apartmentField = document.getElementById('apartment');
            const cityField = document.getElementById('city');
            const stateField = document.getElementById('state');
            const zipCodeField = document.getElementById('zipCode');
            const countryField = document.getElementById('country');
            
            if (streetField) streetField.value = shippingAddress.street || '';
            if (apartmentField) apartmentField.value = shippingAddress.apartmentSuite || '';
            if (cityField) cityField.value = shippingAddress.city || '';
            if (stateField) stateField.value = shippingAddress.state || '';
            if (zipCodeField) zipCodeField.value = shippingAddress.zipCode || '';
            if (countryField) countryField.value = shippingAddress.country || 'Australia';
        }

        if (savedAddresses && savedAddresses.length > 0) {
            console.log('🏠 Rendering saved addresses from checkout API:', savedAddresses.length);
            this.renderSavedAddresses(savedAddresses);
        } else {
            
            this.loadSavedAddresses();
        }

        setTimeout(() => {
            this.validateCustomerStep();
        }, 100);
    }

    async loadCartSummary() {
        const summaryLoading = document.getElementById('summary-loading');
        const cartItemsSummary = document.getElementById('cart-items-summary');
        const emptyCart = document.getElementById('empty-cart');
        const orderTotals = document.getElementById('order-totals');
        
        try {
            summaryLoading.style.display = 'block';
            cartItemsSummary.style.display = 'none';
            emptyCart.style.display = 'none';
            orderTotals.style.display = 'none';
            
            const headers = {};
            
            if (this.isLoggedIn) {
                headers['Authorization'] = `Bearer ${localStorage.getItem('authToken')}`;
            } else if (this.sessionId) {
                headers['x-session-id'] = this.sessionId;
            }
            
            const response = await fetch(`${this.API_BASE}/cart`, {
                headers,
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.cart && data.cart.items && data.cart.items.length > 0) {
                    this.cartIsEmpty = false;
                    this.renderCartSummary(data.cart);
                    
                    this.enableContinueButton();
                    
                    this.removeEmptyCartWarning();
                } else {
                    this.cartIsEmpty = true;
                    emptyCart.style.display = 'block';
                    
                    this.disableContinueButton();
                    
                    this.showEmptyCartWarning();
                }
            } else {
                throw new Error('Failed to load cart');
            }
        } catch (error) {
            console.error('Error loading cart summary:', error);
            this.cartIsEmpty = true;
            emptyCart.style.display = 'block';
            
            this.disableContinueButton();
        } finally {
            summaryLoading.style.display = 'none';
        }
    }

    extractUrl(val) {
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

    renderCartSummary(cart) {
        const cartItemsSummary = document.getElementById('cart-items-summary');
        const orderTotals = document.getElementById('order-totals');

        cartItemsSummary.innerHTML = '';
        
        cart.items.forEach(item => {
            const product = item.productId || {};
            const productName = product.name || 'Product';

            let productImage = '../assets/images/placeholder.png';
            if (product.images && Array.isArray(product.images) && product.images.length > 0) {
                const extractedUrl = this.extractUrl(product.images[0]);
                if (extractedUrl) {
                    
                    productImage = extractedUrl.startsWith('http') ? extractedUrl : `${this.API_BASE}${extractedUrl.startsWith('/') ? '' : '/'}${extractedUrl}`;
                }
            } else if (product.imageUrl) {
                const extractedUrl = this.extractUrl(product.imageUrl);
                if (extractedUrl) {
                    productImage = extractedUrl.startsWith('http') ? extractedUrl : `${this.API_BASE}${extractedUrl.startsWith('/') ? '' : '/'}${extractedUrl}`;
                }
            }
            
            const quantity = item.quantity || 1;
            const price = item.price || 0;
            const total = quantity * price;
            
            const itemEl = document.createElement('div');
            itemEl.className = 'cart-item-summary';
            itemEl.innerHTML = `
                <div class="cart-item-image">
                    <img src="${productImage}" alt="${productName}" onerror="this.src='../assets/images/placeholder.png'">
                </div>
                <div class="cart-item-details">
                    <div class="cart-item-name">${productName}</div>
                    <div class="cart-item-meta">Qty: ${quantity} × $${price.toFixed(2)}</div>
                </div>
                <div class="cart-item-price">$${total.toFixed(2)}</div>
            `;
            
            cartItemsSummary.appendChild(itemEl);
        });

        const subtotal = cart.subtotal || 0;
        const discount = cart.discount || 0;
        const total = cart.total || subtotal - discount;
        
        document.getElementById('subtotal-amount').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('grand-total-amount').textContent = `$${total.toFixed(2)}`;

        const taxAmountEl = document.getElementById('tax-amount');
        if (taxAmountEl) {
            taxAmountEl.textContent = 'Included';
        }

        const discountRow = document.getElementById('discount-row');
        if (discount > 0) {
            document.getElementById('discount-amount').textContent = `-$${discount.toFixed(2)}`;
            discountRow.style.display = 'flex';
        } else {
            discountRow.style.display = 'none';
        }

        cartItemsSummary.style.display = 'block';
        orderTotals.style.display = 'block';

        this.validateCustomerStep();
    }

    async loadSavedAddresses() {
        if (!this.isLoggedIn || !this.authToken) return;
        
        try {
            const response = await fetch(`${this.API_BASE}/users/addresses`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data && data.data.length > 0) {
                    console.log('🏠 Loaded addresses from user API:', data.data.length);

                    const mappedAddresses = data.data.map(addr => ({
                        _id: addr._id,
                        addressType: 'Address', 
                        street: addr.street || '',
                        apartmentSuite: addr.apartmentSuite || '',
                        suburb: addr.suburb || '',
                        city: addr.suburb || addr.city || '', 
                        state: addr.state || '',
                        zipCode: addr.zipCode || '',
                        country: addr.country || 'Australia',
                        isPrimary: addr.isPrimary || false
                    }));
                    
                    this.renderSavedAddresses(mappedAddresses);
                    console.log('✅ Loaded saved addresses:', mappedAddresses.length);
                } else {
                    
                    console.log('ℹ️ No saved addresses found');
                    this.renderSavedAddresses([]);
                }
            } else {
                console.warn('❌ Failed to load saved addresses:', response.status);
                
                this.renderSavedAddresses([]);
            }
        } catch (error) {
            console.error('Error loading saved addresses:', error);
            
            this.renderSavedAddresses([]);
        }
    }

    renderSavedAddresses(addresses) {
        const savedAddressesList = document.getElementById('saved-addresses-list');
        const savedAddressesContainer = document.getElementById('saved-addresses');
        const noSavedAddressesMsg = document.getElementById('no-saved-addresses');
        const addressFormContainer = document.getElementById('address-form-container');
        const addressSection = document.querySelector('.address-section');
        
        if (!savedAddressesList || !savedAddressesContainer) return;
        
        console.log('🏠 Rendering saved addresses:', addresses.length);

        // Ensure address section is always visible
        if (addressSection) {
            addressSection.style.display = 'block';
            addressSection.style.visibility = 'visible';
            addressSection.style.opacity = '1';
        }

        savedAddressesList.innerHTML = '';
        
        if (addresses.length > 0) {
            
            savedAddressesContainer.style.display = 'block';
            if (noSavedAddressesMsg) noSavedAddressesMsg.style.display = 'none';

            if (addressFormContainer) {
                addressFormContainer.style.display = 'none';
                addressFormContainer.classList.add('hidden');
                addressFormContainer.classList.remove('visible');
            }
            
            addresses.forEach((address, index) => {
                const addressEl = document.createElement('div');
                addressEl.className = 'saved-address-item';
                addressEl.dataset.addressId = address._id;

                const addressParts = [
                    address.street,
                    address.apartmentSuite,
                    address.suburb || address.city, 
                    address.state,
                    address.zipCode,
                    address.country
                ].filter(Boolean);
                
                const fullAddress = addressParts.join(', ');
                
                addressEl.innerHTML = `
                    <div class="saved-address-header">
                        <div class="address-type">Address</div>
                        ${address.isPrimary ? '<span class="primary-badge">Primary</span>' : ''}
                    </div>
                    <div class="address-text">${fullAddress}</div>
                `;

                addressEl.addEventListener('click', () => {
                    this.selectSavedAddress(address);
                });
                
                savedAddressesList.appendChild(addressEl);

                if ((address.isPrimary || index === 0) && !document.querySelector('.saved-address-item.selected')) {
                    setTimeout(() => {
                        addressEl.click();
                    }, 100);
                }
            });
        } else {
            
            savedAddressesContainer.style.display = 'none';
            if (noSavedAddressesMsg) noSavedAddressesMsg.style.display = 'block';
            if (addressFormContainer) {
                addressFormContainer.style.display = 'block';
                addressFormContainer.classList.add('visible');
                addressFormContainer.classList.remove('hidden');
            }
        }
        
        console.log('✅ Rendered saved addresses:', addresses.length);
    }

    selectSavedAddress(address) {
        console.log('🏠 Selecting saved address:', address);

        document.querySelectorAll('.saved-address-item').forEach(item => {
            item.classList.remove('selected');
        });

        const addressEl = document.querySelector(`[data-address-id="${address._id}"]`);
        if (addressEl) {
            addressEl.classList.add('selected');
        }

        const addressFormContainer = document.getElementById('address-form-container');
        if (addressFormContainer) {
            addressFormContainer.classList.add('hidden');
            addressFormContainer.classList.remove('visible');
        }

        const addNewBtn = document.getElementById('add-new-address-btn');
        if (addNewBtn) {
            addNewBtn.classList.remove('active');
            addNewBtn.innerHTML = '<i class="fas fa-plus"></i> Add New Address';
        }

        this.populateHiddenAddressFields(address);

        setTimeout(() => {
            this.validateCustomerStep();
        }, 50);
        
        console.log('✅ Address selected and form populated');
    }

    populateHiddenAddressFields(address) {
        
        this.setFieldValue('street', address.street || '');
        this.setFieldValue('apartment', address.apartmentSuite || '');

        const cityValue = address.suburb || address.city || '';
        this.setFieldValue('city', cityValue);
        
        this.setFieldValue('state', address.state || '');
        this.setFieldValue('zipCode', address.zipCode || '');
        this.setFieldValue('country', address.country || 'Australia');
    }

    enableContinueButton() {
        const continueBtn = document.getElementById('continue-to-shipping');
        if (continueBtn) {
            
            this.validateCustomerStep();
        }
    }

    disableContinueButton() {
        const continueBtn = document.getElementById('continue-to-shipping');
        if (continueBtn) {
            continueBtn.disabled = true;
            continueBtn.classList.add('disabled');
            continueBtn.classList.remove('enabled');
            continueBtn.title = 'Your cart is empty. Please add items to continue.';
        }
    }

    showEmptyCartWarning() {
        const customerSection = document.getElementById('customer-section');
        if (!customerSection) return;

        if (document.getElementById('empty-cart-warning')) return;
        
        const warningDiv = document.createElement('div');
        warningDiv.id = 'empty-cart-warning';
        warningDiv.className = 'form-message warning';
        warningDiv.innerHTML = `
            <span>Your cart is empty. Please <a href="user_products.html" style="color: inherit; text-decoration: underline; font-weight: 600;">add items</a> before proceeding to checkout.</span>
        `;

        const sectionContent = customerSection.querySelector('.section-content');
        if (sectionContent) {
            sectionContent.insertBefore(warningDiv, sectionContent.firstChild);
        }
    }

    removeEmptyCartWarning() {
        const warningDiv = document.getElementById('empty-cart-warning');
        if (warningDiv) {
            warningDiv.remove();
        }
    }

    setupEventListeners() {
        
        const continueBtn = document.getElementById('continue-to-shipping');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => this.handleContinueToShipping());
        }

        const addNewAddressBtn = document.getElementById('add-new-address-btn');
        if (addNewAddressBtn) {
            addNewAddressBtn.addEventListener('click', () => {
                this.showAddressForm();
            });
        }
    }

    showAddressForm() {
        console.log('📝 Showing address form for new address');

        this.clearAddressForm();
        document.querySelectorAll('.saved-address-item').forEach(item => {
            item.classList.remove('selected');
        });

        const addressFormContainer = document.getElementById('address-form-container');
        if (addressFormContainer) {
            addressFormContainer.style.display = 'block';
            addressFormContainer.classList.add('visible');
            addressFormContainer.classList.remove('hidden');
        }

        const addNewBtn = document.getElementById('add-new-address-btn');
        if (addNewBtn) {
            addNewBtn.classList.add('active');
            addNewBtn.innerHTML = '<i class="fas fa-edit"></i> Using New Address';
        }

        const firstField = document.getElementById('street');
        if (firstField) {
            setTimeout(() => {
                firstField.focus();
            }, 300); 
        }
        
        console.log('✅ Address form is now visible');
    }

    setupFormValidation() {
        
        const customerFields = ['firstName', 'lastName', 'email', 'phone'];
        customerFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                
                if (fieldId === 'firstName' || fieldId === 'lastName') {
                    field.addEventListener('keypress', (e) => {
                        
                        const char = String.fromCharCode(e.keyCode || e.which);
                        const regex = /^[a-zA-Z\s'-]$/;
                        if (!regex.test(char)) {
                            e.preventDefault();
                            
                            const errorEl = document.getElementById(`${fieldId}-error`);
                            if (errorEl) {
                                errorEl.textContent = 'Only letters are allowed';
                                errorEl.classList.add('show');
                                setTimeout(() => {
                                    if (field.value.trim()) {
                                        this.validateField(fieldId);
                                    } else {
                                        errorEl.classList.remove('show');
                                    }
                                }, 1500);
                            }
                        }
                    });
                }

                if (fieldId === 'phone') {
                    field.addEventListener('keypress', (e) => {
                        
                        const char = String.fromCharCode(e.keyCode || e.which);
                        if (!/^\d$/.test(char)) {
                            e.preventDefault();
                            
                            const errorEl = document.getElementById(`${fieldId}-error`);
                            if (errorEl) {
                                errorEl.textContent = 'Only numbers are allowed';
                                errorEl.classList.add('show');
                                setTimeout(() => {
                                    if (field.value.trim()) {
                                        this.validateField(fieldId);
                                    } else {
                                        errorEl.classList.remove('show');
                                    }
                                }, 1500);
                            }
                        }
                    });

                    field.addEventListener('input', (e) => {
                        let value = field.value.replace(/\D/g, ''); 
                        if (value.length > 10) {
                            value = value.slice(0, 10); 
                        }
                        field.value = value;
                    });
                }
                
                field.addEventListener('input', () => {
                    this.validateField(fieldId);
                    this.validateCustomerStep();
                });
                field.addEventListener('blur', () => {
                    this.validateField(fieldId);
                    this.validateCustomerStep();
                });
                field.addEventListener('change', () => {
                    this.validateField(fieldId);
                    this.validateCustomerStep();
                });
            }
        });

        const addressFields = ['street', 'city', 'state', 'zipCode'];
        addressFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('input', () => {
                    this.validateField(fieldId);
                    this.validateCustomerStep();
                });
                field.addEventListener('blur', () => {
                    this.validateField(fieldId);
                    this.validateCustomerStep();
                });
                field.addEventListener('change', () => {
                    this.validateField(fieldId);
                    this.validateCustomerStep();
                });
            }
        });
    }

    validateField(fieldId) {
        const field = document.getElementById(fieldId);
        const errorEl = document.getElementById(`${fieldId}-error`);
        
        if (!field || !errorEl) return true;
        
        let isValid = true;
        let errorMessage = '';
        
        const value = field.value.trim();
        
        switch (fieldId) {
            case 'firstName':
            case 'lastName':
                
                const nameRegex = /^[a-zA-Z\s'-]+$/;
                if (!value) {
                    isValid = false;
                    errorMessage = 'This field is required';
                } else if (value.length < 2) {
                    isValid = false;
                    errorMessage = 'Must be at least 2 characters';
                } else if (!nameRegex.test(value)) {
                    isValid = false;
                    errorMessage = 'Name should only contain letters';
                } else if (/\d/.test(value)) {
                    isValid = false;
                    errorMessage = 'Name cannot contain numbers';
                } else if (/[^a-zA-Z\s'-]/.test(value)) {
                    isValid = false;
                    errorMessage = 'Name contains invalid special characters';
                }
                break;
                
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!value) {
                    isValid = false;
                    errorMessage = 'Email is required';
                } else if (!emailRegex.test(value)) {
                    isValid = false;
                    errorMessage = 'Please enter a valid email address';
                }
                break;
                
            case 'phone':
                
                const phoneRegex = /^\d{10}$/;
                const cleanPhone = value.replace(/[\s()-]/g, ''); 
                
                if (!value) {
                    isValid = false;
                    errorMessage = 'Phone number is required';
                } else if (!/^\d+$/.test(cleanPhone)) {
                    isValid = false;
                    errorMessage = 'Phone number should only contain digits';
                } else if (cleanPhone.length !== 10) {
                    isValid = false;
                    errorMessage = 'Phone number must be exactly 10 digits';
                } else if (!phoneRegex.test(cleanPhone)) {
                    isValid = false;
                    errorMessage = 'Please enter a valid 10-digit phone number';
                }

                if (isValid && cleanPhone !== value) {
                    field.value = cleanPhone;
                }
                break;
                
            case 'street':
            case 'city':
            case 'state':
            case 'zipCode':
                if (!value) {
                    isValid = false;
                    errorMessage = 'This field is required';
                }
                break;
        }

        if (isValid) {
            field.classList.remove('error');
            field.classList.remove('input-error');
            
            errorEl.textContent = '';
            errorEl.classList.remove('show');
        } else {
            field.classList.add('error');
            field.classList.add('input-error');
            errorEl.textContent = errorMessage;
            errorEl.classList.add('show');
        }
        
        return isValid;
    }

    validateCustomerStep() {
        const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'street', 'city', 'state', 'zipCode'];
        let allValid = true;
        
        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field && !field.value.trim()) {
                allValid = false;
            }
        });

        if (this.cartIsEmpty) {
            allValid = false;
        }

        const continueBtn = document.getElementById('continue-to-shipping');
        if (continueBtn) {
            continueBtn.disabled = !allValid;

            if (allValid) {
                continueBtn.classList.remove('disabled');
                continueBtn.classList.add('enabled');
                continueBtn.title = '';
            } else {
                continueBtn.classList.add('disabled');
                continueBtn.classList.remove('enabled');
                if (this.cartIsEmpty) {
                    continueBtn.title = 'Your cart is empty. Please add items to continue.';
                }
            }
        }
        
        console.log('🔍 Form validation result:', { allValid, cartIsEmpty: this.cartIsEmpty, requiredFields: requiredFields.length });
        
        return allValid;
    }

    async handleContinueToShipping() {
        
        if (this.cartIsEmpty) {
            this.showMessage('Your cart is empty. Please add items before proceeding.', 'error');
            return;
        }

        const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'street', 'city', 'state', 'zipCode'];
        let allValid = true;
        
        requiredFields.forEach(fieldId => {
            if (!this.validateField(fieldId)) {
                allValid = false;
            }
        });
        
        if (!allValid) {
            this.showMessage('Please correct the errors above', 'error');
            return;
        }

        const continueBtn = document.getElementById('continue-to-shipping');
        const originalText = continueBtn.innerHTML;
        continueBtn.disabled = true;
        continueBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        try {
            
            const customerInfo = {
                firstName: document.getElementById('firstName').value.trim(),
                lastName: document.getElementById('lastName').value.trim(),
                email: document.getElementById('email').value.trim(),
                phone: document.getElementById('phone').value.trim()
            };
            
            const shippingAddress = {
                street: document.getElementById('street').value.trim(),
                apartmentSuite: document.getElementById('apartment').value.trim(),
                city: document.getElementById('city').value.trim(),
                state: document.getElementById('state').value.trim(),
                zipCode: document.getElementById('zipCode').value.trim(),
                country: document.getElementById('country').value.trim()
            };

            const saveAddress = document.getElementById('save-address')?.checked || false;

            console.log('💾 Saving customer information and address...');
            const result = await this.saveCustomerInfo({ 
                customerInfo, 
                shippingAddress,
                saveAddress: this.isLoggedIn ? saveAddress : false
            });
            
            console.log('✅ Customer information saved:', result);

            if (this.isLoggedIn) {
                await this.updateUserProfile(customerInfo);
            }

            this.markStepCompleted('customer');

            this.showShippingSection();

            this.showMessage('✅ Information saved successfully! Please select your shipping option.', 'success');
            
        } catch (error) {
            console.error('❌ Error saving customer information:', error);
            this.showMessage(`Failed to save information: ${error.message}`, 'error');
        } finally {
            
            continueBtn.disabled = false;
            continueBtn.innerHTML = originalText;
        }
    }

    async updateUserProfile(customerInfo) {
        if (!this.isLoggedIn || !this.authToken) {
            console.log('ℹ️ User not logged in, skipping profile update');
            return;
        }
        
        try {
            console.log('👤 Updating user profile with customer info...');
            
            const response = await fetch(`${this.API_BASE}/users/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                credentials: 'include',
                body: JSON.stringify({
                    firstName: customerInfo.firstName,
                    lastName: customerInfo.lastName,
                    phone: customerInfo.phone
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to update profile');
            }
            
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Failed to update profile');
            }

            localStorage.setItem('userFirstName', customerInfo.firstName);
            localStorage.setItem('userLastName', customerInfo.lastName);
            localStorage.setItem('userPhone', customerInfo.phone);

            this.userFirstName = customerInfo.firstName;
            this.userLastName = customerInfo.lastName;
            this.userPhone = customerInfo.phone;
            
            console.log('✅ User profile updated successfully');

            const profileUpdateEvent = new CustomEvent('profileUpdated', { 
                detail: { 
                    firstName: customerInfo.firstName, 
                    lastName: customerInfo.lastName, 
                    phone: customerInfo.phone 
                } 
            });
            document.dispatchEvent(profileUpdateEvent);
            
        } catch (error) {
            console.error('❌ Error updating user profile:', error);
            
            console.log('⚠️ Profile update failed, but continuing checkout process');
        }
    }

    markStepCompleted(stepName) {
        const stepEl = document.querySelector(`.progress-step[data-step="${stepName}"]`);
        if (stepEl) {
            stepEl.classList.add('completed');
            stepEl.classList.remove('active');

            const stepNumber = stepEl.querySelector('.step-number');
            if (stepNumber && !stepNumber.querySelector('.fa-check')) {
                stepNumber.innerHTML = '<i class="fas fa-check"></i>';
            }
        }
        
        console.log(`✅ Step "${stepName}" marked as completed`);
    }

    activateStep(stepName) {
        
        document.querySelectorAll('.progress-step').forEach(step => {
            step.classList.remove('active');
        });

        const stepEl = document.querySelector(`.progress-step[data-step="${stepName}"]`);
        if (stepEl) {
            stepEl.classList.add('active');
        }
        
        this.currentStep = stepName;
        console.log(`🎯 Step "${stepName}" activated`);
    }

    showShippingSection() {
        console.log('🚚 showShippingSection called');
        
        const customerSection = document.getElementById('customer-section');
        if (customerSection) {
            customerSection.style.display = 'none';
            console.log('✅ Customer section hidden');
        }

        const paymentSection = document.getElementById('payment-section');
        if (paymentSection) {
            paymentSection.style.display = 'none';
            console.log('✅ Payment section hidden');
        }

        const shippingSection = document.getElementById('shipping-section');
        console.log('🔍 Shipping section element:', shippingSection);
        
        if (shippingSection) {
            shippingSection.style.display = 'block';
            console.log('✅ Shipping section display set to block');

            const sectionContent = shippingSection.querySelector('.section-content');
            console.log('🔍 Section content element:', sectionContent);
            console.log('📄 Current innerHTML:', sectionContent?.innerHTML);
            console.log('📏 innerHTML length:', sectionContent?.innerHTML?.length);
            console.log('🧹 Trimmed innerHTML:', sectionContent?.innerHTML?.trim());
            
            // Always populate the shipping section (it should be empty on first load)
            if (sectionContent) {
                const trimmedContent = sectionContent.innerHTML.trim();
                const hasShippingOptions = sectionContent.querySelector('.shipping-options');
                
                // Populate if content is empty, only has whitespace, or doesn't have shipping options yet
                if (!hasShippingOptions || trimmedContent === '' || trimmedContent.length < 50) {
                    console.log('✅ Populating shipping section');
                    this.populateShippingSection(sectionContent);
                } else {
                    console.log('ℹ️ Shipping content already exists');
                }
            } else {
                console.error('❌ Section content element not found!');
            }
        } else {
            console.error('❌ Shipping section element not found!');
        }

        this.activateStep('shipping');

        if (shippingSection) {
            shippingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        console.log('🚚 Shipping section displayed');
    }

    async populateShippingSection(container) {
        console.log('🚚 populateShippingSection called, container:', container);
        
        try {
            
            const zipCode = document.getElementById('zipCode')?.value || '';
            const state = document.getElementById('state')?.value || '';
            
            console.log('📍 Address data:', { zipCode, state });
            
            if (!zipCode || !state) {
                console.log('⚠️ Missing zipCode or state, using basic HTML');
                container.innerHTML = this.getBasicShippingHTML();
                this.setupShippingEventListeners();
                return;
            }

            const cartTotal = this.getCartTotal();
            console.log('💰 Cart total:', cartTotal);

            const shippingData = await this.calculateShipping(zipCode, state, cartTotal);
            console.log('📦 Shipping data received:', shippingData);
            
            if (shippingData.success) {
                container.innerHTML = this.getDynamicShippingHTML(shippingData);
                console.log('✅ Dynamic shipping HTML set');
            } else {
                container.innerHTML = this.getBasicShippingHTML();
                console.log('✅ Basic shipping HTML set');
                this.showMessage('Unable to calculate shipping rates. Standard rates will apply.', 'warning');
            }
            
        } catch (error) {
            console.error('❌ Error populating shipping section:', error);
            container.innerHTML = this.getBasicShippingHTML();
            console.log('✅ Basic shipping HTML set (error fallback)');
        }

        this.updateShippingAddressDisplay();

        this.setupShippingEventListeners();
        
        console.log('🎉 Shipping section population complete');
    }

    async calculateShipping(postcode, state, cartTotal) {
        try {
            const response = await fetch(`${this.API_BASE}/shipping/calculate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    postcode: postcode,
                    state: state,
                    cartTotal: cartTotal
                })
            });
            
            return await response.json();
        } catch (error) {
            console.error('Error calculating shipping:', error);
            return { success: false };
        }
    }

    getCartTotal() {
        const subtotalEl = document.getElementById('subtotal-amount');
        if (subtotalEl) {
            const subtotalText = subtotalEl.textContent.replace('$', '');
            return parseFloat(subtotalText) || 0;
        }
        return 0;
    }

    getDynamicShippingHTML(shippingData) {
        const { shippingOptions, qualifiesForFreeShipping, freeShippingThreshold } = shippingData;
        
        let freeShippingMessage = '';
        if (qualifiesForFreeShipping) {
            freeShippingMessage = '<div class="free-shipping-message success">🎉 You qualify for free shipping!</div>';
        } else {
            const needed = freeShippingThreshold - shippingData.cartTotal;
            freeShippingMessage = `
                <div class="free-shipping-message warning">
                    <div class="free-shipping-icon">⚠️</div>
                    <div class="free-shipping-text">
                        Add <span class="amount-needed">$${needed.toFixed(2)}</span> more to qualify for <strong>free shipping!</strong>
                    </div>
                </div>`;
        }
        
        const shippingOptionsHTML = shippingOptions.map((option, index) => `
            <div class="shipping-option" data-method="${option.method}">
                <div class="shipping-option-header">
                    <input type="radio" id="shipping-${option.method}" name="shipping" value="${option.method}" ${index === 0 ? 'checked' : ''} data-price="${option.price}">
                    <label for="shipping-${option.method}">
                        <div class="shipping-method">
                            <i class="fas ${this.getShippingIcon(option.method)}"></i>
                            <div class="shipping-details">
                                <h4>${option.name}</h4>
                                <p>Estimated delivery: ${this.formatDate(option.estimatedDelivery)}</p>
                            </div>
                        </div>
                        <div class="shipping-price">${option.price === 0 ? 'Free' : `$${option.price.toFixed(2)}`}</div>
                    </label>
                </div>
            </div>
        `).join('');
        
        return `
            <div class="shipping-options">                
                ${freeShippingMessage}
                <div class="shipping-destination">
                    <i class="fas fa-map-marker-alt"></i>
                    <span id="shipping-destination-display">Loading address...</span>
                </div>
                
                <div class="shipping-option-list">
                    ${shippingOptionsHTML}
                </div>
                
                <div class="section-actions">
                    <button type="button" id="back-to-customer" class="btn secondary-btn">
                        <i class="fas fa-arrow-left"></i> Back to Customer Info
                    </button>
                    <button type="button" id="continue-to-payment" class="btn primary-btn">
                        Continue to Payment <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    getBasicShippingHTML() {
        return `
            <div class="shipping-options">
                <h3>Select Shipping Method</h3>
                <p>Choose your preferred delivery option:</p>
                
                <div class="shipping-destination">
                    <i class="fas fa-map-marker-alt"></i>
                    <span id="shipping-destination-display">Loading address...</span>
                </div>
                
                <div class="shipping-option-list">
                    <div class="shipping-option" data-method="standard">
                        <div class="shipping-option-header">
                            <input type="radio" id="shipping-standard" name="shipping" value="standard" checked data-price="0">
                            <label for="shipping-standard">
                                <div class="shipping-method">
                                    <i class="fas fa-truck"></i>
                                    <div class="shipping-details">
                                        <h4>Standard Shipping</h4>
                                        <p>5-7 business days</p>
                                    </div>
                                </div>
                                <div class="shipping-price">Free</div>
                            </label>
                        </div>
                    </div>
                    
                    <div class="shipping-option" data-method="express">
                        <div class="shipping-option-header">
                            <input type="radio" id="shipping-express" name="shipping" value="express" data-price="12.95">
                            <label for="shipping-express">
                                <div class="shipping-method">
                                    <i class="fas fa-shipping-fast"></i>
                                    <div class="shipping-details">
                                        <h4>Express Shipping</h4>
                                        <p>2-3 business days</p>
                                    </div>
                                </div>
                                <div class="shipping-price">$12.95</div>
                            </label>
                        </div>
                    </div>
                    
                    <div class="shipping-option" data-method="overnight">
                        <div class="shipping-option-header">
                            <input type="radio" id="shipping-overnight" name="shipping" value="overnight" data-price="24.95">
                            <label for="shipping-overnight">
                                <div class="shipping-method">
                                    <i class="fas fa-bolt"></i>
                                    <div class="shipping-details">
                                        <h4>Overnight Shipping</h4>
                                        <p>Next business day</p>
                                    </div>
                                </div>
                                <div class="shipping-price">$24.95</div>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="section-actions">
                    <button type="button" id="back-to-customer" class="btn secondary-btn">
                        <i class="fas fa-arrow-left"></i> Back to Customer Info
                    </button>
                    <button type="button" id="continue-to-payment" class="btn primary-btn">
                        Continue to Payment <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    getShippingIcon(method) {
        const icons = {
            'standard': 'fa-truck',
            'express': 'fa-shipping-fast',
            'overnight': 'fa-bolt'
        };
        return icons[method] || 'fa-truck';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-AU', { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric' 
        });
    }

    updateShippingCosts() {
        const selectedShipping = document.querySelector('input[name="shipping"]:checked');
        if (!selectedShipping) return;
        
        const shippingAmountEl = document.getElementById('shipping-amount');
        if (!shippingAmountEl) return;
        
        const shippingCost = parseFloat(selectedShipping.dataset.price) || 0;
        const shippingText = shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`;
        
        shippingAmountEl.textContent = shippingText;

        const subtotalEl = document.getElementById('subtotal-amount');
        const grandTotalEl = document.getElementById('grand-total-amount');
        const discountEl = document.getElementById('discount-amount');
        
        if (subtotalEl && grandTotalEl) {
            const subtotal = parseFloat(subtotalEl.textContent.replace('$', '')) || 0;
            const discount = discountEl ? parseFloat(discountEl.textContent.replace(/[$-]/g, '')) || 0 : 0;
            const total = subtotal + shippingCost - discount;
            
            grandTotalEl.textContent = `$${total.toFixed(2)}`;
        }
        
        console.log(`🚚 Shipping method updated: ${selectedShipping.value} ($${shippingCost})`);
    }

    async saveCustomerInfo(data) {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.isLoggedIn && this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        } else if (this.sessionId) {
            headers['x-session-id'] = this.sessionId;
        }
        
        const response = await fetch(`${this.API_BASE}/checkout/customer-info`, {
            method: 'PUT',
            headers,
            credentials: 'include',
            body: JSON.stringify(data)
        });

        const backendSessionId = response.headers.get('X-Session-ID');
        if (backendSessionId && backendSessionId !== this.sessionId) {
            this.sessionId = backendSessionId;
            localStorage.setItem('cartSessionId', backendSessionId);
        }
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to save customer information');
        }
        
        return result;
    }

    async saveShippingMethod(shippingData) {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.isLoggedIn && this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        } else if (this.sessionId) {
            headers['x-session-id'] = this.sessionId;
        }
        
        const response = await fetch(`${this.API_BASE}/checkout/shipping-method`, {
            method: 'PUT',
            headers,
            credentials: 'include',
            body: JSON.stringify(shippingData)
        });

        const backendSessionId = response.headers.get('X-Session-ID');
        if (backendSessionId && backendSessionId !== this.sessionId) {
            this.sessionId = backendSessionId;
            localStorage.setItem('cartSessionId', backendSessionId);
        }
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to save shipping method');
        }
        
        return result;
    }

    clearAddressForm() {
        const addressFields = ['street', 'apartment', 'city', 'state', 'zipCode'];
        addressFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = '';
                field.classList.remove('error');
            }
            
            const errorEl = document.getElementById(`${fieldId}-error`);
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.classList.remove('show');
            }
        });

        const countryField = document.getElementById('country');
        if (countryField) {
            countryField.value = 'Australia';
        }
        
        this.validateCustomerStep();
    }

    showMessage(message, type = 'info') {
        const messageEl = document.getElementById('customer-global-message');
        if (!messageEl) return;
        
        messageEl.textContent = message;
        messageEl.className = `form-message ${type}`;
        messageEl.style.display = 'block';

        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 5000);
        }

        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    updateShippingAddressDisplay() {
        const displayEl = document.getElementById('shipping-destination-display');
        if (!displayEl) return;
        
        const street = document.getElementById('street')?.value || '';
        const apartment = document.getElementById('apartment')?.value || '';
        const city = document.getElementById('city')?.value || '';
        const state = document.getElementById('state')?.value || '';
        const zipCode = document.getElementById('zipCode')?.value || '';
        const country = document.getElementById('country')?.value || 'Australia';
        
        const addressParts = [
            street,
            apartment,
            city,
            state,
            zipCode,
            country
        ].filter(Boolean);

        displayEl.textContent = addressParts.join(', ');
    }

    setupShippingEventListeners() {
        
        const backBtn = document.getElementById('back-to-customer');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.showCustomerSection();
            });
        }

        const changeAddressBtn = document.getElementById('change-address-btn');
        if (changeAddressBtn) {
            changeAddressBtn.addEventListener('click', () => {
                this.showCustomerSection();
            });
        }

        const continueBtn = document.getElementById('continue-to-payment');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                this.handleContinueToPayment();
            });
        }

        const shippingOptions = document.querySelectorAll('input[name="shipping"]');
        shippingOptions.forEach(option => {
            option.addEventListener('change', () => {
                this.updateShippingCosts();
            });
        });

        this.updateShippingCosts();
    }

    showCustomerSection() {
        
        const shippingSection = document.getElementById('shipping-section');
        if (shippingSection) {
            shippingSection.style.display = 'none';
        }

        const customerSection = document.getElementById('customer-section');
        if (customerSection) {
            customerSection.style.display = 'block';
        }

        const customerStep = document.querySelector('.progress-step[data-step="customer"]');
        if (customerStep) {
            customerStep.classList.remove('completed');
            customerStep.classList.add('active');

            const stepNumber = customerStep.querySelector('.step-number');
            if (stepNumber) {
                stepNumber.innerHTML = '1';
            }
        }

        const shippingStep = document.querySelector('.progress-step[data-step="shipping"]');
        if (shippingStep) {
            shippingStep.classList.remove('active');
        }
        
        this.currentStep = 'customer';

        console.log('🔄 Refreshing customer data...');
        this.loadCustomerInfo();
        if (this.isLoggedIn) {
            this.loadSavedAddresses();
        }

        if (customerSection) {
            customerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        console.log('👤 Returned to customer section with refreshed data');
    }

    async handleContinueToPayment() {
        
        if (this.cartIsEmpty) {
            this.showMessage('Your cart is empty. Please add items before proceeding.', 'error');
            return;
        }
        
        const selectedShipping = document.querySelector('input[name="shipping"]:checked');
        if (!selectedShipping) {
            this.showMessage('Please select a shipping method', 'error');
            return;
        }

        const continueBtn = document.getElementById('continue-to-payment');
        const originalText = continueBtn.innerHTML;
        continueBtn.disabled = true;
        continueBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        try {
            
            const shippingData = {
                shippingMethod: selectedShipping.value,
                shippingCost: parseFloat(selectedShipping.dataset.price) || 0
            };
            
            console.log('💾 Saving shipping method to checkout...');
            const result = await this.saveShippingMethod(shippingData);
            
            console.log('✅ Shipping method saved:', result);

            this.markStepCompleted('shipping');

            this.showPaymentSection();
            
        } catch (error) {
            console.error('❌ Error saving shipping method:', error);
            this.showMessage(`Failed to save shipping method: ${error.message}`, 'error');
        } finally {
            
            continueBtn.disabled = false;
            continueBtn.innerHTML = originalText;
        }
    }

    showPaymentSection() {
        
        const shippingSection = document.getElementById('shipping-section');
        if (shippingSection) {
            shippingSection.style.display = 'none';
        }

        const paymentSection = document.getElementById('payment-section');
        if (paymentSection) {
            paymentSection.style.display = 'block';

            const sectionContent = paymentSection.querySelector('.section-content');
            // Populate if content is empty or contains placeholder text
            if (sectionContent && (sectionContent.innerHTML.trim() === '' || sectionContent.innerHTML.includes('will be implemented'))) {
                this.populatePaymentSection(sectionContent);
            }
        }

        this.activateStep('payment');

        if (paymentSection) {
            paymentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        console.log('💳 Payment section displayed');
    }

    async populatePaymentSection(container) {
        try {
            
            container.innerHTML = `
                <div class="payment-loading">
                    <div class="spinner"></div>
                    <p>Setting up secure payment...</p>
                </div>
            `;
            
            if (!this.stripe) {
                throw new Error('Stripe not initialized');
            }

            const sessionData = await this.createStripeSession();
            
            if (!sessionData.success) {
                throw new Error(sessionData.message || 'Failed to create payment session');
            }

            this.stripeSessionId = sessionData.sessionId;
            this.clientSecret = sessionData.clientSecret;

            container.innerHTML = this.getPaymentHTML();

            const elements = this.stripe.elements({
                clientSecret: this.clientSecret,
                appearance: {
                    theme: 'stripe',
                    variables: {
                        colorPrimary: '#3b82f6',
                        colorBackground: '#ffffff',
                        colorText: '#1f2937',
                        colorDanger: '#dc2626',
                        fontFamily: 'system-ui, sans-serif',
                        spacingUnit: '8px',
                        borderRadius: '6px',
                    }
                }
            });

            const paymentElement = elements.create('payment');
            paymentElement.mount('#stripe-payment-element');

            this.elements = elements;

            this.setupPaymentEventListeners();
            
            console.log('✅ Payment section populated with Stripe');
            
        } catch (error) {
            console.error('❌ Error setting up payment:', error);
            container.innerHTML = this.getPaymentErrorHTML(error.message);
        }
    }

    async createStripeSession() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.isLoggedIn && this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        } else if (this.sessionId) {
            headers['x-session-id'] = this.sessionId;
        }
        
        const response = await fetch(`${this.API_BASE}/payment/create-checkout-session`, {
            method: 'POST',
            headers,
            credentials: 'include'
        });

        const backendSessionId = response.headers.get('X-Session-ID');
        if (backendSessionId && backendSessionId !== this.sessionId) {
            this.sessionId = backendSessionId;
            localStorage.setItem('cartSessionId', backendSessionId);
        }
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to create payment session');
        }
        
        return result;
    }

    getPaymentHTML() {
        return `
            <div class="payment-options">
                <!-- Stripe Payment Form -->
                <form id="stripe-payment-form">
                    <div class="payment-method-section">
                        <h4>Payment Method</h4>
                        <p class="payment-description">All transactions are secure and encrypted</p>
                        <div id="stripe-payment-element" class="stripe-payment-element">
                            <!-- Stripe Payment Element will be mounted here -->
                        </div>
                        <div id="stripe-payment-errors" class="payment-errors"></div>
                    </div>
                    
                    <div class="section-actions">
                        <button type="button" id="back-to-shipping" class="btn secondary-btn">
                            <i class="fas fa-arrow-left"></i> Back to Shipping
                        </button>
                        <button type="submit" id="pay-now-btn" class="btn primary-btn payment-btn">
                            <i class="fas fa-spinner fa-spin" id="payment-spinner" style="display: none;"></i>
                            <i class="fas fa-lock"></i>
                            <span id="pay-button-text">Pay now</span>
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    getPaymentErrorHTML(error) {
        return `
            <div class="payment-error">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3>Payment Setup Error</h3>
                <p>${error}</p>
                <button type="button" onclick="location.reload()" class="btn primary-btn">
                    Try Again
                </button>
            </div>
        `;
    }

    setupPaymentEventListeners() {
        
        const backBtn = document.getElementById('back-to-shipping');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.showShippingSection();
            });
        }

        const paymentForm = document.getElementById('stripe-payment-form');
        if (paymentForm) {
            paymentForm.addEventListener('submit', (e) => {
                this.handlePaymentSubmit(e);
            });
        }

        this.updatePaymentSummary();
    }

    async handlePaymentSubmit(e) {
        e.preventDefault();

        if (this.cartIsEmpty) {
            this.showPaymentError('Your cart is empty. Please add items before proceeding.');
            return;
        }
        
        if (!this.stripe || !this.elements || !this.clientSecret) {
            this.showPaymentError('Payment system not initialized');
            return;
        }

        this.setPaymentLoading(true);
        
        try {
            console.log('💳 Processing payment...');

            const { error: submitError } = await this.elements.submit();
            if (submitError) {
                console.error('❌ Elements submission failed:', submitError);
                this.showPaymentError(submitError.message);
                this.setPaymentLoading(false);
                return;
            }
            
            console.log('✅ Elements submitted successfully');

            const customerEmail = document.getElementById('email')?.value || this.userEmail;

            const { error } = await this.stripe.confirmPayment({
                elements: this.elements,
                clientSecret: this.clientSecret,
                confirmParams: {
                    return_url: `${window.location.origin}/user_checkout_success.html`,
                    receipt_email: customerEmail,
                }
            });
            
            if (error) {
                
                console.error('❌ Payment failed:', error);
                this.showPaymentError(error.message);
                this.setPaymentLoading(false);
            } else {
                
                console.log('✅ Payment initiated successfully');
            }
            
        } catch (error) {
            console.error('❌ Payment error:', error);
            this.showPaymentError(error.message);
            this.setPaymentLoading(false);
        }
    }

    updatePaymentSummary() {

        console.log('💰 Payment summary is displayed in order summary sidebar');
    }

    showPaymentError(message) {
        const errorEl = document.getElementById('stripe-payment-errors');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';

            setTimeout(() => {
                errorEl.style.display = 'none';
            }, 5000);
        }
    }

    setPaymentLoading(isLoading) {
        const payButton = document.getElementById('pay-now-btn');
        const spinner = document.getElementById('payment-spinner');
        const buttonText = document.getElementById('pay-button-text');
        
        if (payButton) {
            payButton.disabled = isLoading;
        }
        
        if (spinner) {
            spinner.style.display = isLoading ? 'inline-block' : 'none';
        }
        
        if (buttonText) {
            buttonText.textContent = isLoading ? 'Processing...' : 'Pay now';
        }
    }

    static init() {
        document.addEventListener('DOMContentLoaded', () => {
            window.checkoutManager = new CheckoutManager();
        });
    }
}

CheckoutManager.init();

window.initAutocomplete = function() {
    console.log('🗺️ Google Places API loaded');
    
};
