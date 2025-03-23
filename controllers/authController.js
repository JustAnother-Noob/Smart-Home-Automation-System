const bcrypt = require('bcryptjs');
const User = require('../server/models/user.models');
const { validateEmail, validatePassword } = require('../utils/validators');
const sendOTPEmail = require('../services/verification-email').sendOTPEmail;


const signup = async (req, res) => {
    const { email, password } = req.body;
    const lowerEmail = email.toLowerCase();

    try {
        // Validation
        if (!validateEmail(lowerEmail)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({
                message: 'Password requirements not met',
                requirements: passwordValidation.requirements
            });
        }

        // Check existing user
        const existingUser = await User.findOne({ email: lowerEmail });
        if (existingUser) {
            return res.status(409).json({ message: 'Email already registered' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 600000; // 10 minutes

        // Create user
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = new User({
            email: lowerEmail,
            password: hashedPassword,
            otp,
            otpExpires
        });

        await newUser.save();

        // Send OTP email
        await sendOTPEmail(lowerEmail, otp);

        res.status(201).json({
            message: 'OTP sent to your email. Check your inbox.',
            email: lowerEmail,
            redirect: `/otp-verify?email=${encodeURIComponent(email)}`
        });

    } catch (error) {
        console.error('Signup error:', error);
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                field: 'email',
                message: 'Email already exists'
            });
        }
        
        // Cleanup: Remove user if OTP failed to send
        await User.deleteOne({ email: lowerEmail }).catch(cleanupError => {
            console.error('User cleanup failed:', cleanupError);
        });

        res.status(500).json({
            message: error.message || 'Registration failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const lowerEmail = email.toLowerCase();

        // Find user with matching email and valid OTP
        const user = await User.findOne({
            email: lowerEmail,
            otpExpires: { $gt: Date.now() } // Check OTP hasn't expired
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "OTP expired or invalid"
            });
        }

        // Compare OTP (plain text comparison)
        if (user.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP code"
            });
        }

        // Mark user as verified
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.json({
            success: true,
            message: "Email verified successfully!"
        });

    } catch (error) {
        console.error('OTP Verification Error:', error);
        res.status(500).json({
            success: false,
            message: "Verification failed"
        });
    }
};

const resendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const lowerEmail = email.toLowerCase();

        // Find unverified user
        const user = await User.findOne({ 
            email: lowerEmail,
            isVerified: false
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not found or already verified"
            });
        }

        // Generate new OTP
        const newOTP = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 600000; // 10 minutes

        // Update user record
        user.otp = newOTP;
        user.otpExpires = otpExpires;
        await user.save();

        // Send new OTP email
        await sendOTPEmail(lowerEmail, newOTP);

        res.json({
            success: true,
            message: "New OTP has been sent to your email"
        });

    } catch (error) {
        console.error('Resend error:', error);
        res.status(500).json({
            success: false,
            message: "Failed to resend OTP. Please try again later."
        });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const lowerEmail = email.toLowerCase();

        const user = await User.findOne({ email: lowerEmail });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 600000; // 10 minutes

        // Save OTP to user
        user.resetPasswordOTP = otp;
        user.resetPasswordExpires = otpExpires;
        await user.save();

        // Send OTP email
        await sendOTPEmail(lowerEmail, otp, 'password-reset');

        res.json({ success: true, message: "Reset OTP sent to your email" });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: "Password reset failed" });
    }
};

const verifyResetOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({
            email: email.toLowerCase(),
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user || user.resetPasswordOTP !== otp) {
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }

        res.json({ success: true, message: "OTP verified" });

    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ success: false, message: "Verification failed" });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        
        // Verify OTP first
        const user = await User.findOne({
            email: email.toLowerCase(),
            resetPasswordOTP: otp,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }

        // Validate new password
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({
                success: false,
                message: "Invalid password",
                requirements: passwordValidation.requirements
            });
        }

        // Update password
        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordOTP = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ success: true, message: "Password updated successfully" });

    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ success: false, message: "Password reset failed" });
    }
};


const login = async (req, res) => {
    const { email, password } = req.body;
    const lowerEmail = email.toLowerCase();

    try {
        const user = await User.findOne({ email: lowerEmail });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!user.isVerified) {
            return res.status(403).json({
                message: "Please verify your email first"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        res.json({ message: "Login successful!" });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: "Server error during login" });
    }
};

module.exports = { signup, verifyOTP, login, resendOTP, forgotPassword, verifyResetOTP, resetPassword };
