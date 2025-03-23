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

const signupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 signup requests per window
    message: {
        success: false,
        message: 'Too many signup attempts. Please try again later.'
    },
    handler: (req, res, next) => {
        res.status(429).json({
            success: false,
            message: 'Too many attempts. Please try again later.'
        });
    }
});

module.exports = { resendLimiter, signupLimiter };