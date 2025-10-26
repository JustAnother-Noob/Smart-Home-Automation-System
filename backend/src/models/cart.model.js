const mongoose = require('mongoose');
const crypto = require('crypto');

const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      default: 1
    },
    
    price: {
      type: Number,
      required: true,
      min: [0, 'Price must be >= 0']
    }
  },
  { _id: false, timestamps: false }
);

const cartSchema = new mongoose.Schema(
  {
    
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    sessionId: {
      type: String,
      trim: true
    },
    
    status: {
      type: String,
      enum: ['active', 'ordered', 'abandoned'],
      default: 'active'
    },
    items: {
      type: [cartItemSchema],
      default: []
    },
    
    guestExpiresAt: {
      type: Date
    },
    
    appliedCoupon: {
      code: String,
      discountType: { type: String, enum: ['%', '$'] },
      discountValue: Number,
      discountAmount: Number 
    }
  },
  {
    timestamps: true 
  }
);

cartSchema.pre('validate', function(next) {
  if (!this.userId && !this.sessionId) {
    return next(new Error('Either userId or sessionId must be provided for a cart'));
  }

  if (this.userId && this.sessionId) {
    return next(new Error('Cart cannot have both userId and sessionId'));
  }
  
  next();
});

cartSchema.pre('save', function(next) {
  try {
    
    if (!this.userId && !this.sessionId) {
      this.sessionId = crypto.randomUUID();
    }

    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    if (!this.userId && this.sessionId && !this.guestExpiresAt) {
      this.guestExpiresAt = new Date(Date.now() + THIRTY_DAYS_MS);
    } else if (this.userId && this.guestExpiresAt) {
      
      this.guestExpiresAt = undefined;
    }

    if (Array.isArray(this.items) && this.items.length > 1) {
      const map = new Map();
      for (const item of this.items) {
        if (!item || !item.productId) continue;
        const key = item.productId.toString();
        if (!map.has(key)) {
          map.set(key, { ...item.toObject() });
        } else {
          const existing = map.get(key);
          
          existing.quantity += item.quantity || 0;
        }
      }
      this.items = Array.from(map.values());
    }

    next();
  } catch (err) {
    next(err);
  }
});

cartSchema.virtual('totalItems').get(function() {
  return this.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
});

cartSchema.virtual('totalAmount').get(function() {
  return this.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
});

cartSchema.index({ userId: 1 });
cartSchema.index({ sessionId: 1 });
cartSchema.index({ status: 1 });
cartSchema.index({ updatedAt: -1 });

cartSchema.index({ userId: 1, status: 1 });
cartSchema.index({ sessionId: 1, status: 1 });

cartSchema.index({ guestExpiresAt: 1 }, { expireAfterSeconds: 0 });

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
