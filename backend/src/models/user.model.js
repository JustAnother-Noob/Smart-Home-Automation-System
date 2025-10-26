const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    password: {
        type: String,
        required: [false, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters long']
    },
    phone: {
        type: String,
        trim: true
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    profilePicture: {
        type: String,
        default: ''
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    
    otp: {
        type: String,
        default: null
    },
    otpExpires: {
        type: Date,
        default: null
    },
    
    resetPasswordOTP: {
        type: String,
        default: null
    },
    resetPasswordExpires: {
        type: Date,
        default: null
    },
    
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    provider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },
    
    failedLoginAttempts: {
        type: Number,
        default: 0
    },
    lockoutUntil: {
        type: Date,
        default: null
    },
    verificationToken: String,
    verificationTokenExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    lastLogin: Date,
    addresses: [{ 
        street: {
            type: String,
            required: [true, 'Street address is required'],
            trim: true
        },
        apartmentSuite: {
            type: String,
            trim: true
        },
        suburb: { 
            type: String,
            required: [true, 'Suburb/City is required'], 
            trim: true
        },
        state: {
            type: String,
            required: [true, 'State/Province is required'],
            trim: true
        },
        zipCode: {
            type: String,
            required: [true, 'Zip/Postal code is required'],
            trim: true
        },
        country: {
            type: String,
            required: [true, 'Country is required'],
            trim: true,
            default: 'Australia' 
        },
        isPrimary: {
            type: Boolean,
            default: false
        }
    }]
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });

userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

userSchema.index({ email: 1, googleId: 1 }, { sparse: true });

userSchema.pre('save', async function(next) {
  
  if (!this.isModified('password')) return next();

  if (this.password && (this.password.startsWith('$2a$') || this.password.startsWith('$2b$'))) {
      console.log(`Password for ${this.email} is already hashed, skipping hash`);
      return next();
  }
  
  try {
      console.log(`Hashing password for ${this.email}`);
      this.password = await bcrypt.hash(this.password, 10);
      console.log(`Password hashed successfully for ${this.email}`);
      next();
  } catch (error) {
      console.error(`Error hashing password for ${this.email}:`, error);
      next(error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
