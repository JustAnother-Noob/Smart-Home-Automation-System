const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
const { getBlockedIPs, unblockIP, isIPBlocked } = require('../middlewares/enhanced-rate-limiter');

router.get('/blocked-ips', requireAuth, requireAdmin, (req, res) => {
    try {
        const blockedIPs = getBlockedIPs();
        
        res.json({
            success: true,
            data: {
                blockedIPs,
                count: blockedIPs.length,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching blocked IPs:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching blocked IPs',
            error: error.message
        });
    }
});

router.post('/unblock-ip', requireAuth, requireAdmin, (req, res) => {
    try {
        const { ip } = req.body;
        
        if (!ip) {
            return res.status(400).json({
                success: false,
                message: 'IP address is required'
            });
        }

        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ip)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid IP address format'
            });
        }
        
        const wasBlocked = isIPBlocked({ ip });
        const unblocked = unblockIP(ip);
        
        if (unblocked) {
            console.log(`🔓 Admin ${req.user.email} unblocked IP: ${ip}`);
            
            res.json({
                success: true,
                message: `IP ${ip} has been unblocked`,
                data: {
                    ip,
                    wasBlocked,
                    unblockedAt: new Date().toISOString(),
                    unblockedBy: req.user.email
                }
            });
        } else {
            res.status(404).json({
                success: false,
                message: `IP ${ip} was not blocked`
            });
        }
    } catch (error) {
        console.error('Error unblocking IP:', error);
        res.status(500).json({
            success: false,
            message: 'Error unblocking IP',
            error: error.message
        });
    }
});

router.get('/check-ip/:ip', requireAuth, requireAdmin, (req, res) => {
    try {
        const { ip } = req.params;

        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ip)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid IP address format'
            });
        }
        
        const blocked = isIPBlocked({ ip });
        
        res.json({
            success: true,
            data: {
                ip,
                isBlocked: blocked,
                checkedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error checking IP status:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking IP status',
            error: error.message
        });
    }
});

router.get('/stats', requireAuth, requireAdmin, (req, res) => {
    try {
        const blockedIPs = getBlockedIPs();

        const stats = {
            totalBlockedIPs: blockedIPs.length,
            recentlyBlocked: blockedIPs.filter(block => {
                const blockTime = new Date(block.expires).getTime() - (block.timeRemaining * 1000);
                return (Date.now() - blockTime) < (24 * 60 * 60 * 1000); 
            }).length,
            averageBlockDuration: blockedIPs.length > 0 
                ? Math.round(blockedIPs.reduce((sum, block) => sum + block.timeRemaining, 0) / blockedIPs.length)
                : 0,
            topReasons: {}
        };

        blockedIPs.forEach(block => {
            const reason = block.reason.split(':')[0]; 
            stats.topReasons[reason] = (stats.topReasons[reason] || 0) + 1;
        });
        
        res.json({
            success: true,
            data: {
                ...stats,
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'development'
            }
        });
    } catch (error) {
        console.error('Error fetching rate limit stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching rate limit statistics',
            error: error.message
        });
    }
});

module.exports = router;
