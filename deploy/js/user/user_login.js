const loginForm = document.getElementById('loginForm');
const email = document.getElementById('email');
const password = document.getElementById('password');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const showPasswordBtn = document.getElementById('show-pwd');
const loadingOverlay = document.getElementById('loadingOverlay');
const submitButton = document.querySelector('#loginForm button[type="submit"]');

const rememberCheckbox = document.getElementById('rememberMe');

const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

email.addEventListener('input', () => {
    const isEmailValid = validateEmail(email.value);
    emailError.textContent = '';
    email.classList.remove('input-error', 'input-success');
    
    if (email.value.length === 0) {
        email.style.borderColor = '';
        return;
    }
    
    if (!isEmailValid) {
        email.style.borderColor = '#dc3545';
        email.classList.add('input-error');
        emailError.textContent = 'Please enter a valid email address.';
    } else {
        email.style.borderColor = '#28a745';
        email.classList.add('input-success');
        setTimeout(() => email.classList.remove('input-success'), 800);
    }
});

window.addEventListener('DOMContentLoaded', () => {
    
    checkExistingLogin();

    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
        email.value = savedEmail;
        if (rememberCheckbox) rememberCheckbox.checked = true; 
        
        email.dispatchEvent(new Event('input'));
    }

    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('logout') === 'success') {
        showStatusMessage('You have been successfully logged out!', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    if (urlParams.get('reset') === 'success') {
        showStatusMessage('Password reset successful! You can now log in with your new password.', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    if (urlParams.get('verified') === 'success') {
        showStatusMessage('Email verified successfully! You can now log in.', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    console.log('✅ User login page loaded - Google Sign-In handled by HTML');
});

showPasswordBtn?.addEventListener('click', () => {
  const isPassword = password.type === 'password';
  password.type = isPassword ? 'text' : 'password';

  if (isPassword) {
    showPasswordBtn.className = 'fi fi-rr-eye password-toggle';
    showPasswordBtn.setAttribute('aria-label', 'Hide password');
  } else {
    showPasswordBtn.className = 'fi fi-rr-eye-crossed password-toggle';
    showPasswordBtn.setAttribute('aria-label', 'Show password');
  }
});

showPasswordBtn?.addEventListener('mousedown', (e) => {
    e.preventDefault();
});

async function sendGoogleTokenToBackend(idToken) {
    clearStatusMessage();
    loadingOverlay.classList.add('active');

    submitButton.disabled = true;
    email.disabled = true;
    password.disabled = true;

    try {
        
        let csrfToken = null;
        try {
            const csrfResponse = await fetch(`${API_BASE}/csrf-token`, {
                credentials: 'include'
            });
            if (csrfResponse.ok) {
                const csrfData = await csrfResponse.json();
                csrfToken = csrfData.csrfToken;
            }
        } catch (csrfError) {
            console.log('CSRF token fetch failed (development mode?):', csrfError.message);
        }

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        const sessionId = localStorage.getItem('cartSessionId');
        if (sessionId) {
            headers['x-session-id'] = sessionId;
        }

        if (csrfToken && csrfToken !== 'dev-mode-no-csrf') {
            headers['X-CSRF-Token'] = csrfToken;
        }

        const response = await fetch(`${API_BASE}/auth/google`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ token: idToken })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            
            if (data.data && data.data.token) {
                localStorage.setItem('authToken', data.data.token);
                if (data.data.user) {
                    localStorage.setItem('userRole', data.data.user.role || 'user');
                    localStorage.setItem('userFirstName', data.data.user.firstName || '');
                    localStorage.setItem('userLastName', data.data.user.lastName || '');
                    localStorage.setItem('userEmail', data.data.user.email || '');
                    localStorage.setItem('userId', data.data.user.id || '');
                }
            } else {
                localStorage.setItem('authToken', data.token);
                if (data.user) {
                    localStorage.setItem('userRole', data.user.role || 'user');
                    localStorage.setItem('userFirstName', data.user.firstName || '');
                    localStorage.setItem('userLastName', data.user.lastName || '');
                    localStorage.setItem('userEmail', data.user.email || '');
                    localStorage.setItem('userId', data.user.id || '');
                }
            }
            
            showStatusMessage('Google Sign-In successful! Redirecting...', 'success');

            if (data.cartMerged === true) {
                console.log('✅ Cart merged by backend during Google Sign-In');
                
                localStorage.removeItem('cartSessionId');
                console.log('🔄 Guest session cleared after backend merge');
                
                window.dispatchEvent(new Event('cart:updated'));
                if (typeof window.refreshCartCount === 'function') {
                    window.refreshCartCount();
                }
            } else if (data.cartMerged === false) {
                console.log('ℹ️ No guest cart found to merge during Google Sign-In');
            } else {
                console.log('🔄 Attempting frontend cart merge after Google Sign-In');
                
                await mergeGuestCartIfNeeded();
            }

            setTimeout(() => {
                let redirectPath = (data.data && data.data.redirect) || data.redirect || 'index.html';
                
                if (/(^|\/)(user_index\.html)$/.test(redirectPath)) {
                    redirectPath = 'index.html';
                }
                if (redirectPath.startsWith('/')) {
                    redirectPath = redirectPath.substring(1);
                }
                
                if (!redirectPath.includes('/') && !redirectPath.startsWith('html/')) {
                    
                }
                window.location.href = redirectPath;
            }, 1500);
        } else {
            
            if (data.errorType === 'account_archived') {
                showStatusMessage('Your account has been archived. Please contact support for assistance.', 'error');
                setTimeout(() => {
                    showStatusMessage('Support: contact@smartlivingtech.com', 'info');
                }, 3000);
            } else if (data.errorType === 'email_verification_required') {
                showStatusMessage('Please verify your email first. Check your inbox for verification instructions.', 'error');
            } else {
                showStatusMessage(data.message || 'Google Sign-In failed. Please try again.', 'error');
            }
        }
    } catch (error) {
        console.error('Google Sign-In error:', error);
        showStatusMessage('Google Sign-In failed. Please check your connection and try again.', 'error');
    } finally {
        loadingOverlay.classList.remove('active');
        
        submitButton.disabled = false;
        email.disabled = false;
        password.disabled = false;
    }
}

function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => {
        el.textContent = '';
    });
}

