

class AuthService {
  constructor() {
    this.tokenKey = 'authToken';
    this.roleKey = 'userRole';
    this.firstNameKey = 'userFirstName';
    this.lastNameKey = 'userLastName';
    this.emailKey = 'userEmail';
  }

  isAuthenticated() {
    const token = this.getToken();
    if (!token) return false;
    
    try {
      
      const tokenData = this.parseToken(token);
      const currentTime = Math.floor(Date.now() / 1000);
      
      return !(tokenData.exp && tokenData.exp < currentTime);
    } catch (e) {
      console.error('Error parsing token:', e);
      return false;
    }
  }

  isAdmin() {
    return this.isAuthenticated() && this.getUserRole() === 'admin';
  }

  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  setAuth(authData) {
    if (authData.token) {
      localStorage.setItem(this.tokenKey, authData.token);
    }
    
    if (authData.user) {
      if (authData.user.role) {
        localStorage.setItem(this.roleKey, authData.user.role);
      }
      
      if (authData.user.firstName) {
        localStorage.setItem(this.firstNameKey, authData.user.firstName);
      }
      
      if (authData.user.lastName) {
        localStorage.setItem(this.lastNameKey, authData.user.lastName);
      }
      
      if (authData.user.email) {
        localStorage.setItem(this.emailKey, authData.user.email);
      }
    }
  }

  getUserRole() {
    return localStorage.getItem(this.roleKey);
  }

  getUserData() {
    return {
      firstName: localStorage.getItem(this.firstNameKey),
      lastName: localStorage.getItem(this.lastNameKey),
      email: localStorage.getItem(this.emailKey),
      role: localStorage.getItem(this.roleKey)
    };
  }

  parseToken(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Error parsing JWT token:', e);
      return {};
    }
  }

  logout(redirect = true, redirectUrl = 'login.html') {
    
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.roleKey);
    localStorage.removeItem(this.firstNameKey);
    localStorage.removeItem(this.lastNameKey);
    localStorage.removeItem(this.emailKey);
    localStorage.removeItem('userAvatar'); 
    
    if (redirect) {
      window.location.href = redirectUrl;
    }
  }

  checkAdminAuth() {
    if (!this.isAuthenticated()) {
      this.redirectToLogin('session=expired');
      return false;
    }
    
    if (!this.isAdmin()) {
      this.redirectToLogin('unauthorized=true');
      return false;
    }
    
    return true;
  }

  redirectToLogin(queryParams = '') {
    const url = queryParams ? `login.html?${queryParams}` : 'login.html';
    window.location.href = url;
  }
}

window.auth = new AuthService();