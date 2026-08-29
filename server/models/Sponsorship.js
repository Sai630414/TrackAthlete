const mongoose = require('mongoose');

const SponsorshipSchema = new mongoose.Schema({
  sponsor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['Proposed', 'Active', 'Closed'], default: 'Proposed' },
  supportType: String,
  amount: Number,
  message: String,
  fundUseLog: [{ date: Date, description: String, amount: Number }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Sponsorship', SponsorshipSchema);
