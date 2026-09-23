/**
 * @fileoverview HTTP Server Bootstrap for work-planner-backend.
 * @module server
 */
const app = require('./app');
const { PORT } = require('./config/env');
const db = require('./config/db');
const { registerModels, fixWorkPlanIndexes } = require('./data/mongoRegistry');
const { logger } = require('./utils/logger');

async function startServer() {
  try {
    await db.connect();
    await fixWorkPlanIndexes();
    registerModels();

    const serverPort = PORT || 7007;
    app.listen(serverPort, () => {
      logger.info(`work-planner-backend listening on port ${serverPort}`);
    });
  } catch (error) {
    logger.error('Failed to start work-planner-backend server:', error);
    process.exit(1);
  }
}

startServer();
