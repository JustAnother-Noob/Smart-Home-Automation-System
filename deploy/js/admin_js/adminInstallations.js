

if (window.__ADMIN_INSTALLATIONS_INITIALIZED__) {
  console.warn('adminInstallations.js duplicate load prevented');
} else {
  window.__ADMIN_INSTALLATIONS_INITIALIZED__ = true;

  const API_BASE =
    (typeof CONFIG !== 'undefined' && CONFIG.API_URL) ? CONFIG.API_URL : '/api';
  const INSTALLATIONS_ENDPOINT = '/admin/installations';

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
  const apiDelete = (p) => apiRequest(p, 'DELETE');
  const apiPost = (p, b) => apiRequest(p, 'POST', b);

  let lastLoadedPage = 1;

  document.addEventListener('DOMContentLoaded', () => {
    try {
      if (window.auth?.checkAdminAuth && !window.auth.checkAdminAuth()) return;
      if (window.auth?.getUserRole && window.auth.getUserRole() !== 'admin') {
        alert('Access denied');
        return;
      }
      initializeInstallationsPage();
    } catch (e) {
      console.error(e);
      showEmpty('Initialization failed');
    }
  });

  function initializeInstallationsPage() {
    if (!window.api?.request && !window.fetch) {
      showEmpty('API not ready');
      return;
    }
    bindStaticUI();
    setupRefresh();
    fetchInstallations(1);
  }

  function bindStaticUI() {
    document
      .getElementById('installationStatusFilter')
      ?.addEventListener('change', () => fetchInstallations(1));
    document
      .getElementById('installationSortBy')
      ?.addEventListener('change', () => fetchInstallations(1));

    const searchInput = document.getElementById('installationSearch');
    
    if (searchInput) {
      searchInput.addEventListener('input', debounce(() => fetchInstallations(1), 300));
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          fetchInstallations(1);
        }
      });
    }

    const exportBtn = document.getElementById('exportInstallationsBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportInstallationsToCSV);
    }

    const printBtn = document.getElementById('printInstallationsList');
    if (printBtn) {
      printBtn.addEventListener('click', handlePrintInstallationsList);
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
        'refreshInstallations',
        () => fetchInstallations(1),
        {
          normalText: 'Installations',
          loadingText: 'Refreshing installations...',
          successText: 'Installations updated!',
          errorText: 'Failed to refresh',
        }
      );
    }
  }

  async function fetchInstallations(page = 1) {
    try {
    showLoadingState();

      let status = document.getElementById('installationStatusFilter')?.value ?? '';
      status = String(status).trim().toLowerCase();
      if (status === 'all') status = '';

      const sort = document.getElementById('installationSortBy')?.value || 'newest';
      const limit = 10;

      const searchQuery = document.getElementById('installationSearch')?.value?.trim() || '';

      const params = new URLSearchParams({ page, limit, sort });
      if (status) params.append('status', status);
      if (searchQuery) params.append('search', searchQuery);

      const url = `${INSTALLATIONS_ENDPOINT}?${params.toString()}`;
      const data = await apiGet(url);

      let items = [];
      let currentPage = 1;
      let totalPages = 1;

      if (data?.ok && data?.data) {
        
        items = Array.isArray(data.data.installations) ? data.data.installations : [];
        currentPage = Number(data.data.page || 1);
        const total = Number(data.data.total || items.length);
        const lim = Number(data.data.limit || limit);
        totalPages = Math.max(1, Math.ceil(total / Math.max(1, lim)));
      } else if (data?.success) {
        
        items = Array.isArray(data.installations) ? data.installations : [];
        currentPage = Number(data.page || data.data?.page || 1);
        totalPages = Number(data.totalPages || data.data?.totalPages || 1);
      } else if (Array.isArray(data?.installations)) {
        
        items = data.installations;
        currentPage = Number(data.page || 1);
        totalPages = Number(data.totalPages || 1);
      } else {
        throw new Error(data?.message || 'Failed to load installations');
      }

      const emptyMessage = 'No installations found';

      if (!items.length) {
        showEmpty(emptyMessage);
        hideLoadingState();
        return;
      }

      renderInstallationsTable(items);
      lastLoadedPage = currentPage;
      renderPagination(currentPage, totalPages);
      hideLoadingState();
    } catch (err) {
      console.error('fetchInstallations error', err);
      showEmpty(err.message || 'Error fetching installations');
        hideLoadingState();
    }
}

