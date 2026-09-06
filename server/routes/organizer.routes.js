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

router.post('/auth/signup', async (req, res) => {
  try {
    const b = req.body; const email = cleanEmail(b.email);
    if (!b.organizerType || !b.name || !b.designation || !b.mobile || !email || !b.password) return res.status(400).json({ error: 'Organizer type, name, designation, mobile, email and password are required.' });
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
router.get('/events/:id/registrations', async (req, res) => { const event = await OrganizerEvent.findOne({ _id: req.params.id, organizer: req.user._id }); if (!event) return res.status(404).json({ error: 'Event not found.' }); const registrations = await EventRegistration.find({ event: event._id }).populate('athlete', 'name athleteId email contactPhone').populate('team'); res.json({ event, registrations }); });
router.post('/events/:id/updates', async (req, res) => { try { const event = await OrganizerEvent.findOne({ _id: req.params.id, organizer: req.user._id }); if (!event || !req.body.subject || !req.body.message) return res.status(400).json({ error: 'Event, subject and message are required.' }); const filter = { event: event._id }; if (req.body.sportConfigId) filter.sportConfigId = req.body.sportConfigId; if (Array.isArray(req.body.registrationIds) && req.body.registrationIds.length) filter._id = { $in: req.body.registrationIds }; const registrations = await EventRegistration.find(filter).populate('athlete', 'email name'); const recipients = [...new Map(registrations.filter(r => r.athlete?.email).map(r => [r.athlete.email, r.athlete])).values()]; await Promise.allSettled(recipients.map(a => sendBrevoEmail({ toEmail: a.email, toName: a.name, subject: req.body.subject, textContent: req.body.message, htmlContent: `<p>${String(req.body.message).replace(/\n/g, '<br>')}</p>` }))); res.json({ sent: recipients.length }); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/ledger', async (req, res) => { const events = await OrganizerEvent.find({ organizer: req.user._id }).lean(); const ids = events.map(e => e._id); const counts = await EventRegistration.aggregate([{ $match: { event: { $in: ids } } }, { $group: { _id: '$event', registrations: { $sum: 1 } } }]); const byId = new Map(counts.map(x => [String(x._id), x.registrations])); res.json({ entries: events.map(e => ({ ...e, registrationCount: byId.get(String(e._id)) || 0, frozenSports: e.sports.filter(s => s.resultStatus === 'frozen').length, pendingSports: e.sports.filter(s => s.resultStatus === 'pending').length })) }); });
router.post('/events/:id/results/:sportId', async (req, res) => { try { const event = await OrganizerEvent.findOne({ _id: req.params.id, organizer: req.user._id }); const sport = eventSport(event || {}, req.params.sportId); if (!event || !sport) return res.status(404).json({ error: 'Event sport not found.' }); if (sport.resultStatus === 'frozen' || new Date() > event.resultSubmissionDeadline) return res.status(400).json({ error: 'Results are no longer editable for this sport.' }); const entries = (req.body.entries || []).map(x => ({ ...x, aadhaarHash: x.aadhaar ? hashAadhaar(x.aadhaar) : undefined })); if (entries.some(x => !x.name || !x.aadhaarHash || !x.outcome)) return res.status(400).json({ error: 'Each result entry requires a name, valid Aadhaar and outcome.' }); const result = await OrganizerResult.findOneAndUpdate({ event: event._id, sportConfigId: sport._id }, { organizer: req.user._id, resultType: req.body.resultType, entries }, { new: true, upsert: true, runValidators: true }); res.json({ result }); } catch (err) { res.status(500).json({ error: err.message }); } });
router.post('/events/:id/results/:sportId/freeze', async (req, res) => { try { const event = await OrganizerEvent.findOne({ _id: req.params.id, organizer: req.user._id }); const sport = eventSport(event || {}, req.params.sportId); if (!event || !sport) return res.status(404).json({ error: 'Event sport not found.' }); if (new Date() > event.resultSubmissionDeadline) return res.status(400).json({ error: 'Result submission deadline has passed.' }); const result = await OrganizerResult.findOne({ event: event._id, sportConfigId: sport._id }).select('+entries.aadhaarHash'); if (!result || result.isFrozen) return res.status(400).json({ error: 'A draft result is required and may only be frozen once.' }); const hashes = result.entries.map(x => x.aadhaarHash).filter(Boolean); const athletes = await User.find({ aadhaarHash: { $in: hashes }, role: 'athlete' }).select('_id aadhaarHash'); const matched = new Map(athletes.map(a => [a.aadhaarHash, a._id])); for (const entry of result.entries) { const athlete = matched.get(entry.aadhaarHash); if (!athlete) continue; entry.athlete = athlete; await OrganizerAchievement.updateOne({ athlete, result: result._id, outcome: entry.outcome }, { $setOnInsert: { athlete, organizer: req.user._id, event: event._id, result: result._id, sportConfigId: sport._id, team: entry.team, outcome: entry.outcome, certificateUrl: entry.certificateUrl } }, { upsert: true }); } result.isFrozen = true; result.frozenAt = new Date(); await result.save(); sport.resultStatus = 'frozen'; await event.save(); res.json({ result, matchedAthletes: athletes.length }); } catch (err) { res.status(500).json({ error: err.message }); } });
module.exports = router;
