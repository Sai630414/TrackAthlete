const mongoose = require('mongoose');

const AcademyAthleteRequestSchema = new mongoose.Schema({
  academyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Academy', required: true, index: true },
  athleteUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  athleteId: { type: String, default: null, trim: true },
  name: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, trim: true },
  sportName: { type: String, required: true, trim: true, uppercase: true },
  joiningPayment: { type: String, default: 'Negotiated During Joining', trim: true },
  status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED'], default: 'PENDING', index: true }
}, { timestamps: true });

AcademyAthleteRequestSchema.index({ academyId: 1, status: 1 });

module.exports = mongoose.model('AcademyAthleteRequest', AcademyAthleteRequestSchema);
