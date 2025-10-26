

const API_URL = (window.CONFIG && window.CONFIG.API_URL) ? window.CONFIG.API_URL : '/api';
const usersTableBody = document.getElementById('usersTableBody');
const usersLoadingSpinner = document.getElementById('usersLoadingSpinner');
const usersStatusMessage = document.getElementById('usersStatusMessage');
const activeUsersBtn = document.getElementById('activeUsersBtn');
const archivedUsersBtn = document.getElementById('archivedUsersBtn');
const refreshUsersBtn = document.getElementById('refreshUsers');
const confirmModal = document.getElementById('confirmModal');
const statusChangeModal = document.getElementById('statusChangeModal');

let isViewingArchivedUsers = false;
let currentAdminId = null;

window.adminAutoHideLoader = false;

async function loadUsers() {
    
    usersTableBody.innerHTML = '';
    adminLoader.showSpinner('usersLoadingSpinner');
    AdminStatusMessage.hide(usersStatusMessage);
    
    try {
        let response;
        
        if (isViewingArchivedUsers) {
            
            response = await apiRequest('/auth/archived-users');
            const archivedUsers = response?.users || response?.data?.users || []; 
            if (!archivedUsers.length) {
                adminLoader.hideSpinner('usersLoadingSpinner');
                usersTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="empty-state">
                            <i class="fas fa-archive"></i>
                            <p>No archived users found</p>
                        </td>
                    </tr>
                `;
                return;
            }
            renderArchivedUsers(archivedUsers);
        } else {
            
            response = await apiRequest('/auth/users');
            const activeUsers = response?.users || response?.data?.users || []; 
            if (!activeUsers.length) {
                adminLoader.hideSpinner('usersLoadingSpinner');
                usersTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="empty-state">
                            <i class="fas fa-users"></i>
                            <p>No users found</p>
                        </td>
                    </tr>
                `;
                return;
            }
            renderUsers(activeUsers);
        }
        adminLoader.hideSpinner('usersLoadingSpinner');
    } catch (error) {
        adminLoader.hideSpinner('usersLoadingSpinner');
        AdminStatusMessage.showError(usersStatusMessage, 'Failed to load users: ' + error.message);
    }
}

function renderUsers(users) {
    if (!usersTableBody) return;

    usersTableBody.innerHTML = '';
    
    users.forEach(user => {
        const normalizedStatus = (user.status || 'inactive').toLowerCase();
        const statusDisplay = normalizedStatus === 'active' ? 'Active' : 'Inactive';
        const statusClass = normalizedStatus === 'active' ? 'active' : 'inactive';
        const userId = user._id || user.userId;
        const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim();
        const isAdminRole = (user.role || '').toLowerCase() === 'admin';
        const isCurrentAdmin = currentAdminId && (userId === currentAdminId);
        const canModify = !(isAdminRole || isCurrentAdmin);
        const actionClass = canModify ? 'archive-btn' : 'archive-btn disabled';
        const actionAttributes = canModify
            ? ''
            : ' disabled data-disabled="true" aria-disabled="true" tabindex="-1"';
        const statusClickable = canModify ? 'clickable' : 'locked';
        const statusTooltip = isCurrentAdmin
            ? 'You cannot change your own status.'
            : isAdminRole
                ? 'Admin accounts cannot be deactivated.'
                : '';
        
        const archiveTooltip = isCurrentAdmin
            ? 'You cannot archive your own account'
            : isAdminRole
                ? 'Admin accounts cannot be archived'
                : 'Archive User';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${userName}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>
                <span class="status-badge ${statusClass} ${statusClickable}" data-userid="${userId}" data-username="${userName}" ${statusTooltip ? `title="${statusTooltip}"` : ''}>
                    ${statusDisplay}
                </span>
            </td>
            <td>
                <div class="actions">
                    <button class="btn btn-sm ${actionClass}" data-id="${userId}" title="${archiveTooltip}" aria-label="Archive user ${userName}"${actionAttributes}>
                        <i class="fas fa-archive" aria-hidden="true"></i>
                        <span class="action-text">Archive</span>
                    </button>
                </div>
            </td>
        `;
        
        usersTableBody.appendChild(row);
    });
    
    attachUserActionListeners();
    attachStatusClickListeners();
}

function renderArchivedUsers(users) {
    if (!usersTableBody) return;

    usersTableBody.innerHTML = '';
    
    users.forEach(user => {
        const expiryDate = new Date(user.expiryDate);
        
        const userId = user._id;
        const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim();
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${userName}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>
                <span class="status-badge archived">
                    Archived
                </span>
                <span class="expiry-info" data-expiry="${expiryDate.getTime()}">
                    <i class="fas fa-clock"></i>
                </span>
            </td>
            <td>
                <div class="actions">
                    <button class="btn btn-sm restore-btn" data-id="${userId}" title="Restore User" aria-label="Restore user ${userName}">
                        <i class="fas fa-trash-restore" aria-hidden="true"></i>
                        <span class="action-text">Restore user</span>
                    </button>
                </div>
            </td>
        `;
        
        usersTableBody.appendChild(row);
    });

    const restoreButtons = document.querySelectorAll('.restore-btn');
    restoreButtons.forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            openRestoreConfirmModal(userId);
        });
    });
    
    attachExpiryInfoHoverListeners();
}

