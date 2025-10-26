const { ResponseUtils } = require('../utils');

const logAdminAction = (action) => {
    return (req, res, next) => {
        
        const originalJson = res.json;

        res.json = function(data) {
            
            const logData = {
                timestamp: new Date().toISOString(),
                adminId: req.user?.id,
                adminEmail: req.user?.email,
                action: action,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent'),
                success: data?.success !== false,
                targetUserId: req.params?.id || req.body?.userId,
                requestBody: req.method !== 'GET' ? JSON.stringify(req.body) : null
            };

            console.log(`[ADMIN_AUDIT] ${JSON.stringify(logData)}`);

            return originalJson.call(this, data);
        };
        
        next();
    };
};

const enhancedAdminProtection = (req, res, next) => {
    
    if (!req.user || req.user.role !== 'admin') {
        console.log(`[ADMIN_ACCESS_DENIED] IP: ${req.ip}, User: ${req.user?.email || 'anonymous'}, URL: ${req.originalUrl}`);
        return ResponseUtils.forbidden(res, 'Admin access required');
    }

    console.log(`[ADMIN_ACCESS] ${req.user.email} accessed ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
    
    next();
};

module.exports = { logAdminAction, enhancedAdminProtection };
