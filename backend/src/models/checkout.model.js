const mongoose = require('mongoose');

const checkoutSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false 
  },
  sessionId: {
    type: String,
    required: false 
  },
  
  cartItems: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: { type: String, required: true }, 
    price: { type: Number, required: true }, 
    quantity: { type: Number, required: true, min: 1 },
    total: { type: Number, required: true } 
  }],
  
  pricing: {
    subtotal: { type: Number, required: true, default: 0 },
    discountAmount: { type: Number, default: 0 },
    shippingCost: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 }, 
    total: { type: Number, required: true, default: 0 }
  },
  
  appliedCoupon: {
    code: String,
    discountType: { type: String, enum: ['%', '$'] },
    discountValue: Number,
    discountAmount: Number,
    appliedAt: { type: Date, default: Date.now }
  },
  customerInfo: {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true }
  },
  shippingAddress: {
    street: { type: String, required: true, trim: true },
    apartmentSuite: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    zipCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: 'Australia' }
  },
  shippingMethod: {
    type: String,
    enum: ['standard', 'express', 'overnight'],
    default: 'standard'
  },
  shippingCost: { type: Number, default: 0 },
  paymentMethod: {
    type: String,
    enum: ['stripe', 'paypal', 'cod'],
    required: false 
  },
  stripeSessionId: String, 
  paymentIntentId: String, 
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: false
  },
  completedAt: Date,
  billingAddress: {
    street: String,
    apartmentSuite: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'Australia' },
    sameAsShipping: { type: Boolean, default: true }
  },
  status: {
    type: String,
    enum: ['draft', 'payment_pending', 'payment_confirmed', 'completed', 'expired'],
    default: 'draft'
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 60 * 1000), 
    expires: 0
  }
}, {
  timestamps: true
});

checkoutSchema.index({ userId: 1, status: 1 });
checkoutSchema.index({ sessionId: 1, status: 1 });
checkoutSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

checkoutSchema.pre('validate', function(next) {
  if (!this.userId && !this.sessionId) {
    const error = new Error('Either userId or sessionId must be provided');
    return next(error);
  }
  next();
});

module.exports = mongoose.model('Checkout', checkoutSchema);
