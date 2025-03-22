const mongoose = require('mongoose');

// creating user schema
const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        index: true
    },
    password: {
        type: String,
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: {
        type: String,
        default: null
    },
    verificationTokenExpires: {
        type: Date,
        default: null
    }
}, { timestamps: true }); //adds created at and updated at timestamps

const User = mongoose.model('User', userSchema);

module.exports = User;