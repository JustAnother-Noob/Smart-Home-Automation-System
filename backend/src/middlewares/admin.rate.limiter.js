const rateLimit = require('express-rate-limit');

const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 20, 
    message: {
        success: false,
        message: 'Too many admin login attempts. Please try again in 15 minutes.',
        errorType: 'rate_limit_exceeded'
    },
    standardHeaders: true,
    legacyHeaders: false,
    
    skipSuccessfulRequests: true,
    
    keyGenerator: (req) => {
        return `admin_login_${req.ip}_${req.body?.email || 'unknown'}`;
    }
});

const adminApiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 100, 
    message: {
        success: false,
        message: 'Too many admin API requests. Please slow down.',
        errorType: 'api_rate_limit'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return `admin_api_${req.user?.id || req.ip}`;
    },
    
    skip: (req) => {
        return !req.user || req.user.role !== 'admin';
    }
});

const adminSensitiveLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, 
    max: 10, 
    message: {
        success: false,
        message: 'Too many sensitive admin operations. Please wait before trying again.',
        errorType: 'sensitive_operation_limit'
    },
    keyGenerator: (req) => {
        return `admin_sensitive_${req.user?.id || req.ip}`;
    }
});

module.exports = {
    adminLoginLimiter,
    adminApiLimiter,
    adminSensitiveLimiter
};
