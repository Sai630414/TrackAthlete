const mongoose = require('mongoose');

const ContactPersonSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  address: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  website: { type: String, default: '' }
}, { _id: false });

const OfficialAssociationSchema = new mongoose.Schema({
  associationId: { type: String, required: true, unique: true }, // e.g. ASSOC-ATH-AP
  associationName: { type: String, required: true },
  sport: { type: String, required: true },
  state: { type: String, required: true },
  registrationOrSerialNo: { type: String, default: '' },
  status: { type: String, default: 'Affiliated Unit' },
  address: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  website: { type: String, default: '' },
  
  nationalFederationName: { type: String, default: '' },
  nationalFederationAbbreviation: { type: String, default: '' },

  president: ContactPersonSchema,
  secretary: ContactPersonSchema,
  treasurer: ContactPersonSchema,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

OfficialAssociationSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('OfficialAssociation', OfficialAssociationSchema);
