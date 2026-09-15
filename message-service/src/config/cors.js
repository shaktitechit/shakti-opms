/**
 * @fileoverview CORS configuration for message-service.
 * @module config/cors
 */
module.exports = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-hub-signature-256'],
};
