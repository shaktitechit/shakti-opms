/**
 * @fileoverview Express App Setup for work-planner-backend.
 * @module app
 */
const express = require('express');
const cors = require('cors');
const corsOptions = require('./config/cors');
const { JSON_BODY_LIMIT } = require('./config/env');
const { authMiddleware } = require('./middlewares/auth.middleware');
const { errorMiddleware } = require('./middlewares/error.middleware');
const { notFound } = require('./middlewares/notFound.middleware');

const workPlannerRoutes = require('./modules/workPlanner/workPlanner.routes');
const projectRoutes = require('./modules/project/project.routes');
const { proxyToNotificationService } = require('./utils/proxyToNotificationService');
const { proxyToMessageService } = require('./utils/proxyToMessageService');
const { proxyToPartyService } = require('./utils/proxyToPartyService');
const { proxyToLeadManagerService } = require('./utils/proxyToLeadManagerService');

const powerAppRoutes = require('./modules/powerApp/powerApp.routes');

const app = express();

app.use(cors(corsOptions));
app.use(express.json({ limit: JSON_BODY_LIMIT || '50mb' }));
app.use(express.urlencoded({ limit: JSON_BODY_LIMIT || '50mb', extended: true }));

const { auditContextMiddleware } = require('./middlewares/auditContext.middleware');
app.use(auditContextMiddleware);
app.use(authMiddleware);

app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', service: 'work-planner-backend', timestamp: new Date().toISOString() });
});

app.get(['/api/files/:fileId/preview', '/api/files/:fileId/view', '/api/files/:fileId'], async (req, res) => {
  const { streamFileToResponse } = require('./services/fileManagement');
  await streamFileToResponse(req.params.fileId, res, { disposition: 'inline' });
});
app.get('/api/files/:fileId/download', async (req, res) => {
  const { streamFileToResponse } = require('./services/fileManagement');
  await streamFileToResponse(req.params.fileId, res, { disposition: 'attachment' });
});

app.use(['/api/work-planner', '/api/work-plans'], workPlannerRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/power-app', powerAppRoutes);
app.use('/api/facilities', powerAppRoutes);
app.use('/api/enquiries', powerAppRoutes);
app.use('/api/parties', proxyToPartyService);
app.use('/api/leads', proxyToLeadManagerService);
app.use('/api/notifications', proxyToNotificationService);
app.use('/api/push', proxyToNotificationService);
app.use('/api/emails', proxyToMessageService);
app.use('/api/messages', proxyToMessageService);
app.use('/api/auto-emails', proxyToMessageService);
app.use('/api/communication', proxyToMessageService);

app.use(notFound);
app.use(errorMiddleware);

module.exports = app;
