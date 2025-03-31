const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const { sendOTPEmail } = require('../services/email.services');
const { validatePassword } = require('../middlewares/validators');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');


const authController = {
  signup: async (req, res) => {
    try {
      const { email, password } = req.body;
      const lowerEmail = email.toLowerCase();

      // Validate password
      const pwdValidation = validatePassword(password);
      if (!pwdValidation.valid) {
        return res.status(400).json({
          success: false,
          message: 'Password requirements not met',
          requirements: pwdValidation.requirements
        });
      }

      // Check existing user
      const existingUser = await User.findOne({ email: lowerEmail });
      if (existingUser) {
        return res.status(409).json({ 
          success: false, 
          message: 'Email already registered' 
        });
      }

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const newUser = await User.create({
        email: lowerEmail,
        password: hashedPassword,
        otp,
        otpExpires: Date.now() + 600000
      });

      // Send OTP email
      await sendOTPEmail(lowerEmail, otp);

      res.status(201).json({
        success: true,
        message: 'OTP sent to email',
        email: lowerEmail
      });

    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error during signup' 
      });
    }
  },

  verifyOTP: async (req, res) => {
    try {
      const { email, otp } = req.body;
      const user = await User.findOne({ 
        email: email.toLowerCase(),
        otpExpires: { $gt: Date.now() }
      });

      if (!user || user.otp !== otp) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid or expired OTP' 
        });
      }

      user.isVerified = true;
      user.otp = undefined;
      user.otpExpires = undefined;
      await user.save();

      res.json({ 
        success: true, 
        message: 'Email verified successfully' 
      });

    } catch (error) {
      console.error('OTP verification error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error during verification' 
      });
    }
  }

  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      const lowerEmail = email.toLowerCase();

      // Validate input
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Please provide email and password'
        });
      }

      // Find user
      const user = await User.findOne({ email: lowerEmail }).select('+password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if verified
      if (!user.isVerified) {
        return res.status(403).json({
          success: false,
          message: 'Please verify your email first'
        });
      }

      // Verify password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Create JWT token
      const token = jwt.sign(
        { userId: user._id },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
      );

      // Set cookie
      res.cookie('jwt', token, {
        expires: new Date(
          Date.now() + process.env.JWT_COOKIE_EXPIRES * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user._id,
          email: user.email
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during login'
      });
    }
  },

  // Add logout function
  logout: (req, res) => {
    res.cookie('jwt', 'loggedout', {
      expires: new Date(Date.now() + 1000),
      httpOnly: true
    });
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  }

};

module.exports = authController;