const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const {
  loginIpBlocker,
  loginEmailRateLimiter,
  handoffExchangeRateLimiter,
} = require('../../middlewares/loginRateLimit.middleware');

router.post('/login', loginIpBlocker, loginEmailRateLimiter, authController.login);
router.get('/me', requireAuth, authController.me);
router.post('/change-password', requireAuth, authController.changePassword);
router.post('/handoff', requireAuth, authController.createHandoff);
router.post('/handoff/exchange', handoffExchangeRateLimiter, authController.exchangeHandoff);

module.exports = router;
