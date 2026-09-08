const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Connection = require('../models/Connection');
const User = require('../models/User');
const { withoutAadhaar } = require('../utils/aadhaar');
const { serializeAthleteProfile, serializeCoachProfile } = require('../utils/serializers');

let _io = null;
router.use((req, _res, next) => { _io = req.app.get('io'); next(); });

// GET /api/coach/:id/requests — pending mentorship requests
router.get('/:id/requests', async (req, res) => {
  try {
    const rawRequests = await Connection.find({ coach: req.params.id, status: 'Pending' })
      .populate('athlete', '-passwordHash -aadhaarHash -resetPasswordOTP -resetPasswordToken')
      .sort({ createdAt: -1 });

    const requests = rawRequests.map(r => {
      const obj = r.toObject();
      if (obj.athlete) {
        obj.athlete = serializeAthleteProfile(obj.athlete, 'coach', false);
      }
      return obj;
    });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/coach/:id/athletes — active connections (My Athletes)
router.get('/:id/athletes', async (req, res) => {
  try {
    const rawAthletes = await Connection.find({ coach: req.params.id, status: 'Active' })
      .populate('athlete', '-passwordHash -aadhaarHash -resetPasswordOTP -resetPasswordToken')
      .sort({ createdAt: -1 });

    const athletes = rawAthletes.map(a => {
      const obj = a.toObject();
      if (obj.athlete) {
        obj.athlete = serializeAthleteProfile(obj.athlete, 'coach', true);
      }
      return obj;
    });

    res.json(athletes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/coach/requests/:connectionId — accept or reject
router.put('/requests/:connectionId', async (req, res) => {
  try {
    const { status, rejectionNote } = req.body;
    const update = { status };
    if (rejectionNote) update.rejectionNote = rejectionNote;

    const conn = await Connection.findByIdAndUpdate(
      req.params.connectionId,
      update,
      { new: true }
    ).populate('athlete', '-passwordHash').populate('coach', '-passwordHash');

    if (!conn) return res.status(404).json({ error: 'Connection not found' });

    const io = req.app.get('io');
    if (io) {
      if (status === 'Active') {
        io.to(conn.athlete._id.toString()).emit('connection-accepted', {
          connectionId: conn._id,
          coach: { name: conn.coach.name, sport: conn.coach.sport, certifications: conn.coach.certifications }
        });
      } else if (status === 'Rejected') {
        io.to(conn.athlete._id.toString()).emit('connection-rejected', {
          connectionId: conn._id,
          coachName: conn.coach.name,
          rejectionNote: rejectionNote || ''
        });
      }
    }

    res.json(conn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/coach/:coachId/athletes/:connectionId/notes — add session note
router.post('/:coachId/athletes/:connectionId/notes', async (req, res) => {
  try {
    const { note } = req.body;
    const conn = await Connection.findOneAndUpdate(
      { _id: req.params.connectionId, coach: req.params.coachId, status: 'Active' },
      { $push: { sessionNotes: { date: new Date(), note } } },
      { new: true }
    ).populate('athlete', '-passwordHash');

    if (!conn) return res.status(404).json({ error: 'Active connection not found' });
    res.json(conn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/coach/:id/profile — fetch complete coach profile
router.get('/:id/profile', async (req, res) => {
  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
    const orConditions = [
      { coachId: req.params.id },
      { trackAthleteId: req.params.id }
    ];
    if (isObjectId) {
      orConditions.unshift({ _id: req.params.id });
    }

    const coach = await User.findOne({
      $or: orConditions,
      role: 'coach'
    });

    if (!coach) return res.status(404).json({ error: 'Coach not found' });
    const serialized = serializeCoachProfile(coach, 'coach');
    res.json(serialized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/coach/:id/certificate — download or view coach certificate PDF
router.get('/:id/certificate', async (req, res) => {
  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
    const orConditions = [
      { coachId: req.params.id },
      { trackAthleteId: req.params.id }
    ];
    if (isObjectId) {
      orConditions.unshift({ _id: req.params.id });
    }

    const coach = await User.findOne({
      $or: orConditions,
      role: 'coach'
    }).select('certificateData certificateFileName certificateFileSize name coachId');

    if (!coach || !coach.certificateData) {
      return res.status(404).json({ error: 'Coaching certificate PDF not found for this coach.' });
    }

    res.json({
      certificateData: coach.certificateData,
      certificateFileName: coach.certificateFileName || `${coach.name || 'Coach'}_Certificate.pdf`,
      certificateFileSize: coach.certificateFileSize || 0,
      coachId: coach.coachId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
