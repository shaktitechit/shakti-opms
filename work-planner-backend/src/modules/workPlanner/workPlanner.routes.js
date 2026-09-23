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
const teamController = require('./team.controller');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const elevatedRoles = requireWorkPlannerRole('manager', 'admin');
const adminRole = requireWorkPlannerRole('admin');

router.use(requireAuth);
router.use(requireWorkPlannerAccess);

// Authenticated attachment streaming redirect (browser may pass ?token=)
router.get('/attachments/:attachmentId/view', controller.viewAttachment);

router.post('/expenses/upload', upload.single('file'), controller.uploadExpenseReceipt);
router.post('/attachments/upload', upload.single('file'), controller.uploadAttachment);
router.get('/user-settings/:userId', controller.getUserSettings);
router.put('/user-settings/:userId', elevatedRoles, controller.updateUserSettings);
router.get('/eligible-managers', controller.getEligibleManagers);

// Team hierarchy (must be before /:id)
router.get('/team/tree', adminRole, teamController.getTree);
router.get('/team/my-team', elevatedRoles, teamController.getMyTeam);
router.get('/team/members', elevatedRoles, teamController.getMembers);
router.get('/team/edges', elevatedRoles, teamController.listEdges);
router.put('/team/edges', adminRole, teamController.upsertEdge);
router.delete('/team/edges/:subordinateId', adminRole, teamController.removeEdge);

router.get('/', controller.list);
router.get('/stats', controller.stats);
router.get('/expenses', controller.listAllExpenses);
router.post('/', controller.create);

// Standalone Visits & Tasks (independent of Work Plans)
router.post('/standalone-visits', controller.addStandaloneVisit);
router.patch('/standalone-visits/:visitId', controller.updateStandaloneVisit);
router.delete('/standalone-visits/:visitId', controller.removeStandaloneVisit);

router.post('/standalone-works', controller.addStandaloneWork);
router.patch('/standalone-works/:workId', controller.updateStandaloneWork);
router.delete('/standalone-works/:workId', controller.removeStandaloneWork);

router.get('/:id', controller.get);
router.get('/:id/day-end-draft', controller.getDayEndDraft);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

router.post('/:id/submit', controller.submit);
router.post('/:id/approve', elevatedRoles, controller.approve);
router.post('/:id/reject', elevatedRoles, controller.reject);
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
router.post('/:id/expenses/approve-all', elevatedRoles, controller.approveAllExpenses);
router.post('/:id/expenses/reject-all', elevatedRoles, controller.rejectAllExpenses);
router.patch('/:id/expenses/:expenseId', controller.updateExpense);
router.delete('/:id/expenses/:expenseId', controller.removeExpense);
router.post('/:id/expenses/:expenseId/submit', controller.submitExpense);
router.post('/:id/expenses/:expenseId/approve', elevatedRoles, controller.approveExpense);
router.post('/:id/expenses/:expenseId/reject', elevatedRoles, controller.rejectExpense);

module.exports = router;
