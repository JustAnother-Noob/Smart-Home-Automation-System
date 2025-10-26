const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const ResponseUtils = require('../utils/response.utils');
const crypto = require('crypto');

function getCartIdentifiers(req) {
  const userId = req.user?._id || req.user?.id;
  let sessionId = userId ? undefined : (req.sessionID || req.headers['x-session-id']);

  if (!userId && !sessionId && !req.generatedSessionId) {
    sessionId = crypto.randomUUID();
    req.generatedSessionId = sessionId; 
    console.log('🔄 Generated new session ID in middleware:', sessionId.slice(-8));
  } else if (!userId && !sessionId && req.generatedSessionId) {
    sessionId = req.generatedSessionId;
  }
  
  return { userId, sessionId };
}

async function loadCart(req, res, next) {
  try {
    const { userId, sessionId } = getCartIdentifiers(req);
    const query = userId ? { userId, status: 'active' } : { sessionId, status: 'active' };
    req.cart = await Cart.findOne(query);

    if (sessionId && !userId) {
      res.setHeader('X-Session-ID', sessionId);
    }
    
    return next();
  } catch (err) {
    console.error('loadCart error:', err);
    return ResponseUtils.error(res, err.message || 'Failed to load cart');
  }
}

async function ensureCart(req, res, next) {
  try {
    const { userId, sessionId } = getCartIdentifiers(req);
    const query = userId ? { userId, status: 'active' } : { sessionId, status: 'active' };
    const update = {
      $setOnInsert: {
        userId,
        sessionId,
        items: [],
        status: 'active'
      }
    };
    
    const options = { 
      upsert: true, 
      new: true, 
      runValidators: true 
    };
    
    req.cart = await Cart.findOneAndUpdate(query, update, options);

    if (sessionId && !userId) {
      res.setHeader('X-Session-ID', sessionId);
    }
    
    return next();
  } catch (err) {
    console.error('ensureCart error:', err);
    return ResponseUtils.error(res, err.message || 'Failed to ensure cart');
  }
}

function validateCartItemInput(req, res, next) {
  try {
    const { productId, quantity = 1 } = req.body;
    if (!productId) {
      return ResponseUtils.validationError(res, 'productId is required');
    }
    const qty = parseInt(quantity, 10);
    if (!Number.isInteger(qty) || qty < 1) {
      return ResponseUtils.validationError(res, 'quantity must be an integer >= 1');
    }
    req.body.quantity = qty; 
    return next();
  } catch (err) {
    return ResponseUtils.error(res, 'Invalid cart item input');
  }
}

async function mergeGuestCartIfNeeded(req, res, next) {
  try {
    if (!req.user) return next(); 
    const guestSessionId = req.headers['x-guest-session-id'] || req.body?.sessionId || req.headers['x-session-id'];
    if (!guestSessionId) return next();

    const guestCart = await Cart.findOne({ sessionId: guestSessionId, status: 'active' });
    if (!guestCart) return next();

    let userCart = await Cart.findOne({ userId: req.user._id, status: 'active' });
    if (!userCart) {
      
      guestCart.userId = req.user._id;
      guestCart.sessionId = undefined;
      guestCart.guestExpiresAt = undefined;
      guestCart.appliedCoupon = undefined; 
      await guestCart.save();
      req.cart = guestCart;
      req.mergedGuestCart = true;
      return next();
    }

    if (guestCart.items.length) {
      userCart.items.push(...guestCart.items.map(i => ({ 
        productId: i.productId, 
        quantity: i.quantity, 
        price: i.price 
      })));
      userCart.appliedCoupon = undefined;
      await userCart.save();
    }
    await guestCart.deleteOne();
    req.cart = userCart;
    req.mergedGuestCart = true;
    return next();
  } catch (err) {
    console.error('mergeGuestCartIfNeeded error:', err);
    
    return next();
  }
}

function computeCartTotals(req, res, next) {
  try {
    if (!req.cart) return next();
    const subtotal = req.cart.items.reduce((s, i) => s + i.quantity * i.price, 0);
    const discount = req.cart.appliedCoupon?.discountAmount || 0;
    req.cartTotals = {
      subtotal,
      discount,
      total: subtotal - discount,
      itemCount: req.cart.items.reduce((s, i) => s + i.quantity, 0),
      uniqueItems: req.cart.items.length
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  loadCart,
  ensureCart,
  validateCartItemInput,
  mergeGuestCartIfNeeded,
  computeCartTotals
};
