const Product = require('../models/product.model');
const fs = require('fs');
const path = require('path');
const imageUploadService = require('../services/imageUpload.service');

exports.createProduct = async (req, res) => {
    try {
        const { 
            name, 
            description, 
            price, 
            quantity, 
            stock,
            category,
            status = 'active',
            tags,
            clearance,
            discountedPrice
        } = req.body;

        const productQuantity = stock !== undefined ? stock : quantity;
        
        if (!name || !category || price === undefined || productQuantity === undefined) {
            return res.status(400).json({ 
                success: false, 
                message: 'Name, category, price, and quantity/stock are required.' 
            });
        }

        const productData = {
            name: name.trim(),
            description: description || '',
            price: parseFloat(price),
            quantity: parseInt(productQuantity),
            stock: parseInt(productQuantity),
            category: category.trim(),
            status: status.trim(),
            tags: Array.isArray(tags) ? tags : (tags ? [tags] : []),
            clearance: clearance === 'true' || clearance === true,
            discountedPrice: (clearance === 'true' || clearance === true) && discountedPrice ? parseFloat(discountedPrice) : undefined
        };

        const product = await Product.create(productData);

        if (req.file) {

            product.imageUrl = `/uploads/${req.file.filename}`;
            await product.save();
        }

        res.status(201).json({ 
            success: true, 
            product: {
                ...product.toObject(),
                productId: product._id
            },
            message: 'Product created successfully'
        });
    } catch (err) {
        console.error('Product creation error:', err);

        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.warn('Could not clean up file:', cleanupError);
            }
        }
        
        if (err.code === 11000) {
            return res.status(400).json({ 
                success: false, 
                message: 'Product with this SKU already exists' 
            });
        }
        res.status(500).json({ 
            success: false, 
            message: 'Server error while creating product',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

exports.getProducts = async (req, res) => {
    try {
        const { category, search, limit, sort } = req.query;
        let query = {};

        if (category && category !== '') {
            
            const escapedCategory = category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.category = { $regex: new RegExp(`^${escapedCategory}$`, 'i') };
            console.log(`🔍 [Backend] Category filter applied: "${category}" (escaped: "${escapedCategory}")`);
        } else {
            console.log('🔍 [Backend] No category filter - returning all products');
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } }
            ];
        }

        console.log('🔍 [Backend] MongoDB Query:', JSON.stringify(query, null, 2));

        let productsQuery = Product.find(query);

        if (sort) {
            const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
            const sortOrder = sort.startsWith('-') ? -1 : 1;
            productsQuery = productsQuery.sort({ [sortField]: sortOrder });
        } else {
            productsQuery = productsQuery.sort({ createdAt: -1 });
        }

        if (limit) {
            productsQuery = productsQuery.limit(parseInt(limit));
        }

        const products = await productsQuery;

        if (products.length > 0) {
            const sampleCategories = products.slice(0, 3).map(p => p.category);
            console.log(`📦 [Backend] First 3 product categories:`, sampleCategories);
        }

        const formattedProducts = products.map(product => ({
            ...product.toObject(),
            productId: product._id,
            
            stock: product.stock || product.quantity
        }));

        console.log(`✅ [Backend] Products fetched: ${formattedProducts.length} (category filter: ${category || 'none'})`);
        res.json({ 
            success: true, 
            products: formattedProducts,
            count: formattedProducts.length
        });
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching products',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

exports.getProductImage = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        if (product.imageUrl && product.imageUrl.startsWith('/uploads/')) {
            const imagePath = path.join(__dirname, '../../uploads', path.basename(product.imageUrl));
            
            if (fs.existsSync(imagePath)) {
                return res.sendFile(imagePath);
            }
        }

        if (product.image && product.image.data) {
            res.set('Content-Type', product.image.contentType);
            return res.send(product.image.data);
        }

        const placeholderPath = path.join(__dirname, '../../uploads/placeholder.png');
        if (fs.existsSync(placeholderPath)) {
            return res.sendFile(placeholderPath);
        }
        
        res.status(404).json({
            success: false,
            message: 'No image available'
        });
        
    } catch (err) {
        console.error('Image fetch error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching image'
        });
    }
};

