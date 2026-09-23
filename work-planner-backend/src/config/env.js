require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 7007,
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || '',
  MESSAGE_SERVICE_URL: process.env.MESSAGE_SERVICE_URL || '',
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || '',
  PARTY_SERVICE_URL: process.env.PARTY_SERVICE_URL || '',
  LEAD_MANAGER_SERVICE_URL: process.env.LEAD_MANAGER_SERVICE_URL || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  JSON_BODY_LIMIT: process.env.JSON_BODY_LIMIT || '15mb',
  FILE_MANAGEMENT_API_URL: process.env.FILE_MANAGEMENT_API_URL || '',
  FILE_MANAGEMENT_API_KEY:
    process.env.FILE_MANAGEMENT_API_KEY ||
    '',
  FRONTEND_URL: process.env.FRONTEND_URL || '',
  WORK_PLANNER_TZ: process.env.WORK_PLANNER_TZ || 'Asia/Kolkata',
  WORK_PLAN_PENDING_CRON: process.env.WORK_PLAN_PENDING_CRON || '0 10 * * *',
  DAY_END_PENDING_CRON: process.env.DAY_END_PENDING_CRON || '0 18 * * *',
  WORK_PLANNER_REMINDERS_ENABLED: process.env.WORK_PLANNER_REMINDERS_ENABLED || 'true',
};
