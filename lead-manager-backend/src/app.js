/**
 * @fileoverview Express App Setup for lead-manager-backend.
 * @module app
 */
const express = require('express');
const cors = require('cors');
const corsOptions = require('./config/cors');
const { JSON_BODY_LIMIT } = require('./config/env');
const { authMiddleware } = require('./middlewares/auth.middleware');
const { errorMiddleware } = require('./middlewares/error.middleware');
const { notFound } = require('./middlewares/notFound.middleware');

const leadRoutes = require('./modules/leads/lead.routes');
const leadMasterRoutes = require('./modules/leads/leadMaster.routes');
const quotationRoutes = require('./modules/quotations/quotation.routes');
const attachmentRoutes = require('./modules/attachments/attachment.routes');
const { proxyToMessageService } = require('./utils/proxyToMessageService');
const { proxyToNotificationService } = require('./utils/proxyToNotificationService');

const app = express();

app.use(cors(corsOptions));
app.use(express.json({ limit: JSON_BODY_LIMIT || '50mb' }));
app.use(express.urlencoded({ limit: JSON_BODY_LIMIT || '50mb', extended: true }));

app.use(authMiddleware);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'lead-manager-backend', timestamp: new Date().toISOString() });
});

app.use('/api/leads', leadRoutes);
app.use('/api/lead-masters', leadMasterRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/notifications', proxyToNotificationService);
app.use('/api/emails', proxyToMessageService);
app.use('/api/messages', proxyToMessageService);
app.use('/api/auto-emails', proxyToMessageService);
app.use('/api/communication', proxyToMessageService);

app.use(notFound);
app.use(errorMiddleware);

module.exports = app;
