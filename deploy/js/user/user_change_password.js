document.addEventListener('DOMContentLoaded', () => {
    
    if (typeof checkUserAuth === 'function' && !checkUserAuth()) {
        return; 
    }

    const form = document.getElementById('resetFlowForm');
    const emailStep = document.getElementById('emailStep');
    const otpStep = document.getElementById('otpStep');
    const resetStep = document.getElementById('resetStep');

    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('emailError');
    const sendCodeBtn = document.getElementById('sendCodeBtn');

    const otpInputs = document.querySelectorAll('.otp-input');
    const hiddenOtpInput = document.getElementById('otp');
    const otpError = document.getElementById('otpError');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const resendLink = document.getElementById('resendOtpLink');
    const timerDisplay = document.getElementById('timer');
    const timerContainer = document.getElementById('timerContainer');

    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const newPasswordError = document.getElementById('newPasswordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    const passwordRulesContainer = document.getElementById('passwordRules');

    const statusMessage = document.getElementById('statusMessage');
    const loadingOverlay = document.getElementById('loadingOverlay');

    let currentStep = 1;
    let userEmail = '';
    let verifiedOtp = ''; 
    let timerInterval = null;
    let countdown = 60;

    const API_BASE = (window.CONFIG && window.CONFIG.API_URL) ? window.CONFIG.API_URL.replace(/\/+$/, '') : '/api';
    const API_BASE_URL = `${API_BASE}/auth`;

    const showStep = (stepNumber) => {
        emailStep.classList.remove('active');
        otpStep.classList.remove('active');
        resetStep.classList.remove('active');

        const progressSteps = document.querySelectorAll('.progress-step');
        progressSteps.forEach((step, index) => {
            const stepNum = index + 1;
            step.classList.remove('active', 'completed');
            
            if (stepNum === stepNumber) {
                step.classList.add('active');
            } else if (stepNum < stepNumber) {
                step.classList.add('completed');
            }
        });

        switch (stepNumber) {
            case 1:
                emailStep.classList.add('active');
                currentStep = 1;
                break;
            case 2:
                otpStep.classList.add('active');
                currentStep = 2;
                startTimer();
                break;
            case 3:
                resetStep.classList.add('active');
                currentStep = 3;
                break;
        }
        clearStatusMessage(); 
    };

    const showLoading = (show) => {
        
        const currentButton = document.querySelector(`.form-step.active .submit-btn`);
        if (currentButton) {
            currentButton.disabled = show;
        }
    };

    const showStatusMessage = (message, type = 'error') => {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.style.display = 'block';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const clearStatusMessage = () => {
        statusMessage.style.display = 'none';
        statusMessage.textContent = '';
    };

    const clearInputError = (errorElement, inputElement) => {
        if (errorElement) errorElement.textContent = '';
        if (inputElement) {
             inputElement.classList.remove('input-error');
             inputElement.classList.remove('input-success');
        }
    };

    const setInputError = (errorElement, inputElement, message) => {
        if (errorElement) errorElement.textContent = message;
        if (inputElement) {
             inputElement.classList.add('input-error');
             inputElement.classList.remove('input-success');
        }
    };

    const validateEmailFormat = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    sendCodeBtn.addEventListener('click', async () => {
        clearStatusMessage();
        clearInputError(emailError, emailInput);
        clearInputError(otpError, null); 

        userEmail = emailInput.value.trim().toLowerCase();

        if (!validateEmailFormat(userEmail)) {
            setInputError(emailError, emailInput, 'Please enter a valid email address.');
            return;
        }

        showLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ email: userEmail })
            });
            const data = await response.json();

            if (response.ok && data.success) {
                userEmailDisplay.textContent = userEmail;
                showStep(2);
            } else {
                if (response.status === 429) {
                     showStatusMessage(data.message || 'Too many requests. Please wait 5 minutes.', 'error');
                } else {
                    showStatusMessage(data.message || 'Failed to send reset code.', 'error');
                    if (response.status === 404) {
                        setInputError(emailError, emailInput, data.message || 'Email not found.');
                    }
                }
            }
        } catch (error) {
            console.error('Send Code Error:', error);
            showStatusMessage('An error occurred. Please check your connection.', 'error');
        } finally {
            
            if (currentStep === 1) {
                 showLoading(false);
                 
                 sendCodeBtn.disabled = false;
            }
        }
    });

    otpInputs.forEach((input, index) => {
        input.addEventListener('input', () => {
            if (input.value && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
            combineOtpInputs();
            clearInputError(otpError, null); 
            input.style.borderColor = ''; 
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && index > 0) {
                otpInputs[index - 1].focus();
            }
            if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
        });
    });

    otpInputs.forEach((input, index) => {
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = e.clipboardData.getData('text').trim();
            
            const digits = pasteData.replace(/\D/g, '');
            
            if (digits.length >= 6) {
                
                digits.substring(0, 6).split('').forEach((char, i) => {
                    if (otpInputs[i]) {
                        otpInputs[i].value = char;
                    }
                });
                combineOtpInputs();
                clearInputError(otpError, null);
                otpInputs[5].focus(); 
            } else if (digits.length > 0) {
                
                digits.split('').forEach((char, i) => {
                    if (otpInputs[index + i]) {
                        otpInputs[index + i].value = char;
                    }
                });
                combineOtpInputs();
                clearInputError(otpError, null);
                
                const nextIndex = Math.min(index + digits.length, otpInputs.length - 1);
                otpInputs[nextIndex].focus();
            }
        });
    });

    function combineOtpInputs() {
        let combinedOtp = '';
        otpInputs.forEach(input => combinedOtp += input.value);
        hiddenOtpInput.value = combinedOtp;
        if (combinedOtp.length === 6) {
            clearInputError(otpError, null); 
        }
    }

    function startTimer() {
        countdown = 60; 
        resendLink.classList.add('disabled');
        timerContainer.style.display = 'inline';
        timerDisplay.textContent = countdown;
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            countdown--;
            timerDisplay.textContent = countdown;
            if (countdown <= 0) {
                clearInterval(timerInterval);
                timerContainer.style.display = 'none';
                resendLink.classList.remove('disabled');
                resendLink.textContent = 'Resend Code';
            }
        }, 1000);
    }

    resendLink.addEventListener('click', async (e) => {
        e.preventDefault();
        if (resendLink.classList.contains('disabled') || !userEmail) return;

        clearStatusMessage(); 
        clearInputError(otpError, null); 

        resendLink.textContent = 'Sending...';
        resendLink.classList.add('disabled'); 

        try {
            const response = await fetch(`${API_BASE_URL}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ email: userEmail })
            });
            const data = await response.json();

            if (response.ok && data.success) {
                showStatusMessage('New reset code sent successfully!', 'success'); 
                startTimer(); 
            } else {
                if (response.status === 429) {
                    setInputError(otpError, null, data.message || 'Too many resend requests. Please wait 5 minutes.');
                } else {
                    setInputError(otpError, null, data.message || 'Failed to resend code.');
                }
            }
        } catch (error) {
            console.error('Resend OTP Error:', error);
            setInputError(otpError, null, 'An error occurred while resending.');
        } finally {
            
            if (countdown <= 0) {
                 resendLink.classList.remove('disabled');
                 resendLink.textContent = 'Resend Code';
            }
        }
    });

    verifyOtpBtn.addEventListener('click', async () => {
        clearStatusMessage();
        clearInputError(otpError, null);
        const otpValue = hiddenOtpInput.value.trim();

        if (!/^\d{6}$/.test(otpValue)) {
            setInputError(otpError, null, 'Please enter the complete 6-digit code.');
            otpInputs.forEach(input => { if (!input.value) input.style.borderColor = 'red'; });
            return;
        } else {
             otpInputs.forEach(input => input.style.borderColor = '');
        }

        showLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/verify-reset-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ email: userEmail, otp: otpValue })
            });
            const data = await response.json();

            if (response.ok && data.success) {
                verifiedOtp = otpValue; 
                clearInterval(timerInterval); 
                clearInputError(otpError, null); 
                showStep(3);
            } else {
                setInputError(otpError, null, data.message || 'Invalid or expired code.');
                otpInputs.forEach(input => {
                    input.value = ''; 
                    input.style.borderColor = '#ef4444'; 
                });
                hiddenOtpInput.value = '';
                if (otpInputs.length > 0) otpInputs[0].focus();
            }
        } catch (error) {
            console.error('Verify OTP Error:', error);
            setInputError(otpError, null, 'An error occurred during verification.');
        } finally {
            showLoading(false);
        }
    });

    const passwordRequirements = {
        length: { regex: /.{8,}/, elementId: 'length' },
        uppercase: { regex: /[A-Z]/, elementId: 'uppercase' },
        lowercase: { regex: /[a-z]/, elementId: 'lowercase' },
        number: { regex: /\d/, elementId: 'number' },
        special: { regex: /[!@#$%^&*]/, elementId: 'special' } 
    };

    const updatePasswordChecklist = (password) => {
        let allValid = true;
        Object.keys(passwordRequirements).forEach((key) => {
            const req = passwordRequirements[key];
            const element = document.getElementById(req.elementId);
            if (!element) return;
            const isValid = req.regex.test(password);
            element.className = isValid ? 'valid' : 'invalid';
            if (!isValid) allValid = false;
            
            const wasValid = element.classList.contains('valid');
             if (isValid && !wasValid) {
                 element.style.transition = 'none';
                 element.style.transform = 'translateX(0)';
                 void element.offsetWidth;
                 element.style.transition = 'all 0.3s ease';
                 element.style.transform = 'translateX(4px)';
             } else if (!isValid) {
                 element.style.transform = 'translateX(0)';
             }
        });
        return allValid;
    };

    newPasswordInput.addEventListener('focus', () => passwordRulesContainer.classList.add('visible'));
    newPasswordInput.addEventListener('input', () => {
        clearInputError(newPasswordError, newPasswordInput);
        updatePasswordChecklist(newPasswordInput.value);
    });
    confirmPasswordInput.addEventListener('input', () => clearInputError(confirmPasswordError, confirmPasswordInput));

    document.querySelectorAll('.pwd-toggle').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const targetInput = document.getElementById(this.getAttribute('data-target'));
            if (targetInput) {
                const isPassword = targetInput.type === 'password';
                targetInput.type = isPassword ? 'text' : 'password';

                const icon = this.querySelector('i');
                if (icon) {
                    icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
                }
            }
        });
        toggle.addEventListener('mousedown', (e) => e.preventDefault());
    });

    resetPasswordBtn.addEventListener('click', async () => {
        clearStatusMessage();
        clearInputError(newPasswordError, newPasswordInput);
        clearInputError(confirmPasswordError, confirmPasswordInput);

        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        let hasError = false;

        if (!updatePasswordChecklist(newPassword)) {
            setInputError(newPasswordError, newPasswordInput, 'Password does not meet requirements.');
            hasError = true;
        } else {
            newPasswordInput.classList.add('input-success');
        }

        if (!confirmPassword) {
            setInputError(confirmPasswordError, confirmPasswordInput, 'Please confirm your password.');
            hasError = true;
        } else if (newPassword && newPassword !== confirmPassword) {
            setInputError(confirmPasswordError, confirmPasswordInput, 'Passwords do not match.');
            hasError = true;
        } else if (newPassword && newPassword === confirmPassword && !hasError) { 
            confirmPasswordInput.classList.add('input-success');
        }

        if (hasError) return;

        showLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                credentials: 'include', 
                body: JSON.stringify({
                    email: userEmail,
                    otp: verifiedOtp,
                    newPassword: newPassword
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
                     setInputError(newPasswordError, newPasswordInput, data.message || 'Password requirements not met.');
                     passwordRulesContainer.classList.add('visible');
                     updatePasswordChecklist(newPassword); 
                 } else {
                     showStatusMessage(data.message || 'Password reset failed.', 'error');
                 }
            }
        } catch (error) {
            console.error('Reset Password Error:', error);
            showStatusMessage('An error occurred while resetting the password.', 'error');
        } finally {
            
            if (!statusMessage.classList.contains('success')) {
                showLoading(false);
            }
        }
    });

    showStep(1); 
});
