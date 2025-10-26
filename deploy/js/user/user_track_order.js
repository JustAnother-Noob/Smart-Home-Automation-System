document.addEventListener('DOMContentLoaded', function() {
    
    const API_URL = window.CONFIG?.API_URL || '/api';

    const searchInput = document.getElementById('order-search-input');
    const searchBtn = document.getElementById('search-order-btn');
    const resultsSection = document.getElementById('results-section');
    const loadingState = document.getElementById('loading-state');
    const guestResults = document.getElementById('guest-results');
    const userOrders = document.getElementById('user-orders');
    const noResults = document.getElementById('no-results');
    const errorState = document.getElementById('error-state');
    const ordersList = document.getElementById('orders-list');
    const pagination = document.getElementById('pagination');
    const retryBtn = document.getElementById('retry-btn');
    const orderModal = document.getElementById('order-modal');
    const closeModal = document.getElementById('close-modal');
    const modalBody = document.getElementById('modal-body');
    const guestPrompt = document.getElementById('guest-prompt');

    let currentUser = null;
    let allUserOrders = [];
    let currentPage = 1;
    const ordersPerPage = 10;

    function init() {
        checkAuthStatus();
        setupEventListeners();

        if (currentUser) {
            loadUserOrders();
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

            searchInput.placeholder = "Search your orders by Order ID...";
            
            console.log('✅ User is logged in:', currentUser.email);
            
            if (guestPrompt) guestPrompt.style.display = 'none';
        } else {
            console.log('👤 Guest user detected');
            if (guestPrompt) guestPrompt.style.display = 'flex';
        }
    }

    function setupEventListeners() {
        
        updateSearchButtonState();

        searchBtn.addEventListener('click', handleSearch);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });

        searchInput.addEventListener('input', updateSearchButtonState);

        if (retryBtn) {
            retryBtn.addEventListener('click', handleRetry);
        }

        if (closeModal) {
            closeModal.addEventListener('click', closeOrderModal);
        }

        if (orderModal) {
            orderModal.addEventListener('click', function(e) {
                if (e.target === orderModal) {
                    closeOrderModal();
                }
            });
        }
    }

    function updateSearchButtonState() {
        const orderID = searchInput.value.trim();
        if (orderID) {
            searchBtn.disabled = false;
            searchBtn.style.opacity = '1';
            searchBtn.style.cursor = 'pointer';
        } else {
            searchBtn.disabled = true;
            searchBtn.style.opacity = '0.5';
            searchBtn.style.cursor = 'not-allowed';
        }
    }

    async function handleSearch() {
        const orderID = searchInput.value.trim();
        
        if (!orderID) {
            showError('Please enter an Order ID');
            return;
        }

        console.log('🔍 Searching for order:', orderID);
        
        showLoading();
        hideAllStates();

        try {
            let order = null;

            if (currentUser) {
                
                order = allUserOrders.find(o => 
                    o._id === orderID || 
                    o.orderNumber === orderID ||
                    o._id.toLowerCase().includes(orderID.toLowerCase())
                );

                if (!order) {
                    
                    order = await searchOrderById(orderID);
                }
            } else {
                
                order = await searchOrderById(orderID);
            }

            hideLoading();

            if (order) {
                displayOrderDetails(order, true);
            } else {
                showNoResults();
            }

        } catch (error) {
            console.error('❌ Search error:', error);
            hideLoading();
            showError(error.message || 'Failed to search for order');
        }
    }

    async function searchOrderById(orderID) {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (currentUser) {
            headers['Authorization'] = `Bearer ${currentUser.token}`;
        }

        const response = await fetch(`${API_URL}/orders/search/${orderID}`, {
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
    }

    async function loadUserOrders() {
        if (!currentUser) return;

        console.log('📋 Loading user orders...');

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
                allUserOrders = data.orders || [];
                
                console.log(`✅ Loaded ${allUserOrders.length} orders`);
                
                if (allUserOrders.length > 0) {
                    displayUserOrders();
                } else {
                    showEmptyOrders();
                }
            } else {
                throw new Error(data.message || 'Failed to load orders');
            }

        } catch (error) {
            console.error('❌ Error loading user orders:', error);
            
        }
    }

    function displayUserOrders() {
        if (!allUserOrders.length) {
            showEmptyOrders();
            return;
        }

        const startIndex = (currentPage - 1) * ordersPerPage;
        const endIndex = startIndex + ordersPerPage;
        const ordersToShow = allUserOrders.slice(startIndex, endIndex);

        ordersList.innerHTML = '';

        ordersToShow.forEach(order => {
            const orderElement = createOrderElement(order);
            ordersList.appendChild(orderElement);
        });

        if (allUserOrders.length > ordersPerPage) {
            renderPagination();
            pagination.style.display = 'flex';
        } else {
            pagination.style.display = 'none';
        }

        hideAllStates();
        userOrders.style.display = 'block';
        resultsSection.style.display = 'block';
    }

    function generateOrderTimeline(currentStatus) {

        let statusLower = 'pending';
        if (typeof currentStatus === 'string') {
            statusLower = currentStatus.toLowerCase();
        } else if (currentStatus == null) {
            statusLower = 'pending';
        } else if (typeof currentStatus === 'object') {
            
            if (typeof currentStatus.status === 'string') {
                statusLower = currentStatus.status.toLowerCase();
            } else if (typeof currentStatus.name === 'string') {
                statusLower = currentStatus.name.toLowerCase();
            } else {
                try {
                    statusLower = String(currentStatus).toLowerCase();
                } catch (e) {
                    statusLower = 'pending';
                }
            }
        } else {
            
            statusLower = String(currentStatus).toLowerCase();
        }

        const stages = [
            { key: 'pending', label: 'Pending', icon: 'fa-clock' },
            { key: 'confirmed', label: 'Confirmed', icon: 'fa-check-circle' },
            { key: 'processing', label: 'Processing', icon: 'fa-cog' },
            { key: 'shipped', label: 'Shipped', icon: 'fa-truck' },
            { key: 'delivered', label: 'Delivered', icon: 'fa-box-open' },
            { key: 'completed', label: 'Completed', icon: 'fa-check-double' }
        ];

        if (statusLower === 'cancelled' || statusLower === 'refunded') {
            return `
                <div class="order-timeline timeline-special">
                    <div class="timeline-item active ${statusLower}">
                        <div class="timeline-icon">
                            <i class="fas ${statusLower === 'cancelled' ? 'fa-times-circle' : 'fa-undo'}"></i>
                        </div>
                        <div class="timeline-content">
                            <div class="timeline-title">${statusLower === 'cancelled' ? 'Cancelled' : 'Refunded'}</div>
                            <div class="timeline-desc">Order has been ${statusLower}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        const foundIndex = stages.findIndex(s => s.key === statusLower);
        const currentIndex = foundIndex === -1 ? 0 : foundIndex;
        
        return `
            <div class="order-timeline">
                ${stages.map((stage, index) => {
                    const isActive = index <= currentIndex;
                    const isCurrent = index === currentIndex;
                    return `
                        <div class="timeline-item ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}">
                            <div class="timeline-icon">
                                <i class="fas ${stage.icon}"></i>
                            </div>
                            <div class="timeline-content">
                                <div class="timeline-title">${stage.label}</div>
                            </div>
                            ${index < stages.length - 1 ? '<div class="timeline-line"></div>' : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function displayOrderDetails(order, isSearchResult = false) {
        console.log('Displaying order details (search):', order);
        console.log('Order status:', order.status);
        console.log('Estimated delivery date:', order.estimatedDeliveryDate);
        
        const container = isSearchResult ? guestResults.querySelector('.order-details-card') : null;
        
        if (!container) {
            console.error('Order details container not found');
            showError('Unable to display order details');
            return;
        }

        const statusClass = getStatusClass(order.status);
        const formattedDate = new Date(order.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const timelineHtml = generateOrderTimeline(order.status);

        const itemsHtml = order.items && Array.isArray(order.items) ? 
            order.items.map(item => {
                return `
                <div class="item">
                    <div class="item-info">
                        <span class="item-name">${item.product?.name || item.name || 'Product'}</span>
                        <span class="item-details">Qty: ${item.quantity} × $${(item.price || 0).toFixed(2)}</span>
                    </div>
                    <span class="item-total">$${(item.total || item.quantity * item.price || 0).toFixed(2)}</span>
                </div>
            `;
            }).join('') : '<p>No items available</p>';

        container.innerHTML = `
            <div class="order-details-header">
                <h2><i class="fas fa-package"></i> Order Details</h2>
                <span class="order-status ${statusClass}">${capitalizeFirst(order.status)}</span>
            </div>
            
            <div class="order-info-grid">
                <div class="info-item">
                    <label>Order ID:</label>
                    <span>${order.orderNumber || order._id}</span>
                </div>
                <div class="info-item">
                    <label>Order Date:</label>
                    <span>${formattedDate}</span>
                </div>
                <div class="info-item">
                    <label>Payment Method:</label>
                    <span>${capitalizeFirst(order.paymentMethod || 'Not specified')}</span>
                </div>
                <div class="info-item">
                    <label>Total Amount:</label>
                    <span class="amount">$${(order.totalAmount || 0).toFixed(2)}</span>
                </div>
            </div>

            ${(order.status === 'delivered' || order.status === 'completed') && order.estimatedDeliveryDate ? `
            <div class="delivery-date-banner delivered">
                <i class="fas fa-calendar-check"></i>
                <div class="delivery-date-content">
                    <span class="delivery-date-label">Delivered On:</span>
                    <span class="delivery-date-value">${new Date(order.estimatedDeliveryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
            </div>
            ` : ''}

            ${order.estimatedDeliveryDate && order.status !== 'delivered' && order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'refunded' ? `
            <div class="delivery-date-banner">
                <i class="fas fa-calendar-alt"></i>
                <div class="delivery-date-content">
                    <span class="delivery-date-label">Expected Delivery Date:</span>
                    <span class="delivery-date-value">${new Date(order.estimatedDeliveryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
            </div>
            ` : ''}

            <div class="order-timeline-section">
                <h3><i class="fas fa-stream"></i> Order Status</h3>
                ${timelineHtml}
            </div>

            ${order.address ? `
            <div class="shipping-info">
                <h3><i class="fas fa-map-marker-alt"></i> Shipping Address</h3>
                <p>${order.address}</p>
            </div>
            ` : ''}

            <div class="order-items">
                <h3><i class="fas fa-shopping-cart"></i> Items (${order.items ? order.items.length : 0})</h3>
                <div class="items-list">
                    ${itemsHtml}
                </div>
            </div>
        `;

        hideAllStates();
        guestResults.style.display = 'block';
        resultsSection.style.display = 'block';
    }

    function createOrderElement(order) {
        const orderDiv = document.createElement('div');
        orderDiv.className = 'order-list-item';
        orderDiv.dataset.orderId = order._id;
        
        const statusClass = getStatusClass(order.status);
        const formattedDate = new Date(order.createdAt || order.orderDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const itemCount = order.items ? order.items.length : 0;
        const totalAmount = order.totalAmount || order.total || 0;
        const orderNumber = order.orderNumber || order._id.slice(-8);

        orderDiv.innerHTML = `
            <div class="order-list-item-content">
                <div class="order-list-left">
                    <div class="order-list-number">
                        <i class="fas fa-receipt"></i>
                        <span>Order #${orderNumber}</span>
                    </div>
                    <div class="order-list-meta">
                        <span class="order-list-date">
                            <i class="far fa-calendar"></i> ${formattedDate}
                        </span>
                        <span class="order-list-items">
                            <i class="fas fa-box"></i> ${itemCount} item${itemCount !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>
                <div class="order-list-right">
                    <span class="order-status ${statusClass}">${capitalizeFirst(order.status)}</span>
                    <span class="order-list-total">$${totalAmount.toFixed(2)}</span>
                    <button class="order-list-toggle">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
            </div>
            <div class="order-list-details" style="display: none;">
                <!-- Details will be populated when clicked -->
            </div>
        `;

        const itemContent = orderDiv.querySelector('.order-list-item-content');
        const toggleBtn = orderDiv.querySelector('.order-list-toggle');
        const detailsDiv = orderDiv.querySelector('.order-list-details');
        
        const handleToggle = (e) => {
            e.stopPropagation();
            const isExpanded = detailsDiv.style.display === 'block';

            document.querySelectorAll('.order-list-details').forEach(detail => {
                detail.style.display = 'none';
            });
            document.querySelectorAll('.order-list-toggle i').forEach(icon => {
                icon.className = 'fas fa-chevron-down';
            });
            document.querySelectorAll('.order-list-item').forEach(item => {
                item.classList.remove('expanded');
            });
            
            if (!isExpanded) {
                
                detailsDiv.style.display = 'block';
                toggleBtn.querySelector('i').className = 'fas fa-chevron-up';
                orderDiv.classList.add('expanded');

                if (!detailsDiv.hasAttribute('data-loaded')) {
                    loadOrderDetails(order, detailsDiv);
                    detailsDiv.setAttribute('data-loaded', 'true');
                }
            }
        };

        itemContent.addEventListener('click', handleToggle);

        return orderDiv;
    }

    function loadOrderDetails(order, detailsDiv) {
        console.log('Loading order details:', order);
        console.log('Order status:', order.status);
        console.log('Estimated delivery date:', order.estimatedDeliveryDate);

        const timelineHtml = generateOrderTimeline(order.status);

        let itemsHtml = '<p>No items available</p>';
        if (order.items && Array.isArray(order.items) && order.items.length > 0) {
            itemsHtml = order.items.map(item => `
                <div class="item">
                    <div class="item-info">
                        <div class="item-name">${item.product?.name || item.name || 'Product'}</div>
                        <div class="item-details">Qty: ${item.quantity || 1} × $${(item.price || 0).toFixed(2)}</div>
                    </div>
                    <div class="item-total">$${(item.total || (item.quantity || 1) * (item.price || 0)).toFixed(2)}</div>
                </div>
            `).join('');
        }

        let addressText = 'Address not available';
        if (order.address) {
            if (typeof order.address === 'string') {
                addressText = order.address;
            } else if (order.shippingAddress) {
                const addr = order.shippingAddress;
                addressText = `${addr.street}${addr.apartmentSuite ? ', ' + addr.apartmentSuite : ''}, ${addr.city}, ${addr.state} ${addr.zipCode}`;
            }
        }

        detailsDiv.innerHTML = `
            <div class="order-info-grid">
                <div class="info-item">
                    <label>Order Date:</label>
                    <span>${new Date(order.createdAt || order.orderDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="info-item">
                    <label>Payment Method:</label>
                    <span>${capitalizeFirst(order.paymentMethod || 'Not specified')}</span>
                </div>
                <div class="info-item">
                    <label>Total Amount:</label>
                    <span class="amount">$${(order.totalAmount || order.total || 0).toFixed(2)}</span>
                </div>
            </div>

            ${(order.status === 'delivered' || order.status === 'completed') && order.estimatedDeliveryDate ? `
            <div class="delivery-date-banner delivered">
                <i class="fas fa-calendar-check"></i>
                <div class="delivery-date-content">
                    <span class="delivery-date-label">Delivered On:</span>
                    <span class="delivery-date-value">${new Date(order.estimatedDeliveryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
            </div>
            ` : ''}

            ${order.estimatedDeliveryDate && order.status !== 'delivered' && order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'refunded' ? `
            <div class="delivery-date-banner">
                <i class="fas fa-calendar-alt"></i>
                <div class="delivery-date-content">
                    <span class="delivery-date-label">Expected Delivery Date:</span>
                    <span class="delivery-date-value">${new Date(order.estimatedDeliveryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
            </div>
            ` : ''}

            <div class="order-timeline-section">
                <h3><i class="fas fa-stream"></i> Order Status</h3>
                ${timelineHtml}
            </div>

            ${order.address ? `
            <div class="shipping-info">
                <h3><i class="fas fa-map-marker-alt"></i> Shipping Address</h3>
                <p>${addressText}</p>
            </div>
            ` : ''}

            <div class="order-items">
                <h3><i class="fas fa-shopping-cart"></i> Items (${order.items ? order.items.length : 0})</h3>
                <div class="items-list">
                    ${itemsHtml}
                </div>
            </div>
        `;
    }

    function showOrderDetails(order) {
        console.log('Showing order details for:', order);
        
        if (!orderModal || !modalBody) {
            console.error('Modal elements not found');
            showAlert('Unable to display order details', 'error');
            return;
        }

        const statusClass = getStatusClass(order.status);
        const formattedDate = new Date(order.createdAt || order.orderDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const orderNumber = order.orderNumber || order._id.slice(-8);
        const totalAmount = order.totalAmount || order.total || 0;

        let itemsHtml = '<p>No items available</p>';
        if (order.items && Array.isArray(order.items) && order.items.length > 0) {
            itemsHtml = order.items.map(item => `
                <div class="modal-item">
                    <div class="item-details">
                        <span class="item-name">${item.product?.name || item.name || 'Product'}</span>
                        <span class="item-qty">Qty: ${item.quantity || 1}</span>
                        <span class="item-price">$${(item.price || 0).toFixed(2)} each</span>
                    </div>
                    <span class="item-total">$${(item.total || (item.quantity || 1) * (item.price || 0)).toFixed(2)}</span>
                </div>
            `).join('');
        }

        let addressHtml = '';
        if (order.address) {
            if (typeof order.address === 'string') {
                addressHtml = `
                <div class="shipping-address">
                    <h4><i class="fas fa-map-marker-alt"></i> Shipping Address</h4>
                    <p>${order.address}</p>
                </div>`;
            } else if (order.shippingAddress) {
                const addr = order.shippingAddress;
                addressHtml = `
                <div class="shipping-address">
                    <h4><i class="fas fa-map-marker-alt"></i> Shipping Address</h4>
                    <p>${addr.street}${addr.apartmentSuite ? ', ' + addr.apartmentSuite : ''}<br>
                    ${addr.city}, ${addr.state} ${addr.zipCode}<br>
                    ${addr.country}</p>
                </div>`;
            }
        }

        modalBody.innerHTML = `
            <div class="modal-order-details">
                <div class="order-summary">
                    <h3><i class="fas fa-receipt"></i> Order #${orderNumber}</h3>
                    <p class="order-date"><i class="fas fa-calendar"></i> ${formattedDate}</p>
                    <span class="order-status ${statusClass}">
                        <i class="fas fa-info-circle"></i> ${capitalizeFirst(order.status)}
                    </span>
                </div>
                
                <div class="order-items-section">
                    <h4><i class="fas fa-shopping-cart"></i> Items (${order.items ? order.items.length : 0})</h4>
                    <div class="items-container">
                        ${itemsHtml}
                    </div>
                </div>
                
                <div class="order-total-section">
                    <div class="total-breakdown">
                        <div class="total-row">
                            <span>Subtotal:</span>
                            <span>$${(order.subtotal || totalAmount).toFixed(2)}</span>
                        </div>
                        <div class="total-row">
                            <span>Tax:</span>
                            <span>$${(order.tax || 0).toFixed(2)}</span>
                        </div>
                        <div class="total-row">
                            <span>Shipping:</span>
                            <span>$${(order.shipping || 0).toFixed(2)}</span>
                        </div>
                        <div class="total-row final-total">
                            <strong>Total: $${totalAmount.toFixed(2)}</strong>
                        </div>
                    </div>
                </div>
                
                ${addressHtml}
                
                <div class="payment-info">
                    <h4><i class="fas fa-credit-card"></i> Payment Information</h4>
                    <p><strong>Method:</strong> ${capitalizeFirst(order.paymentMethod || 'Not specified')}</p>
                    <p><strong>Status:</strong> ${order.paymentStatus || 'Pending'}</p>
                </div>
            </div>
        `;

        orderModal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; 
        
        console.log('Modal should now be visible');
    }

    function closeOrderModal() {
        orderModal.style.display = 'none';
        document.body.style.overflow = ''; 
    }

    async function cancelOrder(orderID) {
        if (!confirm('Are you sure you want to cancel this order?')) {
            return;
        }

        try {
            showLoading();

            const headers = {
                'Content-Type': 'application/json'
            };

            if (currentUser) {
                headers['Authorization'] = `Bearer ${currentUser.token}`;
            }

            const response = await fetch(`${API_URL}/orders/${orderID}/cancel`, {
                method: 'PUT',
                headers,
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showAlert('Order cancelled successfully', 'success');

                if (currentUser) {
                    await loadUserOrders();
                } else {
                    
                    handleSearch();
                }
            } else {
                throw new Error(data.message || 'Failed to cancel order');
            }

        } catch (error) {
            console.error('❌ Cancel order error:', error);
            showAlert(error.message || 'Failed to cancel order', 'error');
        } finally {
            hideLoading();
        }
    }

    function trackOrder(orderID) {
        showAlert('Order tracking will be available soon!', 'info');
    }

    function renderPagination() {
        const totalPages = Math.ceil(allUserOrders.length / ordersPerPage);
        
        pagination.innerHTML = `
            <button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" 
                    onclick="changePage(${currentPage - 1})" 
                    ${currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i> Previous
            </button>
            
            <span class="pagination-info">
                Page ${currentPage} of ${totalPages}
            </span>
            
            <button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" 
                    onclick="changePage(${currentPage + 1})"
                    ${currentPage === totalPages ? 'disabled' : ''}>
                Next <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }

    window.changePage = function(newPage) {
        const totalPages = Math.ceil(allUserOrders.length / ordersPerPage);
        
        if (newPage < 1 || newPage > totalPages) return;
        
        currentPage = newPage;
        displayUserOrders();
    };

    function handleRetry() {
        if (searchInput.value.trim()) {
            handleSearch();
        } else if (currentUser) {
            loadUserOrders();
        }
    }

    function showLoading() {
        loadingState.style.display = 'flex';
        resultsSection.style.display = 'block';
    }

    function hideLoading() {
        loadingState.style.display = 'none';
    }

    function hideAllStates() {
        loadingState.style.display = 'none';
        guestResults.style.display = 'none';
        userOrders.style.display = 'none';
        noResults.style.display = 'none';
        errorState.style.display = 'none';
    }

    function showNoResults(isEmptyOrders = false) {
        hideAllStates();

        const titleElement = document.getElementById('no-results-title');
        const messageElement = document.getElementById('no-results-message');
        
        if (isEmptyOrders) {
            titleElement.textContent = 'No Orders Yet';
            messageElement.textContent = 'You haven\'t placed any orders yet. Start shopping to see your orders here!';
        } else {
            titleElement.textContent = 'Order Not Found';
            messageElement.textContent = 'We couldn\'t find an order with that ID. Please check your Order ID and try again.';
        }
        
        noResults.style.display = 'block';
        resultsSection.style.display = 'block';
    }

    function showEmptyOrders() {
        showNoResults(true);
    }

    function showError(message) {
        document.getElementById('error-message').textContent = message;
        hideAllStates();
        errorState.style.display = 'block';
        resultsSection.style.display = 'block';
    }

    function getStatusClass(status) {
        const statusClasses = {
            pending: 'status-pending',
            processing: 'status-processing', 
            shipped: 'status-shipped',
            delivered: 'status-delivered',
            completed: 'status-delivered',
            cancelled: 'status-cancelled'
        };
        return statusClasses[status.toLowerCase()] || 'status-pending';
    }

    function capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    function showAlert(message, type = 'info') {
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            ${message}
        `;

        Object.assign(alert.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 20px',
            borderRadius: '6px',
            zIndex: '9999',
            boxShadow: '0 5px 15px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            minWidth: '300px',
            fontWeight: '500'
        });

        if (type === 'success') {
            alert.style.backgroundColor = '#d4edda';
            alert.style.color = '#155724';
            alert.style.border = 'none';
            alert.style.borderLeft = '5px solid #28a745';
        } else if (type === 'error') {
            alert.style.backgroundColor = '#f8d7da';
            alert.style.color = '#721c24';
            alert.style.border = 'none';
            alert.style.borderLeft = '5px solid #dc3545';
        } else {
            alert.style.backgroundColor = '#cce5ff';
            alert.style.color = '#004085';
            alert.style.border = 'none';
            alert.style.borderLeft = '5px solid #007bff';
        }

        document.body.appendChild(alert);

        setTimeout(() => {
            alert.style.opacity = '0';
            alert.style.transform = 'translateX(30px)';
            alert.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            
            setTimeout(() => {
                document.body.removeChild(alert);
            }, 300);
        }, 5000);
    }

    init();
});
