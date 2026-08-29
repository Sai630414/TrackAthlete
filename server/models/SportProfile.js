const mongoose = require('mongoose');

/**
 * SportProfile stores the admin-seeded, non-location "static" reference data
 * used by rules 3-9 and 11 of the recommender (see recommender.js).
 * Two scopes:
 *  - 'national'  -> one document per sport (federation, international, SGFI, AIU,
 *                   sports quota, government jobs, competition pathway)
 *  - 'state'     -> one document per sport+state (state recognition & support)
 *
 * Every sub-score is 0-100, entered by an admin after real research —
 * the engine never guesses or scrapes live.
 */
const SportProfileSchema = new mongoose.Schema({
  sport: { type: String, required: true },
  scope: { type: String, enum: ['national', 'state'], required: true },
  state: String, // only set when scope === 'state'

  // Rule 3 — State-Level Recognition & Support (scope: state)
  stateRecognitionScore: Number,      // 40%
  stateCompetitionScore: Number,      // 25%
  stateFacilitiesScore: Number,       // 20%
  stateBenefitsScore: Number,         // 15%

  // Rule 4 — National Recognition & Federation (scope: national)
  nationalFederationScore: Number,    // 40%
  nationalStateStructureScore: Number,// 20%
  nationalCompetitionsScore: Number,  // 20%
  nationalSelectionScore: Number,     // 20%

  // Rule 5 — International / Olympic Pathway (scope: national)
  intlFederationScore: Number,        // 25%
  intlCompetitionsScore: Number,      // 25%
  intlMajorGamesScore: Number,        // 20%
  intlOlympicScore: Number,           // 20%
  intlQualificationScore: Number,     // 10%

  // Rule 6 — School Pathway / SGFI (scope: national)
  sgfiInclusionScore: Number,         // 25%
  sgfiLevelsScore: Number,            // 35%
  sgfiParticipationScore: Number,     // 20%
  sgfiSchoolAvailabilityScore: Number,// 20%

  // Rule 7 — University Pathway / AIU (scope: national)
  aiuPresenceScore: Number,           // 30%
  aiuUniversitiesScore: Number,       // 30%
  aiuStructureScore: Number,          // 25%
  aiuProgressionScore: Number,        // 15%

  // Rule 8 — Sports Quota / Education Benefits (scope: national)
  quotaSchoolScore: Number,           // 25%
  quotaUniversityScore: Number,       // 30%
  quotaScholarshipScore: Number,      // 20%
  quotaEntranceScore: Number,         // 25%

  // Rule 9 — Government Employment Opportunities (scope: national)
  employmentPathwayCount: { type: Number, default: 0 }, // 0,1,2,3,4+ -> mapped to score in recommender
  employmentEligibilityScore: Number, // 25%
  employmentFrequencyScore: Number,   // 25%

  // Rule 11 — Competition Pathway (scope: national)
  competitionLocal: { type: Boolean, default: false },      // 15%
  competitionDistrict: { type: Boolean, default: false },   // 20%
  competitionState: { type: Boolean, default: false },      // 25%
  competitionNational: { type: Boolean, default: false },   // 25%
  competitionInternational: { type: Boolean, default: false }, // 15%

  source: String,
  verificationStatus: { type: String, enum: ['Verified Yes', 'Verified No', 'Not Verified'], default: 'Not Verified' },
  lastVerified: Date
});

SportProfileSchema.index({ sport: 1, scope: 1, state: 1 });

module.exports = mongoose.model('SportProfile', SportProfileSchema);
