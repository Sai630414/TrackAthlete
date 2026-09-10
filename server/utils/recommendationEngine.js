const mongoose = require('mongoose');
const User = require('../models/User');
const Academy = require('../models/Academy');
const AcademyAthleteMembership = require('../models/AcademyAthleteMembership');
const OfficialAchievement = require('../models/OfficialAchievement');
const OrganizerAchievement = require('../models/OrganizerAchievement');
require('../models/OfficialEvent');
require('../models/OrganizerEvent');
const Recommendation = require('../models/Recommendation');
const {
  LEVEL_RANKS,
  ACADEMY_THRESHOLDS,
  normalizeSport,
  getCompetitionRank,
  resolveCompetitionLevel,
  calculateAchievementLevelFromStats
} = require('./academyRanking');

const MEDAL_SCORES = {
  gold: 4,
  '1st': 4,
  silver: 3,
  '2nd': 3,
  bronze: 2,
  '3rd': 2,
  participation: 1,
  default: 1
};

function getMedalPriority(medalStr) {
  if (!medalStr) return 1;
  const lower = String(medalStr).trim().toLowerCase();
  for (const [key, val] of Object.entries(MEDAL_SCORES)) {
    if (lower.includes(key)) return val;
  }
  return 1;
}

/**
 * Calculates the highest verified competition achievement per sport for an athlete.
 * Excludes self-uploaded documents.
 */
async function getAthleteHighestVerifiedLevelPerSport(athleteUserId, athleteId = null) {
  if (!athleteUserId) return {};

  const userObjId = typeof athleteUserId === 'string' ? new mongoose.Types.ObjectId(athleteUserId) : athleteUserId;

  // 1. Authoritative Federation Recognized Achievements ONLY
  const officialQuery = {
    $or: [
      { athleteUserId: userObjId },
      ...(athleteId ? [{ athleteId: String(athleteId).trim() }] : [])
    ],
    verificationStatus: { $ne: 'REVOKED' }
  };

  const officialAchs = await OfficialAchievement.find(officialQuery)
    .populate('event')
    .lean();

  const perSport = {};

  // Process Federation achievements ONLY
  for (const ach of officialAchs) {
    const sport = normalizeSport(ach.sport || ach.event?.sport);
    if (!sport) continue;

    const compLevel = resolveCompetitionLevel(ach, ach.event);
    if (!compLevel) continue;

    const rank = getCompetitionRank(compLevel);
    if (!rank) continue;

    const outcome = ach.medal || (ach.rank ? `Rank ${ach.rank}` : 'Verified');
    const medalPriority = getMedalPriority(ach.medal);

    if (
      !perSport[sport] ||
      rank > perSport[sport].highestLevelRank ||
      (rank === perSport[sport].highestLevelRank && medalPriority > perSport[sport].medalPriority)
    ) {
      perSport[sport] = {
        sport,
        highestLevel: compLevel,
        highestLevelRank: rank,
        outcome: String(outcome).toUpperCase(),
        medalPriority,
        tournamentName: ach.tournamentName || ach.event?.eventName || 'Official Federation Tournament',
        sourceType: 'FEDERATION_RECOGNIZED',
        sourceAchievementId: ach.officialRecordId || String(ach._id)
      };
    }
  }

  return perSport;
}

/**
 * Calculates per-sport and overall Achievement Levels for an Academy dynamically.
 */
