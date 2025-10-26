
const Order = require("../models/order.model");
const Product = require("../models/product.model");
const User = require("../models/user.model");
const { ResponseUtils } = require("../utils");
const crypto = require("crypto");
const mongoose = require("mongoose");

async function ensureDummyOrder() {
  const count = await Order.countDocuments();
  if (count > 0) return;

  const anyUser = await User.findOne();
  const anyProduct = await Product.findOne();
  if (!anyUser || !anyProduct) return;

  const orderNumber = `ORDER-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
  const price = Number(anyProduct.price || 0);
  const quantity = 1;
  const subtotal = price * quantity;
  const taxAmount = 0;
  const shippingCost = 0;
  const total = subtotal + taxAmount + shippingCost;

  await Order.create({
    userId: anyUser._id,
    orderNumber,
    customerInfo: {
      firstName: anyUser.firstName || "Demo",
      lastName: anyUser.lastName || "User",
      email: anyUser.email,
      phone: anyUser.phone || "000-000-0000",
    },
    shippingAddress: {
      street: "123 Sample Street",
      apartmentSuite: "",
      city: "Sample City",
      state: "SA",
      zipCode: "5000",
      country: "Australia",
    },
    shippingMethod: "standard",
    shippingCost,
    items: [
      {
        productId: anyProduct._id,
        name: anyProduct.name || "Product",
        price,
        quantity,
        total: price * quantity,
      },
    ],
    subtotal,
    discountAmount: 0,
    taxAmount,
    total,
    paymentMethod: "cod",
    paymentStatus: "pending",
    status: "pending",
    isArchived: false,
  });
}

async function getAllOrders(req, res) {
  try {
    await ensureDummyOrder();

    const {
      status,
      page = 1,
      limit = 20,
      user,
      from,
      to,
      archived,
      sort,
      search,
      orderId,
    } = req.query;

    const query = {};
    const statusFilter = typeof status === "string" ? status.trim().toLowerCase() : undefined;
    if (statusFilter && statusFilter !== "all") {
      const normalized = statusFilter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.status = { $regex: `^${normalized}$`, $options: "i" };
    }
    if (user) query.userId = user;

    const archivedFilter =
      typeof archived === "string" ? archived.toLowerCase().trim() : undefined;
    if (archivedFilter === "true") {
      query.isArchived = true;
    } else if (archivedFilter === "all") {
      
    } else {
      query.isArchived = { $ne: true };
    }

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    if (search || orderId) {
      const searchTerm = search || orderId;
      const trimmedSearch = searchTerm.trim();
      
      if (trimmedSearch) {
        
        const searchConditions = [];

        const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(trimmedSearch);
        if (isValidObjectId) {
          searchConditions.push({ _id: trimmedSearch });
        }

        searchConditions.push({ 
          orderNumber: { $regex: trimmedSearch, $options: 'i' } 
        });

        searchConditions.push({
          $or: [
            { 'customerInfo.firstName': { $regex: trimmedSearch, $options: 'i' } },
            { 'customerInfo.lastName': { $regex: trimmedSearch, $options: 'i' } },
            { 'customerInfo.email': { $regex: trimmedSearch, $options: 'i' } }
          ]
        });

        query.$or = searchConditions;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    let sortQuery = { createdAt: -1 }; 
    if (sort) {
      switch (sort) {
        case 'newest':
          sortQuery = { createdAt: -1 };
          break;
        case 'oldest':
          sortQuery = { createdAt: 1 };
          break;
        case 'amount-high':
          sortQuery = { total: -1 };
          break;
        case 'amount-low':
          sortQuery = { total: 1 };
          break;
        case 'status':
          sortQuery = { status: 1 };
          break;
        default:
          sortQuery = { createdAt: -1 };
      }
    }

    let orders, total;
    
    if ((search || orderId) && query.$or) {
      
      const searchTerm = search || orderId;
      const trimmedSearch = searchTerm.trim();
      
      const aggregationPipeline = [
        
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: {
            path: '$user',
            preserveNullAndEmptyArrays: true
          }
        },
        
        {
          $match: {
            ...query,
            $or: [
              
              ...((/^[0-9a-fA-F]{24}$/.test(trimmedSearch)) ? [{ _id: new mongoose.Types.ObjectId(trimmedSearch) }] : []),
              { orderNumber: { $regex: trimmedSearch, $options: 'i' } },
              
              { 'customerInfo.firstName': { $regex: trimmedSearch, $options: 'i' } },
              { 'customerInfo.lastName': { $regex: trimmedSearch, $options: 'i' } },
              { 'customerInfo.email': { $regex: trimmedSearch, $options: 'i' } },
              
              { 'user.firstName': { $regex: trimmedSearch, $options: 'i' } },
              { 'user.lastName': { $regex: trimmedSearch, $options: 'i' } },
              { 'user.email': { $regex: trimmedSearch, $options: 'i' } }
            ]
          }
        },
        { $sort: sortQuery },
        { $skip: skip },
        { $limit: limitNum },
        
        {
          $lookup: {
            from: 'products',
            localField: 'items.productId',
            foreignField: '_id',
            as: 'itemProducts'
          }
        }
      ];

      const countQuery = { ...query };
      delete countQuery.$or;
      
      const [aggregatedOrders, totalCount] = await Promise.all([
        Order.aggregate(aggregationPipeline),
        Order.aggregate([
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $unwind: {
              path: '$user',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $match: {
              ...countQuery,
              $or: [
                ...((/^[0-9a-fA-F]{24}$/.test(trimmedSearch)) ? [{ _id: new mongoose.Types.ObjectId(trimmedSearch) }] : []),
                { orderNumber: { $regex: trimmedSearch, $options: 'i' } },
                { 'customerInfo.firstName': { $regex: trimmedSearch, $options: 'i' } },
                { 'customerInfo.lastName': { $regex: trimmedSearch, $options: 'i' } },
                { 'customerInfo.email': { $regex: trimmedSearch, $options: 'i' } },
                { 'user.firstName': { $regex: trimmedSearch, $options: 'i' } },
                { 'user.lastName': { $regex: trimmedSearch, $options: 'i' } },
                { 'user.email': { $regex: trimmedSearch, $options: 'i' } }
              ]
            }
          },
          { $count: "total" }
        ])
      ]);
      
      orders = aggregatedOrders;
      total = totalCount[0]?.total || 0;
    } else {
      
      [orders, total] = await Promise.all([
        Order.find(query)
          .sort(sortQuery)
          .skip(skip)
          .limit(limitNum)
          .populate("userId", "firstName lastName email")
          .populate("items.productId", "name price image"),
        Order.countDocuments(query),
      ]);
    }

    const formattedOrders = orders.map((order, idx) => {
      const plain = order.toObject ? order.toObject() : order;
      return {
        _id: plain._id,
        orderNumber:
          plain.orderNumber ||
          `ORDER-${String(skip + idx + 1).padStart(6, "0")}`,
        userId: plain.userId?._id || plain.userId,
        user: plain.userId, 
        customerInfo: plain.customerInfo,
        items: plain.items,
        subtotal: plain.subtotal,
        total: plain.total,
        totalAmount: plain.total, 
        shippingAddress: plain.shippingAddress,
        paymentMethod: plain.paymentMethod,
        paymentStatus: plain.paymentStatus,
        status: plain.status,
        isArchived: Boolean(plain.isArchived),
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
      };
    });

    return res.json({
      success: true,
      orders: formattedOrders,
      count: orders.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return ResponseUtils.error(res, "Failed to fetch orders");
  }
}

async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, sendEmail } = req.body;

    const allowed = [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "completed",
      "cancelled",
      "refunded",
    ];
    const normalized = (status || "").toLowerCase().trim();
    if (!normalized || !allowed.includes(normalized)) {
      return ResponseUtils.validationError(res, "Invalid status");
    }

    const existing = await Order.findById(id).populate('userId', 'email firstName lastName');
    if (!existing) return ResponseUtils.notFound(res, "Order");
    if (existing.isArchived) {
      return ResponseUtils.validationError(
        res,
        "Archived orders cannot change status"
      );
    }

    const oldStatus = existing.status;

    const updateData = { 
      status: normalized, 
      updatedAt: Date.now() 
    };

    if ((normalized === 'delivered' || normalized === 'completed') && !existing.actualDeliveryDate) {
      updateData.actualDeliveryDate = new Date();
    }

    const updated = await Order.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('userId', 'email firstName lastName');

    if (oldStatus !== normalized && sendEmail === true) {
      try {
        const { sendOrderStatusEmail } = require('../services/email.services');
        const customerEmail = updated.customerInfo?.email || updated.userId?.email;
        
        if (customerEmail) {
          await sendOrderStatusEmail(updated, normalized, customerEmail);
          console.log(`✅ Order status email sent to ${customerEmail}`);
        } else {
          console.log('⚠️  No customer email found, skipping email notification');
        }
      } catch (emailError) {
        console.error('Error sending order status email:', emailError);
        
      }
    } else if (oldStatus !== normalized) {
      console.log('📧 Email notification skipped (checkbox unchecked or not provided)');
    }

    return res.json({ success: true, order: updated });
  } catch (error) {
    console.error("Error updating order status:", error);
    return ResponseUtils.error(res, "Failed to update order status");
  }
}

async function setArchiveState(id, state) {
  return Order.findByIdAndUpdate(id, { isArchived: state }, { new: true });
}

async function archiveOrder(req, res) {
  try {
    const { id } = req.params;
    const order = await setArchiveState(id, true);
    if (!order) return ResponseUtils.notFound(res, "Order");
    return res.json({
      success: true,
      order,
      message: "Order archived successfully",
    });
  } catch (error) {
    console.error("Error archiving order:", error);
    return ResponseUtils.error(res, "Failed to archive order");
  }
}

async function unarchiveOrder(req, res) {
  try {
    const { id } = req.params;
    const order = await setArchiveState(id, false);
    if (!order) return ResponseUtils.notFound(res, "Order");
    return res.json({
      success: true,
      order,
      message: "Order unarchived successfully",
    });
  } catch (error) {
    console.error("Error unarchiving order:", error);
    return ResponseUtils.error(res, "Failed to unarchive order");
  }
}

async function deleteOrder(req, res) {
  return archiveOrder(req, res);
}

async function getOrderDetails(req, res) {
  try {
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate("userId", "firstName lastName email phone")
      .populate("items.productId", "name price description image");

    if (!order) return ResponseUtils.notFound(res, "Order");

    const formatted = {
      ...order.toObject(),
      user: order.userId,
      totalAmount: order.total,
      orderNumber:
        order.orderNumber ||
        `ORDER-${order._id.toString().slice(-6).toUpperCase()}`,
      isArchived: Boolean(order.isArchived),
    };

    return res.json({ success: true, order: formatted });
  } catch (error) {
    console.error("Error fetching order details:", error);
    return ResponseUtils.error(res, "Failed to fetch order details");
  }
}

async function sendOrderStatusEmail(req, res) {
  try {
    const { id } = req.params;
    const { status, email } = req.body;

    if (!email || !status) {
      return ResponseUtils.validationError(
        res,
        'Email and status are required'
      );
    }

    const order = await Order.findById(id)
      .populate('userId', 'email firstName lastName');
    
    if (!order) {
      return ResponseUtils.notFound(res, 'Order');
    }

    try {
      const { sendOrderStatusEmail: sendStatusEmail } = require('../services/email.services');
      await sendStatusEmail(order, status, email);
      
      return res.json({
        success: true,
        message: 'Order status email sent successfully',
      });
    } catch (emailError) {
      console.error('Error sending order status email:', emailError);
      return res.json({
        success: false,
        message: 'Failed to send email notification',
      });
    }
  } catch (error) {
    console.error('Error sending order status email:', error);
    return ResponseUtils.error(res, 'Failed to send email notification', 500);
  }
}

module.exports = {
  getAllOrders,
  getOrderDetails,
  updateOrderStatus,
  archiveOrder,
  unarchiveOrder,
  deleteOrder,
  sendOrderStatusEmail,
};
