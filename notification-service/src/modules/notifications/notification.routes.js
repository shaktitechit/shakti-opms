/**
 * @fileoverview Notifications: Express router mounts + RBAC wrappers.
 * @module modules/notifications/notification.routes
 */
const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const controller = require('./notification.controller');

// Inter-service internal endpoints (bypasses user auth)
router.post('/internal/order-transition', controller.internalOrderTransition);
router.post('/internal/create', controller.internalCreateForUser);

router.use(requireAuth);
router.get('/', controller.list);
router.patch('/:id/read', controller.markRead);

// SSE stream — GET /api/notifications/stream
// Must be above /:id routes to avoid conflict
router.get('/stream', controller.stream);

module.exports = router;
