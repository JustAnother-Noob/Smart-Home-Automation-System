const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const { ResponseUtils } = require('../utils');

const requireAuth = (req, res, next) => {
    if (req.method === 'OPTIONS') {
        return next();
    }
    try {
        let token = null;

        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }

        if (!token && req.cookies && req.cookies.authToken) {
            token = req.cookies.authToken;
        }

        if (!token) {
            return ResponseUtils.unauthorized(res, 'Authentication required - No token provided');
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        if (!decoded.id || !decoded.email || !decoded.role) {
            return ResponseUtils.unauthorized(res, 'Invalid token payload');
        }
        
        console.log("User authenticated:", { id: decoded.id, email: decoded.email, role: decoded.role });

        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            firstName: decoded.firstName,
            lastName: decoded.lastName
        };
        
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);

        let errorMessage = 'Invalid or expired token';
        let statusCode = 401;
        
        if (error.name === 'TokenExpiredError') {
            errorMessage = 'Token has expired - Please login again';
        } else if (error.name === 'JsonWebTokenError') {
            errorMessage = 'Invalid token format - Please login again';
        } else if (error.name === 'NotBeforeError') {
            errorMessage = 'Token not active yet';
        } else if (error.message.includes('JWT_SECRET')) {
            errorMessage = 'Server configuration error';
            statusCode = 500;
        }
        
        return ResponseUtils.error(res, errorMessage, statusCode);
    }
};

const optionalAuth = (req, res, next) => {
    try {
        let token = null;
        const authHeader = req.headers.authorization;
        
        console.log('🔍 [optionalAuth] Checking for token:', {
            hasAuthHeader: !!authHeader,
            authHeaderValue: authHeader ? authHeader.substring(0, 20) + '...' : 'none',
            hasCookie: !!(req.cookies && req.cookies.authToken)
        });
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
            console.log('✅ [optionalAuth] Token found in header');
        }
        if (!token && req.cookies && req.cookies.authToken) {
            token = req.cookies.authToken;
            console.log('✅ [optionalAuth] Token found in cookie');
        }
        if (!token) {
            console.log('❌ [optionalAuth] No token found, continuing as guest');
            return next();
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded.id) {
            console.log('❌ [optionalAuth] Token has no id, continuing as guest');
            return next();
        }
        
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            firstName: decoded.firstName,
            lastName: decoded.lastName
        };
        
        console.log('✅ [optionalAuth] User authenticated:', {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role
        });
        
        return next();
    } catch (e) {
        
        console.log('⚠️ [optionalAuth] Token verification failed:', e.message);
        return next();
    }
};

const authenticateOptional = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      console.log('🔑 User authenticated via optional middleware:', decoded.id);
    } catch (error) {
      
      console.log('🔓 Invalid/expired token, continuing as guest user');
      req.user = null;
    }
  } else {
    
    req.user = null;
  }
  
  next();
};

const requireAdmin = (req, res, next) => {
    if (req.method === 'OPTIONS') {
        return next();
    }
    if (!req.user || (req.user.role || '').toLowerCase() !== 'admin') {
        return ResponseUtils.forbidden(res, 'Admin access required');
    }
    next();
};

module.exports = { requireAuth, requireAdmin, optionalAuth, authenticateOptional };