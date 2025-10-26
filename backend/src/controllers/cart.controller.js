const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const Coupon = require('../models/coupon.model');
const ResponseUtils = require('../utils/response.utils');
const crypto = require('crypto');

function getIdentifiers(req) {
  
  console.log('🔍 [getIdentifiers] Checking auth:', {
    hasUser: !!req.user,
    userId: req.user?.id || req.user?._id,
    hasAuthHeader: !!req.headers.authorization,
    hasSessionHeader: !!req.headers['x-session-id']
  });

  const userId = req.user?._id || req.user?.id;
  
  let sessionId = userId ? undefined : (req.sessionID || req.headers['x-session-id']);

  if (!userId && !sessionId && !req.generatedSessionId) {
    sessionId = crypto.randomUUID();
    req.generatedSessionId = sessionId; 
    console.log('🆕 Generated new session ID for guest user:', sessionId.slice(-8));
  } else if (!userId && !sessionId && req.generatedSessionId) {
    sessionId = req.generatedSessionId;
    console.log('♻️  Reusing generated session ID:', sessionId.slice(-8));
  } else if (sessionId && !userId) {
    console.log('🔍 Using existing guest session:', sessionId.slice(-8));
  } else if (userId) {
    console.log('👤 Using authenticated user:', userId.toString().slice(-8));
  }
  
  return { userId, sessionId };
}

async function upsertCart(userId, sessionId, updateFields = {}) {
  try {
    const query = userId ? { userId, status: 'active' } : { sessionId, status: 'active' };
    const update = {
      $setOnInsert: {
        userId,
        sessionId,
        items: [],
        status: 'active',
        ...updateFields
      }
    };
    
    const options = { 
      upsert: true, 
      new: true, 
      runValidators: true 
    };
    
    return await Cart.findOneAndUpdate(query, update, options);
  } catch (error) {
    console.error('upsertCart error:', error);
    throw new Error(`Failed to create/find cart: ${error.message}`);
  }
}

const addItem = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    if (!productId || typeof productId !== 'string') {
      return ResponseUtils.validationError(res, 'Valid productId is required');
    }
    
    const qty = parseInt(quantity, 10);
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
      return ResponseUtils.validationError(res, 'Quantity must be an integer between 1 and 999');
    }

    const { userId, sessionId } = getIdentifiers(req);

    if (userId && req.headers['x-session-id']) {
      try {
        const stray = await Cart.findOne({ sessionId: req.headers['x-session-id'], status: 'active' });
        if (stray && !stray.userId) {
          let userCart = await Cart.findOne({ userId, status: 'active' });
          if (!userCart) {
            
            stray.userId = userId;
            stray.sessionId = undefined;
            stray.guestExpiresAt = undefined;
            await stray.save();
          } else if (stray._id.toString() !== userCart._id.toString()) {
            
            if (stray.items.length) {
              userCart.items.push(...stray.items.map(i => ({
                productId: i.productId,
                quantity: i.quantity,
                price: i.price
              })));
              userCart.appliedCoupon = undefined;
              await userCart.save();
            }
            await stray.deleteOne();
          }
        }
      } catch (mergeError) {
        console.warn('Cart merge error (non-fatal):', mergeError.message);
        
      }
    }

    const product = await Product.findById(productId);
    if (!product) return ResponseUtils.notFound(res, 'Product');
    if (!product.isActive) return ResponseUtils.validationError(res, 'Product not available');

    const cart = await upsertCart(userId, sessionId);

    const existing = cart.items.find(i => i.productId.toString() === productId);

    const effectivePrice = product.clearance && product.discountedPrice ? product.discountedPrice : product.price;
    
    if (existing) {
      existing.quantity += qty;
      
      existing.price = effectivePrice;
    } else {
      cart.items.push({ productId: product._id, quantity: qty, price: effectivePrice });
    }

    if (cart.appliedCoupon) cart.appliedCoupon.discountAmount = undefined;

    await cart.save();
    await cart.populate('items.productId', 'name price images imageUrl category stock');

    if (sessionId && !userId) {
      res.setHeader('X-Session-ID', sessionId);
      console.log('📤 Sending X-Session-ID header to client:', sessionId.slice(-8));
    }

    const response = { 
      success: true, 
      cart,
      ...(sessionId && !userId && { sessionId }) 
    };
    
    return res.json(response);
  } catch (err) {
    console.error('Add item error:', err);
    return ResponseUtils.error(res, err.message || 'Failed to add item');
  }
};

