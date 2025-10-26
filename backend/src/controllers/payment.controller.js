const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Checkout = require('../models/checkout.model');
const Order = require('../models/order.model');
const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const { ResponseUtils } = require('../utils');
const { sendOrderConfirmationEmail } = require('../services/email.services');
const crypto = require('crypto');

function getIdentifiers(req) {
  const userId = req.user?._id || req.user?.id;
  let sessionId = userId ? undefined : (req.sessionID || req.headers['x-session-id']);
  
  if (!userId && !sessionId && !req.generatedSessionId) {
    sessionId = crypto.randomUUID();
    req.generatedSessionId = sessionId;
  } else if (!userId && !sessionId && req.generatedSessionId) {
    sessionId = req.generatedSessionId;
  }
  
  return { userId, sessionId };
}

const createCheckoutSession = async (req, res) => {
  try {
    const { userId, sessionId } = getIdentifiers(req);
    
    console.log('💳 Creating Stripe checkout session:', { 
      userId: userId?.toString().slice(-8), 
      sessionId: sessionId?.slice(-8) 
    });
    
    const query = userId ? { userId, status: 'draft' } : { sessionId, status: 'draft' };
    const checkout = await Checkout.findOne(query);
    
    if (!checkout) {
      return ResponseUtils.error(res, 'Checkout session not found. Please complete customer information first.');
    }
    
    if (!checkout.customerInfo?.email || !checkout.shippingAddress?.street || !checkout.shippingMethod) {
      return ResponseUtils.error(res, 'Please complete all checkout steps before payment.');
    }
    
    if (!checkout.cartItems || checkout.cartItems.length === 0) {
      return ResponseUtils.error(res, 'No items in cart.');
    }

    console.log('🔍 Validating stock availability...');
    const stockValidation = await validateStockAvailability(checkout.cartItems);
    if (!stockValidation.success) {
      return ResponseUtils.validationError(res, stockValidation.message, stockValidation.details);
    }
    console.log('✅ Stock validation passed');

    let amount = checkout.pricing.subtotal + checkout.shippingCost;
    if (checkout.appliedCoupon && checkout.pricing.discountAmount > 0) {
      amount -= checkout.pricing.discountAmount;
    }
    
    amount = Math.max(50, Math.round(amount * 100)); 
    
    console.log('💰 Payment calculation:', {
      subtotal: checkout.pricing.subtotal,
      shipping: checkout.shippingCost,
      discount: checkout.pricing.discountAmount,
      finalAmount: amount / 100
    });
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'aud',
      metadata: {
        checkoutId: checkout._id.toString(),
        userId: userId?.toString() || '',
        sessionId: sessionId || '',
      },
      shipping: {
        name: `${checkout.customerInfo.firstName} ${checkout.customerInfo.lastName}`,
        phone: checkout.customerInfo.phone,
        address: {
          line1: checkout.shippingAddress.street,
          line2: checkout.shippingAddress.apartmentSuite || '',
          city: checkout.shippingAddress.city,
          state: checkout.shippingAddress.state,
          postal_code: checkout.shippingAddress.zipCode,
          country: 'AU',
        },
      },
      description: `Order for ${checkout.cartItems.length} item(s)`,
      receipt_email: checkout.customerInfo.email,
    });
    
    checkout.paymentIntentId = paymentIntent.id;
    checkout.status = 'payment_pending';
    await checkout.save();
    
    console.log('✅ Payment Intent created:', {
      paymentIntentId: paymentIntent.id,
      checkoutId: checkout._id,
      amount: amount / 100,
      checkoutStatus: checkout.status
    });
    
    console.log('🔍 Checkout saved with paymentIntentId:', checkout.paymentIntentId);
    
    if (sessionId && !userId) {
      res.setHeader('X-Session-ID', sessionId);
    }
    
    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      sessionId: paymentIntent.id
    });
    
  } catch (error) {
    console.error('❌ Error creating Payment Intent:', error);
    return ResponseUtils.error(res, 'Failed to create payment session');
  }
};

