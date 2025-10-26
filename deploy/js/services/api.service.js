

class ApiService {
  constructor() {
    this.baseUrl = '/api'; 
    
    if (window.config && window.config.API_URL) {
      this.baseUrl = window.config.API_URL;
    }
  }

  getToken() {
    return localStorage.getItem('authToken');
  }

  async get(endpoint) {
    return this.request(endpoint, 'GET');
  }

  async request(endpoint, method = 'GET', data = null, isFormData = false) {
    const token = this.getToken();
    
    if (!token && endpoint !== '/auth/login' && !endpoint.includes('/auth/signup')) {
      throw new Error('No authentication token found');
    }
    
    const url = `${this.baseUrl}${endpoint}`;
    
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
      const response = await fetch(url, options);

      if (response.status === 401) {
        localStorage.removeItem('authToken');
        window.location.href = '/login.html?session=expired';
        throw new Error('Authentication token expired');
      }

      let responseData;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        throw new Error(responseData.message || 'API request failed');
      }
      
      return responseData;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  async getUsers() {
    return this.request('/auth/users');
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

  async getDashboardStats() {
    return this.request('/admin/dashboard/stats');
  }

  async getProducts() {
    return this.request('/products');
  }

}

if (!window.api) {
  window.api = new ApiService();
}
