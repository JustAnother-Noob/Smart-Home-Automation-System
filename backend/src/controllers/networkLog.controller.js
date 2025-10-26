const NetworkLog = require('../models/networkLog.model');
const { buildQuery, buildSort, buildPagination } = require('../utils/networkLogQuery');

const getTimeRangeStartDate = (timeRange) => {
    const now = new Date();
    switch (timeRange) {
        case '1h':
            return new Date(now.getTime() - 60 * 60 * 1000);
        case '24h':
            return new Date(now.getTime() - 24 * 60 * 60 * 1000);
        case '7d':
            return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case '30d':
            return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        default:
            return new Date(now.getTime() - 24 * 60 * 60 * 1000); 
    }
};

const getNetworkLogs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            level,
            category,
            userRole,
            userId,
            ipAddress,
            endpoint,
            statusCode,
            minSeverity,
            startDate,
            endDate,
            search,
            sortBy = 'timestamp',
            sortOrder = 'desc',
            
            logId,
            sequenceNumber,
            ipVersion,
            ipGroup,
            requestId,
            ipTags: ipTags = req.query.ipTags
        } = req.query;

        const filters = {
            level,
            category,
            userRole,
            userId,
            ipAddress,
            endpoint,
            statusCode,
            minSeverity,
            startDate,
            endDate,
            search,
            logId,
            sequenceNumber,
            ipVersion,
            ipGroup,
            requestId,
            ipTags: ipTags ? ipTags.split(',').map(tag => tag.trim()).filter(Boolean) : undefined
        };

        Object.keys(filters).forEach(key => {
            if (filters[key] === undefined || filters[key] === '') {
                delete filters[key];
            }
        });

        const mongoQuery = buildQuery(filters);
        const sort = buildSort(sortBy, sortOrder);
        const pagination = buildPagination(page, limit);

        const [logs, totalLogs, stats] = await Promise.all([
            NetworkLog.getFilteredLogs(filters, pagination.page, pagination.limit, sort),
            NetworkLog.countDocuments(mongoQuery),
            NetworkLog.getLogStats('24h')
        ]);

        res.json({
            success: true,
            data: {
                logs,
                pagination: {
                    currentPage: pagination.page,
                    totalPages: Math.ceil(totalLogs / pagination.limit),
                    totalLogs,
                    limit: pagination.limit
                },
                stats: stats[0] || {
                    totalLogs: 0,
                    errorLogs: 0,
                    securityLogs: 0,
                    warningLogs: 0,
                    uniqueUserCount: 0,
                    uniqueIPCount: 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching network logs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch network logs',
            error: error.message
        });
    }
};

const getLogStats = async (req, res) => {
    try {
        const { timeRange = '24h' } = req.query;
        const startDate = getTimeRangeStartDate(timeRange);
        
        const stats = await NetworkLog.getLogStats(timeRange);

        const categoryStats = await NetworkLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        const levelStats = await NetworkLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$level',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        res.json({
            success: true,
            data: {
                overview: stats[0] || {
                    totalLogs: 0,
                    errorLogs: 0,
                    securityLogs: 0,
                    warningLogs: 0,
                    uniqueUserCount: 0,
                    uniqueIPCount: 0
                },
                categoryBreakdown: categoryStats,
                levelBreakdown: levelStats
            }
        });
    } catch (error) {
        console.error('Error fetching log statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch log statistics',
            error: error.message
        });
    }
};

const getRealtimeLogs = async (req, res) => {
    try {
        
        const recentLogs = await NetworkLog.find({
            timestamp: {
                $gte: new Date(Date.now() - 5 * 60 * 1000)
            }
        })
        .sort({ timestamp: -1 })
        .limit(100)
        .populate('userId', 'firstName lastName email')
        .lean();

        res.json({
            success: true,
            data: recentLogs
        });
    } catch (error) {
        console.error('Error fetching real-time logs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch real-time logs',
            error: error.message
        });
    }
};

const getLogDetails = async (req, res) => {
    try {
        const { id } = req.params;
        
        const log = await NetworkLog.findById(id)
            .populate('userId', 'firstName lastName email phone role')
            .lean();

        if (!log) {
            return res.status(404).json({
                success: false,
                message: 'Log not found'
            });
        }

        res.json({
            success: true,
            data: log
        });
    } catch (error) {
        console.error('Error fetching log details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch log details',
            error: error.message
        });
    }
};

