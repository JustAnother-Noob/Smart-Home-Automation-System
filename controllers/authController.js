const bcrypt = require('bcryptjs');
const User = require('../server/models/user.models');
const { generateVerificationToken } = require('../services/token');
const { sendVerificationEmail } = require('../services/verification-email');
const { validateEmail, validatePassword } = require('../utils/validators');

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

        // Create user
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = generateVerificationToken(lowerEmail);

        const newUser = new User({
            email: lowerEmail,
            password: hashedPassword,
            verificationToken,
            tokenExpires: Date.now() + 600000 // 10 minutes
        });

        await newUser.save();

        // Send verification email
        await sendVerificationEmail(lowerEmail, verificationToken);

        res.status(201).json({
            message: 'Verification email sent! Check your inbox.',
            email: lowerEmail
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

const verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;
        const { verifyToken } = require('../services/tokenService');
        const decoded = verifyToken(token);

        const user = await User.findOne({
            email: decoded.email,
            verificationToken: token,
            tokenExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        user.isVerified = true;
        user.verificationToken = undefined;
        user.tokenExpires = undefined;
        await user.save();

        res.redirect(`${CLIENT_URL}/login.html?verified=true`);

    } catch (error) {
        res.redirect(`${CLIENT_URL}/signupconfirmation.html?error=${encodeURIComponent(error.message)}`);
    }
};

const resendVerification = async (req, res) => {
    const { email } = req.body;
    const lowerEmail = email.toLowerCase();

    try {
        const user = await User.findOne({ email: lowerEmail });
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: "Email already verified" });
        }

        // Generate new token
        const newToken = generateVerificationToken(lowerEmail);
        
        // Update user with new token
        user.verificationToken = newToken;
        user.tokenExpires = Date.now() + 600000; // 10 minutes
        await user.save();

        // Send new verification email
        await sendVerificationEmail(lowerEmail, newToken);

        res.json({ message: 'New verification email sent!' });
    } catch (error) {
        console.error('Resend error:', error);
        res.status(500).json({ message: 'Error resending verification' });
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

module.exports = { signup, verifyEmail, login, resendVerification };
