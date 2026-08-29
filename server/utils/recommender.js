const SAICentre = require('../models/SAICentre');
const Academy = require('../models/Academy');
const SportProfile = require('../models/SportProfile');
const { haversineKm, distanceScore } = require('./geo');

const saiCentresData = require('../seed/data/saiCentresNew.json');
const academiesData = require('../seed/data/academiesNew.json');
const sportProfilesData = require('../seed/data/sportProfiles.json');

const NEUTRAL_COACH_SCORE = 50;

const RULE_WEIGHTS = {
  saiAccess: 20,
  academyAccess: 10,
  stateRecognition: 12,
  nationalFederation: 8,
  internationalPathway: 8,
  sgfi: 8,
  aiu: 7,
  sportsQuota: 8,
  governmentJobs: 7,
  coachAvailability: 5,
  competitionPathway: 7
};

function employmentPathwayCountScore(count) {
  if (count <= 0) return 0;
  if (count === 1) return 40;
  if (count === 2) return 65;
  if (count === 3) return 80;
  return 100;
}

function countAvailabilityScore(count) {
  if (count <= 0) return 0;
  if (count === 1) return 50;
  if (count === 2) return 75;
  return 100;
}

function getFallbackSaiCentres(sport) {
  const normSport = String(sport).toLowerCase();
  return saiCentresData
    .filter((item) => Array.isArray(item.sports) && item.sports.some((s) => String(s).toLowerCase() === normSport))
    .map((item) => ({
      centreName: item.name,
      entryPathway: 'Centre-specific admission process',
      eligibilityAge: '12-21 years',
      location: { coordinates: [Number(item.lng), Number(item.lat)] }
    }));
}

function getFallbackAcademies(sport) {
  const normSport = String(sport).toLowerCase();
  const rawList = Array.isArray(academiesData) ? academiesData : (academiesData.academies || []);
  return rawList
    .filter((a) => {
      if (Array.isArray(a.sports)) {
        return a.sports.some((s) => String(s).toLowerCase() === normSport);
      }
      return String(a.sport || '').toLowerCase().includes(normSport);
    })
    .map((a) => ({
      name: a.name,
      location: { coordinates: [Number(a.longitude || 80.648), Number(a.latitude || 16.506)] }
    }));
}

function getFallbackSportProfile(sport, scope, state) {
  const normSport = String(sport).toLowerCase();
  return sportProfilesData.find((p) => {
    if (String(p.sport).toLowerCase() !== normSport) return false;
    if (p.scope !== scope) return false;
    if (scope === 'state' && state && String(p.state || '').toLowerCase() !== String(state).toLowerCase()) {
      return false;
    }
    return true;
  });
}

/**
 * Rule 1 — SAI / Government Training Access (weight 20)
 */
