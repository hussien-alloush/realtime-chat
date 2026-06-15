const mongoose = require('mongoose');

const PrivateMessageSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to:   { type: String, required: true },
  text: { type: String, required: true },
  time: { type: String, required: true },
  read: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('PrivateMessage', PrivateMessageSchema);