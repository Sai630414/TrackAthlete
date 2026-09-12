/**
 * Sanitised TrackAthlete context assembly for TrackMate.
 *
 * Two rules govern everything in this file:
 *   1. Nothing reaches the model except through an explicit field allowlist. Raw
 *      Mongoose documents are never forwarded, and `redactDeep` runs as a final
 *      belt-and-braces pass before the bundle leaves.
 *   2. Only the datasets the current question actually needs are fetched, so a
 *      "what is TrackAthlete?" turn does not drag the whole database into a prompt.
 *
 * Every lookup is individually guarded: if Mongo is unavailable the dataset is
 * reported as `unavailable` rather than silently looking like "there is nothing",
 * which is the distinction the recommendation rules document insists on.
 */
const User = require('../../models/User');
const Connection = require('../../models/Connection');
const Academy = require('../../models/Academy');
const SAICentre = require('../../models/SAICentre');
const Tournament = require('../../models/Tournament');
const FederationStatus = require('../../models/FederationStatus');
const SportsQuota = require('../../models/SportsQuota');
const RoadmapStage = require('../../models/RoadmapStage');

const { recommendSports } = require('../../utils/recommender');
const { PILOT_SPORTS } = require('../../controllers/parent.controller');
const { haversineKm } = require('../../utils/geo');
const cities = require('../../utils/indianCities');

const config = require('./config');

/**
 * Fields the assistant may ever see from a User document.
 * Deliberately absent: passwordHash, email, contactPhone, address, geo coordinates,
 * childName (a minor's name), and every internal identifier.
 */
const USER_FIELDS = [
  'role', 'name', 'city', 'state',
  'sport', 'beltRank', 'age', 'achievements', 'videoLink', 'seekingSponsorship',
  'sponsorshipReason', 'federationState', 'relocationFlexible', 'tournaments',
  'childAge', 'childSport',
  'certifications', 'yearsExperience', 'acceptingAthletes',
  'organizationName', 'budgetRange', 'targetSports',
  'academyName', 'sportsOffered'
].join(' ');

/** Key names that must never appear in a prompt, whatever their origin. */
const FORBIDDEN_KEY = /(password|passwd|pwd|aadhaar|aadhar|token|jwt|otp|secret|apikey|api_key|credential|sessionid|hash|salt|__v|_id)$/i;
const FORBIDDEN_KEY_ANYWHERE = /(password|aadhaar|aadhar|passwordhash|otphash|resettoken|apikey|api_key|jwt|bearer)/i;

/**
 * Final safety net. Removes any key that looks like a secret or an identifier and
 * caps recursion, so even a future schema change cannot leak a new sensitive field
 * into a prompt by accident.
 */
function redactDeep(value, depth = 0) {
  if (depth > 6) return null;
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, depth + 1));
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value === null || typeof value !== 'object') return value;

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key) || FORBIDDEN_KEY_ANYWHERE.test(key)) continue;
    const cleaned = redactDeep(val, depth + 1);
    if (cleaned === undefined || cleaned === null) continue;
    if (Array.isArray(cleaned) && cleaned.length === 0) continue;
    if (typeof cleaned === 'string' && !cleaned.trim()) continue;
    out[key] = cleaned;
  }
  return out;
}

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || null;
}

function isoDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Resolve a profile's free-text city to coordinates.
 *
 * `indianCities` is the Parent module's dropdown list (23 cities), but users type
 * their own city at signup, so most real profiles do not match it exactly. Rather
 * than dropping location entirely — which silently disables the recommendation
 * engine and every distance — fall back to a known city in the same state and mark
 * the result approximate, so the assistant can say which one it used.
 */
function resolveLocation(cityName, stateName) {
  const needle = String(cityName || '').trim().toLowerCase();
  if (needle) {
    const exact = cities.find((c) => c.city.toLowerCase() === needle);
    if (exact) return { ...exact, basis: 'exact' };
  }

  const state = String(stateName || '').trim().toLowerCase();
  if (state) {
    const inState = cities.find((c) => c.state.toLowerCase() === state);
    if (inState) {
      return {
        ...inState,
        basis: 'state-approximate',
        requestedCity: String(cityName || '').trim() || null
      };
    }
  }
  return null;
}

function distanceFrom(origin, coordinates) {
  if (!origin || !Array.isArray(coordinates) || coordinates.length !== 2) return null;
  const km = haversineKm([origin.lng, origin.lat], coordinates);
  return Number.isFinite(km) ? Math.round(km) : null;
}

