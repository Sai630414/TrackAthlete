const mongoose = require('mongoose');

const AcademySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  academyId: { type: String, unique: true, sparse: true, trim: true },
  name: { type: String, required: true, trim: true },
  contactPhone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  address: {
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    country: { type: String, default: 'India', trim: true }
  },
  city: { type: String, trim: true, index: true },
  state: { type: String, trim: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  sports: [{
    sportName: { type: String, required: true, trim: true, uppercase: true },
    addedAt: { type: Date, default: Date.now }
  }],
  rankingStats: {
    districtPlayers: { type: Number, default: 0 },
    statePlayers: { type: Number, default: 0 },
    nationalPlayers: { type: Number, default: 0 },
    internationalPlayers: { type: Number, default: 0 }
  },
  perSportLevels: { type: mongoose.Schema.Types.Mixed, default: {} },
  verified: { type: Boolean, default: true },
  achievementLevel: { type: String, enum: ['DISTRICT', 'STATE', 'NATIONAL', 'INTERNATIONAL', 'UNRANKED'], default: 'UNRANKED' },
  achievementLevelLabel: { type: String, default: 'Achievement Level: UNRANKED' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

AcademySchema.index({ location: '2dsphere' });
AcademySchema.index({ 'sports.sportName': 1 });

module.exports = mongoose.model('Academy', AcademySchema);
