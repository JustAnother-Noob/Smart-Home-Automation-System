const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const userController = require('../controllers/user.controller');

router.get('/profile', authMiddleware, userController.getProfile);
router.put('/profile', authMiddleware, userController.updateProfile);

router.get('/addresses', authMiddleware, userController.getAddresses);
router.post('/addresses', authMiddleware, userController.addAddress);
router.put('/addresses/:addressId', authMiddleware, userController.updateAddress);
router.delete('/addresses/:addressId', authMiddleware, userController.deleteAddress);

router.put('/profile/picture', authMiddleware, userController.updateProfilePicture);

router.delete('/account', authMiddleware, userController.requestAccountDeletion);

module.exports = router;