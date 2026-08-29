const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Sponsorship = require('../models/Sponsorship');

// GET /api/sponsor/athletes?sport=Taekwondo&region=Vijayawada
router.get('/athletes', async (req, res) => {
  const query = { role: 'athlete', seekingSponsorship: true };
  if (req.query.sport) query.sport = req.query.sport;
  if (req.query.city) query.city = req.query.city;
  const athletes = await User.find(query).select('-passwordHash');
  res.json(athletes);
});

// POST /api/sponsor/:sponsorId/sponsor  { athleteId, supportType, amount, message }
router.post('/:sponsorId/sponsor', async (req, res) => {
  const sponsorship = await Sponsorship.create({
    sponsor: req.params.sponsorId,
    athlete: req.body.athleteId,
    supportType: req.body.supportType,
    amount: req.body.amount,
    message: req.body.message
  });
  res.status(201).json(sponsorship);
});

module.exports = router;
