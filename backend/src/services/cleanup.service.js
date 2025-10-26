const ArchivedUser = require('../models/archivedUser.model');

const cleanupExpiredArchivedUsers = async () => {
    try {
        const now = new Date();
        
        const result = await ArchivedUser.deleteMany({
            expiryDate: { $lt: now }
        });
        
        if (result.deletedCount > 0) {
            console.log(`Cleanup task: Removed ${result.deletedCount} expired archived users`);
        }
    } catch (error) {
        console.error('Error in cleanup task:', error);
    }
};

const scheduleCleanupTask = () => {
    
    cleanupExpiredArchivedUsers();

    setInterval(cleanupExpiredArchivedUsers, 86400000);
    
    console.log('Archived user cleanup task scheduled');
};

module.exports = { scheduleCleanupTask };
