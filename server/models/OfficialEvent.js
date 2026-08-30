const mongoose = require('mongoose');

const OfficialEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true }, // e.g. EVT-9K2M41XP
  federation: { type: mongoose.Schema.Types.ObjectId, ref: 'Federation', required: true },
  // Snapshots keep public event cards readable if a federation profile later changes.
  federationName: { type: String, default: '' },
  federationId: { type: String, default: '' },
  eventName: { type: String, required: true },
  sport: { type: String, required: true },
  category: { type: String, required: true },
  location: { type: String, default: '' },
  tournamentDate: { type: Date, required: true },
  startDate: { type: Date },
  endDate: { type: Date },
  submissionDeadline: { type: Date, required: true },
  status: { type: String, enum: ['OPEN', 'FROZEN', 'CLOSED', 'UPCOMING', 'COMPLETED'], default: 'OPEN' },
  isFrozen: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

OfficialEventSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  if (this.submissionDeadline && new Date() > this.submissionDeadline) {
    this.isFrozen = true;
    this.status = 'FROZEN';
  }
  next();
});

module.exports = mongoose.model('OfficialEvent', OfficialEventSchema);
