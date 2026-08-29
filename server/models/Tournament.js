const mongoose = require('mongoose');

const TournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sport: { type: String, required: true },
  date: Date,
  city: String,
  state: String,
  location: String,
  registrationLink: String,
  registrationDeadline: Date,
  interestedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

module.exports = mongoose.model('Tournament', TournamentSchema);