function attachUserActionListeners() {

    const archiveButtons = document.querySelectorAll('.archive-btn');
    console.log('Found archive buttons:', archiveButtons.length);
    
    archiveButtons.forEach((button, index) => {
        console.log(`Attaching listener to archive button ${index}:`, button);
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            if (this.hasAttribute('disabled') || this.getAttribute('data-disabled') === 'true') {
                console.log('Archive button is disabled, ignoring click');
                return;
            }
            
            console.log('Archive button clicked!', this);
            const userId = this.getAttribute('data-id');
            console.log('User ID:', userId);
            openArchiveConfirmModal(userId);
        });
    });

}

function attachStatusClickListeners() {
    const statusBadges = document.querySelectorAll('.status-badge.clickable');
    statusBadges.forEach(badge => {
        badge.addEventListener('click', function() {
            const userId = this.getAttribute('data-userid');
            const userName = this.getAttribute('data-username');
            openStatusChangeModal(userId, userName, this);
        });
    });
}

function attachExpiryInfoHoverListeners() {
    const expiryInfoElements = document.querySelectorAll('.expiry-info');
    
    expiryInfoElements.forEach(element => {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.style.display = 'none';
        tooltip.style.position = 'absolute';
        tooltip.style.backgroundColor = '#333';
        tooltip.style.color = '#fff';
        tooltip.style.padding = '8px 12px';
        tooltip.style.borderRadius = '4px';
        tooltip.style.fontSize = '14px';
        tooltip.style.zIndex = '1000';
        tooltip.style.whiteSpace = 'nowrap';
        tooltip.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        document.body.appendChild(tooltip);
        
        let updateInterval;
        
        element.addEventListener('mouseenter', function () {
            const expiryTimestamp = parseInt(this.getAttribute('data-expiry'));
            const expiryDate = new Date(expiryTimestamp);
            
            const rect = this.getBoundingClientRect();
            tooltip.style.left = `${rect.left}px`;
            tooltip.style.top = `${rect.bottom + 5}px`;
            
            updateTooltipContent();
            tooltip.style.display = 'block';
            
            updateInterval = setInterval(updateTooltipContent, 1000);
            
            function updateTooltipContent() {
                const now = new Date();
                const timeLeft = expiryDate - now;
                
                if (timeLeft <= 0) {
                    tooltip.textContent = 'Pending deletion (already expired)';
                    clearInterval(updateInterval);
                    return;
                }
                
                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                
                tooltip.textContent = `Will be deleted in: ${days}d ${hours}h ${minutes}m ${seconds}s`;
            }
        });
        
        element.addEventListener('mouseleave', function () {
            tooltip.style.display = 'none';
            clearInterval(updateInterval);
        });
    });
}

function openArchiveConfirmModal(userId) {
    console.log('openArchiveConfirmModal called with userId:', userId);
    const confirmYesBtn = document.getElementById('confirmDelete');
    console.log('confirmYesBtn found:', !!confirmYesBtn);
    console.log('confirmModal found:', !!confirmModal);
    
    if (confirmYesBtn) confirmYesBtn.setAttribute('data-user-id', userId);
    
    openAdminModal(confirmModal);
}

