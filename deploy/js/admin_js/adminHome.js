

const CHARTS_CONFIG = {
    BASE_URL: 'https://charts.mongodb.com/charts-project-0-bwexumm',
    CHART_IDS: {
        CHART_1: '4cf21a66-0e01-4a3e-b5cc-3f9c419dbda1',
        CHART_2: '2ebdb0e9-ced2-431a-abe9-b9c4d91a0fda',
        
        CHART_2_WEEKLY: '914623d7-8f80-4e9f-86f9-2c2653acab75',
        CHART_2_MONTHLY: 'f592312e-c157-49ee-b62f-640db5bcac12',
        CHART_2_WEEKLY_BY_DATE: 'ed2ff90e-1d4b-4ea5-bd4d-cc666adffc2f',
        CHART_2_DAILY: '85a17949-1223-486d-aa9b-e9e773135466'
    },
    MAX_DATA_AGE: 0, 
    AUTO_REFRESH: true
};

let chart1 = null;
let chart2 = null;

let preloadedCharts = {
    weekly: null,
    hourly: null,
    'weekly-by-date': null,
    daily: null
};

let chartContainers = {
    weekly: null,
    hourly: null,
    'weekly-by-date': null,
    daily: null
};

function getCurrentTheme() {
    return document.documentElement.hasAttribute('data-theme') ? 'dark' : 'light';
}

async function loadChartsConfig() {
    try {
        console.log('📊 Loading MongoDB Charts configuration...');
        const response = await window.api.get('/admin/charts/config');
        
        if (response && response.success && response.charts) {
            const charts = response.charts;

            CHARTS_CONFIG.BASE_URL = charts.baseUrl || CHARTS_CONFIG.BASE_URL;
            CHARTS_CONFIG.MAX_DATA_AGE = charts.maxDataAge || CHARTS_CONFIG.MAX_DATA_AGE;

            if (charts.chart1Id) CHARTS_CONFIG.CHART_IDS.CHART_1 = charts.chart1Id;
            if (charts.chart2Id) CHARTS_CONFIG.CHART_IDS.CHART_2 = charts.chart2Id;
            if (charts.weeklyId) CHARTS_CONFIG.CHART_IDS.CHART_2_WEEKLY = charts.weeklyId;
            if (charts.monthlyId) CHARTS_CONFIG.CHART_IDS.CHART_2_MONTHLY = charts.monthlyId;
            if (charts.weeklyByDateId) CHARTS_CONFIG.CHART_IDS.CHART_2_WEEKLY_BY_DATE = charts.weeklyByDateId;
            if (charts.dailyId) CHARTS_CONFIG.CHART_IDS.CHART_2_DAILY = charts.dailyId;
            
            console.log('✅ MongoDB Charts configuration loaded:', CHARTS_CONFIG);
        } else {
            console.warn('⚠️ No charts configuration received from backend, using defaults');
        }
    } catch (error) {
        console.error('❌ Error loading charts configuration:', error);
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Admin Dashboard Initializing...');

    if (!window.auth || !window.auth.checkAdminAuth()) {
        window.location.href = 'user_login.html?auth=required';
        return;
    }

    if (!window.api) {
        window.api = new ApiService();
    }

    loadRecentActivity();
    loadQuickStats();

    waitForSDK().then(async () => {
        try {
            
            await loadChartsConfig();

            console.log('🔧 Final CHARTS_CONFIG after loading:', CHARTS_CONFIG);

        initializeChart1();
        initializeChart2();

        window.addEventListener('themeChanged', (e) => {
            console.log('Theme changed to:', e.detail.theme);
            
            if (chart1) {
                chart1.setTheme(e.detail.theme);
            }
                
                Object.values(preloadedCharts).forEach(chart => {
                    if (chart) {
                        chart.setTheme(e.detail.theme);
                    }
                });
            });
        } catch (error) {
            console.error('Failed to load charts configuration:', error);
            
            console.log('Using default charts configuration');
            initializeChart1();
            initializeChart2();
        }
    }).catch(err => {
        console.error('Failed to load MongoDB Charts SDK:', err);
        showGlobalSDKError();
    });

    if (window.RefreshUtils && window.RefreshUtils.manager) {
        window.RefreshUtils.manager.register('refreshDashboard', async () => {
            try {
                
                await loadChartsConfig();
                if (chart1) chart1.refresh();
                if (chart2) chart2.refresh();
            } catch (error) {
                console.error('Error refreshing charts:', error);
                
            if (chart1) chart1.refresh();
            if (chart2) chart2.refresh();
            }
        }, {
            normalText: 'Dashboard',
            loadingText: 'Refreshing charts...',
            successText: 'Charts updated!',
            errorText: 'Failed to refresh'
        });
        
        window.RefreshUtils.manager.register('refreshActivity', loadRecentActivity, {
            normalText: 'Activity',
            loadingText: 'Refreshing activity...',
            successText: 'Activity updated!',
            errorText: 'Failed to refresh'
        });
    }

    const refreshBtn = document.getElementById('refreshDashboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadQuickStats();
        });
    }
});

