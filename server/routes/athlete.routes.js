const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Connection = require('../models/Connection');

// GET /api/athlete/coaches or /api/athlete/coaches/list — list all coaches
router.get('/coaches', async (req, res) => {
  try {
    const coaches = await User.find({ role: 'coach', acceptingAthletes: { $ne: false } })
      .select('-passwordHash')
      .sort({ yearsExperience: -1 });
    res.json(coaches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/coaches/list', async (req, res) => {
  try {
    const coaches = await User.find({ role: 'coach', acceptingAthletes: { $ne: false } })
      .select('-passwordHash')
      .sort({ yearsExperience: -1 });
    res.json(coaches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/athlete/:id/profile
router.get('/:id/profile', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/athlete/:id/profile
router.put('/:id/profile', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-passwordHash');
    res.json(user);
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
      const athlete = await User.findById(req.params.id).select('-passwordHash');
      io.to(coachId).emit('connection-request', {
        connectionId: conn._id,
        athlete: {
          _id: athlete._id,
          name: athlete.name,
          sport: athlete.sport,
          beltRank: athlete.beltRank,
          achievements: athlete.achievements,
          videoLink: athlete.videoLink,
          city: athlete.city,
          state: athlete.state
        },
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
