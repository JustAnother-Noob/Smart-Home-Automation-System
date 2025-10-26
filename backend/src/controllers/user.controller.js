const { ResponseUtils, UserHelpers } = require('../utils');
const User = require('../models/user.model');
const fs = require('fs');
const path = require('path');

const {
    findUserById,
    formatUserResponse,
    formatProfilePictureURL,
    validateObjectId,
    findAddressById,
    validateAddressFields,
    handleValidationError,
    processProfilePicturePath,
    updateUserProfileFields,
    updateAddressFields,
    archiveUserData
} = UserHelpers;

exports.getProfile = async (req, res) => {
    try {
        console.log('🔍 [Backend] getProfile called');
        console.log('🔍 [Backend] req.user:', req.user);
        
        const userId = req.user._id || req.user.id;
        console.log('🔍 [Backend] userId:', userId);
        
        const user = await findUserById(userId);
        if (!user) {
            console.log('❌ [Backend] User not found for ID:', userId);
            return ResponseUtils.notFound(res, 'User');
        }
        
        console.log('✅ [Backend] User found:', user.email);
        
        const userData = formatUserResponse(user);
        console.log('📦 [Backend] Formatted user data:', userData);

        if (userData.profilePicture) {
            userData.profilePicture = formatProfilePictureURL(userData.profilePicture);
        }
        
        return ResponseUtils.success(res, userData);
    } catch (error) {
        console.error('❌ [Backend] Error fetching profile:', error);
        return ResponseUtils.error(res, 'Failed to fetch profile');
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const user = await findUserById(userId);
        if (!user) {
            return ResponseUtils.notFound(res, 'User');
        }

        updateUserProfileFields(user, req.body);
        await user.save();

        const userResponse = formatUserResponse(user);
        return ResponseUtils.success(res, userResponse, 'Profile updated successfully');
    } catch (error) {
        console.error('Error updating profile:', error);
        
        const validationError = handleValidationError(error);
        if (validationError) {
            return ResponseUtils.validationError(res, { message: validationError });
        }
        
        return ResponseUtils.error(res, 'Failed to update profile');
    }
};

exports.updateProfilePicture = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const user = await findUserById(userId);
        if (!user) {
            return ResponseUtils.notFound(res, 'User');
        }

        if (!req.file) {
            return ResponseUtils.error(res, 'No image file provided', 400);
        }

        const profilePicturePath = processProfilePicturePath(req.file);
        if (!profilePicturePath) {
            return ResponseUtils.error(res, 'Failed to process uploaded image', 500);
        }

        if (user.profilePicture && user.profilePicture.startsWith('/uploads/')) {
            const oldImagePath = path.join(__dirname, '../../', user.profilePicture);
            if (fs.existsSync(oldImagePath)) {
                try {
                    fs.unlinkSync(oldImagePath);
                    console.log('🗑️ Old profile picture deleted');
                } catch (deleteError) {
                    console.warn('Could not delete old profile picture:', deleteError);
                }
            }
        }

        user.profilePicture = profilePicturePath;
        await user.save();

        const userResponse = formatUserResponse(user);
        userResponse.profilePicture = formatProfilePictureURL(userResponse.profilePicture);

        return ResponseUtils.success(res, userResponse, 'Profile picture updated successfully');
    } catch (error) {
        console.error('Error updating profile picture:', error);
        return ResponseUtils.error(res, 'Failed to update profile picture');
    }
};

exports.getAddresses = async (req, res) => {
    try {
        console.log('🔍 [Backend] getAddresses called');
        console.log('🔍 [Backend] req.user:', req.user);
        
        const user = await findUserById(req.user.id);
        if (!user) {
            console.log('❌ [Backend] User not found for addresses');
            return ResponseUtils.notFound(res, 'User');
        }

        console.log('✅ [Backend] User found for addresses:', user.email);
        console.log('📦 [Backend] User addresses:', user.addresses);

        return ResponseUtils.success(res, { addresses: user.addresses || [] });
    } catch (error) {
        console.error('❌ [Backend] Error fetching addresses:', error);
        return ResponseUtils.error(res, 'Failed to fetch addresses');
    }
};

exports.addAddress = async (req, res) => {
    try {
        const user = await findUserById(req.user.id);
        if (!user) {
            return ResponseUtils.notFound(res, 'User');
        }

        const validation = validateAddressFields(req.body);
        if (!validation.isValid) {
            return ResponseUtils.validationError(res, {
                field: 'address',
                message: validation.message
            });
        }

        user.addresses.push(req.body);
        await user.save();

        const newAddress = user.addresses[user.addresses.length - 1];
        return ResponseUtils.success(res, { address: newAddress }, 'Address added successfully', 201);
    } catch (error) {
        console.error('Error adding address:', error);
        
        const validationError = handleValidationError(error);
        if (validationError) {
            return ResponseUtils.validationError(res, { message: validationError });
        }
        
        return ResponseUtils.error(res, 'Failed to add address');
    }
};

exports.updateAddress = async (req, res) => {
    try {
        const { addressId } = req.params;

        if (!validateObjectId(addressId)) {
            return ResponseUtils.error(res, 'Invalid address ID', 400);
        }

        const user = await findUserById(req.user.id);
        if (!user) {
            return ResponseUtils.notFound(res, 'User');
        }

        const address = findAddressById(user, addressId);
        if (!address) {
            return ResponseUtils.notFound(res, 'Address');
        }

        updateAddressFields(address, req.body);
        await user.save();

        return ResponseUtils.success(res, { address }, 'Address updated successfully');
    } catch (error) {
        console.error('Error updating address:', error);
        
        const validationError = handleValidationError(error);
        if (validationError) {
            return ResponseUtils.validationError(res, { message: validationError });
        }
        
        return ResponseUtils.error(res, 'Failed to update address');
    }
};

exports.deleteAddress = async (req, res) => {
    try {
        const { addressId } = req.params;

        if (!validateObjectId(addressId)) {
            return ResponseUtils.error(res, 'Invalid address ID', 400);
        }

        const user = await findUserById(req.user.id);
        if (!user) {
            return ResponseUtils.notFound(res, 'User');
        }

        const address = findAddressById(user, addressId);
        if (!address) {
            return ResponseUtils.notFound(res, 'Address');
        }

        user.addresses.pull(addressId);
        await user.save();

        return ResponseUtils.success(res, null, 'Address deleted successfully');
    } catch (error) {
        console.error('Error deleting address:', error);
        return ResponseUtils.error(res, 'Failed to delete address');
    }
};

exports.requestAccountDeletion = async (req, res) => {
    try {
        const { reason, otherReason } = req.body;
        const user = await findUserById(req.user.id);
        
        if (!user) {
            return ResponseUtils.notFound(res, 'User');
        }

        const archiveResult = await archiveUserData(user, reason, otherReason);
        if (!archiveResult.success) {
            console.error('Failed to archive user data:', archiveResult.error);
            return ResponseUtils.error(res, 'Failed to process account deletion request');
        }

        await User.findByIdAndDelete(req.user.id);
        
        console.log(`User account deleted: ${user.email} (${user._id})`);
        return ResponseUtils.success(res, null, 'Account deleted successfully. We\'re sorry to see you go!');
    } catch (error) {
        console.error('Error deleting account:', error);
        return ResponseUtils.error(res, 'Failed to delete account');
    }
};