// ---------------------------------------------------------------------------
// Intent detection — decides which datasets are worth a database round trip.
// Keyword based on purpose: it must be deterministic and cheap, and an extra
// dataset is only ever a missed opportunity, never a correctness problem.
// ---------------------------------------------------------------------------
// Inflections are spelled out rather than left to a bare stem: the trailing \b is
// what keeps "event" from firing on "eventually", so each alternative has to carry
// its own plural/verb endings. Missing a plural here is not cosmetic — it silently
// costs the turn its grounding data.
const INTENT_PATTERNS = {
  recommendations:
    /\b(?:recommend(?:s|ed|ing|ation|ations)?|which sport|what sport|better sport|switch sport|change sport|scores?|scored|scoring|ranks?|ranking|rankings|compare sports|opportunit(?:y|ies)|out of 100|\/100)\b/i,
  coaches: /\b(?:coach(?:es|ing)?|mentors?|mentorships?|trainers?|training partner|guru)\b/i,
  academies:
    /\b(?:academy|academies|clubs?|centre near|center near|training centres?|training centers?|where can (?:i|my child) train)\b/i,
  saiCentres: /\b(?:sai|sports authority|ncoe|stc|khelo|government (?:centre|center|training)|residential)\b/i,
  tournaments:
    /\b(?:tournaments?|competitions?|championships?|events?|meets?|registers?|registration|registrations|deadlines?)\b/i,
  federation:
    /\b(?:federations?|recognis(?:e|ed|es|ing)?|recogniz(?:e|ed|es|ing)?|recognition|associations?|affiliat(?:e|ed|es|ion|ions)?)\b/i,
  sportsQuota:
    /\b(?:quotas?|scholarships?|admissions?|universit(?:y|ies)|colleges?|seats?|entrance|education benefits?)\b/i,
  roadmap:
    /\b(?:roadmaps?|pathways?|path way|next steps?|progress(?:es|ing|ion)?|district to state|stages?|costs?|how much|timelines?|journey)\b/i,
  connections:
    /\b(?:my coach(?:es)?|my athletes?|my connections?|requests?|pending|connected|rosters?|session notes?)\b/i
};

function detectIntents(message) {
  const intents = new Set();
  for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (pattern.test(message)) intents.add(intent);
  }
  return intents;
}

/** Which sport is this user's question most likely about? */
function primarySport(profile) {
  return profile.sport || profile.childSport || (profile.sportsOffered || [])[0] || (profile.targetSports || [])[0] || null;
}

// ---------------------------------------------------------------------------
// Dataset loaders. Each returns { status, items } / { status, ...record } so the
// prompt can distinguish "checked, found nothing" from "could not check".
// ---------------------------------------------------------------------------
async function guarded(label, loader) {
  try {
    return await loader();
  } catch (err) {
    console.warn(`[TrackMate] context dataset "${label}" unavailable: ${err.message}`);
    return { status: 'unavailable' };
  }
}

function found(items) {
  return { status: items.length ? 'ok' : 'empty', count: items.length, items };
}

async function loadCoaches(sport, origin, limit) {
  const query = { role: 'coach', acceptingAthletes: { $ne: false } };
  if (sport) query.sport = sport;

  let coaches = await User.find(query).select('name sport city state yearsExperience certifications acceptingAthletes').lean();
  if (!coaches.length && sport) {
    // Widen once rather than reporting "no coaches on the platform" when the only
    // gap is this particular sport.
    coaches = await User.find({ role: 'coach', acceptingAthletes: { $ne: false } })
      .select('name sport city state yearsExperience certifications acceptingAthletes')
      .lean();
  }

  const items = coaches
    .map((c) => ({
      name: c.name,
      sport: c.sport || null,
      city: c.city || null,
      state: c.state || null,
      yearsExperience: c.yearsExperience ?? null,
      certifications: Array.isArray(c.certifications) ? c.certifications.slice(0, 4) : [],
      acceptingNewAthletes: c.acceptingAthletes !== false,
      profileVerification: 'Self-registered coach profile (not admin-verified)'
    }))
    .sort((a, b) => {
      const sameSport = Number(b.sport === sport) - Number(a.sport === sport);
      if (sameSport) return sameSport;
      return (b.yearsExperience || 0) - (a.yearsExperience || 0);
    })
    .slice(0, limit);

  return found(items);
}

