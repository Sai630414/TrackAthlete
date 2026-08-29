const mongoose = require('mongoose');

const AcademySchema = new mongoose.Schema({
  name: { type: String, required: true },
  sports: [{ type: String, required: true }], // one academy can teach multiple sports
  city: { type: String, required: true },
  state: String,
  feeRangeMin: Number,
  feeRangeMax: Number,
  contact: String,
  coachAffiliations: [String],
  acceptingStudents: { type: Boolean, default: true },
  verified: { type: Boolean, default: false },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [lng, lat]
  },
  createdAt: { type: Date, default: Date.now }
});

AcademySchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Academy', AcademySchema);
