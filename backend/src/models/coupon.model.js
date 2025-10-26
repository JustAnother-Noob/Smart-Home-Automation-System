const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true, 
      minlength: 3,
      maxlength: 20,
    },
    discountType: {
      type: String,
      enum: ['%', '$'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    comments: {
      type: String,
      trim: true,
      default: '',
    },
    
    expirationDate: {
      type: Date,
      default: null, 
    },
    usageLimit: {
      type: Number,
      min: 0,
      default: 0, 
    },
    usageCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    perUserLimit: {
      type: Number,
      min: 0,
      default: 1, 
    },
    usedBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        sessionId: { type: String }, 
        count: { type: Number, default: 0, min: 0 }
      }
    ],
    minimumOrderAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, 
  }
);

couponSchema.pre('validate', function(next) {
  
  if (this.usageLimit > 0 && this.perUserLimit > 0) {
    if (this.usageLimit < this.perUserLimit) {
      return next(new Error('Total usage limit must be greater than or equal to per-user limit'));
    }
  }
  
  if (this.usageLimit > 0 && this.perUserLimit === 0) {
    return next(new Error('Per-user limit cannot be 0 when total usage limit is set'));
  }

  if (this.discountValue < 0) {
    return next(new Error('Discount value cannot be negative'));
  }
  
  if (this.discountType === '%' && this.discountValue > 100) {
    return next(new Error('Percentage discount cannot exceed 100%'));
  }

  if (this.expirationDate && this.expirationDate <= new Date()) {
    return next(new Error('Expiration date must be in the future'));
  }
  
  next();
});

couponSchema.index({ code: 1 });

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;
