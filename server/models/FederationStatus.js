const mongoose = require('mongoose');

const FederationStatusSchema = new mongoose.Schema({
  sport: { type: String, required: true },
  state: { type: String, required: true },
  currentFederation: String,
  recognizedByMinistry: { type: Boolean, default: false },
  recognizedInState: { type: Boolean, default: false },
  migrationNote: String,
  lastVerified: Date,
  source: String
});

module.exports = mongoose.model('FederationStatus', FederationStatusSchema);
