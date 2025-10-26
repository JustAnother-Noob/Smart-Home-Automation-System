const bcrypt = require('bcryptjs');
const { ResponseUtils, AuthHelpers } = require('../utils');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/user.model');
const ArchivedUser = require('../models/archivedUser.model');
const { validateEmail, validatePassword } = require('../middlewares/validators');
const { sendWelcomeEmail, sendFailedLoginAttemptEmail, sendPasswordChangedEmail } = require('../services/email.services');
const axios = require('axios'); 
const { GOOGLE_CLIENT_ID, RECAPTCHA, NODE_ENV } = require('../config/constants'); 

const {
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
} = AuthHelpers;

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const signup = async (req, res) => {
    
    const { firstName, lastName, email, password } = req.body;
    const lowerEmail = normalizeEmail(email);

    try {
        
        if (!validateEmail(lowerEmail)) {
            return ResponseUtils.error(res, 'Invalid email format', 400, 'email');
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return ResponseUtils.validationError(res, {
                field: 'password',
                message: 'Password requirements not met',
                requirements: passwordValidation.requirements
            });
        }

        const existingUser = await User.findOne({ email: lowerEmail });
        const isArchived = await isUserArchived(lowerEmail);

        if (existingUser || isArchived) {
            console.log(`Blocked signup for existing/archived email: ${lowerEmail}`);
            return ResponseUtils.conflict(res, 'Email not available for signup');
        }

        const otp = generateOTP();
        if (NODE_ENV !== 'production') {
            console.log(`Generated OTP for signup: ${otp}`);
        }
        const hashedOTP = await bcrypt.hash(otp, 10);
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            firstName,
            lastName,
            email: lowerEmail,
            password: hashedPassword,
            otp: hashedOTP,
            otpExpires: getOTPExpiration(5) 
        });
        await newUser.save();

        const emailSent = await sendOTPWithErrorHandling(lowerEmail, otp);

        if (!emailSent) {
            await saveOTPToUser(newUser, otp, 5, 30, false);
        }

        return ResponseUtils.success(res, {
            email: lowerEmail,
            emailSent,
            
            redirect: `html/user_otp-verify.html?email=${encodeURIComponent(lowerEmail)}`
        }, emailSent 
            ? 'Account created! Check your email for verification code.' 
            : 'Account created but email delivery failed. Try resending the code.', 201);

    } catch (error) {
        console.error('Signup error:', error);

        const mongoError = handleMongoError(error);
        if (mongoError) return ResponseUtils.conflict(res, mongoError);
        
        return ResponseUtils.error(res, 'Registration failed. Please try again.');
    }
};

const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const lowerEmail = normalizeEmail(email);

        const user = await findUserWithValidOTP(lowerEmail);

        if (!user) {
            return ResponseUtils.error(res, "OTP expired or email not found", 400);
        }

        const isMatch = await bcrypt.compare(otp, user.otp);

        if (!isMatch) {
            return ResponseUtils.error(res, "Invalid OTP code", 400);
        }

        clearUserOTP(user);

        const token = generateJWTToken(user);

        sendWelcomeEmail(user).catch(err => {
            console.error('Welcome email error:', err);
        });

        return ResponseUtils.success(res, {
            token,
            role: user.role,
            redirect: getRedirectURL(user.role, "./login.html")
        }, "Email verified successfully!");

    } catch (error) {
        console.error('OTP Verification Error:', error);
        return ResponseUtils.error(res, "Verification failed. Please try again.");
    }
};

const resendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const lowerEmail = normalizeEmail(email);

        const user = await User.findOne({ 
            email: lowerEmail,
            isVerified: false
        });

        if (!user) {
            return ResponseUtils.error(res, "User not found or already verified", 400);
        }

        const newOTP = generateOTP();
        const emailSent = await sendOTPWithErrorHandling(lowerEmail, newOTP);

        await saveOTPToUser(user, newOTP, 10, 30, emailSent);

        if (emailSent) {
            return ResponseUtils.success(res, null, "New OTP has been sent to your email");
        } else {
            return ResponseUtils.error(res, "Email service is unavailable. Please try again later.", 503);
        }

    } catch (error) {
        console.error('Resend OTP error:', error);
        return ResponseUtils.error(res, "Failed to resend OTP. Please try again later.");
    }
};

