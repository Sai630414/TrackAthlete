# TrackAthlete — SIH Student Innovation Prototype

A multi-stakeholder sports-pathway platform (Athlete / Parent / Coach / Sponsor / Academy)
built for Smart India Hackathon. This package contains a runnable MERN-stack scaffold with
the Parent Module's 11-Rule Sport Recommendation Engine fully implemented, plus stub
dashboards for the other four roles.

## What's Fully Working
- **Parent Module**: City + Sport + Radius search shows nearby SAI centres and academies
  for the selected sport. "Not satisfied? Explore better sports" runs the full 11-rule
  weighted recommendation engine (see `server/utils/recommender.js`) and returns every
  pilot sport ranked by score, with an expandable rule-by-rule breakdown per sport,
  matching the UI spec in TrackAthlete_Parent_Sport_Recommendation_Rules.docx.
- **Reference data seeding**: SAI centres (nationwide, from the official SAI Strength
  Report), Vijayawada-scoped private academies, and per-sport "SportProfile" reference
  data (national federation, state recognition, SGFI, AIU, sports quota, government jobs,
  competition pathway) for the 3 pilot sports (Taekwondo, Badminton, Table Tennis).

## What's Scaffolded (structure only, not fully wired)
Athlete, Coach, Sponsor, Academy dashboards — basic pages + routes + models exist,
matching the finalized folder structure, ready to be built out next.

## IMPORTANT — Placeholder Data Disclaimer
Every score in `server/seed/data/sportProfiles.json` is ILLUSTRATIVE seed data adapted
from the worked example in the rules document. Before any real demo, replace these with
genuinely researched, sourced values — each field has a `source` and `lastVerified` slot
ready for that.

Two design decisions were made per your explicit instructions:
1. Coach/slot availability sub-scores (Rule 2's 20% component, and all of Rule 10) use a
   NEUTRAL PLACEHOLDER SCORE (50/100) everywhere, since no real coach signup data exists
   yet. Replace `NEUTRAL_COACH_SCORE` in `recommender.js` once coach profiles are live.
2. The city dropdown lists ALL major Indian cities (not limited to seeded data), since SAI
   centre data is already nationwide. Private academy data stays Vijayawada-only, so
   non-Vijayawada searches correctly show 0 academies — expected, not a bug.

## Setup

### Backend
```
cd server
npm install
cp .env.example .env        # fill in your MongoDB URI
npm run seed                # loads SAI centres, academies, sport profiles
npm run dev                 # starts on http://localhost:5000
```

### Frontend
```
cd client
npm install
npm run dev                 # starts on http://localhost:5173
```

## Folder Structure
See PROJECT_STRUCTURE.txt for the full annotated tree.

## Tech Stack
React + Vite + Tailwind (frontend) - Node.js + Express (backend) - MongoDB + Mongoose
(database) - Socket.IO (real-time, stubbed) - JWT + bcrypt (auth, stubbed for MVP demo)

## Next Steps To Build Out
1. Wire real authentication (JWT) across all role routes — currently open for demo speed.
2. Build out Athlete/Coach/Sponsor/Academy dashboards using ParentDashboard.jsx as a pattern.
3. Replace placeholder SportProfile data with real, sourced research.
4. Add a real coach signup flow, then swap the neutral coach-score placeholder for live data.
5. Geocode additional cities/academies as the platform expands beyond Vijayawada.