function waitForSDK() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50; 
        
        const checkSDK = () => {
            if (window.ChartsEmbedSDK) {
                console.log('✅ ChartsEmbedSDK available');
                resolve();
            } else if (attempts >= maxAttempts) {
                reject(new Error('SDK loading timeout'));
            } else {
                attempts++;
                setTimeout(checkSDK, 100);
            }
        };
        
        checkSDK();
    });
}

function showGlobalSDKError() {
    const containers = [
        { loading: 'chart1Loading', error: 'chart1Error', container: 'chart1Container' },
        { loading: 'chart2Loading', error: 'chart2Error', container: 'chart2Container' }
    ];
    
    containers.forEach(ids => {
        const loadingEl = document.getElementById(ids.loading);
        const errorEl = document.getElementById(ids.error);
        const containerEl = document.getElementById(ids.container);
        
        if (loadingEl) loadingEl.hidden = true;
        if (containerEl) containerEl.hidden = true;
        if (errorEl) {
            errorEl.hidden = false;
            const messageEl = errorEl.querySelector('p');
            if (messageEl) {
                messageEl.textContent = 'Failed to load MongoDB Charts SDK. Please check your internet connection and firewall settings.';
            }
        }
    });
}

function initializeChart1() {
    console.log('📊 Initializing Chart 1...');
    
    const container = document.getElementById('chart1Container');
    const loadingEl = document.getElementById('chart1Loading');
    const errorEl = document.getElementById('chart1Error');
    
    if (!container || !window.ChartsEmbedSDK) {
        console.error('❌ Chart 1 container or SDK not found');
        return;
    }
    
    if (loadingEl) loadingEl.hidden = false;
    if (container) container.hidden = true;
    if (errorEl) errorEl.hidden = true;
    
    try {
        const sdk = new ChartsEmbedSDK({
            baseUrl: CHARTS_CONFIG.BASE_URL
        });
        
        console.log('🎯 Creating Chart 1 with ID:', CHARTS_CONFIG.CHART_IDS.CHART_1);
        const currentTheme = getCurrentTheme();
        console.log('Current theme:', currentTheme);
        
        chart1 = sdk.createChart({
            chartId: CHARTS_CONFIG.CHART_IDS.CHART_1,
            height: '400px',
            width: '100%',
            theme: currentTheme,
            autoRefresh: CHARTS_CONFIG.AUTO_REFRESH,
            maxDataAge: CHARTS_CONFIG.MAX_DATA_AGE,
            showAttribution: false
        });
        
        chart1.render(container)
            .then(() => {
                console.log('✅ Chart 1 rendered successfully!');
                if (loadingEl) loadingEl.hidden = true;
                if (container) container.hidden = false;
                if (errorEl) errorEl.hidden = true;
            })
            .catch((error) => {
                console.error('❌ Chart 1 render failed:', error);
                if (loadingEl) loadingEl.hidden = true;
                if (container) container.hidden = true;
                if (errorEl) {
                    errorEl.hidden = false;
                    
                    const retryBtn = errorEl.querySelector('.btn-retry');
                    if (retryBtn) {
                        retryBtn.onclick = () => {
                            console.log('🔄 Retrying Chart 1...');
                            initializeChart1();
                        };
                    }
                }
            });
        
    } catch (error) {
        console.error('❌ Error creating Chart 1:', error);
        if (loadingEl) loadingEl.hidden = true;
        if (errorEl) errorEl.hidden = false;
    }
}

