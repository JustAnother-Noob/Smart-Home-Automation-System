

const CONFIG = window.CONFIG || {
  API_URL: window.CONFIG?.API_BASE || '',
  GOOGLE_CLIENT_ID: "1028485501245-c9kh3ga5umg7jhn9bvticpaf10iputqg.apps.googleusercontent.com"
};

import {
  validateName,
  validateEmail,
  validatePassword,
  isPasswordValid
} from './validators.js';

function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

const signupForm = document.getElementById('signupForm');
const firstName = document.getElementById('firstName');
const lastName = document.getElementById('lastName');
const email = document.getElementById('email');
const password = document.getElementById('password');
const confirmPassword = document.getElementById('confirmPassword');

const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const confirmError = document.getElementById('confirmError');
const firstNameError = document.getElementById('firstNameError');
const lastNameError = document.getElementById('lastNameError');

const termsCheckbox = document.getElementById('termsCheckbox');
const termsError = document.getElementById('termsError');

const showPasswordBtn = document.getElementById('show-pwd');
const showConfirmPasswordBtn = document.getElementById('show-confirm-pwd');

const loadingOverlay = document.getElementById('loadingOverlay');
const submitButton = document.querySelector('#signupForm button[type="submit"]');

firstName.addEventListener('input', debounce(() => {
  if (!validateName(firstName.value)) {
    firstName.classList.add('input-error');
    firstName.classList.remove('input-success');
    firstNameError.textContent =
      'First name must be at least 2 characters and contain only letters.';
  } else {
    firstName.classList.add('input-success');
    firstName.classList.remove('input-error');
    firstNameError.textContent = '';
  }
}, 300));

lastName.addEventListener('input', debounce(() => {
  if (!validateName(lastName.value)) {
    lastName.classList.add('input-error');
    lastName.classList.remove('input-success');
    lastNameError.textContent =
      'Last name must be at least 2 characters and contain only letters.';
  } else {
    lastName.classList.add('input-success');
    lastName.classList.remove('input-error');
    lastNameError.textContent = '';
  }
}, 300));

email.addEventListener('input', debounce(() => {
  if (!validateEmail(email.value)) {
    email.classList.add('input-error');
    email.classList.remove('input-success');
    emailError.textContent = 'Invalid email address.';
  } else {
    email.classList.add('input-success');
    email.classList.remove('input-error');
    emailError.textContent = '';
  }
}, 300));

password.addEventListener('focus', () => {
  document.getElementById('passwordRules').classList.add('visible');
});
password.addEventListener('blur', () => {
  if (!password.value) {
    document.getElementById('passwordRules').classList.remove('visible');
  }
});

password.addEventListener('input', debounce(() => {
  const requirements = validatePassword(password.value);
  const isValid = isPasswordValid(requirements);

  Object.keys(requirements).forEach((rule) => {
    const el = document.getElementById(rule);
    if (el) {
      el.classList.remove('valid', 'invalid');
      el.classList.add(requirements[rule] ? 'valid' : 'invalid');
    }
  });

  if (!isValid) {
    password.classList.add('input-error');
    password.classList.remove('input-success');
    passwordError.textContent = 'Password does not meet all requirements.';
  } else {
    password.classList.add('input-success');
    password.classList.remove('input-error');
    passwordError.textContent = '';
  }
}, 300));

confirmPassword.addEventListener('input', debounce(() => {
  if (password.value !== confirmPassword.value) {
    confirmPassword.classList.add('input-error');
    confirmPassword.classList.remove('input-success');
    confirmError.textContent = 'Passwords do not match.';
  } else {
    confirmPassword.classList.add('input-success');
    confirmPassword.classList.remove('input-error');
    confirmError.textContent = '';
  }
}, 300));

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

showConfirmPasswordBtn?.addEventListener('click', () => {
  const isPassword = confirmPassword.type === 'password';
  confirmPassword.type = isPassword ? 'text' : 'password';

  if (isPassword) {
    showConfirmPasswordBtn.className = 'fi fi-rr-eye password-toggle';
    showConfirmPasswordBtn.setAttribute('aria-label', 'Hide confirm password');
  } else {
    showConfirmPasswordBtn.className = 'fi fi-rr-eye-crossed password-toggle';
    showConfirmPasswordBtn.setAttribute('aria-label', 'Show confirm password');
  }
});

