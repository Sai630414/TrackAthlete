const express = require('express');
const router = express.Router();
const Recommendation = require('../models/Recommendation');
const { verifyToken, requireRoles } = require('../middleware/auth.middleware');
const { serializeAcademyProfile } = require('../utils/serializers');
const {
  getAthleteHighestVerifiedLevelPerSport,
  generateAthleteRecommendations
} = require('../utils/recommendationEngine');

/**
 * GET /api/recommendations
 * Returns personalized recommendations for the authenticated athlete.
 * Read-only from DB (Rule 28).
 */
router.get('/', verifyToken, requireRoles('athlete'), async (req, res) => {
  try {
    const recommendations = await Recommendation.find({ athleteId: req.user._id })
      .populate('academyId')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = recommendations.map(rec => {
      const academyData = rec.academyId ? serializeAcademyProfile(rec.academyId, 'athlete') : null;

      return {
        id: rec._id,
        _id: rec._id,
        academyId: academyData?.academyId || rec.academyId?._id || rec.academyId,
        academy: academyData,
        sport: rec.sport,
        athleteAchievementLevel: rec.athleteAchievementLevel,
        academyAchievementLevel: rec.academyAchievementLevel,
        basedOnAchievementId: rec.basedOnAchievementId,
        basedOnAchievementSource: rec.basedOnAchievementSource,
        reason: rec.reason,
        status: rec.status,
        viewedAt: rec.viewedAt,
        createdAt: rec.createdAt
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching athlete recommendations:', err);
    res.status(500).json({ error: 'Failed to fetch recommendations: ' + err.message });
  }
});

/**
 * GET /api/recommendations/unread-count
 * Returns count of unread recommendations for the authenticated athlete.
 */
router.get('/unread-count', verifyToken, requireRoles('athlete'), async (req, res) => {
  try {
    const count = await Recommendation.countDocuments({
      athleteId: req.user._id,
      status: 'UNREAD'
    });
    res.json({ count });
  } catch (err) {
    console.error('Error counting unread recommendations:', err);
    res.status(500).json({ error: 'Failed to fetch unread count: ' + err.message });
  }
});

/**
 * PATCH /api/recommendations/:id/view
 * Marks a specific recommendation as VIEWED.
 * Strictly verifies ownership server-side (Rule 31 & 40).
 */
router.patch('/:id/view', verifyToken, requireRoles('athlete'), async (req, res) => {
  try {
    const rec = await Recommendation.findById(req.params.id);
    if (!rec) {
      return res.status(404).json({ error: 'Recommendation not found.' });
    }

    if (String(rec.athleteId) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Unauthorized. You cannot view another athlete’s recommendation.' });
    }

    rec.status = 'VIEWED';
    rec.viewedAt = new Date();
    await rec.save();

    res.json({
      success: true,
      id: rec._id,
      status: rec.status,
      viewedAt: rec.viewedAt
    });
  } catch (err) {
    console.error('Error marking recommendation as viewed:', err);
    res.status(500).json({ error: 'Failed to update recommendation status: ' + err.message });
  }
});

/**
 * GET /api/recommendations/athlete-summary
 * Returns the authenticated athlete's highest verified achievement PER SPORT.
 * Excludes self-uploaded documents (Rule 32).
 */
router.get('/athlete-summary', verifyToken, requireRoles('athlete'), async (req, res) => {
  try {
    const perSport = await getAthleteHighestVerifiedLevelPerSport(req.user._id, req.user.athleteId);
    const summaryList = Object.values(perSport).map(item => ({
      sport: item.sport,
      level: item.highestLevel,
      outcome: item.outcome,
      tournamentName: item.tournamentName,
      sourceType: item.sourceType,
      sourceAchievementId: item.sourceAchievementId
    }));
    res.json(summaryList);
  } catch (err) {
    console.error('Error fetching athlete achievement summary:', err);
    res.status(500).json({ error: 'Failed to fetch achievement summary: ' + err.message });
  }
});

/**
 * POST /api/recommendations/revalidate
 * Explicit controlled revalidation trigger (Rule 28).
 */
router.post('/revalidate', verifyToken, requireRoles('athlete'), async (req, res) => {
  try {
    const recs = await generateAthleteRecommendations(req.user._id);
    res.json({ success: true, count: recs.length });
  } catch (err) {
    console.error('Error revalidating recommendations:', err);
    res.status(500).json({ error: 'Failed to revalidate recommendations: ' + err.message });
  }
});

module.exports = router;