async function initializeChart2() {
    console.log('📊 Initializing Chart 2 with preloading...');
    
    const container = document.getElementById('chart2Container');
    const loadingEl = document.getElementById('chart2Loading');
    const errorEl = document.getElementById('chart2Error');
    const selector = document.getElementById('chart2Selector');
    
    if (!container || !window.ChartsEmbedSDK) {
        console.error('❌ Chart 2 container or SDK not found');
        return;
    }

    if (selector) {
        
        selector.removeEventListener('change', handleChart2DropdownChange);

        selector.addEventListener('change', handleChart2DropdownChange);

        selector.value = 'weekly';
        
        console.log('✅ Chart 2 dropdown event listener set up');
    }

    if (loadingEl) loadingEl.hidden = false;
    if (container) container.hidden = true;
    if (errorEl) errorEl.hidden = true;
    
    try {
        
        console.log('🔄 Loading default chart immediately...');
        await loadDefaultChart();

        showPreloadedChart('weekly');

        console.log('🔄 Preloading remaining charts in background...');
        preloadRemainingCharts();
        
        console.log('✅ Chart 2 initialization complete');
        
    } catch (error) {
        console.error('❌ Error initializing Chart 2:', error);
        if (loadingEl) loadingEl.hidden = true;
        if (errorEl) errorEl.hidden = false;
    }
}

function handleChart2DropdownChange(e) {
            const selectedValue = e.target.value;
    const selector = e.target;
    
            console.log('📊 Chart 2 dropdown changed to:', selectedValue);

    showPreloadedChart(selectedValue);
}

async function loadDefaultChart() {
    console.log('🔄 Loading default chart (weekly) immediately...');
    
    const sdk = new ChartsEmbedSDK({
        baseUrl: CHARTS_CONFIG.BASE_URL
    });
    
    const currentTheme = getCurrentTheme();
    const mainContainer = document.getElementById('chart2Container');
    
    if (!mainContainer) {
        throw new Error('Main chart container not found');
    }

    mainContainer.style.position = 'relative';

    const defaultContainer = document.createElement('div');
    defaultContainer.id = 'chart2_weekly';
    defaultContainer.style.position = 'absolute';
    defaultContainer.style.top = '0';
    defaultContainer.style.left = '0';
    defaultContainer.style.width = '100%';
    defaultContainer.style.height = '400px';
    defaultContainer.style.visibility = 'visible';
    defaultContainer.style.pointerEvents = 'auto';
    defaultContainer.style.zIndex = '1';
    mainContainer.appendChild(defaultContainer);
    chartContainers.weekly = defaultContainer;

    const chartId = getChartIdForPeriod('weekly');
    const chart = sdk.createChart({
        chartId: chartId,
        height: '400px',
        width: '100%',
        theme: currentTheme,
        autoRefresh: CHARTS_CONFIG.AUTO_REFRESH,
        maxDataAge: CHARTS_CONFIG.MAX_DATA_AGE,
        showAttribution: false
    });
    
    await chart.render(defaultContainer);
    preloadedCharts.weekly = chart;
    
    console.log('✅ Default chart loaded successfully');
}

async function preloadRemainingCharts() {
    console.log('🔄 Starting background preloading of remaining charts...');
    
    const sdk = new ChartsEmbedSDK({
        baseUrl: CHARTS_CONFIG.BASE_URL
    });
    
    const currentTheme = getCurrentTheme();
    const mainContainer = document.getElementById('chart2Container');
    const remainingPeriods = ['hourly', 'weekly-by-date', 'daily'];

    remainingPeriods.forEach(period => {
        const hiddenContainer = document.createElement('div');
        hiddenContainer.id = `chart2_${period}`;
        hiddenContainer.style.position = 'absolute';
        hiddenContainer.style.top = '0';
        hiddenContainer.style.left = '0';
        hiddenContainer.style.width = '100%';
        hiddenContainer.style.height = '400px';
        hiddenContainer.style.visibility = 'hidden';
        hiddenContainer.style.pointerEvents = 'none';
        hiddenContainer.style.zIndex = '-1';
        mainContainer.appendChild(hiddenContainer);
        chartContainers[period] = hiddenContainer;
    });

    remainingPeriods.forEach(async (period, index) => {
        
        setTimeout(async () => {
            try {
                const chartId = getChartIdForPeriod(period);
                console.log(`🔄 Background loading ${period} chart with ID: ${chartId}`);
                
                const chart = sdk.createChart({
                    chartId: chartId,
                    height: '400px',
                    width: '100%',
                    theme: currentTheme,
                    autoRefresh: CHARTS_CONFIG.AUTO_REFRESH,
                    maxDataAge: CHARTS_CONFIG.MAX_DATA_AGE,
                    showAttribution: false
                });
                
                await chart.render(chartContainers[period]);
                preloadedCharts[period] = chart;
                
                console.log(`✅ ${period} chart preloaded in background`);
            } catch (error) {
                console.error(`❌ Error preloading ${period} chart:`, error);
            }
        }, index * 1000); 
    });
}

