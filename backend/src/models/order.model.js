const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: {
    type: String,
    required: true,
  }, 
  price: {
    type: Number,
    required: true,
  }, 
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  total: {
    type: Number,
    required: true,
  }, 
});

const orderSchema = new mongoose.Schema(
  {
    
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, 
    },
    sessionId: {
      type: String,
      required: false, 
    },

    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },

    customerInfo: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, required: true, trim: true },
    },

    shippingAddress: {
      street: { type: String, required: true, trim: true },
      apartmentSuite: { type: String, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      zipCode: { type: String, required: true, trim: true },
      country: {
        type: String,
        required: true,
        trim: true,
        default: "Australia",
      },
    },

    shippingMethod: {
      type: String,
      enum: ["standard", "express", "overnight"],
      required: true,
    },
    shippingCost: {
      type: Number,
      required: true,
      default: 0,
    },

    items: [orderItemSchema],

    subtotal: {
      type: Number,
      required: true,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },

    appliedCoupon: {
      code: String,
      discountType: { type: String, enum: ["%", "$"] },
      discountValue: Number,
      discountAmount: Number,
      appliedAt: Date,
    },

    paymentMethod: {
      type: String,
      enum: ["stripe", "paypal", "cod"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "refunded"],
      default: "pending",
    },
    stripePaymentIntentId: String,

    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "completed",
        "cancelled",
        "refunded",
      ],
      default: "pending",
    },
    installationBooked: {
      type: Boolean,
      default: false,
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },

    orderDate: {
      type: Date,
      default: Date.now,
    },
    estimatedDeliveryDate: Date,
    actualDeliveryDate: Date,

    trackingNumber: String,
    carrier: String,

    orderNotes: String,
    internalNotes: String,

    billingAddress: {
      street: String,
      apartmentSuite: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      sameAsShipping: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ userId: 1, orderDate: -1 });
orderSchema.index({ sessionId: 1, orderDate: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ "customerInfo.email": 1, orderDate: -1 });
orderSchema.index({ status: 1, orderDate: -1 });
orderSchema.index({ stripePaymentIntentId: 1 });
orderSchema.index({ isArchived: 1, status: 1, createdAt: -1 });

orderSchema.virtual("customerName").get(function () {
  return `${this.customerInfo.firstName} ${this.customerInfo.lastName}`;
});

orderSchema.virtual("formattedTotal").get(function () {
  return `$${this.total.toFixed(2)}`;
});

orderSchema.pre("save", function (next) {
  if (this.isNew && !this.estimatedDeliveryDate) {
    const deliveryDays =
      this.shippingMethod === "overnight"
        ? 1
        : this.shippingMethod === "express"
        ? 3
        : 7;
    this.estimatedDeliveryDate = new Date(
      Date.now() + deliveryDays * 24 * 60 * 60 * 1000
    );
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);
