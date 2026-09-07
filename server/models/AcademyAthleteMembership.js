const mongoose = require('mongoose');

const AcademyAthleteMembershipSchema = new mongoose.Schema({
  academyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Academy', required: true, index: true },
  sportName: { type: String, required: true, trim: true, uppercase: true, index: true },
  athleteUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  athleteId: { type: String, default: null, trim: true },
  name: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, trim: true },
  aadhaarHash: { type: String, default: null },
  membershipSource: { type: String, enum: ['ONLINE', 'OFFLINE'], required: true },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'PENDING', 'REJECTED'], default: 'ACTIVE' },
  joinedAt: { type: Date, default: Date.now },
  negotiatedPayment: { type: String, default: 'Negotiated During Joining', trim: true },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademyAthleteRequest', default: null }
}, { timestamps: true });

AcademyAthleteMembershipSchema.index({ academyId: 1, sportName: 1 });
AcademyAthleteMembershipSchema.index({ academyId: 1, athleteUserId: 1, sportName: 1 });

module.exports = mongoose.model('AcademyAthleteMembership', AcademyAthleteMembershipSchema);
