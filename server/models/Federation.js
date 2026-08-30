const mongoose = require('mongoose');

const FederationSchema = new mongoose.Schema({
  federationId: { type: String, required: true, unique: true }, // e.g. FED-7K4M92XQ
  name: { type: String, required: true },
  sport: { type: String, required: true },
  state: { type: String, required: true },
  officialEmail: { type: String, required: true, unique: true },
  officialPhone: { type: String, required: true },
  passwordHash: { type: String, required: true },
  status: { type: String, enum: ['Active', 'Suspended', 'PendingVerification'], default: 'Active' },

  // OTP authentication fields
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