async function loadAcademies(sport, origin, limit) {
  const query = sport ? { sports: sport } : {};
  const academies = await Academy.find(query).lean();

  const items = academies
    .map((a) => ({
      name: a.name,
      sports: a.sports || [],
      city: a.city || null,
      state: a.state || null,
      verified: Boolean(a.verified),
      verificationLabel: a.verified ? 'Verified academy' : 'Listed but NOT verified',
      acceptingStudents: a.acceptingStudents !== false,
      feeRangeMonthly:
        a.feeRangeMin != null || a.feeRangeMax != null
          ? { min: a.feeRangeMin ?? null, max: a.feeRangeMax ?? null, currency: 'INR' }
          : null,
      distanceKm: distanceFrom(origin, a.location?.coordinates)
    }))
    .sort((a, b) => {
      if (a.verified !== b.verified) return Number(b.verified) - Number(a.verified);
      return (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9);
    })
    .slice(0, limit);

  return found(items);
}

async function loadSaiCentres(sport, origin, limit) {
  const query = { status: 'Operational' };
  if (sport) query.sport = sport;
  const centres = await SAICentre.find(query).lean();

  const items = centres
    .map((c) => ({
      centreName: c.centreName,
      scheme: c.scheme || null,
      sport: c.sport || null,
      state: c.state || null,
      status: c.status || null,
      entryPathway: c.entryPathway || null,
      eligibilityAge: c.eligibilityAge || null,
      distanceKm: distanceFrom(origin, c.location?.coordinates),
      lastVerified: isoDate(c.lastVerified),
      source: c.source || null
    }))
    .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9))
    .slice(0, limit);

  return found(items);
}

async function loadTournaments(sport, limit) {
  const query = { date: { $gte: new Date() } };
  if (sport) query.sport = sport;

  let tournaments = await Tournament.find(query).sort({ date: 1 }).limit(limit).lean();
  if (!tournaments.length) {
    tournaments = await Tournament.find(sport ? { sport } : {}).sort({ date: 1 }).limit(limit).lean();
  }

  const items = tournaments.map((t) => ({
    name: t.name,
    sport: t.sport || null,
    date: isoDate(t.date),
    city: t.city || null,
    state: t.state || null,
    venue: t.location || null,
    registrationDeadline: isoDate(t.registrationDeadline),
    officialRegistrationLink: t.registrationLink || null,
    registrationHandledBy: 'External official organiser — not processed inside TrackAthlete'
  }));

  return found(items);
}

async function loadFederationStatus(sport, state) {
  if (!sport || !state) return { status: 'not_applicable', reason: 'Sport and state are both required for a federation lookup.' };
  const record = await FederationStatus.findOne({ sport, state }).lean();
  if (!record) return { status: 'empty', sport, state };
  return {
    status: 'ok',
    sport,
    state,
    currentFederation: record.currentFederation || null,
    recognisedByMinistry: Boolean(record.recognizedByMinistry),
    recognisedInState: Boolean(record.recognizedInState),
    migrationNote: record.migrationNote || null,
    lastVerified: isoDate(record.lastVerified),
    source: record.source || null
  };
}

async function loadSportsQuota(sport, limit) {
  const records = await SportsQuota.find(sport ? { sport } : {}).limit(limit).lean();
  const items = records.map((q) => ({
    university: q.university,
    city: q.city || null,
    state: q.state || null,
    sport: q.sport || null,
    seats: q.seats ?? null,
    minAchievementLevel: q.minAchievementLevel || null,
    scholarshipPercent: q.scholarshipPercent ?? null,
    applicationWindow: q.applicationWindow || null,
    lastVerified: isoDate(q.lastVerified),
    admissionHandledBy: 'Official university admission process — not processed inside TrackAthlete'
  }));
  return found(items);
}

async function loadRoadmap(sport) {
  if (!sport) return { status: 'not_applicable', reason: 'No sport is set on this profile.' };
  const stages = await RoadmapStage.find({ sport }).sort({ order: 1 }).lean();
  const items = stages.map((s) => ({
    stage: s.stage,
    order: s.order ?? null,
    description: s.description || null,
    estimatedMonthlyCostINR:
      s.estCostMin != null || s.estCostMax != null ? { min: s.estCostMin ?? null, max: s.estCostMax ?? null } : null
  }));
  return found(items);
}

