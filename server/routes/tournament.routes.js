const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');

// GET /api/tournaments?sport=Taekwondo&city=Vijayawada
router.get('/', async (req, res) => {
  const query = {};
  if (req.query.sport) query.sport = req.query.sport;
  if (req.query.city) query.city = req.query.city;
  const tournaments = await Tournament.find(query).sort({ date: 1 });
  res.json(tournaments);
});

// POST /api/tournaments/:id/interest  { userId }
router.post('/:id/interest', async (req, res) => {
  const t = await Tournament.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { interestedUsers: req.body.userId } },
    { new: true }
  );
  res.json(t);
});

module.exports = router;
