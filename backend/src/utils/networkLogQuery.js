

function buildQuery(filters = {}) {
    const q = {};

    if (filters.level) q.level = filters.level;
    if (filters.category) q.category = filters.category;
    if (filters.userRole) q.userRole = filters.userRole;
    if (filters.userId) q.userId = filters.userId;
    if (filters.ipAddress) q.ipAddress = filters.ipAddress;
    if (filters.ipVersion) q.ipVersion = filters.ipVersion;
    if (filters.ipGroup) q.ipGroup = filters.ipGroup;

    if (filters.sequenceNumber) {
        const seq = parseInt(filters.sequenceNumber, 10);
        if (!isNaN(seq)) {
            q.sequenceNumber = seq;
        }
    }

    if (filters.endpoint) {
        q.endpoint = { $regex: filters.endpoint, $options: 'i' };
    }

    if (filters.statusCode) {
        const statusCode = parseInt(filters.statusCode, 10);
        if (!isNaN(statusCode)) {
            q.statusCode = statusCode;
        }
    }

    if (filters.requestId) {
        q.requestId = String(filters.requestId).trim();
    }

    if (filters.ipTags && filters.ipTags.length) {
        q.ipTags = { $all: filters.ipTags };
    }
    
    if (filters.minSeverity) {
        const severity = parseInt(filters.minSeverity, 10);
        if (!isNaN(severity)) {
            q.severity = { $gte: severity };
        }
    }

    if (filters.startDate || filters.endDate) {
        const startDate = filters.startDate ? new Date(filters.startDate) : null;
        const endDate = filters.endDate ? new Date(filters.endDate) : null;
        
        const validStart = startDate && !isNaN(startDate.getTime());
        const validEnd = endDate && !isNaN(endDate.getTime());
        
        if (validStart || validEnd) {
            q.timestamp = {};
            if (validStart) q.timestamp.$gte = startDate;
            if (validEnd) q.timestamp.$lte = endDate;
        }
    }

    if (filters.logId) {
        const raw = String(filters.logId).trim().toUpperCase();

        const m = raw.match(/^(\d{2})([A-L])[- ]?(\d{1,6})$/);
        
        if (m) {
            const seq = parseInt(m[3], 10);
            if (!isNaN(seq)) {
                q.sequenceNumber = seq;
            }
        } else {
            
            const seqNum = parseInt(raw, 10);
            if (!isNaN(seqNum)) {
                q.sequenceNumber = seqNum;
            }
        }
    }

    if (filters.search && filters.search.trim()) {
        q.$text = { $search: filters.search.trim() };
    }
    
    return q;
}

function buildSort(sortBy = 'timestamp', sortOrder = 'desc') {
    
    const sortMap = {
        timestamp: 'timestamp',
        level: 'level',
        category: 'category',
        severity: 'severity',
        responseTime: 'responseTime',
        statusCode: 'statusCode',
        sequenceNumber: 'sequenceNumber',
        logId: 'sequenceNumber' 
    };

    const field = sortMap[sortBy] || 'timestamp';
    const order = sortOrder === 'asc' ? 1 : -1;
    
    return { [field]: order };
}

function buildPagination(page = 1, limit = 50) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;
    
    return { page: pageNum, limit: limitNum, skip };
}

module.exports = {
    buildQuery,
    buildSort,
    buildPagination
};
