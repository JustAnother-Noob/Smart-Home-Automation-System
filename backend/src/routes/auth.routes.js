const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { signupLimiter } = require('../middlewares/rateLimit');
const { validateRecaptcha } = require('../middlewares/validators');
const { limiter } = require('../middlewares/rateLimit');


router.post('/signup', signupLimiter, validateRecaptcha, authController.signup);
router.post('/verify-otp', authController.verifyOTP);
router.post('/login', limiter, validateRecaptcha, authController.login);
router.get('/logout', authController.logout);


module.exports = router;