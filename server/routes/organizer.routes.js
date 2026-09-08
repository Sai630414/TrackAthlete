const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Organizer = require('../models/Organizer');
const OrganizerEvent = require('../models/OrganizerEvent');
const EventTeam = require('../models/EventTeam');
const EventRegistration = require('../models/EventRegistration');
const OrganizerResult = require('../models/OrganizerResult');
const OrganizerAchievement = require('../models/OrganizerAchievement');
const User = require('../models/User');
const { verifyToken, requireRoles } = require('../middleware/auth.middleware');
const { hashAadhaar } = require('../utils/aadhaar');
const { sendBrevoEmail } = require('../utils/mailer');
const router = express.Router();
const secret = () => process.env.JWT_SECRET || 'trackathlete_sih_secret_2026';
const organizationTypes = new Set(['Private University', 'Government University', 'College', 'School', 'Sports Academy', 'Sports Club', 'Sports Association', 'Company / Private Organization', 'NGO']);
const cleanEmail = value => String(value || '').trim().toLowerCase();
const otpHash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const eventSport = (event, id) => event?.sports?.id ? event.sports.id(id) : null;
const activeRegistration = event => new Date() <= new Date(event.registrationDeadline);
const resultLabel = (resultType, entry) => resultType === 'medals' ? entry.medal : `${entry.position}${entry.position === 1 ? 'st' : entry.position === 2 ? 'nd' : entry.position === 3 ? 'rd' : 'th'} Place`;
const certificateIsValid = (cert) => {
  if (!cert || !cert.certificateData || !cert.certificateFileName) return false;
  if (!String(cert.certificateData).startsWith('data:application/pdf;base64,')) return false;
  const base64 = String(cert.certificateData).split(',')[1] || '';
  const actualBytes = Buffer.byteLength(base64, 'base64');
  return actualBytes > 0 && actualBytes <= 1.5 * 1024 * 1024;
};
const teamRoster = team => [
  ...(team.members || []).filter(member => member.status === 'confirmed').map(member => ({
    participantType: 'registered', athlete: member.athlete?._id || member.athlete,
    name: member.athlete?.name || 'Registered athlete', mobile: member.athlete?.contactPhone || '',
    email: member.athlete?.email || '', isCaptain: String(member.athlete?._id || member.athlete) === String(team.captain?._id || team.captain)
  })),
  ...(team.manualPlayers || []).map(player => ({ participantType: 'manual', name: player.name, mobile: player.mobile || '', email: player.email || '', isCaptain: false }))
];

// Server-side TrackAthlete identity resolver
async function findTrackAthleteUser(rawId) {
  if (!rawId || !String(rawId).trim()) return null;
  const cleanId = String(rawId).trim();
  const escaped = cleanId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const exactRegex = new RegExp('^' + escaped + '$', 'i');

  // 1. Direct field match on User
  let user = await User.findOne({
    $or: [
      { athleteId: exactRegex },
      { coachId: exactRegex },
      { trackAthleteId: exactRegex }
    ]
  });
  if (user) return user;

  // 2. Role prefix variations (ATH, COA, PAR, SPO, ACA, TA)
  if (/^(ATH|COA|PAR|SPO|ACA|TA)-/i.test(cleanId)) {
    const stripped = cleanId.replace(/^(ATH|COA|PAR|SPO|ACA|TA)-/i, '');
    const strippedEscaped = stripped.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    user = await User.findOne({
      $or: [
        { athleteId: new RegExp('^(ATH-)?' + strippedEscaped + '$', 'i') },
        { coachId: new RegExp('^(COA-)?' + strippedEscaped + '$', 'i') },
        { trackAthleteId: new RegExp('^' + strippedEscaped + '$', 'i') }
      ]
    });
    if (user) return user;

    if (/^[0-9a-f]{6,24}$/i.test(stripped)) {
      const all = await User.find({}).select('_id').lean();
      const matched = all.find(u => u._id.toString().toLowerCase().endsWith(stripped.toLowerCase()));
      if (matched) return await User.findById(matched._id);
    }
  }

  // 3. Direct hex string (6 to 24 characters)
  if (/^[0-9a-f]{6,24}$/i.test(cleanId)) {
    if (mongoose.Types.ObjectId.isValid(cleanId) && cleanId.length === 24) {
      user = await User.findById(cleanId);
      if (user) return user;
    }
    const all = await User.find({}).select('_id').lean();
    const matched = all.find(u => u._id.toString().toLowerCase().endsWith(cleanId.toLowerCase()));
    if (matched) return await User.findById(matched._id);
  }

  // 4. Academy collection lookup
  try {
    const Academy = require('../models/Academy');
    const acadDoc = await Academy.findOne({
      $or: [
        { _id: (mongoose.Types.ObjectId.isValid(cleanId) && cleanId.length === 24) ? cleanId : null },
        { name: exactRegex }
      ].filter(Boolean)
    });
    if (acadDoc && acadDoc.userId) {
      user = await User.findById(acadDoc.userId);
      if (user) return user;
    }
  } catch {}

  return null;
}

