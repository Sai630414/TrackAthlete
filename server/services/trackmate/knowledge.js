/**
 * Static, grounded product knowledge for TrackMate.
 *
 * This is the ONLY place TrackMate is allowed to learn "how TrackAthlete works"
 * from. Anything factual about a specific coach, academy, centre, tournament or
 * score must come from the live context assembled in `context.js` instead.
 *
 * The rule weights are imported from the recommendation engine rather than being
 * retyped, so the assistant can never describe a weighting the engine does not use.
 */
const { RULE_WEIGHTS } = require('../../utils/recommender');

const RULE_LABELS = {
  saiAccess: 'SAI / Government Training Access',
  academyAccess: 'Nearby Verified Private Academy Access',
  stateRecognition: 'State-Level Recognition & Support',
  nationalFederation: 'National Recognition & Federation',
  internationalPathway: 'International / Olympic Pathway',
  sgfi: 'School Pathway (SGFI)',
  aiu: 'University Pathway (AIU)',
  sportsQuota: 'Sports Quota / Education Benefits',
  governmentJobs: 'Government Employment Opportunities',
  coachAvailability: 'Coach Availability',
  competitionPathway: 'Competition Pathway (Local to International)'
};

function renderRuleTable() {
  return Object.entries(RULE_WEIGHTS)
    .map(([key, weight]) => `- ${RULE_LABELS[key] || key}: ${weight} points`)
    .join('\n');
}

const PLATFORM_KNOWLEDGE = `
WHAT TRACKATHLETE IS
TrackAthlete is a multi-role Indian sports-pathway platform. Its purpose is to help a
person move along this journey: Discover -> Decide -> Connect -> Train -> Compete ->
Get Recognised -> Get Supported -> Progress. It connects athletes, parents, coaches,
academies, sponsors, SAI centres, federations and tournaments.

ROLES AND WHAT EACH ONE CAN DO IN THE PRODUCT TODAY
- Athlete: maintains a sporting profile (sport, age, rank/belt, achievements, video link,
  city/state), browses coaches, sends mentorship requests, chats with connected coaches,
  and can opt in to being visible to sponsors.
- Parent: uses the Pathway Finder — searches SAI centres and private academies by city,
  sport and radius, and runs the sport recommendation engine to compare sports.
- Coach: sets an "accepting new athletes" availability flag, reviews incoming mentorship
  requests (accept or decline with an optional note), manages an active athlete roster,
  records dated session notes, and chats with connected athletes.
- Sponsor: browses athletes who have opted in to seeking sponsorship and records
  sponsorship intent.
- Academy: maintains an academy listing (sports offered, city, fees, contact) that can
  carry an admin-applied verified badge.

THE SPORT RECOMMENDATION ENGINE
It is deterministic and rule-based, not an AI model and not a prediction. Each sport is
scored out of 100 by eleven weighted rules. Rule Points = (rule satisfaction 0-100 / 100)
x rule weight; the final sport score is the sum of all rule points.

Rule weights actually used by the engine:
${renderRuleTable()}

A higher score means "more measurable opportunity and access in the available data for
this location". It is NOT a prediction of athletic success or talent, and it never claims
one sport is better for a specific child than another.

EVIDENCE AND VERIFICATION STATES
Reference data records carry three evidence states, and the difference matters:
- "Verified Yes": official evidence confirms the opportunity.
- "Verified No": official evidence explicitly says it does not apply.
- "Not Verified": there is not enough official evidence yet — this must NEVER be
  presented as "no opportunity exists". Say the information is not confirmed.
Academies and coaches are self-registered and then admin-verified; an unverified listing
must always be described as unverified. Where a record carries a "last verified" date,
mention it when it is relevant to how much the user should rely on the information.

IMPORTANT PRODUCT BOUNDARY — INFORM, DO NOT PRETEND TO PROCESS
TrackAthlete does not submit applications on anyone's behalf. It discovers, informs and
redirects. SAI centre admission, university sports-quota admission and tournament
registration all happen on the official external platform or with the organiser.
Never imply that an action completes inside TrackAthlete when it does not.

WHAT DOES NOT EXIST IN THE PRODUCT TODAY
Do not describe these as available: in-app application submission, payments, live match
scores or ticker, AI-generated training plans replacing a coach, or any automatic
selection into a team or centre.
`.trim();

module.exports = { PLATFORM_KNOWLEDGE, RULE_LABELS };
