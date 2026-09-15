require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 7003,
  NODE_ENV: process.env.NODE_ENV || '',
  MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  MASTER_PASSWORD: process.env.MASTER_PASSWORD || '',
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:7012',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  JSON_BODY_LIMIT: process.env.JSON_BODY_LIMIT || '15mb',
};
