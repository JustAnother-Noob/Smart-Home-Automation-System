const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const ArchivedUser = require('../models/archivedUser.model');
const { sendOTPEmail } = require('../services/email.services');
const { JWT_SECRET } = require('../config/constants');

const generateOTP = () => {
    const otp = crypto.randomInt(100000, 999999); 
    return otp.toString(); 
};

const getOTPExpiration = (minutes = 5) => {
    return new Date(Date.now() + minutes * 60 * 1000);
};

const normalizeEmail = (email) => {
    return email.toLowerCase();
};

const generateJWTToken = ({ _id, email, firstName, lastName, role }) => {
    if (!JWT_SECRET) {
        console.error("JWT_SECRET is not defined!"); 
        throw new Error('JWT_SECRET is not defined');
    }

    if (JWT_SECRET.length < 32) {
        console.warn("⚠️  JWT_SECRET is short (< 32 chars). Consider using a longer secret for better security.");
    }

    return jwt.sign(
        { id: _id, email, firstName, lastName, role },
        JWT_SECRET,
        { expiresIn: '24h' } 
    );
};

const getRedirectURL = (role, defaultPath = "index.html") =>
    role === "admin" ? "adminHome.html" : defaultPath; 

const resetFailedLoginAttempts = (user) => {
    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;
};

const formatUserResponse = (user) => {
    return {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
    };
};

const sendOTPWithErrorHandling = async (email, otp, type = 'signup') => {
    try {
        return await sendOTPEmail(email, otp, type);
    } catch (error) {
        console.error(`Email failed for ${email}: ${error.message}`);
        return false;
    }
};

const saveOTPToUser = async (user, otp, normalMinutes = 10, fallbackMinutes = 30, emailSent = true) => {
    try {
        
        user.otp = null;
        user.otpExpires = null;

        const hashedOTP = await bcrypt.hash(otp.toString(), 10);

        user.otp = hashedOTP;
        user.otpExpires = getOTPExpiration(emailSent ? normalMinutes : fallbackMinutes);

        await user.save();
        console.log(`OTP saved for user ${user.email} with ${emailSent ? normalMinutes : fallbackMinutes} minute expiry`);
    } catch (error) {
        console.error(`Failed to save OTP for user ${user.email}: ${error.message}`);
        throw new Error('Error saving OTP');
    }
};

const isUserArchived = async (email, googleId = null) => {
    const normalizedEmail = normalizeEmail(email);

    const query = googleId
        ? { $or: [{ email: normalizedEmail }, { googleId }] }
        : { email: normalizedEmail };

    const archivedUser = await ArchivedUser.findOne(query);
    return !!archivedUser; 
};

const findUserWithValidOTP = async (email) => {
    try {
        const user = await User.findOne({
            email: normalizeEmail(email),
            otpExpires: { $gt: Date.now() }
        });

        if (!user) {
            console.log(`No valid OTP for email: ${email} (Either OTP expired or email not found)`);
            return null;
        }

        return user;
    } catch (error) {
        console.error(`Error finding user with valid OTP for email ${email}:`, error);
        throw new Error('Error finding user with valid OTP');
    }
};

const clearUserOTP = async (user, isPasswordReset = false) => {
    try {
        if (isPasswordReset) {
            user.resetPasswordOTP = null;
            user.resetPasswordExpires = null;
            
        } else {
            user.otp = null;
            user.otpExpires = null;
            user.isVerified = true;  
        }

        await user.save();
        console.log(`OTP cleared for user ${user.email}${isPasswordReset ? ' (password reset)' : ', marked as verified'}`);
    } catch (error) {
        console.error('Error saving user after clearing OTP:', error);
        throw new Error('Failed to clear OTP and update user');
    }
};

const handleMongoError = (error) => {
    if (error.code === 11000) {
        return 'Email already exists';
    }
    return null;
};

const calculateLockoutMinutes = (lockoutUntil) => {
    return Math.ceil((lockoutUntil - Date.now()) / 60000);
};

module.exports = {
    generateOTP,
    getOTPExpiration,
    normalizeEmail,
    generateJWTToken,
    getRedirectURL,
    resetFailedLoginAttempts,
    formatUserResponse,
    sendOTPWithErrorHandling,
    saveOTPToUser,
    isUserArchived,
    findUserWithValidOTP,
    clearUserOTP,
    handleMongoError,
    calculateLockoutMinutes
};