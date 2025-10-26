const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const { requireAuth } = require('../middlewares/auth.middleware');
const { logAdminAction, enhancedAdminProtection } = require('../middlewares/audit.middleware');

const { ResponseUtils } = require('../utils');
const CONSTANTS = require('../config/constants');

const {
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
  getOrderDetails,
  archiveOrder,
  unarchiveOrder,
  sendOrderStatusEmail,
} = require('../controllers/adminOrder.controller');

const {
  getAllInstallations,
  getInstallationDetails,
  updateInstallationStatus,
  deleteInstallation,
  sendInstallationStatusEmail,
} = require('../controllers/adminInstallation.controller');

const User = require('../models/user.model');
const Product = require('../models/product.model');
const ArchivedUser = require('../models/archivedUser.model');
const Order = require('../models/order.model');

router.use(requireAuth, enhancedAdminProtection);

router.get('/dashboard/stats', logAdminAction('VIEW_DASHBOARD_STATS'), async (_req, res) => {
  try {
    const [
      activeUserCount,
      inactiveUserCount,
      archivedUserCount,
      totalProductCount,
      lowStockProductCount,
      orderCount,
    ] = await Promise.all([
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ isVerified: false }),
      ArchivedUser.countDocuments(),
      Product.countDocuments(),
      Product.countDocuments({ stockStatus: 'low_stock' }),
      Order.countDocuments(),
    ]);

    return res.json({
      success: true,
      stats: {
        activeUsers: activeUserCount,
        inactiveUsers: inactiveUserCount,
        archivedUsers: archivedUserCount,
        totalProducts: totalProductCount,
        lowStockProducts: lowStockProductCount,
        orders: orderCount,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return ResponseUtils.error(res, 'Failed to fetch dashboard statistics');
  }
});

router.get('/charts/config', logAdminAction('VIEW_CHARTS_CONFIG'), async (_req, res) => {
  try {
    return ResponseUtils.success(res, {
      charts: CONSTANTS.MONGODB_CHARTS
    });
  } catch (error) {
    console.error('Error fetching charts config:', error);
    return ResponseUtils.error(res, 'Failed to fetch charts configuration');
  }
});

router.get('/health', logAdminAction('HEALTH_CHECK'), async (req, res) => {
  try {
    const adminUser = req.user;
    const dbConnection = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const userCount = await User.countDocuments({ role: 'admin' });

    return ResponseUtils.success(
      res,
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        admin: { id: adminUser.id, email: adminUser.email, role: adminUser.role },
        database: { status: dbConnection, adminUsers: userCount },
        server: {
          uptime: process.uptime(),
          nodeVersion: process.version,
          environment: process.env.NODE_ENV || 'development',
        },
      },
      'Admin system is healthy'
    );
  } catch (error) {
    console.error('Admin health check failed:', error);
    return ResponseUtils.error(res, 'Admin system health check failed', 500);
  }
});

router.get('/orders', logAdminAction('VIEW_ORDERS'), getAllOrders);
router.get('/orders/:id', logAdminAction('VIEW_ORDER_DETAILS'), getOrderDetails);
router.put('/orders/:id/status', logAdminAction('UPDATE_ORDER_STATUS'), updateOrderStatus);
router.delete('/orders/:id', logAdminAction('DELETE_ORDER'), deleteOrder);
router.patch('/orders/:id/archive', logAdminAction('ARCHIVE_ORDER'), archiveOrder);
router.patch('/orders/:id/unarchive', logAdminAction('UNARCHIVE_ORDER'), unarchiveOrder);
router.post('/orders/:id/send-status-email', logAdminAction('SEND_ORDER_STATUS_EMAIL'), sendOrderStatusEmail);

router.get('/installations', logAdminAction('VIEW_INSTALLATIONS'), getAllInstallations);
router.get('/installations/:id', logAdminAction('VIEW_INSTALLATION_DETAILS'), getInstallationDetails);
router.put('/installations/:id/status', logAdminAction('UPDATE_INSTALLATION_STATUS'), updateInstallationStatus);
router.delete('/installations/:id', logAdminAction('DELETE_INSTALLATION'), deleteInstallation);
router.post('/installations/:id/send-status-email', logAdminAction('SEND_INSTALLATION_STATUS_EMAIL'), sendInstallationStatusEmail);

router.get('/revenue', logAdminAction('VIEW_REVENUE'), async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    const now = new Date();
    let startDate = null;

    if (period === 'weekly') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (period === 'monthly') startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === 'yearly') startDate = new Date(now.getFullYear(), 0, 1);

    const matchQuery = { status: { $ne: 'cancelled' }, isArchived: { $ne: true } };
    if (startDate) matchQuery.createdAt = { $gte: startDate };

    const [revenueData, orderStats] = await Promise.all([
      Order.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            averageOrderValue: { $avg: '$total' },
            orderCount: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' }, isArchived: { $ne: true } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            revenue: { $sum: '$total' },
          },
        },
      ]),
    ]);

    const r = revenueData[0] || { totalRevenue: 0, averageOrderValue: 0, orderCount: 0 };

    return res.json({
      success: true,
      revenue: {
        total: r.totalRevenue || 0,
        average: Math.round(r.averageOrderValue || 0),
        orderCount: r.orderCount || 0,
        period,
        statusBreakdown: orderStats || [],
      },
    });
  } catch (error) {
    console.error('Error fetching revenue:', error);
    return ResponseUtils.error(res, 'Failed to fetch revenue data');
  }
});

module.exports = router;
