import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Clock,
  Shield,
  Award,
  Users,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowRight,
  Eye,
  FileText,
  X,
  ExternalLink,
  Download,
  CheckCircle2,
  Lock,
  Sparkles
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const normalize = (val) => String(val || '').trim().toLowerCase();

function formatDate(dateStr) {
  if (!dateStr) return 'Date TBA';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getRankPriority(item) {
  const m = String(item.medal || '').toLowerCase();
  const p = String(item.position || item.outcome || '').toLowerCase();
  const d = String(item.description || '').toLowerCase();
  const combined = `${m} ${p} ${d}`;
  if (combined.includes('gold') || combined.includes('1st') || combined.includes('first') || combined.includes('winner') || combined.includes('champion') || p === '1') return 1;
  if (combined.includes('silver') || combined.includes('2nd') || combined.includes('second') || combined.includes('runner') || p === '2') return 2;
  if (combined.includes('bronze') || combined.includes('3rd') || combined.includes('third') || p === '3') return 3;
  if (combined.includes('4th') || combined.includes('fourth') || p === '4') return 4;
  return 99;
}

function getRankLabel(item, fallbackRank) {
  const m = String(item.medal || '').trim();
  const p = String(item.position || item.outcome || '').trim();
  const d = String(item.description || '').trim();
  if (m) return `${m} Medal`;
  if (d && (d.toLowerCase().includes('prize') || d.toLowerCase().includes('place') || d.toLowerCase().includes('medalist'))) return d;
  if (p) return (p.toLowerCase().includes('place') || p.toLowerCase().includes('rank') || p.toLowerCase().includes('winner')) ? p : `Rank ${p}`;
  if (fallbackRank === 1) return 'Winner (1st Place / Gold)';
  if (fallbackRank === 2) return 'Runner-up (2nd Place / Silver)';
  if (fallbackRank === 3) return '3rd Place / Bronze';
  return 'Participant';
}

export default function HomePage() {
  const { user } = useAuth() || {};
  const navigate = useNavigate();

  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [completedResults, setCompletedResults] = useState([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [loadingCompleted, setLoadingCompleted] = useState(true);
  const [upcomingError, setUpcomingError] = useState('');
  const [completedError, setCompletedError] = useState('');

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState('ALL');

  // Modals
  const [selectedEventModal, setSelectedEventModal] = useState(null);
  const [selectedResultModal, setSelectedResultModal] = useState(null);
  const [pdfModal, setPdfModal] = useState(null);

  // Horizontal Rails Ref
  const upcomingRailRef = useRef(null);
  const completedRailRef = useRef(null);

  const scrollRail = (railRef, direction) => {
    if (railRef.current) {
      railRef.current.scrollBy({ left: direction * 340, behavior: 'smooth' });
    }
  };

  // Load upcoming events (Federation + Organizer unified)
  useEffect(() => {
    let isMounted = true;
    setLoadingUpcoming(true);
    setUpcomingError('');

    api.get('/tournaments/upcoming')
      .then(({ data }) => {
        if (!isMounted) return;
        const payload = data || {};
        const fedList = (payload.federationEvents || []).map(e => ({
          ...e,
          source: 'federation',
          sportBadge: e.sport || 'Sports',
          displayDate: e.tournamentDate || e.startDate,
          venueName: e.location || 'Official Venue',
          categoryLabel: e.category || 'National / State Championship'
        }));

        const orgList = (payload.organizerEvents || []).map(e => {
          const sports = e.sports || [];
          const primarySport = sports[0]?.sportName || 'Sport';
          return {
            ...e,
            source: 'organizer',
            isOrganizerEvent: true,
            sportBadge: primarySport,
            displayDate: e.eventDate,
            venueName: e.venue || e.venueAddress?.city || 'Venue TBA',
            categoryLabel: 'Organizer Championship'
          };
        });

        const unified = [...orgList, ...fedList].sort((a, b) => {
          const tA = new Date(a.displayDate || 0).getTime();
          const tB = new Date(b.displayDate || 0).getTime();
          return tA - tB;
        });

        setUpcomingEvents(unified);
      })
      .catch(err => {
        if (!isMounted) return;
        console.error('Error fetching upcoming events:', err);
        setUpcomingError('Unable to load upcoming tournaments right now. Please refresh.');
      })
      .finally(() => {
        if (isMounted) setLoadingUpcoming(false);
      });

    return () => { isMounted = false; };
  }, []);

  // Load completed tournaments (Federation achievements + Organizer results)
  useEffect(() => {
    let isMounted = true;
    setLoadingCompleted(true);
    setCompletedError('');

    Promise.all([
      api.get('/tournaments/completed').catch(() => ({ data: [] })),
      api.get('/organizer-events/completed').catch(() => ({ data: { results: [] } }))
    ])
      .then(([fedRes, orgRes]) => {
        if (!isMounted) return;
        const fedGroupMap = new Map();
        (fedRes.data || []).forEach(ach => {
          const tName = (ach.tournamentName || ach.event?.eventName || 'Official Championship').trim();
          const key = normalize(tName);
          if (!fedGroupMap.has(key)) {
            fedGroupMap.set(key, {
              _id: `fed-${ach.event?._id || ach._id}`,
              source: 'federation',
              tournamentName: tName,
              sport: ach.sport || ach.event?.sport || 'Sport',
              eventDate: ach.eventDate || ach.event?.tournamentDate || ach.createdAt,
              location: ach.event?.location || 'Official Venue',
              category: ach.category || ach.event?.category || 'State / National Level',
              federation: ach.federation || ach.event?.federation || null,
              isFrozen: ach.isFrozen,
              frozenAt: ach.frozenAt || ach.createdAt,
              certificateData: ach.certificateData || null,
              certificateFileName: ach.certificateFileName || 'Federation_Certificate.pdf',
              entries: []
            });
          }

          const group = fedGroupMap.get(key);
          if (!group.certificateData && ach.certificateData) {
            group.certificateData = ach.certificateData;
            group.certificateFileName = ach.certificateFileName || 'Federation_Certificate.pdf';
          }

          const athleteName = ach.athlete?.name || ach.athleteName || 'Verified Athlete';
          const priority = getRankPriority(ach);
          const rankLabel = getRankLabel(ach, priority);

          group.entries.push({
            _id: ach._id,
            athleteName,
            athleteId: ach.athlete?.athleteId || ach.athleteId || '',
            priority,
            rankLabel,
            medal: ach.medal,
            position: ach.position,
            description: ach.description,
            category: ach.category || ach.event?.category,
            certificateData: ach.certificateData,
            certificateFileName: ach.certificateFileName || 'Federation_Certificate.pdf'
          });
        });

        const orgGroupMap = new Map();
        (orgRes.data?.results || []).forEach(r => {
          const event = r.event || {};
          const matchedSport = event.sports?.find(s => String(s._id) === String(r.sportConfigId));
          const sportName = matchedSport?.sportName || 'Sport';
          const tName = (event.eventName || 'Organizer Tournament').trim();
          const key = `${r.event?._id || normalize(tName)}_${String(r.sportConfigId || '')}`;

          const entriesList = (r.entries || []).map((entry, idx) => {
            const entityName = entry.teamName || entry.name || entry.team?.name || 'Participant';
            const priority = getRankPriority(entry);
            const rankLabel = getRankLabel(entry, priority);
            return {
              _id: entry._id || `${r._id}-${idx}`,
              entityName,
              athleteName: entityName,
              teamName: entityName,
              priority,
              rankLabel,
              medal: entry.medal,
              position: entry.position,
              outcome: entry.outcome,
              roster: entry.roster || [],
              certificateData: r.certificateData,
              certificateFileName: r.certificateFileName || 'Organizer_Certificate.pdf'
            };
          });

          orgGroupMap.set(key, {
            _id: `org-${r._id}`,
            source: 'organizer',
            tournamentName: tName,
            sport: sportName,
            eventDate: event.eventDate || r.frozenAt || r.createdAt,
            location: event.venue || event.venueAddress?.city || 'Venue TBA',
            category: 'Organizer Championship',
            organizer: r.organizer || event.organizer || null,
            isFrozen: r.isFrozen,
            frozenAt: r.frozenAt || r.createdAt,
            certificateData: r.certificateData || null,
            certificateFileName: r.certificateFileName || 'Organizer_Certificate.pdf',
            entries: entriesList
          });
        });

        const processGroup = (group) => {
          group.entries.sort((a, b) => a.priority - b.priority);
          const first = group.entries.find(e => e.priority === 1) || group.entries[0];
          const second = group.entries.find(e => e.priority === 2) || (group.entries.length > 1 && group.entries[1] !== first ? group.entries[1] : null);

          const winnerName = first ? (first.athleteName || first.entityName || first.teamName) : 'TBD';
          const distinctSecond = group.entries.find(e => {
            const name = e.athleteName || e.entityName || e.teamName;
            return name && name.toLowerCase() !== winnerName.toLowerCase();
          });
          const runnerUpName = distinctSecond ? (distinctSecond.athleteName || distinctSecond.entityName || distinctSecond.teamName) : '—';

          return {
            ...group,
            winner: winnerName,
            runnerUp: runnerUpName
          };
        };

        const fedList = Array.from(fedGroupMap.values()).map(processGroup);
        const orgList = Array.from(orgGroupMap.values()).map(processGroup);

        const unified = [...fedList, ...orgList].sort((a, b) => {
          const tA = new Date(a.eventDate || a.frozenAt || 0).getTime();
          const tB = new Date(b.eventDate || b.frozenAt || 0).getTime();
          return tB - tA;
        });

        setCompletedResults(unified);
      })
      .catch(err => {
        if (!isMounted) return;
        console.error('Error fetching completed results:', err);
        setCompletedError('Unable to load completed tournaments right now. Please refresh.');
      })
      .finally(() => {
        if (isMounted) setLoadingCompleted(false);
      });

    return () => { isMounted = false; };
  }, []);

  // Compute unique sports from available data
  const availableSports = useMemo(() => {
    const set = new Set();
    upcomingEvents.forEach(e => {
      if (e.source === 'organizer' && e.sports) {
        e.sports.forEach(s => s.sportName && set.add(s.sportName.toUpperCase()));
      } else if (e.sport) {
        set.add(e.sport.toUpperCase());
      }
    });
    completedResults.forEach(r => {
      if (r.sport) set.add(r.sport.toUpperCase());
    });
    return Array.from(set).sort();
  }, [upcomingEvents, completedResults]);

  // Filtered Upcoming Events
  const filteredUpcoming = useMemo(() => {
    return upcomingEvents.filter(evt => {
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery = !q || (
        (evt.eventName && evt.eventName.toLowerCase().includes(q)) ||
        (evt.location && evt.location.toLowerCase().includes(q)) ||
        (evt.venue && evt.venue.toLowerCase().includes(q)) ||
        (evt.sport && evt.sport.toLowerCase().includes(q)) ||
        (evt.sports && evt.sports.some(s => s.sportName && s.sportName.toLowerCase().includes(q)))
      );

      let matchesSport = true;
      if (selectedSport !== 'ALL') {
        const normSel = normalize(selectedSport);
        if (evt.source === 'organizer' && evt.sports) {
          matchesSport = evt.sports.some(s => normalize(s.sportName) === normSel);
        } else {
          matchesSport = normalize(evt.sport) === normSel;
        }
      }

      return matchesQuery && matchesSport;
    });
  }, [upcomingEvents, searchQuery, selectedSport]);

  // Filtered Completed Results
  const filteredCompleted = useMemo(() => {
    return completedResults.filter(res => {
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery = !q || (
        (res.tournamentName && res.tournamentName.toLowerCase().includes(q)) ||
        (res.location && res.location.toLowerCase().includes(q)) ||
        (res.sport && res.sport.toLowerCase().includes(q)) ||
        (res.winner && res.winner.toLowerCase().includes(q)) ||
        (res.runnerUp && res.runnerUp.toLowerCase().includes(q)) ||
        (res.entries && res.entries.some(e =>
          (e.athleteName && e.athleteName.toLowerCase().includes(q)) ||
          (e.entityName && e.entityName.toLowerCase().includes(q)) ||
          (e.teamName && e.teamName.toLowerCase().includes(q))
        ))
      );

      let matchesSport = true;
      if (selectedSport !== 'ALL') {
        matchesSport = normalize(res.sport) === normalize(selectedSport);
      }

      return matchesQuery && matchesSport;
    });
  }, [completedResults, searchQuery, selectedSport]);

  // Handle registration click: anonymous -> login, authenticated -> role dashboard or register
  const handleRegisterClick = (evt, sport) => {
    if (!user) {
      navigate(`/login?redirect=register&eventId=${evt._id}${sport?._id ? `&sportId=${sport._id}` : ''}`);
    } else if (user.role === 'athlete') {
      navigate('/athlete');
    } else {
      navigate('/login');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#e9ece7', color: '#1d2c31', fontFamily: 'inherit' }}>
      {/* ── TOP NAVIGATION BAR ── */}
      <header style={{
        background: 'linear-gradient(145deg, #173d3c, #0c292c)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        padding: '14px 24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }}>
        <div style={{
          maxWidth: 1240,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16
        }}>
          {/* Logo */}
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="login-logo" style={{ color: '#f4f4ee' }}>
              <span>ta</span>
              <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.04em' }}>trackathlete</span>
            </div>
            <span style={{
              display: 'none',
              marginLeft: 12,
              paddingLeft: 12,
              borderLeft: '1px solid rgba(255,255,255,0.15)',
              fontSize: 11,
              fontWeight: 700,
              color: '#b9d9bf',
              letterSpacing: '0.04em'
            }} className="hidden md:inline-block">
              Sports Events • Results • Achievements
            </span>
          </Link>

          {/* Nav Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#c5d3ce', fontSize: 12, fontWeight: 600 }} className="hidden sm:inline">
                  Welcome, <b>{user.name}</b>
                </span>
                <button
                  onClick={() => {
                    const roleRoute = {
                      athlete: '/athlete',
                      parent: '/parent',
                      coach: '/coach',
                      sponsor: '/sponsor',
                      academy: '/academy',
                      organizer: '/organizer',
                      federation: '/federation/dashboard'
                    }[user.role] || '/parent';
                    navigate(roleRoute);
                  }}
                  className="login-submit"
                  style={{
                    height: 38,
                    padding: '0 16px',
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    margin: 0,
                    cursor: 'pointer'
                  }}
                >
                  My Dashboard <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Link
                  to="/organizer/login"
                  style={{
                    color: '#c5d3ce',
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none',
                    padding: '8px 12px',
                    borderRadius: 7,
                    transition: 'all .18s'
                  }}
                  className="hidden sm:inline hover:text-white"
                >
                  Organizer
                </Link>
                <Link
                  to="/federation/login"
                  style={{
                    color: '#c5d3ce',
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none',
                    padding: '8px 12px',
                    borderRadius: 7,
                    transition: 'all .18s'
                  }}
                  className="hidden sm:inline hover:text-white"
                >
                  Federation
                </Link>
                <Link
                  to="/login"
                  style={{
                    color: '#f4f4ee',
                    fontSize: 12,
                    fontWeight: 800,
                    textDecoration: 'none',
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.06)',
                    letterSpacing: '0.04em'
                  }}
                >
                  SIGN IN
                </Link>
                <Link
                  to="/signup"
                  className="login-submit"
                  style={{
                    height: 38,
                    padding: '0 18px',
                    fontSize: 11,
                    letterSpacing: '0.05em',
                    margin: 0,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  SIGN UP
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="login-story" style={{
        minHeight: 'auto',
        padding: 'clamp(44px, 7vw, 76px) clamp(24px, 6vw, 100px)',
        position: 'relative'
      }}>
        <div style={{ maxWidth: 880, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <p className="eyebrow" style={{ fontSize: 11, letterSpacing: '0.2em', marginBottom: 16 }}>
            ONE PLATFORM · VERIFIED INDIAN SPORTS ECOSYSTEM
          </p>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(38px, 5.2vw, 68px)',
            fontWeight: 600,
            lineHeight: 1.04,
            letterSpacing: '-0.06em',
            color: '#f4f4ee',
            margin: '0 auto 20px'
          }}>
            Discover sports tournaments,<br />
            follow <em>verified results</em>,<br />
            and track your sporting journey.
          </h1>
          <p style={{
            color: '#c5d3ce',
            fontSize: 'clamp(14px, 1.8vw, 17px)',
            lineHeight: 1.75,
            maxWidth: 620,
            margin: '0 auto 30px'
          }}>
            From grassroots organizer championships to recognized National Sports Federation championships, explore official competitions across India before you sign in.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <a
              href="#upcoming-tournaments"
              className="login-submit"
              style={{
                height: 48,
                padding: '0 28px',
                fontSize: 13,
                textDecoration: 'none',
                letterSpacing: '0.04em',
                margin: 0,
                cursor: 'pointer'
              }}
            >
              EXPLORE TOURNAMENTS <ArrowRight size={16} />
            </a>
            {!user && (
              <Link
                to="/signup"
                style={{
                  height: 48,
                  padding: '0 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 9,
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 800,
                  textDecoration: 'none',
                  letterSpacing: '0.04em'
                }}
              >
                CREATE ATHLETE PROFILE
              </Link>
            )}
          </div>

          <div className="story-foot" style={{ marginTop: 36, justifyContent: 'center' }}>
            <i /> Built for the Indian sports ecosystem
          </div>
        </div>
      </section>

      {/* ── FILTER & SEARCH STRIP ── */}
      <section style={{
        background: '#ffffff',
        borderBottom: '1px solid #d8ded5',
        padding: '16px 24px',
        position: 'sticky',
        top: 66,
        zIndex: 30,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <div style={{
          maxWidth: 1240,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 420 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#81908e' }} />
            <input
              type="text"
              placeholder="Search tournament, venue, or city…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: 40,
                paddingLeft: 36,
                paddingRight: 12,
                borderRadius: 8,
                border: '1px solid #d2dad2',
                background: '#fffefa',
                fontSize: 13,
                outline: 'none',
                color: '#1d2c31'
              }}
            />
          </div>

          {/* Sport Selector Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 2, flex: '2 1 300px' }}>
            <button
              onClick={() => setSelectedSport('ALL')}
              style={{
                padding: '6px 14px',
                borderRadius: 7,
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: selectedSport === 'ALL' ? '#2f6d5a' : '#d8ded5',
                background: selectedSport === 'ALL' ? '#173d3c' : '#fcfcf8',
                color: selectedSport === 'ALL' ? '#ffffff' : '#526668',
                whiteSpace: 'nowrap',
                transition: 'all .15s'
              }}
            >
              ALL SPORTS
            </button>
            {availableSports.map(sp => (
              <button
                key={sp}
                onClick={() => setSelectedSport(sp)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 7,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: selectedSport === sp ? '#2f6d5a' : '#d8ded5',
                  background: selectedSport === sp ? '#173d3c' : '#fcfcf8',
                  color: selectedSport === sp ? '#ffffff' : '#526668',
                  whiteSpace: 'nowrap',
                  transition: 'all .15s'
                }}
              >
                {sp}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT AREA ── */}
      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '36px 20px', display: 'flex', flexDirection: 'column', gap: 48 }}>

        {/* ── 1. UPCOMING TOURNAMENTS SECTION ── */}
        <section id="upcoming-tournaments" style={{ scrollMarginTop: 130 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p className="eyebrow" style={{ color: '#cc694e', marginBottom: 6 }}>OFFICIAL &amp; ORGANIZER CHAMPIONSHIPS</p>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 700, color: '#173235', margin: 0, letterSpacing: '-0.04em' }}>
                Upcoming Tournaments
              </h2>
              <p style={{ color: '#697c7c', fontSize: 13, margin: '4px 0 0' }}>
                Discover upcoming sports events on TrackAthlete. Browse schedules, venues, and registration deadlines.
              </p>
            </div>

            {/* Scroll Navigation Controls */}
            {filteredUpcoming.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  aria-label="Previous events"
                  onClick={() => scrollRail(upcomingRailRef, -1)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: '1px solid #d8ded5',
                    background: '#ffffff',
                    color: '#173235',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                  }}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  aria-label="Next events"
                  onClick={() => scrollRail(upcomingRailRef, 1)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: '1px solid #d8ded5',
                    background: '#ffffff',
                    color: '#173235',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                  }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>

          {/* Content / Loading / Error States */}
          {loadingUpcoming ? (
            <div style={{
              background: '#fcfcf8',
              border: '1px solid #d8ded5',
              borderRadius: 14,
              padding: '48px 24px',
              textAlign: 'center',
              color: '#697c7c',
              fontSize: 13
            }}>
              Loading upcoming tournaments…
            </div>
          ) : upcomingError ? (
            <div style={{
              background: '#fff3f0',
              border: '1px solid #efcbc3',
              borderRadius: 14,
              padding: '24px',
              color: '#a44e3d',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>{upcomingError}</span>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid #efcbc3',
                  background: '#ffffff',
                  color: '#a44e3d',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Retry
              </button>
            </div>
          ) : filteredUpcoming.length === 0 ? (
            <div style={{
              background: '#fcfcf8',
              border: '1px dashed #d8ded5',
              borderRadius: 14,
              padding: '48px 24px',
              textAlign: 'center',
              color: '#697c7c'
            }}>
              <Trophy size={32} style={{ margin: '0 auto 10px', color: '#8a9d9a' }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: '#173235', margin: '0 0 4px' }}>
                No upcoming tournaments available.
              </p>
              <p style={{ fontSize: 12, margin: 0 }}>
                {searchQuery || selectedSport !== 'ALL'
                  ? 'No events match your current filter criteria. Try clearing search or selecting All Sports.'
                  : 'Check back soon for new official federation championships and organizer competitions.'}
              </p>
            </div>
          ) : (
            /* Horizontal Event Cards Rail */
            <div
              ref={upcomingRailRef}
              style={{
                display: 'flex',
                gap: 16,
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                paddingBottom: 12,
                scrollBehavior: 'smooth'
              }}
            >
              {filteredUpcoming.map(evt => {
                const isOrg = evt.isOrganizerEvent || evt.source === 'organizer';
                const sportsList = isOrg && evt.sports ? evt.sports : [{ sportName: evt.sport || 'Sport', _id: 'fed' }];
                const firstSport = sportsList[0] || {};
                const isClosed = evt.registrationDeadline && new Date(evt.registrationDeadline) < new Date();

                return (
                  <div
                    key={`up-${evt._id}`}
                    style={{
                      flex: '0 0 320px',
                      maxWidth: 320,
                      scrollSnapAlign: 'start',
                      background: '#fcfcf8',
                      border: '1px solid #d8ded5',
                      borderRadius: 16,
                      padding: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 14px rgba(28, 69, 48, 0.05)',
                      transition: 'all .2s ease'
                    }}
                  >
                    <div>
                      {/* Top Badges Row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                        {/* Separate Visual Sport Tag */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {sportsList.map((sp, idx) => (
                            <span
                              key={idx}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: '#e2eee4',
                                color: '#194e42',
                                border: '1px solid rgba(47,109,90,0.3)',
                                fontSize: 10,
                                fontWeight: 800,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase'
                              }}
                            >
                              [ {sp.sportName || sp} ]
                            </span>
                          ))}
                        </div>

                        {/* Source Badge */}
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            background: isOrg ? '#e2eee4' : '#fdf4e7',
                            color: isOrg ? '#194e42' : '#92400e',
                            border: `1px solid ${isOrg ? 'rgba(47,109,90,0.4)' : 'rgba(217,119,6,0.4)'}`
                          }}
                        >
                          {isOrg ? '[ORGANIZER EVENT]' : '[FEDERATION]'}
                        </span>
                      </div>

                      {/* Event Name */}
                      <h3 style={{
                        fontFamily: 'Georgia, serif',
                        fontSize: 18,
                        fontWeight: 700,
                        color: '#173235',
                        margin: '0 0 12px',
                        lineHeight: 1.25
                      }}>
                        {evt.eventName}
                      </h3>

                      {/* Metadata Grid */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#526668', marginBottom: 18 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Calendar size={14} style={{ color: '#cc694e', flexShrink: 0 }} />
                          <span><b>Date:</b> {formatDate(evt.displayDate)}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <MapPin size={14} style={{ color: '#cc694e', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <b>Location:</b> {evt.venueName}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Shield size={14} style={{ color: '#2f6d5a', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <b>By:</b> {evt.source === 'federation'
                              ? `${evt.federation?.name || 'National Federation'} (${evt.federation?.state || 'State'} HQ)`
                              : (evt.organizer?.organizationName || evt.organizer?.name || 'Organizer')}
                          </span>
                        </div>

                        {evt.registrationDeadline && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <Clock size={14} style={{ color: '#cc694e', flexShrink: 0 }} />
                            <span>
                              <b>Reg. Deadline:</b> {formatDate(evt.registrationDeadline)}
                            </span>
                          </div>
                        )}

                        {isOrg && firstSport.competitionType && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <Users size={14} style={{ color: '#2f6d5a', flexShrink: 0 }} />
                            <span>
                              <b>Format:</b> {firstSport.competitionType === 'team'
                                ? `Team (${firstSport.minimumTeamSize || 11}-${firstSport.maximumTeamSize || 15} players)`
                                : 'Individual'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 14, borderTop: '1px solid #e2eee4' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedEventModal(evt)}
                        style={{
                          flex: 1,
                          height: 38,
                          borderRadius: 8,
                          border: '1px solid rgba(47,109,90,0.3)',
                          background: '#e2eee4',
                          color: '#194e42',
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: '0.03em',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}
                      >
                        <Eye size={13} /> VIEW EVENT
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRegisterClick(evt, firstSport)}
                        disabled={isClosed}
                        className="login-submit"
                        style={{
                          flex: 1,
                          height: 38,
                          margin: 0,
                          fontSize: 11,
                          letterSpacing: '0.03em',
                          cursor: isClosed ? 'not-allowed' : 'pointer',
                          opacity: isClosed ? 0.6 : 1
                        }}
                      >
                        {isClosed ? 'CLOSED' : 'REGISTER'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 2. COMPLETED TOURNAMENTS SECTION ── */}
        <section id="completed-tournaments" style={{ scrollMarginTop: 130 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p className="eyebrow" style={{ color: '#cc694e', marginBottom: 6 }}>IMMUTABLE LEDGER &amp; VERIFIED OUTCOMES</p>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 700, color: '#173235', margin: 0, letterSpacing: '-0.04em' }}>
                Completed Tournaments
              </h2>
              <p style={{ color: '#697c7c', fontSize: 13, margin: '4px 0 0' }}>
                Explore completed tournaments and verified results from official federations and organizers.
              </p>
            </div>

            {/* Scroll Navigation Controls */}
            {filteredCompleted.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  aria-label="Previous results"
                  onClick={() => scrollRail(completedRailRef, -1)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: '1px solid #d8ded5',
                    background: '#ffffff',
                    color: '#173235',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                  }}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  aria-label="Next results"
                  onClick={() => scrollRail(completedRailRef, 1)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: '1px solid #d8ded5',
                    background: '#ffffff',
                    color: '#173235',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                  }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>

          {/* Content / Loading / Error States */}
          {loadingCompleted ? (
            <div style={{
              background: '#fcfcf8',
              border: '1px solid #d8ded5',
              borderRadius: 14,
              padding: '48px 24px',
              textAlign: 'center',
              color: '#697c7c',
              fontSize: 13
            }}>
              Loading completed tournament results…
            </div>
          ) : completedError ? (
            <div style={{
              background: '#fff3f0',
              border: '1px solid #efcbc3',
              borderRadius: 14,
              padding: '24px',
              color: '#a44e3d',
              fontSize: 13
            }}>
              {completedError}
            </div>
          ) : filteredCompleted.length === 0 ? (
            <div style={{
              background: '#fcfcf8',
              border: '1px dashed #d8ded5',
              borderRadius: 14,
              padding: '48px 24px',
              textAlign: 'center',
              color: '#697c7c'
            }}>
              <Award size={32} style={{ margin: '0 auto 10px', color: '#8a9d9a' }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: '#173235', margin: '0 0 4px' }}>
                No completed tournaments available.
              </p>
              <p style={{ fontSize: 12, margin: 0 }}>
                {searchQuery || selectedSport !== 'ALL'
                  ? 'No completed records match your search filter.'
                  : 'Official results will appear here once championships are completed and certified.'}
              </p>
            </div>
          ) : (
            /* Horizontal Completed Cards Rail */
            <div
              ref={completedRailRef}
              style={{
                display: 'flex',
                gap: 16,
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                paddingBottom: 12,
                scrollBehavior: 'smooth'
              }}
            >
              {filteredCompleted.map(res => {
                const isOrg = res.source === 'organizer';

                return (
                  <div
                    key={`comp-${res._id}`}
                    style={{
                      flex: '0 0 320px',
                      maxWidth: 320,
                      scrollSnapAlign: 'start',
                      background: '#fcfcf8',
                      border: '1px solid #d8ded5',
                      borderRadius: 16,
                      padding: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 14px rgba(28, 69, 48, 0.05)'
                    }}
                  >
                    <div>
                      {/* Top Badges Row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                        {/* Separate Visual Sport Tag */}
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: '#e2eee4',
                            color: '#194e42',
                            border: '1px solid rgba(47,109,90,0.3)',
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase'
                          }}
                        >
                          [ {res.sport} ]
                        </span>

                        {/* Source Badge */}
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            background: isOrg ? '#e2eee4' : '#fdf4e7',
                            color: isOrg ? '#194e42' : '#92400e',
                            border: `1px solid ${isOrg ? 'rgba(47,109,90,0.4)' : 'rgba(217,119,6,0.4)'}`
                          }}
                        >
                          {isOrg ? '[ORGANIZER EVENT]' : '[FEDERATION]'}
                        </span>
                      </div>

                      {/* Tournament / Event Name */}
                      <h3 style={{
                        fontFamily: 'Georgia, serif',
                        fontSize: 17,
                        fontWeight: 700,
                        color: '#173235',
                        margin: '0 0 10px',
                        lineHeight: 1.3
                      }}>
                        {res.tournamentName}
                      </h3>

                      {/* Result Details */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#526668', marginBottom: 18 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Calendar size={14} style={{ color: '#cc694e', flexShrink: 0 }} />
                          <span><b>Date:</b> {formatDate(res.eventDate)}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <MapPin size={14} style={{ color: '#cc694e', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <b>Location:</b> {res.location}
                          </span>
                        </div>
                      </div>

                      {/* Winner & Runner-up Podium Card Summary */}
                      <div style={{
                        background: '#f4f8f3',
                        border: '1px solid #d8ded5',
                        borderRadius: 10,
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        marginBottom: 14,
                        fontSize: 12
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                          <span style={{ fontSize: 14, flexShrink: 0 }}>🥇</span>
                          <span style={{ color: '#173235', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <b>Winner:</b> <span style={{ color: '#194e42', fontWeight: 800 }}>{res.winner || 'TBD'}</span>
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                          <span style={{ fontSize: 14, flexShrink: 0 }}>🥈</span>
                          <span style={{ color: '#173235', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <b>Runner-up:</b> <span style={{ color: '#526668', fontWeight: 700 }}>{res.runnerUp || 'TBD'}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Action */}
                    <div style={{ paddingTop: 14, borderTop: '1px solid #e2eee4' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedResultModal(res)}
                        style={{
                          width: '100%',
                          height: 38,
                          borderRadius: 8,
                          border: '1px solid #173d3c',
                          background: '#173d3c',
                          color: '#ffffff',
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}
                      >
                        <FileText size={13} /> VIEW RESULTS
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 3. READY TO PARTICIPATE CTA SECTION ── */}
        <section style={{
          background: 'linear-gradient(140deg, #f8f8f2, #e6e9e2)',
          border: '1px solid #d8ded5',
          borderRadius: 20,
          padding: 'clamp(32px, 5vw, 56px) clamp(24px, 4vw, 48px)',
          textAlign: 'center',
          boxShadow: '0 8px 24px rgba(28, 69, 48, 0.06)'
        }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <p className="eyebrow" style={{ color: '#cc694e', marginBottom: 8 }}>JOIN TRACKATHLETE TODAY</p>
            <h2 style={{
              fontFamily: 'Georgia, serif',
              fontSize: 'clamp(28px, 3.8vw, 42px)',
              fontWeight: 700,
              color: '#173235',
              margin: '0 0 14px',
              letterSpacing: '-0.05em'
            }}>
              Ready to participate?
            </h2>
            <p style={{ color: '#526668', fontSize: 14, lineHeight: 1.7, margin: '0 0 28px' }}>
              Create your TrackAthlete account and start participating in official championships, connecting with accredited coaches, and building your verified sports record.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <Link
                to="/signup"
                className="login-submit"
                style={{
                  height: 46,
                  padding: '0 28px',
                  fontSize: 12,
                  letterSpacing: '0.05em',
                  margin: 0,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                SIGN UP
              </Link>
              <Link
                to="/login"
                style={{
                  height: 46,
                  padding: '0 28px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: 9,
                  border: '1px solid #d8ded5',
                  background: '#ffffff',
                  color: '#173235',
                  fontSize: 12,
                  fontWeight: 800,
                  textDecoration: 'none',
                  letterSpacing: '0.04em'
                }}
              >
                SIGN IN
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* ── FOOTER ── */}
      <footer style={{
        background: '#173d3c',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '36px 24px',
        color: '#c5d3ce',
        fontSize: 12
      }}>
        <div style={{
          maxWidth: 1240,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="login-logo" style={{ color: '#f4f4ee' }}>
              <span>ta</span>
              <span style={{ fontSize: 17, fontWeight: 900 }}>trackathlete</span>
            </div>
            <span style={{ fontSize: 11, color: '#adbfba' }}>
              Official Sports Competitions &amp; Verified Results Ledger
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18, fontSize: 11, fontWeight: 700 }}>
            <Link to="/login" style={{ color: '#c5d3ce', textDecoration: 'none' }}>Sign In</Link>
            <Link to="/signup" style={{ color: '#c5d3ce', textDecoration: 'none' }}>Sign Up</Link>
            <Link to="/organizer/login" style={{ color: '#c5d3ce', textDecoration: 'none' }}>Organizer Portal</Link>
            <Link to="/federation/login" style={{ color: '#c5d3ce', textDecoration: 'none' }}>Federation Portal</Link>
          </div>
        </div>
      </footer>

      {/* ── MODAL: PUBLIC EVENT DETAILS ── */}
      {selectedEventModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(12, 41, 44, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: 16
        }}>
          <div style={{
            background: '#fcfcf8',
            borderRadius: 20,
            border: '1px solid #2f6d5a',
            width: '100%',
            maxWidth: 600,
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #173d3c, #0c292c)',
              padding: '20px 24px',
              borderBottom: '1px solid #2f6d5a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'sticky',
              top: 0,
              zIndex: 2
            }}>
              <div>
                <div style={{
                  color: '#b9d9bf',
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em'
                }}>
                  {selectedEventModal.source === 'organizer' ? 'ORGANIZER EVENT DETAILS' : 'FEDERATION CHAMPIONSHIP DETAILS'}
                </div>
                <h3 style={{
                  color: '#ffffff',
                  fontFamily: 'Georgia, serif',
                  fontSize: 20,
                  fontWeight: 700,
                  margin: '4px 0 0'
                }}>
                  {selectedEventModal.eventName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEventModal(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#b9d9bf',
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: '#e2eee4',
                  color: '#194e42',
                  border: '1px solid rgba(47,109,90,0.4)',
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase'
                }}>
                  [ {selectedEventModal.sportBadge || selectedEventModal.sport} ]
                </span>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  background: selectedEventModal.source === 'organizer' ? '#e2eee4' : '#fdf4e7',
                  color: selectedEventModal.source === 'organizer' ? '#194e42' : '#92400e',
                  border: '1px solid rgba(0,0,0,0.1)'
                }}>
                  {selectedEventModal.source === 'organizer' ? 'Organizer Verified Event' : 'Federation Recognized Championship'}
                </span>
              </div>

              {/* Event Information Grid */}
              <div style={{
                background: '#f4f8f3',
                padding: 16,
                borderRadius: 12,
                border: '1px solid #d8ded5',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
                fontSize: 12
              }}>
                <div>
                  <span style={{ color: '#697c7c', display: 'block', fontSize: 11, fontWeight: 700 }}>TOURNAMENT DATE</span>
                  <span style={{ color: '#173235', fontWeight: 700 }}>
                    {formatDate(selectedEventModal.displayDate || selectedEventModal.tournamentDate || selectedEventModal.eventDate)}
                  </span>
                </div>

                <div>
                  <span style={{ color: '#697c7c', display: 'block', fontSize: 11, fontWeight: 700 }}>CONDUCTING VENUE &amp; LOCATION</span>
                  <span style={{ color: '#173235', fontWeight: 700 }}>
                    {selectedEventModal.venueName || selectedEventModal.location || 'Venue TBA'}
                  </span>
                </div>

                {selectedEventModal.registrationDeadline && (
                  <div>
                    <span style={{ color: '#697c7c', display: 'block', fontSize: 11, fontWeight: 700 }}>REGISTRATION DEADLINE</span>
                    <span style={{ color: '#173235', fontWeight: 700 }}>
                      {formatDate(selectedEventModal.registrationDeadline)}
                    </span>
                  </div>
                )}

                <div>
                  <span style={{ color: '#697c7c', display: 'block', fontSize: 11, fontWeight: 700 }}>ORGANIZING BODY</span>
                  <span style={{ color: '#173235', fontWeight: 700 }}>
                    {selectedEventModal.federation?.name || selectedEventModal.organizer?.organizationName || selectedEventModal.organizer?.name || 'Verified Authority'}
                  </span>
                </div>

                {selectedEventModal.source === 'federation' ? (
                  <>
                    <div>
                      <span style={{ color: '#697c7c', display: 'block', fontSize: 11, fontWeight: 700 }}>FEDERATION STATE HQ</span>
                      <span style={{ color: '#173235', fontWeight: 700 }}>
                        {selectedEventModal.federation?.state ? `${selectedEventModal.federation.state} State Headquarters` : 'National Headquarters'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#697c7c', display: 'block', fontSize: 11, fontWeight: 700 }}>OFFICIAL PUBLIC CONTACT</span>
                      <span style={{ color: '#173235', fontWeight: 700 }}>
                        {selectedEventModal.federation?.officialPhone ? `Phone: ${selectedEventModal.federation.officialPhone}` : (selectedEventModal.federation?.officialEmail ? `Email: ${selectedEventModal.federation.officialEmail}` : 'Available on official portal')}
                      </span>
                    </div>
                  </>
                ) : (
                  <div>
                    <span style={{ color: '#697c7c', display: 'block', fontSize: 11, fontWeight: 700 }}>CONTACT INFORMATION</span>
                    <span style={{ color: '#173235', fontWeight: 700 }}>
                      {selectedEventModal.organizer?.showContactDetailsPublicly
                        ? `${selectedEventModal.organizer.phone || ''} ${selectedEventModal.organizer.email ? `(${selectedEventModal.organizer.email})` : ''}`
                        : 'Official Communications via TrackAthlete Platform (Private)'}
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedEventModal.description && (
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: '#173235', margin: '0 0 6px', textTransform: 'uppercase' }}>
                    About this Competition
                  </h4>
                  <p style={{ fontSize: 13, color: '#526668', lineHeight: 1.6, margin: 0 }}>
                    {selectedEventModal.description}
                  </p>
                </div>
              )}

              {/* Sports / Events Offered */}
              {selectedEventModal.sports && selectedEventModal.sports.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: '#173235', margin: '0 0 10px', textTransform: 'uppercase' }}>
                    Disciplines &amp; Categories
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedEventModal.sports.map((sp, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #d8ded5',
                          borderRadius: 10,
                          padding: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, color: '#173235', fontSize: 13 }}>{sp.sportName}</div>
                          <div style={{ fontSize: 11, color: '#697c7c' }}>
                            {sp.competitionType === 'team'
                              ? `Team Event • ${sp.minimumTeamSize || 11}-${sp.maximumTeamSize || 15} players per squad`
                              : 'Individual Competition'}
                            {sp.feeAmount ? ` • Entry: ₹${sp.feeAmount}` : ''}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEventModal(null);
                            handleRegisterClick(selectedEventModal, sp);
                          }}
                          className="login-submit"
                          style={{
                            height: 34,
                            padding: '0 14px',
                            margin: 0,
                            fontSize: 11,
                            cursor: 'pointer'
                          }}
                        >
                          Register
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid #d8ded5' }}>
                <button
                  type="button"
                  onClick={() => setSelectedEventModal(null)}
                  style={{
                    height: 40,
                    padding: '0 18px',
                    borderRadius: 8,
                    border: '1px solid #d8ded5',
                    background: '#ffffff',
                    color: '#526668',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const evt = selectedEventModal;
                    setSelectedEventModal(null);
                    handleRegisterClick(evt, evt.sports?.[0]);
                  }}
                  className="login-submit"
                  style={{
                    height: 40,
                    padding: '0 22px',
                    margin: 0,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Register for Event <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PUBLIC COMPLETED RESULTS ── */}
      {selectedResultModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(12, 41, 44, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: 16
        }}>
          <div style={{
            background: '#fcfcf8',
            borderRadius: 20,
            border: '1px solid #2f6d5a',
            width: '100%',
            maxWidth: 620,
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #173d3c, #0c292c)',
              padding: '20px 24px',
              borderBottom: '1px solid #2f6d5a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'sticky',
              top: 0,
              zIndex: 2
            }}>
              <div>
                <div style={{
                  color: '#b9d9bf',
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em'
                }}>
                  {selectedResultModal.source === 'organizer' ? 'ORGANIZER VERIFIED RESULT' : 'OFFICIAL FEDERATION RECORD'}
                </div>
                <h3 style={{
                  color: '#ffffff',
                  fontFamily: 'Georgia, serif',
                  fontSize: 20,
                  fontWeight: 700,
                  margin: '4px 0 0'
                }}>
                  {selectedResultModal.tournamentName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedResultModal(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#b9d9bf',
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: '#e2eee4',
                  color: '#194e42',
                  border: '1px solid rgba(47,109,90,0.4)',
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase'
                }}>
                  [ {selectedResultModal.sport} ]
                </span>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  background: selectedResultModal.source === 'organizer' ? '#e2eee4' : '#fdf4e7',
                  color: selectedResultModal.source === 'organizer' ? '#194e42' : '#92400e',
                  border: '1px solid rgba(0,0,0,0.1)'
                }}>
                  {selectedResultModal.source === 'organizer' ? 'Organizer Verified Ledger' : 'Federation Recognized Record'}
                </span>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: '#173d3c',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 800
                }}>
                  IMMUTABLE &amp; FROZEN
                </span>
              </div>

              {/* Tournament Details Grid */}
              <div style={{
                background: '#f4f8f3',
                padding: 16,
                borderRadius: 12,
                border: '1px solid #d8ded5',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
                fontSize: 12
              }}>
                <div>
                  <span style={{ color: '#697c7c', display: 'block', fontSize: 11, fontWeight: 700 }}>COMPETITION DATE</span>
                  <span style={{ color: '#173235', fontWeight: 700 }}>
                    {formatDate(selectedResultModal.eventDate)}
                  </span>
                </div>

                <div>
                  <span style={{ color: '#697c7c', display: 'block', fontSize: 11, fontWeight: 700 }}>CONDUCTING VENUE</span>
                  <span style={{ color: '#173235', fontWeight: 700 }}>
                    {selectedResultModal.location}
                  </span>
                </div>

                <div>
                  <span style={{ color: '#697c7c', display: 'block', fontSize: 11, fontWeight: 700 }}>ORGANIZED BY</span>
                  <span style={{ color: '#173235', fontWeight: 700 }}>
                    {selectedResultModal.source === 'federation'
                      ? `${selectedResultModal.federation?.name || 'National Sports Federation'} (${selectedResultModal.federation?.state ? `${selectedResultModal.federation.state} State HQ` : 'National HQ'})`
                      : (selectedResultModal.organizer?.organizationName || selectedResultModal.organizer?.name || 'Authorized Organizer')}
                  </span>
                </div>

                <div>
                  <span style={{ color: '#697c7c', display: 'block', fontSize: 11, fontWeight: 700 }}>LEDGER STATUS</span>
                  <span style={{ color: '#194e42', fontWeight: 800 }}>
                    {selectedResultModal.isFrozen ? 'IMMUTABLE & FROZEN' : 'VERIFIED'}
                  </span>
                </div>
              </div>

              {/* Official Championship Results & Podium Breakdown */}
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 800, color: '#173235', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Official Results &amp; Podium Ledger ({selectedResultModal.entries?.length || 0})
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(selectedResultModal.entries || []).map((entry, idx) => {
                    const name = entry.athleteName || entry.entityName || entry.teamName || 'Athlete';
                    const medalIcon = entry.priority === 1 ? '🥇' : entry.priority === 2 ? '🥈' : entry.priority === 3 ? '🥉' : '🎖️';
                    return (
                      <div
                        key={entry._id || idx}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #d8ded5',
                          borderRadius: 12,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 18 }}>{medalIcon}</span>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 14, color: '#173235' }}>{name}</div>
                              <div style={{ fontSize: 11, color: '#697c7c' }}>
                                {entry.category ? `${entry.category} • ` : ''}{entry.rankLabel || entry.description || entry.outcome || 'Participant'}
                                {entry.athleteId ? ` • ID: ${entry.athleteId}` : ''}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: entry.priority === 1 ? '#fdf4e7' : '#e2eee4',
                              color: entry.priority === 1 ? '#92400e' : '#194e42',
                              border: '1px solid rgba(0,0,0,0.1)',
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: 'uppercase'
                            }}>
                              {entry.rankLabel}
                            </span>

                            {entry.certificateData && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPdfModal({
                                    dataUri: entry.certificateData,
                                    fileName: entry.certificateFileName || `${name}_Certificate.pdf`,
                                    title: `${name} Certificate`
                                  });
                                }}
                                style={{
                                  height: 30,
                                  padding: '0 10px',
                                  borderRadius: 6,
                                  border: 'none',
                                  background: '#194e42',
                                  color: '#ffffff',
                                  fontSize: 10,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                <Eye size={12} /> Certificate
                              </button>
                            )}
                          </div>
                        </div>

                        {/* If entry has a team roster */}
                        {entry.roster && entry.roster.length > 0 && (
                          <div style={{ marginTop: 6, paddingTop: 8, borderTop: '1px solid #f0f4f0' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#194e42', marginBottom: 6 }}>
                              Team Roster ({entry.roster.length} Players):
                            </div>
                            <div style={{ overflowX: 'auto', border: '1px solid #e2eee4', borderRadius: 8 }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                <thead>
                                  <tr style={{ background: '#f8faf7', textAlign: 'left', color: '#697c7c' }}>
                                    <th style={{ padding: '6px 10px' }}>#</th>
                                    <th style={{ padding: '6px 10px' }}>Player Name</th>
                                    <th style={{ padding: '6px 10px' }}>Type</th>
                                    <th style={{ padding: '6px 10px' }}>Role</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {entry.roster.map((player, pIdx) => (
                                    <tr key={pIdx} style={{ borderTop: '1px solid #f0f4f0' }}>
                                      <td style={{ padding: '6px 10px', color: '#697c7c' }}>{pIdx + 1}</td>
                                      <td style={{ padding: '6px 10px', fontWeight: 700, color: '#173235' }}>{player.name}</td>
                                      <td style={{ padding: '6px 10px' }}>
                                        <span style={{
                                          padding: '2px 5px',
                                          borderRadius: 4,
                                          fontSize: 9,
                                          fontWeight: 800,
                                          background: player.participantType === 'registered' ? '#e2eee4' : '#f4f8f3',
                                          color: player.participantType === 'registered' ? '#194e42' : '#697c7c'
                                        }}>
                                          {player.participantType === 'registered' ? 'Registered' : 'Manual'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '6px 10px', color: '#526668' }}>{player.isCaptain ? 'Captain' : 'Player'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Team Roster (If Top-level Organizer Team Sport) */}
              {selectedResultModal.roster && selectedResultModal.roster.length > 0 && !selectedResultModal.entries?.some(e => e.roster?.length) && (
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: '#173235', margin: '0 0 10px', textTransform: 'uppercase' }}>
                    Team Roster ({selectedResultModal.roster.length} Players)
                  </h4>
                  <div style={{
                    border: '1px solid #d8ded5',
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: '#ffffff'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f4f8f3', borderBottom: '1px solid #d8ded5', textAlign: 'left', color: '#526668', fontSize: 11 }}>
                          <th style={{ padding: '8px 12px' }}>#</th>
                          <th style={{ padding: '8px 12px' }}>Player</th>
                          <th style={{ padding: '8px 12px' }}>Participant Type</th>
                          <th style={{ padding: '8px 12px' }}>Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedResultModal.roster.map((player, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f0f4f0' }}>
                            <td style={{ padding: '8px 12px', color: '#697c7c', fontWeight: 700 }}>{idx + 1}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#173235' }}>{player.name}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 800,
                                background: player.participantType === 'registered' ? '#e2eee4' : '#f4f8f3',
                                color: player.participantType === 'registered' ? '#194e42' : '#697c7c'
                              }}>
                                {player.participantType === 'registered' ? 'Registered Athlete' : 'Manual Player'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', color: '#526668', fontSize: 11 }}>
                              {player.isCaptain ? 'Captain' : 'Player'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Certificate PDF Preview Button */}
              {selectedResultModal.certificateData && (
                <div style={{
                  background: '#f4f8f3',
                  padding: 16,
                  borderRadius: 12,
                  border: '1px solid #d8ded5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FileText size={20} style={{ color: '#e07050' }} />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#173235' }}>Official Certificate PDF</div>
                      <div style={{ fontSize: 11, color: '#697c7c' }}>{selectedResultModal.certificateFileName}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPdfModal({
                        dataUri: selectedResultModal.certificateData,
                        fileName: selectedResultModal.certificateFileName,
                        title: `${selectedResultModal.tournamentName} Certificate`
                      });
                    }}
                    style={{
                      height: 36,
                      padding: '0 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#194e42',
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Eye size={13} /> View Certificate
                  </button>
                </div>
              )}

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid #d8ded5' }}>
                <button
                  type="button"
                  onClick={() => setSelectedResultModal(null)}
                  style={{
                    height: 40,
                    padding: '0 20px',
                    borderRadius: 8,
                    border: '1px solid #d8ded5',
                    background: '#ffffff',
                    color: '#526668',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SAFE PDF VIEWER ── */}
      {pdfModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(12, 41, 44, 0.85)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 60,
          padding: 16
        }}>
          <div style={{
            background: '#fcfcf8',
            borderRadius: 20,
            border: '1px solid #2f6d5a',
            width: '100%',
            maxWidth: 820,
            height: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #173d3c, #0c292c)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileText size={18} style={{ color: '#e07050' }} />
                <span style={{ fontWeight: 800, fontSize: 14 }}>{pdfModal.title}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <a
                  href={pdfModal.dataUri}
                  download={pdfModal.fileName || 'certificate.pdf'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 32,
                    padding: '0 12px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                >
                  <Download size={13} /> Download
                </a>
                <button
                  type="button"
                  onClick={() => setPdfModal(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#b9d9bf',
                    cursor: 'pointer',
                    padding: 4
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Embedded PDF iframe */}
            <div style={{ flex: 1, background: '#525659' }}>
              <iframe
                src={pdfModal.dataUri}
                title="Certificate Preview"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