const getSessionStatus = async (req, res) => {
  try {
    
    let { session_id, payment_intent_id } = req.query;

    if (!session_id && !payment_intent_id) {
      const url = req.originalUrl || req.url;
      console.log('🔍 Debug - Original URL:', url);

      const paymentIntentMatch = url.match(/payment_intent_id=([^&]+)/);
      if (paymentIntentMatch) {
        payment_intent_id = paymentIntentMatch[1];
        console.log('🔍 Debug - Extracted payment_intent_id from URL:', payment_intent_id);
      }

      const sessionIdMatch = url.match(/session_id=([^&]+)/);
      if (sessionIdMatch) {
        session_id = sessionIdMatch[1];
        console.log('🔍 Debug - Extracted session_id from URL:', session_id);
      }

      if (!session_id && !payment_intent_id && req.body) {
        payment_intent_id = req.body.payment_intent_id;
        session_id = req.body.session_id;
        console.log('🔍 Debug - Trying to get from request body:', { payment_intent_id, session_id });
      }

      if (!session_id && !payment_intent_id) {
        payment_intent_id = req.headers['x-payment-intent-id'];
        session_id = req.headers['x-session-id'];
        console.log('🔍 Debug - Trying to get from headers:', { payment_intent_id, session_id });
      }
    }

    console.log('🔍 Debug - All query parameters:', req.query);
    console.log('🔍 Debug - Original URL:', req.originalUrl || req.url);
    console.log('🔍 Debug - session_id:', session_id);
    console.log('🔍 Debug - payment_intent_id:', payment_intent_id);

    const paymentId = session_id || payment_intent_id;
    
    if (!paymentId) {
      console.log('❌ No payment ID found in parameters or URL');
      return ResponseUtils.validationError(res, 'Session ID or Payment Intent ID is required');
    }
    
    console.log('📊 Getting Payment Intent status:', paymentId);
    
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
    console.log('💳 Payment Intent status from Stripe:', paymentIntent.status);
    
    const checkout = await Checkout.findOne({ paymentIntentId: paymentId }).populate('orderId');
    console.log('🔍 Checkout found:', checkout ? {
      id: checkout._id,
      status: checkout.status,
      hasOrder: !!checkout.orderId,
      paymentIntentId: checkout.paymentIntentId
    } : 'Not found');

    if (!checkout) {
      console.log('🔍 Debug: Searching for checkout with paymentIntentId:', paymentId);
      const allCheckouts = await Checkout.find({}).limit(5).select('_id status paymentIntentId stripeSessionId');
      console.log('🔍 Recent checkouts:', allCheckouts);
    }
    
    if (!checkout) {
      return ResponseUtils.error(res, 'Checkout session not found');
    }
    
    if (paymentIntent.status === 'succeeded' && checkout.status !== 'completed') {
      console.log('🔄 Processing successful payment...');
      try {
        await processSuccessfulPayment(checkout, paymentIntent);
        console.log('✅ Payment processing completed');
      } catch (processingError) {
        console.error('❌ Error during payment processing:', processingError);

      }
    }

    const updatedCheckout = await Checkout.findById(checkout._id).populate('orderId');
    
    console.log('✅ Payment Intent status retrieved:', {
      status: paymentIntent.status,
      checkoutId: updatedCheckout._id,
      checkoutStatus: updatedCheckout.status,
      orderId: updatedCheckout.orderId?._id,
      hasOrder: !!updatedCheckout.orderId
    });
    
    res.json({
      success: true,
      status: paymentIntent.status,
      payment_status: paymentIntent.status,
      payment_intent_id: paymentIntent.id,
      payment_intent_status: paymentIntent.status,
      checkout_id: updatedCheckout._id,
      order_id: updatedCheckout.orderId?._id,
      order: updatedCheckout.orderId ? {
        _id: updatedCheckout.orderId._id,
        orderNumber: updatedCheckout.orderId.orderNumber,
        total: updatedCheckout.orderId.total,
        status: updatedCheckout.orderId.status,
        orderDate: updatedCheckout.orderId.orderDate,
        customerInfo: updatedCheckout.orderId.customerInfo,
        shippingAddress: updatedCheckout.orderId.shippingAddress,
        items: updatedCheckout.orderId.items
      } : null
    });
    
  } catch (error) {
    console.error('❌ Error getting Payment Intent status:', error);
    return ResponseUtils.error(res, 'Failed to get session status');
  }
};

