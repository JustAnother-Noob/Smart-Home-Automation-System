const Coupon = require('../models/coupon.model');
const Product = require('../models/product.model');

exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      comments = '',
      isActive = true,
      expirationDate = null,
      usageLimit = 0,
      minimumOrderAmount = 0,
      perUserLimit = 1,
    } = req.body;

    if (!code || !discountType || discountValue === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing or invalid: code, discountType, discountValue',
      });
    }

    const validationErrors = [];

    if (discountValue < 0) {
      validationErrors.push('Discount value cannot be negative');
    }
    
    if (discountType === '%' && discountValue > 100) {
      validationErrors.push('Percentage discount cannot exceed 100%');
    }

    const finalUsageLimit = Number(usageLimit) || 0;
    const finalPerUserLimit = Number(perUserLimit) || 1;
    
    if (finalUsageLimit > 0 && finalPerUserLimit > 0) {
      if (finalUsageLimit < finalPerUserLimit) {
        validationErrors.push('Total usage limit must be greater than or equal to per-user limit');
      }
    }
    
    if (finalUsageLimit > 0 && finalPerUserLimit === 0) {
      validationErrors.push('Per-user limit cannot be 0 when total usage limit is set');
    }

    if (expirationDate) {
      const expDate = new Date(expirationDate);
      const now = new Date();
      if (expDate <= now) {
        validationErrors.push('Expiration date must be in the future');
      }
    }
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors: ' + validationErrors.join(', '),
      });
    }

    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (existingCoupon) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists' });
    }

    const newCoupon = new Coupon({
      code: code.toUpperCase().trim(),
      discountType,
      discountValue,
      comments,
      isActive,
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      usageLimit: Number(usageLimit ?? 0),
      minimumOrderAmount: Number(minimumOrderAmount ?? 0),
      
      perUserLimit: Number(perUserLimit ?? 1),
    });

    await newCoupon.save();
    return res.status(201).json({ success: true, coupon: newCoupon, message: 'Coupon created successfully' });
  } catch (error) {
    console.error('Create coupon error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating coupon' });
  }
};

exports.getCoupons = async (req, res) => {
  try {
    
    const { isActive, limit = 50, skip = 0, sort } = req.query;

    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    let sortQuery = { createdAt: -1 }; 
    if (sort) {
      switch (sort) {
        case 'newest':
          sortQuery = { createdAt: -1 };
          break;
        case 'oldest':
          sortQuery = { createdAt: 1 };
          break;
        case 'code-asc':
          sortQuery = { code: 1 };
          break;
        case 'code-desc':
          sortQuery = { code: -1 };
          break;
        case 'discount-asc':
          sortQuery = { discountValue: 1 };
          break;
        case 'discount-desc':
          sortQuery = { discountValue: -1 };
          break;
        case 'expiry-asc':
          sortQuery = { expirationDate: 1 };
          break;
        case 'expiry-desc':
          sortQuery = { expirationDate: -1 };
          break;
        case 'usage-asc':
          sortQuery = { usageCount: 1 };
          break;
        case 'usage-desc':
          sortQuery = { usageCount: -1 };
          break;
        default:
          sortQuery = { createdAt: -1 };
      }
    }

    const coupons = await Coupon.find(filter)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .sort(sortQuery);

    res.json({ success: true, count: coupons.length, coupons });
  } catch (error) {
    console.error('Fetch coupons error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching coupons' });
  }
};

exports.getCouponById = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    res.json({ success: true, coupon });
  } catch (error) {
    console.error('Get coupon by ID error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching coupon' });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      discountType,
      discountValue,
      categories,
      exceptions,
      comments,
      isActive,
      expirationDate,
      usageLimit,
      minimumOrderAmount,
      perUserLimit,
    } = req.body;

    const validationErrors = [];

    if (discountValue !== undefined) {
      if (discountValue < 0) {
        validationErrors.push('Discount value cannot be negative');
      }
      
      if (discountType && discountType === '%' && discountValue > 100) {
        validationErrors.push('Percentage discount cannot exceed 100%');
      }
    }

    const finalUsageLimit = usageLimit !== undefined ? Number(usageLimit) || 0 : undefined;
    const finalPerUserLimit = perUserLimit !== undefined ? Number(perUserLimit) || 1 : undefined;
    
    if (finalUsageLimit !== undefined && finalPerUserLimit !== undefined) {
      if (finalUsageLimit > 0 && finalPerUserLimit > 0) {
        if (finalUsageLimit < finalPerUserLimit) {
          validationErrors.push('Total usage limit must be greater than or equal to per-user limit');
        }
      }
      
      if (finalUsageLimit > 0 && finalPerUserLimit === 0) {
        validationErrors.push('Per-user limit cannot be 0 when total usage limit is set');
      }
    }

    if (expirationDate !== undefined && expirationDate) {
      const expDate = new Date(expirationDate);
      const now = new Date();
      if (expDate <= now) {
        validationErrors.push('Expiration date must be in the future');
      }
    }
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors: ' + validationErrors.join(', '),
      });
    }

    const updateData = {};

    if (code) updateData.code = code.toUpperCase().trim();
    if (discountType) updateData.discountType = discountType;
    if (discountValue !== undefined) updateData.discountValue = discountValue;
    if (categories) updateData.categories = categories;
    if (exceptions) updateData.exceptions = exceptions;
    if (comments !== undefined) updateData.comments = comments;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (expirationDate !== undefined) updateData.expirationDate = expirationDate ? new Date(expirationDate) : null;
    if (usageLimit !== undefined) updateData.usageLimit = Number(usageLimit) || 0;
    if (minimumOrderAmount !== undefined) updateData.minimumOrderAmount = Number(minimumOrderAmount) || 0;
    if (perUserLimit !== undefined) updateData.perUserLimit = Number(perUserLimit) || 0;

    if (exceptions && exceptions.length > 0) {
      const productsCount = await Product.countDocuments({ _id: { $in: exceptions } });
      if (productsCount !== exceptions.length) {
        return res.status(400).json({ success: false, message: 'Some exceptions are invalid products' });
      }
    }

    if (code) {
      const existingCoupon = await Coupon.findOne({ 
        code: code.toUpperCase().trim(),
        _id: { $ne: id }, 
      });
      if (existingCoupon) {
        return res.status(400).json({ success: false, message: 'Coupon code already exists' });
      }
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

    if (!updatedCoupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    res.json({ success: true, coupon: updatedCoupon, message: 'Coupon updated successfully' });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({ success: false, message: 'Server error updating coupon' });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Coupon.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting coupon' });
  }
};
