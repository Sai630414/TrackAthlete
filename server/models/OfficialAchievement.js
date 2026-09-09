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
  competitionLevel: { type: String, enum: ['DISTRICT', 'STATE', 'NATIONAL', 'INTERNATIONAL'], trim: true, uppercase: true, default: null },
  
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
  sourceType: { type: String, default: 'FEDERATION' },
  sourceLabel: { type: String, default: 'FEDERATION RECOGNIZED' },
  isFrozen: { type: Boolean, default: false },
  frozenAt: { type: Date, default: null },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

OfficialAchievementSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

OfficialAchievementSchema.post('save', function (doc) {
  if (doc.athleteUserId) {
    try {
      const { generateAthleteRecommendations } = require('../utils/recommendationEngine');
      generateAthleteRecommendations(doc.athleteUserId).catch(err => {
        console.error('Error recalculating recommendations in OfficialAchievement post-save:', err.message);
      });
    } catch (e) {
      // Ignore background errors
    }
  }
});

OfficialAchievementSchema.set('toJSON', {
  transform: (_doc, value) => {
    delete value.aadhaarHash;
    delete value.athleteIdentityReference;
    return value;
  }
});

module.exports = mongoose.model('OfficialAchievement', OfficialAchievementSchema);
