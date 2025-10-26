const crypto = require('crypto');
const { ResponseUtils } = require('../utils');

const generateCSRFToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

const setCSRFToken = (req, res, next) => {
    try {
        
        if (!req.session.csrfToken) {
            req.session.csrfToken = generateCSRFToken();
        }

        res.cookie('csrfToken', req.session.csrfToken, {
            httpOnly: false, 
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 
        });
        
        next();
    } catch (error) {
        console.error('CSRF token generation error:', error);
        return ResponseUtils.error(res, 'Security token generation failed', 500);
    }
};

const validateCSRFToken = (req, res, next) => {
    try {
        
        if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
            return next();
        }

        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
            console.log('🔓 CSRF validation skipped for development environment');
            return next();
        }
        
        const sessionToken = req.session.csrfToken;
        const headerToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
        const bodyToken = req.body.csrfToken;
        
        if (!sessionToken) {
            return ResponseUtils.error(res, 'CSRF session token missing', 403);
        }
        
        const clientToken = headerToken || bodyToken;
        
        if (!clientToken) {
            return ResponseUtils.error(res, 'CSRF token required for this operation', 403);
        }

        if (!crypto.timingSafeEqual(Buffer.from(sessionToken), Buffer.from(clientToken))) {
            return ResponseUtils.error(res, 'Invalid CSRF token', 403);
        }
        
        console.log('✅ CSRF token validated successfully');
        next();
    } catch (error) {
        console.error('CSRF validation error:', error);
        return ResponseUtils.error(res, 'CSRF validation failed', 403);
    }
};

module.exports = {
    generateCSRFToken,
    setCSRFToken,
    validateCSRFToken
};
