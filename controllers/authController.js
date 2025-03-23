const bcrypt = require('bcryptjs');
const User = require('../server/models/user.models');
const { generateVerificationToken } = require('../services/token');
const { sendVerificationEmail } = require('../services/verification-email');
const { validateEmail, validatePassword } = require('../utils/validators');
const jwt = require("jsonwebtoken");


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
        await User.deleteOne({ email: lowerEmail });
        res.status(500).json({
            message: error.message || 'Registration failed',
            error: error.message
        });
    }
};

const verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;

        // Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Find user with matching token and check expiration
        const user = await User.findOne({
            email: decoded.email,
            verificationToken: token,
            tokenExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.redirect(`${CLIENT_URL}/error?type=token_expired`);
        }

        // Update verification status
        user.isVerified = true;
        user.verificationToken = undefined;
        user.tokenExpires = undefined;
        await user.save();

        res.redirect(`${CLIENT_URL}/signup-verified.html`);

    } catch (error) {
        console.error('Verification error:', error);
        return res.redirect(`${CLIENT_URL}/signup-unverified.html?error=token_expired`);
    }
};

const resendVerification = async (req, res) => {
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

        // Generate new token
        const newToken = jwt.sign(
            { email: lowerEmail },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );

        // Update user record
        user.verificationToken = newToken;
        user.tokenExpires = Date.now() + 600000; // 10 minutes
        await user.save();

        // Send new email
        await sendVerificationEmail(lowerEmail, newToken);

        res.json({
            success: true,
            message: "New verification email sent"
        });

    } catch (error) {
        console.error('Resend error:', error);
        res.status(500).json({
            success: false,
            message: "Failed to resend verification email"
        });
    }
};
// Delete expired tokens periodically (add to server startup)
setInterval(async () => {
    await User.deleteMany({
        tokenExpires: { $lt: Date.now() },
        isVerified: false
    });
}, 60 * 60 * 1000); // Run hourly

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
