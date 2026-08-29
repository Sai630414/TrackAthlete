const mongoose = require('mongoose');

const ConnectionSchema = new mongoose.Schema({
  athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coach: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['Pending', 'Active', 'Rejected'], default: 'Pending' },
  message: String,
  rejectionNote: String,
  sessionNotes: [{ date: Date, note: String }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Connection', ConnectionSchema);
