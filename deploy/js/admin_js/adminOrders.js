

if (window.__ADMIN_ORDERS_INITIALIZED__) {
  console.warn('adminOrders.js duplicate load prevented');
} else {
  window.__ADMIN_ORDERS_INITIALIZED__ = true;

  const API_BASE =
    (typeof CONFIG !== 'undefined' && CONFIG.API_URL) ? CONFIG.API_URL : '/api';
  const ORDERS_ENDPOINT = '/admin/orders';

  console.log('🔧 AdminOrders Config:', {
    API_BASE,
    CONFIG: window.CONFIG,
    hostname: window.location.hostname
  });

  async function apiRequest(path, method = 'GET', body) {
    try {
      if (window.api && typeof window.api.request === 'function') {
        return await window.api.request(path, method, body);
      }
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('authToken')
            ? { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
            : {}),
        },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
      return await res.json();
    } catch (e) {
      console.error('apiRequest error', e);
      return { ok: false, success: false, message: e.message || 'Network error' };
    }
  }

  const apiGet = (p) => apiRequest(p, 'GET');
  const apiPut = (p, b) => apiRequest(p, 'PUT', b);
  const apiPatch = (p, b) => apiRequest(p, 'PATCH', b);

  let lastLoadedPage = 1;

  document.addEventListener('DOMContentLoaded', () => {
    try {
      if (window.auth?.checkAdminAuth && !window.auth.checkAdminAuth()) return;
      if (window.auth?.getUserRole && window.auth.getUserRole() !== 'admin') {
        alert('Access denied');
        return;
      }
      initializeOrdersPage();
    } catch (e) {
      console.error(e);
      showEmpty('Initialization failed');
    }
  });

  function initializeOrdersPage() {
    if (!window.api?.request && !window.fetch) {
      showEmpty('API not ready');
      return;
    }
    bindStaticUI();
    setupRefresh();
    fetchOrders(1);
  }

  function bindStaticUI() {
    document
      .getElementById('orderStatusFilter')
      ?.addEventListener('change', () => fetchOrders(1));
    document
      .getElementById('orderSortBy')
      ?.addEventListener('change', () => fetchOrders(1));
    document
      .getElementById('orderArchiveFilter')
      ?.addEventListener('change', () => fetchOrders(1));

    const searchInput = document.getElementById('orderSearch');
    
    if (searchInput) {
      searchInput.addEventListener('input', debounce(() => fetchOrders(1), 300));
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          fetchOrders(1);
        }
      });
    }

    const exportBtn = document.getElementById('exportOrdersBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportOrdersToCSV);
    }

    const printBtn = document.getElementById('printOrdersList');
    if (printBtn) {
      printBtn.addEventListener('click', handlePrintOrdersList);
    }
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function setupRefresh() {
    if (window.RefreshUtils?.manager) {
      window.RefreshUtils.manager.register(
        'refreshOrders',
        () => fetchOrders(1),
        {
          normalText: 'Orders',
          loadingText: 'Refreshing orders...',
          successText: 'Orders updated!',
          errorText: 'Failed to refresh',
        }
      );
    }
  }

  async function fetchOrders(page = 1) {
    try {
      showLoadingState();

  let status = document.getElementById('orderStatusFilter')?.value ?? '';
  status = String(status).trim().toLowerCase();
  if (status === 'all') status = '';

  const archivedFilter = document.getElementById('orderArchiveFilter')?.value ?? 'active';
    const sort = document.getElementById('orderSortBy')?.value || 'newest';
      const limit = 10;

      const searchQuery = document.getElementById('orderSearch')?.value?.trim() || '';

  const params = new URLSearchParams({ page, limit, sort });
  if (status) params.append('status', status);
      if (searchQuery) params.append('search', searchQuery);
      
      params.append('archived', archivedFilter === 'archived' ? 'true' : 
                              archivedFilter === 'all' ? 'all' : 'false');

      const url = `${ORDERS_ENDPOINT}?${params.toString()}`;
      const data = await apiGet(url);

      let items = [];
      let currentPage = 1;
      let totalPages = 1;

      if (data?.ok && data?.data) {
        
        items = Array.isArray(data.data.items) ? data.data.items : [];
        currentPage = Number(data.data.page || 1);
        const total = Number(data.data.total || items.length);
        const lim = Number(data.data.limit || limit);
        totalPages = Math.max(1, Math.ceil(total / Math.max(1, lim)));
      } else if (data?.success) {
        
        items = Array.isArray(data.orders) ? data.orders : (Array.isArray(data.data?.orders) ? data.data.orders : []);
        currentPage = Number(data.page || data.data?.page || 1);
        totalPages = Number(data.totalPages || data.data?.totalPages || 1);
      } else if (Array.isArray(data?.items)) {
        
        items = data.items;
        currentPage = Number(data.page || 1);
        totalPages = Number(data.totalPages || 1);
      } else {
        throw new Error(data?.message || 'Failed to load orders');
      }

      const emptyMessage = archivedFilter === 'archived'
        ? 'No archived orders found'
        : archivedFilter === 'active'
          ? 'No active orders found'
          : 'No orders found';

      if (!items.length) {
        showEmpty(emptyMessage);
        hideLoadingState();
        return;
      }

      renderOrdersTable(items);
      lastLoadedPage = currentPage;
      renderPagination(currentPage, totalPages);
      hideLoadingState();
    } catch (err) {
      console.error('fetchOrders error', err);
      showEmpty(err.message || 'Error fetching orders');
      hideLoadingState();
    }
  }

  function renderOrdersTable(orders) {
    const tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    orders.forEach((order) => {
      const tr = document.createElement('tr');
	  tr.dataset.id = order._id;
	  tr.dataset.status = order.status;
	  const isArchived = Boolean(order.isArchived);
	  tr.dataset.archived = String(isArchived);
	  tr.className = `order-row status-${order.status} ${isArchived ? 'archived' : ''}`;
      tr.tabIndex = 0;
      tr.setAttribute('role', 'button');
      tr.setAttribute(
        'aria-label',
        `Open order ${order.orderNumber || (order._id || '').slice(-8)}`
      );

      const created = new Date(order.createdAt || Date.now()).toLocaleDateString(
        'en-US',
        { year: 'numeric', month: 'short', day: 'numeric' }
      );

      const isGuest = !(order.user && order.user._id);
      const name = order.user
        ? `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim()
        : (order.customerInfo
            ? `${order.customerInfo.firstName || ''} ${order.customerInfo.lastName || ''}`.trim()
            : 'N/A');
      const email = order.user?.email || order.customerInfo?.email || '';
      const badgeHtml = isArchived
        ? '<span class="guest-badge archived">Archived</span>'
        : (isGuest ? '<span class="guest-badge">Guest</span>' : '<span class="user-badge">Customer</span>');

      tr.innerHTML = `
        <td class="order-id-cell">
          <div class="order-number">
            <i class="fas fa-receipt" aria-hidden="true"></i>
            ${order.orderNumber || (order._id || '').slice(-8)}
          </div>
          <div class="order-full-id">${order._id || ''}</div>
        </td>
        <td class="customer-cell">
          <div class="customer-name">
            <i class="fas fa-user" aria-hidden="true"></i>
            ${name || 'N/A'}
            ${badgeHtml}
          </div>
          <div class="customer-email">${email}</div>
        </td>
        <td class="date-cell">
          <i class="fas fa-calendar-alt" aria-hidden="true"></i>
          <time datetime="${order.createdAt || ''}">${created}</time>
        </td>
        <td class="amount-cell">
          <i class="fas fa-dollar-sign" aria-hidden="true"></i>
          <span class="order-amount">${Number(order.totalAmount || order.total || 0).toFixed(2)}</span>
        </td>
        <td class="status-cell">
          <div class="status-container">
            <i class="fas ${getStatusIcon(order.status)}" aria-hidden="true"></i>
            <select class="filter-select order-status-select status-${order.status}" 
                    data-id="${order._id}" 
                    aria-label="Update order status" ${isArchived ? 'disabled' : ''}>
              ${getStatusOptions(order.status)}
            </select>
          </div>
        </td>
        <td class="actions-cell">
          <div class="action-buttons">
            <button class="action-btn view-btn" 
                    data-id="${order._id}" 
                    data-order-number="${order.orderNumber || (order._id || '').slice(-8)}"
                    title="View Details"
                    aria-label="View order details">
              <i class="fa-solid fa-eye"></i>
              <span class="action-text">View</span>
            </button>
            ${isArchived
              ? `<button class="action-btn unarchive-btn" data-id="${order._id}" title="Unarchive Order" aria-label="Unarchive order">
                  <i class="fa-solid fa-box-open"></i>
                  <span class="action-text">Restore</span>
                </button>`
              : `<button class="action-btn archive-btn" data-id="${order._id}" title="Archive Order" aria-label="Archive order">
                  <i class="fa-solid fa-box-archive"></i>
                  <span class="action-text">Archive</span>
                </button>`}
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });

    document.getElementById('orders-empty')?.style && (document.getElementById('orders-empty').style.display = 'none');
    attachRowEvents();
  }

  function getStatusIcon(status) {
    const statusIcons = {
      'pending': 'fa-clock',
      'confirmed': 'fa-check',
      'processing': 'fa-cog',
      'shipped': 'fa-shipping-fast',
      'delivered': 'fa-check-circle',
      'completed': 'fa-check-double',
      'cancelled': 'fa-times-circle',
      'refunded': 'fa-undo',
    };
    return statusIcons[status] || 'fa-info-circle';
  }

  function getStatusOptions(current) {
    const statuses = [
      ['pending', 'Pending', 'fa-clock'],
      ['confirmed', 'Confirmed', 'fa-check'],
      ['processing', 'Processing', 'fa-cog'],
      ['shipped', 'Shipped', 'fa-shipping-fast'],
      ['delivered', 'Delivered', 'fa-check-circle'],
      ['completed', 'Completed', 'fa-check-double'],
      ['cancelled', 'Cancelled', 'fa-times-circle'],
      ['refunded', 'Refunded', 'fa-undo'],
    ];
    return statuses
      .map(
        ([v, l, icon]) => `<option value="${v}" ${v === current ? 'selected' : ''} data-icon="${icon}">${l}</option>`
      )
      .join('');
  }

  function attachRowEvents() {
    
    document.querySelectorAll('#ordersTable tbody tr').forEach((row) => {
      if (row.__bound) return;
      row.__bound = true;
      row.addEventListener('click', (e) => {
        if (e.target.closest('.order-status-select') || e.target.closest('.action-buttons')) return;
        fetchAndShowOrder(row.dataset.id);
      });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fetchAndShowOrder(row.dataset.id);
        }
      });
    });

    document.querySelectorAll('.order-status-select').forEach((sel) => {
      if (sel.__bound) return;
      sel.__bound = true;
      sel.addEventListener('change', handleStatusChange);
    });

    document.querySelectorAll('.view-btn').forEach((btn) => {
      if (btn.__bound) return;
      btn.__bound = true;
      btn.addEventListener('click', handleViewOrder);
    });
    document.querySelectorAll('.archive-btn').forEach((btn) => {
      if (btn.__bound) return;
      btn.__bound = true;
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        archiveOrder(btn.dataset.id);
      });
    });
    document.querySelectorAll('.unarchive-btn').forEach((btn) => {
      if (btn.__bound) return;
      btn.__bound = true;
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        unarchiveOrder(btn.dataset.id);
      });
    });
  }

  const __rowLoading = new Set();
  async function fetchAndShowOrder(id) {
    if (!id || __rowLoading.has(id)) return;
    __rowLoading.add(id);
    const row = document.querySelector(`tr[data-id="${id}"]`);
    row?.classList.add('order-row-loading');

    try {
      showStatusMessage('Loading order details...', 'info');
      const res = await apiGet(`${ORDERS_ENDPOINT}/${id}`);
      const order = res?.order || res?.data || res?.data?.order || res;
      if (!(res?.ok || res?.success) || !order || !order._id) {
        throw new Error(res?.message || 'Order not found');
      }
      showOrderDetailsModal(order);
    } catch (e) {
      console.error('detail error', e);
      showStatusMessage(e.message, 'error');
      alert(`Failed to load order: ${e.message}`);
    } finally {
      row?.classList.remove('order-row-loading');
      __rowLoading.delete(id);
    }
  }

  let lastViewedOrder = null;

  function getItemImage(item) {
    const prod = item.product || item.productId || item.productRef;
    let url =
      prod?.imageUrl ||
      prod?.image ||
      (Array.isArray(prod?.images) ? prod.images[0] : null) ||
      item.imageUrl;
    if (url && !url.startsWith('http') && !url.startsWith('data:')) {
      const base =
        (typeof CONFIG !== 'undefined' && CONFIG.API_URL)
          ? CONFIG.API_URL.replace(/\/api$/, '')
          : '';
      url = url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
    }
    return url || '../assets/images/placeholder.png';
  }

  function normalizeOrderItems(order) {
    const raw = order.items || order.orderItems || order.products || [];
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => {
      const prod = item.product || item.productId || item.productRef || {};
      const qty = Number(item.quantity ?? item.qty ?? item.count ?? 1) || 1;
      const price = Number(item.price ?? item.unitPrice ?? prod.price ?? 0) || 0;
      const total = Number(item.total ?? qty * price) || qty * price;
      return {
        name: item.name || prod.name || 'Unknown Product',
        description: prod.description || item.description || '',
        quantity: qty,
        unitPrice: price,
        total,
        productId: prod._id || prod.id || item.productId || '',
        image: getItemImage(item),
      };
    });
  }

  function createOrderDetailsModal(order) {
    const items = normalizeOrderItems(order);
    const subtotal =
      order.subtotal != null
        ? Number(order.subtotal)
        : order.subTotal != null
          ? Number(order.subTotal)
          : items.reduce((sum, i) => sum + i.total, 0);
    const tax = Number(order.tax ?? order.taxAmount ?? 0) || 0;
    const shipping = Number(order.shipping ?? order.shippingCost ?? 0) || 0;
    const computed = subtotal + tax + shipping;
    const backendTotal = Number(order.totalAmount ?? order.total ?? computed);
    const grandTotal =
      Math.abs(backendTotal - computed) > 0.01 ? computed : backendTotal;
    const created = new Date(order.createdAt || order.date || Date.now()).toLocaleString(
      'en-US',
      { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    );

    const isGuest = !order.user || !order.user._id;
    const customer = order.user || order.customerInfo || {};
    const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'N/A';
    const customerEmail = customer.email || 'N/A';
    const customerPhone = customer.phone || 'N/A';
  const archivedBadge = order.isArchived ? '<span class="guest-badge archived">Archived</span>' : '';
  const statusControlsDisabled = order.isArchived ? 'disabled' : '';

    const addr = order.shippingAddress || order.address;
    let shippingHtml = 'No shipping address provided';
    if (addr) {
      if (typeof addr === 'string') {
        shippingHtml = `<p>${addr}</p>`;
      } else {
        shippingHtml = `
          <p>${[addr.street, addr.apartmentSuite].filter(Boolean).join(', ')}</p>
          <p>${[addr.city, addr.state, addr.zipCode || addr.postalCode].filter(Boolean).join(', ')}</p>
          <p>${addr.country || ''}</p>
        `;
      }
    }

    const itemsRows = items.length
      ? items
          .map(
            (item) => `
      <tr>
        <td>
          <div>
            <div>
              <strong>${item.name}</strong>
              ${item.productId ? `<div style="font-size:11px;color:#666;">ID: ${item.productId}</div>` : ''}
              ${item.description ? `<div class="desc">${item.description}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="text-right">${item.quantity}</td>
        <td class="text-right">$${item.unitPrice.toFixed(2)}</td>
        <td class="text-right">$${item.total.toFixed(2)}</td>
      </tr>
    `
          )
          .join('')
      : '<tr><td colspan="4" style="text-align:center;color:#777;padding:16px;">No items found</td></tr>';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'order-details-title');
    modal.innerHTML = `
      <div class="modal-content large">
        <div class="modal-header">
          <div class="modal-title-container">
            <i class="fas fa-shopping-cart" aria-hidden="true"></i>
            <h3 id="order-details-title">Order #${order.orderNumber || order._id?.slice(-8) || 'N/A'} ${archivedBadge}</h3>
          </div>
          <button class="close-modal" aria-label="Close order details">
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="order-details-grid">
            <div class="detail-section">
              <h4>Order Info</h4>
              <div class="detail-row"><span class="detail-label">ID:</span><span class="detail-value">${order._id || 'N/A'}</span></div>
              <div class="detail-row"><span class="detail-label">Date:</span><span class="detail-value">${created}</span></div>
              <div class="detail-row"><span class="detail-label">Status:</span><span class="detail-value"><span class="status-badge status-${order.status}">${(order.status || '').charAt(0).toUpperCase() + (order.status || '').slice(1)}</span></span></div>
              ${order.isArchived ? '<div class="detail-row"><span class="detail-label">Archive:</span><span class="detail-value">Archived</span></div>' : ''}
              <div class="detail-row"><span class="detail-label">Payment Method:</span><span class="detail-value">${order.paymentMethod || 'N/A'}</span></div>
              <div class="detail-row"><span class="detail-label">Payment Status:</span><span class="detail-value">${order.paymentStatus || 'N/A'}</span></div>
              <div class="detail-row"><span class="detail-label">Items:</span><span class="detail-value">${items.length}</span></div>
            </div>

            <div class="detail-section">
              <h4>Customer ${isGuest ? '<span class="guest-badge">Guest</span>' : '<span class="user-badge">User</span>'}</h4>
              <div class="detail-row"><span class="detail-label">Name:</span><span class="detail-value">${customerName}</span></div>
              <div class="detail-row"><span class="detail-label">Email:</span><span class="detail-value">${customerEmail}</span></div>
              <div class="detail-row"><span class="detail-label">Phone:</span><span class="detail-value">${customerPhone}</span></div>
              ${!isGuest && customer._id ? `<div class="detail-row"><span class="detail-label">User ID:</span><span class="detail-value">${customer._id}</span></div>` : ''}
            </div>

            <div class="detail-section full-width">
              <h4>Shipping Address</h4>
              <div class="address-block">${shippingHtml}</div>
            </div>

            <div class="detail-section full-width">
              <h4>Items</h4>
              <table class="items-table">
                <colgroup>
                  <col style="width:60%">
                  <col style="width:10%">
                  <col style="width:15%">
                  <col style="width:15%">
                </colgroup>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th class="text-right">Qty</th>
                    <th class="text-right">Price</th>
                    <th class="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>${itemsRows}</tbody>
                <tfoot>
                  <tr><td colspan="3" class="text-right">Subtotal:</td><td class="text-right">$${subtotal.toFixed(2)}</td></tr>
                  <tr><td colspan="3" class="text-right">Tax:</td><td class="text-right">$${tax.toFixed(2)}</td></tr>
                  <tr><td colspan="3" class="text-right">Shipping:</td><td class="text-right">$${shipping.toFixed(2)}</td></tr>
                  <tr class="total-row"><td colspan="3" class="text-right"><strong>Grand Total:</strong></td><td class="text-right"><strong>$${grandTotal.toFixed(2)}</strong></td></tr>
                </tfoot>
              </table>
            </div>

            <div class="detail-section full-width">
              <h4>Update Status</h4>
              <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
                <select id="orderStatusUpdate" class="filter-select" style="flex:1;min-width:180px;" ${statusControlsDisabled}>
                  ${getStatusOptions(order.status)}
                </select>
                <button id="updateStatusBtn" class="btn btn-primary" style="min-width:150px;" ${statusControlsDisabled}>
                  <i class="fas fa-save"></i> Save
                </button>
              </div>
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;${order.isArchived ? 'opacity:0.6;' : ''}">
                <input type="checkbox" id="sendEmailNotification" ${order.isArchived ? 'disabled' : 'checked'}>
                Send email notification
              </label>
              ${order.isArchived ? '<p class="archived-hint">Archived orders cannot be updated until they are unarchived.</p>' : ''}
            </div>
          </div>

        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary close-modal">
            <i class="fas fa-times" aria-hidden="true"></i>
            Close
          </button>
          <button class="btn btn-primary" id="printOrderBtn">
            <i class="fas fa-print" aria-hidden="true"></i>
            Print
          </button>
        </div>
      </div>
    `;
    return modal;
  }

  function closeOrderDetailsModal(element) {
    const modal = element.closest?.('.modal') || element;
    if (!modal || !modal.classList) return;
    modal.classList.remove('active');
    setTimeout(() => modal.parentNode && modal.parentNode.removeChild(modal), 300);
  }

  function showOrderDetailsModal(order) {
    lastViewedOrder = order;
    const modal = createOrderDetailsModal(order);
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));

    const closeModal = () => closeOrderDetailsModal(modal);
    modal.querySelector('.close-modal')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.querySelector('#printOrderBtn')?.addEventListener('click', printOrderDetails);

    const updateBtn = modal.querySelector('#updateStatusBtn');
    if (updateBtn && !updateBtn.disabled) {
      updateBtn.addEventListener('click', async () => {
        const select = modal.querySelector('#orderStatusUpdate');
        const sendEmail = modal.querySelector('#sendEmailNotification')?.checked;
        if (!select) return;
        const newStatus = select.value;
        if (newStatus === order.status) {
          showStatusMessage('Status unchanged', 'info');
          return;
        }
        try {
          showStatusMessage('Updating order status...', 'info');
          document.getElementById('globalLoadingOverlay')?.classList.add('active');

          const res = await apiPut(`${ORDERS_ENDPOINT}/${order._id}/status`, { 
            status: newStatus,
            sendEmail: sendEmail 
          });
          
          if (!(res?.ok || res?.success)) throw new Error(res?.message || 'Failed to update order');

          showStatusMessage('Order status updated successfully', 'success');
          closeModal();
          fetchOrders();
        } catch (err) {
          console.error('Status update error:', err);
          showStatusMessage(`Error: ${err.message}`, 'error');
        } finally {
          document.getElementById('globalLoadingOverlay')?.classList.remove('active');
        }
      });
    } else if (order.isArchived) {
      showStatusMessage('This order is archived. Unarchive it to update status.', 'info');
    }
  }

  function printOrderDetails() {
    try {
      if (!lastViewedOrder) {
        console.error('No order data available for printing');
        return;
      }

      if (window.PrintUtils) {
        window.PrintUtils.printOrder(lastViewedOrder);
      } else {
        
        console.warn('PrintUtils not available, using fallback print method');
        printOrderDetailsFallback();
      }
    } catch (error) {
      console.error('Error printing order details:', error);
      showStatusMessage('Failed to print order details', 'error');
    }
  }

  function printOrderDetailsFallback() {
    if (!lastViewedOrder) return;
    const body = document.querySelector('.modal .modal-body');
    if (!body) return;

    const popup = window.open('', '_blank', 'width=900,height=1000');
    popup.document.write(`
      <html>
        <head>
          <title>Order ${lastViewedOrder.orderNumber || lastViewedOrder._id?.slice(-8) || ''}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 20px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #ccc; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f5f5f5; }
            img { max-width: 50px; max-height: 50px; object-fit: contain; }
          </style>
        </head>
        <body>
          <h1>Order ${lastViewedOrder.orderNumber || lastViewedOrder._id?.slice(-8) || ''}</h1>
          <div>Printed: ${new Date().toLocaleString()}</div>
          ${body.innerHTML}
          <script>window.print(); setTimeout(() => window.close(), 300);<\/script>
        </body>
      </html>
    `);
    popup.document.close();
  }

  async function handleStatusChange(e) {
    const sel = e.target;
    const id = sel.dataset.id;
    const newStatus = sel.value;
    const prev = sel.dataset.prev || sel.defaultValue;
    const row = sel.closest('tr');
    if (row?.dataset.archived === 'true') {
      sel.value = prev || row.dataset.status;
      showStatusMessage('Archived orders cannot change status', 'error');
      return;
    }
    try {
      showStatusMessage('Updating status...', 'info');
      const res = await apiPut(`${ORDERS_ENDPOINT}/${id}/status`, { status: newStatus });
      if (!(res?.ok || res?.success)) throw new Error(res?.message || 'Update failed');
      sel.dataset.prev = newStatus;
      if (row) {
        const isArchivedRow = row.dataset.archived === 'true';
        row.className = `order-row status-${newStatus} ${isArchivedRow ? 'archived' : ''}`;
        row.dataset.status = newStatus;

        const statusIcon = row.querySelector('.status-container i');
        if (statusIcon) {
          statusIcon.className = `fas ${getStatusIcon(newStatus)}`;
        }
      }
      showStatusMessage('Status updated', 'success');
    } catch (err) {
      console.error('status error', err);
      sel.value = prev;
      showStatusMessage(err.message, 'error');
    }
  }

  async function handleViewOrder(event) {
    const button = event.target.closest('.view-btn');
    if (!button) return;
    const orderId = button.dataset.id;
    if (!orderId) return;

    const originalHTML = button.innerHTML;
    button.disabled = true;
  button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
      showStatusMessage('Loading order details...', 'info');
      const response = await apiGet(`${ORDERS_ENDPOINT}/${orderId}`);
      const order = response?.order || response?.data || response?.data?.order;
      if (!(response?.ok || response?.success) || !order) {
        throw new Error(response?.message || 'Order not found');
      }
      showOrderDetailsModal(order);
    } catch (error) {
      console.error('Error fetching order details:', error);
      showStatusMessage(`Failed to load order: ${error.message}`, 'error');
      alert(`Failed to load order details: ${error.message}`);
      if (error.status === 401 || error.status === 403) {
        window.auth?.clearAuth?.();
        window.location.href = 'user_login.html?error=session_expired';
      }
    } finally {
      button.disabled = false;
      button.innerHTML = originalHTML;
    }
  }

  async function archiveOrder(id) {
    if (!id) return;
    const confirmed = await showConfirmDialog(
      'Archive Order',
      'Archive this order? You can unarchive it later from the Archive filter.'
    );
    if (!confirmed) return;
    try {
      showStatusMessage('Archiving...', 'info');
      showLoadingState();
      const res = await apiPatch(`${ORDERS_ENDPOINT}/${id}/archive`, {});
      if (!(res?.ok || res?.success)) throw new Error(res?.message || 'Archive failed');
      showStatusMessage('Order archived', 'success');
      fetchOrders(lastLoadedPage);
    } catch (err) {
      console.error('archive error', err);
      showStatusMessage(err.message, 'error');
    } finally {
      hideLoadingState();
    }
  }

  async function unarchiveOrder(id) {
    if (!id) return;
    try {
      showStatusMessage('Unarchiving...', 'info');
      showLoadingState();
      const res = await apiPatch(`${ORDERS_ENDPOINT}/${id}/unarchive`, {});
      if (!(res?.ok || res?.success)) throw new Error(res?.message || 'Unarchive failed');
      showStatusMessage('Order unarchived', 'success');
      fetchOrders(lastLoadedPage);
    } catch (err) {
      console.error('unarchive error', err);
      showStatusMessage(err.message, 'error');
    } finally {
      hideLoadingState();
    }
  }

  async function sendOrderStatusEmail(orderId, status, emailAddress) {
    if (!emailAddress) {
      showStatusMessage('Cannot send email: no email address available', 'error');
      return;
    }
    try {
      showStatusMessage('Sending email notification...', 'info');
      const r = await fetch(`${API_BASE}/admin/orders/${orderId}/send-status-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('authToken')
            ? { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
            : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ status, email: emailAddress }),
      });
      const data = await r.json();
      if (r.ok && (data?.success || data?.ok)) {
        showStatusMessage('Email notification sent successfully', 'success');
      } else {
        throw new Error(data?.message || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      showStatusMessage(`Error sending email: ${error.message}`, 'error');
    }
  }

  function renderPagination(currentPage, totalPages) {
    const container = document.getElementById('ordersPagination');
    if (!container) return;
    
    if (!window.__ordersPager) {
      window.__ordersPager = window.Pagination && window.Pagination.create({
        container,
        onPage: (page) => fetchOrders(page)
      });
    }
    const pager = window.__ordersPager;
    if (!pager) {
      
      container.innerHTML = '';
      container.style.display = totalPages > 1 ? 'flex' : 'none';
      return;
    }
    pager.render({ currentPage, totalPages, totalItems: 0, limit: 10 });
  }

  function checkEmptyState() {
    const tbody = document.querySelector('#ordersTable tbody');
    if (tbody && tbody.children.length === 0) showEmpty('No orders to display');
  }

  function showLoadingState() {
    const spinner = document.getElementById('ordersLoadingSpinner');
    const table = document.getElementById('ordersTable');
    if (spinner) spinner.style.display = 'block';
    if (table) table.style.display = 'none';
    hideEmptyState();
  }

  function hideLoadingState() {
    const spinner = document.getElementById('ordersLoadingSpinner');
    const table = document.getElementById('ordersTable');
    if (spinner) spinner.style.display = 'none';
    if (table) table.style.display = 'table';
  }

  function showEmpty(message, description) {
    const empty = document.getElementById('orders-empty');
    const table = document.getElementById('ordersTable');
    const heading = message ? String(message) : 'No orders found';
    const details = description ?? 'Try adjusting your filters or check back later.';

    if (empty) {
      empty.innerHTML = `
        <div class="empty-content">
          <i class="fa-solid fa-cart-shopping"></i>
          <h3>${heading}</h3>
          <p>${details ? String(details) : ''}</p>
        </div>
      `;
      empty.style.display = 'block';
    }
    if (table) table.style.display = 'none';
    hideLoadingState();
  }

  function hideEmptyState() {
    const empty = document.getElementById('orders-empty');
    if (empty) empty.style.display = 'none';
  }

  function showStatusMessage(message, type = 'info') {
    const el = document.getElementById('ordersStatusMessage');
    if (!el) return;
    el.className = `status-message ${type}`;
    el.textContent = message;
    el.style.display = 'block';
    if (type === 'success' || type === 'info') {
      setTimeout(() => (el.style.display = 'none'), 3000);
    }
  }

  function showConfirmDialog(title, message) {
    return Promise.resolve(confirm(`${title}\n\n${message}`));
  }

  async function exportOrdersToCSV() {
    try {
      showStatusMessage('Preparing export...', 'info');

      const status = document.getElementById('orderStatusFilter')?.value || '';
      const archived = document.getElementById('orderArchiveFilter')?.value || 'active';
      const search = document.getElementById('orderSearch')?.value?.trim() || '';
      
      const params = new URLSearchParams({
        limit: 1000, 
        sort: 'newest'
      });
      
      if (status) params.append('status', status);
      if (search) params.append('search', search);
      params.append('archived', archived === 'archived' ? 'true' : 
                                archived === 'all' ? 'all' : 'false');
      
      const data = await apiGet(`${ORDERS_ENDPOINT}?${params.toString()}`);
      let orders = [];
      
      if (data?.ok && data?.data) {
        orders = Array.isArray(data.data.items) ? data.data.items : [];
      } else if (data?.success) {
        orders = Array.isArray(data.orders) ? data.orders : (Array.isArray(data.data?.orders) ? data.data.orders : []);
      } else if (Array.isArray(data?.items)) {
        orders = data.items;
      }
      
      if (!orders.length) {
        showStatusMessage('No orders found to export', 'warning');
        return;
      }

      const csvContent = convertOrdersToCSV(orders);
      downloadCSV(csvContent, `orders-export-${new Date().toISOString().split('T')[0]}.csv`);
      
      showStatusMessage(`Exported ${orders.length} orders successfully`, 'success');
    } catch (error) {
      console.error('Export error:', error);
      showStatusMessage(`Export failed: ${error.message}`, 'error');
    }
  }
  
  function convertOrdersToCSV(orders) {
    const headers = [
      'Order ID',
      'Order Number', 
      'Customer Name',
      'Customer Email',
      'Date',
      'Status',
      'Total Amount',
      'Items Count',
      'Payment Method',
      'Payment Status',
      'Archived'
    ];
    
    const rows = orders.map(order => {
      const customer = order.user || order.customerInfo || {};
      const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'N/A';
      const customerEmail = customer.email || 'N/A';
      const date = new Date(order.createdAt || Date.now()).toLocaleDateString();
      const itemsCount = (order.items || order.orderItems || order.products || []).length;
      
      return [
        order._id || '',
        order.orderNumber || '',
        customerName,
        customerEmail,
        date,
        order.status || '',
        Number(order.totalAmount || order.total || 0).toFixed(2),
        itemsCount,
        order.paymentMethod || '',
        order.paymentStatus || '',
        order.isArchived ? 'Yes' : 'No'
      ];
    });
    
    const csvRows = [headers, ...rows];
    return csvRows.map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
  }
  
  function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }

  async function handlePrintOrdersList() {
    try {
      
      const response = await apiGet(`${ORDERS_ENDPOINT}?page=1&limit=1000`);
      if (response && response.success && response.orders) {
        
        let filteredOrders = response.orders;

        const statusFilter = document.getElementById('orderStatusFilter');
        if (statusFilter && statusFilter.value) {
          filteredOrders = filteredOrders.filter(order => 
            order.status === statusFilter.value
          );
        }

        const archiveFilter = document.getElementById('orderArchiveFilter');
        if (archiveFilter && archiveFilter.value === 'active') {
          filteredOrders = filteredOrders.filter(order => !order.archived);
        } else if (archiveFilter && archiveFilter.value === 'archived') {
          filteredOrders = filteredOrders.filter(order => order.archived);
        }

        const searchInput = document.getElementById('orderSearch');
        if (searchInput && searchInput.value.trim()) {
          const searchTerm = searchInput.value.trim().toLowerCase();
          filteredOrders = filteredOrders.filter(order => 
            order.orderNumber?.toLowerCase().includes(searchTerm) ||
            order.customerName?.toLowerCase().includes(searchTerm) ||
            order.customerEmail?.toLowerCase().includes(searchTerm)
          );
        }

        if (window.PrintUtils) {
          window.PrintUtils.printOrdersList(filteredOrders, {
            status: statusFilter?.value || '',
            archive: archiveFilter?.value || '',
            search: searchInput?.value || ''
          });
        } else {
          console.error('PrintUtils not available');
          showEmpty('Print functionality not available');
        }
      } else {
        showEmpty('No orders data available to print');
      }
    } catch (error) {
      console.error('Error printing orders list:', error);
      showEmpty('Failed to print orders list');
    }
  }

  window.fetchOrders = fetchOrders;
  window.archiveOrder = archiveOrder;
  window.unarchiveOrder = unarchiveOrder;
  window.updateOrderStatus = handleStatusChange;
  window.showOrderDetailsModal = showOrderDetailsModal;
  window.closeOrderDetailsModal = closeOrderDetailsModal;
  window.printOrderDetails = printOrderDetails;
  window.exportOrdersToCSV = exportOrdersToCSV;
  window.handlePrintOrdersList = handlePrintOrdersList;
}
