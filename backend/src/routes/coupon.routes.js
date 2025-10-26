const express = require('express');
const router = express.Router();

const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
const couponController = require('../controllers/coupon.controller');

router.use(requireAuth, requireAdmin);

router.post('/', couponController.createCoupon);

router.get('/', couponController.getCoupons);

router.get('/:id', couponController.getCouponById);

router.put('/:id', couponController.updateCoupon);

router.delete('/:id', couponController.deleteCoupon);

module.exports = router;