const deleteOldLogs = async (req, res) => {
    try {
        
        const bodyDays = req?.body?.days;
        const queryDays = req?.query?.days;
        let days = Number.isFinite(Number(bodyDays)) && Number(bodyDays) > 0
            ? Number(bodyDays)
            : (Number.isFinite(Number(queryDays)) && Number(queryDays) > 0 ? Number(queryDays) : 90);

        const includeProtected = Boolean(req?.body?.includeProtected);

        const filter = {
            timestamp: { $lt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
        };

        if (!includeProtected) {
            filter.level = { $nin: ['critical', 'security'] };
        }

        const result = await NetworkLog.deleteMany(filter);

        res.json({
            success: true,
            message: `Deleted ${result.deletedCount} old logs (older than ${days} days)` ,
            deletedCount: result.deletedCount,
            days,
            includeProtected
        });
    } catch (error) {
        console.error('Error deleting old logs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete old logs',
            error: error.message
        });
    }
};

const exportLogs = async (req, res) => {
    try {
        const {
            level,
            category,
            startDate,
            endDate,
            format = 'csv'
        } = req.query;

        const filters = { level, category, startDate, endDate };
        Object.keys(filters).forEach(key => {
            if (filters[key] === undefined || filters[key] === '') {
                delete filters[key];
            }
        });

        const mongoQuery = buildQuery(filters);

        const logs = await NetworkLog.find(mongoQuery)
            .sort({ timestamp: -1, sequenceNumber: -1 })
            .limit(10000) 
            .populate('userId', 'firstName lastName email')
            .lean();

        if (format === 'csv') {
            
            const escapeCSV = (value) => {
                const str = String(value || '');
                return `"${str.replace(/"/g, '""')}"`;
            };

            const csvHeaders = [
                'Log ID', 'Sequence', 'Timestamp', 'Level', 'Category', 'Event', 'Description',
                'User Email', 'User Role', 'IP Address', 'Hostname', 'IP Version', 'IP Group', 'IP Tags',
                'Endpoint', 'Method', 'Status Code', 'Response Time (ms)', 'Severity',
                'Request ID', 'User Agent', 'Browser', 'Browser Version', 'OS', 'OS Version', 'Device Type', 'Device Vendor', 'Device Model'
            ];

            const csvRows = logs.map(log => [
                
                (() => {
                    const d = new Date(log.timestamp);
                    const y = String(d.getFullYear()).slice(-2);
                    const m = String.fromCharCode(65 + d.getMonth());
                    const seq = String(log.sequenceNumber || '').padStart(3, '0');
                    return `${y}${m}-${seq}`;
                })(),
                log.sequenceNumber || '',
                log.timestamp.toISOString(),
                log.level,
                log.category,
                log.event,
                log.description,
                log.userEmail || '',
                log.userRole,
                log.ipAddress,
                log.hostName || '',
                log.ipVersion || '',
                log.ipGroup || '',
                Array.isArray(log.ipTags) ? log.ipTags.join('|') : '',
                log.endpoint || '',
                log.method || '',
                log.statusCode || '',
                log.responseTime || '',
                log.severity,
                log.requestId || '',
                log.userAgent || '',
                log.userAgentMeta?.browser || '',
                log.userAgentMeta?.browserVersion || '',
                log.userAgentMeta?.os || '',
                log.userAgentMeta?.osVersion || '',
                log.userAgentMeta?.deviceType || '',
                log.userAgentMeta?.deviceVendor || '',
                log.userAgentMeta?.deviceModel || ''
            ]);

            const csvContent = [csvHeaders, ...csvRows]
                .map(row => row.map(escapeCSV).join(','))
                .join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="network_logs_${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csvContent);
        } else {
            res.json({
                success: true,
                data: logs
            });
        }
    } catch (error) {
        console.error('Error exporting logs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export logs',
            error: error.message
        });
    }
};

const DEFAULT_ACTIVE_USERS_WINDOW_MINUTES = 15;
const MAX_ACTIVE_USERS_WINDOW_MINUTES = 30 * 24 * 60; 
const TIME_RANGE_WINDOW_MINUTES = {
    '1h': 60,
    '24h': 24 * 60,
    '7d': 7 * 24 * 60,
    '30d': 30 * 24 * 60
};

