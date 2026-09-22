/**
 * @fileoverview Express routes for TermsAndConditions and TermsText.
 * @module modules/terms_and_conditions/terms_and_conditions.routes
 */
const express = require('express');
const { requireAuth } = require('../../middlewares/auth.middleware');
const {
  requireLeadManagerAccess,
  requireLeadManagerRole,
} = require('../../middlewares/leadManagerAuth.middleware');
const controller = require('./terms_and_conditions.controller');

const router = express.Router();

router.use(requireAuth);
router.use(requireLeadManagerAccess);

router.get('/default', controller.getDefault);
router.get('/', controller.list);
router.post('/', requireLeadManagerRole('admin', 'manager'), controller.create);
router.get('/:id', controller.getById);
router.put('/:id', requireLeadManagerRole('admin', 'manager'), controller.update);
router.delete('/:id', requireLeadManagerRole('admin', 'manager'), controller.remove);

router.post('/:id/text', requireLeadManagerRole('admin', 'manager'), controller.addText);
router.put('/text/:textId', requireLeadManagerRole('admin', 'manager'), controller.updateText);
router.delete('/text/:textId', requireLeadManagerRole('admin', 'manager'), controller.deleteText);

module.exports = router;
