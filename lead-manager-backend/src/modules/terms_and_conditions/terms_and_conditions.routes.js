/**
 * @fileoverview Express routes for TermsAndConditions and TermsText.
 * @module modules/terms_and_conditions/terms_and_conditions.routes
 */
const express = require('express');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireLeadManagerAccess } = require('../../middlewares/leadManagerAuth.middleware');
const controller = require('./terms_and_conditions.controller');

const router = express.Router();

router.use(requireAuth);
router.use(requireLeadManagerAccess);

router.get('/default', controller.getDefault);
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

router.post('/:id/text', controller.addText);
router.put('/text/:textId', controller.updateText);
router.delete('/text/:textId', controller.deleteText);

module.exports = router;
