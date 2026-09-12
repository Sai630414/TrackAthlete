/**
 * Role-aware welcome copy and quick actions.
 *
 * Lives on the server so the chip labels and the prompts they send stay in one place,
 * and so the role driving them is the authenticated one, not a value the browser chose.
 * A quick action is just a pre-written user message — it goes through exactly the same
 * validated, rate-limited chat pipeline as anything typed by hand.
 */

const ASSISTANT = {
  name: 'TrackMate',
  subtitle: 'Your AI Sports Development Companion'
};

// Split into a headline and a supporting line so the panel can give the greeting a
// real typographic hierarchy. `greeting` is kept as the combined string for any
// caller that predates the split.
const HEADLINE = 'Where would you like to go next?';
const SUBLINE =
  'I read what TrackAthlete already holds — pathways, academies, SAI centres, ' +
  'tournaments and your recommendations — and explain what it means for you.';

const GREETING = `${HEADLINE}\n\n${SUBLINE}`;

const DISCLAIMER =
  'TrackMate is an AI assistant, not a coach, doctor or official. Always confirm anything important.';

// Each action is a pre-written user message plus the presentation hints the panel
// needs (a short caption and a semantic icon key the client maps to a lucide icon).
// The prompt still travels through the identical validated, rate-limited pipeline.
const QUICK_ACTIONS = {
  athlete: [
    { label: 'My next step', caption: 'Where to focus now', icon: 'route',
      prompt: 'What should I focus on next to progress from my current level in my sport?' },
    { label: 'Find a coach', caption: 'Coaches on the platform', icon: 'users',
      prompt: 'How do I find and connect with a coach on TrackAthlete?' },
    { label: 'Tournaments', caption: 'What is coming up', icon: 'trophy',
      prompt: 'What tournaments are available for my sport right now?' },
    { label: 'Strengthen my profile', caption: 'Be easier to find', icon: 'badge',
      prompt: 'How can I improve my athlete profile on TrackAthlete?' }
  ],
  parent: [
    { label: 'Opportunities near us', caption: 'Academies and centres', icon: 'compass',
      prompt: 'What sports opportunities are available near us for my child?' },
    { label: 'Explain our scores', caption: 'How the ranking works', icon: 'chart',
      prompt: 'How does the sport recommendation score work, and what does my top result mean?' },
    { label: 'SAI pathways', caption: 'Government routes', icon: 'landmark',
      prompt: 'What SAI centres and government pathways are available for us?' },
    { label: 'Cost and timeline', caption: 'Stage by stage', icon: 'route',
      prompt: "What does the development roadmap look like for my child's sport?" }
  ],
  coach: [
    { label: 'My athletes', caption: 'Roster and requests', icon: 'users',
      prompt: 'How do I manage my athletes and mentorship requests on TrackAthlete?' },
    { label: 'How connections work', caption: 'Accepting athletes', icon: 'handshake',
      prompt: 'How does the athlete-coach connection process work?' },
    { label: 'Session notes', caption: 'Recording progress', icon: 'notes',
      prompt: 'How do session notes work and what makes a useful one?' }
  ],
  sponsor: [
    { label: 'Support an athlete', caption: 'Where to start', icon: 'handshake',
      prompt: 'How can I find and support an athlete through TrackAthlete?' },
    { label: 'Athlete discovery', caption: 'How matching works', icon: 'compass',
      prompt: 'How does athlete discovery work for sponsors on this platform?' },
    { label: 'What I can see', caption: 'Before sponsoring', icon: 'badge',
      prompt: 'What information can I see about an athlete before sponsoring them?' }
  ],
  academy: [
    { label: 'Get verified', caption: 'What the badge means', icon: 'badge',
      prompt: 'What does a verified academy mean on TrackAthlete and how does verification work?' },
    { label: 'My listing', caption: 'Keep it useful', icon: 'notes',
      prompt: 'How do I keep my academy listing useful for parents and athletes?' },
    { label: 'Reaching athletes', caption: 'How families search', icon: 'compass',
      prompt: 'How do athletes and parents discover academies on TrackAthlete?' }
  ],
  admin: [
    { label: 'Platform overview', caption: 'How modules fit', icon: 'compass',
      prompt: 'What does TrackAthlete do and how do its modules fit together?' },
    { label: 'The scoring engine', caption: 'All eleven rules', icon: 'chart',
      prompt: 'How does the 11-rule sport recommendation engine work?' },
    { label: 'Verification states', caption: 'Verified vs not', icon: 'badge',
      prompt: 'What do verified, unverified and last verified mean across the platform?' }
  ]
};

const FALLBACK_ACTIONS = [
  { label: 'What TrackAthlete does', caption: 'The short version', icon: 'compass',
    prompt: 'What does TrackAthlete do?' },
  { label: 'How recommendations work', caption: 'Rule-based scoring', icon: 'chart',
    prompt: 'How does the sport recommendation system work?' },
  { label: 'Verified academies', caption: 'What the badge means', icon: 'badge',
    prompt: 'What is a verified academy on TrackAthlete?' }
];

function getWelcome(role) {
  return {
    assistant: ASSISTANT,
    greeting: GREETING,
    headline: HEADLINE,
    subline: SUBLINE,
    disclaimer: DISCLAIMER,
    role: role || null,
    quickActions: QUICK_ACTIONS[role] || FALLBACK_ACTIONS
  };
}

module.exports = { getWelcome, ASSISTANT };