async function processSuccessfulPayment(checkout, paymentIntent) {
  try {
    console.log('🎉 Processing successful payment for checkout:', checkout._id);
    console.log('📊 Checkout status before processing:', checkout.status);
    console.log('💳 Payment Intent ID:', paymentIntent.id);

    const order = new Order({
      
      userId: checkout.userId,
      sessionId: checkout.sessionId,
      orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,

      customerInfo: {
        firstName: checkout.customerInfo.firstName,
        lastName: checkout.customerInfo.lastName,
        email: checkout.customerInfo.email,
        phone: checkout.customerInfo.phone
      },

      shippingAddress: {
        street: checkout.shippingAddress.street,
        apartmentSuite: checkout.shippingAddress.apartmentSuite || '',
        city: checkout.shippingAddress.city,
        state: checkout.shippingAddress.state,
        zipCode: checkout.shippingAddress.zipCode,
        country: checkout.shippingAddress.country || 'Australia'
      },
      shippingMethod: checkout.shippingMethod,
      shippingCost: checkout.shippingCost,

      items: checkout.cartItems.map(item => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.total
      })),

      subtotal: checkout.pricing.subtotal,
      discountAmount: checkout.pricing.discountAmount || 0,
      taxAmount: checkout.pricing.taxAmount || 0,
      total: checkout.pricing.total,

      appliedCoupon: checkout.appliedCoupon ? {
        code: checkout.appliedCoupon.code,
        discountType: checkout.appliedCoupon.discountType,
        discountValue: checkout.appliedCoupon.discountValue,
        discountAmount: checkout.appliedCoupon.discountAmount,
        appliedAt: checkout.appliedCoupon.appliedAt
      } : undefined,

      paymentMethod: 'stripe',
      paymentStatus: 'completed',
      stripePaymentIntentId: paymentIntent.id,

      status: 'confirmed',
      orderDate: new Date(),

      billingAddress: {
        street: checkout.shippingAddress.street,
        apartmentSuite: checkout.shippingAddress.apartmentSuite || '',
        city: checkout.shippingAddress.city,
        state: checkout.shippingAddress.state,
        zipCode: checkout.shippingAddress.zipCode,
        country: checkout.shippingAddress.country || 'Australia',
        sameAsShipping: true
      }
    });
    
    await order.save();

    console.log('🔄 Updating checkout status to completed...');
    checkout.status = 'completed';
    checkout.orderId = order._id;
    checkout.completedAt = new Date();
    await checkout.save();
    console.log('✅ Checkout status updated to completed');

    console.log('📦 Updating product inventory...');
    const stockUpdateResults = await updateProductInventory(checkout.cartItems);
    console.log('✅ Stock update results:', stockUpdateResults);

    await clearUserCart(checkout);

    console.log('🗑️ Deleting checkout record after successful order creation...');
    try {
      await Checkout.findByIdAndDelete(checkout._id);
      console.log('✅ Checkout record deleted successfully');
    } catch (deleteError) {
      console.error('⚠️ Failed to delete checkout record:', deleteError);
      
    }
    
    console.log('✅ Order created successfully:', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      customerEmail: order.customerInfo.email,
      total: order.total.toFixed(2),
      itemCount: order.items.length,
      status: order.status
    });

    try {
      console.log('📧 Preparing order confirmation email...');

      const emailData = {
        _id: order._id,
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        customerEmail: order.customerInfo.email,
        customerFirstName: order.customerInfo.firstName,
        orderItems: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          imageUrl: null 
        })),
        shippingAddress: {
          street: order.shippingAddress.street,
          apartmentSuite: order.shippingAddress.apartmentSuite,
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          zipCode: order.shippingAddress.zipCode,
          country: order.shippingAddress.country
        },
        paymentMethod: 'Credit Card (Stripe)',
        subtotal: order.subtotal,
        shipping: order.shippingCost || 0,
        tax: order.taxAmount || 0,
        discount: order.discountAmount || 0,
        totalPrice: order.total
      };
      
      console.log('📋 Email data prepared:', {
        customerEmail: emailData.customerEmail,
        orderNumber: emailData.orderNumber,
        itemCount: emailData.orderItems.length,
        totalPrice: emailData.totalPrice
      });
      
      const emailSent = await sendOrderConfirmationEmail(emailData);
      
      if (emailSent) {
        console.log('✅ Order confirmation email sent successfully');
      } else {
        console.warn('⚠️ Order confirmation email failed to send');
      }
      
    } catch (emailError) {
      console.error('❌ Error sending order confirmation email:', emailError);
      
    }

    return order;
    
  } catch (error) {
    console.error('❌ Error processing successful payment:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      checkoutId: checkout._id,
      paymentIntentId: paymentIntent.id
    });
    throw error;
  }
}

