const express = require('express');
const router = express.Router();
const Academy = require('../models/Academy');

// POST /api/academy  — self-service listing creation
router.post('/', async (req, res) => {
  const academy = await Academy.create({ ...req.body, verified: false });
  res.status(201).json(academy);
});

// GET /api/academy?city=Vijayawada&sport=Taekwondo
router.get('/', async (req, res) => {
  const query = {};
  if (req.query.city) query.city = req.query.city;
  if (req.query.sport) query.sports = req.query.sport;
  const academies = await Academy.find(query);
  res.json(academies);
});

// PUT /api/academy/:id/verify — admin-only in a real build
router.put('/:id/verify', async (req, res) => {
  const academy = await Academy.findByIdAndUpdate(req.params.id, { verified: true }, { new: true });
  res.json(academy);
});

module.exports = router;
