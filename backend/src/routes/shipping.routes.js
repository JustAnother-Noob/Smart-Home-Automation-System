const express = require('express');
const router = express.Router();
const { calculateShipping, getShippingZones } = require('../controllers/shipping.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');

router.post('/calculate', calculateShipping);

router.get('/zones', requireAuth, requireAdmin, getShippingZones);

module.exports = router;
