

const API_BASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.API_URL)
  ? CONFIG.API_URL
  : '/api';

function getCSRFToken() {
  const name = 'csrfToken=';
  const decodedCookie = decodeURIComponent(document.cookie || '');
  const parts = decodedCookie.split(';');
  for (let part of parts) {
    part = part.trim();
    if (part.startsWith(name)) {
      return part.substring(name.length);
    }
  }
  return null;
}

async function request(endpoint, method = 'GET', data = null, customHeaders = {}) {
  const headers = {
    Accept: 'application/json',
    ...(['POST', 'PUT', 'PATCH'].includes(method) ? { 'Content-Type': 'application/json' } : {}),
    ...customHeaders
  };

  const authToken = localStorage.getItem('authToken');
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = getCSRFToken();
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }
  }

  const config = {
    method,
    headers,
    credentials: 'include'
  };

  if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
    config.body = JSON.stringify(data);
  }

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, config);

    if (response.status === 401) {
      localStorage.clear();
      window.location.href = 'user_login.html?session=expired';
      throw new Error('Unauthorized');
    }

    if (response.status === 403) {
      if (response.headers.get('content-type')?.includes('application/json')) {
        const errorPayload = await response.json();
        if (errorPayload?.message?.toLowerCase().includes('csrf')) {
          console.warn('CSRF token rejected; reloading page.');
          window.location.reload();
          return;
        }
        if (!response.ok) {
          throw new Error(errorPayload.message || 'Forbidden');
        }
        return errorPayload;
      }
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      const textPreview = (await response.text()).slice(0, 200);
      throw new Error(`Expected JSON but received '${contentType || 'unknown'}'. Preview: ${textPreview}`);
    }

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.message || `API request failed with status ${response.status}`);
    }

    return payload;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

async function get(endpoint) {
  return request(endpoint, 'GET');
}

function withQuery(endpoint, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  return qs ? `${endpoint}?${qs}` : endpoint;
}

window.api = {
  request,
  get,
  async getProducts(params = {}) {
    return request(withQuery('/products', params), 'GET');
  },
  async getOrders(params = {}) {
    return request(withQuery('/admin/orders', params), 'GET');
  },
  async getOrder(id) {
    return request(`/admin/orders/${id}`, 'GET');
  },
  async updateOrderStatus(id, status) {
    return request(`/admin/orders/${id}/status`, 'PUT', { status });
  },
  async deleteOrder(id) {
    return request(`/admin/orders/${id}`, 'DELETE');
  },
  
  async bookInstallation(data) {
    return request('/installations/book', 'POST', {
      ...data,
      createdBy: localStorage.getItem('userId') || null
    });
  },
  async getUserInstallations() {
    return request('/installations/my-installations', 'GET');
  },
  async getAvailableInstallations() {
    return request('/installations/available', 'GET');
  },

  async getInstallations(params = {}) {
    return request(withQuery('/admin/installations', params), 'GET');
  },
  async getInstallation(id) {
    return request(`/admin/installations/${id}`, 'GET');
  },
  async updateInstallationStatus(id, status) {
    return request(`/admin/installations/${id}/status`, 'PUT', { status });
  },
  async deleteInstallation(id) {
    return request(`/admin/installations/${id}`, 'DELETE');
  },
  async sendInstallationStatusEmail(id, status, email) {
    return request(`/admin/installations/${id}/send-status-email`, 'POST', { status, email });
  }
};

window.AdminAPI = {
  get: (ep) => request(`/admin${ep}`, 'GET'),
  post: (ep, data) => request(`/admin${ep}`, 'POST', data),
  put: (ep, data) => request(`/admin${ep}`, 'PUT', data),
  delete: (ep) => request(`/admin${ep}`, 'DELETE')
};

if (!window.api || typeof window.api.request !== 'function') {
  console.error('api.js failed to initialize: window.api missing');
}
