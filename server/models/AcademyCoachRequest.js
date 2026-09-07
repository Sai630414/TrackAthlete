const mongoose = require('mongoose');

const AcademyCoachRequestSchema = new mongoose.Schema({
  academyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Academy', required: true, index: true },
  openingId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademyOpening', default: null, index: true },
  coachUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  coachId: { type: String, default: null, trim: true },
  name: { type: String, required: true, trim: true },
  nisId: { type: String, default: null, trim: true },
  sportName: { type: String, required: true, trim: true, uppercase: true },
  certificateData: { type: String, default: null },
  certificateFileName: { type: String, default: null },
  salary: { type: String, default: 'Negotiated During Joining', trim: true },
  status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED'], default: 'PENDING', index: true }
}, { timestamps: true });

AcademyCoachRequestSchema.index({ academyId: 1, status: 1 });

module.exports = mongoose.model('AcademyCoachRequest', AcademyCoachRequestSchema);
