const rateLimit = require('express-rate-limit');
const { createHash } = require('crypto');

const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
const isProduction = process.env.NODE_ENV === 'production';

const blockedIPs = new Map();
const suspiciousIPs = new Map();

const getRealIP = (req) => {

    if (req.headers['cloudfront-viewer-address']) {
        const viewerAddress = req.headers['cloudfront-viewer-address'];
        
        return viewerAddress.split(':')[0];
    }

    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {

        return forwardedFor.split(',')[0].trim();
    }

    if (req.headers['cloudfront-viewer-address']) {
        return req.headers['cloudfront-viewer-address'].split(':')[0];
    }

    if (req.headers['x-real-ip']) {
        return req.headers['x-real-ip'];
    }

    return req.ip || req.connection.remoteAddress || 'unknown';
};

const generateKey = (req, prefix = '') => {
    const ip = getRealIP(req); 
    const userAgent = req.get('User-Agent') || 'unknown';
    const userId = req.user?.id || 'anonymous';

    console.log(`🔍 [RATE LIMIT DEBUG] Prefix: ${prefix} | IP: ${ip} | User: ${userId}`);
    console.log(`🔍 [HEADERS] CloudFront-Viewer-Address: ${req.headers['cloudfront-viewer-address']}`);
    console.log(`🔍 [HEADERS] X-Forwarded-For: ${req.headers['x-forwarded-for']}`);
    console.log(`🔍 [HEADERS] X-Real-IP: ${req.headers['x-real-ip']}`);
    console.log(`🔍 [HEADERS] req.ip: ${req.ip}`);
    console.log(`🔍 [PATH] ${req.method} ${req.path}`);

    const keyData = `${prefix}_${ip}_${userId}`;
    return createHash('md5').update(keyData).digest('hex');
};

const isIPBlocked = (req) => {
    const ip = getRealIP(req); 
    const blocked = blockedIPs.get(ip);
    
    if (!blocked) return false;
    
    const now = Date.now();
    if (blocked.expires <= now) {
        blockedIPs.delete(ip);
        return false;
    }
    
    return true;
};

const markSuspicious = (req, reason) => {
    const ip = getRealIP(req); 
    const now = Date.now();
    
    const suspicious = suspiciousIPs.get(ip) || { count: 0, firstSeen: now, lastSeen: now, reasons: [] };
    suspicious.count++;
    suspicious.lastSeen = now;
    suspicious.reasons.push({ reason, timestamp: now });

    if (suspicious.reasons.length > 10) {
        suspicious.reasons = suspicious.reasons.slice(-10);
    }
    
    suspiciousIPs.set(ip, suspicious);

    if (suspicious.count >= 3) { 
        const blockDuration = Math.min(suspicious.count * 5 * 60 * 1000, 24 * 60 * 60 * 1000); 
        blockedIPs.set(ip, {
            expires: now + blockDuration,
            reason: `Multiple suspicious activities: ${suspicious.reasons.map(r => r.reason).join(', ')}`,
            count: suspicious.count
        });
        
        console.warn(`🚫 IP ${ip} blocked for ${blockDuration / 1000 / 60} minutes due to suspicious activity`);
    }
};

const createEnhancedRateLimit = (options) => {
    const {
        windowMs = 15 * 60 * 1000, 
        max = 100,
        message = 'Too many requests from this IP, please try again later',
        keyGenerator = (req) => generateKey(req),
        skip = () => false,
        onLimitReached = null,
        blockDuration = 1 * 60 * 1000, 
        ...otherOptions
    } = options;

    return rateLimit({
        windowMs,
        max: isDevelopment ? max * 2 : max, 
        message: {
            success: false,
            message,
            errorType: 'rate_limit_exceeded',
            retryAfter: Math.ceil(windowMs / 1000)
        },
        keyGenerator,
        skip: (req) => {
            
            if (isIPBlocked(req)) {
                return true;
            }
            return skip(req);
        },
        handler: (req, res, next, options) => {
            const ip = getRealIP(req); 

            console.warn(`🚨 [RATE LIMIT TRIGGERED] IP: ${ip} | Path: ${req.method} ${req.path} | Limit: ${options.max}`);
            console.warn(`🚨 [HEADERS AT BLOCK] CloudFront-Viewer-Address: ${req.headers['cloudfront-viewer-address']}`);
            console.warn(`🚨 [HEADERS AT BLOCK] X-Forwarded-For: ${req.headers['x-forwarded-for']}`);
            console.warn(`🚨 [HEADERS AT BLOCK] req.ip: ${req.ip}`);

            markSuspicious(req, `Rate limit exceeded: ${req.method} ${req.path}`);

            if (onLimitReached) {
                onLimitReached(req, res, options);
            }
            
            res.status(options.statusCode).json({
                success: false,
                message,
                errorType: 'rate_limit_exceeded',
                retryAfter: Math.ceil(windowMs / 1000)
            });
        },
        standardHeaders: true,
        legacyHeaders: false,
        ...otherOptions
    });
};

