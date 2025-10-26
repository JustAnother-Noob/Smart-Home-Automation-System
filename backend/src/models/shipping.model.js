const mongoose = require('mongoose');

const shippingZoneSchema = new mongoose.Schema({
  state: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  stateName: {
    type: String,
    required: true,
    trim: true
  },
  postcodeStart: {
    type: Number,
    required: true
  },
  postcodeEnd: {
    type: Number,
    required: true
  },
  shippingRate: {
    type: Number,
    required: true,
    min: 0
  },
  freeShippingThreshold: {
    type: Number,
    required: true,
    min: 0
  },
  estimatedDeliveryDays: {
    type: Number,
    required: true,
    min: 1
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

shippingZoneSchema.index({ postcodeStart: 1, postcodeEnd: 1 });
shippingZoneSchema.index({ state: 1, isActive: 1 });

module.exports = mongoose.model('ShippingZone', shippingZoneSchema);