const getActiveUsers = async (req, res) => {
    try {
        const { windowMinutes, timeRange } = req.query || {};

        let resolvedWindowMinutes = DEFAULT_ACTIVE_USERS_WINDOW_MINUTES;

        if (windowMinutes !== undefined) {
            const parsedWindow = parseInt(windowMinutes, 10);
            if (Number.isFinite(parsedWindow) && parsedWindow > 0) {
                resolvedWindowMinutes = parsedWindow;
            }
        } else if (timeRange && TIME_RANGE_WINDOW_MINUTES[timeRange]) {
            resolvedWindowMinutes = TIME_RANGE_WINDOW_MINUTES[timeRange];
        }

        resolvedWindowMinutes = Math.min(resolvedWindowMinutes, MAX_ACTIVE_USERS_WINDOW_MINUTES);

        const lookbackMs = resolvedWindowMinutes * 60 * 1000;
        const since = new Date(Date.now() - lookbackMs);

        const recentLogs = await NetworkLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: since },
                    $or: [
                        { userId: { $ne: null } },
                        { userEmail: { $ne: null } }
                    ]
                }
            },
            {
                $addFields: {
                    identityKey: {
                        $cond: [
                            { $ifNull: ['$userId', false] },
                            { $concat: ['id::', { $toString: '$userId' }] },
                            { $concat: ['email::', { $toLower: '$userEmail' }] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$identityKey',
                    userId: { $first: '$userId' },
                    userEmail: { $first: '$userEmail' },
                    userRole: { $first: '$userRole' },
                    lastActivity: { $max: '$timestamp' },
                    eventSample: { $first: '$event' },
                    ipAddress: { $first: '$ipAddress' },
                    ipVersion: { $first: '$ipVersion' },
                    hostName: { $first: '$hostName' },
                    logCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userDoc'
                }
            },
            {
                $addFields: {
                    userDoc: { $first: '$userDoc' }
                }
            },
            {
                $project: {
                    _id: 0,
                    identityKey: '$_id',
                    user: {
                        id: {
                            $cond: [
                                { $ifNull: ['$userId', false] },
                                { $toString: '$userId' },
                                null
                            ]
                        },
                        email: {
                            $ifNull: [
                                { $ifNull: ['$userDoc.email', '$userEmail'] },
                                '$userEmail'
                            ]
                        },
                        firstName: '$userDoc.firstName',
                        lastName: '$userDoc.lastName',
                        phone: '$userDoc.phone',
                        role: {
                            $ifNull: ['$userDoc.role', '$userRole']
                        }
                    },
                    lastActivity: 1,
                    logCount: 1,
                    lastEvent: '$eventSample',
                    ipAddress: 1,
                    ipVersion: 1,
                    hostName: 1
                }
            },
            {
                $sort: { lastActivity: -1 }
            }
        ]);

        const totalActive = recentLogs.length;
        const uniqueByRole = recentLogs.reduce((acc, item) => {
            const role = item?.user?.role || 'unknown';
            acc[role] = (acc[role] || 0) + 1;
            return acc;
        }, {});

        return res.json({
            success: true,
            data: {
                totalActive,
                roles: uniqueByRole,
                windowMinutes: resolvedWindowMinutes,
                users: recentLogs
            }
        });
    } catch (error) {
        console.error('Error fetching active users from network logs:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch active users',
            error: error.message
        });
    }
};