function openStatusChangeModal(userId, userName, clickedBadge) {
    document.getElementById('statusUserId').value = userId;

    const userNameElements = document.querySelectorAll('#statusUserName');
    userNameElements.forEach(el => {
        el.textContent = userName;
    });

    const currentStatus = clickedBadge.classList.contains('active') ? 'active' : 'inactive';
    const statusRadios = document.querySelectorAll('.status-radio');
    
    statusRadios.forEach(radio => {
        radio.checked = (radio.value === currentStatus);
        
        if (radio.checked) {
            radio.dispatchEvent(new Event('change'));
        }
    });
    
    openAdminModal(statusChangeModal);
}

function openRestoreConfirmModal(userId) {
    
    const modal = document.getElementById('restoreConfirmModal');
    if (!modal) {
        
        if (typeof window.openConfirmModal === 'function') {
            window.openConfirmModal({
                title: 'Confirm Restore',
                message: 'Are you sure you want to restore this user? This will make the account active again.',
                confirmText: 'Restore'
            }).then(confirmed => { if (confirmed) restoreUser(userId); });
        } else {
            
            if (confirm("Are you sure you want to restore this user? This will make the account active again.")) {
                restoreUser(userId);
            }
        }
        return;
    }

    modal.setAttribute('data-user-id', userId);
    openAdminModal(modal);
}

async function archiveUser(userId) {
    try {
        showStatusMessage(usersStatusMessage, 'Archiving user...', 'success');

        await apiRequest(`/auth/users/${userId}/archive`, 'PUT', {
            reason: "Administrative action: User archived by system admin",
            archiveReason: "admin-action"
        });

        const row = usersTableBody.querySelector(`[data-id="${userId}"]`)?.closest('tr');
        if (row) row.remove();
        
        showStatusMessage(usersStatusMessage, 'User has been archived successfully.', 'success');

        setTimeout(() => {
            loadUsers();
        }, 500);
    } catch (error) {
        console.error('Archive user error:', error);
        const errorMessage = error.message || 'Failed to archive user';
        showStatusMessage(usersStatusMessage, errorMessage, 'error');

        setTimeout(() => {
            loadUsers();
        }, 1000);
    }
}

async function restoreUser(userId) {
    try {
        showStatusMessage(usersStatusMessage, 'Restoring user...', 'success');

        await apiRequest(`/auth/users/${userId}/restore`, 'PUT');
        
        showStatusMessage(usersStatusMessage, 'User has been restored successfully.', 'success');

        setTimeout(() => {
            loadUsers();
        }, 1000);
    } catch (error) {
        showStatusMessage(usersStatusMessage, 'Failed to restore user: ' + error.message, 'error');
    }
}

async function changeUserStatus(userId, newStatus) {
    
    const updateBtn = document.getElementById('confirmStatusChange');
    const originalBtnContent = updateBtn.innerHTML;
    
    try {
        if (!userId) {
            throw new Error('User ID is missing');
        }

        if (updateBtn) {
            updateBtn.disabled = true;
            updateBtn.innerHTML = `
                <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                <span>Updating...</span>
            `;
        }

        await apiRequest(`/auth/users/${userId}/status`, 'PUT', {
            status: newStatus
        });

        const statusText = newStatus === 'active' ? 'Active' : 'Inactive';
        showStatusMessage(usersStatusMessage, `User status has been successfully updated to ${statusText}.`, 'success');

        setTimeout(() => {
            loadUsers();
        }, 1000);
    } catch (error) {
        showStatusMessage(usersStatusMessage, 'Failed to update user status: ' + error.message, 'error');
    } finally {
        
        if (updateBtn) {
            updateBtn.disabled = false;
            updateBtn.innerHTML = originalBtnContent;
        }
    }
}

async function apiRequest(endpoint, method = 'GET', data = null) {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
        console.error('No auth token found');
        window.location.href = 'user_login.html?auth=required';
        return;
    }
    
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        if (response.status === 401) {
            console.error('Unauthorized. Redirecting to login...');
            window.location.href = 'user_login.html?session=expired';
            return;
        }
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'API request failed');
        }        
        
        if (result && typeof result === 'object' && result.data && typeof result.data === 'object') {
            return result.data; 
        }
        return result;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

