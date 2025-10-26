const Order = require('../models/order.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const Cart = require('../models/cart.model');
const { ResponseUtils } = require('../utils');

async function createOrder(req, res) {
  try {
    const { items, address, paymentMethod, totalAmount } = req.body;
    const userId = req.user.id; 

    if (!items || !Array.isArray(items) || items.length === 0) {
      return ResponseUtils.validationError(res, 'Order items are required');
    }

    if (!address || !address.trim()) {
      return ResponseUtils.validationError(res, 'Delivery address is required');
    }

    if (!paymentMethod || !['cod', 'online', 'card'].includes(paymentMethod)) {
      return ResponseUtils.validationError(res, 'Valid payment method is required');
    }

    const processedItems = [];
    let calculatedTotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return ResponseUtils.validationError(res, `Product ${item.product} not found`);
      }

      if (!product.isActive) {
        return ResponseUtils.validationError(res, `Product ${product.name} is not available`);
      }

      if (product.quantity < item.quantity) {
        return ResponseUtils.validationError(res, `Insufficient stock for ${product.name}`);
      }

      const itemTotal = product.price * item.quantity;
      calculatedTotal += itemTotal;

      processedItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price
      });

      product.quantity -= item.quantity;
      product.stockStatus = product.quantity === 0 ? 'out_of_stock' : 
                           product.quantity < 10 ? 'low_stock' : 'in_stock';
      await product.save();
    }

    if (totalAmount && Math.abs(calculatedTotal - totalAmount) > 0.01) {
      return ResponseUtils.validationError(res, 'Total amount mismatch');
    }

    const order = new Order({
      userId: userId, 
      items: processedItems,
      total: calculatedTotal, 
      address: address.trim(),
      paymentMethod,
      status: 'pending'
    });

    await order.save();

    await order.populate([
      { path: 'userId', select: 'firstName lastName email' },
      { path: 'items.productId', select: 'name price images' }
    ]);

    try {
      await Cart.findOneAndUpdate(
        { userId },
        { $set: { items: [] } }
      );
    } catch (cartError) {
      console.log('Warning: Could not clear cart after order creation:', cartError.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order
    });

  } catch (error) {
    console.error('Error creating order:', error);
    return ResponseUtils.error(res, 'Failed to create order');
  }
}

async function getUserOrders(req, res) {
  try {
    const userId = req.user.id; 
    const { page = 1, limit = 10, status } = req.query;

    const query = { userId: userId }; 
    if (status) {
      query.status = status.toLowerCase().trim();
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 10, 50);
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('items.productId', 'name price images'), 
      Order.countDocuments(query)
    ]);

    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderNumber: order.orderNumber || order._id,
      status: order.status,
      totalAmount: order.total, 
      createdAt: order.createdAt || order.orderDate,
      updatedAt: order.updatedAt,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
      actualDeliveryDate: order.actualDeliveryDate,
      paymentMethod: order.paymentMethod,
      items: order.items.map(item => ({
        product: {
          name: item.name, 
          _id: item.productId
        },
        quantity: item.quantity,
        price: item.price,
        total: item.total
      })),
      
      address: order.shippingAddress ? 
        `${order.shippingAddress.street}${order.shippingAddress.apartmentSuite ? ', ' + order.shippingAddress.apartmentSuite : ''}, ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}` 
        : null
    }));

    return res.json({
      success: true,
      orders: formattedOrders,
      count: formattedOrders.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });

  } catch (error) {
    console.error('Error fetching user orders:', error);
    return ResponseUtils.error(res, 'Failed to fetch orders');
  }
}

async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id; 

    const order = await Order.findOne({ _id: id, userId: userId })
      .populate('items.productId', 'name price images description')
      .populate('userId', 'firstName lastName email phone');

    if (!order) {
      return ResponseUtils.notFound(res, 'Order');
    }

    return res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error('Error fetching order:', error);
    return ResponseUtils.error(res, 'Failed to fetch order');
  }
}

