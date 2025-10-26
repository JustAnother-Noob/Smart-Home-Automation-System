

const API_BASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.API_URL)
    ? CONFIG.API_URL
    : 'http://localhost:5002/api';

if (!window.getAuthToken) {
    window.getAuthToken = function() {
        
        return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    };
}

class NetworkLogsManager {
    constructor() {
        const DEBUG = Boolean(window?.CONFIG?.DEBUG);
        if (DEBUG) console.log('🔧 NetworkLogsManager constructor called');
        
        this.currentPage = 1;
        this.totalPages = 1;
        this.currentFilters = {};
        this.currentSort = { field: 'timestamp', order: 'desc' };
        this.isRealtimeEnabled = false;
        this.realtimeInterval = null;
        this.statsInterval = null;
        this._observers = [];
        this._logsAbort = null;
        this._activeUsersAbort = null;
        this.lastRealtimeUpdate = null;
        
        if (DEBUG) console.log('🔧 Restoring time range selection from localStorage...');
        this.restoreTimeRangeSelection();
        
        if (DEBUG) console.log('🔧 Initializing event listeners...');
        this.initializeEventListeners();

        if (DEBUG) console.log('🔧 Setting up refresh button handling...');
        this.setupRefreshButtons();

        this.activeStatCard = null;
        this.activeStatCardKey = null;
        
        if (DEBUG) console.log('🔧 Ensuring refresh button text never spins...');
        this.preventTextSpinning(); 
        
        if (DEBUG) console.log('🔧 Loading initial data...');
        this.loadInitialData();
        
        if (DEBUG) console.log('🔧 Setting up column sorting...');
        this.setupColumnSorting();
        
        if (DEBUG) console.log('🔧 Setting initial sort indicator...');
        
        this.updateSortIndicators('timestamp', 'desc');

        this.setupCleanup();
    }

    saveTimeRangeSelection(timeRange) {
        try {
            localStorage.setItem('networkLogs_timeRange', timeRange);
            if (window?.CONFIG?.DEBUG) console.log('💾 Saved time range selection:', timeRange);
        } catch (e) {
            console.warn('Failed to save time range selection:', e);
        }
    }

    restoreTimeRangeSelection() {
        try {
            const savedTimeRange = localStorage.getItem('networkLogs_timeRange');
            if (savedTimeRange) {
                const dropdown = document.getElementById('timeRangeSelect');
                if (dropdown) {
                    dropdown.value = savedTimeRange;
                    if (window?.CONFIG?.DEBUG) console.log('🔄 Restored time range selection:', savedTimeRange);
                }
            }
        } catch (e) {
            console.warn('Failed to restore time range selection:', e);
        }
    }

