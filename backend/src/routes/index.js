const express = require('express');
const router = express.Router();
const { getClientIP, classifyIP } = require('../middlewares/networkLogging.middleware');

const authRoutes = require('./auth.routes');
const userRoutes = require('./users.routes');
const productRoutes = require('./product.routes');

const checkoutRoutes = require('./checkout.routes');
const orderRoutes = require('./order.routes');
const contactRoutes = require('./contact.routes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);

router.use('/checkout', checkoutRoutes);
router.use('/orders', orderRoutes);
router.use('/contact', contactRoutes);

router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    routes: [
      '/auth',
      '/users', 
      '/products',
      '/cart',
      '/checkout',
      '/orders',
      '/installations',
      '/contact'
    ]
  });
});

router.get('/test-ip', (req, res) => {
  const ip = getClientIP(req);
  const classification = classifyIP(ip);
  
  res.json({
    success: true,
    data: {
      detectedIP: ip,
      classification,
      headers: {
        'cf-connecting-ip': req.headers['cf-connecting-ip'],
        'x-real-ip': req.headers['x-real-ip'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-client-ip': req.headers['x-client-ip'],
        'x-cluster-client-ip': req.headers['x-cluster-client-ip'],
        'req.ip': req.ip
      },
      connection: {
        remoteAddress: req.connection?.remoteAddress,
        socketRemoteAddress: req.socket?.remoteAddress
      },
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;