const login = async (req, res) => {
    const MAX_FAILED_ATTEMPTS = 50;
    const LOCKOUT_DURATION = 1 * 60 * 1000;

    try {
        const { email, password, recaptchaToken } = req.body;
        console.log(`🔐 Login attempt for email: ${email}`);
        const lowerEmail = normalizeEmail(email);

        const isDevelopment = NODE_ENV === 'development' || !NODE_ENV;
        if (!isDevelopment && !(NODE_ENV === 'test' || RECAPTCHA.skipValidation)) {
            if (!recaptchaToken) {
                console.log('Login failed: Missing reCAPTCHA token');
                return res.status(400).json({
                    success: false,
                    message: 'Security check required.',
                    errorType: 'recaptcha_failed'
                });
            }
            try {
                const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA.secretKey}&response=${recaptchaToken}`;
                const { data } = await axios.post(verifyURL);
                if (!data.success) {
                    return res.status(403).json({
                        success: false,
                        message: 'reCAPTCHA verification failed.',
                        errorType: 'recaptcha_failed'
                    });
                }
            } catch (e) {
                console.error('reCAPTCHA verify error:', e.message);
                return res.status(500).json({
                    success: false,
                    message: 'Security verification error.',
                    errorType: 'recaptcha_failed'
                });
            }
        } else {
            console.log('⚠️ Skipping reCAPTCHA validation (development mode)');
        }

        if (await isUserArchived(lowerEmail)) {
            console.log(`❌ Login failed: User ${lowerEmail} is archived`);
            return res.status(403).json({
                success: false,
                message: "Your account has been archived. Please contact support.",
                errorType: "account_archived",
                email: lowerEmail
            });
        }

        const user = await User.findOne({ email: lowerEmail });
        if (!user) {
            console.log(`❌ Login failed: User ${lowerEmail} not found in database`);

            const similarUsers = await User.find({ 
                email: { $regex: new RegExp(lowerEmail.split('@')[0], 'i') } 
            }).select('email');
            console.log(`🔍 Found similar emails in DB:`, similarUsers.map(u => u.email));
            
            return ResponseUtils.unauthorized(res, "Invalid credentials");
        }

        console.log(`✅ Found user: ${user.email}`);
        console.log(`📋 User details:`, {
            id: user._id,
            email: user.email,
            isVerified: user.isVerified,
            role: user.role,
            failedAttempts: user.failedLoginAttempts || 0,
            hasPassword: !!user.password,
            passwordLength: user.password ? user.password.length : 0,
            lockoutUntil: user.lockoutUntil,
            provider: user.provider || 'local'
        });

        if (user.lockoutUntil && user.lockoutUntil > Date.now()) {
            const minutesLeft = calculateLockoutMinutes(user.lockoutUntil);
            console.log(`❌ Login failed: User ${lowerEmail} is locked for ${minutesLeft} minutes`);
            return res.status(429).json({
                success: false,
                message: `Account locked. Try again in ${minutesLeft} minute(s).`,
                errorType: "account_locked",
                lockoutMinutes: minutesLeft
            });
        }

        if (!user.password) {
            console.log(`❌ Login failed: User ${lowerEmail} has no password (might be Google-only account)`);
            return ResponseUtils.unauthorized(res, "Invalid credentials. Try signing in with Google if you used Google to register.");
        }

        if (!user.isVerified) {
            console.log(`⚠️ User ${lowerEmail} is not verified, sending new OTP`);
            const newOTP = generateOTP();
            if (NODE_ENV !== 'production') {
                console.log(`📧 Generated verification OTP for ${lowerEmail}: ${newOTP}`);
            }
            const emailSent = await sendOTPWithErrorHandling(lowerEmail, newOTP);
            await saveOTPToUser(user, newOTP, 10, 30, emailSent);

            const expiresAt = user.otpExpires;
            const remainingMs = expiresAt ? (expiresAt.getTime() - Date.now()) : 0;
            const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60000));

            return res.status(403).json({
                success: false,
                message: emailSent
                    ? "Email not verified. Verification code resent."
                    : "Email not verified. Failed to send verification code. Try again later.",
                errorType: "email_verification_required",
                email: lowerEmail,
                emailSent,
                otpExpiresAt: expiresAt,
                otpExpiresInMinutes: remainingMinutes
            });
        }

        console.log(`🔑 Checking password for ${lowerEmail}...`);
        console.log(`📝 Password provided: ${password ? 'Yes' : 'No'} (length: ${password ? password.length : 0})`);
        console.log(`🗃️ Stored password hash: ${user.password ? 'Yes' : 'No'} (length: ${user.password ? user.password.length : 0})`);
        
        const isMatch = await bcrypt.compare(password, user.password);
        console.log(`🔍 Password comparison result: ${isMatch ? 'MATCH' : 'NO MATCH'}`);
        
        if (!isMatch) {
            console.log(`❌ Login failed: Invalid password for ${lowerEmail}`);

            console.log(`🔧 Debug info for ${lowerEmail}:`);
            console.log(`   - Provided password: "${password}"`);
            console.log(`   - Password hash starts with: ${user.password ? user.password.substring(0, 10) + '...' : 'NULL'}`);

            if (user.password && !user.password.startsWith('$2b$') && !user.password.startsWith('$2a$')) {
                console.log(`⚠️ WARNING: Password for ${lowerEmail} doesn't look like a bcrypt hash!`);
                console.log(`   - Actual hash: ${user.password}`);

                if (user.password === password) {
                    console.log(`🚨 SECURITY ISSUE: Plain text password detected for ${lowerEmail}! Auto-fixing...`);
                    
                    user.password = await bcrypt.hash(password, 10);
                    await user.save();
                    console.log(`✅ Password hashed and saved for ${lowerEmail}`);
                    
                } else {
                    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
                    await user.save();
                    return ResponseUtils.unauthorized(res, "Invalid credentials");
                }
            } else {
                user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
                let justLocked = false;
                if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
                    user.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION);
                    justLocked = true;
                    sendFailedLoginAttemptEmail(user).catch(err => {
                        console.error("Failed login email notification error:", err);
                    });
                }
                await user.save();

                if (justLocked) {
                    return res.status(429).json({
                        success: false,
                        message: "Account locked. Try again in 5 minute(s).",
                        errorType: "account_locked_now",
                        lockoutMinutes: 5
                    });
                }
                return ResponseUtils.unauthorized(res, "Invalid credentials");
            }
        }

        console.log(`✅ Login successful for ${lowerEmail}`);

        user.failedLoginAttempts = 0;
        user.lockoutUntil = null;
        await user.save();

        const token = generateJWTToken(user);

        const cookieOptions = {
            httpOnly: true,
            secure: NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 1000 
        };

        res.cookie('authToken', token, cookieOptions);

        const payload = {
            token,
            user: formatUserResponse(user),
            redirect: getRedirectURL(user.role),
            useHttpOnlyCookies: true
        };

        console.log(`🎉 Login successful for ${lowerEmail}, role: ${user.role}`);

        try {
            const guestSessionId = req.headers['x-session-id'];
            if (guestSessionId) {
                const Cart = require('../models/cart.model');
                const guestCart = await Cart.findOne({ sessionId: guestSessionId, status: 'active' });
                if (guestCart && guestCart.items.length) {
                    let userCart = await Cart.findOne({ userId: user._id, status: 'active' });
                    if (!userCart) {
                        
                        guestCart.userId = user._id;
                        guestCart.sessionId = undefined;
                        guestCart.guestExpiresAt = undefined;
                        guestCart.appliedCoupon = undefined;
                        await guestCart.save();
                        payload.cartMerged = true;
                        payload.cartItemCount = guestCart.items.reduce((s,i)=>s+i.quantity,0);
                    } else {
                        
                        userCart.items.push(...guestCart.items.map(i => ({ 
                            productId: i.productId, 
                            quantity: i.quantity, 
                            price: i.price 
                        })));
                        userCart.appliedCoupon = undefined;
                        await userCart.save();
                        await guestCart.deleteOne();
                        payload.cartMerged = true;
                        payload.cartItemCount = userCart.items.reduce((s,i)=>s+i.quantity,0);
                    }
                } else {
                    payload.cartMerged = false;
                }
            }
        } catch (mergeErr) {
            console.warn('Cart merge during login failed (non-fatal):', mergeErr.message);
        }

        return ResponseUtils.success(res, payload, "Login successful");
    } catch (error) {
        console.error('💥 Login error:', error);
        return ResponseUtils.error(res, "Login failed. Please try again.");
    }
};

