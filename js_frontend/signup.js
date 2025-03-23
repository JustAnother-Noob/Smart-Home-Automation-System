
const signupForm = document.getElementById('signupForm');
const email = document.getElementById('email');
const password = document.getElementById('password');
const confirmPassword = document.getElementById('confirmPassword');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const confirmError = document.getElementById('confirmError');
const termscheckbox = document.getElementById('t&cCheckbox');
const termsError = document.getElementById('t&cError');
const showPasswordBtn = document.getElementById('show-pwd');
const showConfirmPasswordBtn = document.getElementById('show-confirm-pwd');
const loadingOverlay = document.getElementById('loadingOverlay');
const submitButton = document.querySelector('#signupForm button[type="submit"]');


// ********************** Validate Email with Regex **********************
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

email.addEventListener('input', () => {
    const isEmailValid = validateEmail(email.value);
    if (!isEmailValid) {
        email.style.borderColor = 'red';
        emailError.textContent = 'Invalid email address.';
    } else {
        email.style.borderColor = 'green';
        emailError.textContent = '';
    }
});

// ********************** Validate Password with Regex **********************
const validatePassword = (password) => {
    const requirements = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };
    return requirements;
};

password.addEventListener('input', () => {
    const requirements = validatePassword(password.value);
    const isPasswordValid = Object.values(requirements).every(Boolean);

    if (!isPasswordValid) {
        password.style.borderColor = 'red';
        passwordError.textContent = 'Password does not meet requirements.';
    } else {
        password.style.borderColor = 'green';
        passwordError.textContent = '';
    }
    Object.keys(requirements).forEach((requirement) => {
        const element = document.getElementById(requirement);
        element.style.color = requirements[requirement] ? 'green' : 'red';
    });
});

showPasswordBtn.addEventListener('click', () => {
    if (password.type === 'password') {
        password.type = 'text';
        showPasswordBtn.src = '/assets/images/hide_pwd.png';
    } else {
        password.type = 'password';
        showPasswordBtn.src = '/assets/images/show_pwd.png';
    }
});


confirmPassword.addEventListener('input', () => {
    if (password.value !== confirmPassword.value) {
        confirmPassword.style.borderColor = 'red';
        confirmError.textContent = 'Passwords do not match.';
    } else {
        confirmPassword.style.borderColor = 'green';
        confirmError.textContent = '';
    }
});

showConfirmPasswordBtn.addEventListener('click', () => {
    if (confirmPassword.type === 'password') {
        confirmPassword.type = 'text';
        showConfirmPasswordBtn.src = '/assets/images/hide_pwd.png';
    } else {
        confirmPassword.type = 'password';
        showConfirmPasswordBtn.src = '/assets/images/show_pwd.png';
    }
});



// ********************** Submit Form **********************
signupForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Prevent the default form submission

    // ********************** Client Validation **********************
    const emailValid = validateEmail(email.value);
    const passwordRequirements = validatePassword(password.value); // Corrected this line
    const passwordsMatch = password.value === confirmPassword.value;
    const isPasswordValid = Object.values(passwordRequirements).every(Boolean); // Check if all requirements are met



    if (!emailValid) {
        document.getElementById('emailError').textContent = 'Invalid email address.';
        email.style.borderColor = 'red';
        return;
    }

    if (!isPasswordValid) {
        document.getElementById('passwordError').textContent = 'Password does not meet requirements';
        password.style.borderColor = 'red';
        return;
    }

    if (!passwordsMatch) {
        document.getElementById('confirmError').textContent = 'Passwords do not match';
        confirmPassword.style.borderColor = 'red';
        return;
    }

    if (!termscheckbox.checked) {
        document.getElementById('t&cError').textContent = 'You must agree to the terms and conditions';
        return;
    } else {
        document.getElementById('t&cError').textContent = '';
    }

    loadingOverlay.classList.add('active');
    signupForm.classList.add('form-disabled');
    submitButton.disabled = true;

    try {
        const response = await fetch('http://127.0.0.1:5001/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: email.value.toLowerCase(), 
                password: password.value 
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            // Redirect to OTP verification page
            window.location.href = `otp-verify.html?email=${encodeURIComponent(email.value)}`;
        } else {
            alert(data.message || 'Sign-up failed');
        }
    } catch (error) {
        console.error('Signup error:', error);
        alert('Connection error. Please try again.');
    } finally {
        loadingOverlay.classList.remove('active');
        signupForm.classList.remove('form-disabled');
        submitButton.disabled = false;
    }
});
