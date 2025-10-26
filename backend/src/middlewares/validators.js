const axios = require('axios');
const { RECAPTCHA, NODE_ENV } = require('../config/constants'); 
const { ResponseUtils } = require('../utils');

const validateEmail = (email) => {
    if (!email || typeof email !== 'string') {
        return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
};

const validatePassword = (password) => {
    if (!password || typeof password !== 'string') {
        return {
            valid: false,
            requirements: {
                length: false,
                uppercase: false,
                lowercase: false,
                number: false,
                special: false
            }
        };
    }
    
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

const validateRecaptcha = async (req, res, next) => {
    try {
        
        if (NODE_ENV === 'development' || 
            NODE_ENV === 'test' || 
            RECAPTCHA.skipValidation) {
            console.log('🔓 reCAPTCHA validation skipped for testing environment');
            return next();
        }

        const { recaptchaToken } = req.body;
        
        if (!recaptchaToken) {
            return ResponseUtils.error(res, 'Please complete the security check', 400);
        }

        const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA.secretKey}&response=${recaptchaToken}`;
        
        const response = await axios.post(verificationURL);
        const { success } = response.data;

        if (!success) {
            return ResponseUtils.error(res, 'reCAPTCHA verification failed', 403);
        }

        console.log('✅ reCAPTCHA validation successful');
        next();
    } catch (error) {
        console.error('reCAPTCHA validation error:', error);
        return ResponseUtils.error(res, 'Security verification error');
    }
};

module.exports = { 
    validateEmail, 
    validatePassword, 
    validateRecaptcha 
};