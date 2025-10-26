document.addEventListener('DOMContentLoaded', () => {
  
  const authCheck =
    (window.auth && typeof window.auth.checkAdminAuth === 'function'
      ? window.auth.checkAdminAuth.bind(window.auth)
      : null) ||
    (window.authUtils && typeof window.authUtils.checkAdminAuth === 'function'
      ? window.authUtils.checkAdminAuth
      : null);

  if (!authCheck || !authCheck()) {
    window.location.href = 'user_login.html?auth=required';
    return;
  }

  const API_URL = `${CONFIG.API_URL}/admin/coupons`;

  const couponsTableBody = document.getElementById('couponsTableBody');
  const couponsStatusMessage = document.getElementById('couponsStatusMessage');
  const couponsLoadingSpinner = document.getElementById('couponsLoadingSpinner');
  const addCouponBtn = document.getElementById('addCouponBtn');
  const couponModal = document.getElementById('couponModal');
  const closeModalBtns = couponModal.querySelectorAll('.close-modal');
  const couponForm = document.getElementById('couponForm');
  const couponModalTitle = document.getElementById('couponModalTitle');
  const saveCouponBtn = document.getElementById('saveCouponBtn');

  const minimumOrderAmountInput = document.getElementById('minimumOrderAmount');
  const expirationDateInput = document.getElementById('expirationDate');
  const usageLimitInput = document.getElementById('usageLimit');
  const perUserLimitInput = document.getElementById('perUserLimit');

  let editingCouponId = null;

  function showStatusMessage(message, type = 'error', duration = 4000) {
    couponsStatusMessage.textContent = message;
    couponsStatusMessage.className = `status-message ${type}`;
    couponsStatusMessage.style.display = 'block';
    if (type === 'success') {
      setTimeout(() => {
        couponsStatusMessage.style.display = 'none';
      }, duration);
    }
  }

  function clearStatusMessage() {
    couponsStatusMessage.style.display = 'none';
    couponsStatusMessage.textContent = '';
  }

  function showLoading() {
    couponsLoadingSpinner.style.display = 'block';
  }

  function hideLoading() {
    couponsLoadingSpinner.style.display = 'none';
  }

  async function loadCoupons() {
    clearStatusMessage();
    showLoading();
    try {
      
      const statusFilter = document.getElementById('statusFilter')?.value || '';
      const sortFilter = document.getElementById('sortFilter')?.value || '';

      const params = new URLSearchParams();
      if (statusFilter) {
        params.append('isActive', statusFilter);
      }
      if (sortFilter) {
        params.append('sort', sortFilter);
      }

      const url = params.toString() ? `${API_URL}?${params.toString()}` : API_URL;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
      });
      if (!res.ok) throw new Error('Failed to load coupons');
      const data = await res.json();

      renderCoupons(data.coupons || []);
    } catch (err) {
      console.error(err);
      showStatusMessage('Error loading coupons: ' + err.message, 'error');
      couponsTableBody.innerHTML = '';
    } finally {
      hideLoading();
    }
  }

  function renderCoupons(coupons) {
    couponsTableBody.innerHTML = '';

    if (!coupons.length) {
      couponsTableBody.innerHTML = `
        <tr>
          <td colspan="9" class="empty-state">
            <i class="fas fa-ticket-alt"></i><br />
            No coupons found.
          </td>
        </tr>`;
      return;
    }

    coupons.forEach(coupon => {
      const tr = document.createElement('tr');

      const discountDisplay =
        coupon.discountType === '%'
          ? `${coupon.discountValue}%`
          : `$${coupon.discountValue.toFixed(2)}`;

      const minOrderDisplay = coupon.minimumOrderAmount ? `$${Number(coupon.minimumOrderAmount).toFixed(2)}` : '-';
      const expiresDisplay = coupon.expirationDate ? new Date(coupon.expirationDate).toLocaleDateString() : '-';
      const usageLimitDisplay = coupon.usageLimit > 0 ? coupon.usageLimit : 'Unlimited';
      const perUserLimitDisplay = coupon.perUserLimit > 0 ? coupon.perUserLimit : 'Unlimited';

      tr.innerHTML = `
        <td>${coupon.code}</td>
        <td>${discountDisplay}</td>
        <td>${minOrderDisplay}</td>
        <td>${expiresDisplay}</td>
        <td>${usageLimitDisplay}</td>
        <td>${perUserLimitDisplay}</td>
        <td>${coupon.comments || '-'}</td>
        <td>
          <span class="status-badge ${coupon.isActive ? 'active' : 'inactive'}">
            ${coupon.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td>
          <div class="actions">
            <button class="action-btn edit-btn" data-id="${coupon._id}" title="Edit">
              <i class="fas fa-edit"></i>
              <span class="action-text">Edit</span>
            </button>
            <button class="action-btn delete-btn" data-id="${coupon._id}" title="Delete">
              <i class="fas fa-trash" aria-hidden="true"></i>
              <span class="action-text">Delete</span>
            </button>
          </div>
        </td>
      `;

      couponsTableBody.appendChild(tr);
    });

    attachActionButtonsListeners();
  }

  function attachActionButtonsListeners() {
    const editButtons = couponsTableBody.querySelectorAll('.action-btn.edit-btn');
    editButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const couponId = btn.getAttribute('data-id');
        openEditCouponModal(couponId);
      });
    });

    const deleteButtons = couponsTableBody.querySelectorAll('.action-btn.delete-btn');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const couponId = btn.getAttribute('data-id');
        if (typeof window.openConfirmModal === 'function') {
          window.openConfirmModal({
            title: 'Confirm Delete',
            message: 'Are you sure you want to delete this coupon?',
            confirmText: 'Delete',
            danger: true
          }).then(confirmed => { if (confirmed) deleteCoupon(couponId); });
        } else {
          if (confirm('Are you sure you want to delete this coupon?')) deleteCoupon(couponId);
        }
      });
    });
  }

  function openAddCouponModal() {
    editingCouponId = null;
    couponModalTitle.textContent = 'Add New Coupon';
    couponForm.reset();
    clearStatusMessage();
    document.getElementById('isActive').value = 'true';
    minimumOrderAmountInput.value = '';
    expirationDateInput.value = '';
    usageLimitInput.value = '';
    perUserLimitInput.value = '';
    openModal();
  }

  async function openEditCouponModal(couponId) {
    editingCouponId = couponId;
    couponModalTitle.textContent = 'Edit Coupon';
    couponForm.reset();
    clearStatusMessage();
    showLoading();

    try {
      const res = await fetch(`${API_URL}/${couponId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
      });
      if (!res.ok) throw new Error('Failed to load coupon details');
      const data = await res.json();
      const coupon = data.coupon;

      document.getElementById('code').value = coupon.code || '';
      document.getElementById('discountType').value = coupon.discountType || '';
      document.getElementById('discountValue').value = coupon.discountValue ?? '';
      minimumOrderAmountInput.value = coupon.minimumOrderAmount ?? '';
      usageLimitInput.value = coupon.usageLimit ?? '';
      perUserLimitInput.value = coupon.perUserLimit ?? '';
      expirationDateInput.value = coupon.expirationDate ? new Date(coupon.expirationDate).toISOString().split('T')[0] : '';

      document.getElementById('comments').value = coupon.comments || '';
      document.getElementById('isActive').value = coupon.isActive ? 'true' : 'false';

      openModal();
    } catch (err) {
      showStatusMessage('Error loading coupon data: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  }

  async function deleteCoupon(couponId) {
    clearStatusMessage();
    showLoading();
    try {
      const res = await fetch(`${API_URL}/${couponId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
      });
      if (!res.ok) throw new Error('Failed to delete coupon');
      showStatusMessage('Coupon deleted successfully', 'success');
      await loadCoupons();
    } catch (err) {
      showStatusMessage('Error deleting coupon: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  }

  function validateCouponForm(formData) {
    const errors = [];

    if (formData.discountValue < 0) {
      errors.push('Discount value cannot be negative');
    }

    if (formData.discountType === '%' && formData.discountValue > 100) {
      errors.push('Percentage discount cannot exceed 100%');
    }

    const usageLimit = formData.usageLimit || 0;
    const perUserLimit = formData.perUserLimit || 1;

    if (usageLimit > 0 && perUserLimit > 0) {
      if (usageLimit < perUserLimit) {
        errors.push('Total usage limit must be greater than or equal to per-user limit');
      }
    }

    if (usageLimit > 0 && perUserLimit === 0) {
      errors.push('Per-user limit cannot be 0 when total usage limit is set');
    }

    if (formData.expirationDate) {
      const expDate = new Date(formData.expirationDate);
      const now = new Date();
      if (expDate <= now) {
        errors.push('Expiration date must be in the future');
      }
    }

    return errors;
  }

  couponForm.addEventListener('submit', async e => {
    e.preventDefault();
    clearStatusMessage();

    if (!couponForm.reportValidity()) return;

    const formData = {
      code: document.getElementById('code').value.trim().toUpperCase(),
      discountType: document.getElementById('discountType').value,
      discountValue: parseFloat(document.getElementById('discountValue').value),
      comments: document.getElementById('comments').value.trim(),
      isActive: document.getElementById('isActive').value === 'true',
      minimumOrderAmount: minimumOrderAmountInput.value ? parseFloat(minimumOrderAmountInput.value) : 0,
      usageLimit: usageLimitInput.value ? parseInt(usageLimitInput.value) : 0,
      perUserLimit: perUserLimitInput.value ? parseInt(perUserLimitInput.value) : 0,
      expirationDate: expirationDateInput.value || null,
    };

    const validationErrors = validateCouponForm(formData);
    if (validationErrors.length > 0) {
      showStatusMessage('Validation errors: ' + validationErrors.join(', '), 'error');
      return;
    }

    saveCouponBtn.disabled = true;
    if (!window.adminLoader || !window.adminLoader.isOverlayActive()) {
      saveCouponBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;
    } else {
      saveCouponBtn.innerHTML = 'Saving...';
    }

    try {
      let res;
      if (editingCouponId) {
        
        res = await fetch(`${API_URL}/${editingCouponId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          },
          body: JSON.stringify(formData),
        });
      } else {
        
        res = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          },
          body: JSON.stringify(formData),
        });
      }

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to save coupon');
      }

      showStatusMessage(`Coupon ${editingCouponId ? 'updated' : 'created'} successfully`, 'success');
      closeModal();
      await loadCoupons();
    } catch (err) {
      showStatusMessage('Error saving coupon: ' + err.message, 'error');
    } finally {
      saveCouponBtn.disabled = false;
      saveCouponBtn.innerHTML = `<i class="fas fa-save"></i> Save Coupon`;
    }
  });

  function openModal() {
    couponModal.style.display = 'flex';
    requestAnimationFrame(() => {
      couponModal.classList.add('active');
      document.body.classList.add('modal-open');
    });
  }

  function closeModal() {
    couponModal.classList.remove('active');
    document.body.classList.remove('modal-open');
    setTimeout(() => {
      couponModal.style.display = 'none';
    }, 200);
  }

  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  window.addEventListener('click', event => {
    if (event.target === couponModal) closeModal();
  });

  addCouponBtn.addEventListener('click', () => {
    openAddCouponModal();
  });

  const statusFilter = document.getElementById('statusFilter');
  const sortFilter = document.getElementById('sortFilter');

  if (statusFilter) {
    statusFilter.addEventListener('change', loadCoupons);
  }

  if (sortFilter) {
    sortFilter.addEventListener('change', loadCoupons);
  }

  function setupRealTimeValidation() {
    
    usageLimitInput.addEventListener('input', validateUsageLimits);
    perUserLimitInput.addEventListener('input', validateUsageLimits);

    document.getElementById('discountValue').addEventListener('input', validateDiscountValue);

    expirationDateInput.addEventListener('change', validateExpirationDate);
  }

  function validateUsageLimits() {
    const usageLimit = parseInt(usageLimitInput.value) || 0;
    const perUserLimit = parseInt(perUserLimitInput.value) || 0;

    usageLimitInput.classList.remove('error');
    perUserLimitInput.classList.remove('error');

    if (usageLimit > 0 && perUserLimit > 0 && usageLimit < perUserLimit) {
      usageLimitInput.classList.add('error');
      perUserLimitInput.classList.add('error');
      usageLimitInput.setCustomValidity('Total usage limit must be greater than or equal to per-user limit');
      perUserLimitInput.setCustomValidity('Per-user limit cannot be greater than total usage limit');
    } else if (usageLimit > 0 && perUserLimit === 0) {
      perUserLimitInput.classList.add('error');
      perUserLimitInput.setCustomValidity('Per-user limit cannot be 0 when total usage limit is set');
    } else {
      usageLimitInput.setCustomValidity('');
      perUserLimitInput.setCustomValidity('');
    }
  }

  function validateDiscountValue() {
    const discountValue = parseFloat(document.getElementById('discountValue').value) || 0;
    const discountType = document.getElementById('discountType').value;
    const discountInput = document.getElementById('discountValue');

    discountInput.classList.remove('error');

    if (discountValue < 0) {
      discountInput.classList.add('error');
      discountInput.setCustomValidity('Discount value cannot be negative');
    } else if (discountType === '%' && discountValue > 100) {
      discountInput.classList.add('error');
      discountInput.setCustomValidity('Percentage discount cannot exceed 100%');
    } else {
      discountInput.setCustomValidity('');
    }
  }

  function validateExpirationDate() {
    const expDate = new Date(expirationDateInput.value);
    const now = new Date();

    expirationDateInput.classList.remove('error');

    if (expirationDateInput.value && expDate <= now) {
      expirationDateInput.classList.add('error');
      expirationDateInput.setCustomValidity('Expiration date must be in the future');
    } else {
      expirationDateInput.setCustomValidity('');
    }
  }

  if (window.RefreshUtils && window.RefreshUtils.manager) {
    
    window.RefreshUtils.manager.register('refreshCoupons', loadCoupons, {
      normalText: 'Coupons',
      loadingText: 'Refreshing coupons...',
      successText: 'Coupons updated!',
      errorText: 'Failed to refresh'
    });
  }

  setupRealTimeValidation();

  (async function init() {
    showLoading();
    await loadCoupons();
    hideLoading();
  })();
});
