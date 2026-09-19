/**
 * @fileoverview Work Planner: HTTP handlers (thin controllers).
 * @module modules/workPlanner/workPlanner.controller
 */
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./workPlanner.service');
const validation = require('./workPlanner.validation');

exports.list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.list(req.query, req.user) });
});

exports.stats = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.stats(req.query, req.user) });
});

exports.listAllExpenses = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.listAllExpenses(req.query, req.user) });
});

exports.get = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.get(req.params.id, req.user) });
});

exports.create = asyncHandler(async (req, res) => {
  validation.assertCreate(req.body || {});
  res.status(201).json({ success: true, data: await service.create(req.body, req.user) });
});

exports.update = asyncHandler(async (req, res) => {
  validation.assertUpdate(req.body || {});
  res.json({ success: true, data: await service.update(req.params.id, req.body, req.user) });
});

exports.remove = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.remove(req.params.id, req.user) });
});

exports.submit = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.submit(req.params.id, req.user, req.body || {}) });
});

exports.approve = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.approve(req.params.id, req.user) });
});

exports.reject = asyncHandler(async (req, res) => {
  validation.assertReject(req.body || {});
  res.json({ success: true, data: await service.reject(req.params.id, req.body, req.user) });
});

exports.complete = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.completePlan(req.params.id, req.user, req.body) });
});

exports.getDayEndDraft = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getDayEndDraft(req.params.id, req.user) });
});


exports.addVisit = asyncHandler(async (req, res) => {
  validation.assertVisitCreate(req.body || {});
  res.status(201).json({
    success: true,
    data: await service.addVisit(req.params.id, req.body, req.user),
  });
});

exports.updateVisit = asyncHandler(async (req, res) => {
  validation.assertVisitUpdate(req.body || {});
  res.json({
    success: true,
    data: await service.updateVisit(req.params.id, req.params.visitId, req.body, req.user),
  });
});

exports.removeVisit = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.removeVisit(req.params.id, req.params.visitId, req.user),
  });
});

exports.addWork = asyncHandler(async (req, res) => {
  validation.assertWorkCreate(req.body || {});
  res.status(201).json({
    success: true,
    data: await service.addWork(req.params.id, req.body, req.user),
  });
});

exports.updateWork = asyncHandler(async (req, res) => {
  validation.assertWorkUpdate(req.body || {});
  res.json({
    success: true,
    data: await service.updateWork(req.params.id, req.params.workId, req.body, req.user),
  });
});

exports.removeWork = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.removeWork(req.params.id, req.params.workId, req.user),
  });
});

exports.checkIn = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.checkIn(req.params.id, req.params.visitId, req.user),
  });
});

exports.checkOut = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.checkOut(req.params.id, req.params.visitId, req.user),
  });
});

exports.completeVisit = asyncHandler(async (req, res) => {
  validation.assertCompleteVisit(req.body || {});
  res.json({
    success: true,
    data: await service.completeVisit(req.params.id, req.params.visitId, req.body, req.user),
  });
});

exports.scheduleNextVisit = asyncHandler(async (req, res) => {
  validation.assertScheduleNextVisit(req.body || {});
  res.status(201).json({
    success: true,
    data: await service.scheduleNextVisit(
      req.params.id,
      req.params.visitId,
      req.body,
      req.user,
    ),
  });
});

exports.listExpenses = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.listExpenses(req.params.id, req.user),
  });
});

exports.addExpense = asyncHandler(async (req, res) => {
  validation.assertExpenseCreate(req.body || {});
  res.status(201).json({
    success: true,
    data: await service.addExpense(req.params.id, req.body, req.user),
  });
});

exports.updateExpense = asyncHandler(async (req, res) => {
  validation.assertExpenseUpdate(req.body || {});
  res.json({
    success: true,
    data: await service.updateExpense(
      req.params.id,
      req.params.expenseId,
      req.body,
      req.user,
    ),
  });
});

exports.removeExpense = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.removeExpense(req.params.id, req.params.expenseId, req.user),
  });
});

exports.submitExpense = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.submitExpense(req.params.id, req.params.expenseId, req.user),
  });
});

exports.approveExpense = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.approveExpense(req.params.id, req.params.expenseId, req.user),
  });
});

exports.rejectExpense = asyncHandler(async (req, res) => {
  validation.assertReject(req.body || {});
  res.json({
    success: true,
    data: await service.rejectExpense(
      req.params.id,
      req.params.expenseId,
      req.body,
      req.user,
    ),
  });
});

exports.submitAllExpenses = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.submitAllExpenses(req.params.id, req.user),
  });
});

exports.approveAllExpenses = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.approveAllExpenses(req.params.id, req.user),
  });
});

exports.rejectAllExpenses = asyncHandler(async (req, res) => {
  validation.assertReject(req.body || {});
  res.json({
    success: true,
    data: await service.rejectAllExpenses(req.params.id, req.body, req.user),
  });
});

exports.uploadExpenseReceipt = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No document file uploaded');
  }
  const { uploadMulterFile } = require('../../services/fileManagement');
  const attachment = await uploadMulterFile(
    req.file,
    'work_plan_expense',
    req.body.plan_id || 'expense'
  );
  res.status(201).json({ success: true, data: attachment });
});

exports.uploadAttachment = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No file uploaded');
  }
  const { uploadMulterFile } = require('../../services/fileManagement');
  const attachment = await uploadMulterFile(
    req.file,
    'work_plan_day_end',
    req.body.resourceId || req.body.plan_id || null
  );
  res.status(201).json({ success: true, data: attachment });
});

exports.viewAttachment = asyncHandler(async (req, res) => {
  const { ApiError } = require('../../utils/ApiError');
  const { getModels } = require('../../data/mongoRegistry');
  const { Attachment } = getModels();
  const { getViewPresignedUrl, resolveFileId } = require('../../services/fileManagement');
  const att = await Attachment.findById(req.params.attachmentId).lean();
  if (!att) {
    throw new ApiError(404, 'Attachment not found');
  }
  const fileId = resolveFileId ? resolveFileId(att) : att.filename;
  if (!fileId) {
    if (att.url) {
      return res.redirect(302, att.url);
    }
    throw new ApiError(404, 'File ID not found on attachment');
  }
  try {
    const freshUrl = await getViewPresignedUrl(fileId);
    return res.redirect(302, freshUrl);
  } catch (_err) {
    if (att.url) {
      return res.redirect(302, att.url);
    }
    throw _err;
  }
});
