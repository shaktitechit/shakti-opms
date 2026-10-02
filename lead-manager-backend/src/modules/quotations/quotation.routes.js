/**
 * @fileoverview Router for standalone `/api/quotations` endpoints.
 * @module modules/quotations/quotation.routes
 */
const express = require('express');
const { requireAuth } = require('../../middlewares/auth.middleware');
const {
  requireLeadManagerAccess,
  requireLeadManagerRole,
} = require('../../middlewares/leadManagerAuth.middleware');
const controller = require('./quotation.controller');
const reportsController = require('./quotationReports.controller');

const router = express.Router();

router.use(requireAuth);
router.use(requireLeadManagerAccess);
router.use(requireLeadManagerRole('admin', 'manager'));

// Reports & Analytics (Must precede /:id)
router.get('/reports/summary', reportsController.getSummaryReport);
router.get('/reports/sales-performance', reportsController.getSalesPerformance);
router.get('/reports/monthly-trends', reportsController.getMonthlyTrends);
router.get('/reports/product-breakdown', reportsController.getProductBreakdown);
router.get('/reports/funnel', reportsController.getConversionFunnel);

router.get('/default-terms', controller.getDefaultTerms);
router.get('/dashboard-stats', controller.getDashboardStats);
router.post('/auto-expire', controller.triggerAutoExpiry);
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getById);
router.patch('/:id', controller.update);
router.put('/:id', controller.update);
router.post('/:id/submit-for-approval', controller.submitForApproval);
router.post('/:id/approve', controller.approve);
router.post('/:id/reject', controller.reject);
router.post('/:id/convert', controller.convert);
router.post('/:id/extend-validity', controller.extendValidity);
router.post('/:id/proforma', controller.saveProforma);
router.post('/:id/proforma-issued', controller.markProformaIssued);
router.delete('/:id', controller.remove);

// Quotation Follow-ups & Revisions
router.get('/:id/follow-ups', controller.listFollowUps);
router.post('/:id/follow-ups', controller.scheduleFollowUp);
router.patch('/follow-ups/:id/complete', controller.completeFollowUp);
router.post('/:id/revise', controller.reviseQuotation);

module.exports = router;
