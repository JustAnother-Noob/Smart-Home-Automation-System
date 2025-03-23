const tempEmail = require('disposable-email-domains'); // to check for disposable email
const disposableEmails = new Set(tempEmail);


// Validating email
const validateEmail = (email) => {

    // Check email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return false;
    }

    // Get domain from email and compare to disposable emails list
    const domain = email.split('@')[1].toLowerCase();
    return !disposableEmails.has(domain);
};

// ********************** Validate password *******************************
const validatePassword = (password) => {
    const requirements = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
    return {
        valid: Object.values(requirements).every(Boolean),
        requirements
    };
};

const axios = require('axios');
const { RECAPTCHA_SECRET_KEY } = require('../config/constants');

const validateRecaptcha = async (req, res, next) => {
    try {
        const { recaptchaToken } = req.body;
        
        if (!recaptchaToken) {
            console.log('No reCAPTCHA token received');
            return res.status(400).json({ /* ... */ });
        }

        const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`;
        
        const response = await axios.post(verificationURL);
        console.log('reCAPTCHA Verification Response:', response.data);

        const { success, hostname } = response.data;

        if (!success) {
            console.log('reCAPTCHA Verification Failed:', response.data);
            return res.status(403).json({ /* ... */ });
        }

        next();
    } catch (error) {
        console.error('reCAPTCHA validation error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Security check failed' 
        });
    }
};

module.exports = { validateEmail, validatePassword, validateRecaptcha };
