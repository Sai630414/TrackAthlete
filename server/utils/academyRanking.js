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

  // Reliable text pattern fallback for legacy records
  const text = [
    item?.tournamentName || '',
    item?.eventName || '',
    item?.category || '',
    event?.eventName || '',
    event?.category || ''
  ].join(' ').toLowerCase();

  if (/inter[- ]?national|world|asian|olympic|commonwealth|asia\b/i.test(text)) {
    return 'INTERNATIONAL';
  }
  if (/national|all[- ]?india/i.test(text)) {
    return 'NATIONAL';
  }
  if (/\bstate\b|inter[- ]?district/i.test(text)) {
    return 'STATE';
  }
  if (/\bdistrict\b|divisional|zonal/i.test(text)) {
    return 'DISTRICT';
  }

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
  if (!stats) return 'UNRANKED';
  const intl = Number(stats.internationalPlayers || 0);
  const natl = Number(stats.nationalPlayers || 0);
  const state = Number(stats.statePlayers || 0);
  const dist = Number(stats.districtPlayers || 0);

  if (intl >= ACADEMY_THRESHOLDS.INTERNATIONAL) return 'INTERNATIONAL';
  if (natl >= ACADEMY_THRESHOLDS.NATIONAL) return 'NATIONAL';
  if (state >= ACADEMY_THRESHOLDS.STATE) return 'STATE';
  if (dist >= ACADEMY_THRESHOLDS.DISTRICT) return 'DISTRICT';

  return 'UNRANKED';
}

module.exports = {
  LEVEL_RANKS,
  ACADEMY_THRESHOLDS,
  normalizeSport,
  getCompetitionRank,
  resolveCompetitionLevel,
  calculateAchievementLevelFromStats
};
