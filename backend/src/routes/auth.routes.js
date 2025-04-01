const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { signupLimiter } = require('../middlewares/rateLimit');
const { validateRecaptcha } = require('../middlewares/validators');


router.post('/signup', signupLimiter, validateRecaptcha, authController.signup);
router.post('/verify-otp', authController.verifyOTP);

module.exports = router;