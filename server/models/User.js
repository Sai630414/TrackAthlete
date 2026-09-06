const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['athlete', 'parent', 'coach', 'sponsor', 'academy', 'admin', 'federation'], required: true },

  // Athlete-specific
  athleteId: { type: String, default: null },
  aadhaarHash: { type: String, default: null },
  sport: { type: String, trim: true },
  beltRank: String,
  age: Number,
  achievements: [String],
  videoLink: String,
  seekingSponsorship: Boolean,
  sponsorshipReason: String,
  federationState: String, // state used to look up FederationStatus
  relocationFlexible: { type: Boolean, default: true },
  tournaments: [{
    tournamentName: String,
    year: String,
    category: String,
    position: String
  }],

  // Parent-specific
  childName: String,
  childAge: Number,
  childSport: String,

  // Coach-specific
  certifications: [String],
  yearsExperience: Number,
  acceptingAthletes: { type: Boolean, default: true },

  // Sponsor-specific
  organizationName: String,
  budgetRange: String,
  targetSports: [String],

  // Academy-specific
  academyName: String,
  sportsOffered: [String],
  contactPhone: String,
  address: String,

  // Location (used for distance calculations across roles)
  city: String,
  state: String,
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] }
  },

  // Password Reset & Authentication Fields
  resetPasswordOTP: String,
  resetPasswordOTPExpires: Date,
  resetPasswordToken: String,
  resetPasswordTokenExpires: Date,
  isEmailVerified: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now }
});

UserSchema.index({ location: '2dsphere' }, { sparse: true });

// Identity matching data is backend-only, including when a User document is
// serialized by an endpoint that did not explicitly project its fields.
UserSchema.set('toJSON', {
  transform: (_doc, value) => {
    delete value.passwordHash;
    delete value.resetPasswordOTP;
    delete value.resetPasswordToken;
    delete value.aadhaarHash;
    delete value.aadhaar;
    delete value.aadhaarNumber;
    return value;
  }
});

module.exports = mongoose.model('User', UserSchema);
