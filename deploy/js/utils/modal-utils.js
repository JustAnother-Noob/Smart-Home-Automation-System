
const ModalUtils = {
    
    activeModals: new Set(),
    focusHistory: [],
    
    _modalOptions: new WeakMap(),

    openModal(modalId, options = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.warn(`Modal with ID '${modalId}' not found`);
            return;
        }

        this.focusHistory.push(document.activeElement);

        this._modalOptions.set(modal, {
            closeOnBackdrop: options.closeOnBackdrop !== false,
            closeOnEscape: options.closeOnEscape !== false
        });

        modal.setAttribute('aria-hidden', 'false');

        if (options.animation) {
            modal.querySelector('.modal-content')?.classList.add(options.animation);
        }

        if (options.type) {
            modal.classList.add(`${options.type}-modal`);
        }

        document.body.classList.add('modal-open');
        this.activeModals.add(modalId);

        if (options.trapFocus !== false) {
            this.trapFocus(modal);
        }

        this.setupModalEvents(modal, options);

        if (options.onOpen && typeof options.onOpen === 'function') {
            options.onOpen(modal);
        }

        setTimeout(() => {
            modal.style.display = 'flex';
            requestAnimationFrame(() => {
                modal.classList.add('active');
            });
        }, 10);
    },

    closeModal(modalId, options = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        if (modal._escHandler) {
            document.removeEventListener('keydown', modal._escHandler);
            delete modal._escHandler;
        }
        
        if (modal._trapHandler) {
            modal.removeEventListener('keydown', modal._trapHandler);
            delete modal._trapHandler;
        }

        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');

        this.activeModals.delete(modalId);

        this._modalOptions.delete(modal);

        if (this.focusHistory.length > 0) {
            const previousFocus = this.focusHistory.pop();
            if (previousFocus && typeof previousFocus.focus === 'function') {
                previousFocus.focus();
            }
        }

        if (this.activeModals.size === 0) {
            document.body.classList.remove('modal-open');
        }

        if (options.onClose && typeof options.onClose === 'function') {
            options.onClose(modal);
        }

        setTimeout(() => {
            modal.style.display = 'none';
            
            modal.querySelector('.modal-content')?.classList.remove('fade-in', 'slide-up', 'scale-in');
        }, 300);
    },

    confirm(options = {}) {
        return new Promise(resolve => {
            
            const existingModal = document.getElementById('genericConfirmModal');
            if (existingModal) {
                document.body.removeChild(existingModal);
            }

            const config = {
                title: 'Confirm Action',
                message: 'Are you sure you want to proceed?',
                okText: 'OK',
                cancelText: 'Cancel',
                okClass: 'btn-primary',
                type: 'confirm',
                size: 'medium',
                icon: 'fas fa-question-circle',
                showCancel: true,
                ...options
            };

            const modal = document.createElement('div');
            modal.id = 'genericConfirmModal';
            modal.className = `modal ${config.type}-modal`;
            modal.innerHTML = `
                <div class="modal-content ${config.size}">
                    <div class="modal-header">
                        <div class="modal-title-container">
                            ${config.icon ? `<i class="${config.icon}" aria-hidden="true"></i>` : ''}
                            <h3 id="genericConfirmTitle">${config.title}</h3>
                        </div>
                        <button type="button" class="close-modal" aria-label="Close modal">
                            <i class="fas fa-times" aria-hidden="true"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="modal-message">
                            <p id="genericConfirmMessage">${config.message}</p>
                        </div>
                    </div>
                    <div class="modal-footer ${config.showCancel ? '' : 'center'}">
                        ${config.showCancel ? `
                            <button type="button" class="btn btn-secondary cancel-btn">
                                <i class="fas fa-times" aria-hidden="true"></i>
                                ${config.cancelText}
                            </button>
                        ` : ''}
                        <button id="genericConfirmOk" class="btn ${config.okClass}">
                            <i class="fas fa-check" aria-hidden="true"></i>
                            ${config.okText}
                        </button>
                    </div>
                </div>`;
            
            document.body.appendChild(modal);

            this.openModal('genericConfirmModal', {
                animation: 'scale-in',
                trapFocus: true,
                closeOnEscape: true,
                closeOnBackdrop: false,
                onOpen: () => {
                    
                    const okButton = document.getElementById('genericConfirmOk');
                    if (okButton) {
                        okButton.focus();
                    }
                }
            });

            const closeModal = (result) => {
                this.closeModal('genericConfirmModal');
                setTimeout(() => {
                    document.removeEventListener('keydown', keyHandler);
                    if (document.body.contains(modal)) {
                        document.body.removeChild(modal);
                    }
                    resolve(result);
                }, 300);
            };

            modal.querySelectorAll('.close-modal, .cancel-btn').forEach(btn => {
                btn.addEventListener('click', () => closeModal(false));
            });

            const okButton = document.getElementById('genericConfirmOk');
            okButton.addEventListener('click', () => closeModal(true));

            const keyHandler = (e) => {
                if (e.key === 'Escape') {
                    closeModal(false);
                } else if (e.key === 'Enter' && e.target === okButton) {
                    closeModal(true);
                }
            };
            document.addEventListener('keydown', keyHandler);

        });
    },

    alert(options = {}) {
        return this.confirm({
            ...options,
            type: 'info',
            showCancel: false,
            okText: options.okText || 'OK'
        });
    },

    success(options = {}) {
        return this.confirm({
            ...options,
            type: 'success',
            icon: 'fas fa-check-circle',
            showCancel: false,
            okText: options.okText || 'Great!'
        });
    },

    error(options = {}) {
        return this.confirm({
            ...options,
            type: 'danger',
            icon: 'fas fa-exclamation-triangle',
            showCancel: false,
            okText: options.okText || 'OK'
        });
    },

    warning(options = {}) {
        return this.confirm({
            ...options,
            type: 'danger',
            icon: 'fas fa-exclamation-circle',
            okClass: 'btn-warning'
        });
    },

    trapFocus(modal) {
        
        if (modal._trapHandler) {
            modal.removeEventListener('keydown', modal._trapHandler);
        }
        
        const focusableElements = modal.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        );
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        const keyHandler = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };
        
        modal.addEventListener('keydown', keyHandler);
        modal._trapHandler = keyHandler;
        firstElement.focus();
    },

    setupModalEvents(modal, options) {
        const modalId = modal.id;

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                const cfg = this._modalOptions.get(modal) || {};
                if (cfg.closeOnBackdrop) {
                    this.closeModal(modalId, options);
                }
            }
        });

        if (options.closeOnEscape !== false) {
            const escHandler = (e) => {
                if (e.key === 'Escape' && this.activeModals.has(modalId)) {
                    this.closeModal(modalId, options);
                }
            };
            document.addEventListener('keydown', escHandler);

            modal._escHandler = escHandler;
        }

        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal(modalId, options);
            });
        }
    },

    closeAllModals() {
        this.activeModals.forEach(modalId => {
            this.closeModal(modalId);
        });
    },

    getActiveModals() {
        return Array.from(this.activeModals);
    },

    isModalOpen(modalId) {
        return this.activeModals.has(modalId);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    
    document.addEventListener('click', (e) => {
        if (e.target.matches('.close-modal') || e.target.closest('.close-modal')) {
            const modal = e.target.closest('.modal');
            if (modal) {
                ModalUtils.closeModal(modal.id);
            }
        }
    });

});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalUtils;
} else {
    
    window.ModalUtils = ModalUtils;
}

window.SmartHomeModals = {
    confirm: (options) => ModalUtils.confirm(options),
    alert: (options) => ModalUtils.alert(options),
    success: (options) => ModalUtils.success(options),
    error: (options) => ModalUtils.error(options),
    warning: (options) => ModalUtils.warning(options)
};

window.openConfirmModal = function(options) {
    return ModalUtils.confirm(options);
};

window.showAlert = function(options) {
    return ModalUtils.alert(options);
};

window.showSuccess = function(options) {
    return ModalUtils.success(options);
};

window.showError = function(options) {
    return ModalUtils.error(options);
};

window.showWarning = function(options) {
    return ModalUtils.warning(options);
};