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
const { getAthleteHighestVerifiedLevelPerSport } = require('../utils/recommendationEngine');

const mongoose = require('mongoose');

async function findAthleteUser(id) {
  if (!id) return null;
  const idStr = String(id).trim();
  if (mongoose.isValidObjectId(idStr)) {
    const u = await User.findById(idStr);
    if (u) return u;
  }
  return await User.findOne({
    $or: [
      { athleteId: idStr },
      { trackAthleteId: idStr },
      { athleteId: idStr.toUpperCase() },
      { trackAthleteId: idStr.toUpperCase() }
    ]
  });
}

async function linkHistoricalAchievements(user) {
  if (user.role !== 'athlete') return;
  let linked = false;
  if (user.aadhaarHash) {
    const res = await OfficialAchievement.updateMany(
      { aadhaarHash: user.aadhaarHash, athleteUserId: { $ne: user._id } },
      { $set: { athleteUserId: user._id, athleteId: user.athleteId } }
    ).catch(e => console.error('Historical federation achievement link error:', e.message));
    if (res?.modifiedCount > 0) linked = true;
  }
  if (user.athleteId) {
    await OrganizerAchievement.updateMany(
      { athleteId: user.athleteId, athlete: { $ne: user._id } },
      { $set: { athlete: user._id } }
    ).catch(e => console.error('Historical organizer achievement link error:', e.message));
  }
  if (linked) {
    const { generateAthleteRecommendations } = require('../utils/recommendationEngine');
    await generateAthleteRecommendations(user._id).catch(() => {});
  }
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
    const user = await findAthleteUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const serialized = serializeAthleteProfile(user, 'athlete');

    // Aggregate real achievements from all 3 sources into profile unifiedAchievements (Rule 8)
    const matchCriteria = [{ athleteUserId: user._id }];
    if (user.athleteId) matchCriteria.push({ athleteId: user.athleteId });

    const [officialAchs, organizerAchs] = await Promise.all([
      OfficialAchievement.find({ $or: matchCriteria, verificationStatus: { $in: ['FROZEN', 'VERIFIED'] } })
        .select('-aadhaarHash -athleteIdentityReference')
        .populate('federation', 'name federationId sport state')
        .populate('event', 'eventName eventDate tournamentDate location competitionLevel')
        .sort({ createdAt: -1 }),
      OrganizerAchievement.find({ $or: [{ athlete: user._id }, ...(user.athleteId ? [{ athleteId: user.athleteId }] : [])] })
        .populate('organizer', 'name organizationName organizerId')
        .populate('event', 'eventName eventDate venue sports competitionLevel')
        .sort({ createdAt: -1 })
    ]);

    serialized.unifiedAchievements = serializeUnifiedAchievements(officialAchs, organizerAchs, user.tournaments || [], user.name);
    const highestVerifiedBySport = await getAthleteHighestVerifiedLevelPerSport(user._id, user.athleteId);
    serialized.perSportHighestVerifiedAchievement = Object.values(highestVerifiedBySport).map(item => ({
      sport: item.sport,
      level: item.highestLevel,
      outcome: item.outcome,
      sourceType: item.sourceType,
      sourceAchievementId: item.sourceAchievementId
    }));
    serialized.highestVerifiedAchievement = serialized.perSportHighestVerifiedAchievement.length
      ? serialized.perSportHighestVerifiedAchievement.reduce((highest, item) => {
          const ranks = { DISTRICT: 1, STATE: 2, NATIONAL: 3, INTERNATIONAL: 4 };
          return !highest || ranks[item.level] > ranks[highest.level] ? item : highest;
        }, null)
      : null;
    res.json(serialized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/athlete/:id/profile
router.put('/:id/profile', async (req, res) => {
  try {
    const athleteUser = await findAthleteUser(req.params.id);
    if (!athleteUser) return res.status(404).json({ error: 'Not found' });

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
    const user = await User.findByIdAndUpdate(athleteUser._id, updates, { new: true, runValidators: true });
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
    const athleteUser = await findAthleteUser(req.params.id);
    if (!athleteUser) return res.status(404).json({ error: 'Athlete not found.' });

    const connections = await Connection.find({ athlete: athleteUser._id })
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
    const athleteUser = await findAthleteUser(req.params.id);
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
      .populate('event', 'eventName eventId tournamentDate location submissionDeadline isFrozen competitionLevel')
      .sort({ createdAt: -1 });

    res.json(officialAchievements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/athlete/:id/achievements — Unified timeline of Federation, Organizer, and Self-Uploaded achievements
router.get('/:id/achievements', async (req, res) => {
  try {
    const athleteUser = await findAthleteUser(req.params.id);
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
      .populate('event', 'eventName eventId tournamentDate location submissionDeadline isFrozen competitionLevel')
      .sort({ createdAt: -1 });

    // 2. Organizer Verified achievements
    const orgQueryConditions = [{ athlete: athleteUser._id }];
    if (athleteUser.athleteId) {
      orgQueryConditions.push({ athleteId: athleteUser.athleteId });
    }
    const organizerAchievements = await OrganizerAchievement.find({
      $or: orgQueryConditions
    })
      .populate('organizer', 'name organizationName organizerId mobile email officialAddress')
      .populate('event', 'eventName eventDate venue sports competitionLevel')
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

    // Optional source filter matching FEDERATION, FEDERATION_RECOGNIZED, ORGANIZER, ORGANIZER_VERIFIED, SELF_UPLOADED
    const sourceFilter = req.query.source ? String(req.query.source).toUpperCase() : null;
    const filtered = sourceFilter && sourceFilter !== 'ALL'
      ? unified.filter(a => {
          const s = a.sourceType.toUpperCase();
          const f = sourceFilter.toUpperCase();
          return s === f ||
            s === f + '_RECOGNIZED' ||
            s === f + '_VERIFIED' ||
            (f === 'FEDERATION' && s.startsWith('FEDERATION')) ||
            (f === 'ORGANIZER' && s.startsWith('ORGANIZER'));
        })
      : unified;

    const fedCount = unified.filter(a => a.sourceType === 'FEDERATION_RECOGNIZED' || a.sourceType === 'FEDERATION').length;
    const orgCount = unified.filter(a => a.sourceType === 'ORGANIZER_VERIFIED' || a.sourceType === 'ORGANIZER').length;
    const selfCount = unified.filter(a => a.sourceType === 'SELF_UPLOADED').length;

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
        federation: fedCount,
        organizer: orgCount,
        selfUploaded: selfCount
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

    const athleteUser = await findAthleteUser(req.params.id);
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
    const athleteUser = await findAthleteUser(req.params.id);
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
