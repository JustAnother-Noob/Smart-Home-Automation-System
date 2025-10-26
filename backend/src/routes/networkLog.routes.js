const express = require('express');
const router = express.Router();
const {
    getNetworkLogs,
    getLogStats,
    getRealtimeLogs,
    getLogDetails,
    deleteOldLogs,
    exportLogs,
    getActiveUsers,
    getUniqueIPs,
    clearIPHistory
} = require('../controllers/networkLog.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');

router.use(requireAuth);
router.use(requireAdmin);

router.get('/stats', getLogStats);

router.get('/realtime', getRealtimeLogs);

router.get('/export/csv', exportLogs);

router.options('/cleanup', (req, res) => {
    res.status(204).end();
});
router.post('/cleanup', deleteOldLogs);
router.delete('/cleanup', deleteOldLogs);

router.get('/', getNetworkLogs);

router.get('/active-users', getActiveUsers);

router.get('/unique-ips', getUniqueIPs);

router.post('/clear-ip-history', clearIPHistory);

router.get('/:id', getLogDetails);

module.exports = router;
