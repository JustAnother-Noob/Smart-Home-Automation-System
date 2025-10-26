const mongoose = require('mongoose');

const archivedUserSchema = new mongoose.Schema({
    originalUserId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false 
    },
    firstName: {
        type: String,
        trim: true
    },
    lastName: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true 
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    
    googleId: {
        type: String,
        sparse: true 
    },
    provider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },
    deletionReason: {
        type: String,
        required: false 
    },
    otherReason: {
        type: String,
        trim: true,
        required: false 
    },
    deletedAt: {
        type: Date,
        default: Date.now
    },
    
    archivedAt: {
        type: Date,
        default: Date.now
    },
    expiryDate: {
        type: Date,
        default: function() {
            
            const date = new Date();
            date.setDate(date.getDate() + 30);
            return date;
        }
    }
});

archivedUserSchema.index({ expiryDate: 1 }, { expireAfterSeconds: 0 });

archivedUserSchema.index({ email: 1 }, { unique: true });

archivedUserSchema.index({ originalUserId: 1 });

archivedUserSchema.index({ googleId: 1 }, { unique: true, sparse: true });

archivedUserSchema.index({ provider: 1, email: 1 });

archivedUserSchema.index({ googleId: 1, email: 1 }, { sparse: true });

module.exports = mongoose.models.ArchivedUser || mongoose.model('ArchivedUser', archivedUserSchema);