const generalApiLimiter = createEnhancedRateLimit({
    windowMs: 15 * 60 * 1000, 
    max: isDevelopment ? 10 : 5, 
    message: 'Too many API requests from this IP, please try again later',
    keyGenerator: (req) => generateKey(req, 'api'),
    blockDuration: 1 * 60 * 1000, 
});

const authLimiter = createEnhancedRateLimit({
    windowMs: 15 * 60 * 1000, 
    max: isDevelopment ? 5 : 3, 
    message: 'Too many authentication attempts, please try again later',
    keyGenerator: (req) => generateKey(req, 'auth'),
    blockDuration: 1 * 60 * 1000, 
    onLimitReached: (req) => {
        console.warn(`🚨 Multiple auth attempts from IP: ${req.ip}`);
    }
});

const otpLimiter = createEnhancedRateLimit({
    windowMs: 60 * 1000, 
    max: isDevelopment ? 3 : 2, 
    message: 'Too many OTP requests, please wait before trying again',
    keyGenerator: (req) => generateKey(req, 'otp'),
    blockDuration: 1 * 60 * 1000, 
});

const passwordResetLimiter = createEnhancedRateLimit({
    windowMs: 60 * 60 * 1000, 
    max: isDevelopment ? 3 : 2, 
    message: 'Too many password reset attempts, please try again later',
    keyGenerator: (req) => generateKey(req, 'password_reset'),
    blockDuration: 1 * 60 * 1000, 
});

const adminLimiter = createEnhancedRateLimit({
    windowMs: 5 * 60 * 1000, 
    max: isDevelopment ? 10 : 5, 
    message: 'Too many admin requests, please slow down',
    keyGenerator: (req) => generateKey(req, 'admin'),
    skip: (req) => !req.user || req.user.role !== 'admin',
    blockDuration: 1 * 60 * 1000, 
});

const adminLoginLimiter = createEnhancedRateLimit({
    windowMs: 15 * 60 * 1000, 
    max: isDevelopment ? 3 : 2, 
    message: 'Too many admin login attempts, please try again later',
    keyGenerator: (req) => generateKey(req, 'admin_login'),
    blockDuration: 1 * 60 * 1000, 
    onLimitReached: (req) => {
        console.warn(`🚨 Multiple admin login attempts from IP: ${req.ip}`);
    }
});

const paymentLimiter = createEnhancedRateLimit({
    windowMs: 5 * 60 * 1000, 
    max: isDevelopment ? 5 : 3, 
    message: 'Too many payment requests, please try again later',
    keyGenerator: (req) => generateKey(req, 'payment'),
    blockDuration: 1 * 60 * 1000, 
});

const cartLimiter = createEnhancedRateLimit({
    windowMs: 1 * 60 * 1000, 
    max: isDevelopment ? 8 : 6, 
    message: 'Too many cart operations, please slow down',
    keyGenerator: (req) => generateKey(req, 'cart'),
    blockDuration: 30 * 1000, 
});

const searchLimiter = createEnhancedRateLimit({
    windowMs: 1 * 60 * 1000, 
    max: isDevelopment ? 10 : 5, 
    message: 'Too many search requests, please slow down',
    keyGenerator: (req) => generateKey(req, 'search'),
    blockDuration: 1 * 60 * 1000, 
});

