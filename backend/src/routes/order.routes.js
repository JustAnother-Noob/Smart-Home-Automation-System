const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth.middleware');
const {
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  trackOrder,
  searchOrderById
} = require('../controllers/order.controller');

router.get('/search/:orderId', searchOrderById); 

router.use(requireAuth); 

router.post('/', createOrder);

router.get('/', getUserOrders);

router.get('/:id', getOrderById);

router.put('/:id/cancel', cancelOrder);

router.get('/:id/track', trackOrder);

module.exports = router;