async function getAcademyPerSportAchievementLevels(academyDoc, preloadedMemberships = null) {
  if (!academyDoc) {
    return { overallLevel: 'NOT YET QUALIFIED', overallLevelLabel: 'Achievement Level: NOT YET QUALIFIED', perSport: {} };
  }

  const memberships = preloadedMemberships || await AcademyAthleteMembership.find({
    academyId: academyDoc._id,
    status: 'ACTIVE'
  }).lean();

  const sportsOffered = (academyDoc.sports || [])
    .map(s => normalizeSport(s.sportName || s))
    .filter(Boolean);

  const perSport = {};

  for (const sport of sportsOffered) {
    // Filter active memberships for this specific sport
    const sportMembers = memberships.filter(m => normalizeSport(m.sportName) === sport);

    // Group by unique athlete identity
    const uniqueAthletesMap = new Map();
    for (const m of sportMembers) {
      const key = m.athleteUserId ? String(m.athleteUserId) : (m.athleteId ? String(m.athleteId) : (m.mobile || m.aadhaarHash));
      if (key && !uniqueAthletesMap.has(key)) {
        uniqueAthletesMap.set(key, {
          athleteUserId: m.athleteUserId,
          athleteId: m.athleteId,
          mobile: m.mobile,
          aadhaarHash: m.aadhaarHash
        });
      }
    }

    let districtCount = 0;
    let stateCount = 0;
    let nationalCount = 0;
    let internationalCount = 0;

    for (const ath of uniqueAthletesMap.values()) {
      let athleteUserId = ath.athleteUserId;
      let athleteId = ath.athleteId;

      if (!athleteUserId && !athleteId && (ath.mobile || ath.aadhaarHash)) {
        const User = require('../models/User');
        const query = [];
        if (ath.mobile) query.push({ phone: ath.mobile }, { mobile: ath.mobile });
        if (ath.aadhaarHash) query.push({ aadhaarHash: ath.aadhaarHash });
        const foundUser = await User.findOne({ $or: query }).select('_id athleteId').lean();
        if (foundUser) {
          athleteUserId = foundUser._id;
          athleteId = foundUser.athleteId;
        }
      }

      const athAchs = await getAthleteHighestVerifiedLevelPerSport(athleteUserId, athleteId);
      const sportAch = athAchs[sport];
      if (sportAch) {
        const r = sportAch.highestLevelRank;
        if (r >= LEVEL_RANKS.INTERNATIONAL) {
          internationalCount++;
          nationalCount++;
          stateCount++;
          districtCount++;
        } else if (r >= LEVEL_RANKS.NATIONAL) {
          nationalCount++;
          stateCount++;
          districtCount++;
        } else if (r >= LEVEL_RANKS.STATE) {
          stateCount++;
          districtCount++;
        } else if (r >= LEVEL_RANKS.DISTRICT) {
          districtCount++;
        }
      }
    }

    // Derive effective player stats by combining active linked verified members
    // and the academy's official representation statistics
    const effectiveStats = {
      districtPlayers: Math.max(districtCount, Number(academyDoc.rankingStats?.districtPlayers || 0)),
      statePlayers: Math.max(stateCount, Number(academyDoc.rankingStats?.statePlayers || 0)),
      nationalPlayers: Math.max(nationalCount, Number(academyDoc.rankingStats?.nationalPlayers || 0)),
      internationalPlayers: Math.max(internationalCount, Number(academyDoc.rankingStats?.internationalPlayers || 0))
    };

    const level = calculateAchievementLevelFromStats(effectiveStats);

    perSport[sport] = {
      sport,
      rankingStats: effectiveStats,
      achievementLevel: level,
      achievementLevelLabel: level !== 'NOT YET QUALIFIED' && level !== 'UNRANKED'
        ? `Achievement Level: ${level}`
        : 'Achievement Level: NOT YET QUALIFIED'
    };
  }

  // Calculate overall level as the highest qualifying level across all sports
  let maxRank = 0;
  let overallLevel = 'NOT YET QUALIFIED';
  for (const info of Object.values(perSport)) {
    const r = getCompetitionRank(info.achievementLevel);
    if (r > maxRank) {
      maxRank = r;
      overallLevel = info.achievementLevel;
    }
  }

  // Also evaluate overall level directly from official rankingStats if set
  if (academyDoc.rankingStats) {
    const directLevel = calculateAchievementLevelFromStats(academyDoc.rankingStats);
    const r = getCompetitionRank(directLevel);
    if (r > maxRank) {
      maxRank = r;
      overallLevel = directLevel;
    }
  }

  const overallLevelLabel = overallLevel !== 'NOT YET QUALIFIED' && overallLevel !== 'UNRANKED'
    ? `Achievement Level: ${overallLevel}`
    : 'Achievement Level: NOT YET QUALIFIED';

  return { overallLevel, overallLevelLabel, perSport };
}

