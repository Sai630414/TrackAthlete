const express = require('express');
const router = express.Router();
const FederationStatus = require('../models/FederationStatus');
const SportsQuota = require('../models/SportsQuota');

// GET /api/reference/federation-status?sport=Taekwondo&state=Andhra Pradesh
router.get('/federation-status', async (req, res) => {
  const { sport, state } = req.query;
  const status = await FederationStatus.findOne({ sport, state });
  res.json(status || { message: 'No record found for this sport/state combination.' });
});

// GET /api/reference/sports-quota?sport=Taekwondo
router.get('/sports-quota', async (req, res) => {
  const query = {};
  if (req.query.sport) query.sport = req.query.sport;
  const results = await SportsQuota.find(query);
  res.json(results);
});

module.exports = router;