router.post('/auth/signup', async (req, res) => {
  try {
    const b = req.body; const email = cleanEmail(b.email);
    if (!b.organizerType || !b.name || !b.designation || !b.mobile || !email || !b.password || !b.officialAddress?.line1 || !b.officialAddress?.city || !b.officialAddress?.state || !b.officialAddress?.pinCode || !b.officialAddress?.country) return res.status(400).json({ error: 'Complete the required organizer, contact and address fields.' });
    if (organizationTypes.has(b.organizerType) && !b.organizationName) return res.status(400).json({ error: 'Organization name is required for this organizer type.' });
    if (String(b.password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (await Organizer.findOne({ email })) return res.status(409).json({ error: 'This official email is already registered.' });

    let linkedUserId = null;
    let verifiedTrackAthleteId = null;

    if (b.trackAthleteId && String(b.trackAthleteId).trim()) {
      const cleanTrackId = String(b.trackAthleteId).trim();
      const matchedUser = await findTrackAthleteUser(cleanTrackId);
      if (!matchedUser) {
        return res.status(400).json({
          error: 'Invalid TrackAthlete ID. Please enter a valid existing TrackAthlete ID or leave it empty.'
        });
      }
      linkedUserId = matchedUser._id;
      verifiedTrackAthleteId = cleanTrackId;
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await Organizer.create({
      ...b,
      email,
      linkedUserId,
      trackAthleteId: verifiedTrackAthleteId,
      passwordHash: await bcrypt.hash(b.password, 10),
      emailOTPHash: otpHash(otp),
      emailOTPExpires: new Date(Date.now() + 15 * 60 * 1000),
      officialAddress: b.officialAddress || {}
    });
    await sendBrevoEmail({ toEmail: email, toName: b.name, subject: 'TrackAthlete Organizer verification code', textContent: `Your Organizer verification code is ${otp}. It expires in 15 minutes.`, htmlContent: `<p>Your Organizer verification code is <b>${otp}</b>. It expires in 15 minutes.</p>` });
    res.status(201).json({ message: 'Verification code sent to the official email.', email });
  } catch (err) { res.status(500).json({ error: err.message || 'Organizer signup failed.' }); }
});

router.post('/auth/verify-email', async (req, res) => {
  try {
    const organizer = await Organizer.findOne({ email: cleanEmail(req.body.email) }).select('+emailOTPHash');
    if (!organizer || !req.body.otp || organizer.emailOTPHash !== otpHash(req.body.otp) || organizer.emailOTPExpires <= new Date()) return res.status(400).json({ error: 'Invalid or expired verification code.' });
    organizer.isEmailVerified = true; organizer.accountStatus = 'active'; organizer.emailOTPHash = undefined; organizer.emailOTPExpires = undefined;
    if (!organizer.organizerId) { const count = await Organizer.countDocuments({ organizerId: { $exists: true } }); organizer.organizerId = `ORG-${String(count + 1).padStart(6, '0')}`; }
    await organizer.save();

    // Link organizer reference back to user if linked
    if (organizer.linkedUserId) {
      await User.findByIdAndUpdate(organizer.linkedUserId, {
        $set: { linkedOrganizerId: organizer._id }
      }).catch(() => {});
    }

    const token = jwt.sign({ id: organizer._id, role: 'organizer' }, secret(), { expiresIn: '7d' }); res.json({ token, organizer });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/auth/login', async (req, res) => {
  try { const organizer = await Organizer.findOne({ email: cleanEmail(req.body.email) }).select('+passwordHash'); if (!organizer || !(await bcrypt.compare(req.body.password || '', organizer.passwordHash))) return res.status(401).json({ error: 'Invalid official email or password.' }); if (organizer.accountStatus !== 'active') return res.status(403).json({ error: 'Verify the organizer email before signing in.' }); const token = jwt.sign({ id: organizer._id, role: 'organizer' }, secret(), { expiresIn: req.body.rememberMe ? '30d' : '7d' }); res.json({ token, organizer }); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.use(verifyToken, requireRoles('organizer'));
router.get('/me', async (req, res) => res.json({ organizer: await Organizer.findById(req.user._id) }));
router.post('/events', async (req, res) => {
  try { const b = req.body; if (!b.eventName || !b.eventDate || !b.registrationDeadline || !b.resultSubmissionDeadline || !b.venue || !Array.isArray(b.sports) || !b.sports.length) return res.status(400).json({ error: 'Event details and at least one sport are required.' }); if (new Date(b.registrationDeadline) > new Date(b.eventDate) || new Date(b.resultSubmissionDeadline) < new Date(b.eventDate)) return res.status(400).json({ error: 'Event deadlines are invalid.' }); for (const sport of b.sports) { if (!sport.sportName || !['individual', 'team'].includes(sport.competitionType)) return res.status(400).json({ error: 'Each sport needs a name and competition type.' }); if (sport.competitionType === 'team' && (!sport.minimumTeamSize || !sport.maximumTeamSize || Number(sport.minimumTeamSize) > Number(sport.maximumTeamSize))) return res.status(400).json({ error: 'Team sports require valid minimum and maximum team sizes.' }); }
    const organizer = await Organizer.findById(req.user._id); const event = await OrganizerEvent.create({ ...b, organizer: req.user._id, teamFormationDeadline: b.teamFormationDeadline || b.registrationDeadline, organizerContact: b.organizerContact || { name: organizer.name, mobile: organizer.mobile, email: organizer.email } }); res.status(201).json({ event });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/events', async (req, res) => res.json({ events: await OrganizerEvent.find({ organizer: req.user._id }).sort({ eventDate: -1 }) }));
router.get('/events/:id/results/:sportId', async (req, res) => {
  try {
    const event = await OrganizerEvent.findOne({ _id: req.params.id, organizer: req.user._id });
    const sport = eventSport(event || {}, req.params.sportId);
    if (!event || !sport) return res.status(404).json({ error: 'Event sport not found.' });
    const result = await OrganizerResult.findOne({ event: event._id, sportConfigId: sport._id })
      .select('-entries.aadhaarHash -entries.roster.aadhaarHash');
    
    // Also fetch online registered teams for this sport as optional preload convenience:
    const registeredTeams = await EventTeam.find({
      event: event._id,
      sportConfigId: sport._id,
      status: { $nin: ['terminated'] }
    }).populate('captain', 'name email contactPhone athleteId').populate('members.athlete', 'name email contactPhone athleteId');

    res.json({ result: result || null, sport, registeredTeams });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/events/:id/registrations', async (req, res) => {
  const event = await OrganizerEvent.findOne({ _id: req.params.id, organizer: req.user._id });
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  const registrations = await EventRegistration.find({ event: event._id })
    .populate('athlete', 'name athleteId email contactPhone')
    .populate({
      path: 'team',
      populate: [
        { path: 'captain', select: 'name athleteId email contactPhone' },
        { path: 'members.athlete', select: 'name athleteId email contactPhone' }
      ]
    });
  res.json({ event, registrations });
});
router.post('/events/:id/updates', async (req, res) => { try { const event = await OrganizerEvent.findOne({ _id: req.params.id, organizer: req.user._id }); if (!event || !req.body.subject || !req.body.message) return res.status(400).json({ error: 'Event, subject and message are required.' }); const filter = { event: event._id }; if (req.body.sportConfigId) filter.sportConfigId = req.body.sportConfigId; if (Array.isArray(req.body.registrationIds) && req.body.registrationIds.length) filter._id = { $in: req.body.registrationIds }; const registrations = await EventRegistration.find(filter).populate('athlete', 'email name'); const recipients = [...new Map(registrations.filter(r => r.athlete?.email).map(r => [r.athlete.email, r.athlete])).values()]; await Promise.allSettled(recipients.map(a => sendBrevoEmail({ toEmail: a.email, toName: a.name, subject: req.body.subject, textContent: req.body.message, htmlContent: `<p>${String(req.body.message).replace(/\n/g, '<br>')}</p>` }))); res.json({ sent: recipients.length }); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/ledger', async (req, res) => { const events = await OrganizerEvent.find({ organizer: req.user._id }).lean(); const ids = events.map(e => e._id); const counts = await EventRegistration.aggregate([{ $match: { event: { $in: ids } } }, { $group: { _id: '$event', registrations: { $sum: 1 } } }]); const byId = new Map(counts.map(x => [String(x._id), x.registrations])); res.json({ entries: events.map(e => ({ ...e, registrationCount: byId.get(String(e._id)) || 0, frozenSports: e.sports.filter(s => s.resultStatus === 'frozen').length, pendingSports: e.sports.filter(s => s.resultStatus === 'pending').length })) }); });
router.post('/events/:id/results/:sportId', async (req, res) => {
  try {
    const event = await OrganizerEvent.findOne({ _id: req.params.id, organizer: req.user._id });
    const sport = eventSport(event || {}, req.params.sportId);
    if (!event || !sport) return res.status(404).json({ error: 'Event sport not found.' });
    if (sport.resultStatus === 'frozen') return res.status(400).json({ error: 'This sport has already been frozen.' });
    
    const resultType = sport.resultType || 'positions';
    const competitionType = sport.competitionType || 'individual';
    if (req.body.resultType && req.body.resultType !== resultType) {
      return res.status(400).json({ error: 'Result type must match the event sport configuration.' });
    }

    const supplied = Array.isArray(req.body.entries) ? req.body.entries : [];
    const entries = [];
    const seenTeamNames = new Set();

    for (const raw of supplied) {
      const position = Number(raw.position) || undefined;
      const medal = raw.medal || undefined;
      const outcome = resultLabel(resultType, { position, medal });

      if (competitionType === 'team') {
        const teamName = String(raw.teamName || raw.name || '').trim();
        if (!teamName) return res.status(400).json({ error: 'Every team result requires a team name.' });
        if (seenTeamNames.has(teamName.toLowerCase())) {
          return res.status(400).json({ error: `Team "${teamName}" can only appear once in this sport result.` });
        }
        seenTeamNames.add(teamName.toLowerCase());

        const rawRoster = Array.isArray(raw.roster) ? raw.roster : [];
        const roster = [];
        for (const m of rawRoster) {
          const playerName = String(m.name || '').trim();
          if (!playerName) continue;

          let memberAadhaarHash = m.aadhaarHash || undefined;
          if (m.aadhaar && String(m.aadhaar).trim().length === 12) {
            memberAadhaarHash = hashAadhaar(String(m.aadhaar).trim());
          }

          roster.push({
            _id: m._id || new mongoose.Types.ObjectId(),
            name: playerName,
            participantType: m.participantType || 'offline',
            athlete: m.athlete || undefined,
            athleteId: m.athleteId || undefined,
            mobile: String(m.mobile || '').trim(),
            email: String(m.email || '').trim(),
            isCaptain: Boolean(m.isCaptain),
            certificateData: m.certificateData || null,
            certificateFileName: m.certificateFileName || '',
            certificateFileSize: Number(m.certificateFileSize) || 0,
            ...(memberAadhaarHash ? { aadhaarHash: memberAadhaarHash } : {})
          });
        }

        entries.push({
          _id: raw._id || new mongoose.Types.ObjectId(),
          name: teamName,
          teamName,
          team: raw.team || undefined,
          position,
          medal,
          outcome,
          roster,
          certificateData: raw.certificateData || null,
          certificateFileName: raw.certificateFileName || '',
          certificateFileSize: Number(raw.certificateFileSize) || 0
        });
      } else {
        // Individual sport
        const participantName = String(raw.name || '').trim();
        if (!participantName) return res.status(400).json({ error: 'Participant name is required.' });

        let aadhaarHash = raw.aadhaarHash || undefined;
        if (raw.aadhaar && String(raw.aadhaar).trim().length === 12) {
          aadhaarHash = hashAadhaar(String(raw.aadhaar).trim());
        }

        entries.push({
          _id: raw._id || new mongoose.Types.ObjectId(),
          name: participantName,
          position,
          medal,
          outcome,
          mobile: String(raw.mobile || '').trim(),
          email: String(raw.email || '').trim(),
          participantType: raw.participantType || 'offline',
          athlete: raw.athlete || undefined,
          athleteId: raw.athleteId || undefined,
          certificateData: raw.certificateData || null,
          certificateFileName: raw.certificateFileName || '',
          certificateFileSize: Number(raw.certificateFileSize) || 0,
          ...(aadhaarHash ? { aadhaarHash } : {})
        });
      }
    }

    if (!entries.length) {
      return res.status(400).json({ error: 'Add at least one result before saving draft.' });
    }

    const result = await OrganizerResult.findOneAndUpdate(
      { event: event._id, sportConfigId: sport._id },
      {
        $set: {
          organizer: req.user._id,
          event: event._id,
          sportConfigId: sport._id,
          sportName: sport.sportName,
          competitionType,
          resultType,
          entries,
          certificateData: req.body.certificateData || null,
          certificateFileName: req.body.certificateFileName || '',
          certificateFileSize: Number(req.body.certificateFileSize) || 0,
          isFrozen: false
        }
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.json({ result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/events/:id/results/:sportId/unfreeze', async (req, res) => {
  try {
    const event = await OrganizerEvent.findOne({ _id: req.params.id, organizer: req.user._id });
    const sport = eventSport(event || {}, req.params.sportId);
    if (!event || !sport) return res.status(404).json({ error: 'Event sport not found.' });

    sport.resultStatus = 'pending';
    await event.save();

    const result = await OrganizerResult.findOneAndUpdate(
      { event: event._id, sportConfigId: sport._id },
      { $set: { isFrozen: false, frozenAt: null } },
      { new: true }
    );

    if (result) {
      await OrganizerAchievement.deleteMany({ result: result._id });
    }

    res.json({ success: true, result, message: 'Sport result reopened for editing.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/events/:id/results/:sportId/freeze', async (req, res) => {
  try {
    const event = await OrganizerEvent.findOne({ _id: req.params.id, organizer: req.user._id });
    const sport = eventSport(event || {}, req.params.sportId);
    if (!event || !sport) return res.status(404).json({ error: 'Event sport not found.' });
    if (sport.resultStatus === 'frozen') return res.status(400).json({ error: 'This sport has already been frozen.' });

    const result = await OrganizerResult.findOne({ event: event._id, sportConfigId: sport._id })
      .select('+entries.aadhaarHash +entries.roster.aadhaarHash');
    if (!result || result.isFrozen) return res.status(400).json({ error: 'A saved draft result is required before publishing.' });
    if (!result.entries.length) return res.status(400).json({ error: 'At least one complete result is required before publishing.' });

    const resultType = sport.resultType || 'positions';
    const isTeam = sport.competitionType === 'team';
    const minTeamSize = sport.minimumTeamSize || 1;
    const maxTeamSize = sport.maximumTeamSize || 50;

    // Validate all results according to sport configuration
    for (let i = 0; i < result.entries.length; i++) {
      const entry = result.entries[i];
      if (resultType === 'positions' && (!entry.position || entry.position < 1)) {
        return res.status(400).json({ error: `Result ${i + 1} requires a valid finishing position.` });
      }
      if (resultType === 'medals' && !['Gold', 'Silver', 'Bronze'].includes(entry.medal)) {
        return res.status(400).json({ error: `Result ${i + 1} requires Gold, Silver, or Bronze.` });
      }

      if (isTeam) {
        if (!entry.teamName?.trim()) {
          return res.status(400).json({ error: `Team result ${i + 1} requires a team name.` });
        }
        const rosterCount = entry.roster?.length || 0;
        if (rosterCount < minTeamSize) {
          return res.status(400).json({
            error: `Team "${entry.teamName}" has ${rosterCount} player(s). Minimum required team size is ${minTeamSize}.`
          });
        }
        if (rosterCount > maxTeamSize) {
          return res.status(400).json({
            error: `Team "${entry.teamName}" has ${rosterCount} player(s). Maximum allowed team size is ${maxTeamSize}.`
          });
        }
        for (let j = 0; j < entry.roster.length; j++) {
          const m = entry.roster[j];
          if (!m.name?.trim()) {
            return res.status(400).json({ error: `Player ${j + 1} in team "${entry.teamName}" is missing a name.` });
          }
          if (!m.certificateData) {
            if (entry.certificateData) {
              m.certificateData = entry.certificateData;
              m.certificateFileName = entry.certificateFileName;
              m.certificateFileSize = entry.certificateFileSize;
            } else if (result.certificateData) {
              m.certificateData = result.certificateData;
              m.certificateFileName = result.certificateFileName;
              m.certificateFileSize = result.certificateFileSize;
            }
          }
          if (!m.certificateData) {
            return res.status(400).json({ error: `Player "${m.name}" in team "${entry.teamName}" requires a certificate PDF (upload individually, for the team, or for the sport).` });
          }
        }
      } else {
        if (!entry.name?.trim()) {
          return res.status(400).json({ error: `Participant ${i + 1} is missing a name.` });
        }
        if (!entry.certificateData && result.certificateData) {
          entry.certificateData = result.certificateData;
          entry.certificateFileName = result.certificateFileName;
          entry.certificateFileSize = result.certificateFileSize;
        }
        if (!entry.certificateData) {
          return res.status(400).json({ error: `Participant "${entry.name}" requires a certificate PDF.` });
        }
      }
    }

    // Secure Athlete Matching & Achievement Awarding
    const hashes = [];
    const athleteIds = [];
    const emails = [];

    const gather = (p) => {
      if (p.aadhaarHash) hashes.push(p.aadhaarHash);
      if (p.athleteId) athleteIds.push(p.athleteId);
      if (p.email) emails.push(p.email.toLowerCase());
    };

    for (const entry of result.entries) {
      if (isTeam) {
        for (const member of entry.roster || []) gather(member);
      } else {
        gather(entry);
      }
    }

    const matchQueries = [];
    if (hashes.length) matchQueries.push({ aadhaarHash: { $in: hashes } });
    if (athleteIds.length) matchQueries.push({ athleteId: { $in: athleteIds } });
    if (emails.length) matchQueries.push({ email: { $in: emails } });

    let matchedAthletes = [];
    if (matchQueries.length) {
      matchedAthletes = await User.find({ role: 'athlete', $or: matchQueries }).select('_id name athleteId email aadhaarHash');
    }

    const athleteByHash = new Map(matchedAthletes.filter(a => a.aadhaarHash).map(a => [a.aadhaarHash, a]));
    const athleteById = new Map(matchedAthletes.filter(a => a.athleteId).map(a => [a.athleteId, a]));
    const athleteByEmail = new Map(matchedAthletes.filter(a => a.email).map(a => [a.email.toLowerCase(), a]));

    const findMatch = (p) => {
      if (p.aadhaarHash && athleteByHash.has(p.aadhaarHash)) return athleteByHash.get(p.aadhaarHash);
      if (p.athleteId && athleteById.has(p.athleteId)) return athleteById.get(p.athleteId);
      if (p.email && athleteByEmail.has(p.email.toLowerCase())) return athleteByEmail.get(p.email.toLowerCase());
      return null;
    };

    let matchedCount = 0;

    for (const entry of result.entries) {
      if (isTeam) {
        for (const member of entry.roster || []) {
          const matched = findMatch(member);
          if (matched) {
            matchedCount++;
            member.participantType = 'registered';
            member.athlete = matched._id;
            member.athleteId = matched.athleteId;

            await OrganizerAchievement.findOneAndUpdate(
              { athlete: matched._id, result: result._id, outcome: entry.outcome },
              {
                $set: {
                  athlete: matched._id,
                  organizer: req.user._id,
                  event: event._id,
                  result: result._id,
                  sportConfigId: sport._id,
                  sportName: sport.sportName,
                  team: entry.team || undefined,
                  teamName: entry.teamName,
                  position: entry.position,
                  medal: entry.medal,
                  outcome: entry.outcome,
                  achievementType: 'Organizer Verified',
                  certificateData: member.certificateData,
                  certificateFileName: member.certificateFileName || `${member.name}_Certificate.pdf`,
                  certificateFileSize: member.certificateFileSize || 0
                }
              },
              { upsert: true, new: true }
            );
          } else {
            member.participantType = 'offline';
            member.athlete = undefined;
            member.athleteId = undefined;
          }
        }
      } else {
        const matched = findMatch(entry);
        if (matched) {
          matchedCount++;
          entry.participantType = 'registered';
          entry.athlete = matched._id;
          entry.athleteId = matched.athleteId;

          await OrganizerAchievement.findOneAndUpdate(
            { athlete: matched._id, result: result._id, outcome: entry.outcome },
            {
              $set: {
                athlete: matched._id,
                organizer: req.user._id,
                event: event._id,
                result: result._id,
                sportConfigId: sport._id,
                sportName: sport.sportName,
                position: entry.position,
                medal: entry.medal,
                outcome: entry.outcome,
                achievementType: 'Organizer Verified',
                certificateData: entry.certificateData,
                certificateFileName: entry.certificateFileName || `${entry.name}_Certificate.pdf`,
                certificateFileSize: entry.certificateFileSize || 0
              }
            },
            { upsert: true, new: true }
          );
        } else {
          entry.participantType = 'offline';
          entry.athlete = undefined;
          entry.athleteId = undefined;
        }
      }
    }

    result.isFrozen = true;
    result.frozenAt = new Date();
    await result.save();

    sport.resultStatus = 'frozen';
    await event.save();

    res.json({ result, matchedAthletes: matchedCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
module.exports = router;
