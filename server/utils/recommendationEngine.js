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

  // 1. Authoritative Federation Recognized Achievements
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

  // 2. Authoritative Organizer Verified Achievements
  const organizerQuery = {
    $or: [
      { athlete: userObjId },
      ...(athleteId ? [{ athleteId: String(athleteId).trim() }] : [])
    ]
  };

  const organizerAchs = await OrganizerAchievement.find(organizerQuery)
    .populate('event')
    .lean();

  const perSport = {};

  // Process Federation achievements
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

  // Process Organizer Verified achievements
  for (const ach of organizerAchs) {
    const sport = normalizeSport(ach.sportName || ach.event?.sports?.[0]?.sportName);
    if (!sport) continue;

    const compLevel = resolveCompetitionLevel(ach, ach.event);
    if (!compLevel) continue;

    const rank = getCompetitionRank(compLevel);
    if (!rank) continue;

    const outcome = ach.medal || (ach.position ? `Position ${ach.position}` : (ach.outcome || 'Verified'));
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
        tournamentName: ach.event?.eventName || 'Organizer Tournament',
        sourceType: 'ORGANIZER_VERIFIED',
        sourceAchievementId: String(ach._id)
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
    return { overallLevel: 'UNRANKED', perSport: {} };
  }

  const academyId = academyDoc._id;
  const memberships = preloadedMemberships || await AcademyAthleteMembership.find({
    academyId,
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
      const key = m.athleteUserId ? String(m.athleteUserId) : (m.athleteId ? String(m.athleteId) : null);
      if (key && !uniqueAthletesMap.has(key)) {
        uniqueAthletesMap.set(key, { athleteUserId: m.athleteUserId, athleteId: m.athleteId });
      }
    }

    let districtCount = 0;
    let stateCount = 0;
    let nationalCount = 0;
    let internationalCount = 0;

    for (const ath of uniqueAthletesMap.values()) {
      const athAchs = await getAthleteHighestVerifiedLevelPerSport(ath.athleteUserId, ath.athleteId);
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

    // Counts are derived only from distinct active linked athletes and their
    // authoritative achievements. rankingStats is a cache/display field and
    // must never raise an Academy's classification.
    const effectiveStats = {
      districtPlayers: districtCount,
      statePlayers: stateCount,
      nationalPlayers: nationalCount,
      internationalPlayers: internationalCount
    };

    const level = calculateAchievementLevelFromStats(effectiveStats);

    perSport[sport] = {
      sport,
      rankingStats: effectiveStats,
      achievementLevel: level
    };
  }

  // Calculate overall level as the highest level across all sports
  let maxRank = 0;
  let overallLevel = 'UNRANKED';
  for (const info of Object.values(perSport)) {
    const r = getCompetitionRank(info.achievementLevel);
    if (r > maxRank) {
      maxRank = r;
      overallLevel = info.achievementLevel;
    }
  }

  return { overallLevel, perSport };
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

      if (!acadSportInfo || acadSportInfo.achievementLevel === 'UNRANKED') {
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
          basedOnAchievementSource: athSportInfo.sourceType === 'ORGANIZER_VERIFIED' ? 'ORGANIZER' : 'FEDERATION',
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
      await Recommendation.create({
        ...validData,
        status: 'UNREAD'
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

module.exports = {
  getAthleteHighestVerifiedLevelPerSport,
  getAcademyPerSportAchievementLevels,
  generateAthleteRecommendations
};
