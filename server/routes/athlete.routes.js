const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Connection = require('../models/Connection');
const OfficialAchievement = require('../models/OfficialAchievement');
const { hashAadhaar, withoutAadhaar } = require('../utils/aadhaar');

async function linkHistoricalAchievements(user) {
  if (user.role !== 'athlete' || !user.aadhaarHash) return;
  await OfficialAchievement.updateMany(
    { aadhaarHash: user.aadhaarHash },
    { $set: { athleteUserId: user._id, athleteId: user.athleteId } }
  );
}

// GET /api/athlete/coaches or /api/athlete/coaches/list — list all coaches
router.get('/coaches', async (req, res) => {
  try {
    const coaches = await User.find({ role: 'coach', acceptingAthletes: { $ne: false } })
      .select('-passwordHash')
      .sort({ yearsExperience: -1 });
    res.json(coaches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/coaches/list', async (req, res) => {
  try {
    const coaches = await User.find({ role: 'coach', acceptingAthletes: { $ne: false } })
      .select('-passwordHash')
      .sort({ yearsExperience: -1 });
    res.json(coaches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/athlete/:id/profile
router.get('/:id/profile', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash -aadhaarHash');
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/athlete/:id/profile
router.put('/:id/profile', async (req, res) => {
  try {
    const updates = { ...req.body };
    const rawAadhaar = updates.aadhaarNumber || updates.aadhaar;
    delete updates.aadhaarNumber;
    delete updates.aadhaar;
    delete updates.aadhaarHash;
    delete updates.athleteId;
    delete updates.parentId;
    delete updates.coachId;
    delete updates.sponsorId;
    delete updates.academyId;
    delete updates.trackAthleteId;
    delete updates.organizerId;
    delete updates.federationId;
    delete updates.role;
    if (rawAadhaar) {
      const aadhaarHash = hashAadhaar(rawAadhaar);
      if (!aadhaarHash) return res.status(400).json({ error: 'Aadhaar number must contain exactly 12 digits.' });
      updates.aadhaarHash = aadhaarHash;
    }
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: 'Not found' });
    await linkHistoricalAchievements(user);
    res.json(withoutAadhaar(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/athlete/:id/connections — all connections for an athlete
router.get('/:id/connections', async (req, res) => {
  try {
    const connections = await Connection.find({ athlete: req.params.id })
      .populate('coach', '-passwordHash')
      .sort({ createdAt: -1 });
    res.json(connections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/athlete/:id/official-achievements — list federation-verified achievements for an athlete
router.get('/:id/official-achievements', async (req, res) => {
  try {
    const athleteUser = await User.findById(req.params.id);
    if (!athleteUser) return res.status(404).json({ error: 'Athlete not found.' });

    // Repair/link legacy records at read time as well as on signup and profile
    // updates, so a matching official result is visible immediately.
    await linkHistoricalAchievements(athleteUser);

    const queryConditions = [{ athleteUserId: athleteUser._id }];

    if (athleteUser.athleteId) {
      queryConditions.push({ athleteId: athleteUser.athleteId });
    }

    const officialAchievements = await OfficialAchievement.find({
      $or: queryConditions,
      verificationStatus: { $in: ['FROZEN', 'VERIFIED'] }
    })
      .select('-aadhaarHash -athleteIdentityReference')
      .populate('federation', 'name federationId sport state officialEmail')
      .populate('event', 'eventName eventId tournamentDate location submissionDeadline isFrozen')
      .sort({ createdAt: -1 });

    res.json(officialAchievements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/athlete/:id/connect  { coachId, message }
router.post('/:id/connect', async (req, res) => {
  try {
    const { coachId, message } = req.body;

    // Prevent duplicate pending requests
    const existing = await Connection.findOne({
      athlete: req.params.id,
      coach: coachId,
      status: { $in: ['Pending', 'Active'] }
    });
    if (existing) return res.status(409).json({ error: 'Request already sent or connection is active' });

    const conn = await Connection.create({
      athlete: req.params.id,
      coach: coachId,
      message,
      status: 'Pending'
    });

    // Notify the coach via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const athlete = await User.findById(req.params.id).select('-passwordHash');
      io.to(coachId).emit('connection-request', {
        connectionId: conn._id,
        athlete: {
          _id: athlete._id,
          name: athlete.name,
          sport: athlete.sport,
          beltRank: athlete.beltRank,
          achievements: athlete.achievements,
          videoLink: athlete.videoLink,
          city: athlete.city,
          state: athlete.state
        },
        message,
        createdAt: conn.createdAt
      });
    }

    res.status(201).json(conn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
