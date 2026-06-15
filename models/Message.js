const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  room: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  reactions: {
    type: Map,
    of: Number,
    default: {}
  },
  readBy: {
    type: [String],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);