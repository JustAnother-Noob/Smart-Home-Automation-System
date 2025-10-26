const express = require('express');
const router = express.Router();

const { requireAuth, optionalAuth } = require('../middlewares/auth.middleware');
const { loadCart, ensureCart, validateCartItemInput, computeCartTotals, mergeGuestCartIfNeeded } = require('../middlewares/cart.middleware');
const { cartLimiter } = require('../middlewares/enhanced-rate-limiter');
const cartController = require('../controllers/cart.controller');

console.log('🛒 [cart.routes] Cart routes module loaded');
console.log('🛒 [cart.routes] cartController.getCart exists:', typeof cartController.getCart);

router.post('/items', cartLimiter, optionalAuth, validateCartItemInput, cartController.addItem);

router.put('/items/:productId', cartLimiter, optionalAuth, cartController.updateQuantity);

router.delete('/items/:productId', cartLimiter, optionalAuth, cartController.removeItem);

router.post('/apply-coupon', cartLimiter, optionalAuth, cartController.applyCoupon);

router.post('/remove-coupon', cartLimiter, optionalAuth, cartController.removeCoupon);

router.get('/', cartLimiter, optionalAuth, loadCart, computeCartTotals, cartController.getCart);
console.log('✅ [cart.routes] GET / route registered');

router.delete('/', cartLimiter, optionalAuth, cartController.clearCart);

router.post('/merge', requireAuth, cartController.mergeGuestCart);

console.log('🛒 [cart.routes] Total routes registered:', router.stack.length);
console.log('🛒 [cart.routes] Routes:', router.stack.map(r => `${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`));

module.exports = router;
