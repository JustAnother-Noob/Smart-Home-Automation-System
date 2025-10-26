const express = require('express');
const router = express.Router();
const { authenticateOptional } = require('../middleware/auth.middleware');
const { paymentLimiter } = require('../middlewares/enhanced-rate-limiter');
const paymentController = require('../controllers/payment.controller');

router.post('/create-checkout-session', paymentLimiter, authenticateOptional, paymentController.createCheckoutSession);

router.get('/session-status', paymentLimiter, authenticateOptional, paymentController.getSessionStatus);
router.post('/session-status', paymentLimiter, authenticateOptional, paymentController.getSessionStatus);

router.get('/test', paymentController.testPaymentEndpoint);

router.get('/list-checkouts', authenticateOptional, paymentController.listRecentCheckouts);

router.get('/debug-checkout', authenticateOptional, paymentController.debugCheckout);

router.delete('/cleanup-checkouts', paymentController.cleanupOldCheckouts);

router.post('/webhook', express.raw({type: 'application/json'}), paymentController.handleWebhook);

module.exports = router;