const googleSignIn = async (req, res) => {
    const { token } = req.body;

    try {
        
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, name, given_name, family_name, email_verified, sub: googleId } = payload;
        const lowerEmail = normalizeEmail(email);

        console.log(`Google Sign-In attempt for: ${lowerEmail} (Google ID: ${googleId})`);

        if (!email_verified) {
            return ResponseUtils.error(res, 'Google account email is not verified.', 400);
        }

        if (await isUserArchived(lowerEmail, googleId)) {
            console.log(`Google Sign-In attempt by archived user: ${lowerEmail} (Google ID: ${googleId})`);
            return ResponseUtils.forbidden(res, "Your account has been archived. Please contact support at contact@smartlivingtech.com for assistance.");
        }

        let user = await User.findOne({ googleId: googleId });
        
        if (user) {
            console.log(`Found existing user by Google ID: ${user.email} (${googleId})`);

            let userUpdated = false;

            if (user.email !== lowerEmail) {
                
                if (await isUserArchived(lowerEmail)) {
                    console.log(`Attempted email change to archived email: ${lowerEmail}`);
                    return ResponseUtils.forbidden(res, "The email you're trying to use has been archived. Please contact support.");
                }
                
                user.email = lowerEmail;
                userUpdated = true;
            }

            if (given_name && user.firstName !== given_name) {
                user.firstName = given_name;
                userUpdated = true;
            }
            if (family_name && user.lastName !== family_name) {
                user.lastName = family_name;
                userUpdated = true;
            }

            if (!user.isVerified) {
                user.isVerified = true;
                userUpdated = true;
            }
            
            if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
                resetFailedLoginAttempts(user);
                userUpdated = true;
            }
            
            if (userUpdated) {
                await user.save();
            }
        } else {
            
            user = await User.findOne({ email: lowerEmail });
            
            if (user) {
                
                console.log(`Linking Google account to existing email: ${lowerEmail}`);
                user.googleId = googleId;
                user.provider = 'google';
                if (!user.isVerified) user.isVerified = true;
                await user.save();
            } else {
                
                if (await isUserArchived(lowerEmail, googleId)) {
                    console.log(`Blocked new account creation for archived email/Google ID: ${lowerEmail}`);
                    return ResponseUtils.forbidden(res, "This email address or Google account has been archived. Please contact support at contact@smartlivingtech.com for assistance.");
                }

                console.log(`Creating new Google user: ${lowerEmail}`);
                user = new User({
                    firstName: given_name || name || 'User',
                    lastName: family_name || '',
                    email: lowerEmail,
                    googleId: googleId,
                    provider: 'google',
                    isVerified: true,
                    role: 'user'
                });
                await user.save();

                sendWelcomeEmail(user).catch(emailError => {
                    console.error('Welcome email failed for Google user:', emailError);
                });
            }
        }

        const jwtToken = generateJWTToken(user);

        console.log(`Google Sign-In successful for: ${lowerEmail}, redirecting to: ${getRedirectURL(user.role)}`);

        const googlePayload = {
            token: jwtToken,
            user: formatUserResponse(user),
            redirect: getRedirectURL(user.role)
        };

        try {
            const guestSessionId = req.headers['x-session-id'];
            if (guestSessionId) {
                const Cart = require('../models/cart.model');
                const guestCart = await Cart.findOne({ sessionId: guestSessionId, status: 'active' });
                if (guestCart && guestCart.items.length) {
                    let userCart = await Cart.findOne({ userId: user._id, status: 'active' });
                    if (!userCart) {
                        
                        guestCart.userId = user._id;
                        guestCart.sessionId = undefined;
                        guestCart.guestExpiresAt = undefined;
                        guestCart.appliedCoupon = undefined;
                        await guestCart.save();
                        googlePayload.cartMerged = true;
                        googlePayload.cartItemCount = guestCart.items.reduce((s,i)=>s+i.quantity,0);
                    } else {
                        
                        userCart.items.push(...guestCart.items.map(i => ({ 
                            productId: i.productId, 
                            quantity: i.quantity, 
                            price: i.price 
                        })));
                        userCart.appliedCoupon = undefined;
                        await userCart.save();
                        await guestCart.deleteOne();
                        googlePayload.cartMerged = true;
                        googlePayload.cartItemCount = userCart.items.reduce((s,i)=>s+i.quantity,0);
                    }
                } else {
                    googlePayload.cartMerged = false;
                }
            }
        } catch (mergeErr) {
            console.warn('Cart merge during Google sign-in failed (non-fatal):', mergeErr.message);
        }

        return ResponseUtils.success(res, googlePayload, user.googleId === googleId ? "Google Sign-In successful" : "Account linked with Google successfully");

    } catch (error) {
        console.error('Google Sign-In error:', error);

        if (error.message && error.message.includes('Token used too late')) {
            return ResponseUtils.error(res, 'Google Sign-In token has expired. Please try again.', 400);
        }
        
        if (error.message && error.message.includes('Invalid token')) {
            return ResponseUtils.error(res, 'Invalid Google Sign-In token. Please try again.', 400);
        }

        const mongoError = handleMongoError(error);
        if (mongoError) {
            console.error('Duplicate key error during Google Sign-In:', error);
            return ResponseUtils.conflict(res, 'An account with this email already exists. Please try signing in normally or contact support.');
        }
        
        return ResponseUtils.error(res, 'Google Sign-In failed. Please try again.');
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const lowerEmail = normalizeEmail(email);
        
        const user = await User.findOne({ email: lowerEmail });
        if (!user) {
            return ResponseUtils.notFound(res, "User");
        }

        const otp = generateOTP();
        if (NODE_ENV !== 'production') {
            console.log(`Generated reset OTP for ${lowerEmail}: ${otp}`);
        }

        const hashedOTP = await bcrypt.hash(otp, 10);
        user.resetPasswordOTP = hashedOTP;
        user.resetPasswordExpires = getOTPExpiration(10); 
        await user.save();

        const emailSent = await sendOTPWithErrorHandling(lowerEmail, otp, 'password-reset');
        
        if (emailSent) {
            return ResponseUtils.success(res, null, "Reset code sent to your email");
        } else {
            return ResponseUtils.error(res, "Failed to send reset code. Please try again.", 503);
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        return ResponseUtils.error(res, "Password reset request failed");
    }
};

const verifyResetOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const lowerEmail = normalizeEmail(email);
        
        const user = await User.findOne({
            email: lowerEmail,
            resetPasswordExpires: { $gt: Date.now() }
        });
        
        if (!user) {
            return ResponseUtils.error(res, "OTP expired or email not found", 400);
        }

        const isMatch = await bcrypt.compare(otp, user.resetPasswordOTP);
        
        if (!isMatch) {
            return ResponseUtils.error(res, "Invalid or expired OTP", 400);
        }
        
        return ResponseUtils.success(res, null, "OTP verified successfully");
    } catch (error) {
        console.error('Reset OTP verification error:', error);
        return ResponseUtils.error(res, "OTP verification failed");
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const lowerEmail = normalizeEmail(email);

        const user = await User.findOne({
            email: lowerEmail,
            resetPasswordExpires: { $gt: Date.now() }
        });
        
        if (!user) {
            return ResponseUtils.error(res, "OTP expired or email not found", 400);
        }

        const isMatch = await bcrypt.compare(otp, user.resetPasswordOTP);
        
        if (!isMatch) {
            return ResponseUtils.error(res, "Invalid or expired OTP", 400);
        }

        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return ResponseUtils.validationError(res, {
                field: 'password',
                message: 'Password requirements not met',
                requirements: passwordValidation.requirements
            });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordOTP = null;
        user.resetPasswordExpires = null;
        await user.save();

        sendPasswordChangedEmail(user).catch(err => {
            console.error('Password changed email error:', err);
        });
        
        return ResponseUtils.success(res, null, "Password updated successfully");
    } catch (error) {
        console.error('Password reset error:', error);
        return ResponseUtils.error(res, "Password reset failed");
    }
};