const handleWebhook = async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!endpointSecret) {
      console.warn('⚠️ Stripe webhook secret not configured');
      return res.status(400).send('Webhook secret not configured');
    }
    
    let event;
    
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    console.log('📨 Received Stripe webhook:', event.type);
    
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('🎉 Payment succeeded:', paymentIntent.id);
        
        const checkout = await Checkout.findOne({ paymentIntentId: paymentIntent.id });
        if (checkout && checkout.status !== 'completed') {
          await processSuccessfulPayment(checkout, paymentIntent);
        }
        break;
        
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('🎉 Payment succeeded (legacy):', session.id);
        
        const legacyCheckout = await Checkout.findOne({ stripeSessionId: session.id });
        if (legacyCheckout && legacyCheckout.status !== 'completed') {
          await processSuccessfulPayment(legacyCheckout, session);
        }
        break;
        
      case 'checkout.session.expired':
        console.log('⏰ Payment session expired:', event.data.object.id);
        await Checkout.findOneAndUpdate(
          { stripeSessionId: event.data.object.id },
          { status: 'expired' }
        );
        break;
        
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    
    res.json({ received: true });
    
  } catch (error) {
    console.error('❌ Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
};

async function validateStockAvailability(cartItems) {
  const validation = {
    success: true,
    message: 'Stock validation passed',
    details: [],
    unavailableItems: []
  };

  try {
    console.log(`🔍 Validating stock for ${cartItems.length} items...`);

    for (const item of cartItems) {
      try {
        
        const product = await Product.findById(item.productId);
        if (!product) {
          validation.unavailableItems.push({
            productId: item.productId,
            name: item.name || 'Unknown Product',
            reason: 'Product not found',
            requestedQuantity: item.quantity
          });
          continue;
        }

        if (!product.isActive) {
          validation.unavailableItems.push({
            productId: item.productId,
            name: product.name,
            reason: 'Product is no longer available',
            requestedQuantity: item.quantity
          });
          continue;
        }

        const currentStock = product.quantity || product.stock || 0;
        if (currentStock < item.quantity) {
          validation.unavailableItems.push({
            productId: item.productId,
            name: product.name,
            reason: 'Insufficient stock',
            requestedQuantity: item.quantity,
            availableStock: currentStock
          });
          continue;
        }

        validation.details.push({
          productId: item.productId,
          name: product.name,
          requestedQuantity: item.quantity,
          availableStock: currentStock,
          status: 'available'
        });

      } catch (itemError) {
        console.error(`❌ Error validating product ${item.productId}:`, itemError);
        validation.unavailableItems.push({
          productId: item.productId,
          name: item.name || 'Unknown Product',
          reason: `Validation error: ${itemError.message}`,
          requestedQuantity: item.quantity
        });
      }
    }

    if (validation.unavailableItems.length > 0) {
      validation.success = false;
      const unavailableNames = validation.unavailableItems.map(item => item.name).join(', ');
      validation.message = `Some items are no longer available: ${unavailableNames}`;
    }

    console.log(`📊 Stock validation completed: ${validation.details.length} available, ${validation.unavailableItems.length} unavailable`);

  } catch (error) {
    console.error('❌ Critical error in stock validation:', error);
    validation.success = false;
    validation.message = 'Stock validation failed due to system error';
    validation.details.push({
      error: `Critical error: ${error.message}`,
      type: 'system_error'
    });
  }

  return validation;
}

async function updateProductInventory(cartItems) {
  const results = {
    success: true,
    updated: [],
    errors: [],
    totalItemsProcessed: 0
  };

  try {
    console.log(`📦 Processing ${cartItems.length} items for inventory update...`);

    for (const item of cartItems) {
      try {
        results.totalItemsProcessed++;

        const product = await Product.findById(item.productId);
        if (!product) {
          results.errors.push({
            productId: item.productId,
            error: 'Product not found',
            item: item
          });
          continue;
        }

        const currentStock = product.quantity || product.stock || 0;
        if (currentStock < item.quantity) {
          results.errors.push({
            productId: item.productId,
            productName: product.name,
            error: `Insufficient stock. Available: ${currentStock}, Requested: ${item.quantity}`,
            item: item
          });
          continue;
        }

        const newQuantity = currentStock - item.quantity;
        product.quantity = newQuantity;
        product.stock = newQuantity; 

        if (newQuantity === 0) {
          product.stockStatus = 'out_of_stock';
        } else if (newQuantity < 10) {
          product.stockStatus = 'low_stock';
        } else {
          product.stockStatus = 'in_stock';
        }

        product.salesCount = (product.salesCount || 0) + item.quantity;

        await product.save();

        results.updated.push({
          productId: item.productId,
          productName: product.name,
          previousStock: currentStock,
          newStock: newQuantity,
          quantitySold: item.quantity,
          stockStatus: product.stockStatus
        });

        console.log(`✅ Updated ${product.name}: ${currentStock} → ${newQuantity} (sold ${item.quantity})`);

      } catch (itemError) {
        console.error(`❌ Error updating product ${item.productId}:`, itemError);
        results.errors.push({
          productId: item.productId,
          error: itemError.message,
          item: item
        });
      }
    }

    results.success = results.errors.length === 0 || 
                     results.errors.every(err => err.error.includes('Product not found'));

    console.log(`📊 Inventory update completed: ${results.updated.length} updated, ${results.errors.length} errors`);

  } catch (error) {
    console.error('❌ Critical error in inventory update:', error);
    results.success = false;
    results.errors.push({
      error: `Critical error: ${error.message}`,
      type: 'system_error'
    });
  }

  return results;
}

async function clearUserCart(checkout) {
  const cartClearingResults = {
    success: false,
    methods: [],
    errors: []
  };

  try {
    console.log('🛒 Starting robust cart clearing process...');

    try {
      const cartQuery = checkout.userId ? 
        { userId: checkout.userId, status: 'active' } : 
        { sessionId: checkout.sessionId, status: 'active' };
        
      const updateResult = await Cart.findOneAndUpdate(cartQuery, {
        $set: { 
          items: [], 
          appliedCoupon: null,
          subtotal: 0,
          discount: 0,
          total: 0,
          status: 'completed'
        }
      }, { new: true });

      if (updateResult) {
        cartClearingResults.methods.push('primary_update');
        console.log('✅ Primary cart clearing successful');
      } else {
        throw new Error('No cart found with primary query');
      }

    } catch (primaryError) {
      console.warn('⚠️ Primary cart clearing failed:', primaryError.message);
      cartClearingResults.errors.push({
        method: 'primary_update',
        error: primaryError.message
      });

      try {
        const fallbackQuery = checkout.userId ? 
          { userId: checkout.userId } : 
          { sessionId: checkout.sessionId };
          
        const fallbackResult = await Cart.findOneAndUpdate(fallbackQuery, {
          $set: { 
            items: [], 
            appliedCoupon: null,
            subtotal: 0,
            discount: 0,
            total: 0,
            status: 'completed'
          }
        }, { new: true });

        if (fallbackResult) {
          cartClearingResults.methods.push('fallback_update');
          console.log('✅ Fallback cart clearing successful');
        } else {
          throw new Error('No cart found with fallback query');
        }

      } catch (fallbackError) {
        console.warn('⚠️ Fallback cart clearing failed:', fallbackError.message);
        cartClearingResults.errors.push({
          method: 'fallback_update',
          error: fallbackError.message
        });

        try {
          const deleteQuery = checkout.userId ? 
            { userId: checkout.userId } : 
            { sessionId: checkout.sessionId };
            
          const deleteResult = await Cart.deleteMany(deleteQuery);
          
          if (deleteResult.deletedCount > 0) {
            cartClearingResults.methods.push('delete_cart');
            console.log(`✅ Cart deletion successful (${deleteResult.deletedCount} carts deleted)`);
          } else {
            throw new Error('No carts found to delete');
          }

        } catch (deleteError) {
          console.error('❌ Cart deletion failed:', deleteError.message);
          cartClearingResults.errors.push({
            method: 'delete_cart',
            error: deleteError.message
          });
        }
      }
    }

    cartClearingResults.success = cartClearingResults.methods.length > 0;

    if (cartClearingResults.success) {
      console.log('✅ Cart clearing completed successfully using methods:', cartClearingResults.methods);
    } else {
      console.error('❌ All cart clearing methods failed');
    }

  } catch (error) {
    console.error('❌ Critical error in cart clearing process:', error);
    cartClearingResults.errors.push({
      method: 'system_error',
      error: error.message
    });
  }

  return cartClearingResults;
}

const testPaymentEndpoint = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Payment endpoint is working',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      queryParams: req.query,
      headers: req.headers
    });
  } catch (error) {
    console.error('❌ Error in test payment endpoint:', error);
    return ResponseUtils.error(res, 'Failed to test payment endpoint');
  }
};

