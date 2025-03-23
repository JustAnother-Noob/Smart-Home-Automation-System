const rateLimit = require('express-rate-limit');

const resendLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 3,
    message: {
        success: false,
        message: 'Too many resend requests. Please wait 5 minutes.'
    },
    standardHeaders: true
});

module.exports = resendLimiter;