function showStatusMessage(element, message, type = 'error') {
    if (!element) return;
    
    element.textContent = message;
    element.className = `status-message ${type}`;
    element.style.display = 'block';

    if (type === 'success') {
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
}

function clearStatusMessage(element) {
    if (!element) return;
    
    element.style.display = 'none';
    element.textContent = '';
}

function openAdminModal(modal) {
    if (!modal) return;

    if (typeof ModalUtils !== 'undefined') {
        ModalUtils.openModal(modal.id, {
            animation: 'scale-in',
            trapFocus: true,
            closeOnEscape: true,
            closeOnBackdrop: false
        });
    } else {
        
        modal.style.display = 'flex';
        requestAnimationFrame(() => {
            modal.classList.add('active');
            document.body.classList.add('modal-open');
        });
    }
}

function closeAdminModal(modal) {
    if (!modal) return;

    if (typeof ModalUtils !== 'undefined') {
        ModalUtils.closeModal(modal.id);
    } else {
        
        modal.classList.remove('active');
        const cleanup = () => {
            modal.style.display = 'none';
            
            const anyOpen = [...document.querySelectorAll('.modal')].some(m => m !== modal && (m.classList.contains('active') || m.style.display === 'flex'));
            if (!anyOpen) {
                document.body.classList.remove('modal-open');
            }
        };
        setTimeout(cleanup, 200);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    
    if (!window.auth || !window.auth.checkAdminAuth()) {
        window.location.href = 'user_login.html?auth=required';
        return;
    }

    adminLoader.showPageLoader('Loading admin users...');

    const currentUser = window.authUtils ? window.authUtils.getCurrentUser() : null;
    currentAdminId = currentUser?.id || localStorage.getItem('userId');

    loadUsers().finally(() => {
        
        adminLoader.hidePageLoader();
    });

    if (activeUsersBtn) {
        activeUsersBtn.addEventListener('click', function() {
            if (isViewingArchivedUsers) {
                isViewingArchivedUsers = false;
                activeUsersBtn.classList.add('active');
                archivedUsersBtn.classList.remove('active');
                loadUsers();
            }
        });
    }
    
    if (archivedUsersBtn) {
        archivedUsersBtn.addEventListener('click', function() {
            if (!isViewingArchivedUsers) {
                isViewingArchivedUsers = true;
                archivedUsersBtn.classList.add('active');
                activeUsersBtn.classList.remove('active');
                loadUsers();
            }
        });
    }

    if (window.RefreshUtils && window.RefreshUtils.manager) {
        
        window.RefreshUtils.manager.register('refreshUsers', loadUsers, {
            normalText: 'Users',
            loadingText: 'Refreshing users...',
            successText: 'Users updated!',
            errorText: 'Failed to refresh'
        });
    }

    const closeModalButtons = document.querySelectorAll('.close-modal');
    closeModalButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            closeAdminModal(modal);
        });
    });

    const confirmDeleteBtn = document.getElementById('confirmDelete');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', function() {
            const userId = this.getAttribute('data-user-id');
            closeAdminModal(confirmModal);
            archiveUser(userId);
        });
    }

    const statusRadios = document.querySelectorAll('.status-radio');
    statusRadios.forEach(radio => {
        radio.addEventListener('change', function() {

        });
    });

    const confirmStatusChangeBtn = document.getElementById('confirmStatusChange');
    if (confirmStatusChangeBtn) {
        confirmStatusChangeBtn.addEventListener('click', function() {
            const userId = document.getElementById('statusUserId').value;
            const selectedRadio = document.querySelector('.status-radio:checked');
            const selectedStatus = selectedRadio ? selectedRadio.value : 'active';
            
            closeAdminModal(statusChangeModal);
            changeUserStatus(userId, selectedStatus);
        });
    }

    const confirmRestoreBtn = document.getElementById('confirmRestore');
    if (confirmRestoreBtn) {
        confirmRestoreBtn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            const userId = modal && modal.getAttribute('data-user-id');
            closeAdminModal(modal);
            if (userId) restoreUser(userId);
        });
    }

    const userDisplayName = document.getElementById('username');
    if (userDisplayName) {
        const adminName = localStorage.getItem('adminName') || '';
        userDisplayName.textContent = adminName;
    }
});