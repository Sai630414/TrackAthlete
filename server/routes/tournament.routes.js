const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');
const OfficialEvent = require('../models/OfficialEvent');
const OfficialAchievement = require('../models/OfficialAchievement');

// GET /api/tournaments — List all official and public tournaments
router.get('/', async (req, res) => {
  try {
    const { sport, city } = req.query;
    const filter = {};
    if (sport) filter.sport = new RegExp('^' + String(sport).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i');
    if (city) filter.location = new RegExp(String(city), 'i');

    const officialEvents = await OfficialEvent.find(filter)
      .populate('federation', 'name federationId sport state website officialEmail')
      .sort({ tournamentDate: -1, createdAt: -1 });

    const legacyTournaments = await Tournament.find({}).sort({ date: 1 });

    res.json({
      officialEvents,
      legacyTournaments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tournaments/upcoming — Public endpoint for Upcoming Tournaments across all modules
router.get('/upcoming', async (req, res) => {
  try {
    const now = new Date();
    const upcomingEvents = await OfficialEvent.find({
      $or: [
        { tournamentDate: { $gte: now } },
        { status: 'UPCOMING' },
        { isFrozen: false }
      ]
    })
    .populate('federation', 'name federationId sport state website')
    .sort({ tournamentDate: 1, createdAt: -1 });

    res.json(upcomingEvents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tournaments/completed — Public endpoint for Completed Official Results
router.get('/completed', async (req, res) => {
  try {
    const completedAchievements = await OfficialAchievement.find({
      verificationStatus: { $in: ['FROZEN', 'VERIFIED'] }
    })
    .select('-aadhaarHash -athleteIdentityReference')
    .populate('federation', 'name federationId sport state')
    .populate('event', 'eventName eventId tournamentDate location category')
    .sort({ createdAt: -1 });

    res.json(completedAchievements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tournaments/:id/interest
router.post('/:id/interest', async (req, res) => {
  try {
    const t = await Tournament.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { interestedUsers: req.body.userId } },
      { new: true }
    );
    res.json(t);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
