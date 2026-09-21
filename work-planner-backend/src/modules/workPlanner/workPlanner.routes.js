/**
 * @fileoverview Work Planner: Express router mounts with portal-based authorization.
 * @module modules/workPlanner/workPlanner.routes
 */
const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const {
  requireWorkPlannerAccess,
  requireWorkPlannerRole,
} = require('../../middlewares/workPlannerAuth.middleware');
const controller = require('./workPlanner.controller');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// Public attachment streaming redirect (accessible by browser navigation and email links)
router.get('/attachments/:attachmentId/view', controller.viewAttachment);

router.use(requireAuth);
router.use(requireWorkPlannerAccess);

router.post('/expenses/upload', upload.single('file'), controller.uploadExpenseReceipt);
router.post('/attachments/upload', upload.single('file'), controller.uploadAttachment);
router.get('/user-settings/:userId', controller.getUserSettings);
router.put('/user-settings/:userId', requireWorkPlannerRole('manager'), controller.updateUserSettings);

router.get('/', controller.list);
router.get('/stats', controller.stats);
router.get('/expenses', controller.listAllExpenses);
router.post('/', controller.create);

router.get('/:id', controller.get);
router.get('/:id/day-end-draft', controller.getDayEndDraft);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

router.post('/:id/submit', controller.submit);
router.post('/:id/approve', requireWorkPlannerRole('manager'), controller.approve);
router.post('/:id/reject', requireWorkPlannerRole('manager'), controller.reject);
router.post('/:id/complete', controller.complete);


router.post('/:id/visits', controller.addVisit);
router.patch('/:id/visits/:visitId', controller.updateVisit);
router.delete('/:id/visits/:visitId', controller.removeVisit);

router.post('/:id/works', controller.addWork);
router.patch('/:id/works/:workId', controller.updateWork);
router.delete('/:id/works/:workId', controller.removeWork);

router.post('/:id/visits/:visitId/check-in', controller.checkIn);
router.post('/:id/visits/:visitId/check-out', controller.checkOut);
router.post('/:id/visits/:visitId/complete', controller.completeVisit);

router.get('/:id/expenses', controller.listExpenses);
router.post('/:id/expenses', controller.addExpense);
router.post('/:id/expenses/submit-all', controller.submitAllExpenses);
router.post('/:id/expenses/approve-all', requireWorkPlannerRole('manager'), controller.approveAllExpenses);
router.post('/:id/expenses/reject-all', requireWorkPlannerRole('manager'), controller.rejectAllExpenses);
router.patch('/:id/expenses/:expenseId', controller.updateExpense);
router.delete('/:id/expenses/:expenseId', controller.removeExpense);
router.post('/:id/expenses/:expenseId/submit', controller.submitExpense);
router.post('/:id/expenses/:expenseId/approve', requireWorkPlannerRole('manager'), controller.approveExpense);
router.post('/:id/expenses/:expenseId/reject', requireWorkPlannerRole('manager'), controller.rejectExpense);

module.exports = router;