const getAllUsers = async (req, res) => {
    try {
        const { sort } = req.query;

        let sortQuery = { createdAt: -1 }; 
        if (sort) {
            switch (sort) {
                case 'newest':
                    sortQuery = { createdAt: -1 };
                    break;
                case 'oldest':
                    sortQuery = { createdAt: 1 };
                    break;
                case 'name-asc':
                    sortQuery = { firstName: 1 };
                    break;
                case 'name-desc':
                    sortQuery = { firstName: -1 };
                    break;
                case 'email-asc':
                    sortQuery = { email: 1 };
                    break;
                case 'email-desc':
                    sortQuery = { email: -1 };
                    break;
                case 'role':
                    sortQuery = { role: 1 };
                    break;
                default:
                    sortQuery = { createdAt: -1 };
            }
        }
        
        const users = await User.find()
            .select('firstName lastName email role isVerified isArchived createdAt')
            .sort(sortQuery);
            
        const formattedUsers = users.map(user => ({
            _id: user._id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            role: user.role,
            status: user.isArchived ? 'inactive' : (user.isVerified ? 'active' : 'inactive'),
            isArchived: user.isArchived || false,
            createdAt: user.createdAt
        }));
        
        console.log(`Returning ${formattedUsers.length} users to client`);
        
        return ResponseUtils.success(res, { users: formattedUsers });
    } catch (error) {
        console.error('Error fetching users:', error);
        return ResponseUtils.error(res, 'Failed to fetch users');
    }
};

