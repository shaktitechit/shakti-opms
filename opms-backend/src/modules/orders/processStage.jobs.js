/**
 * Schedule async Order.process_stage refresh (BullMQ). Falls back to inline refresh if Redis is down.
 * @module modules/orders/processStage.jobs
 */
const { logger } = require('../../config/logger');
const processStageQueue = require('../../queues/processStage.queue');
const { refreshOrderProcessStage } = require('./orderListPage.service');

/**
 * @param {unknown} orderId
 * @param {string} [source] — caller label for logs (e.g. admin_approve, due_sheet_upload)
 */
async function scheduleProcessStageRefresh(orderId, source = 'workflow') {
  const oid = orderId != null ? String(orderId) : '';
  if (!oid) return;

  // Always refresh inline immediately so subsequent queries, list fetches,
  // and HTTP responses reflect the real-time stage without waiting for an async queue worker.
  try {
    await refreshOrderProcessStage(oid);
  } catch (err) {
    logger.error?.(
      `[processStage] inline refresh failed for order ${oid} (${source}): ${err.message}`,
    );
  }

  // Also notify queue for background workers/redundancy if queue is available
  try {
    await processStageQueue.enqueue({ orderId: oid, source });
  } catch {
    // Non-blocking: inline refresh already completed.
  }
}

module.exports = {
  scheduleProcessStageRefresh,
};
