const { v2: cloudinary } = require('cloudinary');
const sharp = require('sharp');

class ImageUploadService {
  constructor() {
    try {
      
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        console.warn('⚠️ Cloudinary environment variables not found. Cloudinary features will be disabled.');
        this.cloudinary = null;
        this.isAvailable = false;
        return;
      }

      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });

      this.cloudinary = cloudinary;
      this.isAvailable = true;
      console.log('✅ Cloudinary service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Cloudinary service:', error.message);
      this.cloudinary = null;
      this.isAvailable = false;
    }
  }

  async uploadProductImage(imageBuffer, originalName, productId) {
    if (!this.isAvailable) {
      throw new Error('Cloudinary service is not available. Please configure environment variables.');
    }

    try {
      
      const timestamp = Date.now();
      const randomId = Math.round(Math.random() * 1E9);
      const publicId = `smart-home-products/${productId}/${timestamp}-${randomId}`;

      const optimizedBuffer = await sharp(imageBuffer)
        .resize(1200, 1200, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .webp({ quality: 85 })
        .toBuffer();

      const uploadResult = await this.cloudinary.uploader.upload(
        `data:image/webp;base64,${optimizedBuffer.toString('base64')}`,
        {
          public_id: publicId,
          folder: 'smart-home-products',
          resource_type: 'image',
          format: 'webp',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }]
        }
      );

      return {
        fileId: uploadResult.public_id,
        url: uploadResult.secure_url,
        thumbnail: this.generateUrl(uploadResult.public_id, { width: 150, height: 150, crop: 'fill' }),
        small: this.generateUrl(uploadResult.public_id, { width: 300, height: 300, crop: 'fill' }),
        medium: this.generateUrl(uploadResult.public_id, { width: 600, height: 600, crop: 'fill' }),
        large: this.generateUrl(uploadResult.public_id, { width: 1200, height: 1200, crop: 'limit' }),
        width: uploadResult.width,
        height: uploadResult.height,
        bytes: uploadResult.bytes
      };
    } catch (error) {
      console.error('Error uploading image to Cloudinary:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  async uploadMultipleImages(imageBuffers, productId) {
    const uploadPromises = imageBuffers.map(({ buffer, originalName }) => 
      this.uploadProductImage(buffer, originalName, productId)
    );

    try {
      const results = await Promise.all(uploadPromises);
      return results;
    } catch (error) {
      console.error('Error uploading multiple images:', error);
      throw new Error(`Failed to upload images: ${error.message}`);
    }
  }

  generateUrl(publicId, options = {}) {
    if (!this.isAvailable) {
      throw new Error('Cloudinary service is not available');
    }
    return this.cloudinary.url(publicId, {
      fetch_format: 'auto',
      quality: 'auto',
      ...options
    });
  }

  async deleteImage(fileId) {
    if (!this.isAvailable) {
      return {
        success: false,
        message: 'Cloudinary service is not available'
      };
    }

    try {
      const result = await this.cloudinary.uploader.destroy(fileId);
      return {
        success: result.result === 'ok',
        message: result.result === 'ok' ? 'Image deleted successfully' : result.result
      };
    } catch (error) {
      console.error('Error deleting image from Cloudinary:', error);
      return {
        success: false,
        message: `Failed to delete image: ${error.message}`
      };
    }
  }

  async deleteMultipleImages(fileIds) {
    const deletePromises = fileIds.map(fileId => this.deleteImage(fileId));
    
    try {
      const results = await Promise.all(deletePromises);
      return results;
    } catch (error) {
      console.error('Error deleting multiple images:', error);
      throw new Error(`Failed to delete images: ${error.message}`);
    }
  }

  async testConnection() {
    if (!this.isAvailable) {
      return { 
        success: false, 
        message: 'Cloudinary service is not available. Please configure environment variables.',
        error: 'Missing Cloudinary configuration'
      };
    }

    try {
      console.log('🔍 Testing Cloudinary connection...');
      console.log('Cloud name:', process.env.CLOUDINARY_CLOUD_NAME);
      console.log('API key:', process.env.CLOUDINARY_API_KEY ? 'Present' : 'Missing');
      console.log('API secret:', process.env.CLOUDINARY_API_SECRET ? 'Present' : 'Missing');
      
      const result = await this.cloudinary.api.ping();
      console.log('✅ Cloudinary ping successful:', result);
      
      return { 
        success: true, 
        message: 'Cloudinary connection successful', 
        data: result 
      };
    } catch (error) {
      console.error('❌ Cloudinary ping failed:', error);
      return { 
        success: false, 
        message: 'Cloudinary connection failed', 
        error: error.message 
      };
    }
  }

  async getUsageStats() {
    if (!this.isAvailable) {
      return {
        success: false,
        message: 'Cloudinary service is not available',
        error: 'Missing Cloudinary configuration'
      };
    }

    try {
      const result = await this.cloudinary.api.usage();
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get usage statistics',
        error: error.message
      };
    }
  }

  extractFileId(url) {
    if (!url || typeof url !== 'string') return null;
    
    try {
      
      const patterns = [
        /\/v\d+\/(.+)\.(jpg|jpeg|png|gif|webp)/i,
        /\/image\/upload\/v\d+\/(.+)\.(jpg|jpeg|png|gif|webp)/i,
        /\/image\/upload\/(.+)\.(jpg|jpeg|png|gif|webp)/i
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          return match[1];
        }
      }

      return null;
    } catch (error) {
      console.error('Error extracting file ID from URL:', error);
      return null;
    }
  }

  async compressImage(imageBuffer, options = {}) {
    const {
      maxWidth = 1200,
      maxHeight = 1200,
      quality = 85,
      format = 'webp'
    } = options;

    try {
      return await sharp(imageBuffer)
        .resize(maxWidth, maxHeight, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .webp({ quality })
        .toBuffer();
    } catch (error) {
      console.error('Error compressing image:', error);
      throw new Error(`Failed to compress image: ${error.message}`);
    }
  }
}

const imageUploadService = new ImageUploadService();

module.exports = imageUploadService;