const addStatusMessage = () => {
    if (!document.getElementById('statusMessage')) {
        const statusMessage = document.createElement('div');
        statusMessage.id = 'statusMessage';
        statusMessage.className = 'status-message';

        loginForm.insertBefore(statusMessage, document.getElementById('loadingOverlay'));
    }
    return document.getElementById('statusMessage');
};

const API_BASE = (window.CONFIG && window.CONFIG.API_URL) ? window.CONFIG.API_URL.replace(/\/+$/, '') : '/api';

const showStatusMessage = (message, type = 'error') => {
    const statusMessage = addStatusMessage();
    
    if (/<a\s/i.test(message)) {
        statusMessage.innerHTML = message;
    } else {
        statusMessage.textContent = message;
    }
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
    if (type === 'error') {
        shakeElement(statusMessage);
    }
};

const clearStatusMessage = () => {
    const statusMessage = document.getElementById('statusMessage');
    if (statusMessage) {
        statusMessage.style.display = 'none';
        statusMessage.textContent = '';
    }
};

async function mergeGuestCartIfNeeded() {
    try {
        console.log('ℹ️ Cart merge handled by backend during login - no frontend action needed');

        localStorage.removeItem('cartSessionId');

        window.dispatchEvent(new Event('cart:updated'));
        if (typeof window.refreshCartCount === 'function') {
            window.refreshCartCount();
        }
    } catch (e) {
        console.warn('Cart merge cleanup skipped due to error:', e.message);
    }
}

window.recaptchaSuccess = (token) => {
    document.getElementById('recaptchaError').textContent = '';
    
    window.recaptchaToken = token;
};

window.recaptchaExpired = () => {
    document.getElementById('recaptchaError').textContent = 'reCAPTCHA has expired. Please check the box again.';
    window.recaptchaToken = null;
};

window.recaptchaError = () => {
    document.getElementById('recaptchaError').textContent = 'reCAPTCHA error. Please try again.';
    window.recaptchaToken = null;
};

function shakeElement(element) {
    element.style.animation = 'none';
    setTimeout(() => {
        element.style.animation = 'shake 0.5s ease';
    }, 10);
}

