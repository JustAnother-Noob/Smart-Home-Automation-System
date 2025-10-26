

document.addEventListener('DOMContentLoaded', () => {
    
    const container = document.createElement('div');
    container.style.padding = '20px';
    container.style.background = '#f7f7f7';
    container.style.border = '1px solid #ddd';
    container.style.borderRadius = '5px';
    container.style.margin = '20px auto';
    container.style.maxWidth = '600px';
    
    const heading = document.createElement('h2');
    heading.textContent = 'Admin Authentication Fix';
    container.appendChild(heading);
    
    const statusBox = document.createElement('div');
    statusBox.id = 'auth-status';
    statusBox.style.padding = '10px';
    statusBox.style.marginBottom = '15px';
    statusBox.style.borderRadius = '5px';
    container.appendChild(statusBox);
    
    const tokenInput = document.createElement('input');
    tokenInput.type = 'text';
    tokenInput.placeholder = 'Enter admin token here (if you have one)';
    tokenInput.style.width = '100%';
    tokenInput.style.padding = '8px';
    tokenInput.style.marginBottom = '10px';
    tokenInput.style.boxSizing = 'border-box';
    container.appendChild(tokenInput);
    
    const loginButton = document.createElement('button');
    loginButton.textContent = 'Login as Admin';
    loginButton.style.padding = '8px 16px';
    loginButton.style.marginRight = '10px';
    loginButton.style.background = '#4caf50';
    loginButton.style.color = 'white';
    loginButton.style.border = 'none';
    loginButton.style.borderRadius = '4px';
    loginButton.style.cursor = 'pointer';
    container.appendChild(loginButton);
    
    const checkAuthButton = document.createElement('button');
    checkAuthButton.textContent = 'Check Authentication';
    checkAuthButton.style.padding = '8px 16px';
    checkAuthButton.style.marginRight = '10px';
    checkAuthButton.style.background = '#2196F3';
    checkAuthButton.style.color = 'white';
    checkAuthButton.style.border = 'none';
    checkAuthButton.style.borderRadius = '4px';
    checkAuthButton.style.cursor = 'pointer';
    container.appendChild(checkAuthButton);
    
    const goToInstallationsButton = document.createElement('button');
    goToInstallationsButton.textContent = 'Go to Installations';
    goToInstallationsButton.style.padding = '8px 16px';
    goToInstallationsButton.style.background = '#ff9800';
    goToInstallationsButton.style.color = 'white';
    goToInstallationsButton.style.border = 'none';
    goToInstallationsButton.style.borderRadius = '4px';
    goToInstallationsButton.style.cursor = 'pointer';
    container.appendChild(goToInstallationsButton);

    document.body.prepend(container);

    function updateStatus(message, isError = false) {
        statusBox.textContent = message;
        statusBox.style.background = isError ? '#ffebee' : '#e8f5e9';
        statusBox.style.color = isError ? '#b71c1c' : '#1b5e20';
    }

    function checkAuthentication() {
        const token = localStorage.getItem('authToken');
        const userRole = localStorage.getItem('userRole');
        
        if (!token) {
            updateStatus('Not logged in. Please log in as admin.', true);
            return false;
        }
        
        if (userRole !== 'admin') {
            updateStatus(`Logged in, but not as admin. Current role: ${userRole || 'none'}`, true);
            return false;
        }
        
        updateStatus(`Successfully logged in as admin. Token: ${token.substring(0, 10)}...`, false);
        return true;
    }

    async function loginAsAdmin() {
        try {
            const customToken = tokenInput.value.trim();
            
            if (customToken) {
                
                localStorage.setItem('authToken', customToken);
                localStorage.setItem('userRole', 'admin');
                updateStatus('Custom token set. Please check authentication.', false);
                return;
            }

            const API_BASE = window.CONFIG?.API_URL || '/api';
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: 'admin@smarthome.com',
                    password: 'Admin123!'
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Failed to login');
            }

            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userRole', data.user.role);
            localStorage.setItem('userId', data.user._id);
            localStorage.setItem('userEmail', data.user.email);
            localStorage.setItem('userFirstName', data.user.firstName || 'Admin');
            localStorage.setItem('userLastName', data.user.lastName || 'User');
            
            updateStatus('Successfully logged in as admin', false);
        } catch (error) {
            console.error('Login error:', error);
            updateStatus(`Login failed: ${error.message}`, true);
        }
    }

    loginButton.addEventListener('click', loginAsAdmin);
    checkAuthButton.addEventListener('click', () => checkAuthentication());
    goToInstallationsButton.addEventListener('click', () => {
        if (checkAuthentication()) {
            window.location.href = '../html_admin/adminInstallations.html';
        } else {
            updateStatus('Please login as admin first', true);
        }
    });

    checkAuthentication();
});