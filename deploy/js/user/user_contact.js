

import { validateName, validateEmail } from './validators.js';

const API_BASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.API_URL)
  ? CONFIG.API_URL
  : '/api';

const contactForm = document.getElementById('contact-form');
const formMessage = document.getElementById('form-message');

const firstNameInput = document.getElementById('firstName');
const lastNameInput = document.getElementById('lastName');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const subjectInput = document.getElementById('subject');
const messageInput = document.getElementById('message');

const firstNameError = document.getElementById('firstName-error');
const lastNameError = document.getElementById('lastName-error');
const emailError = document.getElementById('email-error');
const phoneError = document.getElementById('phone-error');
const subjectError = document.getElementById('subject-error');
const messageError = document.getElementById('message-error');

function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

document.addEventListener('DOMContentLoaded', () => {
  
  const token = localStorage.getItem('authToken');
  const userRole = localStorage.getItem('userRole');
  if (token && userRole === 'admin') {
    console.log('🚫 Admin user attempting to access contact page, redirecting to admin dashboard');
    window.location.href = 'adminHome.html';
    return;
  }

  initializeContactForm();
  setupRealTimeValidation();
  populateUserData();
});

function setupRealTimeValidation() {
  
  firstNameInput.addEventListener('input', debounce(() => {
    validateField('firstName');
  }, 300));

  firstNameInput.addEventListener('blur', () => {
    validateField('firstName');
  });

  lastNameInput.addEventListener('input', debounce(() => {
    validateField('lastName');
  }, 300));

  lastNameInput.addEventListener('blur', () => {
    validateField('lastName');
  });

  emailInput.addEventListener('input', debounce(() => {
    validateField('email');
  }, 300));

  emailInput.addEventListener('blur', () => {
    validateField('email');
  });

  phoneInput.addEventListener('input', debounce(() => {
    if (phoneInput.value.trim()) {
      validateField('phone');
    } else {
      clearFieldError('phone');
    }
  }, 300));

  phoneInput.addEventListener('blur', () => {
    if (phoneInput.value.trim()) {
      validateField('phone');
    }
  });

  subjectInput.addEventListener('change', () => {
    validateField('subject');
  });

  messageInput.addEventListener('input', debounce(() => {
    validateField('message');
  }, 300));

  messageInput.addEventListener('blur', () => {
    validateField('message');
  });
}

function validateField(fieldName) {
  let isValid = true;
  let errorMsg = '';

  switch (fieldName) {
    case 'firstName':
      const firstName = firstNameInput.value.trim();
      if (!firstName) {
        isValid = false;
        errorMsg = 'First name is required';
      } else if (!validateName(firstName)) {
        isValid = false;
        errorMsg = 'First name must be at least 2 characters and contain only letters';
      }
      showFieldError('firstName', errorMsg, isValid);
      break;

    case 'lastName':
      const lastName = lastNameInput.value.trim();
      if (!lastName) {
        isValid = false;
        errorMsg = 'Last name is required';
      } else if (!validateName(lastName)) {
        isValid = false;
        errorMsg = 'Last name must be at least 2 characters and contain only letters';
      }
      showFieldError('lastName', errorMsg, isValid);
      break;

    case 'email':
      const email = emailInput.value.trim();
      if (!email) {
        isValid = false;
        errorMsg = 'Email address is required';
      } else if (!validateEmail(email)) {
        isValid = false;
        errorMsg = 'Please enter a valid email address';
      }
      showFieldError('email', errorMsg, isValid);
      break;

    case 'phone':
      const phone = phoneInput.value.trim();
      if (phone) {
        
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone)) {
          isValid = false;
          errorMsg = 'Please enter a valid 10-digit phone number';
        }
      }
      showFieldError('phone', errorMsg, isValid);
      break;

    case 'subject':
      const subject = subjectInput.value;
      if (!subject) {
        isValid = false;
        errorMsg = 'Please select a subject';
      }
      showFieldError('subject', errorMsg, isValid);
      break;

    case 'message':
      const message = messageInput.value.trim();
      if (!message) {
        isValid = false;
        errorMsg = 'Message is required';
      } else if (message.length < 10) {
        isValid = false;
        errorMsg = 'Message must be at least 10 characters long';
      }
      showFieldError('message', errorMsg, isValid);
      break;
  }

  return isValid;
}

