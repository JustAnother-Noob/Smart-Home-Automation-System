

function isLoggedIn() {
    return !!localStorage.getItem('authToken');
}

function getUserRole() {
    return localStorage.getItem('userRole');
}

function getUserDisplayName() {
    const firstName = localStorage.getItem('userFirstName');
    const lastName = localStorage.getItem('userLastName');
    
    if (firstName && lastName) {
        return `${firstName} ${lastName}`;
    } else if (firstName) {
        return firstName;
    }
    
    return "Guest";
}

function getAuthToken() {
    
    const dev = Boolean(window?.CONFIG?.DEV_ALLOW_INSECURE_TOKEN_SOURCES);
    let token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    
    if (!token && dev) {
        
        const urlParams = new URLSearchParams(window.location.search);
        token = urlParams.get('token') || tokenFromCookie('authToken');
    }
    
    return token || null;
}

function tokenFromCookie(name) {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [cookieName, value] = cookie.trim().split('=');
        if (cookieName === name) {
            return value;
        }
    }
    return null;
}

function logout(redirect = true, redirectUrl = 'user_login.html') {
    
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

    if (redirect) {
        window.location.href = redirectUrl === 'adminHome.html' ? 'html_admin/adminHome.html' : redirectUrl;
    }
}

window.authUtils = {
    isLoggedIn,
    getUserRole,
    getUserDisplayName,
    logout,
    getAuthToken
};

window.getAuthToken = getAuthToken;