async function cancelOrder(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id; 

    const order = await Order.findOne({ _id: id, userId: userId });
    if (!order) {
      return ResponseUtils.notFound(res, 'Order');
    }

    if (order.status !== 'pending') {
      return ResponseUtils.validationError(res, 'Only pending orders can be cancelled');
    }

    for (const item of order.items) {
      const product = await Product.findById(item.productId); 
      if (product) {
        product.quantity += item.quantity;
        product.stockStatus = product.quantity === 0 ? 'out_of_stock' : 
                             product.quantity < 10 ? 'low_stock' : 'in_stock';
        await product.save();
      }
    }

    order.status = 'cancelled';
    order.updatedAt = Date.now();
    await order.save();

    return res.json({
      success: true,
      message: 'Order cancelled successfully',
      order
    });

  } catch (error) {
    console.error('Error cancelling order:', error);
    return ResponseUtils.error(res, 'Failed to cancel order');
  }
}

async function trackOrder(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id; 

    const order = await Order.findOne({ _id: id, userId: userId })
      .select('status createdAt updatedAt total')
      .populate('items.productId', 'name');

    if (!order) {
      return ResponseUtils.notFound(res, 'Order');
    }

    const statusHistory = [
      { status: 'pending', date: order.createdAt, message: 'Order placed successfully' }
    ];

    if (order.status !== 'pending') {
      statusHistory.push({
        status: order.status,
        date: order.updatedAt,
        message: getStatusMessage(order.status)
      });
    }

    return res.json({
      success: true,
      tracking: {
        orderId: order._id,
        currentStatus: order.status,
        estimatedDelivery: getEstimatedDelivery(order),
        statusHistory
      }
    });

  } catch (error) {
    console.error('Error tracking order:', error);
    return ResponseUtils.error(res, 'Failed to track order');
  }
}

async function searchOrderById(req, res) {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id; 

    console.log(`🔍 Searching for order: ${orderId}, user: ${userId || 'guest'}`);

    let query = {};

    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(orderId);
    
    if (isValidObjectId) {
      
      query._id = orderId;
    } else {
      
      query.orderNumber = orderId;
    }

    if (userId) {
      query.userId = userId; 
    }

    console.log('🔍 Search query:', query);

    const order = await Order.findOne(query)
      .populate('items.productId', 'name price images description')
      .populate('userId', 'firstName lastName email phone');

    if (!order) {
      console.log(`❌ Order not found: ${orderId}`);
      return ResponseUtils.notFound(res, 'Order not found. Please check your Order ID and try again.');
    }

    if (!userId) {
      console.log(`👤 Guest user accessing order: ${orderId}`);
    }

    console.log(`✅ Order found: ${orderId}, status: ${order.status}`);

    const formattedOrder = {
      _id: order._id,
      orderNumber: order.orderNumber || order._id,
      status: order.status,
      installationBooked: order.installationBooked || false, 
      totalAmount: order.total, 
      createdAt: order.createdAt || order.orderDate,
      updatedAt: order.updatedAt,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
      actualDeliveryDate: order.actualDeliveryDate,
      address: order.shippingAddress ? 
        `${order.shippingAddress.street}${order.shippingAddress.apartmentSuite ? ', ' + order.shippingAddress.apartmentSuite : ''}, ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}` 
        : 'Address not available',
      paymentMethod: order.paymentMethod,
      items: order.items.map(item => ({
        product: {
          name: item.name, 
          _id: item.productId
        },
        quantity: item.quantity,
        price: item.price,
        total: item.total
      })),
      user: userId ? order.userId : null 
    };

    return res.json({
      success: true,
      order: formattedOrder
    });

  } catch (error) {
    console.error('❌ Error searching for order:', error);

    if (error.name === 'CastError') {
      return ResponseUtils.validationError(res, 'Invalid Order ID format');
    }
    
    return ResponseUtils.error(res, 'Failed to search for order');
  }
}

function getStatusMessage(status) {
  const messages = {
    'processing': 'Your order is being processed',
    'shipped': 'Your order has been shipped',
    'completed': 'Your order has been delivered',
    'cancelled': 'Your order was cancelled'
  };
  return messages[status] || 'Status updated';
}

function getEstimatedDelivery(order) {
  if (order.status === 'completed' || order.status === 'cancelled') {
    return null;
  }
  
  const deliveryDays = order.status === 'shipped' ? 2 : 5;
  const estimatedDate = new Date(order.createdAt);
  estimatedDate.setDate(estimatedDate.getDate() + deliveryDays);
  return estimatedDate;
}

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  trackOrder,
  searchOrderById 
};
