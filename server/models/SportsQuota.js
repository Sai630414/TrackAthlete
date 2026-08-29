const mongoose = require('mongoose');

const SportsQuotaSchema = new mongoose.Schema({
  university: { type: String, required: true },
  city: String,
  state: String,
  sport: { type: String, required: true },
  seats: Number,
  minAchievementLevel: String, // e.g. "State", "National", "International"
  scholarshipPercent: Number,
  applicationWindow: String,
  lastVerified: Date
});

module.exports = mongoose.model('SportsQuota', SportsQuotaSchema);