async function preloadAllCharts() {
    console.log('🔄 Starting chart preloading...');
    
    const sdk = new ChartsEmbedSDK({
        baseUrl: CHARTS_CONFIG.BASE_URL
    });
    
    const currentTheme = getCurrentTheme();
    const timePeriods = ['weekly', 'hourly', 'weekly-by-date', 'daily'];

    const mainContainer = document.getElementById('chart2Container');
    if (!mainContainer) {
        throw new Error('Main chart container not found');
    }

    mainContainer.style.position = 'relative';

    timePeriods.forEach(period => {
        const hiddenContainer = document.createElement('div');
        hiddenContainer.id = `chart2_${period}`;
        hiddenContainer.style.position = 'absolute';
        hiddenContainer.style.top = '0';
        hiddenContainer.style.left = '0';
        hiddenContainer.style.width = '100%';
        hiddenContainer.style.height = '400px';
        hiddenContainer.style.visibility = 'hidden';
        hiddenContainer.style.pointerEvents = 'none';
        hiddenContainer.style.zIndex = '-1';
        mainContainer.appendChild(hiddenContainer);
        chartContainers[period] = hiddenContainer;
    });

    const preloadPromises = timePeriods.map(async (period) => {
        try {
            const chartId = getChartIdForPeriod(period);
            console.log(`🔄 Preloading ${period} chart with ID: ${chartId}`);
            
            const chart = sdk.createChart({
                chartId: chartId,
                height: '400px',
                width: '100%',
                theme: currentTheme,
                autoRefresh: CHARTS_CONFIG.AUTO_REFRESH,
                maxDataAge: CHARTS_CONFIG.MAX_DATA_AGE,
                showAttribution: false
            });
            
            await chart.render(chartContainers[period]);
            preloadedCharts[period] = chart;
            
            console.log(`✅ ${period} chart preloaded successfully`);
        } catch (error) {
            console.error(`❌ Error preloading ${period} chart:`, error);
            throw error;
        }
    });
    
    await Promise.all(preloadPromises);
    console.log('✅ All charts preloaded successfully');
}

function getChartIdForPeriod(timePeriod) {
    const chartMapping = {
        'weekly': CHARTS_CONFIG.CHART_IDS.CHART_2_MONTHLY,      
        'hourly': CHARTS_CONFIG.CHART_IDS.CHART_2_WEEKLY,       
        'weekly-by-date': CHARTS_CONFIG.CHART_IDS.CHART_2_DAILY, 
        'daily': CHARTS_CONFIG.CHART_IDS.CHART_2_WEEKLY_BY_DATE  
    };
    
    return chartMapping[timePeriod] || CHARTS_CONFIG.CHART_IDS.CHART_2_WEEKLY;
}

function showPreloadedChart(timePeriod) {
    console.log(`🔄 Switching to ${timePeriod} chart`);
    
    const mainContainer = document.getElementById('chart2Container');
    const loadingEl = document.getElementById('chart2Loading');
    const errorEl = document.getElementById('chart2Error');

    if (preloadedCharts[timePeriod] && chartContainers[timePeriod]) {
        console.log(`✅ ${timePeriod} chart is preloaded, switching instantly`);

        Object.values(chartContainers).forEach(container => {
            if (container) {
                container.style.visibility = 'hidden';
                container.style.pointerEvents = 'none';
            }
        });

        chartContainers[timePeriod].style.visibility = 'visible';
        chartContainers[timePeriod].style.pointerEvents = 'auto';
        chartContainers[timePeriod].style.zIndex = '1';

        if (loadingEl) loadingEl.hidden = true;
        if (errorEl) errorEl.hidden = true;
        if (mainContainer) mainContainer.hidden = false;
        
        console.log(`✅ Switched to ${timePeriod} chart instantly`);
    } else {
        
        console.log(`⏳ ${timePeriod} chart not preloaded yet, loading on-demand...`);
        loadChartOnDemand(timePeriod);
    }
}

