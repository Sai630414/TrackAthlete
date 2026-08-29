const express = require('express');
const router = express.Router();
const Connection = require('../models/Connection');

let _io = null;
router.use((req, _res, next) => { _io = req.app.get('io'); next(); });

// GET /api/coach/:id/requests — pending mentorship requests
router.get('/:id/requests', async (req, res) => {
  try {
    const requests = await Connection.find({ coach: req.params.id, status: 'Pending' })
      .populate('athlete', '-passwordHash')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/coach/:id/athletes — active connections (My Athletes)
router.get('/:id/athletes', async (req, res) => {
  try {
    const athletes = await Connection.find({ coach: req.params.id, status: 'Active' })
      .populate('athlete', '-passwordHash')
      .sort({ createdAt: -1 });
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

module.exports = router;