async function loadConnections(userId, role) {
  if (role === 'coach') {
    const [pending, active] = await Promise.all([
      Connection.find({ coach: userId, status: 'Pending' }).populate('athlete', 'name sport').lean(),
      Connection.find({ coach: userId, status: 'Active' }).populate('athlete', 'name sport').lean()
    ]);
    return {
      status: 'ok',
      pendingRequestCount: pending.length,
      activeAthleteCount: active.length,
      activeAthletes: active.slice(0, config.maxItemsPerDataset).map((c) => ({
        name: firstName(c.athlete?.name),
        sport: c.athlete?.sport || null,
        sessionNotesRecorded: Array.isArray(c.sessionNotes) ? c.sessionNotes.length : 0
      }))
    };
  }

  const connections = await Connection.find({ athlete: userId }).populate('coach', 'name sport city state').lean();
  return {
    status: 'ok',
    total: connections.length,
    activeCount: connections.filter((c) => c.status === 'Active').length,
    pendingCount: connections.filter((c) => c.status === 'Pending').length,
    connections: connections.slice(0, config.maxItemsPerDataset).map((c) => ({
      coachName: c.coach?.name || null,
      coachSport: c.coach?.sport || null,
      coachCity: c.coach?.city || null,
      status: c.status,
      canChat: c.status === 'Active'
    }))
  };
}

// --- Recommendation engine reuse -------------------------------------------
// The deterministic engine stays the single source of truth for every score.
// TrackMate only ever reads its output; it never recomputes or estimates one.
const recommendationCache = new Map();

async function loadRecommendations(cityData, limit) {
  if (!cityData) {
    return { status: 'not_applicable', reason: 'No recognised city is set on this profile, and the engine is location-based.' };
  }
  const approximate = cityData.basis === 'state-approximate';

  const cacheKey = `${cityData.city}|${config.recommendationRadiusKm}`;
  const cached = recommendationCache.get(cacheKey);
  if (cached && Date.now() - cached.at < config.recommendationCacheTtlMs) {
    return cached.value;
  }

  const ranked = await recommendSports({
    pilotSports: PILOT_SPORTS,
    cityCoords: [cityData.lng, cityData.lat],
    radiusKm: config.recommendationRadiusKm,
    state: cityData.state
  });

  const value = {
    status: ranked.length ? 'ok' : 'empty',
    engine: 'TrackAthlete deterministic 11-rule recommendation engine',
    city: cityData.city,
    state: cityData.state,
    locationBasis: cityData.basis,
    locationCaveat: approximate
      ? `Scored for ${cityData.city}, not "${cityData.requestedCity}" — TrackAthlete has no ` +
        'coordinates for that city. Mention this whenever you quote these scores.'
      : null,
    radiusKm: config.recommendationRadiusKm,
    scale: 'Each sport is scored out of 100. These scores are authoritative — never recalculate or estimate them.',
    topSports: ranked.slice(0, limit).map((r) => ({
      sport: r.sport,
      score: r.scoreRounded,
      exactScore: r.score,
      topContributingRules: Object.values(r.rules)
        .sort((a, b) => b.points - a.points)
        .slice(0, 4)
        .map((rule) => ({
          rule: rule.label,
          weight: rule.weight,
          pointsEarned: rule.points,
          ruleScoreOutOf100: rule.ruleScore,
          evidence: rule.evidence || null
        }))
    }))
  };

  recommendationCache.set(cacheKey, { at: Date.now(), value });
  return value;
}

// ---------------------------------------------------------------------------

function buildProfile(rawUserDoc, authRole) {
  // The profile lookup is allowed to fail (Mongo unreachable, or an account deleted
  // while a valid JWT is still in play). In that case we still answer, using the role
  // from the token and an empty profile — an assistant that degrades to general
  // guidance is far better than a 500. Every branch below therefore reads through a
  // guaranteed-object `userDoc`.
  const userDoc = rawUserDoc || {};
  const role = userDoc.role || authRole || 'unknown';
  const profile = {
    role,
    firstName: firstName(userDoc.name),
    city: userDoc.city || null,
    state: userDoc.state || null
  };

  if (role === 'athlete') {
    Object.assign(profile, {
      sport: userDoc.sport || null,
      age: userDoc.age ?? null,
      beltOrRank: userDoc.beltRank || null,
      achievementCount: Array.isArray(userDoc.achievements) ? userDoc.achievements.length : 0,
      achievements: Array.isArray(userDoc.achievements) ? userDoc.achievements.slice(0, 5) : [],
      recordedTournamentCount: Array.isArray(userDoc.tournaments) ? userDoc.tournaments.length : 0,
      hasProfileVideo: Boolean(userDoc.videoLink),
      seekingSponsorship: Boolean(userDoc.seekingSponsorship),
      federationState: userDoc.federationState || userDoc.state || null,
      openToRelocation: userDoc.relocationFlexible !== false
    });
  } else if (role === 'parent') {
    // The child's name is intentionally never sent to the model.
    Object.assign(profile, {
      childAge: userDoc.childAge ?? null,
      childSport: userDoc.childSport || null
    });
  } else if (role === 'coach') {
    Object.assign(profile, {
      sport: userDoc.sport || null,
      yearsExperience: userDoc.yearsExperience ?? null,
      certifications: Array.isArray(userDoc.certifications) ? userDoc.certifications.slice(0, 5) : [],
      acceptingNewAthletes: userDoc.acceptingAthletes !== false
    });
  } else if (role === 'sponsor') {
    Object.assign(profile, {
      organisationName: userDoc.organizationName || null,
      budgetRange: userDoc.budgetRange || null,
      targetSports: Array.isArray(userDoc.targetSports) ? userDoc.targetSports.slice(0, 8) : []
    });
  } else if (role === 'academy') {
    Object.assign(profile, {
      academyName: userDoc.academyName || null,
      sportsOffered: Array.isArray(userDoc.sportsOffered) ? userDoc.sportsOffered.slice(0, 10) : []
    });
  }

  return profile;
}