function showFieldError(fieldName, errorMsg, isValid) {
  const input = document.getElementById(fieldName);
  const errorElement = document.getElementById(`${fieldName}-error`);

  if (!isValid) {
    input.classList.add('input-error');
    input.classList.remove('input-success');
    errorElement.textContent = errorMsg;
    errorElement.style.display = 'block';
  } else {
    
    input.classList.remove('input-error', 'input-success');
    errorElement.textContent = '';
    errorElement.style.display = 'none';
  }
}

function clearFieldError(fieldName) {
  const input = document.getElementById(fieldName);
  const errorElement = document.getElementById(`${fieldName}-error`);
  
  input.classList.remove('input-error', 'input-success');
  errorElement.textContent = '';
  errorElement.style.display = 'none';
}

function clearAllErrors() {
  ['firstName', 'lastName', 'email', 'phone', 'subject', 'message'].forEach(field => {
    clearFieldError(field);
  });
}

function initializeContactForm() {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    formMessage.style.display = 'none';

    const isFirstNameValid = validateField('firstName');
    const isLastNameValid = validateField('lastName');
    const isEmailValid = validateField('email');
    const isPhoneValid = phoneInput.value.trim() ? validateField('phone') : true;
    const isSubjectValid = validateField('subject');
    const isMessageValid = validateField('message');

    if (!isFirstNameValid || !isLastNameValid || !isEmailValid || !isPhoneValid || !isSubjectValid || !isMessageValid) {
      showFormMessage('error', 'Please fix the errors above before submitting.');
      
      const firstError = contactForm.querySelector('.input-error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstError.focus();
      }
      return;
    }
    
    const submitBtn = contactForm.querySelector('.submit-btn');
    const originalBtnText = submitBtn.innerHTML;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Sending...</span>';
    
    try {
      
      const formData = {
        firstName: firstNameInput.value.trim(),
        lastName: lastNameInput.value.trim(),
        email: emailInput.value.trim(),
        phone: phoneInput.value.trim(),
        subject: subjectInput.value,
        message: messageInput.value.trim()
      };

      const response = await fetch(`${API_BASE_URL}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showFormMessage('success', 'Thank you for contacting us! We\'ll get back to you within 24 hours.');
        contactForm.reset();
        clearAllErrors();

        if (typeof gtag !== 'undefined') {
          gtag('event', 'contact_form_submission', {
            'event_category': 'engagement',
            'event_label': formData.subject
          });
        }
      } else {
        throw new Error(data.message || 'Failed to send message. Please try again.');
      }
      
    } catch (error) {
      console.error('Contact form error:', error);

      if (error instanceof TypeError && error.message.includes('fetch')) {
        showFormMessage('error', 'Unable to connect to server. Please make sure the backend server is running or contact us directly at smartlivingtech0@gmail.com');
      } else {
        showFormMessage('error', error.message || 'An error occurred. Please try again later or email us directly at smartlivingtech0@gmail.com');
      }
    } finally {
      
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });
}

function showFormMessage(type, message) {
  formMessage.className = `form-message ${type}`;
  formMessage.textContent = message;
  formMessage.style.display = 'block';

  formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  if (type === 'success') {
    setTimeout(() => {
      formMessage.style.display = 'none';
    }, 5000);
  }
}

async function populateUserData() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const response = await fetch(`${API_BASE_URL}/users/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const { user } = await response.json();

      if (user.firstName) {
        document.getElementById('firstName').value = user.firstName;
      }
      if (user.lastName) {
        document.getElementById('lastName').value = user.lastName;
      }
      if (user.email) {
        document.getElementById('email').value = user.email;
      }
      if (user.phone) {
        document.getElementById('phone').value = user.phone;
      }
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
    
  }
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

const formInputs = document.querySelectorAll('.contact-form input, .contact-form select, .contact-form textarea');

formInputs.forEach(input => {
  
  input.addEventListener('focus', function() {
    this.parentElement.classList.add('focused');
  });

  input.addEventListener('blur', function() {
    this.parentElement.classList.remove('focused');
  });

  input.addEventListener('input', function() {
    if (this.value) {
      this.parentElement.classList.add('filled');
    } else {
      this.parentElement.classList.remove('filled');
    }
  });
});
