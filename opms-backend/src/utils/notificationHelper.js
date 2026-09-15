const axios = require('axios');
const { NOTIFICATION_SERVICE_URL } = require('../config/env');

async function createForUser(userId, payload) {
  try {
    const url = `${NOTIFICATION_SERVICE_URL.replace(/\/$/, '')}/api/notifications/internal/create`;
    const response = await axios.post(url, { userId, payload });
    return response.data?.data;
  } catch (err) {
    console.error('[notificationHelper.createForUser] Error:', err?.message || err);
    return null;
  }
}

async function notifyOrderTransition({ order, fromStatus, nextStatus, actorId }) {
  try {
    const url = `${NOTIFICATION_SERVICE_URL.replace(/\/$/, '')}/api/notifications/internal/order-transition`;
    await axios.post(url, { order, fromStatus, nextStatus, actorId });
  } catch (err) {
    console.error('[notificationHelper.notifyOrderTransition] Error:', err?.message || err);
  }
}

module.exports = {
  createForUser,
  notifyOrderTransition,
};
