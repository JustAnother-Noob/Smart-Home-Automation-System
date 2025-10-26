const Checkout = require('../models/checkout.model');
const User = require('../models/user.model');
const Cart = require('../models/cart.model');
const Order = require('../models/order.model');
const { ResponseUtils } = require('../utils');
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

const getCustomerInfo = async (req, res) => {
  try {
    const { userId, sessionId } = getIdentifiers(req);
    
    console.log('🔍 Checkout customer info request:', { 
      userId: userId ? userId.toString().slice(-8) : null, 
      sessionId: sessionId ? sessionId.slice(-8) : null,
      hasUser: !!req.user 
    });

    let checkout = await Checkout.findOne(
      userId ? { userId, status: 'draft' } : { sessionId, status: 'draft' }
    );
    
    if (checkout) {
      console.log('✅ Found existing checkout session');
      
      if (sessionId && !userId) {
        res.setHeader('X-Session-ID', sessionId);
      }
      
      return res.json({
        success: true,
        customerInfo: checkout.customerInfo,
        shippingAddress: checkout.shippingAddress
      });
    }

    if (userId) {
      console.log('🔄 Loading user data for checkout pre-fill...');
      
      const user = await User.findById(userId).select('firstName lastName email phone addresses');
      if (!user) {
        console.error('❌ User not found:', userId);
        return ResponseUtils.unauthorized(res, 'User not found');
      }
      
      console.log('✅ User found:', { 
        firstName: user.firstName, 
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        addressCount: user.addresses ? user.addresses.length : 0
      });

      let primaryAddress = null;
      if (user.addresses && user.addresses.length > 0) {
        primaryAddress = user.addresses.find(addr => addr.isPrimary) || user.addresses[0];
        console.log('📍 Found primary address:', primaryAddress ? 'Yes' : 'No');
      }
      
      const customerInfo = {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || ''
      };

      const shippingAddress = primaryAddress ? {
        street: primaryAddress.street || '',
        apartmentSuite: primaryAddress.apartmentSuite || '',
        city: primaryAddress.suburb || primaryAddress.city || '', 
        state: primaryAddress.state || '',
        zipCode: primaryAddress.zipCode || '',
        country: primaryAddress.country || 'Australia'
      } : {
        street: '',
        apartmentSuite: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'Australia'
      };

      const savedAddresses = user.addresses ? user.addresses.map(addr => ({
        _id: addr._id,
        street: addr.street || '',
        apartmentSuite: addr.apartmentSuite || '',
        suburb: addr.suburb || '', 
        city: addr.suburb || addr.city || '', 
        state: addr.state || '',
        zipCode: addr.zipCode || '',
        country: addr.country || 'Australia',
        isPrimary: addr.isPrimary || false
      })) : [];
      
      console.log('📤 Sending user data:', { 
        customerInfo, 
        shippingAddress, 
        savedAddressesCount: savedAddresses.length 
      });
      
      return res.json({
        success: true,
        customerInfo,
        shippingAddress,
        savedAddresses 
      });
    }

    console.log('👤 Guest user - returning empty structure');
    if (sessionId && !userId) {
      res.setHeader('X-Session-ID', sessionId);
    }
    
    return res.json({
      success: true,
      customerInfo: {
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
      },
      shippingAddress: {
        street: '',
        apartmentSuite: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'Australia'
      },
      savedAddresses: []
    });
    
  } catch (error) {
    console.error('❌ Error getting customer info:', error);
    return ResponseUtils.error(res, 'Failed to get customer information');
  }
};