async function scoreSAIAccess(citySport, cityCoords, radiusKm) {
  let centres = [];
  try {
    centres = await SAICentre.find({ sport: citySport, status: 'Operational' }).lean();
  } catch (err) {
    // fallback if Mongo is offline
  }
  if (!centres || centres.length === 0) {
    centres = getFallbackSaiCentres(citySport);
  }

  const withDistance = centres
    .map((c) => ({ ...c, distanceKm: haversineKm(cityCoords, c.location.coordinates) }))
    .filter((c) => c.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (withDistance.length === 0) {
    return { ruleScore: 0, points: 0, evidence: { count: 0, nearestKm: null } };
  }

  const nearest = withDistance[0];
  const distScore = distanceScore(nearest.distanceKm);

  let suitabilityScore = 100;
  if (!nearest.entryPathway) suitabilityScore -= 40;
  if (!nearest.eligibilityAge) suitabilityScore -= 20;
  suitabilityScore = Math.max(suitabilityScore, 0);

  const availabilityScore = countAvailabilityScore(withDistance.length);

  const saiScore = distScore * 0.5 + suitabilityScore * 0.3 + availabilityScore * 0.2;
  const points = (saiScore / 100) * RULE_WEIGHTS.saiAccess;

  return {
    ruleScore: Math.round(saiScore * 100) / 100,
    points: Math.round(points * 100) / 100,
    evidence: {
      count: withDistance.length,
      nearestKm: Math.round(nearest.distanceKm),
      nearestCentre: nearest.centreName,
      entryPathway: nearest.entryPathway || 'Not documented',
      distScore, suitabilityScore, availabilityScore
    }
  };
}

/**
 * Rule 2 — Nearby Verified Private Academy Access (weight 10)
 */
async function scoreAcademyAccess(sport, cityCoords, radiusKm) {
  let academies = [];
  try {
    academies = await Academy.find({ sports: sport, verified: true }).lean();
  } catch (err) {
    // fallback if Mongo is offline
  }
  if (!academies || academies.length === 0) {
    academies = getFallbackAcademies(sport);
  }

  const withDistance = academies
    .map((a) => ({ ...a, distanceKm: haversineKm(cityCoords, a.location.coordinates) }))
    .filter((a) => a.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (withDistance.length === 0) {
    return { ruleScore: 0, points: 0, evidence: { count: 0, nearestKm: null } };
  }

  const nearest = withDistance[0];
  const availabilityScore = countAvailabilityScore(withDistance.length);
  const distScore = distanceScore(nearest.distanceKm);
  const coachSlotScore = NEUTRAL_COACH_SCORE;

  const academyScore = availabilityScore * 0.4 + distScore * 0.4 + coachSlotScore * 0.2;
  const points = (academyScore / 100) * RULE_WEIGHTS.academyAccess;

  return {
    ruleScore: Math.round(academyScore * 100) / 100,
    points: Math.round(points * 100) / 100,
    evidence: {
      count: withDistance.length,
      nearestKm: Math.round(nearest.distanceKm),
      nearestAcademy: nearest.name,
      availabilityScore, distScore, coachSlotScore
    }
  };
}

/**
 * Rule 10 — Coach Availability (weight 5)
 */
function scoreCoachAvailability() {
  const coachScore = NEUTRAL_COACH_SCORE;
  const points = (coachScore / 100) * RULE_WEIGHTS.coachAvailability;
  return {
    ruleScore: coachScore,
    points: Math.round(points * 100) / 100,
    evidence: { note: 'Placeholder score — no real coach signup data yet.' }
  };
}

/**
 * Rule 3 — State-Level Recognition & Support (weight 12)
 */
function scoreStateRecognition(stateProfile) {
  if (!stateProfile) return { ruleScore: 0, points: 0, evidence: { note: 'No state profile on record.' } };
  const s =
    (stateProfile.stateRecognitionScore || 0) * 0.4 +
    (stateProfile.stateCompetitionScore || 0) * 0.25 +
    (stateProfile.stateFacilitiesScore || 0) * 0.2 +
    (stateProfile.stateBenefitsScore || 0) * 0.15;
  const points = (s / 100) * RULE_WEIGHTS.stateRecognition;
  return {
    ruleScore: Math.round(s * 100) / 100,
    points: Math.round(points * 100) / 100,
    evidence: {
      recognition: stateProfile.stateRecognitionScore,
      competitions: stateProfile.stateCompetitionScore,
      facilities: stateProfile.stateFacilitiesScore,
      benefits: stateProfile.stateBenefitsScore,
      lastVerified: stateProfile.lastVerified
    }
  };
}

/**
 * Rule 4 — National Recognition & Federation (weight 8)
 */
function scoreNationalFederation(nat) {
  if (!nat) return { ruleScore: 0, points: 0, evidence: {} };
  const s =
    (nat.nationalFederationScore || 0) * 0.4 +
    (nat.nationalStateStructureScore || 0) * 0.2 +
    (nat.nationalCompetitionsScore || 0) * 0.2 +
    (nat.nationalSelectionScore || 0) * 0.2;
  const points = (s / 100) * RULE_WEIGHTS.nationalFederation;
  return { ruleScore: Math.round(s * 100) / 100, points: Math.round(points * 100) / 100, evidence: {} };
}

/**
 * Rule 5 — International / Olympic Pathway (weight 8)
 */
function scoreInternational(nat) {
  if (!nat) return { ruleScore: 0, points: 0, evidence: {} };
  const s =
    (nat.intlFederationScore || 0) * 0.25 +
    (nat.intlCompetitionsScore || 0) * 0.25 +
    (nat.intlMajorGamesScore || 0) * 0.2 +
    (nat.intlOlympicScore || 0) * 0.2 +
    (nat.intlQualificationScore || 0) * 0.1;
  const points = (s / 100) * RULE_WEIGHTS.internationalPathway;
  return { ruleScore: Math.round(s * 100) / 100, points: Math.round(points * 100) / 100, evidence: {} };
}

/**
 * Rule 6 — School Pathway / SGFI (weight 8)
 */
function scoreSGFI(nat) {
  if (!nat) return { ruleScore: 0, points: 0, evidence: {} };
  const s =
    (nat.sgfiInclusionScore || 0) * 0.25 +
    (nat.sgfiLevelsScore || 0) * 0.35 +
    (nat.sgfiParticipationScore || 0) * 0.2 +
    (nat.sgfiSchoolAvailabilityScore || 0) * 0.2;
  const points = (s / 100) * RULE_WEIGHTS.sgfi;
  return { ruleScore: Math.round(s * 100) / 100, points: Math.round(points * 100) / 100, evidence: {} };
}

/**
 * Rule 7 — University Pathway / AIU (weight 7)
 */
function scoreAIU(nat) {
  if (!nat) return { ruleScore: 0, points: 0, evidence: {} };
  const s =
    (nat.aiuPresenceScore || 0) * 0.3 +
    (nat.aiuUniversitiesScore || 0) * 0.3 +
    (nat.aiuStructureScore || 0) * 0.25 +
    (nat.aiuProgressionScore || 0) * 0.15;
  const points = (s / 100) * RULE_WEIGHTS.aiu;
  return { ruleScore: Math.round(s * 100) / 100, points: Math.round(points * 100) / 100, evidence: {} };
}

/**
 * Rule 8 — Sports Quota / Education Benefits (weight 8)
 */
function scoreSportsQuota(nat) {
  if (!nat) return { ruleScore: 0, points: 0, evidence: {} };
  const s =
    (nat.quotaSchoolScore || 0) * 0.25 +
    (nat.quotaUniversityScore || 0) * 0.3 +
    (nat.quotaScholarshipScore || 0) * 0.2 +
    (nat.quotaEntranceScore || 0) * 0.25;
  const points = (s / 100) * RULE_WEIGHTS.sportsQuota;
  return { ruleScore: Math.round(s * 100) / 100, points: Math.round(points * 100) / 100, evidence: {} };
}

/**
 * Rule 9 — Government Employment Opportunities (weight 7)
 */
function scoreGovernmentJobs(nat) {
  if (!nat) return { ruleScore: 0, points: 0, evidence: {} };
  const pathwaysScore = employmentPathwayCountScore(nat.employmentPathwayCount || 0);
  const s =
    pathwaysScore * 0.5 +
    (nat.employmentEligibilityScore || 0) * 0.25 +
    (nat.employmentFrequencyScore || 0) * 0.25;
  const points = (s / 100) * RULE_WEIGHTS.governmentJobs;
  return {
    ruleScore: Math.round(s * 100) / 100,
    points: Math.round(points * 100) / 100,
    evidence: { verifiedPathways: nat.employmentPathwayCount || 0 }
  };
}

/**
 * Rule 11 — Competition Pathway (weight 7)
 */
function scoreCompetitionPathway(nat) {
  if (!nat) return { ruleScore: 0, points: 0, evidence: {} };
  let s = 0;
  const levels = [];
  if (nat.competitionLocal) { s += 15; levels.push('Local'); }
  if (nat.competitionDistrict) { s += 20; levels.push('District'); }
  if (nat.competitionState) { s += 25; levels.push('State'); }
  if (nat.competitionNational) { s += 25; levels.push('National'); }
  if (nat.competitionInternational) { s += 15; levels.push('International'); }
  const points = (s / 100) * RULE_WEIGHTS.competitionPathway;
  return {
    ruleScore: Math.round(s * 100) / 100,
    points: Math.round(points * 100) / 100,
    evidence: { levels: levels.join(' -> ') }
  };
}

/**
 * Compute the full 11-rule score for ONE sport
 */
async function scoreSport(sport, cityCoords, radiusKm, state) {
  let natProfile = null;
  let stateProfile = null;
  try {
    natProfile = await SportProfile.findOne({ sport, scope: 'national' }).lean();
    stateProfile = await SportProfile.findOne({ sport, scope: 'state', state }).lean();
  } catch (err) {
    // Mongo fallback
  }

  if (!natProfile) natProfile = getFallbackSportProfile(sport, 'national');
  if (!stateProfile) stateProfile = getFallbackSportProfile(sport, 'state', state);

  const [sai, academy] = await Promise.all([
    scoreSAIAccess(sport, cityCoords, radiusKm),
    scoreAcademyAccess(sport, cityCoords, radiusKm)
  ]);
  const coach = scoreCoachAvailability();
  const stateRec = scoreStateRecognition(stateProfile);
  const natFed = scoreNationalFederation(natProfile);
  const intl = scoreInternational(natProfile);
  const sgfi = scoreSGFI(natProfile);
  const aiu = scoreAIU(natProfile);
  const quota = scoreSportsQuota(natProfile);
  const jobs = scoreGovernmentJobs(natProfile);
  const competition = scoreCompetitionPathway(natProfile);

  const rules = {
    saiAccess: { label: 'Government / SAI Access', weight: RULE_WEIGHTS.saiAccess, ...sai },
    academyAccess: { label: 'Private Academy Access', weight: RULE_WEIGHTS.academyAccess, ...academy },
    stateRecognition: { label: 'State Recognition & Support', weight: RULE_WEIGHTS.stateRecognition, ...stateRec },
    nationalFederation: { label: 'National Federation', weight: RULE_WEIGHTS.nationalFederation, ...natFed },
    internationalPathway: { label: 'International / Olympic Pathway', weight: RULE_WEIGHTS.internationalPathway, ...intl },
    sgfi: { label: 'School Pathway (SGFI)', weight: RULE_WEIGHTS.sgfi, ...sgfi },
    aiu: { label: 'University Pathway (AIU)', weight: RULE_WEIGHTS.aiu, ...aiu },
    sportsQuota: { label: 'Sports Quota / Education Benefits', weight: RULE_WEIGHTS.sportsQuota, ...quota },
    governmentJobs: { label: 'Government Employment', weight: RULE_WEIGHTS.governmentJobs, ...jobs },
    coachAvailability: { label: 'Coach Availability', weight: RULE_WEIGHTS.coachAvailability, ...coach },
    competitionPathway: { label: 'Competition Pathway', weight: RULE_WEIGHTS.competitionPathway, ...competition }
  };

  const totalPoints = Object.values(rules).reduce((sum, r) => sum + r.points, 0);

  return {
    sport,
    score: Math.round(totalPoints * 100) / 100,
    scoreRounded: Math.round(totalPoints),
    rules
  };
}

async function recommendSports({ pilotSports, cityCoords, radiusKm, state }) {
  const results = await Promise.all(
    pilotSports.map((sport) => scoreSport(sport, cityCoords, radiusKm, state))
  );
  results.sort((a, b) => b.score - a.score);
  return results;
}

module.exports = { recommendSports, scoreSport, RULE_WEIGHTS };
