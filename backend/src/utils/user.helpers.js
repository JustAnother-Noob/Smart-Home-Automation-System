const mongoose = require('mongoose');
const User = require('../models/user.model');

const findUserById = async (userId) => {
    const user = await User.findById(userId);
    return user;
};

const formatUserResponse = (user) => {
    if (!user) return null;
    
    const userData = user.toObject();
    delete userData.password;
    delete userData.otp;
    delete userData.otpExpires;
    delete userData.resetPasswordOTP;
    delete userData.resetPasswordExpires;
    
    return userData;
};

const formatProfilePictureURL = (profilePicture) => {
    if (!profilePicture) return null;

    if (profilePicture.startsWith('http') || profilePicture.startsWith('/uploads/')) {
        return profilePicture;
    }

    return `/uploads/${profilePicture}`;
};

const validateObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

const findAddressById = (user, addressId) => {
    return user.addresses.id(addressId);
};

const validateAddressFields = (addressData) => {
    const { street, suburb, state, zipCode, country } = addressData;
    const missing = [];
    
    if (!street) missing.push('street');
    if (!suburb) missing.push('suburb');
    if (!state) missing.push('state');
    if (!zipCode) missing.push('zipCode');
    if (!country) missing.push('country');
    
    return {
        isValid: missing.length === 0,
        missing,
        message: missing.length > 0 ? `${missing.join(', ')} are required` : null
    };
};

const handleValidationError = (error) => {
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(val => val.message);
        return messages.join(', ');
    }
    return null;
};

const processProfilePicturePath = (file) => {
    if (!file) return null;
    
    try {
        
        const pathParts = file.path.replace(/\\/g, '/').split('uploads/');
        const relativePath = pathParts.length > 1 ? pathParts[1] : file.filename;
        return `/uploads/${relativePath}`;
    } catch (error) {
        console.error('Error processing file path:', error);
        return null;
    }
};

const updateUserProfileFields = (user, updates) => {
    const { firstName, lastName, phone } = updates;
    
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    
    return user;
};

const updateAddressFields = (address, updates) => {
    Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
            address[key] = updates[key];
        }
    });
    return address;
};

const archiveUserData = async (user, deletionReason = null, otherReason = null) => {
    try {
        const ArchivedUser = require('../models/archivedUser.model');
        
        const archiveData = {
            originalUserId: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            provider: user.provider || 'local',
            deletedAt: new Date(),
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 
        };

        if (user.googleId) {
            archiveData.googleId = user.googleId;
        }
        
        if (deletionReason) archiveData.deletionReason = deletionReason;
        if (otherReason) archiveData.otherReason = otherReason;
        
        const archivedUser = new ArchivedUser(archiveData);
        await archivedUser.save();
        
        console.log(`User ${user._id} archived before deletion`);
        return { success: true };
    } catch (error) {
        console.error('Error archiving user data:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
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
};