document.addEventListener('DOMContentLoaded', function() {
    
    const otpInputs = document.querySelectorAll('.otp-input');
    const otpForm = document.getElementById('otp-form');
    const feedbackArea = document.getElementById('feedback-area');
    const resendLink = document.getElementById('resend-link');
    const resendTimer = document.getElementById('resend-timer');
    const loadingOverlay = document.getElementById('loading-overlay');
    const maskedEmailElement = document.getElementById('masked-email');

    const params = new URLSearchParams(window.location.search);
    let email = params.get('email');

    if (!email) {
        email = localStorage.getItem('otpVerificationEmail');
    }

    if (!email) {
        
        window.location.href = 'signup.html';
        return;
    }

    maskedEmailElement.textContent = email;

    otpInputs[0].focus();

    startResendTimer(60); 

    otpInputs.forEach((input, index) => {
        
        input.addEventListener('input', function(e) {
            this.value = this.value.replace(/[^0-9]/g, '');
            
            if (this.value.length === 1) {
                this.classList.add('filled');
                
                if (index < otpInputs.length - 1) {
                    otpInputs[index + 1].focus();
                }
            } else {
                this.classList.remove('filled');
            }
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && this.value === '' && index > 0) {
                otpInputs[index - 1].focus();
            }
        });

        input.addEventListener('paste', function(e) {
            e.preventDefault();
            const pastedData = (e.clipboardData || window.clipboardData).getData('text');
            
            if (/^\d+$/.test(pastedData)) {
                const digits = pastedData.split('');
                otpInputs.forEach((input, i) => {
                    if (i < digits.length) {
                        input.value = digits[i];
                        input.classList.add('filled');
                    }
                });

                const nextEmptyIndex = Array.from(otpInputs).findIndex(input => !input.value);
                if (nextEmptyIndex !== -1) {
                    otpInputs[nextEmptyIndex].focus();
                } else {
                    otpInputs[otpInputs.length - 1].focus();
                }
            }
        });
    });

    otpForm.addEventListener('submit', function(e) {
        e.preventDefault();

        let otp = '';
        otpInputs.forEach(input => {
            otp += input.value;
        });

        if (otp.length !== 6 || !/^\d+$/.test(otp)) {
            showFeedback('Please enter a valid 6-digit code.', 'error');
            return;
        }

        loadingOverlay.classList.add('active');

        verifyOTP(email, otp);
    });

    resendLink.addEventListener('click', function(e) {
        e.preventDefault();
        
        if (this.classList.contains('disabled')) {
            return; 
        }

        loadingOverlay.classList.add('active');

        resendOTP(email);
    });

    const API_BASE = (window.CONFIG && window.CONFIG.API_URL) ? window.CONFIG.API_URL.replace(/\/+$/, '') : '/api';

    async function verifyOTP(email, otp) {
        try {
            const response = await fetch(`${API_BASE}/auth/verify-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', 
                body: JSON.stringify({ email, otp })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                
                if (response.status === 400) {
                    showFeedback(data.message || 'Invalid OTP code. Please try again.', 'error');
                    
                    otpInputs.forEach(input => {
                        input.value = '';
                        input.classList.remove('filled');
                        input.classList.add('shake');
                    });
                    setTimeout(() => {
                        otpInputs.forEach(input => input.classList.remove('shake'));
                        otpInputs[0].focus();
                    }, 500);
                } else if (response.status === 410) {
                    showFeedback(data.message || 'OTP code has expired. Please request a new one.', 'error');
                } else {
                    showFeedback(data.message || 'Verification failed. Please try again.', 'error');
                }
                return;
            }
            
            if (data.success) {

                showFeedback(data.message || 'Email verified successfully! Redirecting to login...', 'success');

                localStorage.removeItem('otpVerificationEmail');

                setTimeout(() => {
                    window.location.href = 'user_login.html?verified=success';
                }, 2000);
            } else {
                
                showFeedback(data.message || 'Verification failed. Please try again.', 'error');
                
                otpInputs.forEach(input => {
                    input.value = '';
                    input.classList.remove('filled');
                });
                otpInputs[0].focus();
            }
        } catch (error) {
            console.error('OTP verification error:', error);
            showFeedback('Unable to connect to server. Please check your connection and try again.', 'error');
        } finally {
            loadingOverlay.classList.remove('active');
        }
    }

    async function resendOTP(email) {
        try {
            const response = await fetch(`${API_BASE}/auth/resend-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', 
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 429) {
                    showFeedback(data.message || 'Too many resend requests. Please wait 5 minutes.', 'error');
                } else {
                    showFeedback(data.message || 'Failed to resend code. Please try again.', 'error');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            if (data.success) {
                
                otpInputs.forEach(input => {
                    input.value = '';
                    input.classList.remove('filled');
                });

                otpInputs[0].focus();

                startResendTimer(60);

                showFeedback(data.message || 'A new code has been sent to your email.', 'info');
            } else {
                showFeedback(data.message || 'Failed to resend code. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Resend OTP error:', error);
            
            if (!feedbackArea.textContent || !feedbackArea.classList.contains('error')) {
                 showFeedback('Connection error. Please try again.', 'error');
            }
        } finally {
            loadingOverlay.classList.remove('active');
            
            if (resendTimer.textContent === '') {
                 resendLink.innerHTML = '<i class="fas fa-redo"></i> Resend Code';
                 resendLink.classList.remove('disabled');
            }
        }
    }

    function startResendTimer(seconds) {
        let remainingSeconds = seconds;

        resendLink.classList.add('disabled');
        resendTimer.style.display = 'inline';
        resendLink.innerHTML = '<i class="fas fa-redo"></i> Resend Code';

        if (window.otpResendTimerInterval) {
            clearInterval(window.otpResendTimerInterval);
        }

        window.otpResendTimerInterval = setInterval(() => {
            remainingSeconds--;

            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            resendTimer.textContent = `(${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')})`;

            if (remainingSeconds <= 0) {
                clearInterval(window.otpResendTimerInterval);
                resendTimer.textContent = '';
                resendTimer.style.display = 'none';

                resendLink.classList.remove('disabled');
            }
        }, 1000);
    }

    function showFeedback(message, type) {
        feedbackArea.textContent = message;
        feedbackArea.className = 'feedback';
        feedbackArea.classList.add(type);
        feedbackArea.style.display = 'block';

        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                feedbackArea.style.display = 'none';
            }, 5000);
        }
    }

    startResendTimer(60); 
});