const updateCustomerInfo = async (req, res) => {
  try {
    const { userId, sessionId } = getIdentifiers(req);
    const { customerInfo, shippingAddress, saveAddress } = req.body;

    if (!customerInfo || !customerInfo.firstName || !customerInfo.lastName || !customerInfo.email) {
      return ResponseUtils.validationError(res, 'First name, last name, and email are required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerInfo.email)) {
      return ResponseUtils.validationError(res, 'Invalid email format');
    }

    if (!shippingAddress || !shippingAddress.street || !shippingAddress.city || 
        !shippingAddress.state || !shippingAddress.zipCode) {
      return ResponseUtils.validationError(res, 'Complete address is required');
    }

    if (!customerInfo.phone || customerInfo.phone.length < 8) {
      return ResponseUtils.validationError(res, 'Valid phone number is required');
    }

    const cartQuery = userId ? { userId, status: 'active' } : { sessionId, status: 'active' };
    const cart = await Cart.findOne(cartQuery).populate('items.productId', 'name price images');
    
    if (!cart || !cart.items.length) {
      return ResponseUtils.validationError(res, 'Cart is empty. Please add items before checkout.');
    }

    const cartItems = cart.items.map(item => ({
      productId: item.productId._id,
      name: item.productId.name,
      price: item.price, 
      quantity: item.quantity,
      total: item.price * item.quantity
    }));

    const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);

    let discountAmount = 0;
    let appliedCoupon = undefined;
    
    if (cart.appliedCoupon && cart.appliedCoupon.code) {
      console.log('📊 Processing applied coupon:', {
        code: cart.appliedCoupon.code,
        type: cart.appliedCoupon.discountType,
        value: cart.appliedCoupon.discountValue,
        subtotal
      });

      const discountValue = parseFloat(cart.appliedCoupon.discountValue);
      
      if (!isNaN(discountValue) && discountValue > 0) {
        
        if (cart.appliedCoupon.discountType === '%') {
          discountAmount = Math.round(subtotal * (discountValue / 100) * 100) / 100;
        } else {
          discountAmount = Math.min(subtotal, discountValue);
        }

        if (isNaN(discountAmount) || discountAmount < 0) {
          discountAmount = 0;
        }
        
        appliedCoupon = {
          code: cart.appliedCoupon.code,
          discountType: cart.appliedCoupon.discountType,
          discountValue: discountValue,
          discountAmount: discountAmount,
          appliedAt: new Date()
        };
        
        console.log('✅ Coupon discount calculated:', {
          discountAmount,
          finalDiscount: discountAmount
        });
      } else {
        console.warn('⚠️ Invalid discount value, skipping coupon');
      }
    }
    
    const total = Math.max(0, subtotal - discountAmount); 
    
    const pricing = {
      subtotal: parseFloat(subtotal.toFixed(2)),
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      shippingCost: 0,
      taxAmount: 0,
      total: parseFloat(total.toFixed(2))
    };
    
    console.log('💰 Final pricing calculation:', pricing);

    if (saveAddress && userId) {
      try {
        const user = await User.findById(userId);
        if (user) {
          
          const isDuplicate = user.addresses.some(addr => 
            addr.street.toLowerCase().trim() === shippingAddress.street.toLowerCase().trim() &&
            addr.suburb.toLowerCase().trim() === shippingAddress.city.toLowerCase().trim() &&
            addr.state.toLowerCase().trim() === shippingAddress.state.toLowerCase().trim() &&
            addr.zipCode.trim() === shippingAddress.zipCode.trim() &&
            (addr.apartmentSuite || '').toLowerCase().trim() === (shippingAddress.apartmentSuite || '').toLowerCase().trim()
          );

          if (!isDuplicate) {
            const newAddress = {
              street: shippingAddress.street.trim(),
              apartmentSuite: shippingAddress.apartmentSuite?.trim() || '',
              suburb: shippingAddress.city.trim(),
              state: shippingAddress.state.trim(),
              zipCode: shippingAddress.zipCode.trim(),
              country: shippingAddress.country?.trim() || 'Australia',
              isPrimary: user.addresses.length === 0 
            };
            
            user.addresses.push(newAddress);
            await user.save();
            console.log('✅ Address saved to user account');
          } else {
            console.log('ℹ️ Address already exists, not saving duplicate');
          }
        }
      } catch (error) {
        console.error('❌ Failed to save address to user account:', error);
        
      }
    }

    const query = userId ? { userId, status: 'draft' } : { sessionId, status: 'draft' };
    
    const updateData = {
      cartItems,
      pricing,
      customerInfo: {
        firstName: customerInfo.firstName.trim(),
        lastName: customerInfo.lastName.trim(),
        email: customerInfo.email.toLowerCase().trim(),
        phone: customerInfo.phone.trim()
      },
      shippingAddress: {
        street: shippingAddress.street.trim(),
        apartmentSuite: shippingAddress.apartmentSuite?.trim() || '',
        city: shippingAddress.city.trim(),
        state: shippingAddress.state.trim(),
        zipCode: shippingAddress.zipCode.trim(),
        country: shippingAddress.country?.trim() || 'Australia'
      }
    };

    if (appliedCoupon && !isNaN(appliedCoupon.discountAmount)) {
      updateData.appliedCoupon = appliedCoupon;
    }
    
    const update = {
      $set: updateData,
      $setOnInsert: {
        userId,
        sessionId,
        status: 'draft'
      }
    };
    
    const options = { upsert: true, new: true, runValidators: true };
    const checkout = await Checkout.findOneAndUpdate(query, update, options);
    
    console.log('✅ Checkout created/updated with cart snapshot:', {
      items: cartItems.length,
      subtotal: pricing.subtotal,
      discountAmount: pricing.discountAmount,
      finalTotal: pricing.total,
      appliedCoupon: appliedCoupon?.code
    });

    if (sessionId && !userId) {
      res.setHeader('X-Session-ID', sessionId);
    }
    
    return res.json({
      success: true,
      message: 'Customer information updated successfully',
      checkoutId: checkout._id,
      customerInfo: checkout.customerInfo,
      shippingAddress: checkout.shippingAddress
    });
    
  } catch (error) {
    console.error('Error updating customer info:', error);
    return ResponseUtils.error(res, 'Failed to update customer information');
  }
};