function renderInstallationsTable(installations) {
    const tbody = document.querySelector('#installationsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    installations.forEach((installation) => {
      const tr = document.createElement('tr');
      tr.dataset.id = installation._id;
      tr.dataset.status = installation.status;
      tr.className = `installation-row status-${installation.status}`;
      tr.tabIndex = 0;
      tr.setAttribute('role', 'button');
      tr.setAttribute(
        'aria-label',
        `Open installation ${installation.orderNumber || (installation._id || '').slice(-8)}`
      );

      const installDate = new Date(installation.installationDate || Date.now()).toLocaleDateString(
        'en-US',
        { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      );

      const created = new Date(installation.createdAt || Date.now()).toLocaleDateString(
        'en-US',
        { year: 'numeric', month: 'short', day: 'numeric' }
      );

      const name = installation.customerName || 'N/A';
      const email = installation.customerEmail || '';
      const address = installation.address || 'N/A';

      tr.innerHTML = `
        <td class="installation-id-cell">
          <div class="installation-number">
            <i class="fas fa-receipt" aria-hidden="true"></i>
            ${installation.orderNumber || (installation._id || '').slice(-8)}
            </div>
          <div class="installation-full-id">${installation._id || ''}</div>
        </td>
        <td class="customer-cell">
          <div class="customer-name">
            <i class="fas fa-user" aria-hidden="true"></i>
            ${name || 'N/A'}
            </div>
          <div class="customer-email">${email}</div>
        </td>
        <td class="date-cell">
          <i class="fas fa-calendar-alt" aria-hidden="true"></i>
          <time datetime="${installation.installationDate || ''}">${installDate}</time>
        </td>
        <td class="address-cell">
          <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
          <span class="installation-address">${truncateText(address, 50)}</span>
        </td>
        <td class="status-cell">
          <div class="status-container">
            <i class="fas ${getStatusIcon(installation.status)}" aria-hidden="true"></i>
            <select class="filter-select installation-status-select status-${installation.status}" 
                    data-id="${installation._id}" 
                    aria-label="Update installation status">
              ${getStatusOptions(installation.status)}
            </select>
          </div>
        </td>
        <td class="actions-cell">
            <div class="action-buttons">
            <button class="action-btn view-btn" 
                    data-id="${installation._id}" 
                    data-order-number="${installation.orderNumber || (installation._id || '').slice(-8)}"
                    title="View Details"
                    aria-label="View installation details">
              <i class="fa-solid fa-eye"></i>
                    <span class="action-text">View</span>
                </button>
            <button class="action-btn delete-btn" 
                    data-id="${installation._id}" 
                    title="Delete Installation" 
                    aria-label="Delete installation">
              <i class="fa-solid fa-trash"></i>
                    <span class="action-text">Delete</span>
                </button>
            </div>
        </td>
    `;

      tbody.appendChild(tr);
    });

    document.getElementById('installations-empty')?.style && (document.getElementById('installations-empty').style.display = 'none');
    attachRowEvents();
  }

  function getStatusIcon(status) {
    const statusIcons = {
      'pending': 'fa-clock',
      'confirmed': 'fa-check',
      'completed': 'fa-check-double',
      'cancelled': 'fa-times-circle',
    };
    return statusIcons[status] || 'fa-info-circle';
  }

  function getStatusOptions(current) {
    const statuses = [
      ['pending', 'Pending', 'fa-clock'],
      ['confirmed', 'Confirmed', 'fa-check'],
      ['completed', 'Completed', 'fa-check-double'],
      ['cancelled', 'Cancelled', 'fa-times-circle'],
    ];
    return statuses
      .map(
        ([v, l, icon]) => `<option value="${v}" ${v === current ? 'selected' : ''} data-icon="${icon}">${l}</option>`
      )
      .join('');
  }

  function attachRowEvents() {
    
    document.querySelectorAll('#installationsTable tbody tr').forEach((row) => {
      if (row.__bound) return;
      row.__bound = true;
      row.addEventListener('click', (e) => {
        if (e.target.closest('.installation-status-select') || e.target.closest('.action-buttons')) return;
        fetchAndShowInstallation(row.dataset.id);
      });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fetchAndShowInstallation(row.dataset.id);
        }
      });
    });

    document.querySelectorAll('.installation-status-select').forEach((sel) => {
      if (sel.__bound) return;
      sel.__bound = true;
      sel.addEventListener('change', handleStatusChange);
    });

    document.querySelectorAll('.view-btn').forEach((btn) => {
      if (btn.__bound) return;
      btn.__bound = true;
      btn.addEventListener('click', handleViewInstallation);
    });
    document.querySelectorAll('.delete-btn').forEach((btn) => {
      if (btn.__bound) return;
      btn.__bound = true;
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        deleteInstallation(btn.dataset.id);
      });
    });
  }

  const __rowLoading = new Set();
  async function fetchAndShowInstallation(id) {
    if (!id || __rowLoading.has(id)) return;
    __rowLoading.add(id);
    const row = document.querySelector(`tr[data-id="${id}"]`);
    row?.classList.add('installation-row-loading');

    try {
      showStatusMessage('Loading installation details...', 'info');
      const res = await apiGet(`${INSTALLATIONS_ENDPOINT}/${id}`);
      const installation = res?.installation || res?.data || res?.data?.installation || res;
      if (!(res?.ok || res?.success) || !installation || !installation._id) {
        throw new Error(res?.message || 'Installation not found');
      }
      showInstallationDetailsModal(installation);
    } catch (e) {
      console.error('detail error', e);
      showStatusMessage(e.message, 'error');
      alert(`Failed to load installation: ${e.message}`);
    } finally {
      row?.classList.remove('installation-row-loading');
      __rowLoading.delete(id);
    }
  }

  let lastViewedInstallation = null;

  function createInstallationDetailsModal(installation) {
    const installDate = new Date(installation.installationDate || Date.now()).toLocaleString(
      'en-US',
      { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    );
    const created = new Date(installation.createdAt || installation.date || Date.now()).toLocaleString(
      'en-US',
      { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    );

    const customerName = installation.customerName || 'N/A';
    const customerEmail = installation.customerEmail || 'N/A';
    const customerPhone = installation.contactNumber || 'N/A';

    const modal = document.createElement('div');
    modal.id = `installation-modal-${installation._id || Date.now()}`; 
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'installation-details-title');
    modal.innerHTML = `
      <div class="modal-content large">
                <div class="modal-header">
          <div class="modal-title-container">
            <i class="fas fa-tools" aria-hidden="true"></i>
            <h3 id="installation-details-title">Installation #${installation.orderNumber || installation._id?.slice(-8) || 'N/A'}</h3>
          </div>
          <button class="close-modal" aria-label="Close installation details">
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
                </div>
                <div class="modal-body">
          <div class="installation-details-grid">
                        <div class="detail-section">
              <h4>Installation Info</h4>
              <div class="detail-row"><span class="detail-label">ID:</span><span class="detail-value">${installation._id || 'N/A'}</span></div>
              <div class="detail-row"><span class="detail-label">Order Number:</span><span class="detail-value">${installation.orderNumber || 'N/A'}</span></div>
              <div class="detail-row"><span class="detail-label">Created:</span><span class="detail-value">${created}</span></div>
              <div class="detail-row"><span class="detail-label">Status:</span><span class="detail-value"><span class="status-badge status-${installation.status}">${(installation.status || '').charAt(0).toUpperCase() + (installation.status || '').slice(1)}</span></span></div>
              <div class="detail-row"><span class="detail-label">Installation Date:</span><span class="detail-value">${installDate}</span></div>
              <div class="detail-row"><span class="detail-label">Technician:</span><span class="detail-value">${installation.assignedTechnician || 'Not assigned'}</span></div>
                        </div>
                        
                        <div class="detail-section">
              <h4>Customer</h4>
              <div class="detail-row"><span class="detail-label">Name:</span><span class="detail-value">${customerName}</span></div>
              <div class="detail-row"><span class="detail-label">Email:</span><span class="detail-value">${customerEmail}</span></div>
              <div class="detail-row"><span class="detail-label">Phone:</span><span class="detail-value">${customerPhone}</span></div>
                                </div>

            <div class="detail-section full-width">
              <h4>Installation Address</h4>
              <div class="address-block">${installation.address || 'No address provided'}</div>
                                </div>

            <div class="detail-section full-width">
              <h4>Notes</h4>
              <div class="notes-block">${installation.notes || 'No notes'}</div>
                        </div>

            <div class="detail-section full-width">
              <h4>Update Status</h4>
              <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
                <select id="installationStatusUpdate" class="filter-select" style="flex:1;min-width:180px;">
                  ${getStatusOptions(installation.status)}
                                </select>
                <button id="updateStatusBtn" class="btn btn-primary" style="min-width:150px;">
                  <i class="fas fa-save"></i> Save
                                </button>
                            </div>
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;">
                <input type="checkbox" id="sendEmailNotification" checked>
                Send email notification
              </label>
                        </div>
                    </div>

                </div>
                <div class="modal-footer">
          <button type="button" class="btn btn-secondary close-modal">
            <i class="fas fa-times" aria-hidden="true"></i>
            Close
          </button>
          <button class="btn btn-primary" id="printInstallationBtn">
            <i class="fas fa-print" aria-hidden="true"></i>
                        Print
                    </button>
            </div>
        </div>
    `;
    return modal;
  }

  function closeInstallationDetailsModal(element) {
    
    const modal = element?.closest ? element.closest('.modal') : 
                  element?.target?.closest ? element.target.closest('.modal') :
                  element;
    
    if (!modal || !modal.classList) {
      console.warn('closeInstallationDetailsModal: modal element not found');
      return;
    }
    
    modal.classList.remove('active');
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }, 300);
  }

  function showInstallationDetailsModal(installation) {
    lastViewedInstallation = installation;
    const modal = createInstallationDetailsModal(installation);
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));

    const closeModal = () => closeInstallationDetailsModal(modal);
    modal.querySelector('.close-modal')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.querySelector('#printInstallationBtn')?.addEventListener('click', printInstallationDetails);

    const updateBtn = modal.querySelector('#updateStatusBtn');
    if (updateBtn) {
        updateBtn.addEventListener('click', async () => {
            const select = modal.querySelector('#installationStatusUpdate');
        const sendEmail = modal.querySelector('#sendEmailNotification')?.checked;
        if (!select) return;
            const newStatus = select.value;
            if (newStatus === installation.status) {
          showStatusMessage('Status unchanged', 'info');
                return;
            }
        try {
          showStatusMessage('Updating installation status...', 'info');
          document.getElementById('globalLoadingOverlay')?.classList.add('active');

          const res = await apiPut(`${INSTALLATIONS_ENDPOINT}/${installation._id}/status`, { 
            status: newStatus,
            sendEmail: sendEmail 
          });
          
          if (!(res?.ok || res?.success)) throw new Error(res?.message || 'Failed to update installation');

          showStatusMessage('Installation status updated successfully', 'success');
          closeModal();
          fetchInstallations();
        } catch (err) {
          console.error('Status update error:', err);
          showStatusMessage(`Error: ${err.message}`, 'error');
        } finally {
          document.getElementById('globalLoadingOverlay')?.classList.remove('active');
        }
        });
    }
  }

  function printInstallationDetails() {
    try {
      if (!lastViewedInstallation) {
        console.error('No installation data available for printing');
        return;
      }

        if (window.PrintUtils) {
        window.PrintUtils.printInstallation(lastViewedInstallation);
        } else {
            
            console.warn('PrintUtils not available, using fallback print method');
        printInstallationDetailsFallback();
        }
    } catch (error) {
        console.error('Error printing installation details:', error);
      showStatusMessage('Failed to print installation details', 'error');
    }
  }

  function printInstallationDetailsFallback() {
    if (!lastViewedInstallation) return;
    const body = document.querySelector('.modal .modal-body');
    if (!body) return;

    const popup = window.open('', '_blank', 'width=900,height=1000');
    popup.document.write(`
        <html>
          <head>
          <title>Installation ${lastViewedInstallation.orderNumber || lastViewedInstallation._id?.slice(-8) || ''}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 20px; margin-bottom: 10px; }
            .detail-row { margin: 8px 0; }
            .detail-label { font-weight: bold; }
          </style>
          </head>
          <body>
          <h1>Installation ${lastViewedInstallation.orderNumber || lastViewedInstallation._id?.slice(-8) || ''}</h1>
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
    
    try {
      showStatusMessage('Updating status...', 'info');
      const res = await apiPut(`${INSTALLATIONS_ENDPOINT}/${id}/status`, { status: newStatus });
      if (!(res?.ok || res?.success)) throw new Error(res?.message || 'Update failed');
      sel.dataset.prev = newStatus;
      if (row) {
        row.className = `installation-row status-${newStatus}`;
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

  async function handleViewInstallation(event) {
    const button = event.target.closest('.view-btn');
    if (!button) return;
    const installationId = button.dataset.id;
    if (!installationId) return;

    const originalHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
      showStatusMessage('Loading installation details...', 'info');
      const response = await apiGet(`${INSTALLATIONS_ENDPOINT}/${installationId}`);
      const installation = response?.installation || response?.data || response?.data?.installation;
      if (!(response?.ok || response?.success) || !installation) {
        throw new Error(response?.message || 'Installation not found');
      }
      showInstallationDetailsModal(installation);
    } catch (error) {
      console.error('Error fetching installation details:', error);
      showStatusMessage(`Failed to load installation: ${error.message}`, 'error');
      alert(`Failed to load installation details: ${error.message}`);
      if (error.status === 401 || error.status === 403) {
        window.auth?.clearAuth?.();
        window.location.href = 'user_login.html?error=session_expired';
      }
    } finally {
      button.disabled = false;
      button.innerHTML = originalHTML;
    }
  }

  async function deleteInstallation(id) {
    if (!id) return;
    const confirmed = await showConfirmDialog(
      'Delete Installation',
      'Delete this installation? This action cannot be undone.'
    );
    if (!confirmed) return;
    try {
      showStatusMessage('Deleting...', 'info');
      showLoadingState();
      const res = await apiDelete(`${INSTALLATIONS_ENDPOINT}/${id}`);
      if (!(res?.ok || res?.success)) throw new Error(res?.message || 'Delete failed');
      showStatusMessage('Installation deleted', 'success');
      fetchInstallations(lastLoadedPage);
    } catch (err) {
      console.error('delete error', err);
      showStatusMessage(err.message, 'error');
    } finally {
      hideLoadingState();
    }
  }

  async function sendInstallationStatusEmail(installationId, status, emailAddress) {
    if (!emailAddress) {
      showStatusMessage('Cannot send email: no email address available', 'error');
      return;
    }
    try {
      showStatusMessage('Sending email notification...', 'info');
      const r = await fetch(`${API_BASE}/admin/installations/${installationId}/send-status-email`, {
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
    const container = document.getElementById('installationsPagination');
    if (!container) return;
    
    if (!window.__installationsPager) {
      window.__installationsPager = window.Pagination && window.Pagination.create({
        container,
        onPage: (page) => fetchInstallations(page)
      });
    }
    const pager = window.__installationsPager;
    if (!pager) {
      
      container.innerHTML = '';
      container.style.display = totalPages > 1 ? 'flex' : 'none';
      return;
    }
    pager.render({ currentPage, totalPages, totalItems: 0, limit: 10 });
  }

  function checkEmptyState() {
    const tbody = document.querySelector('#installationsTable tbody');
    if (tbody && tbody.children.length === 0) showEmpty('No installations to display');
  }

  function showLoadingState() {
    const spinner = document.getElementById('installationsLoadingSpinner');
    const table = document.getElementById('installationsTable');
    if (spinner) spinner.style.display = 'block';
    if (table) table.style.display = 'none';
    hideEmptyState();
  }

  function hideLoadingState() {
    const spinner = document.getElementById('installationsLoadingSpinner');
    const table = document.getElementById('installationsTable');
    if (spinner) spinner.style.display = 'none';
    if (table) table.style.display = 'table';
  }

  function showEmpty(message, description) {
    const empty = document.getElementById('installations-empty');
    const table = document.getElementById('installationsTable');
    const heading = message ? String(message) : 'No installations found';
    const details = description ?? 'Try adjusting your filters or check back later.';

    if (empty) {
      empty.innerHTML = `
        <div class="empty-content">
          <i class="fa-solid fa-tools"></i>
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
    const empty = document.getElementById('installations-empty');
    if (empty) empty.style.display = 'none';
  }

  function showStatusMessage(message, type = 'info') {
    const el = document.getElementById('installationsStatusMessage');
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

  function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  async function exportInstallationsToCSV() {
    try {
      showStatusMessage('Preparing export...', 'info');

      const status = document.getElementById('installationStatusFilter')?.value || '';
      const search = document.getElementById('installationSearch')?.value?.trim() || '';
      
      const params = new URLSearchParams({
        limit: 1000, 
        sort: 'newest'
      });
      
      if (status) params.append('status', status);
      if (search) params.append('search', search);
      
      const data = await apiGet(`${INSTALLATIONS_ENDPOINT}?${params.toString()}`);
      let installations = [];
      
      if (data?.ok && data?.data) {
        installations = Array.isArray(data.data.installations) ? data.data.installations : [];
      } else if (data?.success) {
        installations = Array.isArray(data.installations) ? data.installations : [];
      } else if (Array.isArray(data?.installations)) {
        installations = data.installations;
      }
      
      if (!installations.length) {
        showStatusMessage('No installations found to export', 'warning');
        return;
      }

      const csvContent = convertInstallationsToCSV(installations);
      downloadCSV(csvContent, `installations-export-${new Date().toISOString().split('T')[0]}.csv`);
      
      showStatusMessage(`Exported ${installations.length} installations successfully`, 'success');
    } catch (error) {
      console.error('Export error:', error);
      showStatusMessage(`Export failed: ${error.message}`, 'error');
    }
  }
  
  function convertInstallationsToCSV(installations) {
    const headers = [
      'Installation ID',
      'Order Number', 
      'Customer Name',
      'Customer Email',
      'Contact Number',
      'Address',
      'Installation Date',
      'Status',
      'Technician',
      'Created Date'
    ];
    
    const rows = installations.map(installation => {
      const installDate = new Date(installation.installationDate || Date.now()).toLocaleString();
      const createdDate = new Date(installation.createdAt || Date.now()).toLocaleDateString();
      
      return [
        installation._id || '',
        installation.orderNumber || '',
        installation.customerName || '',
        installation.customerEmail || '',
        installation.contactNumber || '',
        installation.address || '',
        installDate,
        installation.status || '',
        installation.assignedTechnician || 'Not assigned',
        createdDate
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

async function handlePrintInstallationsList() {
    try {
        
      const response = await apiGet(`${INSTALLATIONS_ENDPOINT}?page=1&limit=1000`);
        if (response && response.success && response.installations) {
            
            let filteredInstallations = response.installations;

            const statusFilter = document.getElementById('installationStatusFilter');
            if (statusFilter && statusFilter.value) {
                filteredInstallations = filteredInstallations.filter(inst => 
                    inst.status === statusFilter.value
                );
            }

            const searchInput = document.getElementById('installationSearch');
            if (searchInput && searchInput.value.trim()) {
                const searchTerm = searchInput.value.trim().toLowerCase();
                filteredInstallations = filteredInstallations.filter(inst => 
            inst.orderNumber?.toLowerCase().includes(searchTerm) ||
                    inst.customerName?.toLowerCase().includes(searchTerm) ||
            inst.customerEmail?.toLowerCase().includes(searchTerm)
                );
            }

            if (window.PrintUtils) {
                window.PrintUtils.printInstallationsList(filteredInstallations, {
                    status: statusFilter?.value || '',
                    search: searchInput?.value || ''
                });
            } else {
                console.error('PrintUtils not available');
          showEmpty('Print functionality not available');
            }
        } else {
        showEmpty('No installations data available to print');
        }
    } catch (error) {
        console.error('Error printing installations list:', error);
      showEmpty('Failed to print installations list');
    }
  }

  window.fetchInstallations = fetchInstallations;
  window.deleteInstallation = deleteInstallation;
  window.updateInstallationStatus = handleStatusChange;
  window.showInstallationDetailsModal = showInstallationDetailsModal;
  window.closeInstallationDetailsModal = closeInstallationDetailsModal;
  window.printInstallationDetails = printInstallationDetails;
  window.exportInstallationsToCSV = exportInstallationsToCSV;
  window.handlePrintInstallationsList = handlePrintInstallationsList;
}

