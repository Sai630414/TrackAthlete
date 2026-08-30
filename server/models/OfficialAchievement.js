const mongoose = require('mongoose');

const OfficialAchievementSchema = new mongoose.Schema({
  officialRecordId: { type: String, required: true, unique: true }, // e.g. TA-ACH-8M3K91PL
  athleteUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  athleteId: { type: String, default: null }, // ATH-XXXXXXXX
  aadhaarHash: { type: String, default: null }, // HMAC-SHA256 hash of normalized Aadhaar number
  athleteIdentityReference: { type: String, default: null }, // Salted SHA-256 hash of identity
  athleteName: { type: String, required: true },
  
  federation: { type: mongoose.Schema.Types.ObjectId, ref: 'Federation', required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'OfficialEvent', required: true },
  
  tournamentName: { type: String, required: true },
  sport: { type: String, required: true },
  category: { type: String, required: true },
  
  achievementType: { type: String, enum: ['medal', 'ranking'], required: true },
  medal: { type: String, enum: ['Gold', 'Silver', 'Bronze', 'Participation'] },
  rank: { type: Number },
  
  year: { type: Number, required: true },
  eventDate: { type: Date },
  description: { type: String, default: '' },
  
  certificateData: { type: String, default: null }, // Base64 PDF or document Data URL
  certificateFileName: { type: String, default: '' },
  certificateFileSize: { type: Number, default: 0 },
  
  verificationStatus: { type: String, enum: ['VERIFIED', 'FROZEN', 'REVOKED'], default: 'VERIFIED' },
  frozenAt: { type: Date, default: null },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

OfficialAchievementSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('OfficialAchievement', OfficialAchievementSchema);
