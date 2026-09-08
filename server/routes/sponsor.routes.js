const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Sponsorship = require('../models/Sponsorship');

const { serializeAthleteProfile } = require('../utils/serializers');

// GET /api/sponsor/athletes?sport=Taekwondo&city=Vijayawada
router.get('/athletes', async (req, res) => {
  try {
    const query = {
      role: 'athlete',
      $or: [
        { activelySeekingSponsorship: true },
        { seekingSponsorship: true }
      ]
    };

    if (req.query.sport) {
      const spClean = String(req.query.sport).trim();
      const reg = new RegExp('^' + spClean.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i');
      query.$and = [
        { $or: [{ sports: { $in: [reg] } }, { sport: reg }] }
      ];
    }
    if (req.query.city) {
      query.city = new RegExp('^' + String(req.query.city).trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i');
    }

    const rawAthletes = await User.find(query)
      .sort({ createdAt: -1 });

    const athletes = rawAthletes.map(a => serializeAthleteProfile(a, 'sponsor'));
    res.json(athletes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
