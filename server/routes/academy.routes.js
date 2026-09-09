const express = require('express');
const router = express.Router();
const Academy = require('../models/Academy');
const AcademyCoachAssignment = require('../models/AcademyCoachAssignment');
const AcademyAthleteMembership = require('../models/AcademyAthleteMembership');
const AcademyOpening = require('../models/AcademyOpening');
const AcademyAthleteRequest = require('../models/AcademyAthleteRequest');
const AcademyCoachRequest = require('../models/AcademyCoachRequest');
const User = require('../models/User');
const OfficialAchievement = require('../models/OfficialAchievement');
const OrganizerAchievement = require('../models/OrganizerAchievement');
const { verifyToken, requireRoles } = require('../middleware/auth.middleware');
const { hashAadhaar } = require('../utils/aadhaar');
const {
  serializeAthleteProfile,
  serializeCoachProfile,
  serializeAcademyProfile,
  serializeUnifiedAchievements
} = require('../utils/serializers');

/**
 * Helper: Retrieve Academy document for current user
 */
async function getAcademyForUser(userId) {
  let academy = await Academy.findOne({ userId });
  if (!academy) {
    // Fallback: check if academy exists with user's email or name
    const user = await User.findById(userId);
    if (user && user.role === 'academy') {
      const cleanEmail = user.email ? String(user.email).trim().toLowerCase() : '';
      academy = await Academy.findOne({
        $or: [
          { email: new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i') },
          { name: new RegExp('^' + String(user.academyName || user.name || '').trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i') }
        ]
      });
      if (academy) {
        if (!academy.userId) {
          academy.userId = user._id;
          await academy.save();
        }
      } else {
        const permanentId = `ACA-${user._id.toString().slice(-8).toUpperCase()}`;
        academy = await Academy.create({
          userId: user._id,
          academyId: permanentId,
          name: String(user.academyName || user.name || 'Sports Academy').trim(),
          contactPhone: String(user.contactPhone || user.phone || '+91 0000000000').trim(),
          email: cleanEmail,
          address: {
            addressLine1: typeof user.address === 'string' ? user.address : (user.address?.addressLine1 || ''),
            city: user.city || '',
            state: user.state || '',
            pincode: user.pincode || '',
            country: 'India'
          },
          city: user.city || '',
          state: user.state || '',
          location: user.location || { type: 'Point', coordinates: [80.6480, 16.5062] },
          sports: (user.sportsOffered || []).map(s => ({ sportName: s, addedAt: new Date() })),
          verified: true
        });
      }
    }
  }

  // Ensure academy and user have permanent academyId assigned and verified set (self-heal once without overwriting)
  if (academy) {
    const updateFields = {};
    if (!academy.academyId) {
      const baseId = academy.userId || academy._id;
      academy.academyId = `ACA-${baseId.toString().slice(-8).toUpperCase()}`;
      updateFields.academyId = academy.academyId;
    }
    if (academy.verified !== true) {
      academy.verified = true;
      updateFields.verified = true;
    }
    if (Object.keys(updateFields).length > 0) {
      await Academy.updateOne({ _id: academy._id }, { $set: updateFields });
    }
    if (academy.userId) {
      const u = await User.findById(academy.userId);
      if (u && (!u.academyId || !u.trackAthleteId || u.verified !== true || u.isVerified !== true)) {
        u.academyId = u.academyId || academy.academyId;
        u.trackAthleteId = u.trackAthleteId || academy.academyId;
        await User.updateOne(
          { _id: u._id },
          { $set: { academyId: u.academyId, trackAthleteId: u.trackAthleteId, verified: true, isVerified: true } }
        );
      }
    }
  }

  return academy;
}

// POST /api/academy/login & /api/academy/auth/login (Academy-dedicated login endpoint)
router.post(['/login', '/auth/login'], async (req, res) => {
  try {
    const { email, identifier, password, rememberMe } = req.body;
    const loginIdent = email || identifier;
    if (!loginIdent || !password) {
      return res.status(400).json({ error: 'Email/Identifier and password are required.' });
    }

    const cleanInput = String(loginIdent).trim();
    const cleanEmail = cleanInput.toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '');
    const cleanDigits = cleanInput.replace(/\D/g, '');
    const escapedIdent = cleanInput.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const identRegex = new RegExp('^' + escapedIdent + '$', 'i');

    const academyUserQuery = [
      { email: new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i'), role: 'academy' },
      { academyName: identRegex, role: 'academy' },
      { name: identRegex, role: 'academy' },
      { academyId: identRegex, role: 'academy' },
      { trackAthleteId: identRegex, role: 'academy' }
    ];
    if (cleanDigits.length >= 7) {
      const phoneSuffix = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;
      academyUserQuery.push(
        { contactPhone: new RegExp(phoneSuffix + '$'), role: 'academy' },
        { phone: new RegExp(phoneSuffix + '$'), role: 'academy' }
      );
    }
    let user = await User.findOne({ $or: academyUserQuery });
    let acadDoc = null;

    if (!user) {
      const acadConditions = [
        { email: new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i') },
        { name: identRegex },
        { academyId: identRegex }
      ];
      if (cleanDigits.length >= 7) {
        const phoneSuffix = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;
        acadConditions.push({ contactPhone: new RegExp(phoneSuffix + '$') });
      }
      acadDoc = await Academy.findOne({ $or: acadConditions });
      if (acadDoc) {
        if (acadDoc.userId) user = await User.findById(acadDoc.userId);
        if (!user && acadDoc.email) {
          user = await User.findOne({
            email: new RegExp('^' + String(acadDoc.email).trim().toLowerCase().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i')
          });
        }
      }
    }

    if (!acadDoc && user) {
      acadDoc = await Academy.findOne({
        $or: [
          { userId: user._id },
          { email: new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i') }
        ]
      });
    }

    if (!user) {
      user = await User.findOne({
        email: new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i')
      });
      if (user && !acadDoc) {
        acadDoc = await Academy.findOne({ $or: [{ userId: user._id }, { email: user.email }] });
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const { withoutAadhaar } = require('../utils/aadhaar');
    const passStr = String(password != null ? password : '');
    let match = (await bcrypt.compare(passStr, user.passwordHash)) || (await bcrypt.compare(passStr.trim(), user.passwordHash));
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Account must strictly have role === 'academy'
    if (user.role !== 'academy') {
      const regRole = (user.role || '').toUpperCase() || 'ANOTHER ROLE';
      return res.status(403).json({
        error: `This account is registered as ${regRole}. Please select the ${regRole} tab to sign in.`
      });
    }

    // Self-heal academyId on acadDoc and linked user if missing
    if (acadDoc && !acadDoc.academyId) {
      const baseId = acadDoc.userId || acadDoc._id;
      acadDoc.academyId = `ACA-${baseId.toString().slice(-8).toUpperCase()}`;
      await Academy.updateOne({ _id: acadDoc._id }, { $set: { academyId: acadDoc.academyId } });
    }
    if (user && (!user.academyId || !user.trackAthleteId)) {
      const aid = acadDoc?.academyId || `ACA-${user._id.toString().slice(-8).toUpperCase()}`;
      user.academyId = user.academyId || aid;
      user.trackAthleteId = user.trackAthleteId || aid;
      await User.updateOne({ _id: user._id }, { $set: { academyId: user.academyId, trackAthleteId: user.trackAthleteId } });
    }

    const expiresIn = rememberMe ? '30d' : '7d';
    const jwtSecret = process.env.JWT_SECRET || 'trackathlete_sih_secret_2026';
    const token = jwt.sign({ id: user._id, role: 'academy' }, jwtSecret, { expiresIn });

    const userObj = withoutAadhaar(user);
    userObj.role = 'academy';
    if (acadDoc) {
      userObj.academyId = acadDoc.academyId;
      userObj.trackAthleteId = acadDoc.academyId;
      userObj.academyName = acadDoc.name;
    } else {
      userObj.academyId = user.academyId || `ACA-${user._id.toString().slice(-8).toUpperCase()}`;
      userObj.trackAthleteId = userObj.academyId;
    }
    delete userObj.passwordHash;
    delete userObj.resetPasswordOTP;

    res.json({ token, user: userObj });
  } catch (err) {
    console.error('Academy login error:', err);
    res.status(500).json({ error: err.message || 'Academy login failed' });
  }
});

/* ==========================================================================
   ACADEMY-AUTHENTICATED ROUTES
   ========================================================================== */

/**
 * GET /api/academy/my/profile
 * Retrieve academy profile including address, location, ranking stats, dynamic achievement levels, and sports
 */
router.get('/my/profile', verifyToken, requireRoles('academy'), async (req, res) => {
  try {
    let academy = await getAcademyForUser(req.user._id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy profile not found for this account.' });
    }

    const { getAcademyPerSportAchievementLevels } = require('../utils/recommendationEngine');
    const { overallLevel, perSport } = await getAcademyPerSportAchievementLevels(academy);

    const serialized = serializeAcademyProfile(academy, 'academy');
    serialized.achievementLevel = overallLevel;
    serialized.achievementLevelLabel = overallLevel !== 'UNRANKED' ? `Achievement Level: ${overallLevel}` : 'Achievement Level: UNRANKED';
    serialized.perSportLevels = perSport;

    res.json(serialized);
  } catch (err) {
    console.error('Error fetching academy profile:', err);
    res.status(500).json({ error: 'Failed to fetch academy profile: ' + err.message });
  }
});

/**
 * PUT /api/academy/my/profile
 * Update academy profile and dynamically recalculate achievement level
 */
router.put('/my/profile', verifyToken, requireRoles('academy'), async (req, res) => {
  try {
    let academy = await getAcademyForUser(req.user._id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy profile not found.' });
    }

    const {
      name,
      contactPhone,
      email,
      address,
      city,
      state,
      location,
      rankingStats
    } = req.body;

    if (name) academy.name = String(name).trim();
    if (contactPhone) academy.contactPhone = String(contactPhone).trim();
    if (email) academy.email = String(email).trim().toLowerCase();

    if (address) {
      academy.address = {
        addressLine1: address.addressLine1 || academy.address?.addressLine1 || '',
        addressLine2: address.addressLine2 || academy.address?.addressLine2 || '',
        city: address.city || city || academy.address?.city || '',
        state: address.state || state || academy.address?.state || '',
        pincode: address.pincode || academy.address?.pincode || '',
        country: address.country || academy.address?.country || 'India'
      };
    }

    if (city) academy.city = String(city).trim();
    if (state) academy.state = String(state).trim();

    if (location && Array.isArray(location.coordinates) && location.coordinates.length === 2) {
      academy.location = {
        type: 'Point',
        coordinates: [Number(location.coordinates[0]), Number(location.coordinates[1])]
      };
    }

    if (rankingStats) {
      academy.rankingStats = {
        districtPlayers: Number(rankingStats.districtPlayers ?? academy.rankingStats?.districtPlayers ?? 0),
        statePlayers: Number(rankingStats.statePlayers ?? academy.rankingStats?.statePlayers ?? 0),
        nationalPlayers: Number(rankingStats.nationalPlayers ?? academy.rankingStats?.nationalPlayers ?? 0),
        internationalPlayers: Number(rankingStats.internationalPlayers ?? academy.rankingStats?.internationalPlayers ?? 0)
      };
    }

    // Dynamic achievement level calculation
    const { getAcademyPerSportAchievementLevels } = require('../utils/recommendationEngine');
    const { overallLevel, perSport } = await getAcademyPerSportAchievementLevels(academy);
    academy.achievementLevel = overallLevel;
    academy.achievementLevelLabel = overallLevel !== 'UNRANKED' ? `Achievement Level: ${overallLevel}` : 'Achievement Level: UNRANKED';
    academy.verified = true;
    academy.updatedAt = new Date();
    await academy.save();

    const serialized = serializeAcademyProfile(academy, 'academy');
    serialized.achievementLevel = overallLevel;
    serialized.achievementLevelLabel = academy.achievementLevelLabel;
    serialized.perSportLevels = perSport;

    res.json(serialized);
  } catch (err) {
    console.error('Error updating academy profile:', err);
    res.status(500).json({ error: 'Failed to update academy profile: ' + err.message });
  }
});

/**
 * GET /api/academy/my/sports
 * List sports offered by academy with coach and athlete counts
 */
router.get('/my/sports', verifyToken, requireRoles('academy'), async (req, res) => {
  try {
    const academy = await getAcademyForUser(req.user._id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy profile not found.' });
    }

    const sportsWithCounts = await Promise.all((academy.sports || []).map(async (sportItem) => {
      const sportName = sportItem.sportName;
      const coachCount = await AcademyCoachAssignment.countDocuments({
        academyId: academy._id,
        sportName,
        status: 'ACTIVE'
      });
      const athleteCount = await AcademyAthleteMembership.countDocuments({
        academyId: academy._id,
        sportName,
        status: 'ACTIVE'
      });

      return {
        sportName,
        addedAt: sportItem.addedAt,
        coachCount,
        athleteCount
      };
    }));

    res.json(sportsWithCounts);
  } catch (err) {
    console.error('Error fetching academy sports:', err);
    res.status(500).json({ error: 'Failed to fetch sports: ' + err.message });
  }
});

/**
 * POST /api/academy/my/sports
 * Add a new sport with initial coach details
 */
router.post('/my/sports', verifyToken, requireRoles('academy'), async (req, res) => {
  try {
    const academy = await getAcademyForUser(req.user._id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy profile not found.' });
    }

    const {
      sportName,
      coachName,
      coachAadhaar,
      coachNisId,
      coachCertificateData,
      coachCertificateFileName,
      coachTrackAthleteId
    } = req.body;

    if (!sportName || !String(sportName).trim()) {
      return res.status(400).json({ error: 'Sport name is required.' });
    }

    const normalizedSport = String(sportName).trim().toUpperCase();

    // Check if sport already exists
    const exists = academy.sports.some(s => s.sportName === normalizedSport);
    if (!exists) {
      academy.sports.push({ sportName: normalizedSport, addedAt: new Date() });
      await academy.save();
    }

    let createdCoach = null;
    if (coachName && String(coachName).trim()) {
      let coachUserId = null;
      let coachId = null;

      if (coachTrackAthleteId && String(coachTrackAthleteId).trim()) {
        const cleanTrackId = String(coachTrackAthleteId).trim();
        const matchedCoach = await User.findOne({
          role: 'coach',
          $or: [{ coachId: cleanTrackId }, { athleteId: cleanTrackId }]
        });
        if (matchedCoach) {
          coachUserId = matchedCoach._id;
          coachId = matchedCoach.coachId || cleanTrackId;
        } else {
          coachId = cleanTrackId;
        }
      }

      let aadhaarHash = null;
      if (coachAadhaar) {
        aadhaarHash = hashAadhaar(coachAadhaar);
        if (!aadhaarHash) {
          return res.status(400).json({ error: 'Coach Aadhaar number must contain exactly 12 digits.' });
        }
      }

      createdCoach = await AcademyCoachAssignment.create({
        academyId: academy._id,
        sportName: normalizedSport,
        coachUserId,
        coachId,
        name: String(coachName).trim(),
        aadhaarHash,
        nisId: coachNisId ? String(coachNisId).trim() : null,
        certificateData: coachCertificateData || null,
        certificateFileName: coachCertificateFileName || `${String(coachName).trim()}_Certificate.pdf`,
        isOffline: !coachUserId,
        role: 'Head Coach',
        status: 'ACTIVE'
      });
    }

    const sanitizedCoach = createdCoach ? createdCoach.toObject() : null;
    if (sanitizedCoach) delete sanitizedCoach.aadhaarHash;

    res.status(201).json({
      message: 'Sport added successfully.',
      sport: { sportName: normalizedSport },
      coach: sanitizedCoach
    });
  } catch (err) {
    console.error('Error adding sport:', err);
    res.status(500).json({ error: 'Failed to add sport: ' + err.message });
  }
});

/**
 * GET /api/academy/my/sports/:sportName/details
 * Retrieve coaches and athletes for a specific sport
 */
router.get('/my/sports/:sportName/details', verifyToken, requireRoles('academy'), async (req, res) => {
  try {
    const academy = await getAcademyForUser(req.user._id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy profile not found.' });
    }

    const sportName = decodeURIComponent(req.params.sportName).trim().toUpperCase();

    const coaches = await AcademyCoachAssignment.find({
      academyId: academy._id,
      sportName,
      status: 'ACTIVE'
    })
      .select('-aadhaarHash')
      .populate('coachUserId', 'name email phone profilePhoto bio coachId nisId')
      .sort({ createdAt: -1 });

    const athletes = await AcademyAthleteMembership.find({
      academyId: academy._id,
      sportName,
      status: 'ACTIVE'
    })
      .select('-aadhaarHash')
      .populate('athleteUserId', 'name email phone profilePhoto sport dateOfBirth athleteId city state')
      .sort({ joinedAt: -1, createdAt: -1 });

    res.json({
      sportName,
      coaches,
      athletes
    });
  } catch (err) {
    console.error('Error fetching sport details:', err);
    res.status(500).json({ error: 'Failed to fetch sport details: ' + err.message });
  }
});

/**
 * POST /api/academy/my/sports/:sportName/coaches
 * Directly add an offline or linked coach to a sport
 */
router.post('/my/sports/:sportName/coaches', verifyToken, requireRoles('academy'), async (req, res) => {
  try {
    const academy = await getAcademyForUser(req.user._id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy profile not found.' });
    }

    const sportName = decodeURIComponent(req.params.sportName).trim().toUpperCase();
    const {
      name,
      aadhaar,
      nisId,
      certificateData,
      certificateFileName,
      coachTrackAthleteId,
      role
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Coach name is required.' });
    }

    let coachUserId = null;
    let coachId = null;

    if (coachTrackAthleteId && String(coachTrackAthleteId).trim()) {
      const cleanTrackId = String(coachTrackAthleteId).trim();
      const matchedCoach = await User.findOne({
        role: 'coach',
        $or: [{ coachId: cleanTrackId }, { athleteId: cleanTrackId }]
      });
      if (matchedCoach) {
        coachUserId = matchedCoach._id;
        coachId = matchedCoach.coachId || cleanTrackId;
      } else {
        coachId = cleanTrackId;
      }
    }

    let aadhaarHash = null;
    if (aadhaar) {
      aadhaarHash = hashAadhaar(aadhaar);
      if (!aadhaarHash) {
        return res.status(400).json({ error: 'Aadhaar number must contain exactly 12 digits.' });
      }
    }

    // Ensure sport exists in academy sports
    if (!academy.sports.some(s => s.sportName === sportName)) {
      academy.sports.push({ sportName, addedAt: new Date() });
      await academy.save();
    }

    // Prevent duplicate coach assignment
    let existingAssignment = null;
    if (coachUserId) {
      existingAssignment = await AcademyCoachAssignment.findOne({
        academyId: academy._id,
        sportName,
        coachUserId
      });
    } else if (coachId) {
      existingAssignment = await AcademyCoachAssignment.findOne({
        academyId: academy._id,
        sportName,
        coachId
      });
    } else {
      existingAssignment = await AcademyCoachAssignment.findOne({
        academyId: academy._id,
        sportName,
        isOffline: true,
        name: String(name).trim()
      });
    }

    if (existingAssignment) {
      existingAssignment.status = 'ACTIVE';
      if (nisId) existingAssignment.nisId = String(nisId).trim();
      if (certificateData) existingAssignment.certificateData = certificateData;
      if (certificateFileName) existingAssignment.certificateFileName = certificateFileName;
      if (role) existingAssignment.role = String(role).trim();
      if (aadhaarHash) existingAssignment.aadhaarHash = aadhaarHash;
      await existingAssignment.save();

      const resObj = existingAssignment.toObject();
      delete resObj.aadhaarHash;
      return res.status(200).json(resObj);
    }

    const assignment = await AcademyCoachAssignment.create({
      academyId: academy._id,
      sportName,
      coachUserId,
      coachId,
      name: String(name).trim(),
      aadhaarHash,
      nisId: nisId ? String(nisId).trim() : null,
      certificateData: certificateData || null,
      certificateFileName: certificateFileName || `${String(name).trim()}_Certificate.pdf`,
      isOffline: !coachUserId,
      role: role ? String(role).trim() : 'Coach',
      status: 'ACTIVE'
    });

    const resObj = assignment.toObject();
    delete resObj.aadhaarHash;
    res.status(201).json(resObj);
  } catch (err) {
    console.error('Error adding coach:', err);
    res.status(500).json({ error: 'Failed to add coach: ' + err.message });
  }
});

/**
 * POST /api/academy/my/sports/:sportName/athletes
 * Directly add an offline or linked athlete to a sport
 */
router.post('/my/sports/:sportName/athletes', verifyToken, requireRoles('academy'), async (req, res) => {
  try {
    const academy = await getAcademyForUser(req.user._id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy profile not found.' });
    }

    const sportName = decodeURIComponent(req.params.sportName).trim().toUpperCase();
    const {
      name,
      mobile,
      aadhaar,
      athleteTrackAthleteId,
      negotiatedPayment
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Athlete name is required.' });
    }
    if (!mobile || !String(mobile).trim()) {
      return res.status(400).json({ error: 'Athlete mobile number is required.' });
    }

    let athleteUserId = null;
    let athleteId = null;

    // Athlete ID is strictly optional
    if (athleteTrackAthleteId && String(athleteTrackAthleteId).trim()) {
      const cleanTrackId = String(athleteTrackAthleteId).trim();
      const matchedAthlete = await User.findOne({
        role: 'athlete',
        athleteId: cleanTrackId
      });
      if (matchedAthlete) {
        athleteUserId = matchedAthlete._id;
        athleteId = matchedAthlete.athleteId;
      } else {
        athleteId = cleanTrackId;
      }
    }

    let aadhaarHash = null;
    if (aadhaar) {
      aadhaarHash = hashAadhaar(aadhaar);
      if (!aadhaarHash) {
        return res.status(400).json({ error: 'Aadhaar number must contain exactly 12 digits.' });
      }
    }

    // Ensure sport exists in academy sports
    if (!academy.sports.some(s => s.sportName === sportName)) {
      academy.sports.push({ sportName, addedAt: new Date() });
      await academy.save();
    }

    // Prevent duplicate athlete membership
    let existingMembership = null;
    if (athleteUserId) {
      existingMembership = await AcademyAthleteMembership.findOne({
        academyId: academy._id,
        sportName,
        athleteUserId
      });
    } else if (athleteId) {
      existingMembership = await AcademyAthleteMembership.findOne({
        academyId: academy._id,
        sportName,
        athleteId
      });
    } else {
      existingMembership = await AcademyAthleteMembership.findOne({
        academyId: academy._id,
        sportName,
        membershipSource: 'OFFLINE',
        name: String(name).trim(),
        mobile: String(mobile).trim()
      });
    }

    if (existingMembership) {
      existingMembership.status = 'ACTIVE';
      if (negotiatedPayment) existingMembership.negotiatedPayment = String(negotiatedPayment).trim();
      if (aadhaarHash) existingMembership.aadhaarHash = aadhaarHash;
      await existingMembership.save();

      const resObj = existingMembership.toObject();
      delete resObj.aadhaarHash;
      return res.status(200).json(resObj);
    }

    const membership = await AcademyAthleteMembership.create({
      academyId: academy._id,
      sportName,
      athleteUserId,
      athleteId,
      name: String(name).trim(),
      mobile: String(mobile).trim(),
      aadhaarHash,
      membershipSource: athleteUserId ? 'ONLINE' : 'OFFLINE',
      status: 'ACTIVE',
      joinedAt: new Date(),
      negotiatedPayment: negotiatedPayment ? String(negotiatedPayment).trim() : 'Negotiated During Joining'
    });

    const resObj = membership.toObject();
    delete resObj.aadhaarHash;
    res.status(201).json(resObj);
  } catch (err) {
    console.error('Error adding athlete:', err);
    res.status(500).json({ error: 'Failed to add athlete: ' + err.message });
  }
});

/**
 * GET /api/academy/my/openings
 * List all openings created by this academy
 */
router.get('/my/openings', verifyToken, requireRoles('academy'), async (req, res) => {
  try {
    const academy = await getAcademyForUser(req.user._id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy profile not found.' });
    }

    const openings = await AcademyOpening.find({ academyId: academy._id }).sort({ createdAt: -1 });
    res.json(openings);
  } catch (err) {
    console.error('Error fetching openings:', err);
    res.status(500).json({ error: 'Failed to fetch openings: ' + err.message });
  }
});

/**
 * POST /api/academy/my/openings
 * Create a new hiring opening
 */
router.post('/my/openings', verifyToken, requireRoles('academy'), async (req, res) => {
  try {
    const academy = await getAcademyForUser(req.user._id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy profile not found.' });
    }

    const { sportName, position, description, location, salary } = req.body;

    if (!sportName || !position) {
      return res.status(400).json({ error: 'Sport name and position are required.' });
    }

    const opening = await AcademyOpening.create({
      academyId: academy._id,
      sportName: String(sportName).trim().toUpperCase(),
      position: String(position).trim(),
      description: description ? String(description).trim() : '',
      location: location ? String(location).trim() : `${academy.city || ''}, ${academy.state || ''}`.trim() || 'On-site',
      salary: salary ? String(salary).trim() : 'Negotiated During Joining',
      status: 'OPEN'
    });

    res.status(201).json(opening);
  } catch (err) {
    console.error('Error creating opening:', err);
    res.status(500).json({ error: 'Failed to create opening: ' + err.message });
  }
});

/**
 * PATCH /api/academy/my/openings/:id/status
 * Toggle or update opening status (OPEN / CLOSED)
 */
router.patch('/my/openings/:id/status', verifyToken, requireRoles('academy'), async (req, res) => {
  try {
    const academy = await getAcademyForUser(req.user._id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy profile not found.' });
    }

    const opening = await AcademyOpening.findOne({ _id: req.params.id, academyId: academy._id });
    if (!opening) {
      return res.status(404).json({ error: 'Opening not found.' });
    }

    const newStatus = req.body.status ? String(req.body.status).toUpperCase() : (opening.status === 'OPEN' ? 'CLOSED' : 'OPEN');
    opening.status = newStatus;
    await opening.save();

    res.json(opening);
  } catch (err) {
    console.error('Error updating opening status:', err);
    res.status(500).json({ error: 'Failed to update opening status: ' + err.message });
  }
});

/**
 * DELETE /api/academy/my/openings/:id
 * Delete an opening
 */
router.delete('/my/openings/:id', verifyToken, requireRoles('academy'), async (req, res) => {
  try {
    const academy = await getAcademyForUser(req.user._id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy profile not found.' });
    }

    await AcademyOpening.findOneAndDelete({ _id: req.params.id, academyId: academy._id });
    res.json({ success: true, message: 'Opening removed successfully.' });
  } catch (err) {
    console.error('Error deleting opening:', err);
    res.status(500).json({ error: 'Failed to delete opening: ' + err.message });
  }
});

/**
 * GET /api/academy/my/requests
 * Get all athlete and coach requests for this academy
 */
router.get('/my/requests', verifyToken, requireRoles('academy'), async (req, res) => {
  try {
    const academy = await getAcademyForUser(req.user._id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy profile not found.' });
    }

    const rawAthleteRequests = await AcademyAthleteRequest.find({ academyId: academy._id })
      .populate('athleteUserId', '-passwordHash -aadhaarHash -resetPasswordOTP -resetPasswordToken')
      .sort({ createdAt: -1 });

    const athleteRequests = rawAthleteRequests.map(r => {
      const obj = r.toObject();
      if (obj.athleteUserId) {
        obj.athleteUserId = serializeAthleteProfile(obj.athleteUserId, 'academy', true);
      }
      return obj;
    });

    const rawCoachRequests = await AcademyCoachRequest.find({ academyId: academy._id })
      .populate('coachUserId', '-passwordHash -aadhaarHash -resetPasswordOTP -resetPasswordToken')
      .populate('openingId', 'position sportName location salary')
      .sort({ createdAt: -1 });

    const coachRequests = rawCoachRequests.map(c => {
      const obj = c.toObject();
      if (obj.coachUserId) {
        obj.coachUserId = serializeCoachProfile(obj.coachUserId, 'academy');
      }
      return obj;
    });

    res.json({
      athleteRequests,
      coachRequests
    });
  } catch (err) {
    console.error('Error fetching requests:', err);
    res.status(500).json({ error: 'Failed to fetch requests: ' + err.message });
  }
});

/**
 * POST /api/academy/my/athlete-requests/:id/accept
 * Accept athlete join request and create sport membership
 */
router.post('/my/athlete-requests/:id/accept', verifyToken, requireRoles('academy'), async (req, res) => {
  try {
    const academy = await getAcademyForUser(req.user._id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy profile not found.' });
    }

    const request = await AcademyAthleteRequest.findOne({
      _id: req.params.id,
      academyId: academy._id
    });

    if (!request) {
      return res.status(404).json({ error: 'Athlete request not found.' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: `Request already marked as ${request.status}.` });
    }

    request.status = 'ACCEPTED';
    await request.save();

    // Ensure sport is listed in academy
    if (!academy.sports.some(s => s.sportName === request.sportName)) {
      academy.sports.push({ sportName: request.sportName, addedAt: new Date() });
      await academy.save();
    }

    // Create or update membership without duplicate
    const matchQuery = {
      academyId: academy._id,
      sportName: request.sportName,
      $or: [
        ...(request.athleteUserId ? [{ athleteUserId: request.athleteUserId }] : []),
        ...(request.athleteId ? [{ athleteId: request.athleteId }] : []),
        { name: request.name, mobile: request.mobile }
      ]
    };
    let membership = await AcademyAthleteMembership.findOne(matchQuery);

    if (membership) {
      membership.status = 'ACTIVE';
      membership.membershipSource = 'ONLINE';
      membership.joinedAt = new Date();
      membership.negotiatedPayment = request.joiningPayment || 'Negotiated During Joining';
      membership.requestId = request._id;
      if (request.athleteUserId && !membership.athleteUserId) membership.athleteUserId = request.athleteUserId;
      if (request.athleteId && !membership.athleteId) membership.athleteId = request.athleteId;
      await membership.save();
    } else {
      membership = await AcademyAthleteMembership.create({
        academyId: academy._id,
        sportName: request.sportName,
        athleteUserId: request.athleteUserId,
        athleteId: request.athleteId || null,
        name: request.name,
        mobile: request.mobile,
        membershipSource: 'ONLINE',
        status: 'ACTIVE',
        joinedAt: new Date(),
        negotiatedPayment: request.joiningPayment || 'Negotiated During Joining',
        requestId: request._id
      });
    }

    const resMembership = membership.toObject();
    delete resMembership.aadhaarHash;

    res.json({
      success: true,
      message: 'Athlete join request accepted.',
      membership: resMembership
    });
  } catch (err) {
    console.error('Error accepting athlete request:', err);
    res.status(500).json({ error: 'Failed to accept athlete request: ' + err.message });
  }
});

/**
 * POST /api/academy/my/athlete-requests/:id/reject
 * Reject athlete join request
 */
router.post('/my/athlete-requests/:id/reject', verifyToken, requireRoles('academy'), async (req, res) => {
  try {
    const academy = await getAcademyForUser(req.user._id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy profile not found.' });
    }

    const request = await AcademyAthleteRequest.findOne({
      _id: req.params.id,
      academyId: academy._id
    });

    if (!request) {
      return res.status(404).json({ error: 'Athlete request not found.' });
    }

    request.status = 'REJECTED';
    await request.save();

    res.json({ success: true, message: 'Athlete request rejected.' });
  } catch (err) {
    console.error('Error rejecting athlete request:', err);
    res.status(500).json({ error: 'Failed to reject athlete request: ' + err.message });
  }
});

/**
 * POST /api/academy/my/coach-requests/:id/accept
 * Accept coach application and assign to sport
 */
router.post('/my/coach-requests/:id/accept', verifyToken, requireRoles('academy'), async (req, res) => {
  try {
    const academy = await getAcademyForUser(req.user._id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy profile not found.' });
    }

    const request = await AcademyCoachRequest.findOne({
      _id: req.params.id,
      academyId: academy._id
    });

    if (!request) {
      return res.status(404).json({ error: 'Coach request not found.' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: `Request already marked as ${request.status}.` });
    }

    request.status = 'ACCEPTED';
    await request.save();

    // Ensure sport is listed in academy
    if (!academy.sports.some(s => s.sportName === request.sportName)) {
      academy.sports.push({ sportName: request.sportName, addedAt: new Date() });
      await academy.save();
    }

    // Create or update coach assignment without duplicate
    const coachMatchQuery = {
      academyId: academy._id,
      sportName: request.sportName,
      $or: [
        ...(request.coachUserId ? [{ coachUserId: request.coachUserId }] : []),
        ...(request.coachId ? [{ coachId: request.coachId }] : []),
        { name: request.name }
      ]
    };
    let assignment = await AcademyCoachAssignment.findOne(coachMatchQuery);

    if (assignment) {
      assignment.status = 'ACTIVE';
      if (request.nisId) assignment.nisId = request.nisId;
      if (request.certificateData) assignment.certificateData = request.certificateData;
      if (request.certificateFileName) assignment.certificateFileName = request.certificateFileName;
      if (request.coachUserId && !assignment.coachUserId) assignment.coachUserId = request.coachUserId;
      if (request.coachId && !assignment.coachId) assignment.coachId = request.coachId;
      await assignment.save();
    } else {
      assignment = await AcademyCoachAssignment.create({
        academyId: academy._id,
        sportName: request.sportName,
        coachUserId: request.coachUserId,
        coachId: request.coachId || null,
        name: request.name,
        nisId: request.nisId || null,
        certificateData: request.certificateData || null,
        certificateFileName: request.certificateFileName || `${request.name}_Certificate.pdf`,
        isOffline: !request.coachUserId,
        role: 'Coach',
        status: 'ACTIVE'
      });
    }

    const resAssignment = assignment.toObject();
    delete resAssignment.aadhaarHash;

    res.json({
      success: true,
      message: 'Coach application accepted.',
      assignment: resAssignment
    });
  } catch (err) {
    console.error('Error accepting coach request:', err);
    res.status(500).json({ error: 'Failed to accept coach request: ' + err.message });
  }
});

/**
 * POST /api/academy/my/coach-requests/:id/reject
 * Reject coach application
 */
router.post('/my/coach-requests/:id/reject', verifyToken, requireRoles('academy'), async (req, res) => {
  try {
    const academy = await getAcademyForUser(req.user._id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy profile not found.' });
    }

    const request = await AcademyCoachRequest.findOne({
      _id: req.params.id,
      academyId: academy._id
    });

    if (!request) {
      return res.status(404).json({ error: 'Coach request not found.' });
    }

    request.status = 'REJECTED';
    await request.save();

    res.json({ success: true, message: 'Coach application rejected.' });
  } catch (err) {
    console.error('Error rejecting coach request:', err);
    res.status(500).json({ error: 'Failed to reject coach request: ' + err.message });
  }
});

/**
 * GET /api/academy/athletes/:athleteUserId/full-portfolio
 * Retrieve complete real TrackAthlete portfolio for academy review prior to accept/reject
 */
router.get('/athletes/:athleteUserId/full-portfolio', verifyToken, requireRoles('academy'), async (req, res) => {
  try {
    const academy = await getAcademyForUser(req.user._id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy profile not found.' });
    }

    const athleteUser = await User.findById(req.params.athleteUserId).select('-passwordHash -resetPasswordOTP -aadhaarHash');
    if (!athleteUser) {
      return res.status(404).json({ error: 'Athlete profile not found.' });
    }

    // Verify relationship: Athlete must have a request or active membership with this academy
    const hasRelationship = await AcademyAthleteRequest.exists({
      academyId: academy._id,
      $or: [
        { athleteUserId: athleteUser._id },
        ...(athleteUser.athleteId ? [{ athleteId: athleteUser.athleteId }] : [])
      ]
    }) || await AcademyAthleteMembership.exists({
      academyId: academy._id,
      $or: [
        { athleteUserId: athleteUser._id },
        ...(athleteUser.athleteId ? [{ athleteId: athleteUser.athleteId }] : [])
      ]
    });

    if (!hasRelationship) {
      return res.status(403).json({ error: 'Unauthorized: Athlete has no active request or membership with this academy.' });
    }

    const matchCriteria = [{ athleteUserId: athleteUser._id }];
    if (athleteUser.athleteId) {
      matchCriteria.push({ athleteId: athleteUser.athleteId });
    }

    const orgCriteria = [{ athlete: athleteUser._id }];
    if (athleteUser.athleteId) {
      orgCriteria.push({ athleteId: athleteUser.athleteId });
    }

    const federationAchievements = await OfficialAchievement.find({
      $or: matchCriteria,
      verificationStatus: { $in: ['FROZEN', 'VERIFIED'] }
    })
      .select('-aadhaarHash -athleteIdentityReference')
      .populate('federation', 'name federationId sport state officialEmail')
      .populate('event', 'eventName eventId tournamentDate location submissionDeadline isFrozen competitionLevel')
      .sort({ createdAt: -1 });

    const organizerAchievements = await OrganizerAchievement.find({
      $or: orgCriteria
    })
      .populate('organizer', 'name organizationName organizerId mobile email officialAddress')
      .populate('event', 'eventName eventDate venue sports competitionLevel')
      .sort({ createdAt: -1 });

    const unifiedAchievements = serializeUnifiedAchievements(
      federationAchievements,
      organizerAchievements,
      athleteUser.tournaments || [],
      athleteUser.name
    );

    res.json({
      athlete: serializeAthleteProfile(athleteUser, 'academy', true),
      federationAchievements,
      organizerAchievements,
      selfUploadedAchievements: athleteUser.tournaments || [],
      tournaments: athleteUser.tournaments || [],
      unifiedAchievements
    });
  } catch (err) {
    console.error('Error fetching athlete full portfolio:', err);
    res.status(500).json({ error: 'Failed to fetch athlete portfolio: ' + err.message });
  }
});

/**
 * GET /api/academy/coaches/:coachUserId/full-profile
 * Retrieve complete coach profile for academy review prior to accept/reject
 */
router.get('/coaches/:coachUserId/full-profile', verifyToken, requireRoles('academy'), async (req, res) => {
  try {
    const academy = await getAcademyForUser(req.user._id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy profile not found.' });
    }

    const coachUser = await User.findById(req.params.coachUserId);
    if (!coachUser) {
      return res.status(404).json({ error: 'Coach profile not found.' });
    }

    // Verify relationship: Coach must have an application or assignment with this academy
    const hasRelationship = await AcademyCoachRequest.exists({
      academyId: academy._id,
      $or: [
        { coachUserId: coachUser._id },
        ...(coachUser.coachId ? [{ coachId: coachUser.coachId }] : [])
      ]
    }) || await AcademyCoachAssignment.exists({
      academyId: academy._id,
      $or: [
        { coachUserId: coachUser._id },
        ...(coachUser.coachId ? [{ coachId: coachUser.coachId }] : [])
      ]
    });

    if (!hasRelationship) {
      return res.status(403).json({ error: 'Unauthorized: Coach has no application or assignment with this academy.' });
    }

    res.json({
      coach: serializeCoachProfile(coachUser, 'academy')
    });
  } catch (err) {
    console.error('Error fetching coach full profile:', err);
    res.status(500).json({ error: 'Failed to fetch coach profile: ' + err.message });
  }
});

/* ==========================================================================
   PUBLIC & ATHLETE / COACH DISCOVERY & INTERACTION ROUTES
   ========================================================================== */

/**
 * GET /api/academy/discovery
 * Discover academies filtered by sport, city, search term, or coordinates
 */
router.get('/discovery', async (req, res) => {
  try {
    const { sport, sports, city, search, lat, lng } = req.query;
    const filter = {};

    const rawSports = sports || sport;
    if (rawSports && String(rawSports).trim()) {
      const sportItems = Array.isArray(rawSports) ? rawSports : String(rawSports).split(',');
      const cleanSportItems = sportItems.map(s => String(s).trim()).filter(Boolean);
      if (cleanSportItems.length > 0) {
        const regexes = cleanSportItems.map(s => new RegExp('^' + s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i'));
        filter['sports.sportName'] = { $in: regexes };
      }
    }

    if (city && String(city).trim()) {
      filter.city = new RegExp('^' + String(city).trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i');
    }

    if (search && String(search).trim()) {
      const cleanSearch = String(search).trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      filter.$or = [
        { name: new RegExp(cleanSearch, 'i') },
        { city: new RegExp(cleanSearch, 'i') },
        { 'address.city': new RegExp(cleanSearch, 'i') },
        ...(sport ? [] : [{ 'sports.sportName': new RegExp(cleanSearch, 'i') }])
      ];
    }

    let academies = await Academy.find(filter)
      .select('academyId name contactPhone email address city state location sports rankingStats verified createdAt')
      .sort({ createdAt: -1 });

    // If client supplied user's coordinates, compute distance
    if (lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
      const uLat = Number(lat);
      const uLng = Number(lng);

      academies = academies.map(a => {
        const doc = a.toObject();
        if (doc.location?.coordinates?.length === 2) {
          const aLng = doc.location.coordinates[0];
          const aLat = doc.location.coordinates[1];
          // Haversine distance in km
          const R = 6371;
          const dLat = (aLat - uLat) * Math.PI / 180;
          const dLon = (aLng - uLng) * Math.PI / 180;
          const lat1 = uLat * Math.PI / 180;
          const lat2 = aLat * Math.PI / 180;
          const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
          const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
          doc.distanceKm = Math.round(R * c * 10) / 10;
        }
        return doc;
      }).sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
    }

    const serialized = academies.map(a => serializeAcademyProfile(a, 'public'));
    res.json(serialized);
  } catch (err) {
    console.error('Error discovering academies:', err);
    res.status(500).json({ error: 'Failed to discover academies: ' + err.message });
  }
});

/**
 * GET /api/academy/:academyId
 * Authoritative Academy profile with per-sport achievement levels (Rules 37, 39, 40, 41)
 */
router.get('/:academyId', async (req, res) => {
  try {
    const searchId = req.params.academyId;
    const isObjectId = typeof searchId === 'string' && searchId.match(/^[0-9a-fA-F]{24}$/);
    const academy = await Academy.findOne({
      $or: [
        { academyId: searchId },
        ...(isObjectId ? [{ _id: searchId }] : [])
      ]
    });
    if (!academy) {
      return res.status(404).json({ error: 'Academy not found.' });
    }

    const { getAcademyPerSportAchievementLevels } = require('../utils/recommendationEngine');
    const { overallLevel, perSport } = await getAcademyPerSportAchievementLevels(academy);

    const serialized = serializeAcademyProfile(academy, req.user?.role || 'public');
    serialized.achievementLevel = overallLevel;
    serialized.achievementLevelLabel = overallLevel !== 'UNRANKED' ? `Achievement Level: ${overallLevel}` : 'Achievement Level: UNRANKED';
    serialized.perSportLevels = perSport;

    res.json(serialized);
  } catch (err) {
    console.error('Error fetching academy profile:', err);
    res.status(500).json({ error: 'Failed to fetch academy profile: ' + err.message });
  }
});

/**
 * POST /api/academy/:academyId/request-join
 * Athlete sends a join request to an academy
 */
router.post('/:academyId/request-join', verifyToken, requireRoles('athlete'), async (req, res) => {
  try {
    const academy = await Academy.findById(req.params.academyId);
    if (!academy) {
      return res.status(404).json({ error: 'Academy not found.' });
    }

    const { sportName, joiningPayment } = req.body;
    const requestedSport = sportName ? String(sportName).trim().toUpperCase() : (req.user.sport ? String(req.user.sport).trim().toUpperCase() : null);

    if (!requestedSport) {
      return res.status(400).json({ error: 'Please specify the sport you are requesting to join.' });
    }

    // Check duplicate pending request
    const existingPending = await AcademyAthleteRequest.findOne({
      academyId: academy._id,
      athleteUserId: req.user._id,
      status: 'PENDING'
    });

    if (existingPending) {
      return res.status(400).json({ error: 'You already have a pending join request with this academy.' });
    }

    const request = await AcademyAthleteRequest.create({
      academyId: academy._id,
      athleteUserId: req.user._id,
      athleteId: req.user.athleteId || null,
      name: req.user.name,
      mobile: req.user.phone || req.user.mobile || '—',
      sportName: requestedSport,
      joiningPayment: joiningPayment ? String(joiningPayment).trim() : 'Negotiated During Joining',
      status: 'PENDING'
    });

    res.status(201).json({
      success: true,
      message: 'Join request submitted to academy successfully.',
      request
    });
  } catch (err) {
    console.error('Error submitting join request:', err);
    res.status(500).json({ error: 'Failed to submit join request: ' + err.message });
  }
});

/**
 * GET /api/academy/openings/discovery
 * Coach discovers openings matching their sport
 */
router.get('/openings/discovery', verifyToken, requireRoles('coach'), async (req, res) => {
  try {
    // Respect coach's academy preference
    if (req.user.willingToWorkWithAcademies === false) {
      return res.json([]);
    }

    const { sport } = req.query;
    const filter = { status: 'OPEN' };

    const coachSports = Array.isArray(req.user.sports) && req.user.sports.length > 0
      ? req.user.sports
      : (req.user.sport ? [req.user.sport] : []);

    if (sport) {
      filter.sportName = new RegExp('^' + String(sport).trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i');
    } else if (coachSports.length > 0) {
      filter.$or = coachSports.map(sp => ({
        sportName: new RegExp('^' + String(sp).trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i')
      }));
    }

    const openings = await AcademyOpening.find(filter)
      .populate('academyId', 'name contactPhone email address city state location rankingStats')
      .sort({ createdAt: -1 });

    res.json(openings);
  } catch (err) {
    console.error('Error discovering openings:', err);
    res.status(500).json({ error: 'Failed to discover openings: ' + err.message });
  }
});

/**
 * POST /api/academy/openings/:openingId/apply
 * Coach applies to a specific opening
 */
router.post('/openings/:openingId/apply', verifyToken, requireRoles('coach'), async (req, res) => {
  try {
    const opening = await AcademyOpening.findById(req.params.openingId);
    if (!opening) {
      return res.status(404).json({ error: 'Opening not found.' });
    }

    if (opening.status !== 'OPEN') {
      return res.status(400).json({ error: 'This opening is no longer active.' });
    }

    // Check duplicate pending application
    const existing = await AcademyCoachRequest.findOne({
      openingId: opening._id,
      coachUserId: req.user._id,
      status: 'PENDING'
    });

    if (existing) {
      return res.status(400).json({ error: 'You have already applied for this opening.' });
    }

    const { certificateData, certificateFileName, salary } = req.body;

    const request = await AcademyCoachRequest.create({
      academyId: opening.academyId,
      openingId: opening._id,
      coachUserId: req.user._id,
      coachId: req.user.coachId || null,
      name: req.user.name,
      nisId: req.user.nisId || null,
      sportName: opening.sportName,
      certificateData: certificateData || null,
      certificateFileName: certificateFileName || `${req.user.name}_Certificate.pdf`,
      salary: salary ? String(salary).trim() : (opening.salary || 'Negotiated During Joining'),
      status: 'PENDING'
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully.',
      request
    });
  } catch (err) {
    console.error('Error applying to opening:', err);
    res.status(500).json({ error: 'Failed to apply to opening: ' + err.message });
  }
});

/**
 * GET /api/academy/my/athlete-status
 * Athlete retrieves their academy memberships and requests
 */
router.get('/my/athlete-status', verifyToken, requireRoles('athlete'), async (req, res) => {
  try {
    const memberships = await AcademyAthleteMembership.find({ athleteUserId: req.user._id })
      .populate('academyId', 'name city state contactPhone address')
      .sort({ joinedAt: -1 });

    const requests = await AcademyAthleteRequest.find({ athleteUserId: req.user._id })
      .populate('academyId', 'name city state contactPhone address')
      .sort({ createdAt: -1 });

    res.json({
      memberships,
      requests
    });
  } catch (err) {
    console.error('Error fetching athlete status:', err);
    res.status(500).json({ error: 'Failed to fetch status: ' + err.message });
  }
});

/**
 * GET /api/academy/my/coach-status
 * Coach retrieves their academy assignments and applications
 */
router.get('/my/coach-status', verifyToken, requireRoles('coach'), async (req, res) => {
  try {
    const assignments = await AcademyCoachAssignment.find({ coachUserId: req.user._id })
      .populate('academyId', 'name city state contactPhone address')
      .sort({ createdAt: -1 });

    const applications = await AcademyCoachRequest.find({ coachUserId: req.user._id })
      .populate('academyId', 'name city state contactPhone address')
      .populate('openingId', 'position sportName location')
      .sort({ createdAt: -1 });

    res.json({
      assignments,
      applications
    });
  } catch (err) {
    console.error('Error fetching coach status:', err);
    res.status(500).json({ error: 'Failed to fetch status: ' + err.message });
  }
});

module.exports = router;
