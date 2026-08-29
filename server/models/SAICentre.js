const mongoose = require('mongoose');

const SAICentreSchema = new mongoose.Schema({
  scheme: { type: String, enum: ['NCOE', 'STC', 'Extension Centre of STC', 'NSTC Regular School', 'IGMA', 'Adopted Akhara'], required: true },
  region: String,
  state: String,
  centreName: { type: String, required: true },
  sport: { type: String, required: true }, // discipline
  status: { type: String, default: 'Operational' }, // Operational / Not Operational / Kept in Abeyance
  slots: {
    resiB: Number, resiG: Number, resiT: Number,
    nonresiB: Number, nonresiG: Number, nonresiT: Number
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [lng, lat]
  },
  entryPathway: String,
  eligibilityAge: String,
  contactInfo: String,
  lastVerified: Date,
  source: { type: String, default: 'SAI Sports Promotional Schemes Strength Report 2025-26' }
});

SAICentreSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('SAICentre', SAICentreSchema);
