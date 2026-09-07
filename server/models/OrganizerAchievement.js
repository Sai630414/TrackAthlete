const mongoose = require('mongoose');
const OrganizerAchievementSchema = new mongoose.Schema({
  athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'Organizer', required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'OrganizerEvent', required: true },
  result: { type: mongoose.Schema.Types.ObjectId, ref: 'OrganizerResult', required: true },
  sportConfigId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sportName: String,
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'EventTeam' },
  teamName: String,
  position: Number,
  medal: String,
  achievementType: { type: String, default: 'Organizer Verified' },
  outcome: String,
  certificateData: String,
  certificateFileName: String,
  certificateFileSize: Number
}, { timestamps: true });
OrganizerAchievementSchema.index({ athlete: 1, result: 1, outcome: 1 }, { unique: true });
module.exports = mongoose.model('OrganizerAchievement', OrganizerAchievementSchema);
