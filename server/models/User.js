const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['athlete', 'parent', 'coach', 'sponsor', 'academy', 'admin', 'federation'], required: true },

  // Athlete-specific
  athleteId: { type: String, trim: true, sparse: true, unique: true },
  aadhaarHash: { type: String, default: null },
  sport: { type: String, trim: true },
  sports: [{ type: String, trim: true }],
  beltRank: String,
  age: Number,
  dateOfBirth: Date,
  dob: Date,
  gender: { type: String, trim: true },
  athleteLevel: { type: String, enum: ['BEGINNER', 'DISTRICT', 'STATE', 'NATIONAL', 'INTERNATIONAL'], trim: true },
  yearsOfExperience: { type: Number, default: 0 },
  currentlyActive: { type: Boolean, default: true },
  activelySeekingSponsorship: { type: Boolean, default: false },
  sponsorshipDetails: {
    upcomingEvent: { type: String, trim: true },
    eventLevel: { type: String, enum: ['NATIONAL', 'INTERNATIONAL'], trim: true },
    expectedEventDate: Date,
    requirementDescription: { type: String, trim: true }
  },
  achievements: [String],
  videoLink: String,
  seekingSponsorship: Boolean,
  sponsorshipReason: String,
  federationState: String, // preserved for backward-compatibility with existing records
  relocationFlexible: { type: Boolean, default: true },
  tournaments: [{
    tournamentName: { type: String, trim: true },
    sport: { type: String, trim: true },
    year: String,
    eventDate: Date,
    category: String,
    position: String,
    certificateData: { type: String, default: null },
    certificateFileName: { type: String, default: '' },
    certificateFileSize: { type: Number, default: 0 },
    sourceType: { type: String, default: 'SELF_UPLOADED' },
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Parent-specific
  parentId: { type: String, trim: true, sparse: true, unique: true },
  mobile: { type: String, trim: true },
  childName: { type: String, trim: true },
  childDob: { type: Date },
  relationshipToChild: { type: String, enum: ['FATHER', 'MOTHER', 'LEGAL GUARDIAN', 'OTHER'], trim: true },
  sports: [{ type: String, trim: true }],
  childAge: Number,
  childSport: String,

  // Coach-specific
  coachId: { type: String, trim: true, sparse: true, unique: true },
  nisId: { type: String, default: null, trim: true },
  certifications: [String],
  yearsExperience: Number,
  acceptingAthletes: { type: Boolean, default: true },
  phone: { type: String, default: null },
  profilePhoto: { type: String, default: null },
  bio: { type: String, default: null, trim: true },
  coachingLevels: [{ type: String, enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'COMPETITIVE'] }],
  coachingPreferences: [{ type: String, enum: ['INDIVIDUAL', 'ACADEMY'] }],
  willingToWorkWithAcademies: { type: Boolean, default: true },
  preferredWorkTypes: [{ type: String, enum: ['FULL-TIME', 'PART-TIME', 'CONTRACT', 'FLEXIBLE'] }],
  certificateData: { type: String, default: null },
  certificateFileName: { type: String, default: null },
  certificateFileSize: { type: Number, default: 0 },

  // Sponsor-specific
  sponsorId: { type: String, trim: true, sparse: true, unique: true },
  organizationName: String,
  budgetRange: String,
  targetSports: [String],

  // Academy-specific
  academyId: { type: String, trim: true, sparse: true, unique: true },
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

  // Linked Organizer reference & TrackAthlete ID
  trackAthleteId: { type: String, trim: true, sparse: true },
  linkedOrganizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organizer', default: null, index: true },

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
