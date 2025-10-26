const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/auth.middleware');
const { logAdminAction, enhancedAdminProtection } = require('../middlewares/audit.middleware');
const { adminApiLimiter, adminSensitiveLimiter } = require('../middlewares/admin.rate.limiter');

const {
  getSettings,
  updateSettings,
  updateAdminPassword
} = require('../controllers/settings.controller');

router.use(requireAuth, requireAdmin, enhancedAdminProtection, adminApiLimiter);

router.get('/', logAdminAction('VIEW_SETTINGS'), getSettings);

router.put('/', adminSensitiveLimiter, logAdminAction('UPDATE_SETTINGS'), updateSettings);

router.put('/password', adminSensitiveLimiter, logAdminAction('UPDATE_ADMIN_PASSWORD'), updateAdminPassword);

module.exports = router;
