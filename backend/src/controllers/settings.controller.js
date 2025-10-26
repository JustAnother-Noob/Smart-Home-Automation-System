const bcrypt = require('bcryptjs');
const Setting = require('../models/settings.model');
const User = require('../models/user.model');
const { ResponseUtils } = require('../utils');
const { validatePassword } = require('../middlewares/validators');

async function getSettingsDoc() {
  let doc = await Setting.findOne({ singletonKey: 'GLOBAL_SETTINGS' });
  if (!doc) {
    doc = await Setting.create({ singletonKey: 'GLOBAL_SETTINGS' });
  }
  return doc;
}

exports.getSettings = async (req, res) => {
  try {
    const settings = await getSettingsDoc();
    return ResponseUtils.success(res, {
      siteEmail: settings.siteEmail,
      timezone: settings.timezone,
      emailNotifications: settings.emailNotifications,
      passwordChangedAt: settings.passwordChangedAt,
      passwordStrengthScore: settings.passwordStrengthScore,
      passwordChangedAt: settings.passwordChangedAt,
      passwordStrengthScore: settings.passwordStrengthScore,
      updatedAt: settings.updatedAt
    });
  } catch (err) {
    console.error('Get settings error:', err);
    return ResponseUtils.error(res, 'Failed to load settings');
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { siteEmail, timezone, emailNotifications } = req.body;
    const settings = await getSettingsDoc();

    if (siteEmail !== undefined) settings.siteEmail = siteEmail;
    if (timezone !== undefined) settings.timezone = timezone;
    if (emailNotifications !== undefined) settings.emailNotifications = !!emailNotifications;
    settings.updatedBy = req.user.id;

    await settings.save();

    return ResponseUtils.success(res, {
      siteEmail: settings.siteEmail,
      timezone: settings.timezone,
      emailNotifications: settings.emailNotifications,
      passwordChangedAt: settings.passwordChangedAt,
      passwordStrengthScore: settings.passwordStrengthScore,
      passwordChangedAt: settings.passwordChangedAt,
      passwordStrengthScore: settings.passwordStrengthScore,
      updatedAt: settings.updatedAt
    }, 'Settings updated successfully');
  } catch (err) {
    console.error('Update settings error:', err);
    return ResponseUtils.error(res, 'Failed to update settings');
  }
};

exports.updateAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All password fields are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirmation do not match' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters', requirements: { length: false } });
    }

    const strength = validatePassword(newPassword);
    if (!strength.valid) {
      return res.status(400).json({
        success: false,
        message: 'Password requirements not met',
        requirements: strength.requirements
      });
    }

    const adminUser = await User.findById(req.user.id);
    if (!adminUser) return res.status(404).json({ success: false, message: 'Admin user not found' });
    if (adminUser.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access required' });

    const match = await bcrypt.compare(currentPassword, adminUser.password);
    if (!match) {
      
      console.log(`[SECURITY] Failed admin password change attempt for ${adminUser.email} from IP: ${req.ip}`);
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const sameAsOld = await bcrypt.compare(newPassword, adminUser.password);
    if (sameAsOld) {
      return res.status(400).json({ success: false, message: 'New password must be different from current password' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character' 
      });
    }

    adminUser.password = newPassword;
    const passwordChangedAt = new Date();
    adminUser.passwordChangedAt = passwordChangedAt;
    await adminUser.save();

    const settings = await getSettingsDoc();
    settings.passwordChangedAt = passwordChangedAt;
    settings.passwordStrengthScore = strength.requirements
      ? Object.values(strength.requirements).filter(Boolean).length
      : 5;
    settings.updatedBy = req.user.id;
    await settings.save();

    console.log(`[ADMIN_AUDIT] Admin password changed successfully for ${adminUser.email} from IP: ${req.ip}`);

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      passwordChangedAt: settings.passwordChangedAt,
      passwordStrengthScore: settings.passwordStrengthScore
    });
  } catch (err) {
    console.error('Update admin password error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update password' });
  }
};
