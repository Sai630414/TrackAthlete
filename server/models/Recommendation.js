const mongoose = require('mongoose');

const RecommendationSchema = new mongoose.Schema({
  athleteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  academyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Academy', required: true, index: true },
  sport: { type: String, required: true, trim: true, uppercase: true },
  athleteAchievementLevel: { type: String, enum: ['DISTRICT', 'STATE', 'NATIONAL', 'INTERNATIONAL'], required: true },
  academyAchievementLevel: { type: String, enum: ['DISTRICT', 'STATE', 'NATIONAL', 'INTERNATIONAL'], required: true },
  basedOnAchievementId: { type: String, default: null },
  basedOnAchievementSource: { type: String, enum: ['FEDERATION', 'ORGANIZER'], default: 'FEDERATION' },
  reason: { type: String, required: true },
  status: { type: String, enum: ['UNREAD', 'VIEWED', 'DISMISSED', 'ACCEPTED'], default: 'UNREAD', index: true },
  viewedAt: { type: Date, default: null }
}, { timestamps: true });

// One active recommendation per athlete + academy + sport to avoid spamming
RecommendationSchema.index({ athleteId: 1, academyId: 1, sport: 1 }, { unique: true });
RecommendationSchema.index({ athleteId: 1, status: 1 });

module.exports = mongoose.model('Recommendation', RecommendationSchema);
