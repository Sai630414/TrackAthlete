const mongoose = require('mongoose');

const FederationSchema = new mongoose.Schema({
  federationId: { type: String, required: true, unique: true }, // e.g. FED-TKD001 or FED-ATHLETICS
  name: { type: String, required: true },
  sport: { type: String, required: true },
  state: { type: String, default: 'National' },
  abbreviation: { type: String, default: '' },
  website: { type: String, default: '' },
  recognitionStatus: { type: String, default: 'Recognized' },
  recognitionYear: { type: Number, default: 2024 },
  sourceDocument: { type: String, default: '' },

  officialEmail: { type: String, sparse: true, default: undefined },
  officialPhone: { type: String, default: '' },
  passwordHash: { type: String, default: '' },
  accountActivated: { type: Boolean, default: false },
  status: { type: String, enum: ['Active', 'Suspended', 'PendingVerification'], default: 'Active' },

  // Activation 2FA OTP fields
  activationOTPHash: String,
  activationOTPExpires: Date,
  activationVerified: { type: Boolean, default: false },

  // Login 2FA OTP fields
  loginOTPHash: String,
  loginOTPExpires: Date,
  loginOTPAttempts: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

FederationSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Federation', FederationSchema);
