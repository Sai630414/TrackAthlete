const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Federation = require('../models/Federation');
const OfficialEvent = require('../models/OfficialEvent');
const OfficialAchievement = require('../models/OfficialAchievement');
const OfficialAssociation = require('../models/OfficialAssociation');
const { hashAadhaar, normalizeAadhaar, withoutAadhaar } = require('../utils/aadhaar');
const User = require('../models/User');
const { verifyToken, requireRoles } = require('../middleware/auth.middleware');
const { sendBrevoEmail } = require('../utils/mailer');
const { resolveCompetitionLevel } = require('../utils/academyRanking');
const { generateAthleteRecommendations } = require('../utils/recommendationEngine');

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

// Helper to mask official email for security
function maskEmail(email) {
  if (!email || !email.includes('@')) return 'offi***@sports.gov.in';
  const [local, domain] = email.split('@');
  const visible = local.slice(0, 3);
  return `${visible}***@${domain}`;
}

// GET /api/federation/available — Dynamic MongoDB list of all imported National Federations
router.get('/available', async (req, res) => {
  try {
    const federations = await Federation.find({}).sort({ name: 1 });
    const formatted = federations.map(fed => ({
      _id: fed._id,
      federationId: fed.federationId,
      name: fed.name,
      sport: fed.sport,
      state: fed.state || 'National',
      abbreviation: fed.abbreviation || '',
      website: fed.website || '',
      recognitionStatus: fed.recognitionStatus || 'Recognized',
      recognitionYear: fed.recognitionYear || 2024,
      officialEmailMasked: maskEmail(fed.officialEmail),
      accountActivated: Boolean(fed.accountActivated || fed.passwordHash),
      status: fed.status || 'Active'
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/federation/send-activation-otp — Step 1 Activation: Send 6-digit OTP to official email
router.post('/send-activation-otp', async (req, res) => {
  try {
    const { federationId } = req.body;
    if (!federationId) {
      return res.status(400).json({ error: 'Federation ID is required.' });
    }

    const fed = await Federation.findOne({ federationId: String(federationId).trim().toUpperCase() });
    if (!fed) {
      return res.status(404).json({ error: 'Selected Federation record not found in MongoDB.' });
    }

    if (fed.accountActivated && fed.passwordHash) {
      return res.status(400).json({ error: 'This federation account is already activated. Please use Sign In.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 8);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    fed.activationOTPHash = otpHash;
    fed.activationOTPExpires = otpExpiry;
    fed.activationVerified = false;
    await fed.save();

    // Send Brevo Activation OTP Email
    const subject = `TrackAthlete Federation Activation Verification Code: ${otp}`;
    const htmlContent = `
      <div style="font-family: Georgia, serif; padding: 24px; background: #fcfcf8; color: #173235; max-width: 540px; margin: 0 auto; border: 1px solid #2f6d5a; border-radius: 16px;">
        <h2 style="color: #173235; margin-top: 0;">Official Federation Account Activation</h2>
        <p>Hello <strong>${fed.name}</strong> (${fed.federationId}),</p>
        <p>Your 6-digit activation verification code for the TrackAthlete Federation System is:</p>
        <div style="background: #e2eee4; border: 2px dashed #2f6d5a; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #194e42; font-family: monospace;">${otp}</span>
        </div>
        <p style="font-size: 13px; color: #526668;">This activation code expires in 10 minutes. If you did not initiate activation, please disregard this email.</p>
        <hr style="border: none; border-top: 1px solid #d8ded5; margin-top: 24px;" />
        <p style="font-size: 11px; color: #8a9d9a; text-align: center;">TrackAthlete Official Federation Verification System</p>
      </div>
    `;

    try {
      const mailResult = await sendBrevoEmail({
        toEmail: fed.officialEmail || 'official@sports.gov.in',
        toName: fed.name,
        subject,
        htmlContent
      });
      console.log('[Activation Mailer Accepted]', {
        federationId: fed.federationId,
        recipient: fed.officialEmail,
        statusCode: mailResult.statusCode,
        messageId: mailResult.data?.messageId
      });
    } catch (mailErr) {
      console.error('[Activation Mailer Error]', {
        federationId: fed.federationId,
        message: mailErr.message,
        statusCode: mailErr.statusCode,
        responseData: mailErr.responseData
      });
      return res.status(500).json({ error: `Failed to send activation email via Brevo: ${mailErr.message}` });
    }

    res.json({
      message: 'Activation OTP code sent to official registered email.',
      officialEmailMasked: maskEmail(fed.officialEmail),
      federationId: fed.federationId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/federation/verify-activation-otp — Step 2 Activation: Verify 6-digit OTP
router.post('/verify-activation-otp', async (req, res) => {
  try {
    const { federationId, otp } = req.body;
    if (!federationId || !otp) {
      return res.status(400).json({ error: 'Federation ID and 6-digit OTP code are required.' });
    }

    const fed = await Federation.findOne({ federationId: String(federationId).trim().toUpperCase() });
    if (!fed) return res.status(404).json({ error: 'Federation record not found.' });

    if (!fed.activationOTPHash || !fed.activationOTPExpires || new Date() > fed.activationOTPExpires) {
      return res.status(400).json({ error: 'Activation OTP code has expired. Please request a new code.' });
    }

    const match = await bcrypt.compare(String(otp).trim(), fed.activationOTPHash);
    if (!match) {
      return res.status(400).json({ error: 'Invalid activation OTP code.' });
    }

    fed.activationVerified = true;
    fed.activationOTPHash = undefined;
    fed.activationOTPExpires = undefined;
    await fed.save();

    res.json({
      message: 'Official email verified successfully. You may now create your password.',
      federationId: fed.federationId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/federation/activate-account — Step 3 Activation: Set Password & Activate Account
router.post('/activate-account', async (req, res) => {
  try {
    const { federationId, password, confirmPassword } = req.body;
    if (!federationId || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Federation ID, password, and confirm password are required.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const fed = await Federation.findOne({ federationId: String(federationId).trim().toUpperCase() });
    if (!fed) return res.status(404).json({ error: 'Federation record not found.' });

    if (fed.accountActivated && fed.passwordHash) {
      return res.status(400).json({ error: 'This federation account is already activated. Please use Sign In.' });
    }

    if (!fed.activationVerified) {
      return res.status(400).json({ error: 'Official email verification is required before setting password.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    fed.passwordHash = passwordHash;
    fed.accountActivated = true;
    fed.activationVerified = false;
    fed.status = 'Active';
    await fed.save();

    res.json({
      message: 'Federation account activated successfully.',
      federationId: fed.federationId,
      name: fed.name,
      sport: fed.sport
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/federation/login — Step 1 Login: Validate Credentials & Send 2FA OTP
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

    // Bootstrap default dev federation if requested
    if (!fed && (federationId === 'FED-[#173235]' || email?.includes('taekwondo') || federationId === 'FED-TKD001')) {
      const defaultPasswordHash = await bcrypt.hash(password || 'FederationPass123!', 10);
      fed = await Federation.create({
        federationId: 'FED-TKD001',
        name: 'Andhra Pradesh Taekwondo Federation',
        sport: 'Taekwondo',
        state: 'Andhra Pradesh',
        officialEmail: email || 'official@taekwondo.org.in',
        officialPhone: '+91 98765 00100',
        passwordHash: defaultPasswordHash,
        accountActivated: true,
        status: 'Active'
      });
    }

    if (!fed) {
      return res.status(401).json({ error: 'Invalid Federation credentials.' });
    }

    if (!fed.accountActivated || !fed.passwordHash) {
      return res.status(400).json({ error: 'This federation account is not yet activated. Please use the Create Federation Account tab to activate.' });
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

    try {
      const mailResult = await sendBrevoEmail({
        toEmail: fed.officialEmail || 'official@sports.gov.in',
        toName: fed.name,
        subject,
        htmlContent
      });
      console.log('[Login 2FA Mailer Accepted]', {
        federationId: fed.federationId,
        recipient: fed.officialEmail,
        statusCode: mailResult.statusCode,
        messageId: mailResult.data?.messageId
      });
    } catch (mailErr) {
      console.error('[Login 2FA Mailer Error]', {
        federationId: fed.federationId,
        message: mailErr.message,
        statusCode: mailErr.statusCode,
        responseData: mailErr.responseData
      });
      return res.status(500).json({ error: `Failed to send 2FA login email via Brevo: ${mailErr.message}` });
    }

    res.json({
      requireOTP: true,
      federationId: fed.federationId,
      officialEmail: maskEmail(fed.officialEmail),
      message: 'OTP verification code sent to official registered federation email.'
    });
  } catch (err) {
    console.error('Federation Login Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/federation/verify-otp — Step 2 Login: Verify OTP & Return JWT
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
    delete fedObj.activationOTPHash;

    res.json({ token, federation: fedObj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/federation/profile — Protected Federation Profile
router.get('/profile', verifyToken, requireRoles('federation'), async (req, res) => {
  try {
    const fed = await Federation.findById(req.user.id).select('-passwordHash -loginOTPHash -activationOTPHash');
    if (!fed) return res.status(404).json({ error: 'Federation profile not found.' });
    res.json(fed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/federation/events — Create Official Federation Event
router.post('/events', verifyToken, requireRoles('federation'), async (req, res) => {
  try {
    const { eventName, sport, category, location, tournamentDate, startDate, endDate, submissionDeadline, competitionLevel } = req.body;
    if (!eventName || !sport || !category || !tournamentDate || !submissionDeadline) {
      return res.status(400).json({ error: 'Event name, sport, category, tournament date, and submission deadline are required.' });
    }

    const fed = await Federation.findById(req.user.id);
    if (!fed) return res.status(404).json({ error: 'Federation not found.' });

    const eventId = generateUniqueId('EVT');
    const deadlineDate = new Date(submissionDeadline);
    const tourneyDate = new Date(tournamentDate);
    if (Number.isNaN(deadlineDate.getTime()) || Number.isNaN(tourneyDate.getTime())) {
      return res.status(400).json({ error: 'Tournament date and submission deadline must be valid dates.' });
    }

    const resolvedLevel = (competitionLevel && ['DISTRICT', 'STATE', 'NATIONAL', 'INTERNATIONAL'].includes(String(competitionLevel).trim().toUpperCase()))
      ? String(competitionLevel).trim().toUpperCase()
      : resolveCompetitionLevel({ eventName, category });

    const event = await OfficialEvent.create({
      eventId,
      federation: fed._id,
      federationName: fed.name,
      federationId: fed.federationId,
      eventName: String(eventName).trim(),
      sport: String(sport).trim(),
      category: String(category).trim(),
      competitionLevel: resolvedLevel || null,
      location: location ? String(location).trim() : '',
      tournamentDate: tourneyDate,
      startDate: startDate ? new Date(startDate) : tourneyDate,
      endDate: endDate ? new Date(endDate) : tourneyDate,
      submissionDeadline: deadlineDate,
      isFrozen: new Date() > deadlineDate,
      status: new Date() > deadlineDate ? 'FROZEN' : (tourneyDate >= new Date() ? 'UPCOMING' : 'OPEN')
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

// GET /api/federation/search-athlete/:athleteId — Search candidate athlete
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

// POST /api/federation/achievements — Record Official Federation Result & Freeze
router.post('/achievements', verifyToken, requireRoles('federation'), async (req, res) => {
  try {
    const {
      eventId,
      athleteId,
      athleteUserId,
      athleteName,
      winnerName,
      aadhaarNumber,
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

    const finalWinnerName = String(winnerName || athleteName || '').trim();
    if (!eventId || !finalWinnerName || !achievementType) {
      return res.status(400).json({ error: 'Event ID, winner name, and achievement type are required.' });
    }

    const fed = await Federation.findById(req.user.id);
    if (!fed) return res.status(404).json({ error: 'Federation not found.' });

    const event = await OfficialEvent.findOne({ _id: eventId, federation: fed._id });
    if (!event) return res.status(404).json({ error: 'Event not found or does not belong to this federation.' });
    if (event.isFrozen || (event.submissionDeadline && new Date() > event.submissionDeadline)) {
      return res.status(409).json({ error: 'Result submission is locked for this event.' });
    }

    if (!aadhaarNumber || normalizeAadhaar(aadhaarNumber).length !== 12) {
      return res.status(400).json({ error: 'A valid 12-digit Aadhaar number is required for private athlete matching.' });
    }
    if (!certificateData || !certificateFileName || !String(certificateData).startsWith('data:application/pdf;base64,')) {
      return res.status(400).json({ error: 'A signed official certificate PDF is required.' });
    }
    if (Number(certificateFileSize) <= 0 || Number(certificateFileSize) > 1024 * 1024) {
      return res.status(400).json({ error: 'Certificate PDF must be no larger than 1 MB.' });
    }

    // Aadhaar is normalized and HMACed only in memory; plaintext is never persisted.
    const aadhaarHash = hashAadhaar(aadhaarNumber);

    // Link only by the private Aadhaar HMAC. Names and IDs are never used as
    // identity fallbacks for official federation results.
    const matchedUser = await User.findOne({ role: 'athlete', aadhaarHash });

    const matchedUserId = matchedUser ? matchedUser._id : null;
    const matchedAthleteId = matchedUser ? (matchedUser.athleteId || `ATH-${matchedUser._id.toString().slice(-8).toUpperCase()}`) : null;

    const duplicate = await OfficialAchievement.exists({
      federation: fed._id,
      event: event._id,
      aadhaarHash,
      achievementType,
      medal: achievementType === 'medal' ? (medal || 'Gold') : null,
      rank: achievementType === 'ranking' ? Number(rank || 1) : null,
      verificationStatus: { $ne: 'REVOKED' }
    });
    if (duplicate) return res.status(409).json({ error: 'An official result for this athlete and event already exists.' });

    const officialRecordId = generateUniqueId('TA-ACH');

    const achievement = await OfficialAchievement.create({
      officialRecordId,
      athleteUserId: matchedUserId,
      athleteId: matchedAthleteId,
      aadhaarHash,
      athleteName: finalWinnerName,
      federation: fed._id,
      event: event._id,
      tournamentName: event.eventName,
      sport: event.sport,
      category: event.category,
      competitionLevel: event.competitionLevel || resolveCompetitionLevel(event) || null,
      achievementType,
      medal: achievementType === 'medal' ? (medal || 'Gold') : undefined,
      rank: achievementType === 'ranking' ? Number(rank || 1) : undefined,
      year: Number(year || new Date().getFullYear()),
      eventDate: eventDate ? new Date(eventDate) : (event.tournamentDate || event.startDate || new Date()),
      description: description ? String(description).trim() : '',
      certificateData: certificateData || null,
      certificateFileName: certificateFileName || 'official_certificate.pdf',
      certificateFileSize: certificateFileSize || 0,
      verificationStatus: 'FROZEN',
      isFrozen: true,
      frozenAt: new Date()
    });

    // A submitted result is immutable; the event remains open for other valid winners until its deadline.
    event.status = 'COMPLETED';
    await event.save();

    // Re-evaluate recommendations for this athlete asynchronously (Rule 27 & 66)
    if (matchedUserId) {
      generateAthleteRecommendations(matchedUserId).catch(err => {
        console.error('Error generating athlete recommendations on federation result:', err.message);
      });
    }

    res.status(201).json(withoutAadhaar(achievement));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/federation/achievements — List Official Achievements issued by authenticated Federation
router.get('/achievements', verifyToken, requireRoles('federation'), async (req, res) => {
  try {
    const achievements = await OfficialAchievement.find({ federation: req.user.id })
      .select('-aadhaarHash -athleteIdentityReference')
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
    const federations = await Federation.find(filter)
      .select('federationId name sport state abbreviation website recognitionStatus recognitionYear sourceDocument officialEmail officialPhone accountActivated status createdAt updatedAt')
      .sort({ name: 1 });
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
