const NetworkLog = require('../models/networkLog.model');
const dns = require('dns');
const { v4: uuidv4 } = require('uuid');
const UAParser = require('ua-parser-js');
const requestIp = require('request-ip');

const getClientIP = (req) => {
    
    const ipSources = [
        () => req.headers['cf-connecting-ip'],           
        () => req.headers['x-real-ip'],                  
        () => req.headers['x-forwarded-for']?.split(',')[0]?.trim(), 
        () => req.headers['x-client-ip'],                
        () => req.headers['x-cluster-client-ip'],        
        () => req.ip,                                    
        () => req.connection?.remoteAddress,             
        () => req.socket?.remoteAddress,                 
        () => '127.0.0.1'                               
    ];

    for (const getIP of ipSources) {
        const ip = getIP();
        if (ip && isValidIP(ip)) {
            return normalizeIP(ip);
        }
    }
    
    return '127.0.0.1';
};

const isValidIP = (ip) => {
    if (!ip || typeof ip !== 'string') return false;

    const cleanIP = ip.replace(/^::ffff:/, '');

    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (ipv4Regex.test(cleanIP)) return true;

    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (ipv6Regex.test(ip)) return true;
    
    return false;
};

const normalizeIP = (ip) => {
    
    if (ip.startsWith('::ffff:')) {
        return ip.substring(7);
    }
    return ip;
};

const getLogLevel = (statusCode) => {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warning';
    if (statusCode >= 200) return 'info';
    return 'info';
};

const getCategory = (req) => {
    const path = req.path;
    
    if (path.includes('/auth/')) return 'auth';
    if (path.includes('/users/')) return 'user_management';
    if (path.includes('/products/')) return 'product_management';
    if (path.includes('/orders/')) return 'order_management';
    if (path.includes('/cart/')) return 'cart';
    if (path.includes('/payment/')) return 'payment';
    if (path.includes('/admin/')) return 'admin_action';
    if (path.includes('/api/')) return 'api_access';
    
    return 'system';
};

const resolveHostname = (ipAddress) => {
    return new Promise((resolve) => {
        if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1') {
            return resolve('localhost');
        }
        
        const timeout = setTimeout(() => resolve(null), 2000); 
        
        dns.reverse(ipAddress, (err, hostnames) => {
            clearTimeout(timeout);
            if (err || !hostnames || hostnames.length === 0) {
                return resolve(null);
            }
            resolve(hostnames[0]);
        });
    });
};

const classifyIP = (ipAddress) => {
    if (!ipAddress || !isValidIP(ipAddress)) {
        return { ipVersion: 'unknown', ipGroup: 'unknown', tags: [] };
    }

    const tags = [];
    let ipVersion = 'ipv4';
    const normalized = normalizeIP(ipAddress);

    if (normalized.includes(':')) {
        ipVersion = 'ipv6';
    }

    const isPrivateIPv4 = /^10\.|^172\.(1[6-9]|2\d|3[0-1])\.|^192\.168\.|^127\.|^169\.254\.|^0\./.test(normalized);
    const isPrivateIPv6 = /^fe80:|^fd|^::1$|^fc00:|^ff00:/.test(normalized);
    const isLoopback = /^(127\.0\.0\.1|::1)$/.test(normalized);
    const isLinkLocal = /^169\.254\.|^fe80:/.test(normalized);

    if (isLoopback) {
        tags.push('loopback');
    } else if (isLinkLocal) {
        tags.push('link-local');
    } else if ((ipVersion === 'ipv4' && isPrivateIPv4) || (ipVersion === 'ipv6' && isPrivateIPv6)) {
        tags.push('private');
    } else {
        tags.push('public');
    }

    if (isCloudProviderIP(normalized)) {
        tags.push('cloud-provider');
    }

    let ipGroup = 'external';
    if (tags.includes('loopback')) {
        ipGroup = 'local-loopback';
    } else if (tags.includes('link-local')) {
        ipGroup = 'link-local';
    } else if (tags.includes('private')) {
        ipGroup = ipVersion === 'ipv4' ? `${normalized.split('.').slice(0, 2).join('.')}.x` : 'private-v6';
    } else if (tags.includes('cloud-provider')) {
        ipGroup = 'cloud-provider';
    }

    return { ipVersion, ipGroup, tags };
};

