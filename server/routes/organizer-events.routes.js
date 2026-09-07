const express = require('express');
const OrganizerEvent = require('../models/OrganizerEvent');
const EventTeam = require('../models/EventTeam');
const EventRegistration = require('../models/EventRegistration');
const OrganizerAchievement = require('../models/OrganizerAchievement');
const { verifyToken, requireRoles } = require('../middleware/auth.middleware');
const router = express.Router();
const sportFor = (event, id) => event?.sports?.id ? event.sports.id(id) : null;
const escaped = value => String(value).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
const sameSport = (left, right) => String(left || '').trim().toLocaleLowerCase() === String(right || '').trim().toLocaleLowerCase();

router.get('/upcoming', async (_req, res) => {
  const events = await OrganizerEvent.find({ status: 'published', eventDate: { $gte: new Date() } })
    .select('-organizerContact.mobile -organizerContact.email')
    .populate('organizer', 'name organizationName organizerId')
    .sort({ eventDate: 1 });
  res.json({ events: events.map(e => ({ ...e.toJSON(), sourceType: 'organizer' })) });
});
router.get('/completed', async (_req, res) => {
  try {
    const OrganizerResult = require('../models/OrganizerResult');
    const results = await OrganizerResult.find({ isFrozen: true })
      .select('-entries.aadhaarHash -entries.mobile -entries.roster.mobile -entries.roster.email')
      .populate('event', 'eventName eventDate venue sports')
      .populate('organizer', 'name organizationName organizerId')
      .sort({ frozenAt: -1 });
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get('/:id', async (req, res) => {
  const event = await OrganizerEvent.findOne({ _id: req.params.id, status: 'published' })
    .select('-organizerContact.mobile -organizerContact.email')
    .populate('organizer', 'name organizationName organizerId');
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  res.json({ event });
});

router.use(verifyToken, requireRoles('athlete'));
router.get('/:id/eligibility', async (req, res) => { const event = await OrganizerEvent.findById(req.params.id); if (!event) return res.status(404).json({ error: 'Event not found.' }); const sport = String(req.user.sport || ''); const eligibleSports = event.sports.filter(s => sameSport(s.sportName, sport)).map(s => s._id); res.json({ eligible: eligibleSports.length > 0, eligibleSports, athleteSport: sport }); });
router.post('/:id/register', async (req, res) => { try { const event = await OrganizerEvent.findById(req.params.id); const sport = sportFor(event, req.body.sportConfigId); if (!event || !sport) return res.status(404).json({ error: 'Event sport not found.' }); if (new Date() > event.registrationDeadline) return res.status(400).json({ error: 'Registration deadline has passed.' }); if (!sameSport(sport.sportName, req.user.sport)) return res.status(403).json({ error: 'Your registered sport is not included in this event.' }); if (sport.competitionType !== 'individual') return res.status(400).json({ error: 'Use team registration for this sport.' }); const registration = await EventRegistration.create({ event: event._id, sportConfigId: sport._id, athlete: req.user._id, type: 'individual', status: 'registered' }); res.status(201).json({ registration }); } catch (err) { if (err.code === 11000) return res.status(409).json({ error: 'You already have a registration for this event sport.' }); res.status(500).json({ error: err.message }); } });
async function checkTeamDeadlines(event) {
  if (!event) return;
  const deadline = new Date(event.teamFormationDeadline || event.registrationDeadline);
  if (new Date() > deadline) {
    const teams = await EventTeam.find({ event: event._id, status: 'forming' });
    for (const team of teams) {
      const sport = event.sports?.find(s => String(s._id) === String(team.sportConfigId));
      const confirmedCount = team.members.filter(m => m.status === 'confirmed').length + (team.manualPlayers?.length || 0);
      if (sport && confirmedCount < sport.minimumTeamSize) {
        team.status = 'terminated';
        team.terminationReason = 'Minimum team size not reached by team formation deadline.';
        await team.save();
        await EventRegistration.updateMany(
          { team: team._id, status: { $in: ['team_incomplete', 'pending', 'forming', 'join_request_pending'] } },
          { $set: { status: 'terminated' } }
        );
      } else if (sport && confirmedCount >= sport.minimumTeamSize && team.captainConfirmed) {
        team.status = 'confirmed';
        await team.save();
        await EventRegistration.updateMany(
          { team: team._id, status: 'team_incomplete' },
          { $set: { status: 'confirmed' } }
        );
      }
    }
  }
}

router.get('/:id/sports/:sportId/my-status', async (req, res) => {
  try {
    const event = await OrganizerEvent.findById(req.params.id);
    const sport = sportFor(event, req.params.sportId);
    if (!event || !sport) return res.status(404).json({ error: 'Event or sport not found.' });

    await checkTeamDeadlines(event);

    const reg = await EventRegistration.findOne({
      event: event._id,
      sportConfigId: sport._id,
      athlete: req.user._id
    }).populate({
      path: 'team',
      populate: [
        { path: 'captain', select: 'name athleteId email contactPhone' },
        { path: 'members.athlete', select: 'name athleteId email contactPhone' }
      ]
    });

    let team = reg?.team;
    if (!team) {
      team = await EventTeam.findOne({
        event: event._id,
        sportConfigId: sport._id,
        $or: [
          { captain: req.user._id },
          { 'members.athlete': req.user._id },
          { 'joinRequests.athlete': req.user._id }
        ],
        status: { $nin: ['completed'] }
      })
      .populate('captain', 'name athleteId email contactPhone')
      .populate('members.athlete', 'name athleteId email contactPhone');
    }

    if (!reg && !team) {
      return res.json({
        status: 'NOT_REGISTERED',
        event: {
          _id: event._id,
          eventName: event.eventName,
          registrationDeadline: event.registrationDeadline,
          teamFormationDeadline: event.teamFormationDeadline
        },
        sport: {
          _id: sport._id,
          sportName: sport.sportName,
          minimumTeamSize: sport.minimumTeamSize,
          maximumTeamSize: sport.maximumTeamSize,
          competitionType: sport.competitionType
        }
      });
    }

    const isCaptain = team && String(team.captain?._id || team.captain) === String(req.user._id);
    const confirmedMember = team && team.members?.some(m => String(m.athlete?._id || m.athlete) === String(req.user._id) && m.status === 'confirmed');
    const isTerminated = (team && team.status === 'terminated') || reg?.status === 'terminated';
    const isPendingJoin = reg?.status === 'join_request_pending' || (team?.joinRequests?.some(r => String(r.athlete?._id || r.athlete) === String(req.user._id) && r.status === 'pending'));

    let state = 'NOT_REGISTERED';
    if (isTerminated) {
      state = 'TERMINATED';
    } else if (isCaptain) {
      state = 'TEAM_CAPTAIN';
    } else if (confirmedMember) {
      state = 'TEAM_MEMBER';
    } else if (isPendingJoin) {
      state = 'JOIN_REQUEST_PENDING';
    } else if (reg?.status === 'registered') {
      state = 'REGISTERED_INDIVIDUAL';
    }

    let teamDetails = null;
    if (team) {
      const confirmedRegistered = team.members ? team.members.filter(m => m.status === 'confirmed').length : 0;
      const manualCount = team.manualPlayers?.length || 0;
      const confirmedSize = confirmedRegistered + manualCount;
      const isFull = confirmedSize >= sport.maximumTeamSize;
      teamDetails = {
        _id: team._id,
        name: team.name,
        captain: team.captain,
        captainConfirmed: team.captainConfirmed,
        isCaptain,
        members: team.members || [],
        manualPlayers: team.manualPlayers || [],
        confirmedSize,
        minimumTeamSize: sport.minimumTeamSize,
        maximumTeamSize: sport.maximumTeamSize,
        status: team.status,
        terminationReason: team.terminationReason,
        isFull
      };
    }

    res.json({
      status: state,
      event: {
        _id: event._id,
        eventName: event.eventName,
        registrationDeadline: event.registrationDeadline,
        teamFormationDeadline: event.teamFormationDeadline
      },
      sport: {
        _id: sport._id,
        sportName: sport.sportName,
        minimumTeamSize: sport.minimumTeamSize,
        maximumTeamSize: sport.maximumTeamSize,
        competitionType: sport.competitionType
      },
      registration: reg ? { _id: reg._id, type: reg.type, status: reg.status } : null,
      team: teamDetails
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/sports/:sportId/teams', async (req, res) => {
  try {
    const event = await OrganizerEvent.findById(req.params.id);
    const sport = sportFor(event, req.params.sportId);
    if (!sport || sport.competitionType !== 'team') return res.status(404).json({ error: 'Team sport not found.' });

    await checkTeamDeadlines(event);

    const teams = await EventTeam.find({
      event: event._id,
      sportConfigId: sport._id,
      status: { $nin: ['terminated', 'completed'] }
    })
    .populate('captain', 'name athleteId email contactPhone')
    .populate('members.athlete', 'name athleteId email contactPhone');

    const mapped = teams
      .map(t => {
        const confirmedRegistered = t.members.filter(m => m.status === 'confirmed').length;
        const manualCount = t.manualPlayers?.length || 0;
        const confirmedSize = confirmedRegistered + manualCount;
        const isFull = confirmedSize >= sport.maximumTeamSize;
        const isMyTeam = String(t.captain?._id || t.captain) === String(req.user._id) ||
          t.members.some(m => String(m.athlete?._id || m.athlete) === String(req.user._id) && m.status === 'confirmed');
        const hasPendingRequest = t.joinRequests?.some(r => String(r.athlete?._id || r.athlete) === String(req.user._id) && r.status === 'pending');
        return {
          ...t.toJSON(),
          confirmedSize,
          maximumTeamSize: sport.maximumTeamSize,
          minimumTeamSize: sport.minimumTeamSize,
          isFull,
          isMyTeam,
          hasPendingRequest
        };
      })
      .filter(t => !t.isMyTeam && !t.hasPendingRequest && !t.isFull);

    res.json({ teams: mapped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/sports/:sportId/teams', async (req, res) => {
  try {
    const event = await OrganizerEvent.findById(req.params.id);
    const sport = sportFor(event, req.params.sportId);
    if (!sport || sport.competitionType !== 'team') return res.status(400).json({ error: 'Team sport not found.' });
    if (new Date() > new Date(event.registrationDeadline)) return res.status(400).json({ error: 'Registration deadline has passed.' });
    if (new Date() > new Date(event.teamFormationDeadline || event.registrationDeadline)) return res.status(400).json({ error: 'Team formation deadline has passed.' });
    if (!sameSport(sport.sportName, req.user.sport)) return res.status(403).json({ error: 'Your registered sport is not included in this event.' });

    const existingCreatorTeam = await EventTeam.findOne({
      event: event._id,
      sportConfigId: sport._id,
      $or: [
        { captain: req.user._id },
        { 'members.athlete': req.user._id }
      ],
      status: { $nin: ['terminated', 'completed'] }
    });
    if (existingCreatorTeam) {
      return res.status(409).json({ error: 'You are already captain or member of an active team for this event sport.' });
    }

    const captainId = req.body.captainId || req.user._id;
    const User = require('../models/User');
    const captain = await User.findOne({ _id: captainId, role: 'athlete' });
    if (!captain) return res.status(400).json({ error: 'Captain must be an existing registered athlete.' });

    // Validate manual external players
    const rawManual = Array.isArray(req.body.manualPlayers) ? req.body.manualPlayers : [];
    const manualPlayers = [];
    const seenMobiles = new Set();
    for (const p of rawManual) {
      const name = String(p.name || '').trim();
      const mobileDigits = String(p.mobile || '').replace(/\D/g, '');
      const email = String(p.email || '').trim().toLowerCase();
      if (!name) return res.status(400).json({ error: 'Each manual player must have a valid name.' });
      if (!mobileDigits || mobileDigits.length < 10 || mobileDigits.length > 13) {
        return res.status(400).json({ error: `Invalid mobile number for player "${name}". Must be at least 10 digits.` });
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: `Invalid email address for player "${name}".` });
      }
      if (seenMobiles.has(mobileDigits)) {
        return res.status(400).json({ error: `Duplicate manual player with mobile "${p.mobile}" in the same team.` });
      }
      seenMobiles.add(mobileDigits);
      manualPlayers.push({ name, mobile: p.mobile.trim(), email });
    }

    const registeredIds = [...new Set([String(req.user._id), ...((req.body.memberIds || []).map(String)), String(captainId)])];
    const totalSize = registeredIds.length + manualPlayers.length;

    if (totalSize > sport.maximumTeamSize) {
      return res.status(400).json({ error: `Team size (${totalSize}) exceeds the maximum allowed team size of ${sport.maximumTeamSize}.` });
    }

    // Check if any registered member already participates in this event sport
    const existing = await EventRegistration.findOne({
      event: event._id,
      sportConfigId: sport._id,
      athlete: { $in: registeredIds },
      status: { $in: ['confirmed', 'registered', 'team_incomplete', 'join_request_pending'] }
    });
    if (existing) {
      return res.status(409).json({ error: 'A member is already registered or part of another team for this event sport.' });
    }

    const captainConfirmed = String(captainId) === String(req.user._id);
    const ready = totalSize >= sport.minimumTeamSize && captainConfirmed;

    const team = await EventTeam.create({
      event: event._id,
      sportConfigId: sport._id,
      name: String(req.body.name || '').trim(),
      captain: captainId,
      captainConfirmed,
      status: ready ? 'confirmed' : 'forming',
      members: registeredIds.map(athlete => ({
        athlete,
        status: String(athlete) === String(captainId) && !captainConfirmed ? 'pending_captain' : 'confirmed'
      })),
      manualPlayers
    });

    await EventRegistration.insertMany(registeredIds.map(athlete => ({
      event: event._id,
      sportConfigId: sport._id,
      athlete,
      type: 'team',
      team: team._id,
      status: String(athlete) === String(captainId) && !captainConfirmed ? 'pending' : (ready ? 'confirmed' : 'team_incomplete')
    })));

    res.status(201).json({ team });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'A team with this name already exists for this event sport.' });
    res.status(500).json({ error: err.message });
  }
});

router.post('/teams/:teamId/join-requests', async (req, res) => {
  try {
    const team = await EventTeam.findById(req.params.teamId);
    const event = await OrganizerEvent.findById(team?.event);
    const sport = sportFor(event, team?.sportConfigId);
    if (!team || !sport || team.status === 'terminated') return res.status(404).json({ error: 'Team is not available.' });
    if (new Date() > new Date(event.registrationDeadline)) return res.status(400).json({ error: 'Registration deadline has passed.' });

    const confirmedCount = team.members.filter(x => x.status === 'confirmed').length + (team.manualPlayers?.length || 0);
    if (confirmedCount >= sport.maximumTeamSize) return res.status(400).json({ error: 'Team is full.' });
    if (!sameSport(sport.sportName, req.user.sport)) return res.status(403).json({ error: 'Your registered sport does not match this team.' });

    const existingReg = await EventRegistration.findOne({
      event: event._id,
      sportConfigId: sport._id,
      athlete: req.user._id,
      status: { $in: ['confirmed', 'registered', 'team_incomplete', 'join_request_pending'] }
    });
    if (existingReg) {
      if (existingReg.status === 'join_request_pending') return res.status(409).json({ error: 'A join request is already pending for this team/sport.' });
      return res.status(409).json({ error: 'You are already registered or part of a team for this event sport.' });
    }

    if (team.joinRequests.some(r => String(r.athlete) === String(req.user._id) && r.status === 'pending')) {
      return res.status(409).json({ error: 'A join request is already pending.' });
    }

    team.joinRequests.push({ athlete: req.user._id, status: 'pending' });
    await team.save();

    await EventRegistration.create({
      event: event._id,
      sportConfigId: sport._id,
      athlete: req.user._id,
      type: 'team',
      team: team._id,
      status: 'join_request_pending'
    });

    res.status(201).json({ team, message: 'Join request sent successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/teams/:teamId/join-requests/:athleteId/:action', async (req, res) => {
  try {
    const team = await EventTeam.findById(req.params.teamId);
    if (!team || String(team.captain) !== String(req.user._id)) return res.status(403).json({ error: 'Only the team captain can action join requests.' });
    const event = await OrganizerEvent.findById(team.event);
    const sport = sportFor(event, team.sportConfigId);
    const request = team.joinRequests.find(r => String(r.athlete) === req.params.athleteId && r.status === 'pending');
    if (!request || !['accept', 'reject'].includes(req.params.action)) return res.status(400).json({ error: 'Pending request not found.' });

    if (req.params.action === 'accept') {
      const currentSize = team.members.filter(x => x.status === 'confirmed').length + (team.manualPlayers?.length || 0);
      if (currentSize >= sport.maximumTeamSize) return res.status(400).json({ error: 'Team is already full.' });
      request.status = 'accepted';
      team.members.push({ athlete: request.athlete, status: 'confirmed' });
      const newTotal = currentSize + 1;
      if (newTotal >= sport.minimumTeamSize && team.captainConfirmed) {
        team.status = 'confirmed';
      }
      await EventRegistration.updateOne(
        { event: event._id, sportConfigId: sport._id, athlete: request.athlete, team: team._id },
        { status: newTotal >= sport.minimumTeamSize ? 'confirmed' : 'team_incomplete' }
      );
    } else {
      request.status = 'rejected';
      await EventRegistration.updateOne(
        { event: event._id, sportConfigId: sport._id, athlete: request.athlete, team: team._id },
        { status: 'rejected' }
      );
    }
    await team.save();
    res.json({ team, message: `Request ${req.params.action}ed.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/teams/:teamId/captain/confirm', async (req, res) => {
  try {
    const team = await EventTeam.findById(req.params.teamId);
    if (!team || String(team.captain) !== String(req.user._id)) return res.status(403).json({ error: 'Only the nominated captain can confirm captaincy.' });
    team.captainConfirmed = true;
    const member = team.members.find(m => String(m.athlete) === String(req.user._id));
    if (member) member.status = 'confirmed';
    await EventRegistration.updateOne({ team: team._id, athlete: req.user._id }, { $set: { status: 'team_incomplete' } });
    await team.save();
    res.json({ team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/teams/:teamId/captain/transfer', async (req, res) => {
  try {
    const team = await EventTeam.findById(req.params.teamId);
    if (!team || String(team.captain) !== String(req.user._id)) return res.status(403).json({ error: 'Only the current team captain can transfer captaincy.' });
    const newCaptainId = req.body.newCaptainId;
    const isMember = team.members.find(m => String(m.athlete) === String(newCaptainId) && m.status === 'confirmed');
    if (!isMember) return res.status(400).json({ error: 'The new captain must be a confirmed member of the team.' });
    team.captain = newCaptainId;
    team.captainConfirmed = true;
    await team.save();
    res.json({ team, message: 'Captaincy successfully transferred.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/teams/:teamId/join-requests/cancel', async (req, res) => {
  try {
    const team = await EventTeam.findById(req.params.teamId);
    if (!team) return res.status(404).json({ error: 'Team not found.' });
    const request = team.joinRequests.find(r => String(r.athlete) === String(req.user._id) && r.status === 'pending');
    if (!request) return res.status(404).json({ error: 'Pending request not found.' });
    request.status = 'cancelled';
    await team.save();
    await EventRegistration.deleteOne({
      event: team.event,
      sportConfigId: team.sportConfigId,
      athlete: req.user._id,
      status: 'join_request_pending'
    });
    res.json({ message: 'Pending join request cancelled.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/teams/:teamId/members', async (req, res) => {
  try {
    const team = await EventTeam.findById(req.params.teamId);
    if (!team) return res.status(404).json({ error: 'Team not found.' });
    if (String(team.captain) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Only the team captain can add members to this team.' });
    }
    if (team.status === 'terminated') {
      return res.status(400).json({ error: 'Cannot add members to a terminated team.' });
    }

    const event = await OrganizerEvent.findById(team.event);
    const sport = sportFor(event, team.sportConfigId);
    if (!event || !sport) return res.status(404).json({ error: 'Event or sport not found.' });

    if (new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({ error: 'Registration deadline has passed.' });
    }
    if (new Date() > new Date(event.teamFormationDeadline || event.registrationDeadline)) {
      return res.status(400).json({ error: 'Team formation deadline has passed.' });
    }

    const confirmedRegistered = team.members.filter(m => m.status === 'confirmed').length;
    const manualCount = team.manualPlayers?.length || 0;
    const currentSize = confirmedRegistered + manualCount;

    if (currentSize >= sport.maximumTeamSize) {
      return res.status(400).json({ error: `Team is already full (${sport.maximumTeamSize} athletes).` });
    }

    const { type, manualPlayer, athleteId } = req.body;

    if (type === 'manual') {
      if (!manualPlayer) return res.status(400).json({ error: 'Manual player details required.' });
      const name = String(manualPlayer.name || '').trim();
      const mobileDigits = String(manualPlayer.mobile || '').replace(/\D/g, '');
      const email = String(manualPlayer.email || '').trim().toLowerCase();

      if (!name) return res.status(400).json({ error: 'Player name is required.' });
      if (!mobileDigits || mobileDigits.length < 10 || mobileDigits.length > 13) {
        return res.status(400).json({ error: 'Valid 10-digit mobile number is required.' });
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email address.' });
      }

      const duplicate = team.manualPlayers.some(p => p.mobile.replace(/\D/g, '') === mobileDigits);
      if (duplicate) {
        return res.status(400).json({ error: 'A player with this mobile number is already added to the team.' });
      }

      team.manualPlayers.push({ name, mobile: manualPlayer.mobile.trim(), email });
    } else if (type === 'registered') {
      if (!athleteId) return res.status(400).json({ error: 'Athlete ID is required.' });
      const User = require('../models/User');
      const athlete = await User.findOne({ _id: athleteId, role: 'athlete' });
      if (!athlete) return res.status(404).json({ error: 'Registered athlete not found.' });

      if (String(athlete._id) === String(team.captain) || team.members.some(m => String(m.athlete) === String(athlete._id))) {
        return res.status(400).json({ error: 'Athlete is already in this team.' });
      }

      const existingReg = await EventRegistration.findOne({
        event: event._id,
        sportConfigId: sport._id,
        athlete: athlete._id,
        status: { $in: ['confirmed', 'registered', 'team_incomplete', 'join_request_pending'] }
      });
      if (existingReg) {
        return res.status(409).json({ error: 'This athlete is already registered or part of another team for this event sport.' });
      }

      team.members.push({ athlete: athlete._id, status: 'confirmed' });

      const newTotal = currentSize + 1;
      const ready = newTotal >= sport.minimumTeamSize && team.captainConfirmed;

      await EventRegistration.create({
        event: event._id,
        sportConfigId: sport._id,
        athlete: athlete._id,
        type: 'team',
        team: team._id,
        status: ready ? 'confirmed' : 'team_incomplete'
      });
    } else {
      return res.status(400).json({ error: 'Invalid member type. Must be "manual" or "registered".' });
    }

    const newTotal = currentSize + 1;
    const ready = newTotal >= sport.minimumTeamSize && team.captainConfirmed;
    if (ready && team.status === 'forming') {
      team.status = 'confirmed';
      await EventRegistration.updateMany(
        { team: team._id, status: 'team_incomplete' },
        { $set: { status: 'confirmed' } }
      );
    }

    await team.save();

    const updated = await EventTeam.findById(team._id)
      .populate('captain', 'name athleteId email contactPhone')
      .populate('members.athlete', 'name athleteId email contactPhone');

    const confirmedCount = updated.members.filter(m => m.status === 'confirmed').length + (updated.manualPlayers?.length || 0);

    res.json({
      message: 'Member added successfully.',
      team: {
        ...updated.toJSON(),
        confirmedSize: confirmedCount,
        minimumTeamSize: sport.minimumTeamSize,
        maximumTeamSize: sport.maximumTeamSize,
        isFull: confirmedCount >= sport.maximumTeamSize
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/teams/:teamId/members', async (req, res) => {
  try {
    const team = await EventTeam.findById(req.params.teamId);
    if (!team) return res.status(404).json({ error: 'Team not found.' });
    if (String(team.captain) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Only the team captain can remove members.' });
    }
    const event = await OrganizerEvent.findById(team.event);
    const sport = sportFor(event, team.sportConfigId);
    if (!event || !sport) return res.status(404).json({ error: 'Event or sport not found.' });

    if (new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({ error: 'Cannot modify team after registration deadline.' });
    }

    const { type, athleteId, manualIndex } = req.body;
    if (type === 'registered' && athleteId) {
      if (String(athleteId) === String(team.captain)) {
        return res.status(400).json({ error: 'Cannot remove the team captain. Transfer captaincy first.' });
      }
      team.members = team.members.filter(m => String(m.athlete) !== String(athleteId));
      await EventRegistration.deleteOne({ team: team._id, athlete: athleteId });
    } else if (type === 'manual' && typeof manualIndex === 'number') {
      if (manualIndex >= 0 && manualIndex < team.manualPlayers.length) {
        team.manualPlayers.splice(manualIndex, 1);
      }
    } else {
      return res.status(400).json({ error: 'Invalid remove request.' });
    }

    const confirmedRegistered = team.members.filter(m => m.status === 'confirmed').length;
    const manualCount = team.manualPlayers.length;
    const newTotal = confirmedRegistered + manualCount;

    if (newTotal < sport.minimumTeamSize && team.status === 'confirmed') {
      team.status = 'forming';
      await EventRegistration.updateMany(
        { team: team._id, status: 'confirmed' },
        { $set: { status: 'team_incomplete' } }
      );
    }

    await team.save();

    const updated = await EventTeam.findById(team._id)
      .populate('captain', 'name athleteId email contactPhone')
      .populate('members.athlete', 'name athleteId email contactPhone');

    const confirmedCount = updated.members.filter(m => m.status === 'confirmed').length + (updated.manualPlayers?.length || 0);

    res.json({
      message: 'Member removed.',
      team: {
        ...updated.toJSON(),
        confirmedSize: confirmedCount,
        minimumTeamSize: sport.minimumTeamSize,
        maximumTeamSize: sport.maximumTeamSize,
        isFull: confirmedCount >= sport.maximumTeamSize
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my/registrations', async (req, res) => {
  try {
    const registrations = await EventRegistration.find({ athlete: req.user._id })
      .populate({
        path: 'event',
        select: 'eventName eventDate venue sports organizer registrationDeadline teamFormationDeadline',
        populate: { path: 'organizer', select: 'name organizationName organizerId' }
      })
      .populate({
        path: 'team',
        select: 'name status captain captainConfirmed members manualPlayers',
        populate: [
          { path: 'captain', select: 'name athleteId email contactPhone' },
          { path: 'members.athlete', select: 'name athleteId email contactPhone' }
        ]
      })
      .sort({ createdAt: -1 });
    res.json({ registrations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get('/my/achievements', async (req, res) => { const achievements = await OrganizerAchievement.find({ athlete: req.user._id }).populate('event', 'eventName eventDate').populate('organizer', 'name organizationName organizerId').sort({ createdAt: -1 }); res.json({ achievements }); });
router.get('/athletes/search', async (req, res) => { const q = String(req.query.q || '').trim(); if (q.length < 2) return res.json({ athletes: [] }); const athletes = await require('../models/User').find({ role: 'athlete', $or: [{ athleteId: new RegExp(escaped(q), 'i') }, { email: new RegExp(escaped(q), 'i') }, { contactPhone: new RegExp(escaped(q), 'i') }] }).select('name athleteId email contactPhone sport').limit(10); res.json({ athletes }); });
module.exports = router;
