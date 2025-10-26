

class AdminRefreshManager {
    constructor() {
        this.activeRefreshes = new Set();
        this.refreshConfigs = new Map();
    }

    register(buttonId, refreshFunction, options = {}) {
        const config = {
            loadingText: options.loadingText || 'Refreshing...',
            successText: options.successText || 'Refreshed!',
            errorText: options.errorText || 'Failed',
            normalText: options.normalText || 'Refresh',
            successDuration: options.successDuration || 2000,
            errorDuration: options.errorDuration || 3000,
            debounceTime: options.debounceTime || 300,
            refreshFunction: refreshFunction
        };
        
        this.refreshConfigs.set(buttonId, config);
        this.setupButton(buttonId);
    }

    setupButton(buttonId) {
        const refreshBtn = document.getElementById(buttonId);
        if (!refreshBtn) {
            console.warn(`Refresh button with ID '${buttonId}' not found`);
            return;
        }

        this.ensureButtonStructure(refreshBtn);

        refreshBtn.addEventListener('click', () => this.handleRefresh(buttonId));
    }

    ensureButtonStructure(refreshBtn) {
        
        if (!refreshBtn.classList.contains('action-btn')) {
            refreshBtn.classList.add('action-btn');
        }
        if (!refreshBtn.classList.contains('refresh')) {
            refreshBtn.classList.add('refresh');
        }

        let icon = refreshBtn.querySelector('i');
        if (!icon) {
            icon = document.createElement('i');
            icon.className = 'fas fa-sync-alt';
            icon.setAttribute('aria-hidden', 'true');
            refreshBtn.insertBefore(icon, refreshBtn.firstChild);
        }

        let textSpan = refreshBtn.querySelector('.refresh-text') || refreshBtn.querySelector('span');
        if (!textSpan) {
            textSpan = document.createElement('span');
            textSpan.className = 'refresh-text';
            textSpan.textContent = 'Refresh';
            refreshBtn.appendChild(textSpan);
        } else {
            
            if (!textSpan.classList.contains('refresh-text')) {
                textSpan.classList.add('refresh-text');
            }
        }
    }

    async handleRefresh(buttonId) {
        if (this.activeRefreshes.has(buttonId)) {
            return; 
        }

        const config = this.refreshConfigs.get(buttonId);
        if (!config) {
            console.error(`No refresh config found for button '${buttonId}'`);
            return;
        }

        const refreshBtn = document.getElementById(buttonId);
        if (!refreshBtn) return;

        this.activeRefreshes.add(buttonId);
        this.setButtonState(refreshBtn, 'loading', config);

        try {
            await config.refreshFunction();
            this.setButtonState(refreshBtn, 'success', config);

            setTimeout(() => {
                this.setButtonState(refreshBtn, 'normal', config);
                this.activeRefreshes.delete(buttonId);
            }, config.successDuration);

        } catch (error) {
            console.error(`Refresh failed for ${buttonId}:`, error);
            this.setButtonState(refreshBtn, 'error', config);

            setTimeout(() => {
                this.setButtonState(refreshBtn, 'normal', config);
                this.activeRefreshes.delete(buttonId);
            }, config.errorDuration);
        }
    }

    setButtonState(refreshBtn, state, config) {
        const icon = refreshBtn.querySelector('i');
        const textSpan = refreshBtn.querySelector('.refresh-text') || refreshBtn.querySelector('span');

        refreshBtn.classList.remove('refreshing', 'success', 'error');
        refreshBtn.disabled = false;

        switch (state) {
            case 'loading':
                refreshBtn.classList.add('refreshing');
                refreshBtn.disabled = true;
                refreshBtn.title = config.loadingText;
                
                if (icon) {
                    icon.className = 'fas fa-sync-alt';
                    
                    icon.style.animation = 'pulse 1.5s ease-in-out infinite';
                }
                if (textSpan) {
                    textSpan.textContent = config.loadingText;
                    
                    textSpan.classList.remove('fa-spin', 'fa-spinner');
                    textSpan.style.animation = 'none';
                    textSpan.style.transform = 'none';
                }
                break;

            case 'success':
                refreshBtn.classList.add('success');
                refreshBtn.title = 'Refreshed successfully';
                if (icon) {
                    icon.className = 'fas fa-check';
                    icon.style.animation = 'none'; 
                }
                if (textSpan) {
                    textSpan.textContent = config.successText;
                    
                    textSpan.classList.remove('fa-spin', 'fa-spinner');
                    textSpan.style.animation = 'none';
                    textSpan.style.transform = 'none';
                }
                break;

            case 'error':
                refreshBtn.classList.add('error');
                refreshBtn.title = 'Refresh failed - click to try again';
                if (icon) {
                    icon.className = 'fas fa-exclamation-circle';
                    icon.style.animation = 'none'; 
                }
                if (textSpan) {
                    textSpan.textContent = config.errorText;
                    
                    textSpan.classList.remove('fa-spin', 'fa-spinner');
                    textSpan.style.animation = 'none';
                    textSpan.style.transform = 'none';
                }
                break;

            case 'normal':
            default:
                
                refreshBtn.title = (config.normalText && config.normalText.toLowerCase() !== 'refresh')
                    ? `Refresh ${config.normalText.toLowerCase()}`
                    : 'Refresh';
                if (icon) {
                    icon.className = 'fas fa-sync-alt';
                    icon.style.animation = 'none'; 
                }
                if (textSpan) {
                    textSpan.textContent = config.normalText;
                    
                    textSpan.classList.remove('fa-spin', 'fa-spinner');
                    textSpan.style.animation = 'none';
                    textSpan.style.transform = 'none';
                }
                break;
        }
    }

    isRefreshing(buttonId) {
        return this.activeRefreshes.has(buttonId);
    }
}

const adminRefreshManager = new AdminRefreshManager();

window.RefreshUtils = {
    manager: adminRefreshManager,
    register: (buttonId, refreshFunction, options) => adminRefreshManager.register(buttonId, refreshFunction, options)
};

window.adminRefreshManager = adminRefreshManager;
