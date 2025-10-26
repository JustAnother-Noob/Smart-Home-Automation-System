

const express = require('express');
const router = express.Router();

const installationController = require('../controllers/installation.controller');

const { requireAuth, requireAdmin, optionalAuth } = require('../middlewares/auth.middleware');

router.get(
  '/available',
  requireAuth, 
  installationController.getAvailableInstallations
);

router.post(
  '/book',
  optionalAuth, 
  installationController.bookInstallation
);

router.get(
  '/my-installations',
  requireAuth,
  installationController.getUserInstallations
);

router.get(
  '/',
  requireAuth,
  requireAdmin,
  installationController.getAllInstallations
);

router.get(
  '/:id',
  requireAuth,
  requireAdmin,
  installationController.getInstallation
);

router.post(
  '/',
  requireAuth,
  requireAdmin,
  installationController.createInstallation
);

router.put(
  '/:id',
  requireAuth,
  requireAdmin,
  installationController.updateInstallation
);

router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  installationController.deleteInstallation
);

router.patch(
  '/confirm/:id',
  requireAuth,
  requireAdmin,
  installationController.confirmInstallation
);

module.exports = router;
