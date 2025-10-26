

function isLoggedIn() {
  const token = localStorage.getItem('authToken');
  return !!token;
}

function getCurrentUser() {
  if (!isLoggedIn()) return null;
  
  return {
    firstName: localStorage.getItem('userFirstName') || '',
    lastName: localStorage.getItem('userLastName') || '',
    email: localStorage.getItem('userEmail') || '',
    id: localStorage.getItem('userId') || '',
    role: localStorage.getItem('userRole') || 'user'
  };
}

function logout(redirectTo = 'user_login.html?logout=success') {
  
  localStorage.removeItem('authToken');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userFirstName');
  localStorage.removeItem('userLastName');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userId');
  localStorage.removeItem('userAvatar'); 

  const newGuestSessionId = `sess-${Date.now()}`;
  localStorage.setItem('cartSessionId', newGuestSessionId);
  console.log('🔄 Cart session reset for new guest:', newGuestSessionId.slice(-8));

  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('cartMergedFor:')) {
      localStorage.removeItem(key);
    }
  });

  window.dispatchEvent(new CustomEvent('cart:updated'));
  if (typeof window.refreshCartCount === 'function') {
    window.refreshCartCount();
  }

  window.location.href = redirectTo;
}

function requireAuth(redirectTo = 'user_login.html') {
  if (!isLoggedIn()) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

function requireNoAuth(redirectTo = 'index.html') {
  if (isLoggedIn()) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

function getUserRole() {
  return localStorage.getItem('userRole') || null;
}

function checkAdminAuth() {
  const token = localStorage.getItem('authToken');
  const role = getUserRole();
  if (!token) {
    window.location.href = 'user_login.html?session=expired';
    return false;
  }
  if (role !== 'admin') {
    window.location.href = 'user_login.html?unauthorized=true';
    return false;
  }
  return true;
}

function getAuthToken() {
  return localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || null;
}

window.authUtils = {
  isLoggedIn,
  getCurrentUser,
  getUserRole,
  checkAdminAuth,
  logout,
  requireNoAuth,
  getAuthToken
};

window.getAuthToken = window.getAuthToken || getAuthToken;