document.querySelectorAll('input').forEach(input => {
    input.addEventListener('focus', () => {
        input.parentElement.classList.add('focused');
    });
    
    input.addEventListener('blur', () => {
        input.parentElement.classList.remove('focused');
    });
});

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault(); 

    clearErrors();
    clearStatusMessage();

    const emailValid = validateEmail(email.value);
    let hasError = false;

    if (!emailValid) {
        emailError.textContent = 'Invalid email address.';
        email.style.borderColor = 'red';
        shakeElement(email);
        hasError = true;
    }

    if (!password.value) {
        passwordError.textContent = 'Please enter your password.';
        password.style.borderColor = 'red';
        shakeElement(password);
        hasError = true;
    }
    
    const recaptchaToken = window.recaptchaToken;
    
    if (!recaptchaToken) {
        document.getElementById('recaptchaError').textContent = 'Please complete the security check.';
        shakeElement(document.getElementById('recaptchaError'));
        hasError = true;
    }

    if (hasError) return;

    if (rememberCheckbox && rememberCheckbox.checked) {
        localStorage.setItem('rememberedEmail', email.value);
    } else {
        localStorage.removeItem('rememberedEmail');
    }

    loadingOverlay.classList.add('active');
    loginForm.classList.add('form-disabled');
    submitButton.disabled = true;

    let apiResponse = null;
    let responseData = null;

    try {
        
        let csrfToken = null;
        try {
            const csrfResponse = await fetch(`${API_BASE}/csrf-token`, {
                credentials: 'include'
            });
            if (csrfResponse.ok) {
                const csrfData = await csrfResponse.json();
                csrfToken = csrfData.csrfToken;
            }
        } catch (csrfError) {
            console.log('CSRF token fetch failed (development mode?):', csrfError.message);
        }

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        const sessionId = localStorage.getItem('cartSessionId');
        if (sessionId) {
            headers['x-session-id'] = sessionId;
        }

        if (csrfToken && csrfToken !== 'dev-mode-no-csrf') {
            headers['X-CSRF-Token'] = csrfToken;
        }

        apiResponse = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers,
            credentials: 'include', 
            body: JSON.stringify({
                email: email.value.trim().toLowerCase(),
                password: password.value,
                recaptchaToken 
            })
        });

        const contentType = apiResponse.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            responseData = await apiResponse.json();
            console.log("Login API Response:", responseData);
        } else {
            const textResponse = await apiResponse.text();
            console.error("Login API did not return JSON:", apiResponse.status, textResponse);
            showStatusMessage(`Server error: ${apiResponse.status}. Please check console.`);
            
            grecaptcha.reset();
            window.recaptchaToken = null;
            loadingOverlay.classList.remove('active');
            loginForm.classList.remove('form-disabled');
            submitButton.disabled = false;
            return; 
        }

        if (apiResponse.ok && responseData.success) {
            
            const rootToken = responseData.token;
            const nestedToken = responseData.data && responseData.data.token;
            const finalToken = nestedToken || rootToken;

            const rememberedEmail = localStorage.getItem('rememberedEmail');

            localStorage.removeItem('userRole');
            localStorage.removeItem('userFirstName');
            localStorage.removeItem('userLastName');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userId');
            localStorage.removeItem('userAvatar');

            if (finalToken && !responseData.useHttpOnlyCookies) {
                localStorage.setItem('authToken', finalToken);
                console.log('✅ Token stored successfully:', finalToken.substring(0, 20) + '...');
            } else {
                console.log('🍪 Using HTTP-only cookies for authentication');
            }

            if (rememberedEmail) {
                localStorage.setItem('rememberedEmail', rememberedEmail);
            }

            if (responseData.data && responseData.data.user) {
                const user = responseData.data.user;
                localStorage.setItem('userRole', user.role || 'user');
                localStorage.setItem('userFirstName', user.firstName || '');
                localStorage.setItem('userLastName', user.lastName || '');
                localStorage.setItem('userEmail', user.email || '');
                localStorage.setItem('userId', user.id || '');
                console.log('✅ User info stored:', user);
            } else if (responseData.user) {
                
                const user = responseData.user;
                localStorage.setItem('userRole', user.role || 'user');
                localStorage.setItem('userFirstName', user.firstName || '');
                localStorage.setItem('userLastName', user.lastName || '');
                localStorage.setItem('userEmail', user.email || '');
                localStorage.setItem('userId', user.id || '');
                console.log('✅ User info stored (fallback):', user);
            } else {
                console.warn('⚠️ No user object received in login response. Response structure:', responseData);
                localStorage.setItem('userEmail', email.value.toLowerCase());
            }

            const userName = localStorage.getItem('userFirstName') || 'User';
            const userRole = localStorage.getItem('userRole') || 'user';
            showStatusMessage(`✅ Login successful! Welcome back, ${userName} (${userRole}). Redirecting...`, 'success');

            if (responseData.cartMerged === true || (responseData.data && responseData.data.cartMerged === true)) {
                console.log('✅ Cart merged by backend during login');
                
                localStorage.removeItem('cartSessionId');
                console.log('🔄 Guest session cleared after backend merge');
                
                window.dispatchEvent(new Event('cart:updated'));
                if (typeof window.refreshCartCount === 'function') {
                    window.refreshCartCount();
                }
            } else if (responseData.cartMerged === false || (responseData.data && responseData.data.cartMerged === false)) {
                console.log('ℹ️ No guest cart found to merge during login');
            } else {
                console.log('🔄 Attempting frontend cart merge after login');
                
                await mergeGuestCartIfNeeded();
            }

            window.recaptchaToken = null;

            window.dispatchEvent(new CustomEvent('userLogin', {
                detail: { 
                    user: { 
                        firstName: userName, 
                        role: userRole 
                    } 
                }
            }));

            const redirectDelay = setTimeout(() => {
                
                let redirectPath = (responseData.data && responseData.data.redirect) || responseData.redirect || 'index.html';

                if (/(^|\/)(user_index\.html)$/.test(redirectPath)) {
                    redirectPath = 'index.html';
                }

                if (redirectPath.startsWith('./')) {
                    redirectPath = redirectPath.substring(2);
                } else if (redirectPath.startsWith('/')) {
                    redirectPath = redirectPath.substring(1);
                }

                if (!redirectPath.includes('/') && !redirectPath.startsWith('html/')) {
                    
                }
                
                console.log(`🔄 Redirecting to: ${redirectPath}`);
                window.location.href = redirectPath;
            }, 1500); 

        } else {
            const et = responseData?.errorType;
            if (et === 'recaptcha_failed') {
                showStatusMessage(responseData.message || 'Security verification failed.', 'error');
            } else if (et === 'email_verification_required') {
                const targetEmail = responseData.email || email.value.trim().toLowerCase();
                showStatusMessage(
                    `Email not verified. <a href="user_otp-verify.html?email=${encodeURIComponent(targetEmail)}">Click here to verify</a>.`,
                    'error'
                );
            } else if (et === 'account_archived') {
                showStatusMessage(responseData.message || 'This account has been archived.', 'error');
            } else if (et === 'account_locked' || et === 'account_locked_now') {
                const mins = responseData.lockoutMinutes ?? '';
                showStatusMessage(responseData.message || 'Account locked.', 'error');
                if (mins) {
                    submitButton.disabled = true;
                    startLockoutCountdown(mins);
                }
            } else if (apiResponse.status === 401 || apiResponse.status === 404) {
                showStatusMessage('Invalid email or password.', 'error');
                shakeElement(loginForm);
            } else {
                showStatusMessage(responseData.message || 'Login failed. Please try again.', 'error');
            }
            
            if (typeof grecaptcha !== 'undefined') {
                try { grecaptcha.reset(); } catch (_) {}
            }
            window.recaptchaToken = null;
        }
    } catch (error) {
        console.error('Login fetch error:', error);
        showStatusMessage('Connection error. Please check your network and try again.', 'error');
        
        if (typeof grecaptcha !== 'undefined') {
            try { grecaptcha.reset(); } catch (_) {}
        }
        window.recaptchaToken = null;
    } finally {
        
        const smEl = document.getElementById('statusMessage');
        const isSuccess = smEl && smEl.classList.contains('success');
        if (!isSuccess) {
            loadingOverlay.classList.remove('active');
            loginForm.classList.remove('form-disabled');
            submitButton.disabled = false;
        }
    }
});