const uploadLimiter = createEnhancedRateLimit({
    windowMs: 5 * 60 * 1000, 
    max: isDevelopment ? 50 : 30, 
    message: 'Too many file uploads, please try again later',
    keyGenerator: (req) => generateKey(req, 'upload'),
    blockDuration: 30 * 1000, 
    skip: (req) => {
        
        if (req.user && req.user.role === 'admin') {
            console.log('🚀 Skipping upload rate limit for admin user:', req.user.email || req.user.username);
            return true;
        }
        return false;
    }
});

const cloudinaryBatchUploadLimiter = createEnhancedRateLimit({
    windowMs: 5 * 60 * 1000, 
    max: isDevelopment ? 50 : 30, 
    message: 'Too many batch image uploads, please try again later',
    keyGenerator: (req) => generateKey(req, 'cloudinary_batch'),
    blockDuration: 30 * 1000, 
    skip: (req) => {
        
        if (req.user && req.user.role === 'admin') {
            console.log('🚀 Skipping rate limit for admin user:', req.user.email || req.user.username);
            return true;
        }
        return false;
    }
});

const sensitiveOperationLimiter = createEnhancedRateLimit({
    windowMs: 5 * 60 * 1000, 
    max: isDevelopment ? 3 : 2, 
    message: 'Too many sensitive operations, please wait before trying again',
    keyGenerator: (req) => generateKey(req, 'sensitive'),
    blockDuration: 1 * 60 * 1000, 
});

const ipBlockingMiddleware = (req, res, next) => {
    
    if (req.user && req.user.role === 'admin') {
        console.log('🚀 Skipping IP blocking for admin user:', req.user.email || req.user.username);
        return next();
    }
    
    if (isIPBlocked(req)) {
        const ip = getRealIP(req); 
        const blocked = blockedIPs.get(ip);
        
        return res.status(429).json({
            success: false,
            message: `IP temporarily blocked: ${blocked.reason}`,
            errorType: 'ip_blocked',
            retryAfter: Math.ceil((blocked.expires - Date.now()) / 1000)
        });
    }
    
    next();
};

const cleanupExpiredEntries = () => {
    const now = Date.now();

    for (const [ip, blocked] of blockedIPs.entries()) {
        if (blocked.expires <= now) {
            blockedIPs.delete(ip);
        }
    }

    for (const [ip, suspicious] of suspiciousIPs.entries()) {
        if (now - suspicious.lastSeen > 24 * 60 * 60 * 1000) {
            suspiciousIPs.delete(ip);
        }
    }
};

setInterval(cleanupExpiredEntries, 60 * 60 * 1000);

const getBlockedIPs = () => {
    const now = Date.now();
    const activeBlocks = [];
    
    for (const [ip, blocked] of blockedIPs.entries()) {
        if (blocked.expires > now) {
            activeBlocks.push({
                ip,
                reason: blocked.reason,
                expires: new Date(blocked.expires),
                timeRemaining: Math.ceil((blocked.expires - now) / 1000)
            });
        }
    }
    
    return activeBlocks;
};

const unblockIP = (ip) => {
    blockedIPs.delete(ip);
    suspiciousIPs.delete(ip);
    return true;
};

const clearAllBlocks = () => {
    const blockedCount = blockedIPs.size;
    const suspiciousCount = suspiciousIPs.size;
    blockedIPs.clear();
    suspiciousIPs.clear();
    return { blockedCount, suspiciousCount };
};

module.exports = {
    
    generalApiLimiter,
    authLimiter,
    otpLimiter,
    passwordResetLimiter,
    adminLimiter,
    adminLoginLimiter,
    paymentLimiter,
    cartLimiter,
    searchLimiter,
    uploadLimiter,
    cloudinaryBatchUploadLimiter,
    sensitiveOperationLimiter,

    ipBlockingMiddleware,

    getBlockedIPs,
    unblockIP,
    clearAllBlocks,
    isIPBlocked,
    markSuspicious,

    apiLimiter: generalApiLimiter,
    adminApiLimiter: adminLimiter,
    adminSensitiveLimiter: sensitiveOperationLimiter
};
