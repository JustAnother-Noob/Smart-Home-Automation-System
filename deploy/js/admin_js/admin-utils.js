

class AdminLoader {
    constructor() {
        this.globalLoadingOverlay = document.getElementById('globalLoadingOverlay');
        
        if (!this.globalLoadingOverlay) {
            const overlay = document.createElement('div');
            overlay.id = 'globalLoadingOverlay';
            overlay.className = 'global-loading-overlay';
            overlay.style.display = 'none';
            overlay.innerHTML = `<div class="loader-inner">
                    <div class="spinner"></div>
                    <p></p>
                </div>`;
            document.body.appendChild(overlay);
            this.globalLoadingOverlay = overlay;
        }
    }

    showPageLoader(message = 'Loading...') {
    if (!this.globalLoadingOverlay) return;

    const text = this.globalLoadingOverlay.querySelector('p');
    if (text) text.textContent = message;

        this.globalLoadingOverlay.style.display = 'flex';
        this.globalLoadingOverlay.classList.add('active');

        document.querySelectorAll('[data-admin-spinner="true"]').forEach(s => {
            s.style.display = 'none';
        });
    }

    hidePageLoader() {
    if (!this.globalLoadingOverlay) return;
    this.globalLoadingOverlay.classList.remove('active');
    this.globalLoadingOverlay.style.display = 'none';
    }

    isOverlayActive() {
        if (!this.globalLoadingOverlay) return false;
        return this.globalLoadingOverlay.classList.contains('active') || this.globalLoadingOverlay.style.display === 'flex';
    }

    showSpinner(elementOrId) {
        const element = typeof elementOrId === 'string'
            ? document.getElementById(elementOrId)
            : elementOrId;

        if (this.globalLoadingOverlay && (this.globalLoadingOverlay.classList.contains('active') || this.globalLoadingOverlay.style.display === 'flex')) {
            return;
        }

        if (!element) return;

        let spinner = element.querySelector('.admin-inline-spinner');
        if (!spinner) {
            spinner = document.createElement('span');
            spinner.className = 'admin-inline-spinner';
            spinner.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>';
            
            spinner.setAttribute('data-admin-spinner', 'true');
            element.appendChild(spinner);
        }
        spinner.style.display = '';
    }

    hideSpinner(elementOrId) {
        const element = typeof elementOrId === 'string'
            ? document.getElementById(elementOrId)
            : elementOrId;

        if (!element) return;

        const spinner = element.querySelector('[data-admin-spinner="true"]');
        if (spinner) {
            spinner.style.display = 'none';
        }
    }

    showSpinnerWithText(elementOrId, text) {
        const element = typeof elementOrId === 'string' 
            ? document.getElementById(elementOrId) 
            : elementOrId;

        if (this.globalLoadingOverlay && (this.globalLoadingOverlay.classList.contains('active') || this.globalLoadingOverlay.style.display === 'flex')) {
            return;
        }

        if (element) {
            element.setAttribute('data-text', text);
            element.classList.add('show');
        }
        if (!element) return;

        let spinner = element.querySelector('.admin-inline-spinner');
        if (!spinner) {
            spinner = document.createElement('span');
            spinner.className = 'admin-inline-spinner';
            spinner.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>';
            spinner.setAttribute('data-admin-spinner', 'true');
            element.appendChild(spinner);
        }
        spinner.setAttribute('aria-label', text || 'Loading');
        spinner.style.display = '';
    }
}

if (!window.adminLoader) {
    window.adminLoader = new AdminLoader();
}
const adminLoader = window.adminLoader;

window.showPageLoader = (message) => adminLoader.showPageLoader(message);
window.hidePageLoader = () => adminLoader.hidePageLoader();
window.showSpinner = (element) => adminLoader.showSpinner(element);
window.hideSpinner = (element) => adminLoader.hideSpinner(element);

class AdminStatusMessage {
    
    static show(messageElement, message, type = 'info') {
        if (!messageElement) return;
        
        messageElement.className = `status-message ${type}`;
        messageElement.textContent = message;
        messageElement.style.display = 'block';

        if (type === 'success') {
            setTimeout(() => {
                this.hide(messageElement);
            }, 5000);
        }
    }

    static hide(messageElement) {
        if (messageElement) {
            messageElement.style.display = 'none';
            messageElement.textContent = '';
        }
    }

    static showSuccess(messageElement, message) {
        this.show(messageElement, message, 'success');
    }

    static showError(messageElement, message) {
        this.show(messageElement, message, 'error');
    }
}

window.AdminStatusMessage = AdminStatusMessage;

window.showStatusMessage = (element, message, type) => AdminStatusMessage.show(element, message, type);
window.clearStatusMessage = (element) => AdminStatusMessage.hide(element);

document.addEventListener('DOMContentLoaded', function() {
    
    const isAdminPage = document.body.classList.contains('admin-page') ||
                        document.querySelector('.sidebar') !== null;

    if (isAdminPage) {
        const overlay = document.getElementById('globalLoadingOverlay');

        if (document.body.dataset.initialLoader === 'true') {
            window.adminLoader.showPageLoader(document.body.dataset.initialLoaderText || 'Loading...');
            setTimeout(() => {
                if (window.adminAutoHideLoader !== false) {
                    window.adminLoader.hidePageLoader();
                }
            }, 400);
        } else if (overlay) {
            
            overlay.classList.remove('active');
            const p = overlay.querySelector('p');
            if (p) p.textContent = '';
        }
    }
});

function openConfirmModal(options = {}) {
    return new Promise(resolve => {
        let modal = document.getElementById('genericConfirmModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'genericConfirmModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header"><h2 id="genericConfirmTitle"></h2><button type="button" class="close-modal" aria-label="Close">&times;</button></div>
                    <div class="modal-body"><p id="genericConfirmMessage"></p>
                        <div class="form-actions modal-actions">
                            <button type="button" class="btn btn-secondary close-modal">Cancel</button>
                            <button id="genericConfirmOk" class="btn btn-primary">OK</button>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(modal);

            modal.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => {
                closeConfirm();
                resolve(false);
            }));
        }

        const titleEl = modal.querySelector('#genericConfirmTitle');
        const messageEl = modal.querySelector('#genericConfirmMessage');
        const okBtn = modal.querySelector('#genericConfirmOk');

        titleEl.textContent = options.title || 'Confirm';
        messageEl.textContent = options.message || '';
        okBtn.textContent = options.confirmText || 'OK';
        if (options.danger) {
            okBtn.classList.add('action-btn', 'delete-btn');
            okBtn.innerHTML = `<i class="fas fa-trash" aria-hidden="true"></i><span class="action-text">${options.confirmText || 'OK'}</span>`;
        } else {
            okBtn.classList.remove('action-btn', 'delete-btn');
            okBtn.textContent = options.confirmText || 'OK';
        }

        function closeConfirm() {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 200);
            okBtn.removeEventListener('click', okHandler);
        }

        function okHandler() {
            closeConfirm();
            resolve(true);
        }

        okBtn.addEventListener('click', okHandler);
        modal.style.display = 'flex';
        requestAnimationFrame(() => {
            modal.classList.add('active');
            document.body.classList.add('modal-open');
        });
    });
}

window.openConfirmModal = openConfirmModal;
