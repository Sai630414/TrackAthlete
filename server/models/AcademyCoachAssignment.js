const mongoose = require('mongoose');

const AcademyCoachAssignmentSchema = new mongoose.Schema({
  academyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Academy', required: true, index: true },
  sportName: { type: String, required: true, trim: true, uppercase: true, index: true },
  coachUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  coachId: { type: String, default: null, trim: true },
  name: { type: String, required: true, trim: true },
  aadhaarHash: { type: String, default: null },
  nisId: { type: String, default: null, trim: true },
  certificateData: { type: String, default: null },
  certificateFileName: { type: String, default: null },
  isOffline: { type: Boolean, default: false },
  role: { type: String, default: 'Coach', trim: true },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }
}, { timestamps: true });

AcademyCoachAssignmentSchema.index({ academyId: 1, sportName: 1 });

module.exports = mongoose.model('AcademyCoachAssignment', AcademyCoachAssignmentSchema);
