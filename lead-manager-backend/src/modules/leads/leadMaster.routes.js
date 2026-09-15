const express = require('express');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireLeadManagerAccess } = require('../../middlewares/leadManagerAuth.middleware');
const controller = require('./leadMaster.controller');

const router = express.Router();

router.use(requireAuth);
router.use(requireLeadManagerAccess);

/* --- Lead Sources --- */
router.get('/sources', controller.listSources);
router.post('/sources', controller.createSource);
router.put('/sources/:id', controller.updateSource);
router.delete('/sources/:id', controller.deleteSource);

/* --- Lead Lost Reasons --- */
router.get('/lost-reasons', controller.listLostReasons);
router.post('/lost-reasons', controller.createLostReason);
router.put('/lost-reasons/:id', controller.updateLostReason);
router.delete('/lost-reasons/:id', controller.deleteLostReason);

module.exports = router;