const updateShippingMethod = async (req, res) => {
  try {
    const { userId, sessionId } = getIdentifiers(req);
    const { shippingMethod, shippingCost } = req.body;

    if (!shippingMethod || !['standard', 'express', 'overnight'].includes(shippingMethod)) {
      return ResponseUtils.validationError(res, 'Valid shipping method is required');
    }

    if (typeof shippingCost !== 'number' || shippingCost < 0) {
      return ResponseUtils.validationError(res, 'Valid shipping cost is required');
    }
    
    console.log('🚚 Updating shipping method:', { shippingMethod, shippingCost, userId: userId?.toString().slice(-8), sessionId: sessionId?.slice(-8) });

    const query = userId ? { userId, status: 'draft' } : { sessionId, status: 'draft' };
    const checkout = await Checkout.findOne(query);
    
    if (!checkout) {
      return ResponseUtils.error(res, 'Checkout session not found. Please start from customer information.');
    }

    if (!checkout.customerInfo?.firstName || !checkout.shippingAddress?.street) {
      return ResponseUtils.error(res, 'Customer information and address must be saved first.');
    }

    checkout.shippingMethod = shippingMethod;
    checkout.shippingCost = shippingCost;
    checkout.pricing.shippingCost = shippingCost;

    const subtotal = checkout.pricing.subtotal || 0;
    const discountAmount = checkout.pricing.discountAmount || 0;
    checkout.pricing.total = subtotal - discountAmount + shippingCost;
    
    await checkout.save();
    
    console.log('✅ Shipping method updated:', {
      method: shippingMethod,
      cost: shippingCost,
      subtotal,
      discountAmount,
      newTotal: checkout.pricing.total
    });

    if (sessionId && !userId) {
      res.setHeader('X-Session-ID', sessionId);
    }
    
    return res.json({
      success: true,
      message: 'Shipping method updated successfully',
      checkoutId: checkout._id,
      shippingMethod: checkout.shippingMethod,
      shippingCost: checkout.shippingCost
    });
    
  } catch (error) {
    console.error('❌ Error updating shipping method:', error);
    return ResponseUtils.error(res, 'Failed to update shipping method');
  }
};

const validateCustomerInfo = async (req, res) => {
  try {
    const { customerInfo, shippingAddress } = req.body;
    const errors = [];

    if (!customerInfo?.firstName?.trim()) errors.push('First name is required');
    if (!customerInfo?.lastName?.trim()) errors.push('Last name is required');
    if (!customerInfo?.email?.trim()) errors.push('Email is required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) errors.push('Invalid email format');
    if (!customerInfo?.phone?.trim()) errors.push('Phone number is required');
    else if (customerInfo.phone.length < 8) errors.push('Valid phone number is required');

    if (!shippingAddress?.street?.trim()) errors.push('Street address is required');
    if (!shippingAddress?.city?.trim()) errors.push('City is required');
    if (!shippingAddress?.state?.trim()) errors.push('State is required');
    if (!shippingAddress?.zipCode?.trim()) errors.push('Postcode is required');
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors
      });
    }
    
    return res.json({
      success: true,
      message: 'Customer information is valid'
    });
    
  } catch (error) {
    console.error('Error validating customer info:', error);
    return ResponseUtils.error(res, 'Failed to validate customer information');
  }
};

const getCheckoutSummary = async (req, res) => {
  try {
    const { userId, sessionId } = getIdentifiers(req);
    
    console.log('📋 Getting checkout summary:', { 
      userId: userId?.toString().slice(-8), 
      sessionId: sessionId?.slice(-8) 
    });

    const query = userId ? { userId, status: 'draft' } : { sessionId, status: 'draft' };
    const checkout = await Checkout.findOne(query);
    
    if (!checkout) {
      return ResponseUtils.error(res, 'Checkout session not found');
    }

    const cartQuery = userId ? { userId, status: 'active' } : { sessionId, status: 'active' };
    const cart = await Cart.findOne(cartQuery).populate('items.productId', 'name price images');
    
    if (!cart || !cart.items.length) {
      return ResponseUtils.error(res, 'Cart is empty');
    }

    const subtotal = cart.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const discountAmount = cart.appliedCoupon?.discountAmount || 0;
    const shippingCost = checkout.shippingCost || 0;
    const total = subtotal - discountAmount + shippingCost;

    if (sessionId && !userId) {
      res.setHeader('X-Session-ID', sessionId);
    }
    
    return res.json({
      success: true,
      checkout: {
        id: checkout._id,
        customerInfo: checkout.customerInfo,
        shippingAddress: checkout.shippingAddress,
        shippingMethod: checkout.shippingMethod,
        shippingCost: checkout.shippingCost,
        status: checkout.status
      },
      cart: {
        items: cart.items,
        subtotal,
        discount: discountAmount,
        shippingCost,
        total,
        appliedCoupon: cart.appliedCoupon
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting checkout summary:', error);
    return ResponseUtils.error(res, 'Failed to get checkout summary');
  }
};

const saveShippingMethod = async (req, res) => {
  return updateShippingMethod(req, res);
};

module.exports = {
  getCustomerInfo,
  updateCustomerInfo,
  validateCustomerInfo,
  updateShippingMethod,
  saveShippingMethod,
  getCheckoutSummary
};