/**
 * Idempotently evaluates and updates recommendations for a given athlete.
 * Stores only lightweight references and metadata.
 */
async function generateAthleteRecommendations(athleteUserId) {
  if (!athleteUserId) return [];

  const user = await User.findById(athleteUserId).lean();
  if (!user || user.role !== 'athlete') return [];

  // 1. Get athlete's highest verified achievement per sport
  const verifiedPerSport = await getAthleteHighestVerifiedLevelPerSport(user._id, user.athleteId);
  const verifiedSports = Object.keys(verifiedPerSport);

  // If athlete has no verified achievements in any sport, clear any existing recommendations and return empty
  if (verifiedSports.length === 0) {
    await Recommendation.deleteMany({ athleteId: user._id });
    return [];
  }

  const validRecommendationsMap = new Map(); // key: `${academyId}_${sport}`

  for (const sport of verifiedSports) {
    const athSportInfo = verifiedPerSport[sport];
    const athRank = athSportInfo.highestLevelRank;
    const athLevel = athSportInfo.highestLevel;
    const athOutcome = athSportInfo.outcome || 'VERIFIED';

    // Find academies offering this sport
    const academies = await Academy.find({
      'sports.sportName': new RegExp('^' + sport.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i'),
      verified: true
    }).lean();

    for (const academy of academies) {
      const { perSport } = await getAcademyPerSportAchievementLevels(academy);
      const acadSportInfo = perSport[sport];

      if (!acadSportInfo || acadSportInfo.achievementLevel === 'UNRANKED' || acadSportInfo.achievementLevel === 'NOT YET QUALIFIED') {
        continue;
      }

      const acadRank = getCompetitionRank(acadSportInfo.achievementLevel);
      const acadLevel = acadSportInfo.achievementLevel;

      // SPORT + LEVEL MATCHING: Academy Level >= Athlete Verified Level
      if (acadRank >= athRank) {
        const key = `${academy._id}_${sport}`;
        const reason = `Recommended because your verified achievement is ${athLevel} · ${athOutcome} in ${sport} and this Academy currently has ${acadLevel}-level achievement.`;

        validRecommendationsMap.set(key, {
          athleteId: user._id,
          academyId: academy._id,
          sport,
          athleteAchievementLevel: athLevel,
          academyAchievementLevel: acadLevel,
          basedOnAchievementId: athSportInfo.sourceAchievementId,
          basedOnAchievementSource: 'FEDERATION',
          reason
        });
      }
    }
  }

  // Synchronize with database: Update existing or Insert new
  const existingRecs = await Recommendation.find({ athleteId: user._id });
  const existingMap = new Map();
  for (const r of existingRecs) {
    existingMap.set(`${r.academyId}_${r.sport}`, r);
  }

  // Create or Update
  for (const [key, validData] of validRecommendationsMap.entries()) {
    const existing = existingMap.get(key);
    if (existing) {
      const levelChanged = (
        existing.athleteAchievementLevel !== validData.athleteAchievementLevel ||
        existing.academyAchievementLevel !== validData.academyAchievementLevel
      );
      if (levelChanged) {
        existing.athleteAchievementLevel = validData.athleteAchievementLevel;
        existing.academyAchievementLevel = validData.academyAchievementLevel;
        existing.reason = validData.reason;
        existing.basedOnAchievementId = validData.basedOnAchievementId;
        existing.basedOnAchievementSource = validData.basedOnAchievementSource;
        existing.status = 'UNREAD'; // Level upgrade triggers notification
        existing.viewedAt = null;
        await existing.save();
      }
    } else {
      await Recommendation.findOneAndUpdate(
        { athleteId: validData.athleteId, academyId: validData.academyId, sport: validData.sport },
        {
          $set: {
            athleteAchievementLevel: validData.athleteAchievementLevel,
            academyAchievementLevel: validData.academyAchievementLevel,
            reason: validData.reason,
            basedOnAchievementId: validData.basedOnAchievementId,
            basedOnAchievementSource: validData.basedOnAchievementSource
          },
          $setOnInsert: {
            status: 'UNREAD'
          }
        },
        { upsert: true, new: true }
      ).catch(e => {
        if (!e.message.includes('E11000')) throw e;
      });
    }
  }

  // Remove stale recommendations that are no longer eligible
  const staleIds = [];
  for (const [key, existing] of existingMap.entries()) {
    if (!validRecommendationsMap.has(key)) {
      staleIds.push(existing._id);
    }
  }

  if (staleIds.length > 0) {
    await Recommendation.deleteMany({ _id: { $in: staleIds } });
  }

  return Recommendation.find({ athleteId: user._id }).sort({ createdAt: -1 }).lean();
}

/**
 * Synchronizes Academy Achievement Level, perSportLevels, rankingStats cache,
 * updates User document, and recalculates recommendations for connected athletes.
 */
async function syncAcademyAchievementLevels(academyDoc) {
  if (!academyDoc) return null;
  const Academy = require('../models/Academy');
  const User = require('../models/User');

  const { overallLevel, overallLevelLabel, perSport } = await getAcademyPerSportAchievementLevels(academyDoc);

  let maxDist = 0, maxState = 0, maxNatl = 0, maxIntl = 0;
  for (const info of Object.values(perSport)) {
    if (info.rankingStats) {
      if (info.rankingStats.districtPlayers > maxDist) maxDist = info.rankingStats.districtPlayers;
      if (info.rankingStats.statePlayers > maxState) maxState = info.rankingStats.statePlayers;
      if (info.rankingStats.nationalPlayers > maxNatl) maxNatl = info.rankingStats.nationalPlayers;
      if (info.rankingStats.internationalPlayers > maxIntl) maxIntl = info.rankingStats.internationalPlayers;
    }
  }

  const updatedStats = {
    districtPlayers: Math.max(maxDist, Number(academyDoc.rankingStats?.districtPlayers || 0)),
    statePlayers: Math.max(maxState, Number(academyDoc.rankingStats?.statePlayers || 0)),
    nationalPlayers: Math.max(maxNatl, Number(academyDoc.rankingStats?.nationalPlayers || 0)),
    internationalPlayers: Math.max(maxIntl, Number(academyDoc.rankingStats?.internationalPlayers || 0))
  };

  await Academy.updateOne({ _id: academyDoc._id }, {
    $set: {
      achievementLevel: overallLevel,
      achievementLevelLabel: overallLevelLabel,
      rankingStats: updatedStats
    }
  });

  if (academyDoc.userId) {
    await User.updateOne({ _id: academyDoc.userId }, {
      $set: {
        achievementLevel: overallLevel,
        achievementLevelLabel: overallLevelLabel,
        rankingStats: updatedStats
      }
    });
  }

  // Recalculate recommendations for any athletes who have matching sports
  const sportsOffered = (academyDoc.sports || []).map(s => (s.sportName || s).trim().toUpperCase()).filter(Boolean);
  if (sportsOffered.length > 0) {
    const athletes = await User.find({
      role: 'athlete',
      $or: [
        { sport: { $in: sportsOffered } },
        { sports: { $in: sportsOffered } }
      ]
    }).select('_id athleteId sport sports');

    for (const ath of athletes) {
      await generateAthleteRecommendations(ath).catch(() => {});
    }
  }

  return { overallLevel, overallLevelLabel, perSport, rankingStats: updatedStats };
}

module.exports = {
  getAthleteHighestVerifiedLevelPerSport,
  getAcademyPerSportAchievementLevels,
  generateAthleteRecommendations,
  syncAcademyAchievementLevels
};
