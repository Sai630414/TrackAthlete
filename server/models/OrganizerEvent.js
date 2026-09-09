const mongoose = require('mongoose');
const sportSchema = new mongoose.Schema({
  sportName: { type: String, required: true, trim: true },
  competitionType: { type: String, enum: ['individual', 'team'], required: true },
  minimumTeamSize: Number, maximumTeamSize: Number,
  resultType: { type: String, enum: ['positions', 'medals'], default: 'positions' },
  feeType: { type: String, enum: ['free', 'per_participant', 'per_team'], default: 'free' }, feeAmount: { type: Number, min: 0, default: 0 },
  resultStatus: { type: String, enum: ['pending', 'frozen', 'deadline_passed'], default: 'pending' }
}, { _id: true });
const address = new mongoose.Schema({ line1: String, city: String, state: String, pinCode: String, country: { type: String, default: 'India' } }, { _id: false });
const OrganizerEventSchema = new mongoose.Schema({
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'Organizer', required: true, index: true },
  eventName: { type: String, required: true, trim: true }, description: String, eventDate: { type: Date, required: true },
  competitionLevel: { type: String, enum: ['DISTRICT', 'STATE', 'NATIONAL', 'INTERNATIONAL'], trim: true, uppercase: true, default: null },
  registrationDeadline: { type: Date, required: true }, teamFormationDeadline: Date, resultSubmissionDeadline: { type: Date, required: true },
  venue: { type: String, required: true }, venueAddress: address, rules: String,
  organizerContact: { name: String, mobile: String, email: String }, sports: { type: [sportSchema], validate: v => v?.length > 0 },
  status: { type: String, enum: ['draft', 'published', 'closed'], default: 'published' }, sourceType: { type: String, default: 'organizer' }
}, { timestamps: true });
OrganizerEventSchema.index({ organizer: 1, eventDate: -1 });
module.exports = mongoose.model('OrganizerEvent', OrganizerEventSchema);
