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
const { proxyToNotificationService } = require('./utils/proxyToNotificationService');

const app = express();

app.use(cors(corsOptions));
app.use(express.json({ limit: JSON_BODY_LIMIT || '50mb' }));
app.use(express.urlencoded({ limit: JSON_BODY_LIMIT || '50mb', extended: true }));

app.use(authMiddleware);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'work-planner-backend', timestamp: new Date().toISOString() });
});

app.use('/api/work-planner', workPlannerRoutes);
app.use('/api/notifications', proxyToNotificationService);

app.use(notFound);
app.use(errorMiddleware);

module.exports = app;
