const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');

router.post('/login', authController.login);
router.get('/me', requireAuth, authController.me);
router.post('/change-password', requireAuth, authController.changePassword);

module.exports = router;
