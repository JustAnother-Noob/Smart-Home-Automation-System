const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },

        quantity: { type: Number, required: true, min: 0 },
        stock: { type: Number, min: 0 }, 

        images: [{
            url: { type: String }, 
            thumbnail: { type: String }, 
            small: { type: String }, 
            medium: { type: String }, 
            large: { type: String }, 
            fileId: { type: String }, 
            width: { type: Number },
            height: { type: Number },
            bytes: { type: Number }
        }],

        imageUrl: { type: String }, 
        imageFilename: { type: String },
        thumbnailUrl: { type: String },
        usingImageKit: { type: Boolean, default: false },
        imageKitFileId: { type: String },
        usingCloudinary: { type: Boolean, default: false },

        rating: { type: Number, default: 0, min: 0, max: 5 },
        numReviews: { type: Number, default: 0, min: 0 },
        salesCount: { type: Number, default: 0, min: 0 },

        category: { 
            type: String, 
            required: true,
            enum: ['Smart Lighting', 'Security', 'Climate Control', 'Hubs & Bridges', 'Automation Kits'] 
        },
        brand: { type: String, trim: true },
        sku: { type: String, trim: true, unique: true, sparse: true },

    status: { type: String, enum: ['active', 'inactive', 'out-of-stock', 'discontinued'], default: 'active' },
        isActive: { type: Boolean, default: true },

        currency: { type: String, default: 'AUD' },
        stockStatus: { type: String, enum: ['in_stock', 'low_stock', 'out_of_stock'], default: 'in_stock' },

        metaTitle: { type: String },
        metaDescription: { type: String },
        tags: [{ type: String }],

        clearance: { type: Boolean, default: false },
        discountedPrice: { 
            type: Number, 
            min: 0,
            validate: {
                validator: function(value) {
                    
                    if (this.clearance && value !== undefined && value !== null) {
                        return value < this.price;
                    }
                    return true;
                },
                message: 'Discounted price must be less than the original price'
            }
        }
    },
    { 
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

productSchema.virtual('stockQuantity').get(function() {
    return this.stock || this.quantity;
});

productSchema.pre('save', function(next) {
    try {
        
        if (this.stock !== undefined && this.stock !== this.quantity) {
            this.quantity = this.stock;
        } else if (this.quantity !== undefined && this.stock === undefined) {
            this.stock = this.quantity;
        }

        if (this.quantity !== undefined && (isNaN(this.quantity) || this.quantity < 0)) {
            this.quantity = 0;
        }

        const qty = this.quantity || 0;
        if (qty <= 0) {
            this.stockStatus = 'out_of_stock';
        } else if (qty <= 10) {
            this.stockStatus = 'low_stock';
        } else {
            this.stockStatus = 'in_stock';
        }

        if (this.status === 'out-of-stock') {
            
            this.status = 'active';
        } else if (this.status === 'discontinued') {
            
            this.status = 'inactive';
        }

        this.isActive = this.status === 'active';

        next();
    } catch (error) {
        console.error('Error in pre-save middleware:', error);
        next(error);
    }
});

productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ isActive: 1 });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;