const removeItem = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId) return ResponseUtils.validationError(res, 'productId param required');
    const { userId, sessionId } = getIdentifiers(req);

    if (userId && req.headers['x-session-id']) {
      try {
        const stray = await Cart.findOne({ sessionId: req.headers['x-session-id'], status: 'active' });
        if (stray && !stray.userId) {
          let userCart = await Cart.findOne({ userId, status: 'active' });
          if (!userCart) {
            stray.userId = userId;
            stray.sessionId = undefined;
            stray.guestExpiresAt = undefined;
            await stray.save();
          } else if (stray._id.toString() !== userCart._id.toString()) {
            if (stray.items.length) {
              userCart.items.push(...stray.items.map(i => ({
                productId: i.productId,
                quantity: i.quantity,
                price: i.price
              })));
              userCart.appliedCoupon = undefined;
              await userCart.save();
            }
            await stray.deleteOne();
          }
        }
      } catch (mergeError) {
        console.warn('Cart merge error in removeItem (non-fatal):', mergeError.message);
      }
    }

    const cart = await Cart.findOne(userId ? { userId, status: 'active' } : { sessionId, status: 'active' });
    if (!cart) return ResponseUtils.notFound(res, 'Cart');

    const initialLen = cart.items.length;
    cart.items = cart.items.filter(i => i.productId.toString() !== productId);
    if (cart.items.length === initialLen) return ResponseUtils.notFound(res, 'Cart item');

    if (cart.appliedCoupon) cart.appliedCoupon.discountAmount = undefined;
    await cart.save();
    await cart.populate('items.productId', 'name price images imageUrl category stock');
    return res.json({ success: true, cart });
  } catch (err) {
    console.error('Remove item error:', err);
    return ResponseUtils.error(res, err.message || 'Failed to remove item');
  }
};

const updateQuantity = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    if (!productId) return ResponseUtils.validationError(res, 'productId param required');
    const qty = parseInt(quantity, 10);
    if (!Number.isInteger(qty) || qty < 1) return ResponseUtils.validationError(res, 'quantity must be >=1 integer');

    const { userId, sessionId } = getIdentifiers(req);

    if (userId && req.headers['x-session-id']) {
      try {
        const stray = await Cart.findOne({ sessionId: req.headers['x-session-id'], status: 'active' });
        if (stray && !stray.userId) {
          let userCart = await Cart.findOne({ userId, status: 'active' });
          if (!userCart) {
            stray.userId = userId;
            stray.sessionId = undefined;
            stray.guestExpiresAt = undefined;
            await stray.save();
          } else if (stray._id.toString() !== userCart._id.toString()) {
            if (stray.items.length) {
              userCart.items.push(...stray.items.map(i => ({
                productId: i.productId,
                quantity: i.quantity,
                price: i.price
              })));
              userCart.appliedCoupon = undefined;
              await userCart.save();
            }
            await stray.deleteOne();
          }
        }
      } catch (mergeError) {
        console.warn('Cart merge error in updateQuantity (non-fatal):', mergeError.message);
      }
    }
    
    const cart = await Cart.findOne(userId ? { userId, status: 'active' } : { sessionId, status: 'active' });
    if (!cart) return ResponseUtils.notFound(res, 'Cart');

    const item = cart.items.find(i => i.productId.toString() === productId);
    if (!item) return ResponseUtils.notFound(res, 'Cart item');

    item.quantity = qty;
    if (cart.appliedCoupon) cart.appliedCoupon.discountAmount = undefined;

    await cart.save();
    await cart.populate('items.productId', 'name price images imageUrl category stock');
    return res.json({ success: true, cart });
  } catch (err) {
    console.error('Update quantity error:', err);
    return ResponseUtils.error(res, err.message || 'Failed to update quantity');
  }
};

