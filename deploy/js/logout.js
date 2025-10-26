
document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleLogout();
        });
    }
});

function handleLogout() {
    console.log('Logging out admin user...');

    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userFirstName');
    localStorage.removeItem('userLastName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userId');
    localStorage.removeItem('userAvatar');
    localStorage.removeItem('userPhone');

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

    const notification = document.createElement('div');
    notification.textContent = 'Logged out successfully!';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #28a745;
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        notification.style.opacity = '0';
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);

        window.location.href = 'user_login.html?logout=success';
    }, 1500);
}

if (typeof window !== 'undefined') {
    window.handleLogout = handleLogout;
}
