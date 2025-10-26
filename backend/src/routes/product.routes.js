const express = require('express');
const router = express.Router();
const Product = require('../models/product.model');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
const { searchLimiter, uploadLimiter, cloudinaryBatchUploadLimiter } = require('../middlewares/enhanced-rate-limiter');
const productController = require('../controllers/product.controller');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const memoryStorage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowed = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']);
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExt = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
    if (allowed.has(file.mimetype) && allowedExt.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPG, GIF, or WEBP images are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 
  }
});

const cloudinaryUpload = multer({
  storage: memoryStorage,
  fileFilter: (req, file, cb) => {
    const allowed = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']);
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExt = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
    if (allowed.has(file.mimetype) && allowedExt.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPG, GIF, or WEBP images are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 
  }
});

const conditionallyHandleSingleUpload = (fieldName) => (req, res, next) => {
  if (req.is('multipart/form-data')) {
    return upload.single(fieldName)(req, res, next);
  }
  return next();
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false' || normalized === '') return false;
  }
  return false;
};

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const parseInteger = (value) => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = parseInt(value, 10);
  return Number.isFinite(num) ? num : undefined;
};

router.get('/', searchLimiter, async (req, res) => {
  try {
    console.log('📦 Fetching products with query:', req.query);
    
    const { category, limit, search, sort, page, stock } = req.query;
    let query = {};

    const categoryAliasMap = {
      'lighting': 'Smart Lighting',
      'smart lighting': 'Smart Lighting',
      'security': 'Security',
      'climate control': 'Climate Control',
      'climate': 'Climate Control',
      'hubs & bridges': 'Hubs & Bridges',
      'hubs': 'Hubs & Bridges',
      'bridges': 'Hubs & Bridges',
      'automation kits': 'Automation Kits',
      'kits': 'Automation Kits'
    };
    
    if (category && category !== '') {
      const normalized = category.toString().trim().toLowerCase();
      const mapped = categoryAliasMap[normalized];
      if (mapped) {
        query.category = mapped; 
      } else {
        
        query.category = new RegExp(`^${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      }
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } }
      ];
    }

    if (stock && stock !== '' && stock !== 'all') {
      switch (stock) {
        case 'in-stock':
          query.$and = query.$and || [];
          query.$and.push({ $or: [{ quantity: { $gt: 10 } }, { stock: { $gt: 10 } }] });
          break;
        case 'low-stock':
          query.$and = query.$and || [];
          query.$and.push({ 
            $and: [
              { $or: [{ quantity: { $gt: 0 } }, { stock: { $gt: 0 } }] },
              { $or: [{ quantity: { $lte: 10 } }, { stock: { $lte: 10 } }] }
            ]
          });
          break;
        case 'out-of-stock':
          query.$and = query.$and || [];
          query.$and.push({ $or: [{ quantity: 0 }, { stock: 0 }, { quantity: { $exists: false } }, { stock: { $exists: false } }] });
          break;
      }
    }
    
    let productsQuery = Product.find(query);
    
    if (sort) {
      const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
      const sortOrder = sort.startsWith('-') ? -1 : 1;
      productsQuery = productsQuery.sort({ [sortField]: sortOrder });
    } else {
      productsQuery = productsQuery.sort('-createdAt');
    }
    
    let totalCount = 0;
    let currentPage = 1;
    let totalPages = 1;

    if (page && limit) {
      const pageNum = Math.max(1, parseInt(page));
      const perPage = Math.max(1, parseInt(limit));
      totalCount = await Product.countDocuments(query);
      totalPages = Math.max(1, Math.ceil(totalCount / perPage));
      currentPage = Math.min(pageNum, totalPages);
      productsQuery = productsQuery.skip((currentPage - 1) * perPage).limit(perPage);
    } else if (limit) {
      productsQuery = productsQuery.limit(parseInt(limit));
    }
    
    const products = await productsQuery;
    
    const formatted = products.map(p => {
      const productObj = p.toObject();
      return {
        ...productObj,
        productId: productObj._id,
        quantity: productObj.quantity || productObj.stockQuantity || productObj.stock || 0
      };
    });
    
    console.log(`✅ Returning ${formatted.length} products`);
    const response = {
      success: true,
      products: formatted,
      productsCount: formatted.length,
      count: formatted.length
    };

    if (page && limit) {
      response.currentPage = currentPage;
      response.totalPages = totalPages;
      response.totalCount = totalCount;
      response.limit = parseInt(limit);
    } else {
      
      response.currentPage = 1;
      response.totalPages = 1;
      response.totalCount = formatted.length;
      response.limit = formatted.length;
    }
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('💥 Error fetching products:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
});

router.get('/image/:id', productController.getProductImage);

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Product API is running',
    timestamp: new Date().toISOString(),
    serverInfo: {
      node: process.version,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }
  });
});

router.get('/debug', async (req, res) => {
  try {
    
    const productCount = await Product.countDocuments();

    const categories = await Product.distinct('category');

    const sampleProduct = await Product.findOne().lean();
    
    res.json({
      success: true,
      debug: {
        productCount,
        categories,
        sampleProduct: sampleProduct ? {
          id: sampleProduct._id,
          name: sampleProduct.name,
          price: sampleProduct.price
        } : null,
        routes: [
          { method: 'GET', path: '/api/products', description: 'Get all products' },
          { method: 'GET', path: '/api/products/:id', description: 'Get a single product' },
          { method: 'GET', path: '/api/products/image/:id', description: 'Get product image' },
          { method: 'GET', path: '/uploads/:filename', description: 'Get uploaded file' }
        ]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error in debug endpoint',
      error: error.message
    });
  }
});

router.get('/test-cloudinary', requireAuth, requireAdmin, productController.testCloudinaryConnection);

router.get('/cloudinary-usage', requireAuth, requireAdmin, productController.getCloudinaryUsage);

router.post('/:id/images/cloudinary', requireAuth, requireAdmin, uploadLimiter, cloudinaryUpload.single('image'), productController.uploadImageToCloudinary);

router.post('/:id/images/cloudinary/batch', requireAuth, requireAdmin, cloudinaryBatchUploadLimiter, cloudinaryUpload.array('images', 5), productController.uploadMultipleImagesToCloudinary);

router.delete('/:id/images/cloudinary', requireAuth, requireAdmin, productController.deleteImageFromCloudinary);

router.get('/:id', searchLimiter, async (req, res) => {
  try {
    console.log('📦 Fetching single product with ID:', req.params.id);
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        product: null
      });
    }
    
    const productObj = product.toObject();
    const formattedProduct = { 
      ...productObj, 
      productId: productObj._id,
      quantity: productObj.quantity || productObj.stockQuantity || productObj.stock || 0,
      
      stock: productObj.stock !== undefined ? productObj.stock : (productObj.quantity || productObj.stockQuantity || 0)
    };
    
    console.log('✅ Returning single product:', formattedProduct.name);
    res.status(200).json({
      success: true,
      product: formattedProduct,
      message: 'Product fetched successfully'
    });
  } catch (error) {
    console.error('💥 Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message,
      product: null
    });
  }
});

router.put('/:id/primary-image', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ success: false, message: 'Image URL required' });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (!Array.isArray(product.images)) product.images = [];

    const urlExists = product.images.some(img => {
      if (typeof img === 'string') {
        return img === url;
      } else if (img && typeof img === 'object' && img.url) {
        return img.url === url;
      }
      return false;
    });

    if (!urlExists) {
      
      if (url.includes('cloudinary')) {
        
        product.images.push({ url });
      } else {
        
        product.images.push(url);
      }
    }

    product.imageUrl = url;
    if (url.startsWith('/uploads/')) {
      product.imageFilename = path.basename(url);
    } else {
      product.imageFilename = undefined; 
    }

    if (url.includes('cloudinary')) {
      product.usingCloudinary = true;
    }

    const targetImage = product.images.find(img => {
      if (typeof img === 'string') {
        return img === url;
      } else if (img && typeof img === 'object' && img.url) {
        return img.url === url;
      }
      return false;
    });

    if (targetImage) {
      
      product.images = product.images.filter(img => {
        if (typeof img === 'string') {
          return img !== url;
        } else if (img && typeof img === 'object' && img.url) {
          return img.url !== url;
        }
        return true;
      });
      
      product.images.unshift(targetImage);
    }

    await product.save();

    console.log('✅ Primary image updated successfully:', { productId: product._id, imageUrl: url });
    return res.json({ success: true, message: 'Primary image updated', product: { ...product.toObject(), productId: product._id } });
  } catch (error) {
    console.error('💥 Error setting primary image:', error);
    res.status(500).json({ success: false, message: 'Error setting primary image', error: error.message });
  }
});

router.post('/', requireAuth, requireAdmin, conditionallyHandleSingleUpload('productImage'), async (req, res) => {
  try {
    console.log('🆕 Creating new product:', req.body);
    
    const { 
      name, category, price, quantity, description, brand, rating,
      sku, currency, metaTitle, metaDescription, tags,
      clearance, discountedPrice, status
    } = req.body;
    
    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name and category are required'
      });
    }

    const normalizedPrice = parseNumber(price);
    const normalizedQuantity = parseInteger(quantity);

    if (normalizedPrice === undefined || normalizedPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid price is required'
      });
    }

    if (normalizedQuantity === undefined || normalizedQuantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }
    
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (e) {
        parsedTags = tags.split(',').map(tag => tag.trim());
      }
    }
    
    const productData = {
      name: name.trim(),
      category,
      price: normalizedPrice,
      quantity: normalizedQuantity,
      stock: normalizedQuantity,
      description: description ? description.toString().trim() : '',
      brand: brand ? brand.toString().trim() : '',
      rating: parseNumber(rating) ?? 0,
      status: status === 'inactive' ? 'inactive' : 'active',
      isActive: status === 'inactive' ? false : true,
      sku: sku ? sku.toString().trim() : `SKU-${Date.now()}`,
      currency: (currency || 'AUD').toString().toUpperCase(),
  tags: Array.isArray(parsedTags) ? parsedTags.map(tag => tag.toString().trim()).filter(Boolean) : [],
      metaTitle: metaTitle ? metaTitle.toString().trim() : undefined,
      metaDescription: metaDescription ? metaDescription.toString().trim() : undefined,
      clearance: parseBoolean(clearance),
      discountedPrice: undefined
    };

    if (productData.clearance) {
      const normalizedDiscount = parseNumber(discountedPrice);
      if (normalizedDiscount === undefined || normalizedDiscount >= productData.price) {
        return res.status(400).json({
          success: false,
          message: 'Valid discounted price lower than original price is required for clearance items'
        });
      }
      productData.discountedPrice = normalizedDiscount;
    }
    
    if (productData.rating < 0) productData.rating = 0;
    if (productData.rating > 5) productData.rating = 5;

    if (req.file) {
      productData.imageFilename = req.file.filename;
      productData.imageUrl = `/uploads/${req.file.filename}`;
      productData.images = [productData.imageUrl];
    }
    
    const product = new Product(productData);
    const savedProduct = await product.save();
    
    console.log('✅ Product created successfully:', savedProduct._id);
    
    const formattedProduct = {
      ...savedProduct.toObject(),
      productId: savedProduct._id,
    };
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product: formattedProduct
    });
  } catch (error) {
    console.error('💥 Error creating product:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
});

router.put('/:id', requireAuth, requireAdmin, conditionallyHandleSingleUpload('productImage'), async (req, res) => {
  try {
    console.log('🔄 Updating product with ID:', req.params.id);

    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const existingProduct = await Product.findById(req.params.id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const {
      name, category, price, quantity, description, brand, rating,
      sku, currency, metaTitle, metaDescription, tags,
      clearance, discountedPrice, status
    } = req.body ?? {};

    const updateMap = {};

    if (name !== undefined) updateMap.name = name.toString().trim();
    if (category !== undefined) updateMap.category = category;
    if (description !== undefined) updateMap.description = description.toString().trim();
    if (brand !== undefined) updateMap.brand = brand.toString().trim();

    if (price !== undefined) {
      const normalizedPrice = parseNumber(price);
      if (normalizedPrice === undefined || normalizedPrice < 0) {
        return res.status(400).json({ success: false, message: 'Valid price is required' });
      }
      updateMap.price = normalizedPrice;
    }

    if (quantity !== undefined) {
      const normalizedQuantity = parseInteger(quantity);
      if (normalizedQuantity === undefined || normalizedQuantity < 0) {
        return res.status(400).json({ success: false, message: 'Valid quantity is required' });
      }
      updateMap.quantity = normalizedQuantity;
      updateMap.stock = normalizedQuantity;
    }

    if (rating !== undefined) {
      const normalizedRating = parseNumber(rating);
      if (normalizedRating === undefined || normalizedRating < 0 || normalizedRating > 5) {
        return res.status(400).json({ success: false, message: 'Rating must be between 0 and 5' });
      }
      updateMap.rating = normalizedRating;
    }

    if (sku !== undefined) updateMap.sku = sku.toString().trim();
    if (currency !== undefined) updateMap.currency = currency.toString().toUpperCase();
    if (metaTitle !== undefined) updateMap.metaTitle = metaTitle.toString().trim();
    if (metaDescription !== undefined) updateMap.metaDescription = metaDescription.toString().trim();

    if (tags !== undefined) {
      try {
        const parsed = typeof tags === 'string' ? JSON.parse(tags) : tags;
        if (Array.isArray(parsed)) {
          updateMap.tags = parsed.map(tag => tag.toString().trim()).filter(Boolean);
        }
      } catch (err) {
        const split = tags.toString().split(',').map(tag => tag.trim()).filter(Boolean);
        if (split.length) updateMap.tags = split;
      }
    }

    if (status !== undefined) {
      const normalizedStatus = status === 'inactive' ? 'inactive' : 'active';
      updateMap.status = normalizedStatus;
      updateMap.isActive = normalizedStatus === 'active';
    }

    const effectivePrice = updateMap.price !== undefined ? updateMap.price : existingProduct.price;

    if (clearance !== undefined) {
      const isClearance = parseBoolean(clearance);
      updateMap.clearance = isClearance;
      if (isClearance) {
        const normalizedDiscount = parseNumber(discountedPrice);
        if (normalizedDiscount === undefined || normalizedDiscount >= effectivePrice) {
          return res.status(400).json({ success: false, message: 'Discounted price must be lower than price' });
        }
        updateMap.discountedPrice = normalizedDiscount;
      } else {
        updateMap.discountedPrice = undefined;
      }
    } else if (discountedPrice !== undefined) {
      if (!existingProduct.clearance) {
        return res.status(400).json({ success: false, message: 'Enable clearance before setting discounted price' });
      }
      const normalizedDiscount = parseNumber(discountedPrice);
      if (normalizedDiscount === undefined || normalizedDiscount >= effectivePrice) {
        return res.status(400).json({ success: false, message: 'Discounted price must be lower than price' });
      }
      updateMap.discountedPrice = normalizedDiscount;
    }

    if (req.file) {
      const newImageUrl = `/uploads/${req.file.filename}`;
      updateMap.imageFilename = req.file.filename;
      updateMap.imageUrl = newImageUrl;
      if (!Array.isArray(existingProduct.images)) existingProduct.images = [];
      if (!existingProduct.images.includes(newImageUrl)) {
        existingProduct.images.push(newImageUrl);
      }
    }

    Object.entries(updateMap).forEach(([key, value]) => {
      existingProduct[key] = value;
    });

    const savedProduct = await existingProduct.save();

    const formattedProduct = {
      ...savedProduct.toObject(),
      productId: savedProduct._id,
      quantity: savedProduct.quantity || savedProduct.stock || 0
    };

    res.json({
      success: true,
      message: 'Product updated successfully',
      product: formattedProduct
    });
  } catch (error) {
    console.error('💥 Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product',
      error: error.message
    });
  }
});

router.delete('/:id', requireAuth, requireAdmin, productController.deleteProduct);

router.delete('/:id/image', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('🗑️ DELETE /products/:id/image endpoint hit:', { 
      productId: req.params.id,
      adminUser: req.user?.email || req.user?.username || 'unknown'
    });
    
    const product = await Product.findById(req.params.id);
    if (!product) {
      console.log('❌ Product not found for ID:', req.params.id);
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    console.log('📸 Current product image info:', {
      imageUrl: product.imageUrl,
      imageFilename: product.imageFilename,
      imagesArray: product.images
    });

    const oldUrl = product.imageUrl;

    if (product.imageFilename) {
      const imagePath = path.join(__dirname, '../../uploads', product.imageFilename);
      console.log('🗂️ Checking for local file at:', imagePath);
      if (fs.existsSync(imagePath)) {
        try { 
          fs.unlinkSync(imagePath);
          console.log('✅ Local file deleted successfully');
        } catch (deleteError) {
          console.log('⚠️ Error deleting local file:', deleteError.message);
        }
      } else {
        console.log('ℹ️ Local file does not exist');
      }
    }

    product.imageUrl = undefined;
    product.imageFilename = undefined;

    if (Array.isArray(product.images) && product.images.length > 0 && oldUrl) {
      const beforeLength = product.images.length;
      product.images = product.images.filter(u => u !== oldUrl);
      console.log(`🔄 Images array updated: ${beforeLength} -> ${product.images.length}`);
    }

    await product.save();
    console.log('✅ Product saved successfully after image removal');

    res.json({ success: true, message: 'Image removed successfully' });
  } catch (error) {
    console.error('💥 Error removing product image:', error);
    res.status(500).json({ success: false, message: 'Error removing image', error: error.message });
  }
});

router.post('/:id/images', requireAuth, requireAdmin, upload.array('images', 10), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No images uploaded' });
    }

    const newUrls = req.files.map(f => `/uploads/${f.filename}`);
    
    if (!Array.isArray(product.images)) product.images = [];
    
    for (const url of newUrls) {
      if (!product.images.includes(url)) product.images.push(url);
    }
    
    if (!product.imageUrl) {
      product.imageUrl = newUrls[0];
      product.imageFilename = req.files[0].filename;
    }
    await product.save();

    res.json({ success: true, message: 'Images added', images: product.images, productId: product._id });
  } catch (error) {
    console.error('💥 Error appending images:', error);
    res.status(500).json({ success: false, message: 'Error appending images', error: error.message });
  }
});

router.delete('/:id/images', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('🗑️ DELETE /products/:id/images endpoint hit:', { 
      productId: req.params.id,
      requestBody: req.body,
      requestQuery: req.query,
      adminUser: req.user?.email || req.user?.username || 'unknown'
    });
    
    const rawUrl = req.body?.url ?? req.query?.url;
    console.log('🔍 Image deletion request details:', {
      productId: req.params.id,
      requestBody: req.body,
      requestQuery: req.query,
      rawUrl: rawUrl,
      hasBodyUrl: !!req.body?.url,
      hasQueryUrl: !!req.query?.url
    });
    
    let decodedUrl = '';
    if (rawUrl) {
      try {
        decodedUrl = decodeURIComponent(rawUrl);
        console.log('✅ URL decoded successfully:', { rawUrl, decodedUrl });
      } catch (err) {
        console.log('⚠️ Failed to decode URL, using raw value', { rawUrl, error: err.message });
        decodedUrl = rawUrl;
      }
    }
    if (!decodedUrl) {
      console.log('❌ No URL provided in request body/query');
      return res.status(400).json({ success: false, message: 'Image URL required' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      console.log('❌ Product not found for ID:', req.params.id);
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    console.log('📸 Current product before deletion:', {
      imageUrl: product.imageUrl,
      imageFilename: product.imageFilename,
      imagesArray: product.images,
      targetUrl: decodedUrl
    });

    if (!Array.isArray(product.images)) product.images = [];
    const before = product.images.length;
    product.images = product.images.filter(u => u !== decodedUrl);

    if (product.imageUrl === decodedUrl) {
      console.log('🎯 Removing primary image via gallery endpoint');
      
      if (product.imageFilename) {
        const imagePath = path.join(__dirname, '../../uploads', product.imageFilename);
        if (fs.existsSync(imagePath)) { 
          try { 
            fs.unlinkSync(imagePath);
            console.log('✅ Primary image local file deleted');
          } catch (deleteError) {
            console.log('⚠️ Error deleting primary image local file:', deleteError.message);
          }
        }
      }
      product.imageUrl = undefined;
      product.imageFilename = undefined;
    } else {
      
      if (decodedUrl.startsWith('/uploads/')) {
        const uploadsDir = path.join(__dirname, '../../uploads');
        const imagePath = path.join(uploadsDir, path.basename(decodedUrl));
        console.log('🗂️ Attempting to delete gallery image file:', imagePath);
        if (fs.existsSync(imagePath)) { 
          try { 
            fs.unlinkSync(imagePath);
            console.log('✅ Gallery image local file deleted');
          } catch (deleteError) {
            console.log('⚠️ Error deleting gallery image local file:', deleteError.message);
          }
        } else {
          console.log('ℹ️ Gallery image local file does not exist');
        }
      }
    }

    await product.save();
    const removed = before - product.images.length;
    console.log(`✅ Product saved. Images removed: ${removed}, New count: ${product.images.length}`);

    res.json({ success: true, message: removed ? 'Image removed' : 'Image not found', images: product.images });
  } catch (error) {
    console.error('💥 Error removing gallery image:', error);
    res.status(500).json({ success: false, message: 'Error removing gallery image', error: error.message });
  }
});

router.put('/:id/images/reorder', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { urls } = req.body || {};
    if (!Array.isArray(urls)) {
      return res.status(400).json({ success: false, message: 'urls array is required' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (!Array.isArray(product.images)) product.images = [];

    const urlSet = new Set(product.images);
    const ordered = urls.filter(u => urlSet.has(u));

    const remaining = product.images.filter(u => !ordered.includes(u));
    product.images = [...ordered, ...remaining];

    if (ordered.length > 0) {
      product.imageUrl = ordered[0];
      product.imageFilename = product.imageUrl.startsWith('/uploads/') ? path.basename(product.imageUrl) : undefined;
    }

    await product.save();
    return res.json({ success: true, message: 'Images reordered', images: product.images, productId: product._id });
  } catch (error) {
    console.error('💥 Error reordering images:', error);
    res.status(500).json({ success: false, message: 'Error reordering images', error: error.message });
  }
});

module.exports = router;
