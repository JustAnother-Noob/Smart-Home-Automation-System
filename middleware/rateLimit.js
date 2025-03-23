const rateLimit = require('express-rate-limit');

const resendLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit to 3 attempts
    message: {
        success: false,
        message: 'Too many resend requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = { resendLimiter };