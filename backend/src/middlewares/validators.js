const { RECAPTCHA } = require('../config/constants');
const axios = require('axios');

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

const validateRecaptcha = async (req, res, next) => {
  try {
    const { recaptchaToken } = req.body;
    if (!recaptchaToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'reCAPTCHA token required' 
      });
    }

    const response = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA.secretKey}&response=${recaptchaToken}`
    );

    if (!response.data.success) {
      return res.status(403).json({ 
        success: false, 
        message: 'reCAPTCHA validation failed' 
      });
    }

    next();
  } catch (error) {
    console.error('reCAPTCHA error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error verifying reCAPTCHA' 
    });
  }
};

const validateLogin = (req, res, next) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }
    
    next();
  };
    

module.exports = { validatePassword, validateRecaptcha,validateLogin };