const getUniqueIPs = async (req, res) => {
    try {
        const { windowMinutes, timeRange } = req.query || {};

        let resolvedWindowMinutes = DEFAULT_ACTIVE_USERS_WINDOW_MINUTES;

        if (windowMinutes !== undefined) {
            const parsedWindow = parseInt(windowMinutes, 10);
            if (Number.isFinite(parsedWindow) && parsedWindow > 0) {
                resolvedWindowMinutes = parsedWindow;
            }
        } else if (timeRange && TIME_RANGE_WINDOW_MINUTES[timeRange]) {
            resolvedWindowMinutes = TIME_RANGE_WINDOW_MINUTES[timeRange];
        }

        resolvedWindowMinutes = Math.min(resolvedWindowMinutes, MAX_ACTIVE_USERS_WINDOW_MINUTES);

        const lookbackMs = resolvedWindowMinutes * 60 * 1000;
        const since = new Date(Date.now() - lookbackMs);

        const recentLogs = await NetworkLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: since },
                    ipAddress: { $ne: null, $ne: '' }
                }
            },
            {
                $group: {
                    _id: '$ipAddress',
                    ipAddress: { $first: '$ipAddress' },
                    ipVersion: { $first: '$ipVersion' },
                    hostName: { $first: '$hostName' },
                    ipTags: { $first: '$ipTags' },
                    userEmail: { $first: '$userEmail' },
                    lastActivity: { $max: '$timestamp' },
                    lastEvent: { $first: '$event' },
                    logCount: { $sum: 1 }
                }
            },
            {
                $sort: { logCount: -1, lastActivity: -1 }
            }
        ]);

        const totalUnique = recentLogs.length;
        const uniqueByVersion = recentLogs.reduce((acc, item) => {
            const version = item?.ipVersion || 'Unknown';
            acc[version] = (acc[version] || 0) + 1;
            return acc;
        }, {});

        return res.json({
            success: true,
            data: {
                totalUnique,
                versions: uniqueByVersion,
                windowMinutes: resolvedWindowMinutes,
                ips: recentLogs
            }
        });
    } catch (error) {
        console.error('Error fetching unique IPs from network logs:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch unique IPs',
            error: error.message
        });
    }
};

const clearIPHistory = async (req, res) => {
    try {
        console.log('[IP_HISTORY_CLEAR] Starting IP history clear operation');
        console.log('[IP_HISTORY_CLEAR] User:', req.user?.email);
        console.log('[IP_HISTORY_CLEAR] Request method:', req.method);
        console.log('[IP_HISTORY_CLEAR] Request headers:', req.headers);

        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) {
            console.error('[IP_HISTORY_CLEAR] Database not connected. ReadyState:', mongoose.connection.readyState);
            throw new Error('Database not connected');
        }
        console.log('[IP_HISTORY_CLEAR] Database connection verified');

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        console.log('[IP_HISTORY_CLEAR] Cutoff time:', twentyFourHoursAgo.toISOString());

        try {
            const totalLogs = await NetworkLog.countDocuments();
            console.log('[IP_HISTORY_CLEAR] Total logs in collection:', totalLogs);
        } catch (countError) {
            console.error('[IP_HISTORY_CLEAR] Error counting documents:', countError);
            throw new Error(`Collection access error: ${countError.message}`);
        }

        const filter = {
            timestamp: { $lt: twentyFourHoursAgo },
            level: { $nin: ['critical', 'security'] }
        };
        
        console.log('[IP_HISTORY_CLEAR] Filter:', JSON.stringify(filter));

        try {
            const matchingLogs = await NetworkLog.countDocuments(filter);
            console.log('[IP_HISTORY_CLEAR] Matching logs to delete:', matchingLogs);
        } catch (countError) {
            console.error('[IP_HISTORY_CLEAR] Error counting matching documents:', countError);
            throw new Error(`Filter count error: ${countError.message}`);
        }

        console.log('[IP_HISTORY_CLEAR] Attempting to delete documents...');
        const result = await NetworkLog.deleteMany(filter);
        console.log('[IP_HISTORY_CLEAR] Delete result:', {
            acknowledged: result.acknowledged,
            deletedCount: result.deletedCount
        });

        console.log(`[IP_HISTORY_CLEAR] Admin ${req.user?.email || 'unknown'} cleared ${result.deletedCount} IP history entries older than 24 hours`);

        return res.json({
            success: true,
            message: `Successfully cleared ${result.deletedCount} IP history entries older than 24 hours`,
            deletedCount: result.deletedCount,
            cutoffTime: twentyFourHoursAgo.toISOString()
        });
    } catch (error) {
        console.error('[IP_HISTORY_CLEAR] Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code
        });
        return res.status(500).json({
            success: false,
            message: 'Failed to clear IP history',
            error: error.message
        });
    }
};

module.exports = {
    getNetworkLogs,
    getLogStats,
    getRealtimeLogs,
    getLogDetails,
    deleteOldLogs,
    exportLogs,
    getActiveUsers,
    getUniqueIPs,
    clearIPHistory
};
