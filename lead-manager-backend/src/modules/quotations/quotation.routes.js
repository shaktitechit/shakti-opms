/**
 * @fileoverview Router for standalone `/api/quotations` endpoints.
 * @module modules/quotations/quotation.routes
 */
const express = require('express');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireLeadManagerAccess } = require('../../middlewares/leadManagerAuth.middleware');
const controller = require('./quotation.controller');

const router = express.Router();

router.use(requireAuth);
router.use(requireLeadManagerAccess);

router.get('/default-terms', controller.getDefaultTerms);
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getById);
router.patch('/:id', controller.update);
router.put('/:id', controller.update);
router.post('/:id/submit-for-approval', controller.submitForApproval);
router.post('/:id/approve', controller.approve);
router.post('/:id/reject', controller.reject);
router.delete('/:id', controller.remove);

module.exports = router;