function clearErrors() {
  document.querySelectorAll('.error-message').forEach((el) => {
    el.textContent = '';
  });
  [firstName, lastName, email, password, confirmPassword].forEach((field) => {
    if (field) {
      field.classList.remove('input-error', 'input-success');
    }
  });
}

function showStatusMessage(message, type = 'error') {
  const statusMessage = document.getElementById('statusMessage');
  if (!statusMessage) return;
  
  statusMessage.style.display = '';
  const span = statusMessage.querySelector('.status-text') || statusMessage;
  span.textContent = message;
  statusMessage.className = `status-message ${type} show`;
}

function clearStatusMessage() {
  const statusMessage = document.getElementById('statusMessage');
  if (!statusMessage) return;
  statusMessage.classList.remove('show');
  const span = statusMessage.querySelector('.status-text') || statusMessage;
  span.textContent = '';
  statusMessage.className = 'status-message';
  statusMessage.style.display = 'none';
}

window.recaptchaSuccess = (token) => {
  const recaptchaError = document.getElementById('recaptchaError');
  if (recaptchaError) recaptchaError.textContent = '';
  window.recaptchaToken = token;
};

window.recaptchaExpired = () => {
  window.recaptchaToken = null;
  const recaptchaError = document.getElementById('recaptchaError');
  if (recaptchaError) {
    recaptchaError.textContent = 'reCAPTCHA expired. Please verify again.';
  }
};

window.recaptchaError = () => {
  window.recaptchaToken = null;
  const recaptchaError = document.getElementById('recaptchaError');
  if (recaptchaError) {
    recaptchaError.textContent = 'reCAPTCHA error. Please try again.';
  }
};