const getCart = async (req, res) => {
  console.log('🛒 [getCart] Function called');
  console.log('🛒 [getCart] Request headers:', { 
    auth: req.headers.authorization ? 'Present' : 'Missing',
    sessionId: req.headers['x-session-id'] ? req.headers['x-session-id'].slice(-8) : 'Missing'
  });
  
  try {
    const { userId, sessionId } = getIdentifiers(req);

    if (userId && req.headers['x-session-id']) {
      const stray = await Cart.findOne({ sessionId: req.headers['x-session-id'], status: 'active' });
      if (stray && !stray.userId) {
        let userCart = await Cart.findOne({ userId, status: 'active' });
        if (!userCart) {
          stray.userId = userId;
          stray.sessionId = undefined;
          stray.guestExpiresAt = undefined;
          await stray.save();
        } else if (stray._id.toString() !== userCart._id.toString()) {
          if (stray.items.length) {
            userCart.items.push(...stray.items.map(i => ({
              productId: i.productId,
              quantity: i.quantity,
              price: i.price
            })));
            userCart.appliedCoupon = undefined;
            await userCart.save();
          }
          await stray.deleteOne();
        }
      }
    }
    
    const headerSessionId = req.headers['x-session-id'];
    let cart = await Cart.findOne(userId ? { userId, status: 'active' } : { sessionId, status: 'active' })
      .populate('items.productId', 'name price images imageUrl category stock');

    if (userId && headerSessionId) {
      
      if (!cart) {
        const guestCart = await Cart.findOne({ sessionId: headerSessionId, status: 'active' })
          .populate('items.productId', 'name price images imageUrl category stock');
        if (guestCart) {
          guestCart.userId = userId;
          guestCart.sessionId = undefined;
          guestCart.guestExpiresAt = undefined;
          guestCart.appliedCoupon = undefined; 
          await guestCart.save();
          cart = guestCart;
        }
      } else {
        
        const strayGuest = await Cart.findOne({ sessionId: headerSessionId, status: 'active' });
        if (strayGuest && strayGuest._id.toString() !== cart._id.toString()) {
          if (strayGuest.items.length) {
            cart.items.push(...strayGuest.items.map(i => ({ 
              productId: i.productId, 
              quantity: i.quantity, 
              price: i.price 
            })));
            cart.appliedCoupon = undefined;
            await cart.save();
            await strayGuest.deleteOne();
            await cart.populate('items.productId', 'name price images imageUrl category stock');
          } else {
            await strayGuest.deleteOne();
          }
        }
      }
    }

    if (!cart) {
      
      if (sessionId && !userId) {
        res.setHeader('X-Session-ID', sessionId);
      }
      
      return res.json({ 
        success: true, 
        cart: { 
          items: [], 
          totalItems: 0, 
          totalAmount: 0,
          status: 'active'
        } 
      });
    }

    const subtotal = cart.items.reduce((s, i) => s + i.quantity * i.price, 0);
    let discountAmount = 0;

    if (cart.appliedCoupon) {
      const coupon = await Coupon.findOne({ code: cart.appliedCoupon.code, isActive: true });
      if (coupon) {
        const meetsMin = coupon.minimumOrderAmount ? subtotal >= coupon.minimumOrderAmount : true;
        const notExpired = !coupon.expirationDate || new Date() <= coupon.expirationDate;
        if (meetsMin && notExpired) {
          if (coupon.discountType === '%') {
            discountAmount = +(subtotal * (coupon.discountValue / 100)).toFixed(2);
          } else {
            discountAmount = Math.min(subtotal, coupon.discountValue);
          }
          cart.appliedCoupon.discountAmount = discountAmount;
        } else {
          cart.appliedCoupon = undefined; 
        }
      } else {
        cart.appliedCoupon = undefined;
      }
    }

    const total = subtotal - (cart.appliedCoupon?.discountAmount || 0);

    if (sessionId && !userId) {
      res.setHeader('X-Session-ID', sessionId);
    }

    return res.json({
      success: true,
      cart: {
        id: cart._id,
        items: cart.items,
        subtotal,
        discount: cart.appliedCoupon?.discountAmount || 0,
        coupon: cart.appliedCoupon?.code || null,
        appliedCoupon: cart.appliedCoupon || null,
        total,
        totalItems: cart.totalItems,
        uniqueItems: cart.items.length,
        status: cart.status,
        updatedAt: cart.updatedAt
      }
    });
  } catch (err) {
    console.error('Get cart error:', err);
    return ResponseUtils.error(res, err.message || 'Failed to fetch cart');
  }
};

const applyCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return ResponseUtils.validationError(res, 'code is required');

    const { userId, sessionId } = getIdentifiers(req);
    const cart = await Cart.findOne(userId ? { userId, status: 'active' } : { sessionId, status: 'active' });
    if (!cart || cart.items.length === 0) return ResponseUtils.validationError(res, 'Cart empty');

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) return ResponseUtils.validationError(res, 'Invalid coupon');
    if (coupon.expirationDate && new Date() > coupon.expirationDate) return ResponseUtils.validationError(res, 'Coupon expired');

    if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
      return ResponseUtils.validationError(res, 'Coupon usage limit reached');
    }

    let usedByEntry;
    if (userId) {
      usedByEntry = coupon.usedBy.find(e => e.userId && e.userId.toString() === userId.toString());
    } else if (sessionId) {
      usedByEntry = coupon.usedBy.find(e => e.sessionId === sessionId);
    }
    const perUserLimit = coupon.perUserLimit || 1;
    if (usedByEntry && usedByEntry.count >= perUserLimit) {
      return ResponseUtils.validationError(res, 'You have reached the usage limit for this coupon');
    }

    const subtotal = cart.items.reduce((s, i) => s + i.quantity * i.price, 0);
    if (coupon.minimumOrderAmount && subtotal < coupon.minimumOrderAmount) return ResponseUtils.validationError(res, 'Minimum order amount not met');

    let discountAmount = 0;
    if (coupon.discountType === '%') {
      discountAmount = +(subtotal * (coupon.discountValue / 100)).toFixed(2);
    } else {
      discountAmount = Math.min(subtotal, coupon.discountValue);
    }

    cart.appliedCoupon = {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount
    };

    await cart.save();

    const update = { $inc: { usageCount: 1 } };
    if (userId) {
      if (usedByEntry) {
        update["usedBy.$.count"] = 1;
        await Coupon.updateOne(
          { _id: coupon._id, "usedBy.userId": userId },
          { $inc: { usageCount: 1, "usedBy.$.count": 1 } }
        );
      } else {
        await Coupon.updateOne(
          { _id: coupon._id },
          { $inc: { usageCount: 1 }, $push: { usedBy: { userId, count: 1 } } }
        );
      }
    } else if (sessionId) {
      if (usedByEntry) {
        await Coupon.updateOne(
          { _id: coupon._id, "usedBy.sessionId": sessionId },
          { $inc: { usageCount: 1, "usedBy.$.count": 1 } }
        );
      } else {
        await Coupon.updateOne(
          { _id: coupon._id },
          { $inc: { usageCount: 1 }, $push: { usedBy: { sessionId, count: 1 } } }
        );
      }
    }

    return res.json({ 
      success: true, 
      cart: { 
        id: cart._id, 
        subtotal, 
        discount: discountAmount, 
        coupon: coupon.code, 
        appliedCoupon: cart.appliedCoupon || null,
        total: subtotal - discountAmount,
        status: cart.status
      } 
    });
  } catch (err) {
    console.error('Apply coupon error:', err);
    return ResponseUtils.error(res, err.message || 'Failed to apply coupon');
  }
};

const removeCoupon = async (req, res) => {
  try {
    const { userId, sessionId } = getIdentifiers(req);
    const cart = await Cart.findOne(userId ? { userId, status: 'active' } : { sessionId, status: 'active' });
    if (!cart) return ResponseUtils.notFound(res, 'Cart');
    if (!cart.appliedCoupon) return ResponseUtils.validationError(res, 'No coupon applied');

    const coupon = await Coupon.findOne({ code: cart.appliedCoupon.code });
    if (!coupon) return ResponseUtils.notFound(res, 'Coupon');

    if (userId) {
      await Coupon.updateOne(
        { _id: coupon._id, "usedBy.userId": userId, "usedBy.count": { $gt: 0 } },
        { $inc: { usageCount: -1, "usedBy.$.count": -1 } }
      );
      
      await Coupon.updateOne(
        { _id: coupon._id },
        { $pull: { usedBy: { userId: userId, count: { $lte: 0 } } } }
      );
    } else if (sessionId) {
      await Coupon.updateOne(
        { _id: coupon._id, "usedBy.sessionId": sessionId, "usedBy.count": { $gt: 0 } },
        { $inc: { usageCount: -1, "usedBy.$.count": -1 } }
      );
      
      await Coupon.updateOne(
        { _id: coupon._id },
        { $pull: { usedBy: { sessionId: sessionId, count: { $lte: 0 } } } }
      );
    }

  cart.appliedCoupon = undefined;
  await cart.save();
  
  const cartObj = cart.toObject();
  cartObj.appliedCoupon = null;
  return res.json({ success: true, cart: cartObj });
  } catch (err) {
    console.error('Remove coupon error:', err);
    return ResponseUtils.error(res, err.message || 'Failed to remove coupon');
  }
};

