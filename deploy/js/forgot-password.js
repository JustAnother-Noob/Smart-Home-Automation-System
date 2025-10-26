const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const emailInput = document.getElementById('email');
const emailError = document.getElementById('emailError');
const statusMessage = document.getElementById('statusMessage');
const loadingOverlay = document.getElementById('loadingOverlay');
const submitButton = forgotPasswordForm.querySelector('button[type="submit"]');

const API_BASE = window.CONFIG?.API_URL || '/api';

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const showStatusMessage = (message, type = 'error') => {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
};

const clearStatusMessage = () => {
    statusMessage.style.display = 'none';
    statusMessage.textContent = '';
};

forgotPasswordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatusMessage();
    emailError.textContent = '';

    const email = emailInput.value.trim();

    if (!validateEmail(email)) {
        emailError.textContent = 'Please enter a valid email address.';
        emailInput.style.borderColor = 'red';
        return;
    } else {
        emailInput.style.borderColor = ''; 
    }

    loadingOverlay.classList.add('active');
    submitButton.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/auth/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email: email.toLowerCase() })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showStatusMessage('Password reset code sent! Redirecting to verification...', 'success');
            
            setTimeout(() => {
                window.location.href = `verify-reset-otp.html?email=${encodeURIComponent(email.toLowerCase())}`;
            }, 2000);
        } else {

            showStatusMessage(data.message || 'Failed to send reset code. Please try again.', 'error');
            submitButton.disabled = false; 
            if (response.status === 404) { 
                emailInput.style.borderColor = 'red';
                emailError.textContent = data.message || 'Email address not found.';
            }
        }
    } catch (error) {
        console.error('Forgot Password Error:', error);
        showStatusMessage('An error occurred. Please check your connection and try again.', 'error');
        submitButton.disabled = false; 
    } finally {
        
        if (!statusMessage.classList.contains('success')) {
             loadingOverlay.classList.remove('active');
        }
    }
});
