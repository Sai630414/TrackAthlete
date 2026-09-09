const LEVEL_RANKS = {
  DISTRICT: 1,
  STATE: 2,
  NATIONAL: 3,
  INTERNATIONAL: 4
};

const ACADEMY_THRESHOLDS = {
  INTERNATIONAL: 1,
  NATIONAL: 2,
  STATE: 3,
  DISTRICT: 5
};

function normalizeSport(sport) {
  if (!sport || typeof sport !== 'string') return '';
  return sport.trim().toUpperCase();
}

function getCompetitionRank(level) {
  if (!level) return 0;
  return LEVEL_RANKS[String(level).trim().toUpperCase()] || 0;
}

function resolveCompetitionLevel(item, event) {
  if (item?.competitionLevel && LEVEL_RANKS[String(item.competitionLevel).trim().toUpperCase()]) {
    return String(item.competitionLevel).trim().toUpperCase();
  }
  if (event?.competitionLevel && LEVEL_RANKS[String(event.competitionLevel).trim().toUpperCase()]) {
    return String(event.competitionLevel).trim().toUpperCase();
  }

  // Never infer a competition level from titles, categories, or other text.
  // For historical records the persisted parent event is authoritative; if it
  // has no declared level, the achievement remains unranked.
  return null;
}

/**
 * Calculates Academy Achievement Level for a specific sport based on qualifying player counts.
 * Thresholds:
 * - INTERNATIONAL: 1+ international-level players
 * - NATIONAL: 2+ national-level players
 * - STATE: 3+ state-level players
 * - DISTRICT: 5+ district-level players
 */
function calculateAchievementLevelFromStats(stats) {
  if (!stats) return 'NOT YET QUALIFIED';
  const intl = Number(stats.internationalPlayers || 0);
  const natl = Number(stats.nationalPlayers || 0);
  const state = Number(stats.statePlayers || 0);
  const dist = Number(stats.districtPlayers || 0);

  if (intl >= ACADEMY_THRESHOLDS.INTERNATIONAL) return 'INTERNATIONAL';
  if (natl >= ACADEMY_THRESHOLDS.NATIONAL) return 'NATIONAL';
  if (state >= ACADEMY_THRESHOLDS.STATE || (state >= 2 && dist >= ACADEMY_THRESHOLDS.DISTRICT)) return 'STATE';
  if (dist >= ACADEMY_THRESHOLDS.DISTRICT) return 'DISTRICT';

  return 'NOT YET QUALIFIED';
}

module.exports = {
  LEVEL_RANKS,
  ACADEMY_THRESHOLDS,
  normalizeSport,
  getCompetitionRank,
  resolveCompetitionLevel,
  calculateAchievementLevelFromStats
};