exports.getProductById = async (req, res) => {
    try {
        console.log('🔍 Fetching product by ID:', req.params.id);
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            console.log('❌ Product not found for ID:', req.params.id);
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        console.log('✅ Product found:', product.name);
        const responseData = {
            success: true,
            product: {
                ...product.toObject(),
                productId: product._id,
                stock: product.stock || product.quantity
            }
        };
        
        console.log('📤 Sending product data:', responseData);
        res.json(responseData);
    } catch (err) {
        console.error('💥 Product fetch error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching product',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            name, 
            description, 
            price, 
            quantity, 
            stock,
            category,
            status,
            tags,
            clearance,
            discountedPrice
        } = req.body;

        const productQuantity = stock !== undefined ? stock : quantity;

        const updateData = {
            name: name ? name.trim() : undefined,
            description,
            price: price !== undefined ? parseFloat(price) : undefined,
            quantity: productQuantity !== undefined ? parseInt(productQuantity) : undefined,
            stock: productQuantity !== undefined ? parseInt(productQuantity) : undefined,
            category: category ? category.trim() : undefined,
            status: status ? status.trim() : undefined,
            tags: Array.isArray(tags) ? tags.map(tag => String(tag).trim()).filter(tag => tag) : (tags ? [String(tags).trim()] : undefined),
            clearance: clearance !== undefined ? (clearance === 'true' || clearance === true) : undefined,
            discountedPrice: clearance !== undefined ? 
                ((clearance === 'true' || clearance === true) && discountedPrice ? parseFloat(discountedPrice) : null) 
                : undefined
        };

        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        });

        if (req.file) {
            const product = await Product.findById(id);
            if (!product) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Product not found' 
                });
            }

            updateData.imageUrl = `/uploads/${req.file.filename}`;
        }

        const product = await Product.findByIdAndUpdate(id, updateData, { 
            new: true, 
            runValidators: true 
        });
        
        if (!product) {
            return res.status(404).json({ 
                success: false, 
                message: 'Product not found' 
            });
        }

        res.json({ 
            success: true, 
            product: {
                ...product.toObject(),
                productId: product._id,
                stock: product.stock || product.quantity
            },
            message: 'Product updated successfully'
        });
    } catch (err) {
        console.error('Product update error:', err);

        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.warn('Could not clean up file:', cleanupError);
            }
        }
        
        if (err.code === 11000) {
            return res.status(400).json({ 
                success: false, 
                message: 'Product with this SKU already exists' 
            });
        }
        res.status(500).json({ 
            success: false, 
            message: 'Server error while updating product',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

exports.updateStock = async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity, stock } = req.body;

        const newQuantity = stock !== undefined ? parseInt(stock) : parseInt(quantity);
        
        if (isNaN(newQuantity) || newQuantity < 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Valid quantity/stock value required' 
            });
        }

        const product = await Product.findByIdAndUpdate(
            id, 
            { 
                quantity: newQuantity,
                stock: newQuantity
            }, 
            { new: true, runValidators: true }
        );
        
        if (!product) {
            return res.status(404).json({ 
                success: false, 
                message: 'Product not found' 
            });
        }

        res.json({ 
            success: true, 
            product: {
                ...product.toObject(),
                productId: product._id,
                stock: product.stock || product.quantity
            },
            message: 'Stock updated successfully'
        });
    } catch (err) {
        console.error('Stock update error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while updating stock',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

        const uploadsDir = path.join(__dirname, '../../uploads');

        if (product.imageFilename) {
            const imagePath = path.join(uploadsDir, product.imageFilename);
            if (fs.existsSync(imagePath)) {
                try {
                    fs.unlinkSync(imagePath);
                    console.log('✅ Primary image file deleted:', product.imageFilename);
                } catch (deleteError) {
                    console.log('⚠️ Error deleting primary image file:', deleteError.message);
                }
            }
        }

        if (Array.isArray(product.images)) {
            product.images.forEach(url => {
                if (url.startsWith('/uploads/')) {
                    const imagePath = path.join(uploadsDir, path.basename(url));
                    if (fs.existsSync(imagePath)) {
                        try {
                            fs.unlinkSync(imagePath);
                            console.log('✅ Gallery image file deleted:', path.basename(url));
                        } catch (deleteError) {
                            console.log('⚠️ Error deleting gallery image file:', deleteError.message);
                        }
                    }
                }
            });
        }

        await Product.findByIdAndDelete(id);
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (err) {
        console.error('Error deleting product:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.uploadImageToCloudinary = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);
        
        if (!product) {
            return res.status(404).json({ 
                success: false, 
                message: 'Product not found' 
            });
        }

        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'No image file provided' 
            });
        }

        const imageResult = await imageUploadService.uploadProductImage(
            req.file.buffer,
            req.file.originalname,
            id
        );

        if (!Array.isArray(product.images)) {
            product.images = [];
        }
        product.images.push(imageResult);

        if (!product.imageUrl) {
            product.imageUrl = imageResult.url;
            product.usingCloudinary = true;
        }

        await product.save();

        res.json({
            success: true,
            message: 'Image uploaded successfully',
            image: imageResult,
            product: {
                ...product.toObject(),
                productId: product._id
            }
        });
    } catch (error) {
        console.error('Error uploading image to Cloudinary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload image',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.uploadMultipleImagesToCloudinary = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);
        
        if (!product) {
            return res.status(404).json({ 
                success: false, 
                message: 'Product not found' 
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No image files provided' 
            });
        }

        const imageBuffers = req.files.map(file => ({
            buffer: file.buffer,
            originalName: file.originalname
        }));

        const imageResults = await imageUploadService.uploadMultipleImages(imageBuffers, id);

        if (!Array.isArray(product.images)) {
            product.images = [];
        }
        product.images.push(...imageResults);

        if (!product.imageUrl && imageResults.length > 0) {
            product.imageUrl = imageResults[0].url;
            product.usingCloudinary = true;
        }

        await product.save();

        res.json({
            success: true,
            message: `${imageResults.length} images uploaded successfully`,
            images: imageResults,
            product: {
                ...product.toObject(),
                productId: product._id
            }
        });
    } catch (error) {
        console.error('Error uploading multiple images to Cloudinary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload images',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.deleteImageFromCloudinary = async (req, res) => {
    try {
        const { id } = req.params;
        const { fileId, url } = req.body;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ 
                success: false, 
                message: 'Product not found' 
            });
        }

        let targetFileId = fileId;

        if (!targetFileId && url) {
            targetFileId = imageUploadService.extractFileId(url);
        }

        if (!targetFileId) {
            return res.status(400).json({ 
                success: false, 
                message: 'File ID or valid URL required' 
            });
        }

        const deleteResult = await imageUploadService.deleteImage(targetFileId);

        if (!deleteResult.success) {
            return res.status(400).json({
                success: false,
                message: deleteResult.message
            });
        }

        if (Array.isArray(product.images)) {
            product.images = product.images.filter(img => img.fileId !== targetFileId);
        }

        if (product.imageUrl && product.imageUrl.includes(targetFileId)) {
            product.imageUrl = product.images.length > 0 ? product.images[0].url : null;
        }

        await product.save();

        res.json({
            success: true,
            message: 'Image deleted successfully',
            product: {
                ...product.toObject(),
                productId: product._id
            }
        });
    } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete image',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.testCloudinaryConnection = async (req, res) => {
    try {
        console.log('🔍 Testing Cloudinary connection from controller...');

        if (!imageUploadService) {
            throw new Error('Image upload service not initialized');
        }
        
        const result = await imageUploadService.testConnection();
        console.log('📊 Cloudinary test result:', result);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Cloudinary connection successful',
                data: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Cloudinary connection failed',
                error: result.error
            });
        }
    } catch (error) {
        console.error('❌ Error testing Cloudinary connection:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to test Cloudinary connection',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getCloudinaryUsage = async (req, res) => {
    try {
        const result = await imageUploadService.getUsageStats();
        
        if (result.success) {
            res.json({
                success: true,
                data: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to get usage statistics',
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error getting Cloudinary usage:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get usage statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};