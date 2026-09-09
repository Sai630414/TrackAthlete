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

const { verifyToken, requireRoles } = require('../middleware/auth.middleware');
const User = require('../models/User');

/**
 * GET /api/tournaments/eligible
 * Returns upcoming tournaments matching athlete's sports, with unreadCount and seen state
 */
router.get('/eligible', verifyToken, requireRoles('athlete'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'Athlete not found.' });

    const athleteSports = (user.sports && user.sports.length > 0 ? user.sports : (user.sport ? [user.sport] : []))
      .map(s => String(s).trim().toUpperCase())
      .filter(Boolean);

    if (athleteSports.length === 0) {
      return res.json({ tournaments: [], unreadCount: 0 });
    }

    const now = new Date();
    const sportRegexes = athleteSports.map(s => new RegExp('^' + s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i'));

    // Official Federation Events
    const fedEvents = await OfficialEvent.find({
      sport: { $in: sportRegexes },
      tournamentDate: { $gt: now }
    })
    .populate('federation', 'name federationId sport state website officialPhone officialEmail')
    .sort({ tournamentDate: 1 })
    .lean();

    // Organizer Events
    const OrganizerEvent = require('../models/OrganizerEvent');
    const orgEvents = await OrganizerEvent.find({
      status: 'published',
      'sports.sportName': { $in: sportRegexes },
      eventDate: { $gt: now }
    })
    .populate('organizer', 'name organizationName organizerId mobile email designation officialAddress')
    .sort({ eventDate: 1 })
    .lean();

    const viewedSet = new Set((user.viewedTournamentIds || []).map(String));

    const allEligible = [
      ...fedEvents.map(e => ({
        ...e,
        id: String(e._id),
        source: 'federation',
        isUnread: !viewedSet.has(String(e._id))
      })),
      ...orgEvents.map(e => ({
        ...e,
        id: String(e._id),
        source: 'organizer',
        isOrganizerEvent: true,
        tournamentDate: e.eventDate,
        location: e.venue,
        submissionDeadline: e.registrationDeadline,
        category: 'Organizer Event',
        isUnread: !viewedSet.has(String(e._id))
      }))
    ].sort((a, b) => new Date(a.tournamentDate || a.eventDate || 0) - new Date(b.tournamentDate || b.eventDate || 0));

    const unreadCount = allEligible.filter(e => e.isUnread).length;

    res.json({ tournaments: allEligible, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/tournaments/eligible/unread-count
 * Returns count of unread eligible tournaments for the authenticated athlete
 */
router.get('/eligible/unread-count', verifyToken, requireRoles('athlete'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('sports sport viewedTournamentIds');
    if (!user) return res.status(404).json({ error: 'Athlete not found.' });

    const athleteSports = (user.sports && user.sports.length > 0 ? user.sports : (user.sport ? [user.sport] : []))
      .map(s => String(s).trim().toUpperCase())
      .filter(Boolean);

    if (athleteSports.length === 0) {
      return res.json({ count: 0 });
    }

    const now = new Date();
    const sportRegexes = athleteSports.map(s => new RegExp('^' + s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i'));

    const fedEvents = await OfficialEvent.find({
      sport: { $in: sportRegexes },
      tournamentDate: { $gt: now }
    }).select('_id').lean();

    const OrganizerEvent = require('../models/OrganizerEvent');
    const orgEvents = await OrganizerEvent.find({
      status: 'published',
      'sports.sportName': { $in: sportRegexes },
      eventDate: { $gt: now }
    }).select('_id').lean();

    const viewedSet = new Set((user.viewedTournamentIds || []).map(String));
    let unreadCount = 0;
    for (const e of fedEvents) {
      if (!viewedSet.has(String(e._id))) unreadCount++;
    }
    for (const e of orgEvents) {
      if (!viewedSet.has(String(e._id))) unreadCount++;
    }

    res.json({ count: unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tournaments/eligible/mark-viewed
 * Marks eligible tournaments as viewed by this athlete
 */
router.post('/eligible/mark-viewed', verifyToken, requireRoles('athlete'), async (req, res) => {
  try {
    const { tournamentIds } = req.body;
    let idsToAdd = [];
    if (Array.isArray(tournamentIds) && tournamentIds.length > 0) {
      idsToAdd = tournamentIds.map(String);
    } else {
      const user = await User.findById(req.user._id).select('sports sport');
      const athleteSports = (user?.sports && user.sports.length > 0 ? user.sports : (user?.sport ? [user.sport] : []))
        .map(s => String(s).trim().toUpperCase())
        .filter(Boolean);

      if (athleteSports.length > 0) {
        const now = new Date();
        const sportRegexes = athleteSports.map(s => new RegExp('^' + s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i'));
        const fed = await OfficialEvent.find({ sport: { $in: sportRegexes }, tournamentDate: { $gt: now } }).select('_id').lean();
        const OrganizerEvent = require('../models/OrganizerEvent');
        const org = await OrganizerEvent.find({ status: 'published', 'sports.sportName': { $in: sportRegexes }, eventDate: { $gt: now } }).select('_id').lean();
        idsToAdd = [...fed.map(e => String(e._id)), ...org.map(e => String(e._id))];
      }
    }

    if (idsToAdd.length > 0) {
      await User.updateOne(
        { _id: req.user._id },
        { $addToSet: { viewedTournamentIds: { $each: idsToAdd } } }
      );
    }

    res.json({ success: true, markedCount: idsToAdd.length, unreadCount: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
