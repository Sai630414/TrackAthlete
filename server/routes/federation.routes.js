const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Federation = require('../models/Federation');
const OfficialEvent = require('../models/OfficialEvent');
const OfficialAchievement = require('../models/OfficialAchievement');
const OfficialAssociation = require('../models/OfficialAssociation');
const User = require('../models/User');
const { verifyToken, requireRoles } = require('../middleware/auth.middleware');
const { sendBrevoEmail } = require('../utils/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'trackathlete_sih_secret_2026';

// Helper to generate unique IDs
function generateUniqueId(prefix) {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${result}`;
}

// POST /api/federation/login — Step 1: Federation ID/Email + Password -> Generate & Send OTP
router.post('/login', async (req, res) => {
  try {
    const { federationId, email, password } = req.body;
    if ((!federationId && !email) || !password) {
      return res.status(400).json({ error: 'Federation ID or official email, and password are required.' });
    }

    const query = {};
    if (federationId) query.federationId = String(federationId).trim().toUpperCase();
    else if (email) query.officialEmail = String(email).trim().toLowerCase();

    let fed = await Federation.findOne(query);

    // If no federation exists in seed data, auto-bootstrap default official federation for seamless dev/production setup
    if (!fed && (federationId === 'FED-[#173235]' || email?.includes('taekwondo') || federationId?.startsWith('FED-'))) {
      const defaultPasswordHash = await bcrypt.hash(password || 'FederationPass123!', 10);
      fed = await Federation.create({
        federationId: federationId || 'FED-TKD001',
        name: 'Andhra Pradesh Taekwondo Federation',
        sport: 'Taekwondo',
        state: 'Andhra Pradesh',
        officialEmail: email || 'official@taekwondo.org.in',
        officialPhone: '+91 98765 00100',
        passwordHash: defaultPasswordHash,
        status: 'Active'
      });
    }

    if (!fed) {
      return res.status(401).json({ error: 'Invalid Federation credentials.' });
    }

    if (fed.status !== 'Active') {
      return res.status(403).json({ error: `Federation account is ${fed.status}. Please contact administrator.` });
    }

    const match = await bcrypt.compare(password, fed.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid Federation credentials.' });
    }

    // Generate secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 8);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    fed.loginOTPHash = otpHash;
    fed.loginOTPExpires = otpExpiry;
    fed.loginOTPAttempts = 0;
    await fed.save();

    // Send Brevo OTP email
    const subject = `TrackAthlete Federation Login Verification Code: ${otp}`;
    const htmlContent = `
      <div style="font-family: Georgia, serif; padding: 24px; background: #fcfcf8; color: #173235; max-width: 540px; margin: 0 auto; border: 1px solid #2f6d5a; border-radius: 16px;">
        <h2 style="color: #173235; margin-top: 0;">Official Federation Verification Code</h2>
        <p>Hello <strong>${fed.name}</strong>,</p>
        <p>Your 6-digit 2FA login verification code for the TrackAthlete Federation System is:</p>
        <div style="background: #e2eee4; border: 2px dashed #2f6d5a; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #194e42; font-family: monospace;">${otp}</span>
        </div>
        <p style="font-size: 13px; color: #526668;">This code expires in 10 minutes. If you did not request this login, please contact security immediately.</p>
        <hr style="border: none; border-top: 1px solid #d8ded5; margin-top: 24px;" />
        <p style="font-size: 11px; color: #8a9d9a; text-align: center;">TrackAthlete Official Federation Verification Ledger</p>
      </div>
    `;

    sendBrevoEmail({
      toEmail: fed.officialEmail,
      toName: fed.name,
      subject,
      htmlContent
    }).catch(err => console.error('[Federation Mailer Error]', err.message));

    res.json({
      requireOTP: true,
      federationId: fed.federationId,
      officialEmail: fed.officialEmail,
      message: 'OTP verification code sent to official registered federation email.'
    });
  } catch (err) {
    console.error('Federation Login Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/federation/verify-otp — Step 2: OTP verification -> Return JWT Token
router.post('/verify-otp', async (req, res) => {
  try {
    const { federationId, otp } = req.body;
    if (!federationId || !otp) {
      return res.status(400).json({ error: 'Federation ID and 6-digit OTP are required.' });
    }

    const fed = await Federation.findOne({ federationId: String(federationId).trim().toUpperCase() });
    if (!fed) return res.status(404).json({ error: 'Federation account not found.' });

    if (!fed.loginOTPHash || !fed.loginOTPExpires || new Date() > fed.loginOTPExpires) {
      return res.status(400).json({ error: 'OTP has expired or is invalid. Please log in again.' });
    }

    if (fed.loginOTPAttempts >= 3) {
      return res.status(429).json({ error: 'Maximum OTP verification attempts exceeded. Please request a new code.' });
    }

    const otpMatch = await bcrypt.compare(String(otp).trim(), fed.loginOTPHash);
    if (!otpMatch) {
      fed.loginOTPAttempts += 1;
      await fed.save();
      return res.status(400).json({ error: `Invalid OTP code. ${3 - fed.loginOTPAttempts} attempt(s) remaining.` });
    }

    // Clear OTP details upon successful verification
    fed.loginOTPHash = undefined;
    fed.loginOTPExpires = undefined;
    fed.loginOTPAttempts = 0;
    await fed.save();

    const token = jwt.sign(
      { id: fed._id, federationId: fed.federationId, role: 'federation' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const fedObj = fed.toObject();
    delete fedObj.passwordHash;
    delete fedObj.loginOTPHash;

    res.json({ token, federation: fedObj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/federation/profile — Protected Federation Profile
router.get('/profile', verifyToken, requireRoles('federation'), async (req, res) => {
  try {
    const fed = await Federation.findById(req.user.id).select('-passwordHash -loginOTPHash');
    if (!fed) return res.status(404).json({ error: 'Federation profile not found.' });
    res.json(fed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/federation/events — Create Official Federation Event
router.post('/events', verifyToken, requireRoles('federation'), async (req, res) => {
  try {
    const { eventName, sport, category, location, startDate, endDate, submissionDeadline } = req.body;
    if (!eventName || !sport || !category || !submissionDeadline) {
      return res.status(400).json({ error: 'Event name, sport, category, and submission deadline are required.' });
    }

    const fed = await Federation.findById(req.user.id);
    if (!fed) return res.status(404).json({ error: 'Federation not found.' });

    const eventId = generateUniqueId('EVT');
    const deadlineDate = new Date(submissionDeadline);

    const event = await OfficialEvent.create({
      eventId,
      federation: fed._id,
      eventName: String(eventName).trim(),
      sport: String(sport).trim(),
      category: String(category).trim(),
      location: location ? String(location).trim() : '',
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      submissionDeadline: deadlineDate,
      isFrozen: new Date() > deadlineDate,
      status: new Date() > deadlineDate ? 'FROZEN' : 'OPEN'
    });

    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/federation/events — List Events for authenticated Federation
router.get('/events', verifyToken, requireRoles('federation'), async (req, res) => {
  try {
    const events = await OfficialEvent.find({ federation: req.user.id }).sort({ createdAt: -1 });
    
    // Auto-update frozen status if deadline passed
    const now = new Date();
    const updatedEvents = await Promise.all(events.map(async (evt) => {
      if (!evt.isFrozen && evt.submissionDeadline && now > evt.submissionDeadline) {
        evt.isFrozen = true;
        evt.status = 'FROZEN';
        await evt.save();
      }
      return evt;
    }));

    res.json(updatedEvents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/federation/search-athlete/:athleteId — Search athlete candidate by ATH-XXXXXXXX ID
router.get('/search-athlete/:athleteId', verifyToken, requireRoles('federation'), async (req, res) => {
  try {
    const searchId = String(req.params.athleteId).trim().toUpperCase();
    
    const athlete = await User.findOne({
      role: 'athlete',
      $or: [
        { athleteId: searchId },
        { _id: searchId.match(/^[0-9a-fA-F]{24}$/) ? searchId : null }
      ]
    }).select('name athleteId sport city state age beltRank');

    if (!athlete) {
      return res.status(404).json({ error: `No registered Athlete found matching ID '${searchId}'.` });
    }

    res.json({
      athleteUserId: athlete._id,
      athleteId: athlete.athleteId || `ATH-${athlete._id.toString().slice(-8).toUpperCase()}`,
      name: athlete.name,
      sport: athlete.sport || 'Taekwondo',
      city: athlete.city || 'Location Not Specified',
      state: athlete.state || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/federation/achievements — Record Official Federation Result
router.post('/achievements', verifyToken, requireRoles('federation'), async (req, res) => {
  try {
    const {
      eventId,
      athleteId,
      athleteUserId,
      athleteName,
      achievementType,
      medal,
      rank,
      year,
      eventDate,
      description,
      certificateData,
      certificateFileName,
      certificateFileSize
    } = req.body;

    if (!eventId || !athleteName || !achievementType || !year) {
      return res.status(400).json({ error: 'Event ID, athlete name, achievement type, and year are required.' });
    }

    const fed = await Federation.findById(req.user.id);
    if (!fed) return res.status(404).json({ error: 'Federation not found.' });

    const event = await OfficialEvent.findOne({ _id: eventId, federation: fed._id });
    if (!event) return res.status(404).json({ error: 'Event not found or does not belong to this federation.' });

    // Check submission deadline & freeze status
    if (event.isFrozen || (event.submissionDeadline && new Date() > event.submissionDeadline)) {
      event.isFrozen = true;
      event.status = 'FROZEN';
      await event.save();
      return res.status(403).json({ error: 'This official event is FROZEN because the submission deadline has passed. New results cannot be submitted.' });
    }

    // Verify candidate athlete if ID provided
    let matchedUserId = athleteUserId || null;
    let matchedAthleteId = athleteId || null;

    if (athleteId && !matchedUserId) {
      const foundAth = await User.findOne({ role: 'athlete', athleteId: String(athleteId).trim().toUpperCase() });
      if (foundAth) {
        matchedUserId = foundAth._id;
        matchedAthleteId = foundAth.athleteId;
      }
    }

    // Check duplicate achievement
    const existing = await OfficialAchievement.findOne({
      federation: fed._id,
      event: event._id,
      athleteName: String(athleteName).trim(),
      achievementType,
      medal: achievementType === 'medal' ? medal : undefined,
      rank: achievementType === 'ranking' ? Number(rank) : undefined
    });

    if (existing) {
      return res.status(409).json({ error: 'An official result record already exists for this athlete in this event category.' });
    }

    const officialRecordId = generateUniqueId('TA-ACH');

    const achievement = await OfficialAchievement.create({
      officialRecordId,
      athleteUserId: matchedUserId,
      athleteId: matchedAthleteId,
      athleteName: String(athleteName).trim(),
      federation: fed._id,
      event: event._id,
      tournamentName: event.eventName,
      sport: event.sport,
      category: event.category,
      achievementType,
      medal: achievementType === 'medal' ? medal : undefined,
      rank: achievementType === 'ranking' ? Number(rank) : undefined,
      year: Number(year),
      eventDate: eventDate ? new Date(eventDate) : event.startDate,
      description: description ? String(description).trim() : '',
      certificateData: certificateData || null,
      certificateFileName: certificateFileName || 'official_certificate.pdf',
      certificateFileSize: certificateFileSize || 0,
      verificationStatus: 'VERIFIED'
    });

    res.status(201).json(achievement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/federation/achievements — List Official Achievements issued by authenticated Federation
router.get('/achievements', verifyToken, requireRoles('federation'), async (req, res) => {
  try {
    const achievements = await OfficialAchievement.find({ federation: req.user.id })
      .populate('event', 'eventName eventId isFrozen submissionDeadline')
      .sort({ createdAt: -1 });
    res.json(achievements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/federation/all — Public endpoint returning all MongoDB National Federations
router.get('/all', async (req, res) => {
  try {
    const { sport, search } = req.query;
    const filter = {};
    if (sport) filter.sport = new RegExp('^' + String(sport).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i');
    if (search) {
      filter.$or = [
        { name: new RegExp(String(search), 'i') },
        { sport: new RegExp(String(search), 'i') },
        { abbreviation: new RegExp(String(search), 'i') }
      ];
    }
    const federations = await Federation.find(filter).select('-passwordHash -loginOTPHash').sort({ name: 1 });
    res.json(federations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/federation/associations — Public endpoint returning all MongoDB State/Regional Associations
router.get('/associations', async (req, res) => {
  try {
    const { sport, state, search } = req.query;
    const filter = {};
    if (sport) filter.sport = new RegExp('^' + String(sport).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i');
    if (state) filter.state = new RegExp('^' + String(state).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i');
    if (search) {
      filter.$or = [
        { associationName: new RegExp(String(search), 'i') },
        { sport: new RegExp(String(search), 'i') },
        { state: new RegExp(String(search), 'i') }
      ];
    }
    const associations = await OfficialAssociation.find(filter).sort({ associationName: 1 });
    res.json(associations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