function startLockoutCountdown(minutes) {
    if (!minutes) return;
    const sm = document.getElementById('statusMessage');
    const end = Date.now() + minutes * 60000;
    const timer = setInterval(() => {
        const remaining = end - Date.now();
        if (remaining <= 0) {
            clearInterval(timer);
            if (sm && sm.classList.contains('error')) {
                sm.textContent = 'You can try logging in again now.';
            }
            submitButton.disabled = false;
            return;
        }
        const m = Math.ceil(remaining / 60000);
        if (sm && sm.classList.contains('error') && /Account locked/i.test(sm.textContent)) {
            sm.textContent = `Account locked. Try again in ${m} minute(s).`;
        }
    }, 1000); 
}

function checkExistingLogin() {
    const token = localStorage.getItem('authToken');
    const userEmail = localStorage.getItem('userEmail');
    const userRole = localStorage.getItem('userRole');
    
    if (token && userEmail) {
        
        console.log(`🔄 User already logged in (${userRole}), redirecting to dashboard...`);
        goToDashboard();
    }
}

function goToDashboard() {
    const userRole = localStorage.getItem('userRole');
    
    const redirectPath = userRole === 'admin' ? 'adminHome.html' : 'index.html';
    console.log('🔄 Redirecting to dashboard:', redirectPath);
    window.location.href = redirectPath;
}

function forceLogout() {
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userFirstName');
    localStorage.removeItem('userLastName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userId');
    localStorage.removeItem('userAvatar');
    
    localStorage.removeItem('cartSessionId');

    window.dispatchEvent(new CustomEvent('userLogout'));

    window.location.reload();
}
