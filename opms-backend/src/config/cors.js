/**
 * @fileoverview Configuration (cors).
 * @module config/cors
 */
const { CORS_ORIGINS } = require('./env');

const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:7002',
  'http://localhost:7008', // work-planner-frontend
  'http://localhost:7010', // lead-manager-frontend
];

const extraOrigins = String(CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

module.exports = {
  origin: [...defaultOrigins, ...extraOrigins],
  credentials: true,
};