const isCloudProviderIP = (ip) => {
    
    const awsRanges = [
        /^3\./, /^13\./, /^18\./, /^23\./, /^34\./, /^35\./, /^52\./, /^54\./, /^107\./,
        /^174\./, /^184\./, /^205\./, /^207\./, /^209\./, /^216\./
    ];

    const cloudflareRanges = [
        /^104\.16\./, /^104\.17\./, /^104\.18\./, /^104\.19\./, /^104\.20\./, /^104\.21\./,
        /^104\.22\./, /^104\.23\./, /^104\.24\./, /^104\.25\./, /^104\.26\./, /^104\.27\./,
        /^104\.28\./, /^104\.29\./, /^104\.30\./, /^104\.31\./
    ];
    
    return awsRanges.some(range => range.test(ip)) || 
           cloudflareRanges.some(range => range.test(ip));
};

const parseUserAgent = (userAgent) => {
    if (!userAgent) {
        return null;
    }
    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();

    return {
        raw: userAgent,
        browser: browser?.name || null,
        browserVersion: browser?.version || null,
        os: os?.name || null,
        osVersion: os?.version || null,
        deviceType: device?.type || 'desktop',
        deviceVendor: device?.vendor || null,
        deviceModel: device?.model || null
    };
};

const buildRequestId = (req) => {
    if (req.headers['x-request-id']) {
        return req.headers['x-request-id'];
    }
    if (req.headers['x-session-id']) {
        return req.headers['x-session-id'];
    }
    return uuidv4();
};

const { LOG_MONITORING } = require('../config/constants');

const monitorLog = (logData) => {
    if (!global.__networkLogMonitor) {
        global.__networkLogMonitor = {
            recentSecurityCount: 0,
            recentIPs: new Map(),
            lastReset: Date.now()
        };
    }

    const monitor = global.__networkLogMonitor;
    const now = Date.now();

    const windowMs = (LOG_MONITORING.reviewIntervalHours || 6) * 60 * 60 * 1000;

    if (now - monitor.lastReset > windowMs) {
        monitor.recentSecurityCount = 0;
        monitor.recentIPs.clear();
        monitor.lastReset = now;
    }

    if (logData.level === 'security') {
        monitor.recentSecurityCount += 1;
        if (monitor.recentSecurityCount >= (LOG_MONITORING.securitySpikeThreshold || 20)) {
            console.warn('[NETWORK_MONITOR] Elevated security events detected', {
                count: monitor.recentSecurityCount,
                threshold: LOG_MONITORING.securitySpikeThreshold,
                windowMs: now - monitor.lastReset
            });
        }
    }

    if (logData.ipAddress && !logData.ipTags?.includes('private')) {
        const ipInfo = monitor.recentIPs.get(logData.ipAddress) || { count: 0, firstSeen: now };
        ipInfo.count += 1;
        monitor.recentIPs.set(logData.ipAddress, ipInfo);

        if (ipInfo.count === 1) {
            console.warn('[NETWORK_MONITOR] New external IP detected', {
                ip: logData.ipAddress,
                hostname: logData.hostName,
                role: logData.userRole,
                endpoint: logData.endpoint
            });
        } else if (ipInfo.count % (LOG_MONITORING.securitySpikeThreshold || 20) === 0) {
            console.warn('[NETWORK_MONITOR] Heavy traffic from IP', {
                ip: logData.ipAddress,
                hits: ipInfo.count,
                windowMs: now - ipInfo.firstSeen
            });
        }
    }
};

const getUserInfo = (req) => {
    if (req.user) {
        return {
            userId: req.user.id || req.user._id || null,
            userEmail: req.user.email,
            userRole: (req.user.role || 'guest').toLowerCase()
        };
    }
    return {
        userId: null,
        userEmail: null,
        userRole: 'guest'
    };
};

