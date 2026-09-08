const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Connection = require('../models/Connection');
const OfficialAchievement = require('../models/OfficialAchievement');
const OrganizerAchievement = require('../models/OrganizerAchievement');
const { hashAadhaar, withoutAadhaar } = require('../utils/aadhaar');
const {
  serializeAthleteProfile,
  serializeCoachProfile,
  serializeUnifiedAchievements
} = require('../utils/serializers');

async function linkHistoricalAchievements(user) {
  if (user.role !== 'athlete' || !user.aadhaarHash) return;
  await OfficialAchievement.updateMany(
    { aadhaarHash: user.aadhaarHash },
    { $set: { athleteUserId: user._id, athleteId: user.athleteId } }
  );
}

async function getCoachesList(req, res) {
  try {
    const query = { role: 'coach', acceptingAthletes: { $ne: false } };
    if (req.query.sports || req.query.sport) {
      const rawSports = req.query.sports
        ? (Array.isArray(req.query.sports) ? req.query.sports : String(req.query.sports).split(','))
        : [req.query.sport];
      const sportsClean = rawSports.map(s => String(s).trim()).filter(Boolean);
      if (sportsClean.length > 0) {
        const regexes = sportsClean.map(sp => new RegExp('^' + sp.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i'));
        query.$or = [{ sports: { $in: regexes } }, { sport: { $in: regexes } }];
      }
    }
    if (req.query.preference) {
      query.coachingPreferences = { $in: [String(req.query.preference).toUpperCase().trim()] };
    }
    if (req.query.level) {
      query.coachingLevels = { $in: [String(req.query.level).toUpperCase().trim()] };
    }

    const rawCoaches = await User.find(query)
      .select('-passwordHash -aadhaarHash -resetPasswordOTP -resetPasswordToken')
      .sort({ yearsExperience: -1 });

    const coaches = rawCoaches.map(c => serializeCoachProfile(c, 'athlete', false));

    res.json(coaches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/athlete/coaches or /api/athlete/coaches/list — list all coaches with optional recommendation filters
router.get('/coaches', getCoachesList);
router.get('/coaches/list', getCoachesList);
router.get('/recommendations/coaches', getCoachesList);

// GET /api/athlete/:id/profile
router.get('/:id/profile', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const serialized = serializeAthleteProfile(user, 'athlete');
    res.json(serialized);
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
    delete updates.federationState;
    delete updates.role;
    if (rawAadhaar) {
      const aadhaarHash = hashAadhaar(rawAadhaar);
      if (!aadhaarHash) return res.status(400).json({ error: 'Aadhaar number must contain exactly 12 digits.' });
      updates.aadhaarHash = aadhaarHash;
    }
    if (updates.dateOfBirth || updates.dob) {
      const parsed = new Date(updates.dateOfBirth || updates.dob);
      if (!isNaN(parsed.getTime())) {
        updates.dateOfBirth = parsed;
        updates.dob = parsed;
        const diffMs = Date.now() - parsed.getTime();
        const calcAge = Math.floor(diffMs / (365.25 * 24 * 3600 * 1000));
        updates.age = calcAge >= 0 ? calcAge : 0;
      }
    }
    if (updates.sports && Array.isArray(updates.sports)) {
      updates.sports = updates.sports.map(s => String(s).trim().toUpperCase()).filter(Boolean);
      if (updates.sports.length > 0) {
        updates.sport = updates.sports[0];
      }
    }
    if (updates.yearsOfExperience !== undefined) {
      updates.yearsOfExperience = Math.max(0, Number(updates.yearsOfExperience) || 0);
      updates.yearsExperience = updates.yearsOfExperience;
    }
    if (updates.athleteLevel) {
      updates.athleteLevel = String(updates.athleteLevel).toUpperCase().trim();
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

// GET /api/athlete/:id/achievements — Unified timeline of Federation, Organizer, and Self-Uploaded achievements
router.get('/:id/achievements', async (req, res) => {
  try {
    const athleteUser = await User.findById(req.params.id);
    if (!athleteUser) return res.status(404).json({ error: 'Athlete not found.' });

    await linkHistoricalAchievements(athleteUser);

    const queryConditions = [{ athleteUserId: athleteUser._id }];
    if (athleteUser.athleteId) {
      queryConditions.push({ athleteId: athleteUser.athleteId });
    }

    // 1. Federation Recognized achievements
    const officialAchievements = await OfficialAchievement.find({
      $or: queryConditions,
      verificationStatus: { $in: ['FROZEN', 'VERIFIED'] }
    })
      .select('-aadhaarHash -athleteIdentityReference')
      .populate('federation', 'name federationId sport state officialEmail')
      .populate('event', 'eventName eventId tournamentDate location submissionDeadline isFrozen')
      .sort({ createdAt: -1 });

    // 2. Organizer Verified achievements
    const organizerAchievements = await OrganizerAchievement.find({
      athlete: athleteUser._id
    })
      .populate('organizer', 'name organizationName organizerId mobile email officialAddress')
      .populate('event', 'eventName eventDate venue sports')
      .sort({ createdAt: -1 });

    // 3. Self-uploaded tournaments & certificates from User profile
    const tournaments = athleteUser.tournaments || [];

    // Unified serialization
    const unified = serializeUnifiedAchievements(
      officialAchievements,
      organizerAchievements,
      tournaments,
      athleteUser.name
    );

    // Optional source filter
    const sourceFilter = req.query.source ? String(req.query.source).toUpperCase() : null;
    const filtered = sourceFilter && sourceFilter !== 'ALL'
      ? unified.filter(a => a.sourceType === sourceFilter)
      : unified;

    res.json({
      athlete: {
        _id: athleteUser._id,
        athleteId: athleteUser.athleteId,
        name: athleteUser.name,
        sports: athleteUser.sports,
        sport: athleteUser.sport
      },
      counts: {
        total: unified.length,
        federation: officialAchievements.length,
        organizer: organizerAchievements.length,
        selfUploaded: tournaments.length
      },
      achievements: filtered
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/athlete/:id/tournaments — Add self-uploaded tournament / certificate
router.post('/:id/tournaments', async (req, res) => {
  try {
    const {
      tournamentName,
      sport,
      year,
      eventDate,
      category,
      position,
      certificateData,
      certificateFileName,
      certificateFileSize
    } = req.body;

    if (!tournamentName || !String(tournamentName).trim()) {
      return res.status(400).json({ error: 'Tournament name is required.' });
    }

    const athleteUser = await User.findById(req.params.id);
    if (!athleteUser) return res.status(404).json({ error: 'Athlete not found.' });

    const newRecord = {
      tournamentName: String(tournamentName).trim(),
      sport: sport ? String(sport).trim().toUpperCase() : (athleteUser.sport || 'SPORTS').toUpperCase(),
      year: year ? String(year).trim() : (eventDate ? new Date(eventDate).getFullYear().toString() : new Date().getFullYear().toString()),
      eventDate: eventDate ? new Date(eventDate) : undefined,
      category: category ? String(category).trim() : '',
      position: position ? String(position).trim() : 'Participant',
      certificateData: certificateData || null,
      certificateFileName: certificateFileName || '',
      certificateFileSize: Number(certificateFileSize) || 0,
      sourceType: 'SELF_UPLOADED',
      uploadedAt: new Date()
    };

    athleteUser.tournaments = athleteUser.tournaments || [];
    athleteUser.tournaments.push(newRecord);
    await athleteUser.save();

    res.status(201).json({
      success: true,
      message: 'Self-uploaded tournament record added.',
      record: newRecord,
      tournaments: athleteUser.tournaments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/athlete/:id/tournaments/:tournamentId — Remove self-uploaded tournament
router.delete('/:id/tournaments/:tournamentId', async (req, res) => {
  try {
    const athleteUser = await User.findById(req.params.id);
    if (!athleteUser) return res.status(404).json({ error: 'Athlete not found.' });

    athleteUser.tournaments = (athleteUser.tournaments || []).filter(
      t => String(t._id) !== String(req.params.tournamentId)
    );
    await athleteUser.save();

    res.json({
      success: true,
      message: 'Tournament record removed.',
      tournaments: athleteUser.tournaments
    });
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
      const athlete = await User.findById(req.params.id);
      io.to(coachId).emit('connection-request', {
        connectionId: conn._id,
        athlete: serializeAthleteProfile(athlete, 'coach', false),
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