async function loadChartOnDemand(timePeriod) {
    const mainContainer = document.getElementById('chart2Container');
    const loadingEl = document.getElementById('chart2Loading');
    const errorEl = document.getElementById('chart2Error');
    
    try {
        
        if (loadingEl) loadingEl.hidden = false;
        if (mainContainer) mainContainer.hidden = true;
        if (errorEl) errorEl.hidden = true;
        
        const sdk = new ChartsEmbedSDK({
            baseUrl: CHARTS_CONFIG.BASE_URL
        });
        
        const currentTheme = getCurrentTheme();

        if (!chartContainers[timePeriod]) {
            const container = document.createElement('div');
            container.id = `chart2_${timePeriod}`;
            container.style.position = 'absolute';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '100%';
            container.style.height = '400px';
            container.style.visibility = 'hidden';
            container.style.pointerEvents = 'none';
            container.style.zIndex = '-1';
            mainContainer.appendChild(container);
            chartContainers[timePeriod] = container;
        }

        const chartId = getChartIdForPeriod(timePeriod);
        const chart = sdk.createChart({
            chartId: chartId,
            height: '400px',
            width: '100%',
            theme: currentTheme,
            autoRefresh: CHARTS_CONFIG.AUTO_REFRESH,
            maxDataAge: CHARTS_CONFIG.MAX_DATA_AGE,
            showAttribution: false
        });
        
        await chart.render(chartContainers[timePeriod]);
        preloadedCharts[timePeriod] = chart;

        Object.values(chartContainers).forEach(container => {
            if (container) {
                container.style.visibility = 'hidden';
                container.style.pointerEvents = 'none';
            }
        });

        chartContainers[timePeriod].style.visibility = 'visible';
        chartContainers[timePeriod].style.pointerEvents = 'auto';
        chartContainers[timePeriod].style.zIndex = '1';

        if (loadingEl) loadingEl.hidden = true;
        if (errorEl) errorEl.hidden = true;
        if (mainContainer) mainContainer.hidden = false;
        
        console.log(`✅ ${timePeriod} chart loaded on-demand successfully`);
        
    } catch (error) {
        console.error(`❌ Error loading ${timePeriod} chart on-demand:`, error);
        if (loadingEl) loadingEl.hidden = true;
        if (errorEl) errorEl.hidden = false;
    }
}

function switchChart2(timePeriod) {
    console.log('📊 Switching Chart 2 to:', timePeriod);
    
    const container = document.getElementById('chart2Container');
    const loadingEl = document.getElementById('chart2Loading');
    const errorEl = document.getElementById('chart2Error');
    
    if (!container || !window.ChartsEmbedSDK) {
        console.error('❌ Chart 2 container or SDK not found');
        return Promise.reject(new Error('Chart 2 container or SDK not found'));
    }

    if (loadingEl) loadingEl.hidden = false;
    if (container) container.hidden = true;
    if (errorEl) errorEl.hidden = true;

    let chartId;

    const chartMapping = {
        'weekly': CHARTS_CONFIG.CHART_IDS.CHART_2_MONTHLY,      
        'hourly': CHARTS_CONFIG.CHART_IDS.CHART_2_WEEKLY,       
        'weekly-by-date': CHARTS_CONFIG.CHART_IDS.CHART_2_DAILY, 
        'daily': CHARTS_CONFIG.CHART_IDS.CHART_2_WEEKLY_BY_DATE  
    };
    
    chartId = chartMapping[timePeriod] || CHARTS_CONFIG.CHART_IDS.CHART_2_WEEKLY;
    
    console.log('📊 Chart ID for period', timePeriod, ':', chartId);
    console.log('📊 Available chart IDs:', CHARTS_CONFIG.CHART_IDS);

    const periodNames = {
        'weekly': 'Weekly',
        'hourly': 'Hourly', 
        'weekly-by-date': 'Weekly by Date',
        'daily': 'Daily'
    };
    console.log(`🔄 Loading ${periodNames[timePeriod] || timePeriod} chart with ID: ${chartId}`);
    
    try {
        const sdk = new ChartsEmbedSDK({
            baseUrl: CHARTS_CONFIG.BASE_URL
        });
        
        console.log('🎯 Creating Chart 2 with ID:', chartId);
        const currentTheme = getCurrentTheme();
        console.log('Current theme:', currentTheme);

        if (chart2) {
            try {
                chart2.destroy();
            } catch (e) {
                console.warn('⚠️ Error destroying previous chart:', e);
            }
        }
        
        chart2 = sdk.createChart({
            chartId: chartId,
            height: '400px',
            width: '100%',
            theme: currentTheme,
            autoRefresh: CHARTS_CONFIG.AUTO_REFRESH,
            maxDataAge: CHARTS_CONFIG.MAX_DATA_AGE,
            showAttribution: false
        });
        
        return chart2.render(container)
            .then(() => {
                console.log('✅ Chart 2 rendered successfully!');
                if (loadingEl) loadingEl.hidden = true;
                if (container) container.hidden = false;
                if (errorEl) errorEl.hidden = true;
            })
            .catch((error) => {
                console.error('❌ Chart 2 render failed:', error);
                if (loadingEl) loadingEl.hidden = true;
                if (container) container.hidden = true;
                if (errorEl) {
                    errorEl.hidden = false;
                    
                    const retryBtn = errorEl.querySelector('.btn-retry');
                    if (retryBtn) {
                        retryBtn.onclick = () => {
                            console.log('🔄 Retrying Chart 2...');
                            switchChart2(timePeriod);
                        };
                    }
                }
                throw error;
            });
        
    } catch (error) {
        console.error('❌ Error creating Chart 2:', error);
        if (loadingEl) loadingEl.hidden = true;
        if (errorEl) errorEl.hidden = false;
        return Promise.reject(error);
    }
}