const networkLoggingMiddleware = (req, res, next) => {
    const startTime = process.hrtime.bigint();
    req.requestId = buildRequestId(req);

    res.setHeader('X-Request-ID', req.requestId);

    res.on('finish', async () => {
        const endTime = process.hrtime.bigint();
        const responseTime = Math.round(Number(endTime - startTime) / 1e6);

        const userInfo = getUserInfo(req);
        const ipAddress = getClientIP(req);
        const { ipVersion, ipGroup, tags: ipTags } = classifyIP(ipAddress);
        const userAgentMeta = parseUserAgent(req.get('User-Agent'));

        console.log('[IP_DEBUG]', {
            detectedIP: ipAddress,
            originalHeaders: {
                'cf-connecting-ip': req.headers['cf-connecting-ip'],
                'x-real-ip': req.headers['x-real-ip'],
                'x-forwarded-for': req.headers['x-forwarded-for'],
                'req.ip': req.ip
            },
            classification: { ipVersion, ipGroup, ipTags }
        });

        const logData = {
            level: getLogLevel(res.statusCode),
            category: getCategory(req),
            event: `${req.method} ${req.path}`,
            description: `${req.method} request to ${req.path} - Status: ${res.statusCode}`,
            userId: userInfo.userId,
            userEmail: userInfo.userEmail,
            userRole: userInfo.userRole,
            ipAddress,
            ipVersion,
            ipGroup,
            ipTags,
            userAgent: userAgentMeta?.raw,
            userAgentMeta,
            endpoint: req.path,
            method: req.method,
            statusCode: res.statusCode,
            responseTime,
            requestSize: req.get('Content-Length') ? parseInt(req.get('Content-Length'), 10) : null,
            responseSize: res.get('Content-Length') ? parseInt(res.get('Content-Length'), 10) : null,
            requestId: req.requestId,
            additionalData: {
                query: req.query,
                params: req.params,
                headers: {
                    'content-type': req.get('Content-Type'),
                    'accept': req.get('Accept'),
                    'referer': req.get('Referer'),
                    'origin': req.get('Origin'),
                    'x-request-id': req.get('X-Request-ID'),
                    'cf-connecting-ip': req.headers['cf-connecting-ip'],
                    'x-real-ip': req.headers['x-real-ip'],
                    'x-forwarded-for': req.headers['x-forwarded-for'],
                    'x-client-ip': req.headers['x-client-ip'],
                    'x-cluster-client-ip': req.headers['x-cluster-client-ip']
                }
            },
            severity: res.statusCode >= 500 ? 5 :
                     res.statusCode >= 400 ? 4 :
                     res.statusCode >= 300 ? 3 :
                     res.statusCode >= 200 ? 2 : 1,
            source: 'web_app',
            tags: [req.method.toLowerCase(), req.path.split('/')[1] || 'root']
        };

        if (ipGroup && !logData.tags.includes(ipGroup)) {
            logData.tags.push(ipGroup);
        }
        if (ipVersion && !logData.tags.includes(ipVersion)) {
            logData.tags.push(ipVersion);
        }
        if (ipTags.length) {
            logData.tags.push(...ipTags.filter(tag => !logData.tags.includes(tag)));
        }

        if (req.path.includes('/admin/')) {
            logData.tags.push('admin');
        }
        if (req.path.includes('/auth/')) {
            logData.tags.push('authentication');
        }
        if (req.method === 'POST' || req.method === 'PUT') {
            logData.tags.push('modification');
        }

        try {
            logData.hostName = await resolveHostname(ipAddress);
        } catch (err) {
            logData.hostName = null;
        }

        monitorLog(logData);

        NetworkLog.create(logData).catch(error => {
            console.error('Failed to create network log:', error);
        });
    });

    next();
};