    preventTextSpinning() {
        
        const refreshStatsBtn = document.getElementById('refreshStats');
        const refreshLogsBtn = document.getElementById('refreshLogs');
        
        const resetButton = (btn) => {
            if (!btn) return;
            btn.classList.remove('refreshing', 'success', 'error');
            btn.removeAttribute('disabled');
            const icon = btn.querySelector('i');
            const label = btn.querySelector('.refresh-text') || btn.querySelector('span');
            if (icon) icon.classList.remove('fa-spinner', 'fa-spin');
            if (label) {
                label.classList.remove('fa-spin', 'fa-spinner');
                label.style.animation = 'none';
                label.style.transform = 'none';
            }
        }
        
        resetButton(refreshStatsBtn);
        resetButton(refreshLogsBtn);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.tagName === 'SPAN' && (target.classList.contains('fa-spin') || target.classList.contains('fa-spinner'))) {
                        target.classList.remove('fa-spin', 'fa-spinner');
                        target.style.animation = 'none';
                        target.style.transform = 'none';
                    }
                }
            });
        });
        
        const observeTargets = [refreshStatsBtn, refreshLogsBtn]
            .filter(Boolean)
            .flatMap((btn) => [btn, btn.querySelector('.refresh-text'), btn.querySelector('span')]
                .filter(Boolean));

        observeTargets.forEach((target) => observer.observe(target, { attributes: true, attributeFilter: ['class'] }));
        if (observeTargets.length > 0) {
            this._observers.push(observer);
        } else {
            observer.disconnect();
        }
    }

    setupCleanup() {
        
        window.addEventListener('beforeunload', () => {
            this._observers.forEach(o => o.disconnect());
            if (this.realtimeInterval) clearInterval(this.realtimeInterval);
            if (this.statsInterval) clearInterval(this.statsInterval);
            if (this._logsAbort) this._logsAbort.abort();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isRealtimeEnabled) {
                this.toggleRealtime();
            }
        });
    }

    setupRefreshButtons() {
        const DEBUG = Boolean(window?.CONFIG?.DEBUG);
        if (window.RefreshUtils?.manager) {
            if (DEBUG) console.log('🔁 Registering refresh buttons with RefreshUtils');
            window.RefreshUtils.manager.register('refreshStats', () => this.loadStats(), {
                normalText: 'Statistics',
                loadingText: 'Refreshing statistics...',
                successText: 'Statistics updated!',
                errorText: 'Failed to refresh',
                debounceTime: 200
            });

            window.RefreshUtils.manager.register('refreshLogs', () => this.loadLogs(this.currentPage), {
                normalText: 'Logs',
                loadingText: 'Refreshing logs...',
                successText: 'Logs updated!',
                errorText: 'Failed to refresh',
                debounceTime: 200
            });
        } else {
            if (DEBUG) console.warn('⚠️ RefreshUtils.manager not available - using fallback handlers');
            const refreshStats = document.getElementById('refreshStats');
            const refreshLogs = document.getElementById('refreshLogs');

            refreshStats?.addEventListener('click', () => this.loadStats());
            refreshLogs?.addEventListener('click', () => this.loadLogs(this.currentPage));
        }
    }

    setupColumnSorting() {
        
        const sortableHeaders = document.querySelectorAll('th[data-sort]');
        sortableHeaders.forEach(header => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => {
                const field = header.getAttribute('data-sort');
                this.sortColumn(field);
            });
        });
    }

    sortColumn(field) {
        
        let newOrder = 'desc';
        if (this.currentSort.field === field && this.currentSort.order === 'desc') {
            newOrder = 'asc';
        }

        this.currentSort = { field, order: newOrder };

        this.updateSortIndicators(field, newOrder);

        this.loadLogs(this.currentPage);
    }

    updateSortIndicators(field, order) {
        
        document.querySelectorAll('th[data-sort] .sort-indicator').forEach(indicator => {
            indicator.remove();
        });

        const header = document.querySelector(`th[data-sort="${field}"]`);
        if (header) {
            const indicator = document.createElement('span');
            indicator.className = 'sort-indicator';
            indicator.innerHTML = order === 'asc' ? ' ▲' : ' ▼';
            indicator.style.color = '#007bff';
            indicator.style.fontSize = '0.8em';
            header.appendChild(indicator);
        }
    }

    initializeEventListeners() {
        
        document.getElementById('applyFilters')?.addEventListener('click', () => this.applyFilters());
        document.getElementById('clearFilters')?.addEventListener('click', () => this.clearFilters());
        document.getElementById('exportLogs')?.addEventListener('click', () => this.exportLogs());

        document.getElementById('toggleRealtime')?.addEventListener('click', () => this.toggleRealtime());

        document.getElementById('timeRangeSelect')?.addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            this.saveTimeRangeSelection(selectedValue);
            this.loadStats(selectedValue);
        });

        document.getElementById('cleanupOldLogs')?.addEventListener('click', () => this.showCleanupModal());
        document.getElementById('confirmCleanup')?.addEventListener('click', () => this.performCleanup());
        document.getElementById('cancelCleanup')?.addEventListener('click', () => this.closeCleanupModal());

        document.getElementById('clearIPHistory')?.addEventListener('click', () => this.showClearIPHistoryModal());
        document.getElementById('confirmClearIPHistory')?.addEventListener('click', () => this.performClearIPHistory());
        document.getElementById('cancelClearIPHistory')?.addEventListener('click', () => this.closeClearIPHistoryModal());

        document.getElementById('closeLogModal')?.addEventListener('click', () => this.closeLogModal());
        document.getElementById('closeCleanupModal')?.addEventListener('click', () => this.closeCleanupModal());
        document.getElementById('closeActiveUsersModal')?.addEventListener('click', () => this.closeActiveUsersModal());
        document.getElementById('retryActiveUsers')?.addEventListener('click', () => this.retryActiveUsers());
        document.getElementById('closeUniqueIPsModal')?.addEventListener('click', () => this.closeUniqueIPsModal());
        document.getElementById('retryUniqueIPs')?.addEventListener('click', () => this.retryUniqueIPs());

        document.getElementById('logDetailsModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'logDetailsModal') this.closeLogModal();
        });

        document.getElementById('cleanupModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'cleanupModal') this.closeCleanupModal();
        });

        document.getElementById('activeUsersModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'activeUsersModal') this.closeActiveUsersModal();
        });

        document.getElementById('uniqueIPsModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'uniqueIPsModal') this.closeUniqueIPsModal();
        });

        document.getElementById('clearIPHistoryModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'clearIPHistoryModal') this.closeClearIPHistoryModal();
        });

        const tableBody = document.getElementById('logsTableBody');
        if (tableBody) {
            tableBody.addEventListener('click', (e) => {
                const btn = e.target.closest('.log-action-btn');
                if (btn && btn.dataset.logId) {
                    if (window?.CONFIG?.DEBUG) console.log('View button clicked for log:', btn.dataset.logId);
                    this.viewLogDetails(btn.dataset.logId);
                }
            });
            if (window?.CONFIG?.DEBUG) console.log('✅ Event listener attached to logsTableBody');
        } else {
            if (window?.CONFIG?.DEBUG) console.warn('⚠️ logsTableBody not found during event listener setup');
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                const activeModal = document.querySelector('.modal.active');
                if (activeModal?.id === 'activeUsersModal') {
                    this.closeActiveUsersModal();
                } else if (activeModal?.id === 'uniqueIPsModal') {
                    this.closeUniqueIPsModal();
                } else if (activeModal?.id === 'clearIPHistoryModal') {
                    this.closeClearIPHistoryModal();
                }
            }
        });
    }

    openActiveUsersModal() {
        const modal = document.getElementById('activeUsersModal');
        if (!modal) return;

        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.removeAttribute('hidden');

        this.loadActiveUsers();
    }

    closeActiveUsersModal() {
        const modal = document.getElementById('activeUsersModal');
        if (!modal) return;

        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.setAttribute('hidden', '');

        this.cleanupActiveUsersRequest();
        this.clearActiveStatCardHighlight();
    }

    showActiveUsersState({ loading = false, error = false, empty = false }) {
        const loadingEl = document.getElementById('activeUsersLoading');
        const errorEl = document.getElementById('activeUsersError');
        const emptyEl = document.getElementById('activeUsersEmpty');
        const contentEl = document.getElementById('activeUsersContent');

        if (loadingEl) {
            if (loading) {
                loadingEl.removeAttribute('hidden');
                loadingEl.style.display = 'flex';
            } else {
                loadingEl.setAttribute('hidden', '');
                loadingEl.style.display = 'none';
            }
        }

        if (errorEl) {
            if (error) {
                errorEl.removeAttribute('hidden');
                errorEl.style.display = 'block';
            } else {
                errorEl.setAttribute('hidden', '');
                errorEl.style.display = 'none';
            }
        }

        if (emptyEl) {
            if (empty) {
                emptyEl.removeAttribute('hidden');
                emptyEl.style.display = 'block';
            } else {
                emptyEl.setAttribute('hidden', '');
                emptyEl.style.display = 'none';
            }
        }

        if (contentEl) {
            if (!loading && !error && !empty) {
                contentEl.removeAttribute('hidden');
                contentEl.style.display = 'block';
            } else {
                contentEl.setAttribute('hidden', '');
                contentEl.style.display = 'none';
            }
        }
    }

    cleanupActiveUsersRequest() {
        if (this._activeUsersAbort) {
            this._activeUsersAbort.abort();
            this._activeUsersAbort = null;
        }
    }

    async loadActiveUsers() {
        const DEBUG = Boolean(window?.CONFIG?.DEBUG);
        try {
            this.cleanupActiveUsersRequest();
            this.showActiveUsersState({ loading: true, error: false, empty: false });

            this._activeUsersAbort = new AbortController();
            const timeRange = document.getElementById('timeRangeSelect')?.value || '24h';
            const qp = new URLSearchParams({ timeRange });

            const response = await fetch(`${API_BASE_URL}/network-logs/active-users?${qp.toString()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${window.getAuthToken()}`
                },
                signal: this._activeUsersAbort.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Failed to load active users');
            }

            const users = Array.isArray(data.data?.users) ? data.data.users : [];
            const total = Number(data.data?.totalActive || 0);

            if (users.length === 0) {
                this.showActiveUsersState({ loading: false, error: false, empty: true });
            } else {
                this.renderActiveUsers(data.data);
                this.showActiveUsersState({ loading: false, error: false, empty: false });
            }

            if (!this.latestStatsOverview) {
                this.latestStatsOverview = {};
            }
            this.latestStatsOverview.uniqueUserCount = total;

            const activeUsersCard = document.querySelector('.stat-card[data-card-key="active_users"]');
            if (activeUsersCard) {
                const valueEl = activeUsersCard.querySelector('.stat-value');
                if (valueEl) valueEl.textContent = total;
            }

            if (DEBUG) console.log('Active users loaded', { total, users });
        } catch (error) {
            if (DEBUG) console.error('Failed to load active users', error);
            if (error.name === 'AbortError') return;
            this.showActiveUsersState({ loading: false, error: true, empty: false });
        }
    }

    retryActiveUsers() {
        this.loadActiveUsers();
    }

    renderActiveUsers(data) {
        const summaryEl = document.getElementById('activeUsersSummary');
        const listEl = document.getElementById('activeUsersList');
        if (!summaryEl || !listEl) return;

        const total = Number(data.totalActive || 0);
        const windowMinutes = Number(data.windowMinutes || 0);
        const roles = data.roles || {};
        const users = Array.isArray(data.users) ? data.users : [];

        summaryEl.innerHTML = `
            <div>
                <strong>${total}</strong> active users in the past <strong>${windowMinutes}</strong> minutes
            </div>
            <div class="active-users-roles">
                ${Object.entries(roles).map(([role, count]) => `<span>${this.formatRoleLabel(role)}: ${count}</span>`).join('')}
            </div>
        `;

        listEl.innerHTML = users.map(user => this.getActiveUserCard(user)).join('');
    }

    getActiveUserCard(userEntry) {
        const user = userEntry.user || {};
        const lastActivity = userEntry.lastActivity ? this.formatTimestamp(userEntry.lastActivity) : 'Unknown';
        const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown Name';
        const email = user.email || 'Unknown Email';
        const role = this.formatRoleLabel(user.role || 'unknown');
        const logCount = userEntry.logCount || 0;
        const event = this.escapeHtml(userEntry.lastEvent || 'No recent activity details');
        const ipInfo = this.escapeHtml([userEntry.ipAddress, userEntry.ipVersion].filter(Boolean).join(' • '));
        const hostName = userEntry.hostName ? `<div class="active-user-host">Hostname: ${this.escapeHtml(userEntry.hostName)}</div>` : '';

        return `
            <article class="active-user-card">
                <header>
                    <div class="active-user-name">${this.escapeHtml(name)}</div>
                    <div class="active-user-role">${role}</div>
                </header>
                <div class="active-user-email">${this.escapeHtml(email)}</div>
                <div class="active-user-meta">
                    <span>Last activity: ${this.escapeHtml(lastActivity)}</span>
                    <span>Events: ${this.escapeHtml(String(logCount))}</span>
                </div>
                <div class="active-user-event">${event}</div>
                <div class="active-user-ip">${ipInfo}</div>
                ${hostName}
            </article>
        `;
    }

    formatRoleLabel(role) {
        const normalized = String(role || 'unknown').toLowerCase();
        const labels = {
            admin: 'Admin',
            user: 'User',
            guest: 'Guest',
            unknown: 'Unknown'
        };
        return labels[normalized] || normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    openUniqueIPsModal() {
        const modal = document.getElementById('uniqueIPsModal');
        if (!modal) return;

        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.removeAttribute('hidden');

        this.loadUniqueIPs();
    }

    closeUniqueIPsModal() {
        const modal = document.getElementById('uniqueIPsModal');
        if (!modal) return;

        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.setAttribute('hidden', '');

        this.cleanupUniqueIPsRequest();
        this.clearActiveStatCardHighlight();
    }

    showUniqueIPsState({ loading = false, error = false, empty = false }) {
        const loadingEl = document.getElementById('uniqueIPsLoading');
        const errorEl = document.getElementById('uniqueIPsError');
        const emptyEl = document.getElementById('uniqueIPsEmpty');
        const contentEl = document.getElementById('uniqueIPsContent');

        if (loadingEl) {
            if (loading) {
                loadingEl.removeAttribute('hidden');
                loadingEl.style.display = 'flex';
            } else {
                loadingEl.setAttribute('hidden', '');
                loadingEl.style.display = 'none';
            }
        }

        if (errorEl) {
            if (error) {
                errorEl.removeAttribute('hidden');
                errorEl.style.display = 'block';
            } else {
                errorEl.setAttribute('hidden', '');
                errorEl.style.display = 'none';
            }
        }

        if (emptyEl) {
            if (empty) {
                emptyEl.removeAttribute('hidden');
                emptyEl.style.display = 'block';
            } else {
                emptyEl.setAttribute('hidden', '');
                emptyEl.style.display = 'none';
            }
        }

        if (contentEl) {
            if (!loading && !error && !empty) {
                contentEl.removeAttribute('hidden');
                contentEl.style.display = 'block';
            } else {
                contentEl.setAttribute('hidden', '');
                contentEl.style.display = 'none';
            }
        }
    }

    cleanupUniqueIPsRequest() {
        if (this._uniqueIPsAbort) {
            this._uniqueIPsAbort.abort();
            this._uniqueIPsAbort = null;
        }
    }

    async loadUniqueIPs() {
        const DEBUG = Boolean(window?.CONFIG?.DEBUG);
        try {
            this.cleanupUniqueIPsRequest();
            this.showUniqueIPsState({ loading: true, error: false, empty: false });

            this._uniqueIPsAbort = new AbortController();
            const timeRange = document.getElementById('timeRangeSelect')?.value || '24h';
            const qp = new URLSearchParams({ timeRange });

            const response = await fetch(`${API_BASE_URL}/network-logs/unique-ips?${qp.toString()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${window.getAuthToken()}`
                },
                signal: this._uniqueIPsAbort.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Failed to load unique IPs');
            }

            const ips = Array.isArray(data.data?.ips) ? data.data.ips : [];
            const total = Number(data.data?.totalUnique || 0);

            if (ips.length === 0) {
                this.showUniqueIPsState({ loading: false, error: false, empty: true });
            } else {
                this.renderUniqueIPs(data.data);
                this.showUniqueIPsState({ loading: false, error: false, empty: false });
            }

            if (!this.latestStatsOverview) {
                this.latestStatsOverview = {};
            }
            this.latestStatsOverview.uniqueIPCount = total;

            const uniqueIPsCard = document.querySelector('.stat-card[data-card-key="unique_ips"]');
            if (uniqueIPsCard) {
                const valueEl = uniqueIPsCard.querySelector('.stat-value');
                if (valueEl) valueEl.textContent = total;
            }

            if (DEBUG) console.log('Unique IPs loaded', { total, ips });
        } catch (error) {
            if (DEBUG) console.error('Failed to load unique IPs', error);
            if (error.name === 'AbortError') return;
            this.showUniqueIPsState({ loading: false, error: true, empty: false });
        }
    }

    retryUniqueIPs() {
        this.loadUniqueIPs();
    }

    renderUniqueIPs(data) {
        const summaryEl = document.getElementById('uniqueIPsSummary');
        const listEl = document.getElementById('uniqueIPsList');
        if (!summaryEl || !listEl) return;

        const total = Number(data.totalUnique || 0);
        const windowMinutes = Number(data.windowMinutes || 0);
        const versions = data.versions || {};
        const ips = Array.isArray(data.ips) ? data.ips : [];

        summaryEl.innerHTML = `
            <div>
                <strong>${total}</strong> unique IP addresses in the past <strong>${windowMinutes}</strong> minutes
            </div>
            <div class="unique-ips-versions">
                ${Object.entries(versions).map(([version, count]) => `<span>${version}: ${count}</span>`).join('')}
            </div>
        `;

        listEl.innerHTML = ips.map(ip => this.getUniqueIPCard(ip)).join('');
    }

    getUniqueIPCard(ipEntry) {
        const ipAddress = ipEntry.ipAddress || 'Unknown';
        const lastActivity = ipEntry.lastActivity ? this.formatTimestamp(ipEntry.lastActivity) : 'Unknown';
        const ipVersion = this.escapeHtml(ipEntry.ipVersion || 'Unknown');
        const logCount = ipEntry.logCount || 0;
        const lastEvent = this.escapeHtml(ipEntry.lastEvent || 'No recent activity details');
        const hostName = ipEntry.hostName ? `<div class="unique-ip-host">Hostname: ${this.escapeHtml(ipEntry.hostName)}</div>` : '';
        const tags = Array.isArray(ipEntry.ipTags) && ipEntry.ipTags.length ? 
            `<div class="unique-ip-tags">Tags: ${this.escapeHtml(ipEntry.ipTags.join(', '))}</div>` : '';
        const userEmail = ipEntry.userEmail ? `<div class="unique-ip-user">User: ${this.escapeHtml(ipEntry.userEmail)}</div>` : '';

        return `
            <article class="unique-ip-card">
                <header>
                    <div class="unique-ip-address">${this.escapeHtml(ipAddress)}</div>
                    <div class="unique-ip-version">${ipVersion}</div>
                </header>
                <div class="unique-ip-meta">
                    <span>Last activity: ${this.escapeHtml(lastActivity)}</span>
                    <span>Events: ${this.escapeHtml(String(logCount))}</span>
                </div>
                <div class="unique-ip-event">${lastEvent}</div>
                ${hostName}
                ${tags}
                ${userEmail}
            </article>
        `;
    }

    async loadInitialData() {
        try {
            
            const timeRange = document.getElementById('timeRangeSelect')?.value || '24h';
            if (window?.CONFIG?.DEBUG) console.log('🔧 Loading initial data with time range:', timeRange);
            
            await Promise.all([
                this.loadStats(timeRange),
                this.loadLogs()
            ]);
        } catch (error) {
            if (window?.CONFIG?.DEBUG) console.error('Error loading initial data:', error);
            this.showNotification('Failed to load initial data', 'error');
        }
    }

    async loadStats(timeRange = '24h') {
        try {
            const DEBUG = Boolean(window?.CONFIG?.DEBUG);
            if (DEBUG) {
                console.log('🔄 Loading network logs statistics...');
                console.log('API_BASE_URL:', API_BASE_URL);
                console.log('Auth token present:', !!window.getAuthToken());
            }
            
            this.hideError('statsErrorState');
            
            const response = await fetch(`${API_BASE_URL}/network-logs/stats?timeRange=${timeRange}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${window.getAuthToken()}`
                }
            });

            if (DEBUG) {
                console.log('Response status:', response.status);
                console.log('Response headers:', response.headers);
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                if (DEBUG) console.error('API Error Response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (DEBUG) console.log('API Response:', data);
            
            if (data.success) {
                this.renderStats(data.data);
            } else {
                throw new Error(data.message || 'Failed to load statistics');
            }
        } catch (error) {
            if (window?.CONFIG?.DEBUG) console.error('Error loading stats:', error);
            this.showError('statsErrorState');
            this.showNotification('Failed to load statistics', 'error');
        } finally {
            
        }
    }

    renderStats(data) {
        const DEBUG = Boolean(window?.CONFIG?.DEBUG);
        if (DEBUG) console.log('🎨 Rendering stats with data:', data);
        const statsGrid = document.getElementById('statsGrid');
        if (!statsGrid) {
            if (DEBUG) console.error('❌ statsGrid element not found!');
            return;
        }
        if (DEBUG) console.log('✅ statsGrid element found, rendering stats...');

        const stats = data.overview;
        const categoryBreakdown = data.categoryBreakdown;
        const levelBreakdown = data.levelBreakdown;

        this.latestStatsOverview = stats;
        this.latestStatsCategoryBreakdown = categoryBreakdown;
        this.latestStatsLevelBreakdown = levelBreakdown;

        const overviewStats = stats || {};
        const timeRangeLabel = this.getSelectedTimeRangeLabel();

        const cardsConfig = [
            {
                key: 'total',
                className: 'total',
                label: 'Total Logs',
                value: overviewStats.totalLogs,
                meta: `All events • ${timeRangeLabel}`,
                icon: 'fa-database',
                dataset: { filterReset: true },
                ariaLabel: 'Reset filters and show all logs'
            },
            {
                key: 'error',
                className: 'error',
                label: 'Error Logs',
                value: overviewStats.errorLogs,
                meta: 'High severity issues',
                icon: 'fa-triangle-exclamation',
                dataset: { filterLevel: 'error' },
                ariaLabel: 'Filter logs to show only errors'
            },
            {
                key: 'security',
                className: 'security',
                label: 'Security Events',
                value: overviewStats.securityLogs,
                meta: 'High priority alerts',
                icon: 'fa-shield-halved',
                dataset: { filterLevel: 'security', filterCategory: 'security' },
                ariaLabel: 'Filter logs to show only security events'
            },
            {
                key: 'warning',
                className: 'warning',
                label: 'Warnings',
                value: overviewStats.warningLogs,
                meta: 'Issues to keep an eye on',
                icon: 'fa-circle-exclamation',
                dataset: { filterLevel: 'warning' },
                ariaLabel: 'Filter logs to show only warnings'
            },
            {
                key: 'active_users',
                className: 'active-users',
                label: 'Active Users',
                value: overviewStats.uniqueUserCount,
                meta: 'Live user details',
                icon: 'fa-users',
                dataset: { actionActiveUsers: true },
                ariaLabel: 'Open active users overview'
            },
            {
                key: 'unique_ips',
                className: 'unique-ips',
                label: 'Unique IPs',
                value: overviewStats.uniqueIPCount,
                meta: 'View IP details',
                icon: 'fa-network-wired',
                dataset: { actionUniqueIps: true },
                ariaLabel: 'Open unique IP addresses overview'
            }
        ];

        const toDataAttribute = (name) => name.replace(/([A-Z])/g, '-$1').toLowerCase();
        const buildDatasetAttributes = (dataset = {}) => {
            return Object.entries(dataset).map(([key, val]) => {
                const attrName = `data-${toDataAttribute(key)}`;
                if (val === true || val === false) {
                    return `${attrName}="${val}"`;
                }
                if (val === null || typeof val === 'undefined') {
                    return `${attrName}=""`;
                }
                return `${attrName}="${val}"`;
            }).join(' ');
        };

        const cardsHtml = cardsConfig.map((card) => {
            const datasetAttributes = buildDatasetAttributes(card.dataset || {});
            const hasInteraction = Object.keys(card.dataset || {}).length > 0;
            const ariaLabelAttr = card.ariaLabel ? ` aria-label="${card.ariaLabel}"` : '';
            const interactionAttrs = hasInteraction ? ' role="button" tabindex="0"' : '';
            const classes = ['stat-card', `stat-card--${card.className}`];
            if (hasInteraction) classes.push('stat-card--clickable');

            return `
                <div class="${classes.join(' ')}"
                     data-card-key="${card.key}" ${datasetAttributes}${ariaLabelAttr}${interactionAttrs}>
                    <div class="stat-card__icon" aria-hidden="true">
                        <i class="fas ${card.icon}"></i>
                    </div>
                    <div class="stat-card__content">
                        <span class="stat-card__label stat-label">${card.label}</span>
                        <span class="stat-card__value stat-value">${this.formatNumber(card.value)}</span>
                        <span class="stat-card__meta stat-change">${card.meta}</span>
                    </div>
                </div>
            `;
        }).join('');

        statsGrid.innerHTML = cardsHtml;

        this.attachStatCardHandlers();
    }

    async loadLogs(page = 1) {
        try {
            const DEBUG = Boolean(window?.CONFIG?.DEBUG);
            if (DEBUG) {
                console.log('🔄 Loading network logs...');
                console.log('Current filters:', this.currentFilters);
            }

            this._logsAbort?.abort();
            this._logsAbort = new AbortController();
            
            this.hideError('logsErrorState');
            this.hideEmpty('logsEmptyState');
            
            const qp = new URLSearchParams({ 
                page: String(page), 
                limit: '50', 
                sortBy: this.currentSort.field, 
                sortOrder: this.currentSort.order 
            });
            Object.entries(this.currentFilters).forEach(([k,v])=>{ 
                if(v!=null && v!=='') {
                    qp.set(k, v);
                    if (window?.CONFIG?.DEBUG) console.log(`🔍 Adding filter: ${k} = ${v}`);
                }
            });
            
            if (window?.CONFIG?.DEBUG) {
                console.log('🔍 Final query params:', qp.toString());
                console.log('📊 Sort settings:', {
                    sortBy: this.currentSort.field,
                    sortOrder: this.currentSort.order
                });
            }

            const response = await fetch(`${API_BASE_URL}/network-logs?${qp}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${window.getAuthToken()}`
                },
                signal: this._logsAbort.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                const logs = data.data.logs || [];
                const pagination = data.data.pagination || {};
                
                if (logs.length === 0) {
                    this.showEmpty('logsEmptyState');
                    this.hideTable();
                } else {
                    this.hideEmpty('logsEmptyState');
                    this.showTable();
                    this.renderLogs(logs, pagination);
                }
                
                this.renderPagination(pagination);
                this.currentPage = pagination.currentPage || 1;
                this.totalPages = pagination.totalPages || 1;
            } else {
                throw new Error(data.message || 'Failed to load logs');
            }
        } catch (error) {
            if (window?.CONFIG?.DEBUG) console.error('Error loading logs:', error);
            this.showError('logsErrorState');
            this.hideTable();
            this.showNotification('Failed to load logs', 'error');
        } finally {
            
        }
    }

    renderLogs(logs, pagination = null) {
        const DEBUG = Boolean(window?.CONFIG?.DEBUG);
        if (DEBUG) console.log('🎨 Rendering logs with data:', logs);
        const tableBody = document.getElementById('logsTableBody');
        if (!tableBody) {
            if (DEBUG) console.error('❌ logsTableBody element not found!');
            return;
        }
        if (DEBUG) console.log('✅ logsTableBody element found, rendering logs...');

        tableBody.innerHTML = logs.map((log) => `
            <tr>
                <td><span class="log-id">${this.generateLogId(log.timestamp, log.sequenceNumber)}</span></td>
                <td>${this.formatTimestamp(log.timestamp)}</td>
                <td><span class="log-level ${log.level}">${log.level}</span></td>
                <td><span class="log-category">${this.formatCategory(log.category)}</span></td>
                <td>
                    <div style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escapeHtml(log.event)}">
                        ${this.escapeHtml(log.event)}
                    </div>
                </td>
                <td>
                    <div class="user-info">
                        ${log.userEmail ? `<span class="user-email">${this.escapeHtml(log.userEmail)}</span>` : '<span style="color: var(--text-muted);">Guest</span>'}
                        <span class="user-role">${this.escapeHtml(log.userRole)}</span>
                    </div>
                </td>
                <td><span class="ip-address" title="${this.escapeHtml(log.hostName || '')}${log.hostName ? ' • ' : ''}${this.escapeHtml(log.ipTags?.join(', ') || '')}">${this.escapeHtml(log.ipAddress)}${log.ipVersion ? ` <span class=\"ip-version\">(${this.escapeHtml(log.ipVersion)})</span>` : ''}</span></td>
                <td><span class="status-code ${this.getStatusClass(log.statusCode)}">${log.statusCode || '-'}</span></td>
                <td>
                    <span class="response-time ${this.getResponseTimeClass(log.responseTime)}">
                        ${log.responseTime ? `${log.responseTime}ms` : '-'}
                    </span>
                </td>
                <td>
                    <span class="request-id" title="${this.escapeHtml(log.requestId || '')}">
                        ${log.requestId ? this.escapeHtml(log.requestId.slice(0, 8)) + '…' : '-'}
                    </span>
                </td>
                <td>
                    <span class="severity-value">${this.getSeverityValue(log.severity)}</span>
                </td>
                <td>
                    <div class="log-actions">
                        <button class="log-action-btn" data-log-id="${this.escapeHtml(log._id)}" title="View Details" aria-label="View log details for ${this.escapeHtml(log.event)}">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        this.ensureEventListeners();
    }

    ensureEventListeners() {
        const DEBUG = Boolean(window?.CONFIG?.DEBUG);
        const tableBody = document.getElementById('logsTableBody');
        if (tableBody && !tableBody.hasAttribute('data-listener-attached')) {
            tableBody.addEventListener('click', (e) => {
                const btn = e.target.closest('.log-action-btn');
                if (btn && btn.dataset.logId) {
                    if (DEBUG) console.log('View button clicked for log:', btn.dataset.logId);
                    this.viewLogDetails(btn.dataset.logId);
                }
            });
            tableBody.setAttribute('data-listener-attached', 'true');
            if (DEBUG) console.log('✅ Event listener re-attached to logsTableBody');
        }
    }

    renderPagination(pagination) {
        const controls = document.getElementById('paginationControls');
        if (!controls) return;

        if (!this._pager && window.Pagination) {
            this._pager = window.Pagination.create({
                container: controls,
                onPage: (page) => this.loadLogs(page)
            });
        }

        if (this._pager) {
            this._pager.render({
                currentPage: pagination.currentPage || 1,
                totalPages: pagination.totalPages || 1,
                totalItems: pagination.totalLogs || 0,
                limit: pagination.limit || 50
            });
        } else {
            
            controls.style.display = (pagination.totalPages || 1) > 1 ? 'flex' : 'none';
        }
    }

    async viewLogDetails(logId) {
        const DEBUG = Boolean(window?.CONFIG?.DEBUG);
        if (DEBUG) console.log('🔍 viewLogDetails called with logId:', logId);
        
        try {
            if (DEBUG) console.log('📡 Fetching log details from API...');
            const response = await fetch(`${API_BASE_URL}/network-logs/${logId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${window.getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (DEBUG) console.log('📡 API response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (DEBUG) console.log('📡 API response data:', data);
            
            if (data.success) {
                
                const logWithId = { ...data.data, logId: this.generateLogId(data.data.timestamp, data.data.sequenceNumber) };
                if (DEBUG) console.log('🎨 Rendering log details and showing modal...');
                this.renderLogDetails(logWithId);
                this.showLogModal();
            } else {
                throw new Error(data.message || 'Failed to load log details');
            }
        } catch (error) {
            if (DEBUG) console.error('❌ Error loading log details:', error);
            this.showNotification('Failed to load log details', 'error');
        }
    }

    renderLogDetails(log) {
        const content = document.getElementById('logDetailsContent');
        if (!content) return;

        const safe = (t) => {
            if (t == null) return '';
            const div = document.createElement('div');
            div.textContent = String(t);
            return div.innerHTML;
        };

        const formatAdditionalData = (data) => {
            if (!data) return 'N/A';
            try {
                const pretty = JSON.stringify(data, null, 2);
                const shown = pretty.length > 20000 ? pretty.slice(0, 20000) + '\n' : pretty;
                return safe(shown);
            } catch (e) {
                return safe(String(data));
            }
        };

        content.innerHTML = `
            <div class="log-detail-item">
                <div class="log-detail-label">Log ID:</div>
                <div class="log-detail-value"><span class="log-id">${safe(log.logId || 'N/A')}</span></div>
            </div>
            <div class="log-detail-item">
                <div class="log-detail-label">Timestamp:</div>
                <div class="log-detail-value">${safe(this.formatTimestamp(log.timestamp))}</div>
            </div>
            <div class="log-detail-item">
                <div class="log-detail-label">Level:</div>
                <div class="log-detail-value"><span class="log-level ${safe(log.level)}">${safe(log.level)}</span></div>
            </div>
            <div class="log-detail-item">
                <div class="log-detail-label">Category:</div>
                <div class="log-detail-value"><span class="log-category">${safe(this.formatCategory(log.category))}</span></div>
            </div>
            <div class="log-detail-item">
                <div class="log-detail-label">Event:</div>
                <div class="log-detail-value">${safe(log.event)}</div>
            </div>
            <div class="log-detail-item">
                <div class="log-detail-label">Description:</div>
                <div class="log-detail-value">${safe(log.description)}</div>
            </div>
            <div class="log-detail-item">
                <div class="log-detail-label">User:</div>
                <div class="log-detail-value">
                    ${log.userEmail ? `${safe(log.userEmail)} (${safe(log.userRole)})` : 'Guest User'}
                </div>
            </div>
            <div class="log-detail-item">
                <div class="log-detail-label">IP Address:</div>
                <div class="log-detail-value">
                    <span class="ip-address">${safe(log.ipAddress)}</span>
                    ${log.ipVersion ? `<span class="ip-version">(${safe(log.ipVersion)})</span>` : ''}
                    ${log.hostName ? `<div class="ip-hostname">Hostname: ${safe(log.hostName)}</div>` : ''}
                    ${Array.isArray(log.ipTags) && log.ipTags.length ? `<div class="ip-tags">Tags: ${safe(log.ipTags.join(', '))}</div>` : ''}
                    ${log.ipGroup ? `<div class="ip-group">Group: ${safe(log.ipGroup)}</div>` : ''}
                </div>
            </div>
            <div class="log-detail-item">
                <div class="log-detail-label">Request ID:</div>
                <div class="log-detail-value"><span class="request-id">${safe(log.requestId || 'N/A')}</span></div>
            </div>
            <div class="log-detail-item">
                <div class="log-detail-label">User Agent:</div>
                <div class="log-detail-value">
                    ${safe(log.userAgent || 'N/A')}
                    ${log.userAgentMeta ? `<div class="ua-meta">Browser: ${safe(log.userAgentMeta.browser || 'Unknown')} ${safe(log.userAgentMeta.browserVersion || '')}<br/>OS: ${safe(log.userAgentMeta.os || 'Unknown')} ${safe(log.userAgentMeta.osVersion || '')}<br/>Device: ${safe(log.userAgentMeta.deviceVendor || '')} ${safe(log.userAgentMeta.deviceModel || '')} ${safe(log.userAgentMeta.deviceType || '')}</div>` : ''}
                </div>
            </div>
            <div class="log-detail-item">
                <div class="log-detail-label">Endpoint:</div>
                <div class="log-detail-value">${safe(log.endpoint || 'N/A')}</div>
            </div>
            <div class="log-detail-item">
                <div class="log-detail-label">Method:</div>
                <div class="log-detail-value">${safe(log.method || 'N/A')}</div>
            </div>
            <div class="log-detail-item">
                <div class="log-detail-label">Status Code:</div>
                <div class="log-detail-value"><span class="status-code ${this.getStatusClass(log.statusCode)}">${safe(log.statusCode || 'N/A')}</span></div>
            </div>
            <div class="log-detail-item">
                <div class="log-detail-label">Response Time:</div>
                <div class="log-detail-value">${log.responseTime ? `${safe(log.responseTime)}ms` : 'N/A'}</div>
            </div>
            <div class="log-detail-item">
                <div class="log-detail-label">Severity:</div>
                <div class="log-detail-value">
                    <span class="severity-value">${safe(log.severity)}/5</span>
                </div>
            </div>
            <div class="log-detail-item">
                <div class="log-detail-label">Additional Data:</div>
                <div class="log-detail-value">
                    <pre>${formatAdditionalData(log.additionalData)}</pre>
                </div>
            </div>
        `;
    }

    applyFilters() {
        const filters = {};
        
        const levelFilter = document.getElementById('levelFilter')?.value;
        const categoryFilter = document.getElementById('categoryFilter')?.value;
        const userRoleFilter = document.getElementById('userRoleFilter')?.value;
        const severityFilter = document.getElementById('severityFilter')?.value;
        const logIdFilter = document.getElementById('logIdFilter')?.value;
        const ipVersionFilter = document.getElementById('ipVersionFilter')?.value;
        const requestIdFilter = document.getElementById('requestIdFilter')?.value;

        const dateFrom = document.getElementById('dateFrom')?.value;
        const timeFrom = document.getElementById('timeFrom')?.value || '00:00';
        const dateTo = document.getElementById('dateTo')?.value;
        const timeTo = document.getElementById('timeTo')?.value || '23:59';

        if (dateFrom) {
            const startDateTime = new Date(`${dateFrom}T${timeFrom}`);
            if (!isNaN(startDateTime.getTime())) {
                filters.startDate = startDateTime.toISOString();
            }
        }
        
        if (dateTo) {
            const endDateTime = new Date(`${dateTo}T${timeTo}`);
            if (!isNaN(endDateTime.getTime())) {
                filters.endDate = endDateTime.toISOString();
            }
        }

        if (levelFilter) filters.level = levelFilter;
        if (categoryFilter) filters.category = categoryFilter;
        if (userRoleFilter) filters.userRole = userRoleFilter;
        if (severityFilter) filters.minSeverity = severityFilter;
        if (logIdFilter) filters.logId = logIdFilter;
        if (ipVersionFilter) filters.ipVersion = ipVersionFilter;
        if (requestIdFilter) filters.requestId = requestIdFilter;

        if (dateFrom || dateTo) {
            this.currentSort = { field: 'timestamp', order: 'desc' };
            this.updateSortIndicators('timestamp', 'desc');
            if (window?.CONFIG?.DEBUG) {
                console.log('🔍 Date filter applied, sorting by timestamp desc');
                console.log('📅 Date Range:', {
                    from: filters.startDate,
                    to: filters.endDate
                });
            }
        }

        if (window?.CONFIG?.DEBUG) {
            console.log('🔍 Applied filters:', filters);
            console.log('🔄 Current sort:', this.currentSort);
        }
        
        this.clearActiveStatCardHighlight();
        this.currentFilters = filters;
        this.currentPage = 1;
        this.loadLogs(1);
    }

    clearFilters() {
        this.resetFilterInputs();
        this.currentFilters = {};
        this.currentPage = 1;
        this.clearActiveStatCardHighlight();
        this.loadLogs(1);
    }

    async exportLogs() {
        try {
            const queryParams = new URLSearchParams({
                format: 'csv',
                ...this.currentFilters
            });

            const response = await fetch(`${API_BASE_URL}/network-logs/export/csv?${queryParams}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${window.getAuthToken()}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `network_logs_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            this.showNotification('Logs exported successfully', 'success');
        } catch (error) {
            if (window?.CONFIG?.DEBUG) console.error('Error exporting logs:', error);
            this.showNotification('Failed to export logs', 'error');
        }
    }

    toggleRealtime() {
        const button = document.getElementById('toggleRealtime');
        const icon = button.querySelector('i');
        const text = button.querySelector('span');

        if (this.isRealtimeEnabled) {
            this.isRealtimeEnabled = false;
            clearInterval(this.realtimeInterval);

            button.classList.remove('active');
            icon.className = 'fas fa-play';
            text.textContent = 'Real-time';

            const logsContainer = document.getElementById('logsContainer');
            if (logsContainer) {
                logsContainer.classList.remove('realtime-active');
            }
            
            this.showNotification('Real-time logs disabled', 'info');
        } else {
            this.isRealtimeEnabled = true;

            this.realtimeInterval = setInterval(() => {
                this.lastRealtimeUpdate = new Date();
                this.loadLogs(this.currentPage);
            }, 5000);

            button.classList.add('active');
            icon.className = 'fas fa-pause';
            text.textContent = 'Pause';

            const logsContainer = document.getElementById('logsContainer');
            if (logsContainer) {
                logsContainer.classList.add('realtime-active');
            }
            
            this.showNotification('Real-time logs enabled - logs will update every 5 seconds', 'success');
        }
    }

    showCleanupModal() {
        const modal = document.getElementById('cleanupModal');
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
            modal.removeAttribute('hidden');
        }
    }

    closeCleanupModal() {
        const modal = document.getElementById('cleanupModal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
            modal.setAttribute('hidden', '');
        }
    }

    showClearIPHistoryModal() {
        const modal = document.getElementById('clearIPHistoryModal');
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
            modal.removeAttribute('hidden');
        }
    }

    closeClearIPHistoryModal() {
        const modal = document.getElementById('clearIPHistoryModal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
            modal.setAttribute('hidden', '');
        }
    }

    async performCleanup() {
        try {
            const daysInput = document.getElementById('cleanupDays');
            const includeProtected = document.getElementById('includeProtectedLogs');
            const daysVal = parseInt(daysInput ? daysInput.value : '0', 10);

            if (!Number.isFinite(daysVal) || daysVal <= 0) {
                this.showNotification('Please enter a valid number of days', 'error');
                return;
            }
            
            const response = await fetch(`${API_BASE_URL}/network-logs/cleanup`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    days: daysVal,
                    includeProtected: includeProtected ? includeProtected.checked : false
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                if (Number(data.deletedCount) > 0) {
                    this.showNotification(`Successfully deleted ${data.deletedCount} old logs`, 'success');
                } else {
                    this.showNotification('No logs deleted. None matched the criteria or were preserved (critical/security).', 'info');
                }
                this.closeCleanupModal();
                this.loadLogs(this.currentPage); 
            } else {
                throw new Error(data.message || 'Failed to cleanup logs');
            }
        } catch (error) {
            if (window?.CONFIG?.DEBUG) console.error('Error performing cleanup:', error);
            this.showNotification('Failed to cleanup logs', 'error');
        }
    }

    async performClearIPHistory() {
        try {
            console.log('[FRONTEND] Starting IP history clear request');
            const authToken = window.getAuthToken();
            if (!authToken) {
                throw new Error('No authentication token found');
            }
            console.log('[FRONTEND] Auth token found, making request...');

            const response = await fetch(`${API_BASE_URL}/network-logs/clear-ip-history`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('[FRONTEND] Response status:', response.status);
            console.log('[FRONTEND] Response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[FRONTEND] HTTP error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const data = await response.json();
            console.log('[FRONTEND] Response data:', data);
            
            if (data.success) {
                if (Number(data.deletedCount) > 0) {
                    this.showNotification(`Successfully cleared ${data.deletedCount} IP history entries older than 24 hours`, 'success');
                } else {
                    this.showNotification('No IP history entries were cleared. All logs are within the last 24 hours or are protected.', 'info');
                }
                this.closeClearIPHistoryModal();
                
                this.loadLogs(this.currentPage);
                this.loadStats();
                
                if (document.getElementById('uniqueIPsModal')?.classList.contains('active')) {
                    this.loadUniqueIPs();
                }
            } else {
                throw new Error(data.message || 'Failed to clear IP history');
            }
        } catch (error) {
            console.error('[FRONTEND] Error clearing IP history:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            this.showNotification(`Failed to clear IP history: ${error.message}`, 'error');
        }
    }

    showLogModal() {
        const DEBUG = Boolean(window?.CONFIG?.DEBUG);
        const modal = document.getElementById('logDetailsModal');
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
            modal.removeAttribute('hidden');
            if (DEBUG) console.log('✅ Modal shown');
        } else {
            if (DEBUG) console.error('❌ Modal element not found');
        }
    }

    closeLogModal() {
        const DEBUG = Boolean(window?.CONFIG?.DEBUG);
        const modal = document.getElementById('logDetailsModal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
            modal.setAttribute('hidden', '');
            if (DEBUG) console.log('✅ Modal closed');
        } else {
            if (DEBUG) console.error('❌ Modal element not found');
        }
    }

    formatTimestamp(timestamp) {
        return new Date(timestamp).toLocaleString();
    }

    formatCategory(category) {
        if (!category) return 'Unknown';
        return String(category).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    formatNumber(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) {
            return value ? String(value) : '0';
        }
        try {
            return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(num);
        } catch (error) {
            if (window?.CONFIG?.DEBUG) console.warn('Failed to format number', { value, error });
            return String(num);
        }
    }

    getSelectedTimeRangeLabel() {
        const select = document.getElementById('timeRangeSelect');
        if (!select) return 'Selected range';
        const option = select.options?.[select.selectedIndex];
        const label = option?.text?.trim();
        if (label) return label;
        const value = select.value || '24h';
        const labelMap = {
            '1h': 'Last Hour',
            '24h': 'Last 24 Hours',
            '7d': 'Last 7 Days',
            '30d': 'Last 30 Days'
        };
        return labelMap[value] || `Last ${value}`;
    }

    getStatusClass(statusCode) {
        const n = Number(statusCode);
        if (!Number.isFinite(n)) return '';
        if (n >= 200 && n < 300) return 'success';
        if (n >= 300 && n < 400) return 'warning';
        if (n >= 400) return 'error';
        return '';
    }

    getResponseTimeClass(responseTime) {
        const n = Number(responseTime);
        if (!Number.isFinite(n)) return '';
        if (n > 1000) return 'slow';
        if (n < 200) return 'fast';
        return '';
    }

    getSeverityClass(severity) {
        const sev = Math.max(1, Math.min(5, Number(severity) || 1));
        return `severity-${sev}`;
    }

    getSeverityValue(severity) {
        const sev = Math.max(1, Math.min(5, Number(severity) || 1));
        return sev;
    }

    generateLogId(timestamp, sequenceNumber) {
        if (!sequenceNumber) {
            return 'N/A'; 
        }
        
        const date = new Date(timestamp);
        const year = date.getFullYear().toString().slice(-2); 
        const monthLetter = String.fromCharCode(65 + date.getMonth()); 

        const sequentialId = String(sequenceNumber).padStart(3, '0'); 
        
        return `${year}${monthLetter}-${sequentialId}`;
    }

    showError(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.removeAttribute('hidden');
            element.style.display = 'block';
        }
    }

    hideError(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.setAttribute('hidden', '');
            element.style.display = 'none';
        }
    }

    showEmpty(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.removeAttribute('hidden');
            element.style.display = 'block';
        }
    }

    hideEmpty(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.setAttribute('hidden', '');
            element.style.display = 'none';
        }
    }

    showTable() {
        const container = document.getElementById('logsContainer');
        const paginationInfo = document.getElementById('paginationInfo');
        const paginationControls = document.getElementById('paginationControls');
        
        if (container) container.style.display = 'block';
        if (paginationInfo) paginationInfo.style.display = 'flex';
        if (paginationControls) paginationControls.style.display = 'flex';
    }

    hideTable() {
        const container = document.getElementById('logsContainer');
        const paginationInfo = document.getElementById('paginationInfo');
        const paginationControls = document.getElementById('paginationControls');
        
        if (container) container.style.display = 'none';
        if (paginationInfo) paginationInfo.style.display = 'none';
        if (paginationControls) paginationControls.style.display = 'none';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    attachStatCardHandlers() {
        const statsGrid = document.getElementById('statsGrid');
        if (!statsGrid) return;

        const cards = statsGrid.querySelectorAll('.stat-card');
        cards.forEach(card => {
            const hasFilter = typeof card.dataset.filterReset !== 'undefined' ||
                typeof card.dataset.filterLevel !== 'undefined' ||
                typeof card.dataset.filterCategory !== 'undefined' ||
                typeof card.dataset.filterSeverity !== 'undefined' ||
                typeof card.dataset.filterUserRole !== 'undefined' ||
                typeof card.dataset.actionActiveUsers !== 'undefined' ||
                typeof card.dataset.actionUniqueIps !== 'undefined';

            if (hasFilter) {
                card.setAttribute('role', 'button');
                if (!card.hasAttribute('tabindex')) {
                    card.setAttribute('tabindex', '0');
                }
                card.addEventListener('click', () => this.handleStatCardClick(card));
                card.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        card.click();
                    }
                });
                if (this.activeStatCardKey && card.dataset.cardKey === this.activeStatCardKey) {
                    card.classList.add('stat-card-active');
                    this.activeStatCard = card;
                }
            }
        });
    }

    handleStatCardClick(card) {
        const resetFilters = card.dataset.filterReset === 'true';

        if (resetFilters) {
            this.resetFilterInputs();
            this.currentFilters = {};
            this.currentPage = 1;
            this.highlightStatCard(card);
            this.loadLogs(1);
            return;
        }

        if (typeof card.dataset.actionActiveUsers !== 'undefined') {
            this.highlightStatCard(card);
            this.openActiveUsersModal();
            return;
        }

        if (typeof card.dataset.actionUniqueIps !== 'undefined') {
            this.highlightStatCard(card);
            this.openUniqueIPsModal();
            return;
        }

        this.resetFilterInputs();

        const newFilters = {};

        if (typeof card.dataset.filterLevel !== 'undefined') {
            const levelValue = card.dataset.filterLevel;
            const levelSelect = document.getElementById('levelFilter');
            if (levelSelect) levelSelect.value = levelValue || '';
            if (levelValue) newFilters.level = levelValue;
        }

        if (typeof card.dataset.filterCategory !== 'undefined') {
            const categoryValue = card.dataset.filterCategory;
            const categorySelect = document.getElementById('categoryFilter');
            if (categorySelect) categorySelect.value = categoryValue || '';
            if (categoryValue) newFilters.category = categoryValue;
        }

        if (typeof card.dataset.filterSeverity !== 'undefined') {
            const severityValue = card.dataset.filterSeverity;
            const severitySelect = document.getElementById('severityFilter');
            if (severitySelect) severitySelect.value = severityValue || '';
            if (severityValue) newFilters.minSeverity = severityValue;
        }

        if (typeof card.dataset.filterUserRole !== 'undefined') {
            const roleValue = card.dataset.filterUserRole;
            const roleSelect = document.getElementById('userRoleFilter');
            if (roleSelect) roleSelect.value = roleValue || '';
            if (roleValue) newFilters.userRole = roleValue;
        }

        this.currentFilters = newFilters;
        this.currentPage = 1;
        this.highlightStatCard(card);
        this.loadLogs(1);
    }

    highlightStatCard(card) {
        this.clearActiveStatCardHighlight();
        card.classList.add('stat-card-active');
        this.activeStatCard = card;
        this.activeStatCardKey = card.dataset.cardKey || null;
    }

    clearActiveStatCardHighlight() {
        if (this.activeStatCard) {
            this.activeStatCard.classList.remove('stat-card-active');
        }
        this.activeStatCard = null;
        this.activeStatCardKey = null;
    }

    resetFilterInputs() {
        ['levelFilter', 'categoryFilter', 'userRoleFilter', 'severityFilter', 'logIdFilter']
            .forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        ['ipVersionFilter', 'requestIdFilter']
            .forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        
        ['dateFrom', 'dateTo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        
        const timeFrom = document.getElementById('timeFrom');
        const timeTo = document.getElementById('timeTo');
        if (timeFrom) timeFrom.value = '00:00';
        if (timeTo) timeTo.value = '23:59';
    }
}

let networkLogsManager;

document.addEventListener('DOMContentLoaded', () => {
    const DEBUG = Boolean(window?.CONFIG?.DEBUG);
    if (DEBUG) console.log('🚀 DOM Content Loaded - Initializing NetworkLogsManager...');

    const token = window.getAuthToken();
    if (DEBUG) console.log('🔐 Authentication check:', token ? 'Token found' : 'No token found');

    if (!token) {
        if (DEBUG) console.error('❌ No authentication token found. Please login first.');
        
        const statsGrid = document.getElementById('statsGrid');
        if (statsGrid) {
            statsGrid.innerHTML = `
                <div class="error-state" style="display: block;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Authentication Required</h3>
                    <p>Please log in to access the Network Logs dashboard.</p>
                    <button onclick="setManualAuthToken()" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Set Test Token
                    </button>
                </div>
            `;
        }
        return;
    }

    const requiredElements = [
        'statsGrid', 'logsTableBody', 'applyFilters', 'refreshStats', 'refreshLogs'
    ];

    const missingElements = requiredElements.filter(id => !document.getElementById(id));

    if (missingElements.length > 0) {
        if (DEBUG) console.error('❌ Missing required DOM elements:', missingElements);
    } else {
        if (DEBUG) console.log('✅ All required DOM elements found');
    }

    networkLogsManager = new NetworkLogsManager();
    if (DEBUG) console.log('✅ NetworkLogsManager initialized');
});

function setManualAuthToken() {
    if (!window?.CONFIG?.DEV_ALLOW_INSECURE_TOKEN_SOURCES) {
        if (window?.CONFIG?.DEBUG) console.error('Manual token setting is only allowed in development mode');
        return;
    }

    const testToken = prompt('Enter test token:');
    if (testToken) {
        localStorage.setItem('authToken', testToken);
        if (window?.CONFIG?.DEBUG) console.log('✅ Test token set manually');
        
        location.reload();
    }
}

