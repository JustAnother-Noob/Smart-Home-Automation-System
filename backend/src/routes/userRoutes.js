const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const User = require('../models/user.model'); 
const { requireAuth } = require('../middlewares/auth.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`Created uploads directory at: ${uploadsDir}`);
} else {
  console.log(`Uploads directory exists at: ${uploadsDir}`);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      cb(null, uploadsDir);
    } catch (err) {
      console.error("Error with uploads directory:", err);
      cb(new Error("Failed to access uploads directory"), null);
    }
  },
  filename: function (req, file, cb) {
    try {

      const fileExt = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, fileExt)
        .replace(/\s+/g, '-')
        .replace(/[^\w.-]/g, '');
        
      cb(null, `${baseName}-${Date.now()}${fileExt}`);
    } catch (err) {
      console.error("Error generating filename:", err);
      cb(new Error("Failed to generate safe filename"), null);
    }
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPG, PNG, GIF, etc.)'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 
  }
}).single('profilePicture');

const handleUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      
      console.error("Multer error:", err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          success: false, 
          message: "File too large. Maximum size is 5MB." 
        });
      }
      return res.status(400).json({ 
        success: false, 
        message: `Upload error: ${err.message}` 
      });
    } else if (err) {
      
      console.error("Unknown upload error:", err);
      return res.status(500).json({ 
        success: false, 
        message: err.message 
      });
    }

    if (!req.file) {
      console.log("No file uploaded");
    } else {
      console.log("File uploaded successfully:", req.file.path);
    }
    
    next();
  });
};

router.get('/profile', requireAuth, userController.getProfile);

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const userId = req.user._id || req.user.id;

    if (!firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'First name and last name are required'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone ? phone.trim() : undefined
      },
      { new: true, runValidators: true }
    ).select('firstName lastName email phone profilePicture');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('✅ User profile updated:', { userId, firstName, lastName, phone });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });

  } catch (error) {
    console.error('❌ Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

router.put('/profile-picture', requireAuth, handleUpload, userController.updateProfilePicture);

router.get('/addresses', requireAuth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).select('addresses');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.addresses || [], 
      message: 'Addresses retrieved successfully'
    });
    
  } catch (error) {
    console.error('❌ Error fetching addresses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve addresses'
    });
  }
});

router.post('/addresses', requireAuth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { street, apartmentSuite, suburb, state, zipCode, country, isPrimary } = req.body;

    if (!street || !suburb || !state || !zipCode) {
      return res.status(400).json({
        success: false,
        message: 'Street, suburb, state, and postcode are required'
      });
    }

    const isDuplicate = user.addresses.some(addr => 
      addr.street.toLowerCase().trim() === street.toLowerCase().trim() &&
      addr.suburb.toLowerCase().trim() === suburb.toLowerCase().trim() &&
      addr.state.toLowerCase().trim() === state.toLowerCase().trim() &&
      addr.zipCode.trim() === zipCode.trim() &&
      (addr.apartmentSuite || '').toLowerCase().trim() === (apartmentSuite || '').toLowerCase().trim()
    );

    if (isDuplicate) {
      return res.status(400).json({
        success: false,
        message: 'This address already exists in your saved addresses'
      });
    }

    if (isPrimary) {
      user.addresses.forEach(addr => {
        addr.isPrimary = false;
      });
    }

    const newAddress = {
      street: street.trim(),
      apartmentSuite: apartmentSuite ? apartmentSuite.trim() : '',
      suburb: suburb.trim(),
      state: state.trim(),
      zipCode: zipCode.trim(),
      country: country ? country.trim() : 'Australia',
      isPrimary: isPrimary || user.addresses.length === 0 
    };

    user.addresses.push(newAddress);
    await user.save();

    const savedAddress = user.addresses[user.addresses.length - 1];

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: savedAddress
    });

  } catch (error) {
    console.error('❌ Error adding address:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add address'
    });
  }
});

router.put('/addresses/:addressId', requireAuth, async (req, res) => {
  try {
    const { addressId } = req.params;
    const { street, apartmentSuite, suburb, state, zipCode, country, isPrimary } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    if (!street || !suburb || !state || !zipCode) {
      return res.status(400).json({
        success: false,
        message: 'Street, suburb, state, and postcode are required'
      });
    }

    const isDuplicate = user.addresses.some(addr => 
      addr._id.toString() !== addressId &&
      addr.street.toLowerCase().trim() === street.toLowerCase().trim() &&
      addr.suburb.toLowerCase().trim() === suburb.toLowerCase().trim() &&
      addr.state.toLowerCase().trim() === state.toLowerCase().trim() &&
      addr.zipCode.trim() === zipCode.trim() &&
      (addr.apartmentSuite || '').toLowerCase().trim() === (apartmentSuite || '').toLowerCase().trim()
    );

    if (isDuplicate) {
      return res.status(400).json({
        success: false,
        message: 'This address already exists in your saved addresses'
      });
    }

    if (isPrimary) {
      user.addresses.forEach(addr => {
        if (addr._id.toString() !== addressId) {
          addr.isPrimary = false;
        }
      });
    }

    address.street = street.trim();
    address.apartmentSuite = apartmentSuite ? apartmentSuite.trim() : '';
    address.suburb = suburb.trim();
    address.state = state.trim();
    address.zipCode = zipCode.trim();
    address.country = country ? country.trim() : 'Australia';
    address.isPrimary = isPrimary || false; 

    await user.save();

    res.json({
      success: true,
      message: 'Address updated successfully',
      data: address
    });

  } catch (error) {
    console.error('❌ Error updating address:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update address'
    });
  }
});

router.delete('/addresses/:addressId', requireAuth, async (req, res) => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    const wasPrimary = user.addresses[addressIndex].isPrimary;

    user.addresses.splice(addressIndex, 1);

    if (wasPrimary && user.addresses.length > 0) {
      user.addresses[0].isPrimary = true;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Address deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting address:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete address'
    });
  }
});

router.post('/delete-account', requireAuth, userController.requestAccountDeletion);

module.exports = router;
module.exports = router;
