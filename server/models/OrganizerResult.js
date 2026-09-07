const mongoose = require('mongoose');

// Individual team member roster item with their own certificate and optional private Aadhaar hash
const rosterMemberSchema = new mongoose.Schema({
  participantType: { type: String, enum: ['registered', 'offline', 'manual'], default: 'offline' },
  athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  athleteId: String,
  name: { type: String, required: true, trim: true },
  aadhaarHash: { type: String, select: false },
  mobile: String,
  email: String,
  isCaptain: { type: Boolean, default: false },
  certificateData: { type: String, default: null },
  certificateFileName: { type: String, default: '' },
  certificateFileSize: { type: Number, default: 0 }
}, { _id: true });

const resultEntrySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  teamName: { type: String, trim: true },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'EventTeam' },
  position: { type: Number, min: 1 },
  medal: { type: String, enum: ['Gold', 'Silver', 'Bronze'] },
  outcome: { type: String, required: true },
  participantType: { type: String, enum: ['registered', 'offline', 'manual'], default: 'offline' },
  athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  athleteId: String,
  aadhaarHash: { type: String, select: false },
  mobile: String,
  email: String,
  certificateData: { type: String, default: null },
  certificateFileName: { type: String, default: '' },
  certificateFileSize: { type: Number, default: 0 },
  roster: { type: [rosterMemberSchema], default: undefined }
}, { _id: true });

const OrganizerResultSchema = new mongoose.Schema({
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'Organizer', required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'OrganizerEvent', required: true },
  sportConfigId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sportName: String,
  competitionType: { type: String, enum: ['individual', 'team'], default: 'individual' },
  resultType: { type: String, enum: ['positions', 'medals'], required: true },
  entries: { type: [resultEntrySchema], default: [] },
  certificateData: { type: String, default: null },
  certificateFileName: { type: String, default: '' },
  certificateFileSize: { type: Number, default: 0 },
  isFrozen: { type: Boolean, default: false },
  frozenAt: Date
}, { timestamps: true });

OrganizerResultSchema.index({ event: 1, sportConfigId: 1 }, { unique: true });
module.exports = mongoose.model('OrganizerResult', OrganizerResultSchema);