window.sendGoogleTokenToBackend = async function(idToken) {
  clearStatusMessage();
  loadingOverlay.classList.add('active');

  try {
    
    let csrfToken = null;
    try {
      const csrfResponse = await fetch(`${CONFIG.API_URL}/csrf-token`, {
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
      Accept: 'application/json'
    };

    if (csrfToken && csrfToken !== 'dev-mode-no-csrf') {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const response = await fetch(`${CONFIG.API_URL}/auth/google`, {
      method: 'POST',
      headers,
      credentials: 'include', 
      body: JSON.stringify({ token: idToken })
    });

    let data = null;
    try {
      data = await response.json();
    } catch (jsonErr) {
      
      data = null;
    }

    if (response.ok && data && data.success) {
      
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

      window.dispatchEvent(new CustomEvent('userLogin', {
        detail: { 
          user: { 
            firstName: localStorage.getItem('userFirstName'), 
            role: localStorage.getItem('userRole') 
          } 
        }
      }));

      setTimeout(() => {
        let redirectPath = (data.data && data.data.redirect) || data.redirect || 'index.html';
        if (redirectPath.startsWith('/')) {
          redirectPath = redirectPath.substring(1);
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
  }
}

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();
  clearStatusMessage();

  const firstNameValid = validateName(firstName.value);
  const lastNameValid = validateName(lastName.value);
  const emailValid = validateEmail(email.value);
  const passwordRequirements = validatePassword(password.value);
  const passwordValid = isPasswordValid(passwordRequirements);
  const passwordsMatch = password.value === confirmPassword.value;
  const recaptchaToken = window.recaptchaToken;
  let hasError = false;

  if (!firstNameValid) {
    firstNameError.textContent = 'Please enter a valid first name (2+ letters only).';
    firstName.classList.add('input-error');
    hasError = true;
  }
  if (!lastNameValid) {
    lastNameError.textContent = 'Please enter a valid last name (2+ letters only).';
    lastName.classList.add('input-error');
    hasError = true;
  }
  if (!emailValid) {
    emailError.textContent = 'Invalid email address.';
    email.classList.add('input-error');
    hasError = true;
  }
  if (!passwordValid) {
    passwordError.textContent = 'Password does not meet requirements.';
    password.classList.add('input-error');
    hasError = true;
  }
  if (!passwordsMatch) {
    confirmError.textContent = 'Passwords do not match.';
    confirmPassword.classList.add('input-error');
    hasError = true;
  }
  if (!termsCheckbox.checked) {
    termsError.textContent = 'You must agree to the Terms of Service and Privacy Policy.';
    hasError = true;
  }
  if (!recaptchaToken) {
    const recaptchaError = document.getElementById('recaptchaError');
    if (recaptchaError) {
      recaptchaError.textContent = 'Please complete the security check.';
    }
    hasError = true;
  }
  if (hasError) return;

  loadingOverlay.classList.add('active');
  signupForm.classList.add('form-disabled');
  submitButton.disabled = true;

  try {
    
    let csrfToken = null;
    try {
      const csrfResponse = await fetch(`${CONFIG.API_URL}/csrf-token`, {
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

    if (csrfToken && csrfToken !== 'dev-mode-no-csrf') {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const response = await fetch(`${CONFIG.API_URL}/auth/signup`, {
      method: 'POST',
      headers,
      credentials: 'include', 
      body: JSON.stringify({
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim(),
        email: email.value.trim().toLowerCase(),
        password: password.value,
        recaptchaToken,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const successMessage = data.emailSent
        ? 'Account created successfully! Check your email for verification code.'
        : 'Account created! Email service unavailable — redirecting to verification page.';
      showStatusMessage(successMessage, 'success');
      localStorage.setItem('otpVerificationEmail', email.value.trim().toLowerCase());
      setTimeout(() => {
        window.location.href = `user_otp-verify.html?email=${encodeURIComponent(email.value)}`;
      }, 2000);
    } else {
      
      const serverMessage = (data && (data.message || data.error)) || 'Signup failed. Please try again.';

      if (data && data.field === 'email') {
        emailError.textContent = data.message || 'Invalid email.';
        email.classList.add('input-error');
        showStatusMessage(data.message || 'Please check your email.', 'error');
      } else if (data && /email.*exist/i.test(serverMessage)) {
        
        emailError.textContent = serverMessage;
        email.classList.add('input-error');
        showStatusMessage(serverMessage, 'error');
      } else if (data && data.field === 'password') {
        passwordError.textContent = data.message || 'Invalid password.';
        password.classList.add('input-error');
        if (data.requirements) {
          document.getElementById('passwordRules').classList.add('visible');
          Object.keys(data.requirements).forEach((req) => {
            const el = document.getElementById(req);
            if (el) {
              el.classList.remove('valid', 'invalid');
              el.classList.add(data.requirements[req] ? 'valid' : 'invalid');
            }
          });
        }
      } else if (data && data.field === 'firstName') {
        firstNameError.textContent = data.message || 'Invalid first name.';
        firstName.classList.add('input-error');
      } else if (data && data.field === 'lastName') {
        lastNameError.textContent = data.message || 'Invalid last name.';
        lastName.classList.add('input-error');
      } else {
        
        showStatusMessage(serverMessage, 'error');
      }
      if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
      window.recaptchaToken = null;
    }
  } catch (error) {
    console.error('Signup error:', error);
    if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
    window.recaptchaToken = null;
    showStatusMessage('Connection error. Please try again.', 'error');
  } finally {
    if (!document.querySelector('.status-message.success')) {
      loadingOverlay.classList.remove('active');
      signupForm.classList.remove('form-disabled');
      submitButton.disabled = false;
    }
  }
});

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

document.addEventListener('DOMContentLoaded', () => {
  checkExistingLogin();
});

document.querySelectorAll('input, textarea').forEach((field) => {
  field.addEventListener('focus', () => {
    if (field.parentElement) field.parentElement.classList.add('focused');
  });
  field.addEventListener('blur', () => {
    if (field.parentElement && !field.value.trim()) {
      field.parentElement.classList.remove('focused');
    }
  });
});
