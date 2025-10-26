document.addEventListener('DOMContentLoaded', function() {
    
    const API_URL = window.CONFIG?.API_URL || '/api';

    const guestPrompt = document.getElementById('guest-prompt');
    const myOrdersSection = document.getElementById('my-orders-section');
    const orderIdInput = document.getElementById('order-id-input');
    const searchOrderBtn = document.getElementById('search-order-btn');
    const ordersListContainer = document.getElementById('orders-list-container');
    const ordersLoading = document.getElementById('orders-loading');
    const ordersEmpty = document.getElementById('orders-empty');
    const ordersError = document.getElementById('orders-error');
    const ordersErrorMessage = document.getElementById('orders-error-message');
    const retryOrdersBtn = document.getElementById('retry-orders-btn');
    const selectedOrderSection = document.getElementById('selected-order-section');
    const selectedOrderCard = document.getElementById('selected-order-card');
    const changeOrderBtn = document.getElementById('change-order-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    const installationDateInput = document.getElementById('installation-date');
    const installationTimeSelect = document.getElementById('installation-time');
    const bookingForm = document.getElementById('booking-form');
    const submitBookingBtn = document.getElementById('submit-booking-btn');
    const customerNameInput = document.getElementById('customer-name');
    const customerEmailInput = document.getElementById('customer-email');
    const customerPhoneInput = document.getElementById('customer-phone');
    const installationAddressInput = document.getElementById('installation-address');
    const datetimeError = document.getElementById('datetime-error');
    const datetimeErrorMessage = document.getElementById('datetime-error-message');
    const customerDetailsError = document.getElementById('customer-details-error');
    const customerDetailsErrorMessage = document.getElementById('customer-details-error-message');

    let currentUser = null;
    let userOrders = [];
    let selectedOrder = null;
    let autocomplete = null;

    function init() {
        checkAuthStatus();
        setupEventListeners();

        if (currentUser) {
            if (myOrdersSection) {
                myOrdersSection.style.display = 'block';
            }
            loadUserOrders();
        }

        if (currentUser) {
            prefillCustomerDetails();
        }
    }

    function checkAuthStatus() {
        const authToken = localStorage.getItem('authToken');
        const userEmail = localStorage.getItem('userEmail');
        const userFirstName = localStorage.getItem('userFirstName');
        const userLastName = localStorage.getItem('userLastName');

        if (authToken && userEmail) {
            currentUser = {
                token: authToken,
                email: userEmail,
                firstName: userFirstName || 'User',
                lastName: userLastName || ''
            };
            
            console.log('✅ User is logged in:', currentUser.email);

            if (guestPrompt) {
                guestPrompt.style.display = 'none';
            }
        } else {
            console.log('👤 Guest user detected');

            if (guestPrompt) {
                guestPrompt.style.display = 'flex';
            }
        }
    }

    function setupEventListeners() {
        
        searchOrderBtn.addEventListener('click', handleOrderSearch);
        orderIdInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleOrderSearch();
            }
        });

        orderIdInput.addEventListener('input', updateSearchButtonState);
        updateSearchButtonState();

        if (retryOrdersBtn) {
            retryOrdersBtn.addEventListener('click', loadUserOrders);
        }

        if (changeOrderBtn) {
            changeOrderBtn.addEventListener('click', handleChangeOrder);
        }

        if (bookingForm) {
            bookingForm.addEventListener('submit', handleBookingSubmit);
        }

        if (installationDateInput) {
            const today = new Date();
            today.setDate(today.getDate() + 2); 
            const minDate = today.toISOString().split('T')[0];
            installationDateInput.setAttribute('min', minDate);
        }

        if (customerPhoneInput) {
            customerPhoneInput.addEventListener('input', function(e) {
                
                this.value = this.value.replace(/[^0-9]/g, '');
                
                if (this.value.length > 10) {
                    this.value = this.value.slice(0, 10);
                }
            });
        }
    }

    function updateSearchButtonState() {
        const orderId = orderIdInput.value.trim();
        searchOrderBtn.disabled = !orderId;
    }

    async function handleOrderSearch() {
        const orderId = orderIdInput.value.trim();
        
        if (!orderId) {
            showError('Please enter an Order ID');
            return;
        }

        console.log('🔍 Searching for order:', orderId);

        const noResults = document.getElementById('no-results');
        const alreadyBooked = document.getElementById('already-booked');
        if (noResults) {
            noResults.style.display = 'none';
        }
        if (alreadyBooked) {
            alreadyBooked.style.display = 'none';
        }

        showLoadingOverlay();

        try {
            const order = await searchOrderById(orderId);

            if (order) {
                
                if (order.installationBooked) {
                    hideLoadingOverlay();
                    
                    if (alreadyBooked) {
                        alreadyBooked.style.display = 'flex';
                    }
                    return;
                }

                selectedOrder = order;
                displaySelectedOrder(order);
                hideLoadingOverlay();
            } else {
                hideLoadingOverlay();
                
                if (noResults) {
                    noResults.style.display = 'flex';
                }
            }

        } catch (error) {
            console.error('❌ Search error:', error);
            hideLoadingOverlay();
            
            if (noResults) {
                noResults.style.display = 'flex';
            }
        }
    }

    async function searchOrderById(orderId) {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (currentUser) {
            headers['Authorization'] = `Bearer ${currentUser.token}`;
        }

        try {
            const response = await fetch(`${API_URL}/orders/search/${orderId}`, {
                headers,
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 404) {
                    return null; 
                }
                throw new Error(data.message || 'Failed to search order');
            }

            return data.order;
        } catch (error) {
            throw error;
        }
    }

    async function checkOrderHasInstallation(orderId) {

        try {

            return false;
        } catch (error) {
            console.error('Error checking installation:', error);
            return false;
        }
    }

    async function loadUserOrders() {
        if (!currentUser) return;

        console.log('📋 Loading user orders...');

        ordersListContainer.style.display = 'none';
        ordersEmpty.style.display = 'none';
        ordersError.style.display = 'none';
        ordersLoading.style.display = 'flex';

        try {
            const response = await fetch(`${API_URL}/orders?limit=100`, {
                headers: {
                    'Authorization': `Bearer ${currentUser.token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok && data.success) {
                userOrders = data.orders || [];
                
                console.log(`✅ Loaded ${userOrders.length} orders`);

                const ordersWithoutInstallation = await filterOrdersWithoutInstallation(userOrders);
                
                if (ordersWithoutInstallation.length > 0) {
                    displayOrdersList(ordersWithoutInstallation);
                } else {
                    ordersLoading.style.display = 'none';
                    ordersEmpty.style.display = 'block';
                }
            } else {
                throw new Error(data.message || 'Failed to load orders');
            }

        } catch (error) {
            console.error('❌ Error loading user orders:', error);
            ordersLoading.style.display = 'none';
            ordersErrorMessage.textContent = error.message || 'Failed to load orders';
            ordersError.style.display = 'block';
        }
    }

    async function filterOrdersWithoutInstallation(orders) {
        const filtered = [];
        
        for (const order of orders) {
            const hasInstallation = await checkOrderHasInstallation(order._id);
            if (!hasInstallation) {
                filtered.push(order);
            }
        }
        
        return filtered;
    }

    function displayOrdersList(orders) {
        ordersLoading.style.display = 'none';
        ordersListContainer.style.display = 'block';
        ordersListContainer.innerHTML = '';

        orders.forEach(order => {
            const orderElement = createOrderListItem(order);
            ordersListContainer.appendChild(orderElement);
        });
    }

    function createOrderListItem(order) {
        const div = document.createElement('div');
        div.className = 'order-item';
        div.dataset.orderId = order._id;

        const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        let productsHtml = '<div class="no-products">No products</div>';
        if (order.items && Array.isArray(order.items) && order.items.length > 0) {
            const productItems = order.items.map(item => {
                let name = 'Unknown Product';
                if (item.product && item.product.name) {
                    name = item.product.name;
                } else if (item.productName) {
                    name = item.productName;
                } else if (item.name) {
                    name = item.name;
                }
                const qty = item.quantity || 1;
                const qtyBadge = qty > 1 ? `<span class="product-qty">×${qty}</span>` : '';
                return `<div class="product-item"><i class="fas fa-box"></i> ${name} ${qtyBadge}</div>`;
            }).join('');
            productsHtml = `<div class="products-list">${productItems}</div>`;
        }

        div.innerHTML = `
            <div class="order-item-compact">
                <div class="order-compact-header">
                    <div class="order-id-wrapper">
                        <strong>Order ID:</strong> ${order.orderNumber || order._id.substring(0, 8).toUpperCase()}
                    </div>
                    <span class="order-compact-date">${orderDate}</span>
                </div>
                <div class="order-compact-products">
                    <strong class="products-label">Products:</strong>
                    ${productsHtml}
                </div>
            </div>
        `;

        div.addEventListener('click', () => handleOrderSelect(order));

        return div;
    }

    function handleOrderSelect(order) {
        selectedOrder = order;
        displaySelectedOrder(order);

        document.querySelectorAll('.order-item').forEach(item => {
            item.classList.remove('selected');
        });
        event.currentTarget.classList.add('selected');
    }

    function displaySelectedOrder(order) {
        
        const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        let productsHtml = '<div class="product-list">No products found</div>';
        if (order.items && Array.isArray(order.items) && order.items.length > 0) {
            const productItems = order.items.map(item => {
                
                let name = 'Unknown Product';
                if (item.product && item.product.name) {
                    name = item.product.name; 
                } else if (item.productName) {
                    name = item.productName; 
                } else if (item.name) {
                    name = item.name; 
                }
                const qty = item.quantity || 1;
                return `<div class="product-list-item"><i class="fas fa-box"></i> ${name} <span class="qty-badge">x${qty}</span></div>`;
            }).join('');
            productsHtml = `<div class="product-list">${productItems}</div>`;
        }

        selectedOrderCard.innerHTML = `
            <div class="order-details-grid">
                <div class="detail-item">
                    <span class="detail-label">Order Number</span>
                    <span class="detail-value">${order.orderNumber || order._id.substring(0, 8).toUpperCase()}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Order Date</span>
                    <span class="detail-value">${orderDate}</span>
                </div>
            </div>
            <div class="detail-item" style="margin-top: 16px;">
                <span class="detail-label">Products</span>
                ${productsHtml}
            </div>
        `;

        const orderSelectionSection = document.querySelector('.order-selection-section');
        if (orderSelectionSection) {
            orderSelectionSection.style.display = 'none';
        }

        if (myOrdersSection) {
            myOrdersSection.style.display = 'none';
        }

        selectedOrderSection.style.display = 'block';

        if (!autocomplete && installationAddressInput) {
            
            setTimeout(() => {
                initializeGooglePlaces();
            }, 100);
        }

        selectedOrderSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function handleChangeOrder() {
        selectedOrder = null;
        selectedOrderSection.style.display = 'none';
        orderIdInput.value = '';
        updateSearchButtonState();

        const orderSelectionSection = document.querySelector('.order-selection-section');
        if (orderSelectionSection) {
            orderSelectionSection.style.display = 'block';
        }

        if (currentUser && myOrdersSection) {
            myOrdersSection.style.display = 'block';
        }

        document.querySelectorAll('.order-item').forEach(item => {
            item.classList.remove('selected');
        });

        if (orderSelectionSection) {
            orderSelectionSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    function showLoadingOverlay() {
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
    }

    function hideLoadingOverlay() {
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    function initializeGooglePlaces() {
        if (!window.google || !window.google.maps || !window.google.maps.places) {
            console.warn('Google Places API not loaded yet');
            return;
        }

        try {
            console.log('🗺️ Initializing Google Places Autocomplete');
            
            autocomplete = new google.maps.places.Autocomplete(installationAddressInput, {
                componentRestrictions: { country: 'au' },
                fields: ['formatted_address', 'address_components', 'geometry'],
                types: ['address']
            });

            autocomplete.addListener('place_changed', function() {
                const place = autocomplete.getPlace();
                if (place && place.formatted_address) {
                    installationAddressInput.value = place.formatted_address;
                    console.log('✅ Address selected:', place.formatted_address);
                }
            });

            console.log('✅ Google Places Autocomplete initialized');
        } catch (error) {
            console.error('❌ Error initializing Google Places:', error);
        }
    }

    function prefillCustomerDetails() {
        if (customerNameInput && currentUser.firstName) {
            const fullName = `${currentUser.firstName} ${currentUser.lastName || ''}`.trim();
            customerNameInput.value = fullName;
        }
        if (customerEmailInput && currentUser.email) {
            customerEmailInput.value = currentUser.email;
        }
    }

    async function handleBookingSubmit(e) {
        e.preventDefault();

        hideError('datetime');
        hideError('customer-details');

        const installationDate = installationDateInput.value;
        const installationTime = installationTimeSelect.value;

        if (!installationDate) {
            showError('datetime', 'Please select an installation date.');
            installationDateInput.focus();
            return;
        }

        if (!installationTime) {
            showError('datetime', 'Please select a preferred time slot.');
            installationTimeSelect.focus();
            return;
        }

        const selectedDate = new Date(installationDate);
        const minDate = new Date();
        minDate.setDate(minDate.getDate() + 2);
        minDate.setHours(0, 0, 0, 0);
        selectedDate.setHours(0, 0, 0, 0);
        
        if (selectedDate < minDate) {
            showError('datetime', 'Installation must be scheduled at least 2 days in advance.');
            installationDateInput.focus();
            return;
        }

        const customerName = customerNameInput.value.trim();
        const customerEmail = customerEmailInput.value.trim();
        const customerPhone = customerPhoneInput.value.trim();
        const installationAddress = installationAddressInput.value.trim();
        const installationNotes = document.getElementById('installation-notes')?.value.trim() || '';

        if (!customerName) {
            showError('customer-details', 'Please enter your name.');
            customerNameInput.focus();
            return;
        }

        if (!customerEmail) {
            showError('customer-details', 'Please enter your email address.');
            customerEmailInput.focus();
            return;
        }

        if (!customerPhone) {
            showError('customer-details', 'Please enter your phone number.');
            customerPhoneInput.focus();
            return;
        }

        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(customerPhone)) {
            showError('customer-details', 'Phone number must be exactly 10 digits.');
            customerPhoneInput.focus();
            return;
        }

        if (!installationAddress) {
            showError('customer-details', 'Please enter the installation address.');
            installationAddressInput.focus();
            return;
        }

        if (!selectedOrder) {
            alert('No order selected. Please select an order first.');
            return;
        }

        console.log('� Booking installation:', {
            orderId: selectedOrder._id,
            customerName,
            customerEmail,
            customerPhone,
            installationAddress,
            installationDate,
            installationTime
        });

        showLoadingOverlay();

        try {
            const bookingData = {
                customerName,
                contactNumber: customerPhone,
                customerEmail,
                address: installationAddress,
                orderId: selectedOrder._id,
                installationDate: new Date(`${installationDate} ${installationTime.split('-')[0]}`).toISOString(),
                notes: installationNotes || ''
            };

            const authToken = localStorage.getItem('authToken');
            
            const headers = {
                'Content-Type': 'application/json'
            };

            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }

            const response = await fetch(`${API_URL}/installations/book`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(bookingData)
            });

            const result = await response.json();
            
            hideLoadingOverlay();

            if (response.ok && result.success) {
                
                const installationData = {
                    orderNumber: selectedOrder.orderNumber || selectedOrder._id,
                    customerName: customerName,
                    customerEmail: customerEmail,
                    contactNumber: customerPhone,
                    installationDate: bookingData.installationDate,
                    address: installationAddress
                };

                sessionStorage.setItem('installationSuccess', JSON.stringify(installationData));

                window.location.href = 'user_installation_success.html';
            } else {
                
                const errorMessage = result.message || 'Failed to book installation. Please try again.';
                showError('customer-details', errorMessage);
            }
        } catch (error) {
            hideLoadingOverlay();
            console.error('Booking error:', error);
            showError('customer-details', 'Network error. Please check your connection and try again.');
        }
    }

    function showError(section, message) {
        if (section === 'datetime' && datetimeError && datetimeErrorMessage) {
            datetimeErrorMessage.textContent = message;
            datetimeError.style.display = 'flex';
            datetimeError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (section === 'customer-details' && customerDetailsError && customerDetailsErrorMessage) {
            customerDetailsErrorMessage.textContent = message;
            customerDetailsError.style.display = 'flex';
            customerDetailsError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    function hideError(section) {
        if (section === 'datetime' && datetimeError) {
            datetimeError.style.display = 'none';
        } else if (section === 'customer-details' && customerDetailsError) {
            customerDetailsError.style.display = 'none';
        }
    }

    window.initAutocomplete = function() {
        console.log('🗺️ Google Places API loaded');
        
    };

    init();
});
