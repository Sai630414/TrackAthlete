const express = require('express');
const router = express.Router();
const OfficialAchievement = require('../models/OfficialAchievement');

// GET /api/verify/:recordId — Public & Authorized Verification Portal
router.get('/:recordId', async (req, res) => {
  try {
    const rawId = String(req.params.recordId).trim().toUpperCase();

    const achievement = await OfficialAchievement.findOne({
      $or: [
        { officialRecordId: rawId },
        { _id: rawId.match(/^[0-[#173235]a-fA-F]{24}$/) ? rawId : null }
      ]
    })
    .populate('federation', 'name federationId sport state officialEmail')
    .populate('event', 'eventName eventId submissionDeadline isFrozen');

    if (!achievement) {
      return res.status(404).json({
        status: 'NOT_FOUND',
        verified: false,
        error: `No official federation record found for Record ID '${rawId}'.`
      });
    }

    // Determine current freeze status
    let currentStatus = achievement.verificationStatus || 'VERIFIED';
    if (achievement.event && achievement.event.submissionDeadline && new Date() > new Date(achievement.event.submissionDeadline)) {
      if (currentStatus !== 'REVOKED') {
        currentStatus = 'FROZEN';
      }
    }

    // Sanitize non-sensitive public response (No passwords, JWTs, or raw Aadhaar numbers)
    const verificationRecord = {
      verified: currentStatus !== 'REVOKED',
      officialRecordId: achievement.officialRecordId,
      verificationStatus: currentStatus,
      athleteName: achievement.athleteName,
      athleteId: achievement.athleteId || 'ATH-RECORD',
      federationName: achievement.federation?.name || 'Recognized Sports Federation',
      federationId: achievement.federation?.federationId || 'FED-OFFICIAL',
      federationState: achievement.federation?.state || 'National',
      tournamentName: achievement.tournamentName,
      sport: achievement.sport,
      category: achievement.category,
      achievementType: achievement.achievementType,
      medal: achievement.medal,
      rank: achievement.rank,
      year: achievement.year,
      eventDate: achievement.eventDate,
      description: achievement.description,
      hasCertificate: Boolean(achievement.certificateData),
      certificateData: achievement.certificateData,
      certificateFileName: achievement.certificateFileName || 'official_certificate.pdf',
      issuedAt: achievement.createdAt
    };

    res.json(verificationRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
