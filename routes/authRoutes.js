const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/signup
router.post('/signup', authController.signup);

// GET /api/auth/verify-email
router.get('/verify-email', authController.verifyEmail);

// POST /api/auth/resend-verification
router.post('/resend-verification', authController.resendVerification);

// POST /api/auth/login
router.post('/login', authController.login);

module.exports = router;