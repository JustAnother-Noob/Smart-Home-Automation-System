const resetPasswordForm = document.getElementById('resetPasswordForm');
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const newPasswordError = document.getElementById('newPasswordError');
const confirmPasswordError = document.getElementById('confirmPasswordError');
const statusMessage = document.getElementById('statusMessage');
const loadingOverlay = document.getElementById('loadingOverlay');
const submitButton = resetPasswordForm.querySelector('button[type="submit"]');

const urlParams = new URLSearchParams(window.location.search);
const email = urlParams.get('email');
const otp = urlParams.get('otp');

const passwordRulesContainer = document.getElementById('passwordRules');
const requirements = {
    length: { regex: /.{8,}/, elementId: 'length' },
    uppercase: { regex: /[A-Z]/, elementId: 'uppercase' },
    lowercase: { regex: /[a-z]/, elementId: 'lowercase' },
    number: { regex: /\d/, elementId: 'number' },
    special: { regex: /[!@#$%^&*]/, elementId: 'special' }
};

const updatePasswordChecklist = (password) => {
    let allValid = true;

    Object.keys(requirements).forEach((key) => {
        const requirement = requirements[key];
        const element = document.getElementById(requirement.elementId);
        if (!element) return; 

        const isValid = requirement.regex.test(password);
        const wasValid = element.classList.contains('valid');

        element.className = ''; 

        if (isValid) {
            element.classList.add('valid');
            
            if (!wasValid) {
                
                element.style.transition = 'none';
                element.style.transform = 'translateX(0)';
                
                void element.offsetWidth;
                
                element.style.transition = 'all 0.3s ease';
                element.style.transform = 'translateX(4px)'; 
                
            }
        } else {
            element.classList.add('invalid');
            
            element.style.transform = 'translateX(0)';
            allValid = false;
        }
    });
    return allValid; 
};

const validatePassword = (password) => {
    return updatePasswordChecklist(password);
};

newPasswordInput.addEventListener('focus', () => {
    if (passwordRulesContainer) {
        passwordRulesContainer.classList.add('visible');
    }
});

const pwdToggle = document.querySelector('.pwd-toggle');
if (pwdToggle && newPasswordInput) {
    pwdToggle.addEventListener('click', () => {
        const isPassword = newPasswordInput.type === 'password';
        newPasswordInput.type = isPassword ? 'text' : 'password';

        if (isPassword) {
            pwdToggle.src = './assets/icons/hidden_password.svg';
            pwdToggle.setAttribute('aria-label', 'Hide password');
        } else {
            pwdToggle.src = './assets/icons/shown_password.svg';
            pwdToggle.setAttribute('aria-label', 'Show password');
        }
    });
}

const API_BASE = (window.CONFIG && window.CONFIG.API_URL) ? window.CONFIG.API_URL.replace(/\/+$/, '') : '/api';

const showStatusMessage = (message, type = 'error') => {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
};

const clearStatusMessage = () => {
    statusMessage.style.display = 'none';
    statusMessage.textContent = '';
};

const clearInputError = (errorElement, inputElement) => {
    errorElement.textContent = '';
    inputElement.classList.remove('input-error');
    inputElement.classList.remove('input-success'); 
};

const setInputError = (errorElement, inputElement, message) => {
    errorElement.textContent = message;
    inputElement.classList.add('input-error');
    inputElement.classList.remove('input-success');
};

resetPasswordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatusMessage();
    clearInputError(newPasswordError, newPasswordInput);
    clearInputError(confirmPasswordError, confirmPasswordInput);

    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    let hasError = false;

    if (!email || !otp) {
        showStatusMessage('Missing required information (email or OTP). Please start the password reset process again.', 'error');
        
        newPasswordInput.disabled = true;
        confirmPasswordInput.disabled = true;
        submitButton.disabled = true;
        return; 
    }

    const isPasswordValid = validatePassword(newPassword); 
    if (!isPasswordValid) {
        setInputError(newPasswordError, newPasswordInput, 'Password does not meet all requirements.');
        hasError = true;
    } else {
        newPasswordInput.classList.add('input-success');
        clearInputError(newPasswordError, newPasswordInput); 
    }

    if (!confirmPassword) {
         setInputError(confirmPasswordError, confirmPasswordInput, 'Please confirm your new password.');
         hasError = true;
    } else if (newPassword && newPassword !== confirmPassword) { 
        setInputError(confirmPasswordError, confirmPasswordInput, 'Passwords do not match.');
        hasError = true;
    } else if (newPassword && newPassword === confirmPassword && isPasswordValid) { 
         confirmPasswordInput.classList.add('input-success');
         clearInputError(confirmPasswordError, confirmPasswordInput);
    }

    if (hasError) return;

    loadingOverlay.classList.add('active');
    submitButton.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/auth/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include', 
            body: JSON.stringify({
                email: email.toLowerCase(),
                otp,
                newPassword
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showStatusMessage('Password reset successfully! Redirecting to login...', 'success');
            setTimeout(() => {
                window.location.href = 'user_login.html?reset=success'; 
            }, 2500);
        } else {
            
            if (data.requirements) {
                
                newPasswordError.textContent = data.message || 'Password requirements not met.';
                newPasswordInput.style.borderColor = 'red';
                
                passwordRulesContainer.classList.add('visible');
                updatePasswordChecklist(newPasswordInput.value);
            } else {
                
                showStatusMessage(data.message || 'Password reset failed.', 'error');
            }
            submitButton.disabled = false; 
        }
    } catch (error) {
        showStatusMessage('An error occurred while connecting to the server. Please try again.', 'error');
        submitButton.disabled = false;
    } finally {
        
        if (!statusMessage.classList.contains('success')) {
             loadingOverlay.classList.remove('active');
             
             if (!loadingOverlay.classList.contains('active')) {
                 submitButton.disabled = false;
             }
        }
    }
});

newPasswordInput.addEventListener('input', () => {
    clearInputError(newPasswordError, newPasswordInput);
    validatePassword(newPasswordInput.value); 
});
confirmPasswordInput.addEventListener('input', () => {
    clearInputError(confirmPasswordError, confirmPasswordInput);
    
    if (newPasswordInput.value && confirmPasswordInput.value && newPasswordInput.value === confirmPasswordInput.value) {
        confirmPasswordInput.classList.add('input-success');
    } else {
        confirmPasswordInput.classList.remove('input-success');
    }
});
