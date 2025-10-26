const ShippingZone = require('../models/shipping.model');
const { ResponseUtils } = require('../utils');

const calculateShipping = async (req, res) => {
  try {
    const { postcode, cartTotal = 0, state } = req.body;
    
    if (!postcode) {
      return ResponseUtils.validationError(res, 'Postcode is required');
    }
    
    const postcodeNum = parseInt(postcode);
    if (isNaN(postcodeNum) || postcodeNum < 1000 || postcodeNum > 9999) {
      return ResponseUtils.validationError(res, 'Invalid Australian postcode');
    }

    let shippingZone;
    
    if (state) {
      
      shippingZone = await ShippingZone.findOne({
        state: state.toUpperCase(),
        postcodeStart: { $lte: postcodeNum },
        postcodeEnd: { $gte: postcodeNum },
        isActive: true
      });
    } else {
      
      shippingZone = await ShippingZone.findOne({
        postcodeStart: { $lte: postcodeNum },
        postcodeEnd: { $gte: postcodeNum },
        isActive: true
      });
    }
    
    if (!shippingZone) {
      return ResponseUtils.error(res, 'Shipping not available to this postcode', 400);
    }
    
    const total = parseFloat(cartTotal) || 0;

    const standardRate = total >= shippingZone.freeShippingThreshold ? 0 : shippingZone.shippingRate;
    const expressRate = Math.round(shippingZone.shippingRate * 1.5 * 100) / 100;
    const overnightRate = Math.round(shippingZone.shippingRate * 2.5 * 100) / 100;

    const baseDeliveryDays = shippingZone.estimatedDeliveryDays;
    const today = new Date();
    
    const standardDelivery = new Date(today);
    standardDelivery.setDate(today.getDate() + baseDeliveryDays);
    
    const expressDelivery = new Date(today);
    expressDelivery.setDate(today.getDate() + Math.max(1, Math.ceil(baseDeliveryDays * 0.6)));
    
    const overnightDelivery = new Date(today);
    overnightDelivery.setDate(today.getDate() + 1);
    
    const shippingOptions = [
      {
        method: 'standard',
        name: 'Standard Shipping',
        price: standardRate,
        estimatedDays: baseDeliveryDays,
        estimatedDelivery: standardDelivery.toISOString().split('T')[0],
        description: `${baseDeliveryDays}-${baseDeliveryDays + 2} business days`
      },
      {
        method: 'express',
        name: 'Express Shipping',
        price: expressRate,
        estimatedDays: Math.max(1, Math.ceil(baseDeliveryDays * 0.6)),
        estimatedDelivery: expressDelivery.toISOString().split('T')[0],
        description: `${Math.max(1, Math.ceil(baseDeliveryDays * 0.6))}-${Math.max(2, Math.ceil(baseDeliveryDays * 0.8))} business days`
      },
      {
        method: 'overnight',
        name: 'Overnight Shipping',
        price: overnightRate,
        estimatedDays: 1,
        estimatedDelivery: overnightDelivery.toISOString().split('T')[0],
        description: 'Next business day'
      }
    ];
    
    return res.json({
      success: true,
      postcode: postcode,
      state: shippingZone.state,
      stateName: shippingZone.stateName,
      cartTotal: total,
      freeShippingThreshold: shippingZone.freeShippingThreshold,
      qualifiesForFreeShipping: total >= shippingZone.freeShippingThreshold,
      shippingOptions
    });
    
  } catch (error) {
    console.error('Error calculating shipping:', error);
    return ResponseUtils.error(res, 'Failed to calculate shipping rates');
  }
};

const getShippingZones = async (req, res) => {
  try {
    const zones = await ShippingZone.find({ isActive: true }).sort({ state: 1, postcodeStart: 1 });
    
    return res.json({
      success: true,
      zones
    });
    
  } catch (error) {
    console.error('Error fetching shipping zones:', error);
    return ResponseUtils.error(res, 'Failed to fetch shipping zones');
  }
};

module.exports = {
  calculateShipping,
  getShippingZones
};
