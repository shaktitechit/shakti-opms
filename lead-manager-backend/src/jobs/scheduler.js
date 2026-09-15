/**
 * @fileoverview Cron schedules for lead-manager-backend.
 * @module jobs/scheduler
 */
const cron = require('node-cron');
const {
  FOLLOWUP_REMINDER_ENABLED,
  FOLLOWUP_REMINDER_CRON,
  FOLLOWUP_REMINDER_TZ,
} = require('../config/env');
const { runAllFollowUpReminders } = require('./followUpDailyReminder');
const { logger } = require('../utils/logger');

let started = false;

function startSchedulers() {
  if (started) return;
  started = true;

  const enabled = String(FOLLOWUP_REMINDER_ENABLED).toLowerCase() !== 'false';
  if (!enabled) {
    logger.info('[scheduler] follow-up daily reminders disabled (FOLLOWUP_REMINDER_ENABLED=false)');
    return;
  }

  const expression = FOLLOWUP_REMINDER_CRON || '0 7 * * *';
  const timeZone = FOLLOWUP_REMINDER_TZ || 'Asia/Kolkata';

  if (!cron.validate(expression)) {
    logger.error(`[scheduler] invalid FOLLOWUP_REMINDER_CRON="${expression}" — reminders not started`);
    return;
  }

  cron.schedule(
    expression,
    () => {
      runAllFollowUpReminders({ timeZone }).catch((err) => {
        logger.error(`[scheduler] follow-up reminders failed: ${err.message}`);
      });
    },
    { timezone: timeZone }
  );

  logger.info(
    `[scheduler] today's + overdue follow-up reminders at cron="${expression}" tz="${timeZone}"`
  );
}

module.exports = {
  startSchedulers,
};
