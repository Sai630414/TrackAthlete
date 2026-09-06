const express = require('express');
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
const certificateIsValid = ({ certificateData, certificateFileName, certificateFileSize }) => {
  if (!certificateData || !certificateFileName || !String(certificateData).startsWith('data:application/pdf;base64,')) return false;
  const base64 = String(certificateData).split(',')[1] || '';
  const actualBytes = Buffer.byteLength(base64, 'base64');
  return Number(certificateFileSize) === actualBytes && actualBytes > 0 && actualBytes <= 1024 * 1024;
};
const teamRoster = team => [
  ...(team.members || []).filter(member => member.status === 'confirmed').map(member => ({
    participantType: 'registered', athlete: member.athlete?._id || member.athlete,
    name: member.athlete?.name || 'Registered athlete', mobile: member.athlete?.contactPhone || '',
    email: member.athlete?.email || '', isCaptain: String(member.athlete?._id || member.athlete) === String(team.captain?._id || team.captain)
  })),
  ...(team.manualPlayers || []).map(player => ({ participantType: 'manual', name: player.name, mobile: player.mobile || '', email: player.email || '', isCaptain: false }))
];

router.post('/auth/signup', async (req, res) => {
  try {
    const b = req.body; const email = cleanEmail(b.email);
    if (!b.organizerType || !b.name || !b.designation || !b.mobile || !email || !b.password || !b.officialAddress?.line1 || !b.officialAddress?.city || !b.officialAddress?.state || !b.officialAddress?.pinCode || !b.officialAddress?.country) return res.status(400).json({ error: 'Complete the required organizer, contact and address fields.' });
    if (organizationTypes.has(b.organizerType) && !b.organizationName) return res.status(400).json({ error: 'Organization name is required for this organizer type.' });
    if (String(b.password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (await Organizer.findOne({ email })) return res.status(409).json({ error: 'This official email is already registered.' });
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await Organizer.create({ ...b, email, passwordHash: await bcrypt.hash(b.password, 10), emailOTPHash: otpHash(otp), emailOTPExpires: new Date(Date.now() + 15 * 60 * 1000), officialAddress: b.officialAddress || {} });
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
    const result = await OrganizerResult.findOne({ event: event._id, sportConfigId: sport._id }).select('-entries.aadhaarHash');
    res.json({ result: result || null });
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
    if (req.body.resultType && req.body.resultType !== resultType) return res.status(400).json({ error: 'Result type must match the event sport configuration.' });
    const supplied = Array.isArray(req.body.entries) ? req.body.entries : [];
    const entries = [];
    const seenTeams = new Set();
    for (const raw of supplied) {
      const entry = { position: Number(raw.position) || undefined, medal: raw.medal, mobile: String(raw.mobile || '').trim() };
      if (resultType === 'positions' && !entry.position) return res.status(400).json({ error: 'Every result needs a valid finishing position.' });
      if (resultType === 'medals' && !['Gold', 'Silver', 'Bronze'].includes(entry.medal)) return res.status(400).json({ error: 'Every result needs Gold, Silver, or Bronze.' });
      if (sport.competitionType === 'team') {
        if (!raw.team) return res.status(400).json({ error: 'Select a registered team for every team result.' });
        if (seenTeams.has(String(raw.team))) return res.status(400).json({ error: 'A team can only appear once in a sport result.' });
        const team = await EventTeam.findOne({ _id: raw.team, event: event._id, sportConfigId: sport._id, status: { $nin: ['terminated'] } })
          .populate('captain', 'name email contactPhone').populate('members.athlete', 'name email contactPhone');
        if (!team) return res.status(400).json({ error: 'Selected team does not belong to this event sport.' });
        const roster = teamRoster(team);
        if (!roster.length) return res.status(400).json({ error: `Team ${team.name} has no confirmed members.` });
        entries.push({ name: team.name, team: team._id, teamName: team.name, roster, ...entry, outcome: resultLabel(resultType, entry) });
        seenTeams.add(String(team._id));
      } else {
        const aadhaar = String(raw.aadhaar || '').trim();
        if (!String(raw.name || '').trim() || !aadhaar) return res.status(400).json({ error: 'Each individual result needs a participant name and Aadhaar for secure matching.' });
        entries.push({ name: String(raw.name).trim(), aadhaarHash: hashAadhaar(aadhaar), ...entry, outcome: resultLabel(resultType, entry) });
      }
    }
    if (!entries.length) return res.status(400).json({ error: 'Add at least one complete result before saving a draft.' });
    const certificate = { certificateData: req.body.certificateData || null, certificateFileName: req.body.certificateFileName || '', certificateFileSize: Number(req.body.certificateFileSize) || 0 };
    if (certificate.certificateData && !certificateIsValid(certificate)) return res.status(400).json({ error: 'Certificate must be a valid PDF no larger than 1 MB.' });
    const result = await OrganizerResult.findOneAndUpdate({ event: event._id, sportConfigId: sport._id }, { $set: { organizer: req.user._id, resultType, entries, ...certificate } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
    res.json({ result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/events/:id/results/:sportId/freeze', async (req, res) => {
  try {
    const event = await OrganizerEvent.findOne({ _id: req.params.id, organizer: req.user._id });
    const sport = eventSport(event || {}, req.params.sportId);
    if (!event || !sport) return res.status(404).json({ error: 'Event sport not found.' });
    const result = await OrganizerResult.findOne({ event: event._id, sportConfigId: sport._id }).select('+entries.aadhaarHash');
    if (!result || result.isFrozen) return res.status(400).json({ error: 'A draft result is required and may only be frozen once.' });
    if (!result.entries.length) return res.status(400).json({ error: 'At least one complete result is required before publishing.' });
    if (!certificateIsValid(result)) return res.status(400).json({ error: 'Certificate PDF is required before publishing the result.' });
    const hashes = result.entries.map(entry => entry.aadhaarHash).filter(Boolean);
    const athletes = await User.find({ aadhaarHash: { $in: hashes }, role: 'athlete' }).select('_id aadhaarHash');
    const matched = new Map(athletes.map(athlete => [athlete.aadhaarHash, athlete._id]));
    const award = (athlete, entry) => OrganizerAchievement.updateOne(
      { athlete, result: result._id, outcome: entry.outcome },
      { $setOnInsert: { athlete, organizer: req.user._id, event: event._id, result: result._id, sportConfigId: sport._id, team: entry.team, outcome: entry.outcome, certificateData: result.certificateData, certificateFileName: result.certificateFileName, certificateFileSize: result.certificateFileSize } },
      { upsert: true }
    );
    for (const entry of result.entries) {
      const matchedAthlete = matched.get(entry.aadhaarHash);
      if (matchedAthlete) { entry.athlete = matchedAthlete; await award(matchedAthlete, entry); }
      for (const member of entry.roster || []) if (member.participantType === 'registered' && member.athlete) await award(member.athlete, entry);
    }
    result.isFrozen = true; result.frozenAt = new Date(); await result.save();
    sport.resultStatus = 'frozen'; await event.save();
    res.json({ result, matchedAthletes: athletes.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
module.exports = router;
