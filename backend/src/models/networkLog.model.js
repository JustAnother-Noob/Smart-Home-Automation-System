const mongoose = require('mongoose');

const networkLogSchema = new mongoose.Schema({
    sequenceNumber: {
        type: Number,
        unique: true,
        sparse: true 
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    },
    level: {
        type: String,
        enum: ['info', 'warning', 'error', 'critical', 'security'],
        required: true
    },
    category: {
        type: String,
        enum: [
            'auth', 'user_management', 'product_management', 'order_management',
            'payment', 'cart', 'api_access', 'system', 'security', 'admin_action'
        ],
        required: true
    },
    event: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    userEmail: {
        type: String,
        default: null
    },
    userRole: {
        type: String,
        enum: ['user', 'admin', 'guest'],
        default: 'guest'
    },
    ipAddress: {
        type: String,
        required: true
    },
    hostName: {
        type: String,
        default: null
    },
    ipVersion: {
        type: String,
        enum: ['ipv4', 'ipv6', 'unknown'],
        default: 'unknown'
    },
    ipGroup: {
        type: String,
        default: 'external'
    },
    ipTags: [
        {
            type: String,
            trim: true
        }
    ],
    userAgent: {
        type: String,
        default: null
    },
    userAgentMeta: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    endpoint: {
        type: String,
        default: null
    },
    method: {
        type: String,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE'],
        default: null
    },
    statusCode: {
        type: Number,
        default: null
    },
    responseTime: {
        type: Number, 
        default: null
    },
    requestSize: {
        type: Number, 
        default: null
    },
    responseSize: {
        type: Number, 
        default: null
    },
    additionalData: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    requestId: {
        type: String,
        default: null,
        index: true
    },
    severity: {
        type: Number,
        min: 1,
        max: 5,
        default: 1
    },
    source: {
        type: String,
        default: 'web_app'
    },
    tags: [{
        type: String,
        trim: true
    }]
}, {
    timestamps: true
});

networkLogSchema.index({ timestamp: -1 });
networkLogSchema.index({ level: 1, timestamp: -1 });
networkLogSchema.index({ category: 1, timestamp: -1 });
networkLogSchema.index({ userId: 1, timestamp: -1 });
networkLogSchema.index({ ipAddress: 1, timestamp: -1 });
networkLogSchema.index({ ipGroup: 1, timestamp: -1 });
networkLogSchema.index({ ipVersion: 1, timestamp: -1 });
networkLogSchema.index({ ipTags: 1, timestamp: -1 });
networkLogSchema.index({ endpoint: 1, timestamp: -1 });
networkLogSchema.index({ statusCode: 1, timestamp: -1 });
networkLogSchema.index({ severity: 1, timestamp: -1 });
networkLogSchema.index({ requestId: 1 });

networkLogSchema.index({ level: 1, category: 1, timestamp: -1 });
networkLogSchema.index({ userRole: 1, timestamp: -1 });

networkLogSchema.index({
    event: 'text',
    description: 'text',
    userEmail: 'text'
});

networkLogSchema.statics.getFilteredLogs = function(filters = {}, page = 1, limit = 50, sort = { timestamp: -1 }) {
    const { buildQuery, buildPagination } = require('../utils/networkLogQuery');
    const query = buildQuery(filters);
    const { skip, limit: limitNum } = buildPagination(page, limit);
    
    return this.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('userId', 'firstName lastName email')
        .lean();
};

networkLogSchema.statics.getLogStats = function(timeRange = '24h') {
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
        case '1h':
            startDate = new Date(now.getTime() - 60 * 60 * 1000);
            break;
        case '24h':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        default:
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    
    return this.aggregate([
        {
            $match: {
                timestamp: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: null,
                totalLogs: { $sum: 1 },
                errorLogs: {
                    $sum: {
                        $cond: [{ $in: ['$level', ['error', 'critical']] }, 1, 0]
                    }
                },
                securityLogs: {
                    $sum: {
                        $cond: [{ $eq: ['$level', 'security'] }, 1, 0]
                    }
                },
                warningLogs: {
                    $sum: {
                        $cond: [{ $eq: ['$level', 'warning'] }, 1, 0]
                    }
                },
                uniqueUsers: {
                    $addToSet: {
                        $cond: [
                            { $ne: ['$userId', null] },
                            { $toString: '$userId' },
                            {
                                $cond: [
                                    {
                                        $gt: [
                                            {
                                                $strLenCP: {
                                                    $trim: { input: { $ifNull: ['$userEmail', ''] } }
                                                }
                                            },
                                            0
                                        ]
                                    },
                                    {
                                        $toLower: {
                                            $trim: { input: '$userEmail' }
                                        }
                                    },
                                    null
                                ]
                            }
                        ]
                    }
                },
                uniqueIPs: { $addToSet: '$ipAddress' }
            }
        },
        {
            $project: {
                totalLogs: 1,
                errorLogs: 1,
                securityLogs: 1,
                warningLogs: 1,
                uniqueUserCount: {
                    $size: {
                        $filter: {
                            input: '$uniqueUsers',
                            as: 'identity',
                            cond: {
                                $and: [
                                    { $ne: ['$$identity', null] },
                                    { $ne: ['$$identity', ''] }
                                ]
                            }
                        }
                    }
                },
                uniqueIPCount: { $size: '$uniqueIPs' }
            }
        }
    ]);
};

const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    sequence: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

networkLogSchema.pre('save', async function(next) {
    if (this.isNew && !this.sequenceNumber) {
        try {
            const counter = await Counter.findByIdAndUpdate(
                'networkLogSequence',
                { $inc: { sequence: 1 } },
                { new: true, upsert: true }
            );
            this.sequenceNumber = counter.sequence;
        } catch (error) {
            return next(error);
        }
    }
    next();
});

const NetworkLog = mongoose.model('NetworkLog', networkLogSchema);

module.exports = NetworkLog;
