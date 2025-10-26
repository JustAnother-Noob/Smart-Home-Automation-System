import express from 'express';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import bodyParser from 'body-parser';
import cors from 'cors';
import passport from 'passport';
import './config/passport.js';
import userRoutes from './routes/user.routes.js';
import productRoutes from './routes/product.routes.js';
import orderRoutes from './routes/order.routes.js';
import cartRoutes from './routes/cart.routes.js';
import { notFound, errorHandler } from './middlewares/error.middleware.js';
const { networkLoggingMiddleware } = require('./middlewares/networkLogging.middleware');

const app = express();

app.set('trust proxy', true);

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    maxAge: 24 * 60 * 60 * 1000 
  }
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5500')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

console.log('CORS allowed origins:', allowedOrigins);

app.use(cors({
  origin: function(origin, callback) {
    
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      console.log('✅ CORS allowing origin:', origin);
      callback(null, true);
    } else {
      console.warn('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['X-Session-ID'],  
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'X-Requested-With']
}));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log(`🌐 [DEBUG] Request origin: ${origin || 'NO ORIGIN'}, Allowed origins:`, allowedOrigins);
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'X-Session-ID');
    console.log(`🔒 [CORS] Set expose headers for origin: ${origin}`);
  } else if (origin) {
    console.warn(`⚠️ [CORS] Origin ${origin} not in allowed list`);
  }
  next();
});

app.use(passport.initialize());
app.use(passport.session());

app.use(networkLoggingMiddleware);

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const adminRoutes = require('./routes/admin.routes');
const productRoutes = require('./routes/product.routes');
const categoryRoutes = require('./routes/category.routes');
const brandRoutes = require('./routes/brand.routes');
const cartRoutes = require('./routes/cart.routes');
const couponRoutes = require('./routes/coupon.routes');
const checkoutRoutes = require('./routes/checkout.routes');
const paymentRoutes = require('./routes/payment.routes');
const shippingRoutes = require('./routes/shipping.routes');
const networkLogRoutes = require('./routes/networkLog.routes');
const installationRoutes = require('./routes/installation.routes');

console.log('Setting up routes...');
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/network-logs', networkLogRoutes);
app.use('/api/installations', installationRoutes);

app.use('/api/test', require('./routes/test.routes'));

if (process.env.NODE_ENV === 'development') {
  app.use('/api*', (req, res, next) => {
    console.log(`Route: ${req.method} ${req.originalUrl}`);
    next();
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;