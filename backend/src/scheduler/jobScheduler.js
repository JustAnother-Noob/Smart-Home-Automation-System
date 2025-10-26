

const cron = require('node-cron');
const Installation = require('../models/installation.model');
const NetworkLog = require('../models/networkLog.model');
const { LOG_RETENTION, LOG_MONITORING } = require('../config/constants');

function startScheduler() {
  console.log('📅 Job Scheduler initialized');

  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('[Scheduler] Checking for upcoming installations...');

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      const upcoming = await Installation.find({
        installationDate: { $gte: tomorrow, $lt: dayAfterTomorrow },
        status: { $in: ['pending', 'confirmed'] }
      });

      if (upcoming.length > 0) {
        console.log(`[Scheduler] ${upcoming.length} installation(s) scheduled for tomorrow:`);
        upcoming.forEach(install => {
          console.log(
            ` - ${install.customerName}, ${install.productInstalled}, ${install.installationDate.toDateString()}, Status: ${install.status}`
          );
        });

      } else {
        console.log('[Scheduler] No installations for tomorrow.');
      }
    } catch (error) {
      console.error('[Scheduler] Error checking upcoming installations:', error);
    }
  });

  cron.schedule('30 2 * * *', async () => {
    try {
      console.log('[Scheduler] Running network log retention cleanup...');

      const now = new Date();
      const buildCutoff = (days) => new Date(now.getTime() - (Number(days) || 0) * 24 * 60 * 60 * 1000);

      const retentionRules = [
        {
          name: 'info',
          filter: { level: 'info', category: { $nin: ['admin_action', 'security'] } },
          cutoff: buildCutoff(LOG_RETENTION?.infoDays || 30)
        },
        {
          name: 'warning',
          filter: { level: 'warning', category: { $nin: ['admin_action', 'security'] } },
          cutoff: buildCutoff(LOG_RETENTION?.warningDays || 90)
        },
        {
          name: 'error',
          filter: { level: { $in: ['error', 'critical'] }, category: { $ne: 'security' } },
          cutoff: buildCutoff(LOG_RETENTION?.errorDays || 180)
        },
        {
          name: 'security',
          filter: { level: 'security' },
          cutoff: buildCutoff(LOG_RETENTION?.securityDays || 365)
        },
        {
          name: 'admin',
          filter: { category: 'admin_action' },
          cutoff: buildCutoff(LOG_RETENTION?.adminDays || 365)
        }
      ];

      let totalDeleted = 0;
      for (const rule of retentionRules) {
        if (!rule.cutoff || Number.isNaN(rule.cutoff.getTime())) continue;

        const deleteFilter = {
          ...rule.filter,
          timestamp: { $lt: rule.cutoff }
        };

        const result = await NetworkLog.deleteMany(deleteFilter);
        totalDeleted += result.deletedCount || 0;

        if (result.deletedCount) {
          console.log(`[Scheduler] Retention rule ${rule.name}: deleted ${result.deletedCount} logs older than ${rule.cutoff.toISOString()}`);
        }
      }

      if (totalDeleted === 0) {
        console.log('[Scheduler] Retention cleanup: no logs deleted this run.');
      }
    } catch (error) {
      console.error('[Scheduler] Error during network log retention cleanup:', error);
    }
  });

  const reviewInterval = Math.max(1, Number(LOG_MONITORING?.reviewIntervalHours) || 6);
  cron.schedule(`0 */${reviewInterval} * * *`, async () => {
    try {
      const since = new Date(Date.now() - reviewInterval * 60 * 60 * 1000);
      const securityCount = await NetworkLog.countDocuments({ level: 'security', timestamp: { $gte: since } });

      console.log(`[Scheduler] Network log review: ${securityCount} security events in the last ${reviewInterval} hour(s).`);

      const threshold = Number(LOG_MONITORING?.securitySpikeThreshold) || 20;
      if (securityCount >= threshold) {
        console.warn('[Scheduler] ALERT: Security event threshold exceeded.', {
          securityCount,
          threshold,
          windowHours: reviewInterval
        });
      }
    } catch (error) {
      console.error('[Scheduler] Error generating network log review summary:', error);
    }
  });
}

module.exports = startScheduler;
