

const mongoose = require('mongoose');

const InstallationSchema = new mongoose.Schema(
  {
    
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true
    },
    orderNumber: {
      type: String,
      required: true,
      trim: true
    },

    customerName: {
      type: String,
      required: true,
      trim: true
    },
    contactNumber: {
      type: String,
      required: true,
      trim: true
    },
    customerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
    },

    address: {
      type: String,
      required: true,
      trim: true
    },

    installationDate: {
      type: Date,
      required: true
    },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending'
    },

    assignedTechnician: {
      type: String,
      trim: true
    },

    notes: {
      type: String,
      trim: true
    }
  },
  {
    
    timestamps: true
  }
);

InstallationSchema.index({ installationDate: 1, status: 1 });

module.exports = mongoose.model('Installation', InstallationSchema);
