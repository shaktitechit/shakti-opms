/**
 * @fileoverview Mongo Registry for message-service.
 * @module data/mongoRegistry
 */
const mongoose = require('mongoose');
const Message = require('../models/Message');

const Order = mongoose.models.Order || mongoose.model('Order', new mongoose.Schema({}, { strict: false }));

function getModels() {
  return {
    Message,
    Order,
  };
}

module.exports = {
  getModels,
};
