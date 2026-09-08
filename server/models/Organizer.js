const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({ line1: String, city: String, state: String, pinCode: String, country: { type: String, default: 'India' } }, { _id: false });

const OrganizerSchema = new mongoose.Schema({
  organizerId: { type: String, unique: true, sparse: true, immutable: true },
  organizerType: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  designation: { type: String, required: true },
  organizationName: { type: String, trim: true },
  registrationNumber: String, affiliation: String, yearEstablished: Number, website: String,
  officialAddress: addressSchema,
  mobile: { type: String, required: true }, alternateMobile: String,
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  emailOTPHash: { type: String, select: false }, emailOTPExpires: Date,
  isEmailVerified: { type: Boolean, default: false }, accountStatus: { type: String, enum: ['pending_verification', 'active', 'suspended'], default: 'pending_verification' },
  linkedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  trackAthleteId: { type: String, trim: true, default: null }
}, { timestamps: true });

OrganizerSchema.set('toJSON', { transform: (_doc, value) => { delete value.passwordHash; delete value.emailOTPHash; return value; } });
module.exports = mongoose.model('Organizer', OrganizerSchema);