/**
 * Build the full sanitised context bundle for one turn.
 * @param {{ id: string, role: string|null }} auth  verified JWT claims
 * @param {string} message                          normalised user message
 */
async function buildContext(auth, message) {
  let userDoc = null;
  try {
    userDoc = await User.findById(auth.id).select(USER_FIELDS).lean();
  } catch (err) {
    console.warn(`[TrackMate] profile lookup failed: ${err.message}`);
  }

  const profile = buildProfile(userDoc, auth.role);
  const sport = primarySport(profile);
  const cityData = resolveLocation(profile.city, profile.state);
  const origin = cityData ? { lat: cityData.lat, lng: cityData.lng } : null;
  const limit = config.maxItemsPerDataset;

  const intents = detectIntents(message);
  const data = {};

  const jobs = [];
  if (intents.has('recommendations')) {
    jobs.push(guarded('recommendations', () => loadRecommendations(cityData, limit)).then((r) => { data.sportRecommendations = r; }));
  }
  if (intents.has('coaches')) {
    jobs.push(guarded('coaches', () => loadCoaches(sport, origin, limit)).then((r) => { data.coachesOnPlatform = r; }));
  }
  if (intents.has('academies')) {
    jobs.push(guarded('academies', () => loadAcademies(sport, origin, limit)).then((r) => { data.academies = r; }));
  }
  if (intents.has('saiCentres')) {
    jobs.push(guarded('saiCentres', () => loadSaiCentres(sport, origin, limit)).then((r) => { data.saiCentres = r; }));
  }
  if (intents.has('tournaments')) {
    jobs.push(guarded('tournaments', () => loadTournaments(sport, limit)).then((r) => { data.tournaments = r; }));
  }
  if (intents.has('federation')) {
    jobs.push(guarded('federation', () => loadFederationStatus(sport, profile.state)).then((r) => { data.federationStatus = r; }));
  }
  if (intents.has('sportsQuota')) {
    jobs.push(guarded('sportsQuota', () => loadSportsQuota(sport, limit)).then((r) => { data.sportsQuota = r; }));
  }
  if (intents.has('roadmap')) {
    jobs.push(guarded('roadmap', () => loadRoadmap(sport)).then((r) => { data.developmentRoadmap = r; }));
  }
  if (intents.has('connections') && (profile.role === 'athlete' || profile.role === 'coach')) {
    jobs.push(guarded('connections', () => loadConnections(auth.id, profile.role)).then((r) => { data.myConnections = r; }));
  }

  await Promise.all(jobs);

  const bundle = {
    profileLoaded: Boolean(userDoc),
    viewer: profile,
    assumedSportForLookups: sport,
    locationUsedForDistances: cityData
      ? {
          city: cityData.city,
          state: cityData.state,
          basis: cityData.basis,
          note:
            cityData.basis === 'exact'
              ? "This is the user's own city."
              : `TrackAthlete has no coordinates for "${cityData.requestedCity}", so ${cityData.city} ` +
                'was used as an approximate origin. Say so before quoting any distance or score.'
        }
      : {
          basis: 'unknown',
          note:
            'No usable location. Distances and recommendation scores are unavailable; ' +
            'suggest the user set a recognised city on their profile.'
        },
    retrievedData: data,
    datasetsQueried: Object.keys(data)
  };

  // Final allowlist-independent scrub before anything is serialised into a prompt.
  const clean = redactDeep(bundle);

  // `redactDeep` prunes empty arrays to keep the prompt tight, but this one must
  // survive even when empty: "no TrackAthlete data backed this turn" is precisely
  // what the grounding rules need the model — and the UI's source line — to see.
  clean.datasetsQueried = Object.keys(data);
  return clean;
}

module.exports = { buildContext, detectIntents, redactDeep, resolveLocation, USER_FIELDS };
