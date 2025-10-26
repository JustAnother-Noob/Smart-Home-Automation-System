const express = require('express');
const router = express.Router();
const {
  getCustomerInfo,
  updateCustomerInfo,
  validateCustomerInfo,
  updateShippingMethod,
  getCheckoutSummary
} = require('../controllers/checkout.controller');
const { authenticateOptional } = require('../middleware/auth.middleware'); 
const { generalApiLimiter } = require('../middlewares/enhanced-rate-limiter');

console.log('🛣️ Loading checkout routes...');

router.use(generalApiLimiter);
router.use(authenticateOptional);

router.get('/customer-info', getCustomerInfo);
router.put('/customer-info', updateCustomerInfo);
router.post('/validate-customer', validateCustomerInfo);

router.put('/shipping-method', updateShippingMethod);

router.get('/summary', getCheckoutSummary);

console.log('✅ Checkout routes loaded');

module.exports = router;