const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('firstName lastName email role isVerified');
        
        if (!user) {
            return ResponseUtils.notFound(res, 'User');
        }
        
        return ResponseUtils.success(res, {
            user: {
                _id: user._id,
                name: `${user.firstName} ${user.lastName}`,
                email: user.email,
                role: user.role,
                status: user.isVerified ? 'active' : 'inactive'
            }
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        return ResponseUtils.error(res, 'Failed to fetch user details');
    }
};

const updateUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const currentUser = req.user;
        const { firstName, lastName, email, role, isVerified } = req.body;

        if (userId === currentUser.id && role && role !== currentUser.role) {
            return ResponseUtils.forbidden(res, "You cannot change your own role");
        }

        const user = await User.findById(userId);
        if (!user) {
            return ResponseUtils.notFound(res, "User");
        }

        const updateData = {};
        if (firstName !== undefined) updateData.firstName = firstName.trim();
        if (lastName !== undefined) updateData.lastName = lastName.trim();
        if (email !== undefined) {
            const normalizedEmail = normalizeEmail(email);
            
            const existingUser = await User.findOne({ 
                email: normalizedEmail, 
                _id: { $ne: userId } 
            });
            if (existingUser) {
                return ResponseUtils.error(res, 'Email is already registered to another user', 400);
            }
            updateData.email = normalizedEmail;
        }
        if (role !== undefined && ['user', 'admin'].includes(role)) {
            updateData.role = role;
        }
        if (isVerified !== undefined) updateData.isVerified = Boolean(isVerified);

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        return ResponseUtils.success(res, {
            user: {
                _id: updatedUser._id,
                name: `${updatedUser.firstName} ${updatedUser.lastName}`,
                email: updatedUser.email,
                role: updatedUser.role,
                status: updatedUser.isArchived ? 'inactive' : (updatedUser.isVerified ? 'active' : 'inactive'),
                isArchived: updatedUser.isArchived || false,
                createdAt: updatedUser.createdAt,
                updatedAt: updatedUser.updatedAt
            }
        }, "User updated successfully");
    } catch (error) {
        console.error('Error updating user:', error);
        if (error.name === 'ValidationError') {
            return ResponseUtils.validationError(res, error.errors);
        }
        return ResponseUtils.error(res, 'Failed to update user');
    }
};

const deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const currentUser = req.user;

        if (userId === currentUser.id) {
            return ResponseUtils.forbidden(res, "You cannot delete your own account");
        }

        const user = await User.findById(userId);
        if (!user) {
            return ResponseUtils.notFound(res, "User");
        }

        await User.findByIdAndDelete(userId);
        
        return ResponseUtils.success(res, null, "User deleted successfully");
    } catch (error) {
        console.error('Error deleting user:', error);
        return ResponseUtils.error(res, 'Failed to delete user');
    }
};

const archiveUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const currentUser = req.user;

        if (userId === currentUser.id) {
            return ResponseUtils.forbidden(res, "You cannot archive your own account");
        }

        const user = await User.findById(userId);
        if (!user) {
            return ResponseUtils.notFound(res, "User");
        }

        if (user.role && user.role.toLowerCase() === 'admin') {
            return ResponseUtils.forbidden(res, "Admin accounts cannot be archived");
        }

        console.log(`Archiving user: ${user.email} (${user._id})`);

        const existingArchived = await ArchivedUser.findOne({ email: normalizeEmail(user.email) });
        if (existingArchived) {
            console.log(`User ${user.email} is already in the archived collection`);
            return ResponseUtils.conflict(res, "User is already archived");
        }

        const archivedUser = new ArchivedUser({
            originalUserId: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: normalizeEmail(user.email),
            role: user.role,
            googleId: user.googleId,
            provider: user.provider,
            archivedAt: new Date(),
            deletedAt: new Date(),
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 
            deletionReason: "Administrative action: User archived by system admin",
            otherReason: `Archived by admin user: ${currentUser.email}`
        });

        const savedArchivedUser = await archivedUser.save();
        console.log(`User archived: ${user.email} - saved to ArchivedUser collection with ID: ${savedArchivedUser._id}`);

        const verifyArchive = await ArchivedUser.findOne({ email: normalizeEmail(user.email) });
        if (!verifyArchive) {
            console.error(`CRITICAL ERROR: Failed to verify archived user ${user.email} after saving`);
            throw new Error('Failed to verify user archival');
        }

        await User.findByIdAndDelete(userId);
        console.log(`User deleted from main collection: ${user.email}`);

        const verifyDeleted = await User.findById(userId);
        if (verifyDeleted) {
            console.error(`CRITICAL ERROR: User ${user.email} still exists in User collection after deletion`);
            await ArchivedUser.findByIdAndDelete(savedArchivedUser._id);
            throw new Error('Failed to properly archive user - deletion from main collection failed');
        }
        
        return ResponseUtils.success(res, {
            archivedUser: {
                email: user.email,
                name: `${user.firstName} ${user.lastName}`,
                archivedAt: savedArchivedUser.archivedAt,
                expiryDate: savedArchivedUser.expiryDate
            }
        }, "User archived successfully");
    } catch (error) {
        console.error('Error archiving user:', error);
        return ResponseUtils.error(res, 'Failed to archive user: ' + error.message);
    }
};

const checkArchivedStatus = async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return ResponseUtils.error(res, "Email is required", 400);
        }
        
        const lowerEmail = normalizeEmail(email);
        const archivedUser = await ArchivedUser.findOne({ email: lowerEmail });
        
        return ResponseUtils.success(res, {
            isArchived: !!archivedUser,
            archivedAt: archivedUser ? archivedUser.archivedAt : null
        });
    } catch (error) {
        console.error('Error checking archived status:', error);
        return ResponseUtils.error(res, 'Failed to check archived status');
    }
};

