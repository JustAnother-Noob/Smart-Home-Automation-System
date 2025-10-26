const verifyOtpForm = document.getElementById('verifyOtpForm');
const otpInput = document.getElementById('otp');
const otpError = document.getElementById('otpError');
const statusMessage = document.getElementById('statusMessage');
const loadingOverlay = document.getElementById('loadingOverlay');
const submitButton = verifyOtpForm.querySelector('button[type="submit"]');
const emailDisplay = document.getElementById('userEmailDisplay');
const resendLink = document.getElementById('resendOtpLink');
const timerDisplay = document.getElementById('timer');
const timerContainer = document.getElementById('timerContainer');

const API_BASE = window.CONFIG?.API_URL || '/api';

const urlParams = new URLSearchParams(window.location.search);
const email = urlParams.get('email');

let timerInterval = null;
let countdown = 60; 

if (email) {
    emailDisplay.textContent = email;
} else {
    emailDisplay.textContent = 'your email';
    showStatusMessage('Email address missing. Cannot proceed.', 'error');
    if (submitButton) submitButton.disabled = true;
    resendLink.classList.add('disabled'); 
}

const showStatusMessage = (message, type = 'error') => {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
};

const clearStatusMessage = () => {
    statusMessage.style.display = 'none';
    statusMessage.textContent = '';
};

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

async function handleResendOtp() {
    if (resendLink.classList.contains('disabled') || !email) {
        return; 
    }

    console.log('Resending OTP to:', email);
    clearStatusMessage();
    resendLink.textContent = 'Sending...'; 
    resendLink.classList.add('disabled'); 

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
            showStatusMessage('New reset code sent successfully!', 'success');
            startTimer(); 
        } else {
            showStatusMessage(data.message || 'Failed to resend code.', 'error');
            
            if (response.status !== 404) { 
                startTimer();
            } else {
                resendLink.classList.remove('disabled'); 
                resendLink.textContent = 'Resend Code';
                timerContainer.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Resend OTP Error:', error);
        showStatusMessage('An error occurred while resending. Please try again.', 'error');
        resendLink.classList.remove('disabled');
        resendLink.textContent = 'Resend Code';
        timerContainer.style.display = 'none'; 
    }
}

resendLink.addEventListener('click', (event) => {
    event.preventDefault(); 
    handleResendOtp();
});

verifyOtpForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatusMessage();
    otpError.textContent = '';

    const otp = document.getElementById('otp').value.trim();

    if (!/^\d{6}$/.test(otp)) {
        otpError.textContent = 'Please enter the complete 6-digit code.';
        
        document.querySelectorAll('.otp-input').forEach(input => {
            if (!input.value) input.style.borderColor = 'red';
        });
        return;
    } else {
        document.querySelectorAll('.otp-input').forEach(input => {
            input.style.borderColor = ''; 
        });
    }

    if (!email) {
        showStatusMessage('Email address is missing. Cannot verify OTP.', 'error');
        return;
    }

    loadingOverlay.classList.add('active');
    submitButton.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/auth/verify-reset-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email: email.toLowerCase(), otp })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            clearInterval(timerInterval); 
            showStatusMessage('Code verified successfully! Redirecting to reset password...', 'success');
            
            setTimeout(() => {
                window.location.href = `reset-password.html?email=${encodeURIComponent(email.toLowerCase())}&otp=${otp}`;
            }, 2000);
        } else {
            
            showStatusMessage(data.message || 'Invalid or expired code.', 'error');
            
            document.querySelectorAll('.otp-input').forEach(input => input.value = '');
            
            const hiddenOtp = document.getElementById('otp');
            if (hiddenOtp) hiddenOtp.value = '';

            if (document.querySelectorAll('.otp-input').length > 0) {
                document.querySelectorAll('.otp-input')[0].focus(); 
            }
            submitButton.disabled = false;
        }
    } catch (error) {
        console.error('Verify OTP Error:', error);
        showStatusMessage('An error occurred during verification. Please try again.', 'error');
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

if (email) {
    startTimer();
}