async function loadDashboardStats() {
    const statusMessage = document.getElementById('dashboardStatusMessage');
    const loadingSpinner = document.getElementById('statsLoadingSpinner');
    
    try {
        if (window.adminLoader && typeof window.adminLoader.showSpinner === 'function') {
            window.adminLoader.showSpinner('statsLoadingSpinner');
        } else if (loadingSpinner) {
            loadingSpinner.style.display = 'block';
        }
        if (statusMessage) statusMessage.textContent = '';
        
        const response = await window.api.get('/admin/dashboard/stats');
        
        if (!response || !response.success || !response.stats) {
            throw new Error('Failed to load dashboard stats or stats are missing.');
        }
        
        const stats = response.stats;

        updateStatCard('activeUsers', stats.activeUsers || 0);
        updateStatCard('inactiveUsers', stats.inactiveUsers || 0);
        updateStatCard('archivedUsers', stats.archivedUsers || 0);
        updateStatCard('totalProducts', stats.totalProducts || 0);
        updateStatCard('lowStockProducts', stats.lowStockProducts || 0);
        updateStatCard('totalOrders', stats.orders || 0);

        addStatCardClickListener('activeUsersCard', 'adminUsers.html?status=active');
        addStatCardClickListener('inactiveUsersCard', 'adminUsers.html?status=inactive');
        addStatCardClickListener('archivedUsersCard', 'adminUsers.html?status=archived');
        addStatCardClickListener('totalProductsCard', 'adminProducts.html');
        addStatCardClickListener('lowStockProductsCard', 'adminProducts.html?status=low_stock');
        addStatCardClickListener('totalOrdersCard', 'adminOrders.html');

        console.log('Dashboard stats loaded:', stats);
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        if (statusMessage) {
            statusMessage.textContent = `Error: ${error.message || 'Could not load dashboard statistics.'}`;
            statusMessage.className = 'status-message error';
        }
        
        updateStatCard('activeUsers', '0');
        updateStatCard('inactiveUsers', '0');
        updateStatCard('archivedUsers', '0');
        updateStatCard('totalProducts', '0');
        updateStatCard('lowStockProducts', '0');
        updateStatCard('totalOrders', '0');
    } finally {
        if (window.adminLoader && typeof window.adminLoader.hideSpinner === 'function') {
            window.adminLoader.hideSpinner('statsLoadingSpinner');
        } else if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }
    }
}

