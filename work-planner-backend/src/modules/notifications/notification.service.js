/**
 * @fileoverview Notification helper for work-planner-backend.
 * @module modules/notifications/notification.service
 */
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');

async function createForUser(userId, payload) {
  try {
    const { Notification } = getModels();
    const row = await Notification.create({
      user: userId,
      title: payload.title,
      message: payload.message,
      type: payload.type || 'info',
      module: payload.module || 'work_planner',
      entity_type: payload.entity_type,
      entity_id: payload.entity_id || undefined,
      is_read: false,
    });
    return toPlain(row.toObject());
  } catch (err) {
    console.warn('[work-planner notification] createForUser failed:', err?.message || err);
    return null;
  }
}

async function listForUser(userId, { unreadOnly } = {}) {
  try {
    const { Notification } = getModels();
    const q = { user: userId };
    if (unreadOnly) q.is_read = false;
    const rows = await Notification.find(q).sort({ createdAt: -1 }).lean();
    return rows.map((r) => toPlain(r));
  } catch (err) {
    return [];
  }
}

async function markRead(userId, id) {
  try {
    const { Notification } = getModels();
    const row = await Notification.findOneAndUpdate(
      { _id: id, user: userId },
      { is_read: true, read_at: new Date() },
      { new: true }
    ).lean();
    return row ? toPlain(row) : null;
  } catch (err) {
    return null;
  }
}

module.exports = {
  createForUser,
  listForUser,
  markRead,
};
