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
    const upcomingEvents = await OfficialEvent.find({ tournamentDate: { $gt: now } })
      .populate('federation', 'name federationId sport state website officialPhone officialEmail')
      .sort({ tournamentDate: 1, createdAt: -1 });

    const OrganizerEvent = require('../models/OrganizerEvent');
    const organizerEvents = await OrganizerEvent.find({ status: 'published', eventDate: { $gt: now } })
      .populate('organizer', 'name organizationName organizerId mobile email designation officialAddress')
      .sort({ eventDate: 1 });

    const sanitizedOrg = organizerEvents.map(event => {
      const json = event.toJSON();
      return { ...json, sourceType: 'organizer' };
    });

    res.json({ federationEvents: upcomingEvents, organizerEvents: sanitizedOrg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tournaments/completed — Public endpoint for Completed Official Results
router.get('/completed', async (req, res) => {
  try {
    const completedAchievements = await OfficialAchievement.find({
      $or: [
        { verificationStatus: { $in: ['FROZEN', 'VERIFIED'] } },
        { isFrozen: true }
      ]
    })
    .select('-aadhaarHash -athleteIdentityReference')
    .populate('federation', 'name federationId sport state website officialPhone officialEmail')
    .populate('event', 'eventName eventId tournamentDate location category')
    .sort({ createdAt: -1 });

    res.json(completedAchievements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tournaments/:id — Single tournament public details
router.get('/:id', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid tournament ID.' });
    }
    const event = await OfficialEvent.findById(req.params.id)
      .populate('federation', 'name federationId sport state website officialPhone officialEmail');
    if (!event) return res.status(404).json({ error: 'Tournament not found.' });
    res.json({ event, source: 'federation' });
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
