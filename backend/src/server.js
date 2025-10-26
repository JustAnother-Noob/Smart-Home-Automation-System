
const express = require('express'); 
const cors = require('cors'); 
const cookieParser = require('cookie-parser'); 
const csrf = require('csurf'); 
const path = require('path');
const fs = require('fs');
const { PORT, CLIENT_URL } = require('./config/constants'); 
const connectDB = require('./config/database'); 

const authRoutes = require('./routes/auth.routes'); 
const productRoutes = require('./routes/product.routes'); 
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/admin.routes');
const couponRoutes = require('./routes/coupon.routes'); 
const orderRoutes = require('./routes/order.routes'); 
const cartRoutes = require('./routes/cart.routes'); 
const checkoutRoutes = require('./routes/checkout.routes'); 
const installationRoutes = require('./routes/installation.routes');
const shippingRoutes = require('./routes/shipping.routes'); 
const paymentRoutes = require('./routes/payment.routes'); 
const networkLogRoutes = require('./routes/networkLog.routes'); 
const rateLimitAdminRoutes = require('./routes/rate-limit-admin.routes'); 
const mainRoutes = require('./routes/index'); 
const { networkLoggingMiddleware } = require('./middlewares/networkLogging.middleware'); 
const startScheduler = require('./scheduler/jobScheduler');

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = new Set([
      CLIENT_URL || 'http://127.0.0.1:5500',
      'http://127.0.0.1:5500',
      'http://localhost:5500',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://smart-living-tech-c168758d73be.herokuapp.com',
      'https://dymuivii8x3n4.cloudfront.net', 
      'https://njppphf8zg.execute-api.ap-southeast-2.amazonaws.com',
      'https://smartlivingtech.me', 
      'https://www.smartlivingtech.me', 
      'null'
    ]);

    if (
      allowedOrigins.has(origin) ||
      /^https?:\/\/localhost:\d+$/.test(origin) ||
      /^https?:\/\/127\.0\.0\.1:\d+$/.test(origin) ||
      /\.herokuapp\.com$/.test(origin) ||
      /\.cloudfront\.net$/.test(origin) || 
      /smartlivingtech\.me$/.test(origin) 
    ) {
      return callback(null, true);
    }

    console.warn(`Blocked CORS request from origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true, 
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-session-id', 'X-CSRF-Token'],
  exposedHeaders: ['X-Session-ID'] 
}));

const frontendHtmlDir = path.join(__dirname, '../../frontend/html');
const frontendAdminDir = path.join(__dirname, '../../frontend/html_admin');

app.use('/css', express.static(path.join(__dirname, '../../frontend/css'), {
  maxAge: '1y',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

app.use('/js', express.static(path.join(__dirname, '../../frontend/js'), {
  maxAge: '1y',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

app.use('/assets', express.static(path.join(__dirname, '../../frontend/assets'), {
  maxAge: '1y',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

app.use(express.static(frontendHtmlDir, {
  maxAge: '1h',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
}));

app.use(express.static(frontendAdminDir, {
  maxAge: '1h',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendHtmlDir, 'user_index.html'));
});

app.use(express.json());
app.use(cookieParser()); 

app.set('trust proxy', true);

app.use(networkLoggingMiddleware);

const { ipBlockingMiddleware } = require('./middlewares/enhanced-rate-limiter');
app.use(ipBlockingMiddleware);

const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

let csrfProtection = null;
if (!isDevelopment) {
  csrfProtection = csrf({
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    }
  });
}

const conditionalCSRF = (req, res, next) => {
  if (isDevelopment) {
    console.log('CSRF disabled for development mode');
    return next();
  }
  if (csrfProtection) {
    return csrfProtection(req, res, next);
  }
  next();
};

app.use('/api/auth/login', conditionalCSRF);
app.use('/api/auth/admin/login', conditionalCSRF);
app.use('/api/auth/signup', conditionalCSRF);
app.use('/api/auth/forgot-password', conditionalCSRF);
app.use('/api/auth/reset-password', conditionalCSRF);
app.use('/api/users', conditionalCSRF);

app.get('/api/csrf-token', (req, res) => {
  if (isDevelopment) {
    return res.json({ csrfToken: 'dev-mode-no-csrf', development: true });
  }
  if (csrfProtection) {
    return csrfProtection(req, res, () => {
      res.json({ csrfToken: req.csrfToken() });
    });
  }
  res.json({ csrfToken: 'csrf-disabled' });
});

const uploadsDir = path.join(__dirname, '../uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`Created uploads directory at: ${uploadsDir}`);
  }
} catch (e) {
  console.warn('Warning: could not ensure uploads directory exists:', e.message);
}
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes); 
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes); 
app.use('/api/cart', cartRoutes); 
app.use('/api/checkout', checkoutRoutes); 
app.use('/api/shipping', shippingRoutes); 
app.use('/api/payment', paymentRoutes); 
app.use('/api/admin/coupons', couponRoutes); 
app.use('/api/admin', adminRoutes); 
app.use('/api/installations', installationRoutes);
app.use('/api/network-logs', networkLogRoutes); 
app.use('/api/admin/rate-limits', rateLimitAdminRoutes); 
app.use('/api', mainRoutes); 

app.use('/api/*', (req, res) => {
  return res.status(404).json({ success: false, message: 'API endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token has expired - Please login again'
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token - Please login again'
    });
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

if (process.env.NODE_ENV === 'development') {
  console.log('🛣️ Available API routes:');
  console.log('  GET    /api/health');
  console.log('  POST   /api/auth/login');
  console.log('  POST   /api/auth/register');
  console.log('  GET    /api/products');
  console.log('  GET    /api/cart');
  console.log('  POST   /api/cart/items');
  console.log('  GET    /api/checkout/customer-info');
  console.log('  PUT    /api/checkout/customer-info');
  console.log('  POST   /api/checkout/validate-customer');
  console.log('  GET    /api/users/profile');
  console.log('  PUT    /api/users/profile');
  console.log('  GET    /api/users/addresses');
}

connectDB()
  .then(() => {
    startScheduler();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Fatal: could not connect to MongoDB', err);
    process.exit(1);
  });