function updateStatCard(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

function addStatCardClickListener(cardId, url) {
    const cardElement = document.getElementById(cardId);
    if (cardElement) {
        cardElement.style.cursor = 'pointer';
        cardElement.addEventListener('click', () => {
            window.location.href = url;
        });
    }
}

async function loadRecentActivity() {
    const activityList = document.getElementById('activityList');
    const activityLoading = document.getElementById('activity-loading');
    
    if (!activityList) return;
    
    try {
        if (window.adminLoader && typeof window.adminLoader.showSpinner === 'function') {
            window.adminLoader.showSpinner('activity-loading');
        } else if (activityLoading) {
            activityLoading.style.display = 'block';
        }
        
        const [usersData, productsData] = await Promise.all([
            window.api.get('/auth/users').catch(() => ({ users: [] })),
            window.api.getProducts().catch(() => ({ products: [] }))
        ]);
        
        activityList.innerHTML = '';
        const activities = [];
        
        if (usersData.users && Array.isArray(usersData.users)) {
            usersData.users
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 3)
                .forEach(user => {
                    activities.push({
                        type: 'user',
                        icon: 'fas fa-user-plus',
                        message: `New user registered: ${user.name || user.email}`,
                        time: formatTimeAgo(user.createdAt)
                    });
                });
        }
        
        if (productsData.products && Array.isArray(productsData.products)) {
            productsData.products
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 3)
                .forEach(product => {
                    activities.push({
                        type: 'product',
                        icon: 'fas fa-box',
                        message: `New product added: ${product.name}`,
                        time: formatTimeAgo(product.createdAt)
                    });
                });
        }
        
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const recentActivities = activities.slice(0, 5);
        
        if (recentActivities.length === 0) {
            activityList.innerHTML = `
                <li style="padding: 20px; text-align: center; color: #666;">
                    <i class="fas fa-info-circle" style="margin-right: 8px;"></i>
                    No recent activity to display
                </li>
            `;
        } else {
            recentActivities.forEach(activity => {
                const activityItem = document.createElement('li');
                activityItem.innerHTML = `
                    <div class="activity-icon">
                        <i class="${activity.icon}"></i>
                    </div>
                    <div class="activity-details">
                        <p>${activity.message}</p>
                        <span class="activity-time">${activity.time}</span>
                    </div>
                `;
                activityList.appendChild(activityItem);
            });
        }
        
    } catch (error) {
        console.error('Error loading recent activity:', error);
        if (activityList) {
            activityList.innerHTML = `
                <li style="padding: 20px; text-align: center; color: #e74c3c;">
                    <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>
                    Failed to load recent activity
                </li>
            `;
        }
    } finally {
        if (window.adminLoader && typeof window.adminLoader.hideSpinner === 'function') {
            window.adminLoader.hideSpinner('activity-loading');
        } else if (activityLoading) {
            activityLoading.style.display = 'none';
        }
    }
}

function formatTimeAgo(dateString) {
    if (!dateString) return 'Unknown time';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return 'Just now';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }
}

async function loadQuickStats() {
    try {
        console.log('📊 Fetching dashboard stats...');

        const response = await window.api.get('/admin/dashboard/stats');
        
        if (!response || !response.success || !response.stats) {
            throw new Error('Failed to load dashboard stats');
        }
        
        const stats = response.stats;
        console.log('✅ Dashboard stats received:', stats);

        updateStatValue('totalOrdersStat', stats.orders || 0);

        updateStatValue('activeUsersStat', stats.activeUsers || 0);

        updateStatValue('totalProductsStat', stats.totalProducts || 0);

        try {
            const installationsData = await window.api.getInstallations();
            const totalInstallations = installationsData.installations 
                ? installationsData.installations.length 
                : 0;
            updateStatValue('totalInstallationsStat', totalInstallations);
        } catch (installError) {
            console.warn('⚠️ Could not fetch installations:', installError);
            updateStatValue('totalInstallationsStat', 0);
        }
        
        console.log('✅ Quick stats loaded and displayed successfully');
        
    } catch (error) {
        console.error('❌ Error loading quick stats:', error);
        
        updateStatValue('totalOrdersStat', 0);
        updateStatValue('activeUsersStat', 0);
        updateStatValue('totalProductsStat', 0);
        updateStatValue('totalInstallationsStat', 0);
    }
}

function updateStatValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const currentValue = parseInt(element.textContent) || 0;
    const targetValue = value;

    const duration = 800; 
    const steps = 30;
    const stepValue = (targetValue - currentValue) / steps;
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    
    const interval = setInterval(() => {
        currentStep++;
        const newValue = Math.round(currentValue + (stepValue * currentStep));
        element.textContent = newValue;
        
        if (currentStep >= steps) {
            element.textContent = targetValue;
            clearInterval(interval);
        }
    }, stepDuration);
}
