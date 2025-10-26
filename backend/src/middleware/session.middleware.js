import crypto from 'crypto';

export const sessionMiddleware = (req, res, next) => {
  try {
    
    if (req.user) {
      return next();
    }

    let sessionId = req.headers['x-session-id'] || req.sessionID;
    
    if (!sessionId) {
      
      sessionId = `guest_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

      res.setHeader('X-Session-ID', sessionId);
    }

    req.sessionID = sessionId;
    
    next();
  } catch (error) {
    console.error('Session middleware error:', error);
    next();
  }
};
