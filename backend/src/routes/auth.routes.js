const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validateRecaptcha } = require('../middlewares/validators');
const { 
    authLimiter, 
    otpLimiter, 
    passwordResetLimiter, 
    adminLoginLimiter, 
    sensitiveOperationLimiter 
} = require('../middlewares/enhanced-rate-limiter');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
const { logAdminAction } = require('../middlewares/audit.middleware');
const { securityLoggingMiddleware } = require('../middlewares/networkLogging.middleware');

router.post('/signup', authLimiter, validateRecaptcha, authController.signup);

router.post('/verify-otp', authLimiter, authController.verifyOTP);

router.post('/resend-otp', otpLimiter, authController.resendOTP);

router.post('/login', securityLoggingMiddleware('User Login Attempt'), authLimiter, validateRecaptcha, authController.login);

router.post('/admin/login', securityLoggingMiddleware('Admin Login Attempt'), adminLoginLimiter, authController.login);

router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.post('/verify-reset-otp', authController.verifyResetOTP);
router.post('/reset-password', authController.resetPassword);

router.post('/google', authController.googleSignIn);

router.post('/logout', authController.logout);

router.get('/check-archived', authController.checkArchivedStatus);

router.get('/users', requireAuth, requireAdmin, logAdminAction('VIEW_ALL_USERS'), authController.getAllUsers);
router.get('/users/:id', requireAuth, requireAdmin, logAdminAction('VIEW_USER_DETAILS'), authController.getUserById);
router.put('/users/:id', requireAuth, requireAdmin, sensitiveOperationLimiter, logAdminAction('UPDATE_USER'), authController.updateUser);
router.delete('/users/:id', requireAuth, requireAdmin, sensitiveOperationLimiter, logAdminAction('DELETE_USER'), authController.deleteUser);

router.put('/users/:id/archive', requireAuth, requireAdmin, sensitiveOperationLimiter, logAdminAction('ARCHIVE_USER'), authController.archiveUser);

router.get('/archived-users', requireAuth, requireAdmin, logAdminAction('VIEW_ARCHIVED_USERS'), authController.getArchivedUsers);
router.put('/users/:id/restore', requireAuth, requireAdmin, sensitiveOperationLimiter, logAdminAction('RESTORE_USER'), authController.restoreUser);
router.put('/users/:id/status', requireAuth, requireAdmin, authController.updateUserStatus);

router.get('/debug/check-archive', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email parameter required' });
        }
        
        const archivedUser = await require('../models/archivedUser.model').findOne({ email: email.toLowerCase() });
        
        return res.status(200).json({
            success: true,
            email: email.toLowerCase(),
            isArchived: !!archivedUser,
            archivedDetails: archivedUser ? {
                name: `${archivedUser.firstName} ${archivedUser.lastName}`,
                archivedAt: archivedUser.archivedAt,
                expiryDate: archivedUser.expiryDate
            } : null
        });
    } catch (error) {
        console.error('Debug archive check error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/health', (req, res) => {
    res.status(200).json({ 
        success: true, 
        message: 'Auth API is running'
    });
});

module.exports = router;
