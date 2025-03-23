const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateRecaptcha } = require('../utils/validators');
const { resendLimiter } = require('../middleware/rateLimit');
const { signupLimiter } = require('../middleware/rateLimit');

// POST /api/auth/signup
console.log('validateRecaptcha:', validateRecaptcha);
router.post('/signup', signupLimiter, validateRecaptcha, authController.signup);

// routes/authRoutes.js
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', resendLimiter, authController.resendOTP);

router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-otp', authController.verifyResetOTP);
router.post('/reset-password', authController.resetPassword);
// POST /api/auth/login
router.post('/login', authController.login);

module.exports = router;