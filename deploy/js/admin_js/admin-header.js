

function initializeAdminHeader() {
    loadAdminUserInfo();
    setupLogoutButton();
}

function loadAdminUserInfo() {
    try {
        
        const currentUser = window.authUtils ? window.authUtils.getCurrentUser() : null;
        const adminNameDisplay = document.getElementById('adminNameDisplay');
        
        if (currentUser && adminNameDisplay) {
            let displayName = 'Admin';

            if (currentUser.firstName) {
                displayName = currentUser.firstName;
            } else {
                
                const firstName = localStorage.getItem('userFirstName');
                const userRole = localStorage.getItem('userRole');
                
                if (firstName) {
                    displayName = firstName;
                } else if (userRole === 'admin') {
                    displayName = 'Admin';
                }
            }
            
            adminNameDisplay.textContent = displayName;
        }
    } catch (error) {
        console.error('Error loading admin user info:', error);
        
        const adminNameDisplay = document.getElementById('adminNameDisplay');
        if (adminNameDisplay) {
            adminNameDisplay.textContent = 'Admin';
        }
    }
}

function setupLogoutButton() {
    const headerLogoutBtn = document.getElementById('headerLogoutBtn');
    
    if (headerLogoutBtn) {
        headerLogoutBtn.addEventListener('click', function(e) {
            e.preventDefault();

            if (confirm('Are you sure you want to logout?')) {
                
                if (window.authUtils && window.authUtils.logout) {
                    window.authUtils.logout('user_login.html?logout=admin');
                } else {
                    
                    localStorage.clear();
                    window.location.href = 'user_login.html?logout=admin';
                }
            }
        });
    }
}

window.adminHeader = {
    initializeAdminHeader,
    loadAdminUserInfo,
    setupLogoutButton
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAdminHeader);
} else {
    initializeAdminHeader();
}
