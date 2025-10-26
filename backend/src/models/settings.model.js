const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  siteEmail: { type: String, trim: true },
  timezone: { type: String, default: 'UTC' },
  emailNotifications: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  passwordChangedAt: { type: Date },
  passwordStrengthScore: { type: Number, min: 0, max: 5 }
}, { timestamps: true });

settingsSchema.add({ singletonKey: { type: String, default: 'GLOBAL_SETTINGS', unique: true } });

module.exports = mongoose.model('Setting', settingsSchema);