const clearCart = async (req, res) => {
  try {
    const { userId, sessionId } = getIdentifiers(req);
    const cart = await Cart.findOne(userId ? { userId, status: 'active' } : { sessionId, status: 'active' });
    if (!cart) return ResponseUtils.notFound(res, 'Cart');
    
    cart.items = [];
    cart.appliedCoupon = undefined;
    await cart.save();
    
    return res.json({ 
      success: true, 
      cart: { 
        id: cart._id, 
        items: [], 
        subtotal: 0, 
        total: 0,
        status: cart.status
      } 
    });
  } catch (err) {
    console.error('Clear cart error:', err);
    return ResponseUtils.error(res, err.message || 'Failed to clear cart');
  }
};

const mergeGuestCart = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return ResponseUtils.unauthorized(res, 'Login required');
    const guestSessionId = req.body.sessionId || req.headers['x-session-id'];
    if (!guestSessionId) return ResponseUtils.validationError(res, 'Guest sessionId required');

    const guestCart = await Cart.findOne({ sessionId: guestSessionId, status: 'active' });
    if (!guestCart) return ResponseUtils.notFound(res, 'Guest cart');

    await Coupon.updateMany(
      { "usedBy.sessionId": guestSessionId },
      [
        {
          $set: {
            usedBy: {
              $map: {
                input: "$usedBy",
                as: "entry",
                in: {
                  $cond: [
                    { $eq: ["$$entry.sessionId", guestSessionId] },
                    { userId: userId, count: "$$entry.count" },
                    "$$entry"
                  ]
                }
              }
            }
          }
        }
      ]
    );

    let userCart = await Cart.findOne({ userId, status: 'active' });
    if (!userCart) {
      
      guestCart.userId = userId;
      guestCart.sessionId = undefined;
      guestCart.guestExpiresAt = undefined;
      guestCart.appliedCoupon = undefined; 
      await guestCart.save();
      
      await guestCart.populate('items.productId', 'name price images imageUrl category stock');
      return res.json({ success: true, cart: guestCart });
    }

    userCart.items.push(...guestCart.items.map(i => ({ 
      productId: i.productId, 
      quantity: i.quantity, 
      price: i.price 
    })));
    userCart.appliedCoupon = undefined; 
    await userCart.save();

    await guestCart.deleteOne();

    await userCart.populate('items.productId', 'name price images imageUrl category stock');
    return res.json({ success: true, cart: userCart });
  } catch (err) {
    console.error('Merge guest cart error:', err);
    return ResponseUtils.error(res, err.message || 'Failed to merge cart');
  }
};

const updateCartStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { userId, sessionId } = getIdentifiers(req);

    if (!['active', 'ordered', 'abandoned'].includes(status)) {
      return ResponseUtils.validationError(res, 'Invalid status. Must be: active, ordered, or abandoned');
    }
    
    const cart = await Cart.findOne(userId ? { userId, status: 'active' } : { sessionId, status: 'active' });
    if (!cart) return ResponseUtils.notFound(res, 'Active cart');
    
    cart.status = status;
    await cart.save();
    
    return res.json({ 
      success: true, 
      message: `Cart status updated to ${status}`,
      cart: { 
        id: cart._id, 
        status: cart.status,
        updatedAt: cart.updatedAt
      }
    });
  } catch (err) {
    console.error('Update cart status error:', err);
    return ResponseUtils.error(res, err.message || 'Failed to update cart status');
  }
};

module.exports = {
  addItem,
  removeItem,
  updateQuantity,
  getCart,
  applyCoupon,
  removeCoupon,
  clearCart,
  mergeGuestCart,
  updateCartStatus
};
