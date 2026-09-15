/**
 * @fileoverview Posts notifications to notification-service (shared in-app / SSE / push).
 * @module utils/notificationHelper
 */
const axios = require('axios');
const { NOTIFICATION_SERVICE_URL } = require('../config/env');
const { logger } = require('./logger');

async function createForUser(userId, payload) {
  try {
    const url = `${NOTIFICATION_SERVICE_URL.replace(/\/$/, '')}/api/notifications/internal/create`;
    const response = await axios.post(url, { userId, payload }, { timeout: 10000 });
    return response.data?.data ?? null;
  } catch (err) {
    logger.error(`[notificationHelper.createForUser] ${err?.message || err}`);
    return null;
  }
}

module.exports = {
  createForUser,
};