const authLoggingMiddleware = (req, res, next) => {
    res.on('finish', async () => {
        const userInfo = getUserInfo(req);
        const ipAddress = getClientIP(req);
        const { ipVersion, ipGroup, tags: ipTags } = classifyIP(ipAddress);
        const userAgentMeta = parseUserAgent(req.get('User-Agent'));

        if (req.path.includes('/login') || req.path.includes('/register') || req.path.includes('/logout')) {
            const logData = {
                level: res.statusCode >= 400 ? 'warning' : 'info',
                category: 'auth',
                event: `${req.method} ${req.path}`,
                description: `${req.method} ${req.path} - Status: ${res.statusCode}`,
                userId: userInfo.userId,
                userEmail: userInfo.userEmail,
                userRole: userInfo.userRole,
                ipAddress,
                ipVersion,
                ipGroup,
                ipTags,
                userAgent: userAgentMeta?.raw,
                userAgentMeta,
                endpoint: req.path,
                method: req.method,
                statusCode: res.statusCode,
                severity: res.statusCode >= 400 ? 4 : 2,
                source: 'web_app',
                tags: ['authentication', req.path.includes('/login') ? 'login' :
                                          req.path.includes('/register') ? 'registration' : 'logout']
            };

            try {
                logData.hostName = await resolveHostname(ipAddress);
            } catch (err) {
                logData.hostName = null;
            }

            monitorLog(logData);

            NetworkLog.create(logData).catch(error => {
                console.error('Failed to create auth log:', error);
            });
        }
    });

    next();
};

const securityLoggingMiddleware = (event, details = {}) => {
    return async (req, res, next) => {
        try {
            const userInfo = getUserInfo(req);
            const ipAddress = getClientIP(req);
            const { ipVersion, ipGroup, tags: ipTags } = classifyIP(ipAddress);
            const userAgentMeta = parseUserAgent(req.get('User-Agent'));

            const logData = {
                level: 'security',
                category: 'security',
                event: event,
                description: details.description || `Security event: ${event}`,
                userId: userInfo.userId,
                userEmail: userInfo.userEmail,
                userRole: userInfo.userRole,
                ipAddress,
                ipVersion,
                ipGroup,
                ipTags,
                userAgent: userAgentMeta?.raw,
                userAgentMeta,
                endpoint: req.path,
                method: req.method,
                severity: details.severity || 5,
                source: 'web_app',
                tags: ['security', event.toLowerCase().replace(/\s+/g, '_')],
                additionalData: {
                    ...details,
                    timestamp: new Date().toISOString()
                }
            };

            try {
                logData.hostName = await resolveHostname(ipAddress);
            } catch (err) {
                logData.hostName = null;
            }

            monitorLog(logData);

            await NetworkLog.create(logData);
        } catch (error) {
            console.error('Failed to create security log:', error);
        }
        
        next();
    };
};

const logEvent = async (eventData) => {
    try {
        const ipAddress = eventData.ipAddress || '127.0.0.1';
        const { ipVersion, ipGroup, tags: ipTags } = classifyIP(ipAddress);
        const userAgentMeta = parseUserAgent(eventData.userAgent);

        const logData = {
            timestamp: new Date(),
            level: eventData.level || 'info',
            category: eventData.category || 'system',
            event: eventData.event,
            description: eventData.description,
            userId: eventData.userId || null,
            userEmail: eventData.userEmail || null,
            userRole: (eventData.userRole || 'guest').toLowerCase(),
            ipAddress,
            ipVersion,
            ipGroup,
            ipTags,
            userAgent: userAgentMeta?.raw,
            userAgentMeta,
            endpoint: eventData.endpoint || null,
            method: eventData.method || null,
            statusCode: eventData.statusCode || null,
            responseTime: eventData.responseTime || null,
            requestSize: eventData.requestSize || null,
            responseSize: eventData.responseSize || null,
            requestId: eventData.requestId || uuidv4(),
            additionalData: eventData.additionalData || {},
            severity: eventData.severity || 1,
            source: eventData.source || 'web_app',
            tags: eventData.tags || []
        };

        if (ipGroup && !logData.tags.includes(ipGroup)) {
            logData.tags.push(ipGroup);
        }
        if (ipVersion && !logData.tags.includes(ipVersion)) {
            logData.tags.push(ipVersion);
        }
        if (ipTags.length) {
            logData.tags.push(...ipTags.filter(tag => !logData.tags.includes(tag)));
        }

        try {
            logData.hostName = await resolveHostname(ipAddress);
        } catch (err) {
            logData.hostName = null;
        }

        monitorLog(logData);

        await NetworkLog.create(logData);
    } catch (error) {
        console.error('Failed to create manual log:', error);
    }
};

module.exports = {
    networkLoggingMiddleware,
    authLoggingMiddleware,
    securityLoggingMiddleware,
    logEvent,
    getClientIP,
    classifyIP,
    isValidIP,
    normalizeIP
};
