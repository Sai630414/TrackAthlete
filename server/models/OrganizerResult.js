const mongoose = require('mongoose');

// An immutable roster snapshot for a team result. No Aadhaar value or hash is
// retained here: registered athletes use their existing User id, while external
// players remain external participants.
const rosterMemberSchema = new mongoose.Schema({
  participantType: { type: String, enum: ['registered', 'manual'], required: true },
  athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  mobile: String,
  email: String,
  isCaptain: { type: Boolean, default: false }
}, { _id: false });

const resultEntrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  // Used only for individual athlete matching and omitted from normal reads.
  aadhaarHash: { type: String, select: false },
  mobile: String,
  outcome: { type: String, required: true },
  position: { type: Number, min: 1 },
  medal: { type: String, enum: ['Gold', 'Silver', 'Bronze'] },
  athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'EventTeam' },
  teamName: String,
  roster: { type: [rosterMemberSchema], default: undefined }
}, { _id: true });

const OrganizerResultSchema = new mongoose.Schema({
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'Organizer', required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'OrganizerEvent', required: true },
  sportConfigId: { type: mongoose.Schema.Types.ObjectId, required: true },
  resultType: { type: String, enum: ['positions', 'medals'], required: true },
  entries: { type: [resultEntrySchema], default: [] },
  // A real selected PDF, isolated from Federation certificate data.
  certificateData: { type: String, default: null },
  certificateFileName: { type: String, default: '' },
  certificateFileSize: { type: Number, default: 0 },
  isFrozen: { type: Boolean, default: false },
  frozenAt: Date
}, { timestamps: true });

OrganizerResultSchema.index({ event: 1, sportConfigId: 1 }, { unique: true });
module.exports = mongoose.model('OrganizerResult', OrganizerResultSchema);
