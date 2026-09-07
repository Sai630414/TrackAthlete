const mongoose = require('mongoose');

const AcademyOpeningSchema = new mongoose.Schema({
  academyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Academy', required: true, index: true },
  sportName: { type: String, required: true, trim: true, uppercase: true, index: true },
  position: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  salary: { type: String, default: 'Negotiated During Joining', trim: true },
  status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN', index: true }
}, { timestamps: true });

AcademyOpeningSchema.index({ academyId: 1, sportName: 1 });

module.exports = mongoose.model('AcademyOpening', AcademyOpeningSchema);
