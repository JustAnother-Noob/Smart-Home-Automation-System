

if (!window.api) {
    class APIService {
        constructor() {
            this.baseURL = (window.CONFIG && window.CONFIG.API_URL) ? window.CONFIG.API_URL : '/api';
        }

        async get(endpoint) {
            return this.request(endpoint, 'GET');
        }

        async request(endpoint, method = 'GET', data = null, isFormData = false) {
            const token = localStorage.getItem('authToken');
            
            if (!token && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/signup')) {
                console.error('No auth token found');
                window.location.href = 'user_login.html?session=expired';
                throw new Error('No authentication token');
            }

            const options = {
                method,
                headers: {}
            };

            if (token) {
                options.headers['Authorization'] = `Bearer ${token}`;
            }

            if (data) {
                if (isFormData) {
                    options.body = data; 
                } else {
                    options.headers['Content-Type'] = 'application/json';
                    options.body = JSON.stringify(data);
                }
            }

            try {
                const response = await fetch(`${this.baseURL}${endpoint}`, options);
                
                if (response.status === 401) {
                    console.error('Unauthorized. Redirecting to login...');
                    localStorage.clear();

                    document.cookie.split(";").forEach(function(c) { 
                        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
                    });
                    
                    window.location.href = 'user_login.html?session=expired';
                    throw new Error('Unauthorized');
                }

                const result = await response.json();
                
                if (!response.ok) {
                    throw new Error(result.message || `HTTP error! status: ${response.status}`);
                }

                return result;
            } catch (error) {
                console.error('API request failed:', error);

                if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                    throw new Error('Network error. Please check your connection.');
                }
                
                throw error;
            }
        }

        async getUsers() {
            return this.request('/auth/users');
        }

        async getUserById(id) {
            return this.request(`/auth/users/${id}`);
        }

        async getArchivedUsers() {
            return this.request('/auth/archived-users');
        }

        async archiveUser(userId, data = null) {
            
            const archiveData = data || {
                reason: "Administrative action: User archived by system admin",
                archiveReason: "admin-action"
            };
            
            return this.request(`/auth/users/${userId}/archive`, 'PUT', archiveData);
        }

        async restoreUser(userId) {
            return this.request(`/auth/users/${userId}/restore`, 'PUT');
        }

        async updateUserStatus(userId, status) {
            return this.request(`/auth/users/${userId}/status`, 'PUT', { status });
        }

        async addUser(userData) {
            return this.request('/auth/register', 'POST', userData);
        }

        logout() {
            
            localStorage.removeItem('authToken');
            localStorage.removeItem('userRole');
            localStorage.removeItem('userFirstName');
            localStorage.removeItem('userLastName');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userId');
            localStorage.removeItem('userAvatar');

            localStorage.removeItem('cartSessionId');
            console.log('🔄 Cart session cleared for logout');

            Object.keys(localStorage).forEach(key => {
              if (key.startsWith('cartMergedFor:')) {
                localStorage.removeItem(key);
              }
            });

            window.dispatchEvent(new CustomEvent('cart:updated'));
            if (typeof window.refreshCartCount === 'function') {
              window.refreshCartCount();
            }

            window.location.href = 'user_login.html?logout=success';
        }

        async getDashboardStats() {
            return this.request('/admin/dashboard/stats');
        }

        async getOrders() {
            return this.request('/admin/orders');
        }

        async updateOrderStatus(orderId, status) {
            return this.request(`/admin/orders/${orderId}/status`, 'PUT', { status });
        }

        async deleteOrder(orderId) {
            return this.request(`/admin/orders/${orderId}`, 'DELETE');
        }

        async getRevenue() {
            return this.request('/admin/revenue');
        }

        async getSettings() { return this.request('/admin/settings'); }
        async updateSettings(data) { return this.request('/admin/settings', 'PUT', data); }
        async updateAdminPassword(data) { return this.request('/admin/settings/password', 'PUT', data); }

    }

    window.api = new APIService();
}

if (!window.auth) {
    class AuthService {
        constructor() {
            this.tokenKey = 'authToken';
            this.roleKey = 'userRole';
            this.userDataKeys = ['userFirstName', 'userLastName', 'userEmail', 'userId'];
            this.sessionTimeout = 24 * 60 * 60 * 1000; 
        }

        isAuthenticated() {
            const token = localStorage.getItem(this.tokenKey);
            if (!token) return false;

            try {
                
                const payload = JSON.parse(atob(token.split('.')[1]));
                const now = Date.now() / 1000;
                
                if (payload.exp && payload.exp < now) {
                    console.log('Token expired, clearing auth data');
                    this.clearAuth();
                    return false;
                }
                
                return true;
            } catch (e) {
                console.log('Invalid token format, clearing auth data');
                this.clearAuth();
                return false;
            }
        }

        isAdmin() {
            return this.isAuthenticated() && this.getUserRole() === 'admin';
        }

        getUserRole() {
            return localStorage.getItem(this.roleKey);
        }

        checkAdminAuth() {
            if (!this.isAuthenticated()) {
                console.log('🔒 No valid authentication found, redirecting to login');
                this.redirectToLogin('session=expired');
                return false;
            }
            
            if (!this.isAdmin()) {
                console.log(`🚫 User role '${this.getUserRole()}' is not admin, redirecting to login`);
                this.redirectToLogin('unauthorized=true');
                return false;
            }
            
            console.log('✅ Admin auth check passed');
            return true;
        }

        clearAuth() {
            localStorage.removeItem(this.tokenKey);
            localStorage.removeItem(this.roleKey);
            this.userDataKeys.forEach(key => localStorage.removeItem(key));
        }

        redirectToLogin(queryParams = '') {
            this.clearAuth();
            const url = queryParams ? `user_login.html?${queryParams}` : 'user_login.html';
            window.location.href = url;
        }

        getCurrentUser() {
            return {
                firstName: localStorage.getItem('userFirstName') || 'Admin',
                lastName: localStorage.getItem('userLastName') || 'User',
                email: localStorage.getItem('userEmail') || '',
                role: this.getUserRole() || 'user',
                id: localStorage.getItem('userId') || ''
            };
        }

        setAuth(authData) {
            if (authData.token) localStorage.setItem(this.tokenKey, authData.token);
            if (authData.role) localStorage.setItem(this.roleKey, authData.role);
            if (authData.firstName) localStorage.setItem('userFirstName', authData.firstName);
            if (authData.lastName) localStorage.setItem('userLastName', authData.lastName);
            if (authData.email) localStorage.setItem('userEmail', authData.email);
            if (authData.userId) localStorage.setItem('userId', authData.userId);
        }

        logout(redirect = true) {
            this.clearAuth();

            localStorage.removeItem('cartSessionId');
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('cartMergedFor:')) {
                    localStorage.removeItem(key);
                }
            });

            if (redirect) {
                window.location.href = 'user_login.html?logout=success';
            }
        }
    }

    window.auth = new AuthService();
}

if (!window.ui) {
    window.ui = {
        showStatusMessage: function(element, message, type = 'error') {
            if (!element) return;
            
            element.textContent = message;
            element.className = `status-message ${type}`;
            element.style.display = 'block';

            if (type === 'success') {
                setTimeout(() => {
                    element.style.display = 'none';
                }, 5000);
            }
        },
        clearStatusMessage: function(element) {
            if (!element) return;
            
            element.style.display = 'none';
            element.textContent = '';
        }
    };
}