const getArchivedUsers = async (req, res) => {
    try {
        const archivedUsers = await ArchivedUser.find()
            .sort({ archivedAt: -1 });
            
        console.log(`Returning ${archivedUsers.length} archived users to client`);
        
        return ResponseUtils.success(res, { users: archivedUsers });
    } catch (error) {
        console.error('Error fetching archived users:', error);
        return ResponseUtils.error(res, 'Failed to fetch archived users');
    }
};

const restoreUser = async (req, res) => {
    try {
        const userId = req.params.id;
        console.log(`Attempting to restore user with ID: ${userId}`);

        let archivedUser = await ArchivedUser.findOne({ originalUserId: userId });
        
        if (!archivedUser) {
            archivedUser = await ArchivedUser.findById(userId);
        }
        
        if (!archivedUser) {
            console.log(`Archived user not found by ID, searching all archived users...`);
            const allArchived = await ArchivedUser.find({});
            console.log(`Found ${allArchived.length} archived users total`);
            
            return ResponseUtils.notFound(res, "Archived user");
        }
        
        console.log(`Found archived user: ${archivedUser.email}`);

        const existingUser = await User.findOne({ email: archivedUser.email });
        if (existingUser) {
            return ResponseUtils.conflict(res, "A user with this email already exists in the active users. Cannot restore duplicate.");
        }

        const restoredUser = new User({
            firstName: archivedUser.firstName,
            lastName: archivedUser.lastName,
            email: archivedUser.email,
            password: await bcrypt.hash(Math.random().toString(36).slice(-12), 10), 
            role: archivedUser.role,
            isVerified: true,
            googleId: archivedUser.googleId,
            provider: archivedUser.provider,
            failedLoginAttempts: 0,
            lockoutUntil: null,
            createdAt: archivedUser.deletedAt || new Date()
        });

        const savedUser = await restoredUser.save();
        console.log(`User restored: ${savedUser.email} with new ID: ${savedUser._id}`);

        await ArchivedUser.findByIdAndDelete(archivedUser._id);
        console.log(`Archived user entry deleted: ${archivedUser.email}`);
        
        return ResponseUtils.success(res, {
            user: {
                id: savedUser._id,
                email: savedUser.email,
                name: `${savedUser.firstName} ${savedUser.lastName}`,
                role: savedUser.role,
                provider: savedUser.provider
            }
        }, "User restored successfully. User will need to reset their password.");
    } catch (error) {
        console.error('Error restoring user:', error);
        return ResponseUtils.error(res, 'Failed to restore user: ' + error.message);
    }
};

const updateUserStatus = async (req, res) => {
    try {
        const userId = req.params.id;
        const { status } = req.body;
        
        if (!status || !['active', 'inactive'].includes(status)) {
            return ResponseUtils.error(res, "Invalid status. Must be 'active' or 'inactive'", 400);
        }

        const user = await User.findById(userId);
        if (!user) {
            return ResponseUtils.notFound(res, "User");
        }

        user.isVerified = status === 'active';
        await user.save();
        
        return ResponseUtils.success(res, null, `User status updated to ${status}`);
    } catch (error) {
        console.error('Error updating user status:', error);
        return ResponseUtils.error(res, 'Failed to update user status: ' + error.message);
    }
};

const logout = async (req, res) => {
    try {

        return ResponseUtils.success(res, null, "Logged out successfully");
    } catch (error) {
        console.error('Logout error:', error);
        return ResponseUtils.error(res, "Logout failed. Please try again.");
    }
};

module.exports = {
    signup,
    verifyOTP,
    resendOTP,
    login,
    logout,
    googleSignIn,
    forgotPassword,
    verifyResetOTP,
    resetPassword,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    archiveUser,
    checkArchivedStatus,
    getArchivedUsers,
    restoreUser,
    updateUserStatus
};