const listRecentCheckouts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const checkouts = await Checkout.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('_id status paymentIntentId stripeSessionId customerInfo.email createdAt updatedAt');
    
    res.json({
      success: true,
      checkouts: checkouts,
      count: checkouts.length
    });
    
  } catch (error) {
    console.error('❌ Error listing checkouts:', error);
    return ResponseUtils.error(res, 'Failed to list checkouts');
  }
};

const debugCheckout = async (req, res) => {
  try {
    const { checkout_id } = req.query;
    
    if (!checkout_id) {
      return ResponseUtils.validationError(res, 'Checkout ID is required');
    }
    
    const checkout = await Checkout.findById(checkout_id).populate('orderId');
    
    if (!checkout) {
      return ResponseUtils.error(res, 'Checkout not found');
    }

    let paymentIntentStatus = null;
    if (checkout.paymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(checkout.paymentIntentId);
        paymentIntentStatus = paymentIntent.status;
      } catch (error) {
        console.error('Error retrieving payment intent:', error);
      }
    }
    
    res.json({
      success: true,
      checkout: {
        _id: checkout._id,
        status: checkout.status,
        paymentIntentId: checkout.paymentIntentId,
        orderId: checkout.orderId?._id,
        customerInfo: checkout.customerInfo,
        cartItems: checkout.cartItems,
        pricing: checkout.pricing,
        createdAt: checkout.createdAt,
        updatedAt: checkout.updatedAt,
        completedAt: checkout.completedAt
      },
      paymentIntentStatus,
      order: checkout.orderId ? {
        _id: checkout.orderId._id,
        orderNumber: checkout.orderId.orderNumber,
        status: checkout.orderId.status,
        total: checkout.orderId.total,
        orderDate: checkout.orderId.orderDate
      } : null
    });
    
  } catch (error) {
    console.error('❌ Error in debug checkout:', error);
    return ResponseUtils.error(res, 'Failed to debug checkout');
  }
};

const cleanupOldCheckouts = async (req, res) => {
  try {
    console.log('🧹 Starting checkout cleanup...');

    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); 
    
    const result = await Checkout.deleteMany({
      createdAt: { $lt: cutoffDate },
      status: { $ne: 'completed' }
    });
    
    console.log('✅ Checkout cleanup completed:', {
      deletedCount: result.deletedCount,
      cutoffDate: cutoffDate.toISOString()
    });
    
    res.json({
      success: true,
      message: 'Checkout cleanup completed',
      deletedCount: result.deletedCount,
      cutoffDate: cutoffDate.toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error during checkout cleanup:', error);
    return ResponseUtils.error(res, 'Failed to cleanup old checkouts');
  }
};

module.exports = {
  createCheckoutSession,
  getSessionStatus,
  handleWebhook,
  testPaymentEndpoint,
  listRecentCheckouts,
  debugCheckout,
  cleanupOldCheckouts
};
