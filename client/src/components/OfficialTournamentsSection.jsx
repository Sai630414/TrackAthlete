import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Calendar, Award, Shield, MapPin, Lock, Eye, FileText, ChevronLeft, ChevronRight, Users, CheckCircle, AlertCircle, X, Search, UserPlus, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const normalize = (val) => String(val || '').trim().toLowerCase();

function getRankPriority(item) {
  if (!item) return 99;
  const p = String(item.position !== undefined && item.position !== null ? item.position : (item.rank !== undefined && item.rank !== null ? item.rank : (item.outcome || ''))).trim().toLowerCase();
  if (p === '1' || p === '1st' || p.includes('1st') || p.includes('winner') || p.includes('champion')) return 1;
  if (p === '2' || p === '2nd' || p.includes('2nd') || p.includes('runner')) return 2;
  if (p === '3' || p === '3rd' || p.includes('3rd')) return 3;
  if (p === '4' || p === '4th' || p.includes('4th')) return 4;

  const m = String(item.medal || '').trim().toLowerCase();
  if (m === 'gold' || m.includes('gold')) return 1;
  if (m === 'silver' || m.includes('silver')) return 2;
  if (m === 'bronze' || m.includes('bronze')) return 3;

  const d = String(item.description || '').trim().toLowerCase();
  if (d.includes('gold') || d.includes('1st') || d.includes('first') || d.includes('winner') || d.includes('champion')) return 1;
  if (d.includes('silver') || d.includes('2nd') || d.includes('second') || d.includes('runner')) return 2;
  if (d.includes('bronze') || d.includes('3rd') || d.includes('third')) return 3;

  return 99;
}

function getRankLabel(item, fallbackRank) {
  if (!item) return 'Participant';
  const m = String(item.medal || '').trim();
  if (m && m.toLowerCase() !== 'undefined' && m.toLowerCase() !== 'null') return m.toLowerCase().includes('medal') ? m : `${m} Medal`;

  const p = String(item.position !== undefined && item.position !== null ? item.position : (item.rank !== undefined && item.rank !== null ? item.rank : (item.outcome || ''))).trim();
  if (p && p.toLowerCase() !== 'undefined' && p.toLowerCase() !== 'null') {
    const lPos = p.toLowerCase();
    if (lPos === '1' || lPos === '1st' || lPos.includes('1st') || lPos.includes('winner')) return 'Winner (1st Place / Gold)';
    if (lPos === '2' || lPos === '2nd' || lPos.includes('2nd') || lPos.includes('runner')) return 'Runner-up (2nd Place / Silver)';
    if (lPos === '3' || lPos === '3rd' || lPos.includes('3rd')) return '3rd Place / Bronze';
    return (lPos.includes('place') || lPos.includes('rank') || lPos.includes('winner')) ? p : `Rank ${p}`;
  }
  const d = String(item.description || '').trim();
  if (d && (d.toLowerCase().includes('prize') || d.toLowerCase().includes('place') || d.toLowerCase().includes('medalist') || d.toLowerCase().includes('winner'))) return d;

  if (fallbackRank === 1) return 'Winner (1st Place / Gold)';
  if (fallbackRank === 2) return 'Runner-up (2nd Place / Silver)';
  if (fallbackRank === 3) return '3rd Place / Bronze';
  return 'Participant';
}

export default function OfficialTournamentsSection({ athleteSport, athleteSports, eligibleOnly = false }) {
  const { user } = useAuth() || {};
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [completedResults, setCompletedResults] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [viewPdfModal, setViewPdfModal] = useState(null);
  const [teamModal, setTeamModal] = useState(null);
  const [notice, setNotice] = useState('');
  const [busyRegister, setBusyRegister] = useState('');

  const eligibleRail = useRef(null);
  const upcomingRail = useRef(null);
  const completedRail = useRef(null);

  const scrollRail = (rail, direction) => {
    rail.current?.scrollBy({ left: direction * 320, behavior: 'smooth' });
  };

  const allAthleteSports = useMemo(() => {
    let list = [];
    if (Array.isArray(athleteSports) && athleteSports.length > 0) {
      list = athleteSports;
    } else if (athleteSport) {
      list = Array.isArray(athleteSport) ? athleteSport : [athleteSport];
    }
    return list.map(s => normalize(s)).filter(Boolean);
  }, [athleteSports, athleteSport]);

  const sportsDisplayLabel = useMemo(() => {
    if (allAthleteSports.length === 0) return 'YOUR SPORTS';
    return allAthleteSports.map(s => s.toUpperCase()).join(', ');
  }, [allAthleteSports]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [upRes, compRes, orgCompRes, myRegRes] = await Promise.all([
        api.get('/tournaments/upcoming').catch(() => ({ data: [] })),
        api.get('/tournaments/completed').catch(() => ({ data: [] })),
        api.get('/organizer-events/completed').catch(() => ({ data: { results: [] } })),
        api.get('/organizer-events/my/registrations').catch(() => ({ data: { registrations: [] } }))
      ]);
      setMyRegistrations(myRegRes.data?.registrations || []);
      const payload = upRes.data || [];
      const fedUpcoming = (Array.isArray(payload) ? payload : (payload.federationEvents || [])).map(e => ({
        ...e,
        source: 'federation'
      }));
      const orgUpcoming = ((Array.isArray(payload) ? [] : payload.organizerEvents) || []).map(event => ({
        ...event,
        source: 'organizer',
        isOrganizerEvent: true,
        tournamentDate: event.eventDate,
        location: event.venue,
        submissionDeadline: event.registrationDeadline,
        sports: event.sports || [],
        category: 'Organizer Event'
      }));
      setUpcomingEvents([...orgUpcoming, ...fedUpcoming].sort((a, b) => new Date(a.tournamentDate || a.eventDate || 0) - new Date(b.tournamentDate || b.eventDate || 0)));

      // 1. Group Federation achievements by unique database event _id
      const fedGroupMap = new Map();
      (compRes.data || []).forEach(ach => {
        const eventId = String(ach.event?._id || ach.event?.eventId || ach.event || ach.officialRecordId || ach._id);
        const key = `fed_${eventId}`;
        const tName = (ach.event?.eventName || ach.tournamentName || 'Official Championship').trim();

        if (!fedGroupMap.has(key)) {
          fedGroupMap.set(key, {
            _id: `fed-${eventId}`,
            source: 'federation',
            tournamentName: tName,
            sport: ach.sport || ach.event?.sport || 'Sport',
            eventDate: ach.eventDate || ach.event?.tournamentDate || ach.createdAt,
            location: ach.event?.location || 'Official Venue',
            category: ach.category || ach.event?.category || 'State / National Level',
            federation: ach.federation || ach.event?.federation || null,
            officialRecordId: ach.officialRecordId || '',
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
        if (!group.officialRecordId && ach.officialRecordId) {
          group.officialRecordId = ach.officialRecordId;
        }

        const athleteName = ach.athlete?.name || ach.athleteName || 'Verified Athlete';
        const priority = getRankPriority(ach);
        const rankLabel = getRankLabel(ach, priority);

        const exists = group.entries.some(e => String(e._id) === String(ach._id));
        if (!exists) {
          group.entries.push({
            _id: ach._id,
            athleteName,
            athleteId: ach.athlete?.athleteId || ach.athleteId || '',
            priority,
            rankLabel,
            medal: ach.medal,
            position: ach.position || ach.rank,
            rank: ach.rank,
            description: ach.description,
            category: ach.category || ach.event?.category,
            certificateData: ach.certificateData,
            certificateFileName: ach.certificateFileName || 'Federation_Certificate.pdf'
          });
        }
      });

      // 2. Group Organizer results by unique database event _id
      const orgGroupMap = new Map();
      (orgCompRes.data?.results || []).forEach(r => {
        const event = r.event || {};
        const eventId = String(event._id || r.event || r._id);
        const key = `org_${eventId}`;
        const matchedSport = event.sports?.find(s => String(s._id) === String(r.sportConfigId));
        const sportName = matchedSport?.sportName || r.sportName || 'Sport';
        const tName = (event.eventName || 'Organizer Tournament').trim();

        const entriesList = (r.entries || []).map((entry, idx) => {
          const teamName = entry.teamName || entry.team?.name || '';
          const individualName = entry.name || entry.athleteName || '';
          const entityName = teamName || individualName || 'Participant';
          const priority = getRankPriority(entry);
          const rankLabel = getRankLabel(entry, priority);
          return {
            _id: entry._id || `${r._id}-${idx}`,
            entityName,
            athleteName: individualName,
            teamName,
            priority,
            rankLabel,
            medal: entry.medal,
            position: entry.position,
            outcome: entry.outcome,
            roster: entry.roster || [],
            certificateData: entry.certificateData || r.certificateData,
            certificateFileName: entry.certificateFileName || r.certificateFileName || 'Organizer_Certificate.pdf'
          };
        });

        if (!orgGroupMap.has(key)) {
          orgGroupMap.set(key, {
            _id: `org-${eventId}`,
            source: 'organizer',
            tournamentName: tName,
            sport: sportName,
            sportsList: sportName ? [sportName] : [],
            eventDate: event.eventDate || r.frozenAt || r.createdAt,
            location: event.venue || event.venueAddress?.city || 'Venue TBA',
            category: 'Organizer Championship',
            organizer: r.organizer || event.organizer || null,
            isFrozen: r.isFrozen,
            frozenAt: r.frozenAt || r.createdAt,
            certificateData: r.certificateData || null,
            certificateFileName: r.certificateFileName || 'Organizer_Certificate.pdf',
            entries: [...entriesList]
          });
        } else {
          const existing = orgGroupMap.get(key);
          if (sportName && !existing.sportsList.includes(sportName)) {
            existing.sportsList.push(sportName);
            existing.sport = existing.sportsList.join(', ');
          }
          if (!existing.certificateData && r.certificateData) {
            existing.certificateData = r.certificateData;
            existing.certificateFileName = r.certificateFileName || 'Organizer_Certificate.pdf';
          }
          entriesList.forEach(entry => {
            const exists = existing.entries.some(e => String(e._id) === String(entry._id));
            if (!exists) {
              existing.entries.push(entry);
            }
          });
        }
      });

      const getEntryTitle = (e) => {
        if (!e) return '';
        return (e.teamName || e.entityName || e.athleteName || '').trim();
      };

      const processGroup = (group) => {
        const uniqueEntries = [];
        const seen = new Set();
        for (const e of group.entries) {
          const key = String(e._id || `${e.athleteName || e.entityName}-${e.rankLabel}-${e.priority}`);
          if (!seen.has(key)) {
            seen.add(key);
            uniqueEntries.push(e);
          }
        }
        group.entries = uniqueEntries;
        group.entries.sort((a, b) => a.priority - b.priority);

        const first = group.entries.find(e => e.priority === 1) || (group.entries.length > 0 ? group.entries[0] : null);
        const winnerName = first ? getEntryTitle(first) : '';

        const second = group.entries.find(e => {
          const name = getEntryTitle(e);
          return name && name.toLowerCase() !== winnerName.toLowerCase() && (e.priority === 2 || (e !== first && e.priority <= 2));
        });
        const runnerUpName = second ? getEntryTitle(second) : '';

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
    } catch (err) {
      console.error('Error fetching tournaments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleIndividualRegister = async (event, sport) => {
    const key = `${event._id}:${sport._id}`;
    setBusyRegister(key);
    setNotice('');
    try {
      await api.post(`/organizer-events/${event._id}/register`, { sportConfigId: sport._id });
      setNotice(`Successfully registered for ${event.eventName} — ${sport.sportName.toUpperCase()}!`);
      loadData();
    } catch (err) {
      setNotice(err.response?.data?.error || 'Registration failed.');
    } finally {
      setBusyRegister('');
    }
  };

  const getButtonProps = (evt, sport) => {
    const isClosed = evt.submissionDeadline && new Date(evt.submissionDeadline) < new Date();
    if (sport.competitionType === 'team') {
      const reg = myRegistrations.find(r =>
        String(r.event?._id || r.event) === String(evt._id) &&
        String(r.sportConfigId) === String(sport._id)
      );
      if (reg) {
        if (reg.status === 'terminated') {
          return {
            label: 'TEAM TERMINATED',
            className: 'px-2.5 py-1 rounded bg-[#64748b] text-white text-[11px] font-bold cursor-pointer hover:bg-[#475569]',
            action: () => setTeamModal({ event: evt, sport })
          };
        }
        if (reg.status === 'join_request_pending') {
          return {
            label: 'REQUEST PENDING',
            className: 'px-2.5 py-1 rounded bg-[#d97706] text-white text-[11px] font-bold cursor-pointer hover:bg-[#b45309]',
            action: () => setTeamModal({ event: evt, sport })
          };
        }
        const isCaptain = reg.team && (
          String(reg.team.captain?._id || reg.team.captain) === String(user?._id) ||
          (user?.name && reg.team.captain?.name && user.name.trim().toLowerCase() === reg.team.captain.name.trim().toLowerCase())
        );
        if (isCaptain) {
          return {
            label: 'VIEW / MANAGE TEAM',
            className: 'px-2.5 py-1 rounded bg-[#194e42] text-white text-[11px] font-bold cursor-pointer hover:bg-[#123930]',
            action: () => setTeamModal({ event: evt, sport })
          };
        }
        return {
          label: 'VIEW TEAM',
          className: 'px-2.5 py-1 rounded bg-[#2f6d5a] text-white text-[11px] font-bold cursor-pointer hover:bg-[#194e42]',
          action: () => setTeamModal({ event: evt, sport })
        };
      }
      return {
        label: isClosed ? 'Closed' : 'Register Team',
        disabled: isClosed,
        className: 'px-2.5 py-1 rounded bg-[#194e42] text-white text-[11px] font-bold cursor-pointer disabled:opacity-50 hover:bg-[#123930]',
        action: () => setTeamModal({ event: evt, sport })
      };
    } else {
      const reg = myRegistrations.find(r =>
        String(r.event?._id || r.event) === String(evt._id) &&
        String(r.sportConfigId) === String(sport._id)
      );
      if (reg) {
        return {
          label: 'Registered',
          disabled: true,
          className: 'px-2.5 py-1 rounded bg-[#2f6d5a] text-white text-[11px] font-bold opacity-80 cursor-default',
          action: () => {}
        };
      }
      const isBusy = busyRegister === `${evt._id}:${sport._id}`;
      return {
        label: isClosed ? 'Closed' : isBusy ? 'Registering…' : 'Register',
        disabled: isClosed || isBusy,
        className: 'px-2.5 py-1 rounded bg-[#e07050] text-white text-[11px] font-bold cursor-pointer disabled:opacity-50 hover:bg-[#c95d3e]',
        action: () => handleIndividualRegister(evt, sport)
      };
    }
  };

  const eligibleEvents = useMemo(() => {
    if (allAthleteSports.length === 0 || !Array.isArray(upcomingEvents)) return [];

    const list = [];
    upcomingEvents.forEach(evt => {
      if (!evt) return;
      if (evt.source === 'organizer' || evt.isOrganizerEvent) {
        const matches = (evt.sports || []).filter(s => allAthleteSports.includes(normalize(s?.sportName)));
        if (matches.length > 0) {
          list.push({ ...evt, matchedSports: matches });
        }
      } else {
        if (allAthleteSports.includes(normalize(evt.sport))) {
          list.push(evt);
        }
      }
    });
    return list;
  }, [upcomingEvents, allAthleteSports]);

  if (loading) {
    return (
      <div className="bg-[#fcfcf8] border border-[#d8ded5] rounded-2xl p-6 text-center text-xs text-[#697c7c]">
        Loading official federation tournaments…
      </div>
    );
  }

  if (eligibleOnly) {
    return (
      <div className="space-y-6">
        {notice && (
          <div className="p-3 bg-[#e2eee4] border border-[#2f6d5a] rounded-xl text-xs font-bold text-[#194e42] flex justify-between items-center">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')} className="cursor-pointer text-[#194e42] font-extrabold">✕</button>
          </div>
        )}

        <div className="bg-[#f4f8f5] border border-[#2f6d5a]/40 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#e2eee4] border border-[#2f6d5a] flex items-center justify-center text-[#194e42]">
                <Award className="w-4 h-4 text-[#cc694e]" />
              </div>
              <div>
                <h4 className="font-extrabold text-[#173235] text-sm uppercase tracking-wider">
                  ELIGIBLE FOR YOU — MATCHING YOUR REGISTERED SPORT ({sportsDisplayLabel})
                </h4>
                <p className="text-xs text-[#526668] mt-0.5">
                  Published upcoming competitions matching your registered sporting discipline
                </p>
              </div>
            </div>
            {eligibleEvents.length > 0 && (
              <RailControls onPrevious={() => scrollRail(eligibleRail, -1)} onNext={() => scrollRail(eligibleRail, 1)} />
            )}
          </div>

          {eligibleEvents.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#697c7c] bg-white rounded-xl border border-dashed border-[#d8ded5]">
              No eligible tournaments available.
            </div>
          ) : (
            <div ref={eligibleRail} className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 pr-1">
              {eligibleEvents.map((evt) => {
                const isOrg = evt.isOrganizerEvent || evt.source === 'organizer';
                const isClosed = evt.submissionDeadline && new Date(evt.submissionDeadline) < new Date();
                return (
                  <div
                    key={`elig-${evt._id}`}
                    className="min-w-[280px] sm:min-w-[320px] max-w-[320px] snap-start p-4 rounded-xl border-2 border-[#2f6d5a] bg-white shadow-sm flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
                          {isOrg ? '[ ORGANIZER EVENT ]' : '[ FEDERATION ]'}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-[#173235] bg-[#f4f8f5] px-2 py-0.5 rounded border border-[#d2dad2]">
                          {isOrg ? 'Organizer Verified' : 'Federation Recognized'}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-[#173235] text-sm mt-2">{evt.eventName}</h4>
                      <p className="text-xs font-bold text-[#194e42] mt-0.5">
                        {isOrg
                          ? (evt.organizer?.organizationName || evt.organizer?.name || 'Event Organizer')
                          : (evt.federation?.name || 'Recognized Federation')}
                      </p>

                      <div className="mt-2.5">
                        <div className="text-[11px] font-bold text-[#526668] mb-1">Eligible Sport:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {isOrg ? (
                            evt.matchedSports?.map(s => (
                              <span
                                key={s._id || s.sportName}
                                className="px-2 py-0.5 rounded bg-[#e2eee4] border border-[#2f6d5a] text-[10px] font-extrabold text-[#194e42] uppercase"
                              >
                                [{s.sportName.toUpperCase()}]
                              </span>
                            ))
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-[#e2eee4] border border-[#2f6d5a] text-[10px] font-extrabold text-[#194e42] uppercase">
                              [{evt.sport?.toUpperCase()}]
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1 mt-3 text-xs text-[#526668]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#194e42]" />
                          <span>Tournament Date: <strong>{evt.tournamentDate ? new Date(evt.tournamentDate).toLocaleDateString('en-IN') : 'TBA'}</strong></span>
                        </div>
                        {evt.location && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#526668]" />
                            <span>Venue: {evt.location}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {isOrg && (
                      <div className="pt-3 border-t border-[#e2eee4] space-y-2">
                        {evt.matchedSports?.map(sport => {
                          const isTeam = sport.competitionType === 'team';
                          const feeLabel = sport.feeType === 'free' ? 'Free' : `₹${sport.feeAmount || 0} (${sport.feeType.replaceAll('_', ' ')})`;
                          return (
                            <div key={sport._id} className="flex items-center justify-between gap-2 bg-[#fcfcf8] p-2 rounded-lg border border-[#e2eee4]">
                              <div className="text-[11px]">
                                <div className="font-bold text-[#173235]">{isTeam ? 'Team Sport' : 'Individual'}</div>
                                <div className="text-[#526668]">{feeLabel}</div>
                              </div>
                              {(() => {
                                const btn = getButtonProps(evt, sport);
                                return (
                                  <button
                                    type="button"
                                    disabled={btn.disabled}
                                    onClick={btn.action}
                                    className={btn.className}
                                  >
                                    {btn.label}
                                  </button>
                                );
                              })()}
                            </div>
                          );
                        })}
                        <div className="text-[10px] text-[#697c7c]">
                          Registration deadline: {evt.submissionDeadline ? new Date(evt.submissionDeadline).toLocaleDateString('en-IN') : 'Open'}
                        </div>
                      </div>
                    )}

                    {!isOrg && (
                      <div className="pt-2 border-t border-[#e2eee4] text-[11px] text-[#697c7c]">
                        Official Submission Deadline: {evt.submissionDeadline ? new Date(evt.submissionDeadline).toLocaleDateString('en-IN') : 'Open'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {teamModal && (
          <TeamRegistrationModal
            event={teamModal.event}
            sport={teamModal.sport}
            onClose={() => setTeamModal(null)}
            onSuccess={(msg) => {
              setTeamModal(null);
              setNotice(msg);
              loadData();
            }}
          />
        )}

        {viewPdfModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl border border-[#2f6d5a]">
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#194e42]" />
                  <h3 className="font-bold text-base text-[#173235]">Official Certificate Preview</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewPdfModal(null)}
                  className="p-1 rounded-lg text-[#697c7c] hover:text-[#173235] hover:bg-[#f4f8f5] transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 bg-[#f8faf7] rounded-xl border text-center space-y-3">
                <p className="text-xs text-[#526668]">File: <b>{viewPdfModal.name || 'Certificate.pdf'}</b></p>
                <div className="flex justify-center gap-3">
                  <a
                    href={viewPdfModal.data}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-lg bg-[#194e42] text-white text-xs font-bold hover:bg-[#143d34] transition"
                  >
                    Open Certificate in New Tab
                  </a>
                  <a
                    href={viewPdfModal.data}
                    download={viewPdfModal.name || 'Certificate.pdf'}
                    className="px-4 py-2 rounded-lg border border-[#2f6d5a] text-[#194e42] text-xs font-bold hover:bg-[#e2eee4] transition"
                  >
                    Download Certificate
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#fcfcf8] border border-[#d8ded5] rounded-2xl p-6 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2eee4] pb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#194e42]" />
          <div>
            <h3 className="font-extrabold text-[#173235] text-base" style={{ fontFamily: 'Georgia, serif' }}>
              TOURNAMENTS &amp; RESULTS LEDGER
            </h3>
            <p className="text-xs text-[#526668]">
              Unified registry of official national sports federations &amp; organizer-verified championships
            </p>
          </div>
        </div>

        <div className="flex bg-[#e2eee4] p-1 rounded-xl gap-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
              activeTab === 'upcoming' ? 'bg-[#173235] text-white shadow-xs' : 'text-[#194e42] hover:text-[#173235]'
            }`}
          >
            UPCOMING TOURNAMENTS ({upcomingEvents.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
              activeTab === 'completed' ? 'bg-[#173235] text-white shadow-xs' : 'text-[#194e42] hover:text-[#173235]'
            }`}
          >
            COMPLETED TOURNAMENTS ({completedResults.length})
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-[#e2eee4] border border-[#2f6d5a] rounded-xl text-xs font-bold text-[#194e42] flex justify-between items-center">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="cursor-pointer text-[#194e42] font-extrabold">✕</button>
        </div>
      )}

      {activeTab === 'upcoming' ? (
        <div className="space-y-6">
          {allAthleteSports.length > 0 && (
            <div className="bg-[#f4f8f5] border border-[#2f6d5a]/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#cc694e]" />
                  <h4 className="font-extrabold text-[#173235] text-xs uppercase tracking-wider">
                    ELIGIBLE FOR YOU — MATCHING YOUR REGISTERED SPORT ({sportsDisplayLabel})
                  </h4>
                </div>
                {eligibleEvents.length > 0 && (
                  <RailControls onPrevious={() => scrollRail(eligibleRail, -1)} onNext={() => scrollRail(eligibleRail, 1)} />
                )}
              </div>

              {eligibleEvents.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#697c7c] bg-white rounded-lg border border-dashed border-[#d8ded5]">
                  No eligible tournaments available.
                </div>
              ) : (
                <div ref={eligibleRail} className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 pr-1">
                  {eligibleEvents.map((evt) => {
                    const isOrg = evt.isOrganizerEvent || evt.source === 'organizer';
                    const isClosed = evt.submissionDeadline && new Date(evt.submissionDeadline) < new Date();
                    return (
                      <div
                        key={`elig-${evt._id}`}
                        className="min-w-[280px] sm:min-w-[320px] max-w-[320px] snap-start p-4 rounded-xl border-2 border-[#2f6d5a] bg-white shadow-sm flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
                              {isOrg ? '[ ORGANIZER EVENT ]' : '[ FEDERATION ]'}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-[#173235] bg-[#f4f8f5] px-2 py-0.5 rounded border border-[#d2dad2]">
                              {isOrg ? 'Organizer Verified' : 'Federation Recognized'}
                            </span>
                          </div>

                          <h4 className="font-extrabold text-[#173235] text-sm mt-2">{evt.eventName}</h4>
                          <p className="text-xs font-bold text-[#194e42] mt-0.5">
                            {isOrg
                              ? (evt.organizer?.organizationName || evt.organizer?.name || 'Event Organizer')
                              : (evt.federation?.name || 'Recognized Federation')}
                          </p>

                          <div className="mt-2.5">
                            <div className="text-[11px] font-bold text-[#526668] mb-1">Eligible Sport:</div>
                            <div className="flex flex-wrap gap-1.5">
                              {isOrg ? (
                                evt.matchedSports?.map(s => (
                                  <span
                                    key={s._id || s.sportName}
                                    className="px-2 py-0.5 rounded bg-[#e2eee4] border border-[#2f6d5a] text-[10px] font-extrabold text-[#194e42] uppercase"
                                  >
                                    [{s.sportName.toUpperCase()}]
                                  </span>
                                ))
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-[#e2eee4] border border-[#2f6d5a] text-[10px] font-extrabold text-[#194e42] uppercase">
                                  [{evt.sport?.toUpperCase()}]
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1 mt-3 text-xs text-[#526668]">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-[#194e42]" />
                              <span>Tournament Date: <strong>{evt.tournamentDate ? new Date(evt.tournamentDate).toLocaleDateString('en-IN') : 'TBA'}</strong></span>
                            </div>
                            {evt.location && (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-[#526668]" />
                                <span>Venue: {evt.location}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {isOrg && (
                          <div className="pt-3 border-t border-[#e2eee4] space-y-2">
                            {evt.matchedSports?.map(sport => {
                              const isTeam = sport.competitionType === 'team';
                              const feeLabel = sport.feeType === 'free' ? 'Free' : `₹${sport.feeAmount || 0} (${sport.feeType.replaceAll('_', ' ')})`;
                              return (
                                <div key={sport._id} className="flex items-center justify-between gap-2 bg-[#fcfcf8] p-2 rounded-lg border border-[#e2eee4]">
                                  <div className="text-[11px]">
                                    <div className="font-bold text-[#173235]">{isTeam ? 'Team Sport' : 'Individual'}</div>
                                    <div className="text-[#526668]">{feeLabel}</div>
                                  </div>
                                  {(() => {
                                    const btn = getButtonProps(evt, sport);
                                    return (
                                      <button
                                        type="button"
                                        disabled={btn.disabled}
                                        onClick={btn.action}
                                        className={btn.className}
                                      >
                                        {btn.label}
                                      </button>
                                    );
                                  })()}
                                </div>
                              );
                            })}
                            <div className="text-[10px] text-[#697c7c]">
                              Registration deadline: {evt.submissionDeadline ? new Date(evt.submissionDeadline).toLocaleDateString('en-IN') : 'Open'}
                            </div>
                          </div>
                        )}

                        {!isOrg && (
                          <div className="pt-2 border-t border-[#e2eee4] text-[11px] text-[#697c7c]">
                            Official Submission Deadline: {evt.submissionDeadline ? new Date(evt.submissionDeadline).toLocaleDateString('en-IN') : 'Open'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-extrabold text-[#173235] text-xs uppercase tracking-wider">
                ALL UPCOMING TOURNAMENTS
              </h4>
              {upcomingEvents.length > 0 && (
                <RailControls onPrevious={() => scrollRail(upcomingRail, -1)} onNext={() => scrollRail(upcomingRail, 1)} />
              )}
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#697c7c] border border-dashed border-[#d8ded5] rounded-xl bg-[#f8faf7]">
                No upcoming tournaments published yet.
              </div>
            ) : (
              <div ref={upcomingRail} className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 pr-1">
                {upcomingEvents.map((evt) => {
                  const isOrg = evt.isOrganizerEvent || evt.source === 'organizer';
                  const isClosed = evt.submissionDeadline && new Date(evt.submissionDeadline) < new Date();
                  return (
                    <div
                      key={`all-${evt._id}`}
                      className="min-w-[280px] sm:min-w-[310px] max-w-[310px] snap-start p-4 rounded-xl border border-[#2f6d5a] bg-white shadow-2xs flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
                            {isOrg ? '[ ORGANIZER EVENT ]' : '[ FEDERATION ]'}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-[#173235] bg-[#f4f8f5] px-2 py-0.5 rounded border border-[#d2dad2]">
                            {isOrg ? 'Organizer Verified' : (evt.eventId || 'Federation Recognized')}
                          </span>
                        </div>

                        <h4 className="font-extrabold text-[#173235] text-sm mt-2">{evt.eventName}</h4>
                        <p className="text-xs font-bold text-[#194e42] mt-0.5">
                          {isOrg
                            ? (evt.organizer?.organizationName || evt.organizer?.name || 'Event Organizer')
                            : (evt.federation?.name || 'Recognized Federation')}
                        </p>

                        <div className="mt-2.5">
                          <div className="text-[11px] font-bold text-[#526668] mb-1">Sports:</div>
                          <div className="flex flex-wrap gap-1.5">
                            {isOrg ? (
                              evt.sports?.map(s => (
                                <span
                                  key={s._id || s.sportName}
                                  className="px-2 py-0.5 rounded border border-[#2f6d5a] bg-[#e2eee4] text-[10px] font-extrabold text-[#194e42] uppercase"
                                >
                                  [{s.sportName.toUpperCase()}]
                                </span>
                              ))
                            ) : (
                              <span className="px-2 py-0.5 rounded border border-[#2f6d5a] bg-[#e2eee4] text-[10px] font-extrabold text-[#194e42] uppercase">
                                [{evt.sport?.toUpperCase()}]
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1 mt-3 text-xs text-[#526668]">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#194e42]" />
                            <span>Tournament Date: <strong>{evt.tournamentDate ? new Date(evt.tournamentDate).toLocaleDateString('en-IN') : 'TBA'}</strong></span>
                          </div>
                          {evt.location && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-[#526668]" />
                              <span>Location: {evt.location}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {allAthleteSports.length > 0 && isOrg && evt.sports?.some(s => allAthleteSports.includes(normalize(s?.sportName))) && (
                        <div className="pt-2 border-t border-[#e2eee4] space-y-1.5">
                          {evt.sports.filter(s => allAthleteSports.includes(normalize(s?.sportName))).map(sport => {
                              const btn = getButtonProps(evt, sport);
                              return (
                                <div key={sport._id} className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-[#194e42]">Eligible</span>
                                  <button
                                    type="button"
                                    disabled={btn.disabled}
                                    onClick={btn.action}
                                    className={btn.className}
                                  >
                                    {btn.label}
                                  </button>
                                </div>
                              );
                            })}
                        </div>
                      )}

                      <div className="pt-2 border-t border-[#e2eee4] text-[11px] text-[#697c7c]">
                        {isOrg ? 'Registration deadline' : 'Official Submission Deadline'}: {evt.submissionDeadline ? new Date(evt.submissionDeadline).toLocaleDateString('en-IN') : 'Open'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-extrabold text-[#173235] text-xs uppercase tracking-wider">
              COMPLETED OFFICIAL &amp; ORGANIZER RESULTS
            </h4>
            {completedResults.length > 0 && (
              <RailControls onPrevious={() => scrollRail(completedRail, -1)} onNext={() => scrollRail(completedRail, 1)} />
            )}
          </div>

          {completedResults.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#697c7c] border border-dashed border-[#d8ded5] rounded-xl bg-[#f8faf7]">
              No completed official or organizer results published yet.
            </div>
          ) : (
            <div ref={completedRail} className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 pr-1">
              {completedResults.map((resItem) => {
                const isOrg = resItem.source === 'organizer';
                return (
                  <div
                    key={resItem._id}
                    className="min-w-[280px] sm:min-w-[310px] max-w-[310px] snap-start p-4 rounded-xl border border-[#2f6d5a] bg-white shadow-2xs flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#fef9e7] text-[#9a6c00] border border-[#f0d060] flex items-center gap-1">
                          <Lock size={10} /> {isOrg ? '[ ORGANIZER EVENT ]' : '[ FEDERATION ]'}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-[#173235] bg-[#f4f8f5] px-2 py-0.5 rounded border border-[#d2dad2]">
                          {isOrg ? 'Organizer Verified' : (resItem.officialRecordId || 'Federation Ledger')}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-[#173235] text-sm mt-2">
                        {resItem.tournamentName}
                      </h4>

                      <p className="text-[11px] text-[#526668] mt-0.5">
                        {isOrg
                          ? (resItem.organizer?.organizationName || resItem.organizer?.name || 'Verified Organizer')
                          : (resItem.federation?.name || 'Recognized Federation')}
                      </p>

                      <div className="mt-2.5">
                        <span className="px-2 py-0.5 rounded border border-[#2f6d5a] bg-[#e2eee4] text-[10px] font-extrabold text-[#194e42] uppercase">
                          [{resItem.sport?.toUpperCase()}]
                        </span>
                      </div>

                      {((resItem.winner && resItem.winner !== '—' && resItem.winner !== 'TBD') || (resItem.runnerUp && resItem.runnerUp !== '—' && resItem.runnerUp !== 'TBD')) && (
                        <div className="mt-2.5 p-2.5 bg-[#f4f8f5] rounded-lg border border-[#d8ded5] space-y-1 text-xs">
                          {resItem.winner && resItem.winner !== '—' && resItem.winner !== 'TBD' && (
                            <div className="flex items-center gap-1.5 text-[#173235] overflow-hidden">
                              <span className="shrink-0">🥇</span>
                              <span className="truncate">
                                <b>Winner:</b> <span className="font-extrabold text-[#194e42]">{resItem.winner}</span>
                              </span>
                            </div>
                          )}
                          {resItem.runnerUp && resItem.runnerUp !== '—' && resItem.runnerUp !== 'TBD' && (
                            <div className="flex items-center gap-1.5 text-[#173235] overflow-hidden">
                              <span className="shrink-0">🥈</span>
                              <span className="truncate">
                                <b>Runner-up:</b> <span className="font-bold text-[#526668]">{resItem.runnerUp}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-1 mt-2 text-xs text-[#526668]">
                        <div>
                          Tournament Date: {resItem.eventDate ? new Date(resItem.eventDate).toLocaleDateString('en-IN') : '—'}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#e2eee4] flex items-center justify-between">
                      {!isOrg ? (
                        <a
                          href={`/verify/${resItem.officialRecordId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-extrabold text-[#e07050] hover:underline"
                        >
                          Public Verification →
                        </a>
                      ) : (
                        <span className="text-xs font-bold text-[#2f6d5a]">Organizer Verified</span>
                      )}

                      {(resItem.certificateData || resItem.certificateUrl) && (
                        <button
                          type="button"
                          onClick={() => setViewPdfModal({
                            tournamentName: resItem.tournamentName,
                            certificateData: resItem.certificateData || resItem.certificateUrl
                          })}
                          className="px-2.5 py-1 rounded-md bg-[#e2eee4] text-[#194e42] font-bold text-xs flex items-center gap-1 border border-[#2f6d5a] cursor-pointer"
                        >
                          <Eye size={12} /> Certificate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {teamModal && (
        <TeamRegistrationModal
          event={teamModal.event}
          sport={teamModal.sport}
          onClose={() => setTeamModal(null)}
          onSuccess={(msg) => {
            setTeamModal(null);
            setNotice(msg);
            loadData();
          }}
        />
      )}

      {/* PDF VIEWER MODAL */}
      {viewPdfModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-[#d8ded5]">
            <div className="p-4 bg-[#173235] text-white flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#cc694e]" /> {viewPdfModal.tournamentName} — Official Certificate
              </h3>
              <button onClick={() => setViewPdfModal(null)} className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer">✕</button>
            </div>
            <div className="flex-1 p-4 bg-[#f4f8f5] overflow-auto">
              <iframe
                src={viewPdfModal.certificateData}
                className="w-full h-[60vh] border rounded-xl bg-white"
                title="Official Certificate Viewer"
              />
            </div>
            <div className="p-3 bg-white border-t flex justify-end">
              <button onClick={() => setViewPdfModal(null)} className="h-9 px-4 rounded-lg bg-[#173235] text-white font-bold text-xs cursor-pointer">Close Viewer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RailControls({ onPrevious, onNext }) {
  return (
    <div className="flex justify-end gap-2 mb-2" aria-label="Tournament carousel controls">
      <button type="button" onClick={onPrevious} className="h-8 w-8 rounded-lg border border-[#d2dad2] bg-white text-[#194e42] hover:bg-[#e2eee4] flex items-center justify-center cursor-pointer" aria-label="Previous tournaments">
        <ChevronLeft size={16} />
      </button>
      <button type="button" onClick={onNext} className="h-8 w-8 rounded-lg border border-[#d2dad2] bg-white text-[#194e42] hover:bg-[#e2eee4] flex items-center justify-center cursor-pointer" aria-label="Next tournaments">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export function TeamRegistrationModal({ event, sport, onClose, onSuccess }) {
  const { user } = useAuth() || {};

  // Status state from MongoDB backend
  const [statusLoading, setStatusLoading] = useState(true);
  const [athleteStatus, setAthleteStatus] = useState('NOT_REGISTERED'); // 'NOT_REGISTERED' | 'TEAM_CAPTAIN' | 'TEAM_MEMBER' | 'JOIN_REQUEST_PENDING' | 'TERMINATED'
  const [teamData, setTeamData] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // States for when athleteStatus === 'NOT_REGISTERED'
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'join'
  const [teamName, setTeamName] = useState('');
  const [captainType, setCaptainType] = useState('myself');
  const [selectedCaptain, setSelectedCaptain] = useState(null);
  const [captainSearchQuery, setCaptainSearchQuery] = useState('');
  const [captainSearchResults, setCaptainSearchResults] = useState([]);

  // Registered members for creation
  const [members, setMembers] = useState([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState([]);

  // Manual / External players for creation
  const [createAddMode, setCreateAddMode] = useState('registered'); // 'registered' | 'manual'
  const [createManualName, setCreateManualName] = useState('');
  const [createManualMobile, setCreateManualMobile] = useState('');
  const [createManualEmail, setCreateManualEmail] = useState('');
  const [createManualPlayers, setCreateManualPlayers] = useState([]);
  const [createManualError, setCreateManualError] = useState('');

  // Existing open teams to join
  const [existingTeams, setExistingTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // States for when athleteStatus === 'TEAM_CAPTAIN' (adding members to existing team)
  const [addMemberMode, setAddMemberMode] = useState('registered'); // 'registered' | 'manual'
  const [addRegisteredQuery, setAddRegisteredQuery] = useState('');
  const [addRegisteredResults, setAddRegisteredResults] = useState([]);
  const [manualName, setManualName] = useState('');
  const [manualMobile, setManualMobile] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [memberActionError, setMemberActionError] = useState('');

  const loadBackendStatus = useCallback(async () => {
    try {
      setStatusLoading(true);
      setStatusError('');
      const { data } = await api.get(`/organizer-events/${event._id}/sports/${sport._id}/my-status`);
      setAthleteStatus(data.status || 'NOT_REGISTERED');
      setTeamData(data.team || null);
    } catch (err) {
      console.error('Error fetching team status:', err);
      setStatusError('Unable to load current registration status from server.');
      setAthleteStatus('NOT_REGISTERED');
      setTeamData(null);
    } finally {
      setStatusLoading(false);
    }
  }, [event._id, sport._id]);

  useEffect(() => {
    loadBackendStatus();
  }, [loadBackendStatus]);

  // Load joinable teams when in NOT_REGISTERED and activeTab === 'join'
  useEffect(() => {
    if (athleteStatus === 'NOT_REGISTERED' && activeTab === 'join') {
      setLoadingTeams(true);
      api.get(`/organizer-events/${event._id}/sports/${sport._id}/teams`)
        .then(({ data }) => setExistingTeams(data.teams || []))
        .catch(() => setExistingTeams([]))
        .finally(() => setLoadingTeams(false));
    }
  }, [athleteStatus, activeTab, event._id, sport._id]);

  const searchAthletes = async (query, target) => {
    if (query.trim().length < 2) {
      if (target === 'captain') setCaptainSearchResults([]);
      else if (target === 'member') setMemberSearchResults([]);
      else if (target === 'existing_add') setAddRegisteredResults([]);
      return;
    }
    try {
      const { data } = await api.get(`/organizer-events/athletes/search?q=${encodeURIComponent(query)}`);
      if (target === 'captain') setCaptainSearchResults(data.athletes || []);
      else if (target === 'member') setMemberSearchResults(data.athletes || []);
      else if (target === 'existing_add') setAddRegisteredResults(data.athletes || []);
    } catch {
      // Ignore
    }
  };

  // CREATE TEAM FLOW
  const handleAddCreateManualPlayer = (e) => {
    e.preventDefault();
    setCreateManualError('');
    const name = createManualName.trim();
    const cleanMobile = createManualMobile.replace(/\D/g, '');
    const email = createManualEmail.trim().toLowerCase();

    if (!name) {
      setCreateManualError('Player name is required.');
      return;
    }
    if (!cleanMobile || cleanMobile.length < 10 || cleanMobile.length > 13) {
      setCreateManualError('Valid 10-digit mobile number is required.');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCreateManualError('Invalid email format.');
      return;
    }
    if (createManualPlayers.some(p => p.mobile.replace(/\D/g, '') === cleanMobile)) {
      setCreateManualError('A player with this mobile number is already added.');
      return;
    }
    const totalSize = 1 + (captainType === 'other' && selectedCaptain ? 1 : 0) + members.length + createManualPlayers.length + 1;
    if (totalSize > sport.maximumTeamSize) {
      setCreateManualError(`Team has reached maximum team size of ${sport.maximumTeamSize}.`);
      return;
    }

    setCreateManualPlayers([...createManualPlayers, { name, mobile: createManualMobile.trim(), email }]);
    setCreateManualName('');
    setCreateManualMobile('');
    setCreateManualEmail('');
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setStatusError('');
    if (!teamName.trim()) {
      setStatusError('Please enter a team name.');
      return;
    }
    const captainId = captainType === 'myself' ? undefined : selectedCaptain?._id;
    if (captainType === 'other' && !captainId) {
      setStatusError('Please search and select a team captain.');
      return;
    }
    const totalSize = 1 + (captainType === 'other' && selectedCaptain ? 1 : 0) + members.length + createManualPlayers.length;
    if (totalSize > sport.maximumTeamSize) {
      setStatusError(`Team size exceeds maximum of ${sport.maximumTeamSize}.`);
      return;
    }

    setActionLoading(true);
    try {
      const memberIds = members.map(m => m._id);
      await api.post(`/organizer-events/${event._id}/sports/${sport._id}/teams`, {
        name: teamName.trim(),
        captainId,
        memberIds,
        manualPlayers: createManualPlayers
      });
      await loadBackendStatus();
      onSuccess?.(`Team "${teamName.trim()}" created successfully!`);
    } catch (err) {
      setStatusError(err.response?.data?.error || 'Failed to create team.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinRequest = async (teamId) => {
    setStatusError('');
    setActionLoading(true);
    try {
      await api.post(`/organizer-events/teams/${teamId}/join-requests`);
      await loadBackendStatus();
      onSuccess?.('Join request sent to the team captain!');
    } catch (err) {
      setStatusError(err.response?.data?.error || 'Failed to send join request.');
    } finally {
      setActionLoading(false);
    }
  };

  // EXISTING TEAM MANAGEMENT FLOW (Captain)
  const handleAddRegisteredToExisting = async (athlete) => {
    setMemberActionError('');
    setActionLoading(true);
    try {
      const { data } = await api.post(`/organizer-events/teams/${teamData._id}/members`, {
        type: 'registered',
        athleteId: athlete._id
      });
      setTeamData(data.team);
      setAddRegisteredQuery('');
      setAddRegisteredResults([]);
      setActionSuccess(`Added athlete "${athlete.name}" to team!`);
      setTimeout(() => setActionSuccess(''), 3000);
      onSuccess?.(`Added athlete "${athlete.name}" to team!`);
    } catch (err) {
      setMemberActionError(err.response?.data?.error || 'Failed to add athlete.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddManualToExisting = async (e) => {
    e.preventDefault();
    setMemberActionError('');
    const name = manualName.trim();
    const cleanMobile = manualMobile.replace(/\D/g, '');
    const email = manualEmail.trim().toLowerCase();

    if (!name) {
      setMemberActionError('Player name is required.');
      return;
    }
    if (!cleanMobile || cleanMobile.length < 10 || cleanMobile.length > 13) {
      setMemberActionError('Valid 10-digit mobile number is required.');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMemberActionError('Invalid email address.');
      return;
    }

    setActionLoading(true);
    try {
      const { data } = await api.post(`/organizer-events/teams/${teamData._id}/members`, {
        type: 'manual',
        manualPlayer: { name, mobile: manualMobile.trim(), email }
      });
      setTeamData(data.team);
      setManualName('');
      setManualMobile('');
      setManualEmail('');
      setActionSuccess(`Added player "${name}" to team!`);
      setTimeout(() => setActionSuccess(''), 3000);
      onSuccess?.(`Added player "${name}" to team!`);
    } catch (err) {
      setMemberActionError(err.response?.data?.error || 'Failed to add manual player.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (type, identifier) => {
    setMemberActionError('');
    setActionLoading(true);
    try {
      const payload = type === 'registered' ? { type: 'registered', athleteId: identifier } : { type: 'manual', manualIndex: identifier };
      const { data } = await api.delete(`/organizer-events/teams/${teamData._id}/members`, { data: payload });
      setTeamData(data.team);
      setActionSuccess('Member removed.');
      setTimeout(() => setActionSuccess(''), 3000);
      onSuccess?.('Member removed from team.');
    } catch (err) {
      setMemberActionError(err.response?.data?.error || 'Failed to remove member.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelJoinRequest = async () => {
    setStatusError('');
    setActionLoading(true);
    try {
      await api.post(`/organizer-events/teams/${teamData._id}/join-requests/cancel`);
      await loadBackendStatus();
      onSuccess?.('Pending join request cancelled.');
    } catch (err) {
      setStatusError(err.response?.data?.error || 'Failed to cancel join request.');
    } finally {
      setActionLoading(false);
    }
  };

  const totalCreateSize = 1 + (captainType === 'other' && selectedCaptain ? 1 : 0) + members.length + createManualPlayers.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-[#d8ded5]">
        {/* MODAL HEADER */}
        <div className="p-4 bg-[#173235] text-white flex justify-between items-center">
          <div>
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-[#cc694e]" /> Team Registration — {event.eventName}
            </h3>
            <p className="text-xs text-[#d8ded5] mt-0.5">
              Sport: <strong className="uppercase">[{sport.sportName.toUpperCase()}]</strong> · Size: {sport.minimumTeamSize}–{sport.maximumTeamSize} athletes
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* LOADING STATE */}
        {statusLoading ? (
          <div className="p-10 text-center text-xs text-[#526668] space-y-2">
            <div className="w-6 h-6 border-2 border-[#194e42] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-bold">Checking team registration status from database…</p>
          </div>
        ) : (
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            {statusError && (
              <div className="p-3 bg-[#fdf2f2] border border-[#f8b4b4] rounded-lg text-xs text-[#9b1c1c] font-bold">
                {statusError}
              </div>
            )}
            {actionSuccess && (
              <div className="p-3 bg-[#e2eee4] border border-[#2f6d5a] rounded-lg text-xs text-[#194e42] font-bold">
                ✓ {actionSuccess}
              </div>
            )}

            {/* 1. ATHLETE IS TEAM CAPTAIN */}
            {athleteStatus === 'TEAM_CAPTAIN' && teamData && (
              <div className="space-y-4">
                <div className="p-4 bg-[#f8faf7] border border-[#2f6d5a] rounded-xl space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#194e42] text-white uppercase">
                        Your Team (Captain)
                      </span>
                      <h4 className="font-extrabold text-base text-[#173235] mt-1">{teamData.name}</h4>
                      <p className="text-xs text-[#526668]">
                        Captain: <strong>{teamData.captain?.name}</strong> (You)
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-extrabold text-[#194e42]">
                        {teamData.confirmedSize} / {sport.maximumTeamSize} Members
                      </div>
                      <div className="text-[10px] text-[#526668]">
                        Min: {sport.minimumTeamSize} · Max: {sport.maximumTeamSize}
                      </div>
                      <div className="mt-1">
                        {teamData.confirmedSize < sport.minimumTeamSize ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#fff8ea] text-[#9a6c00] border border-[#e0c068]">
                            STATUS: INCOMPLETE
                          </span>
                        ) : teamData.confirmedSize >= sport.maximumTeamSize ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
                            STATUS: FULL
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
                            STATUS: READY / CONFIRMED
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ROSTER LIST */}
                  <div className="border-t border-[#d8ded5] pt-3 space-y-2">
                    <div className="text-xs font-extrabold text-[#173235] uppercase tracking-wider">
                      Current Team Roster:
                    </div>

                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {/* Captain */}
                      <div className="p-2 bg-white rounded-lg border border-[#d8ded5] flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#173235]">1. {teamData.captain?.name}</span>
                          <span className="text-[9px] bg-[#194e42] text-white px-1.5 py-0.5 rounded font-extrabold">CAPTAIN</span>
                        </div>
                        <span className="text-[10px] text-[#526668]">TrackAthlete Athlete</span>
                      </div>

                      {/* Other registered athletes */}
                      {teamData.members?.filter(m => String(m.athlete?._id || m.athlete) !== String(teamData.captain?._id || teamData.captain)).map((m, i) => (
                        <div key={m.athlete?._id || i} className="p-2 bg-white rounded-lg border border-[#d8ded5] flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#173235]">{i + 2}. {m.athlete?.name || 'Athlete'}</span>
                            <span className="text-[9px] bg-[#2f6d5a] text-white px-1.5 py-0.5 rounded font-extrabold">REGISTERED</span>
                            {m.athlete?.athleteId && <span className="text-[10px] text-[#526668]">({m.athlete.athleteId})</span>}
                          </div>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleRemoveMember('registered', m.athlete?._id)}
                            className="text-[#9b1c1c] text-[10px] font-bold hover:underline cursor-pointer disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      ))}

                      {/* Manual External Players */}
                      {teamData.manualPlayers?.map((p, idx) => (
                        <div key={`man-${idx}`} className="p-2 bg-[#fffdf8] rounded-lg border border-[#e0c068] flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#9a6c00]">{teamData.members?.length + idx + 1}. {p.name}</span>
                            <span className="text-[9px] bg-[#d97706] text-white px-1.5 py-0.5 rounded font-extrabold">EXTERNAL</span>
                            <span className="text-[10px] text-[#526668]">· {p.mobile}</span>
                          </div>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleRemoveMember('manual', idx)}
                            className="text-[#9b1c1c] text-[10px] font-bold hover:underline cursor-pointer disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 text-xs">
                      {teamData.confirmedSize < sport.minimumTeamSize ? (
                        <span className="text-[#9a6c00] font-bold">
                          ⚠️ Incomplete: {sport.minimumTeamSize - teamData.confirmedSize} more player(s) required to reach minimum team size of {sport.minimumTeamSize}.
                        </span>
                      ) : teamData.confirmedSize >= sport.maximumTeamSize ? (
                        <span className="text-[#194e42] font-bold">
                          ✓ Full: Maximum team size of {sport.maximumTeamSize} reached.
                        </span>
                      ) : (
                        <span className="text-[#194e42] font-bold">
                          ✓ Valid: Minimum team size satisfied. {sport.maximumTeamSize - teamData.confirmedSize} slot(s) available.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ADD TEAM MEMBER (If not full) */}
                {teamData.confirmedSize < sport.maximumTeamSize ? (
                  <div className="border border-[#d8ded5] rounded-xl p-4 bg-white space-y-3">
                    <div className="flex justify-between items-center">
                      <h5 className="font-extrabold text-xs uppercase text-[#173235]">Add Team Member</h5>
                      <span className="text-[10px] text-[#526668]">Slots remaining: {sport.maximumTeamSize - teamData.confirmedSize}</span>
                    </div>

                    {memberActionError && (
                      <div className="p-2 bg-[#fdf2f2] border border-[#f8b4b4] rounded text-xs text-[#9b1c1c] font-bold">
                        {memberActionError}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setAddMemberMode('registered'); setMemberActionError(''); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                          addMemberMode === 'registered' ? 'bg-[#194e42] text-white' : 'bg-white border border-[#d2dad2] text-[#173235]'
                        }`}
                      >
                        ADD REGISTERED ATHLETE
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAddMemberMode('manual'); setMemberActionError(''); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                          addMemberMode === 'manual' ? 'bg-[#194e42] text-white' : 'bg-white border border-[#d2dad2] text-[#173235]'
                        }`}
                      >
                        ADD PLAYER MANUALLY
                      </button>
                    </div>

                    {addMemberMode === 'registered' ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search athlete by Name, Athlete ID, or Email…"
                            value={addRegisteredQuery}
                            onChange={(e) => {
                              setAddRegisteredQuery(e.target.value);
                              searchAthletes(e.target.value, 'existing_add');
                            }}
                            className="w-full border border-[#d8ded5] rounded-lg p-2 text-xs text-[#173235]"
                          />
                          <Search className="w-3.5 h-3.5 text-[#526668] absolute right-2.5 top-3" />
                        </div>
                        {addRegisteredResults.length > 0 && (
                          <div className="border border-[#d8ded5] rounded-lg max-h-36 overflow-y-auto bg-white shadow-xs">
                            {addRegisteredResults.map(a => (
                              <div
                                key={a._id}
                                className="p-2 hover:bg-[#e2eee4] text-xs flex justify-between items-center border-b last:border-0"
                              >
                                <div>
                                  <strong className="text-[#173235]">{a.name}</strong> ({a.athleteId})
                                  <span className="text-[#526668] ml-2 text-[10px]">{a.sport}</span>
                                </div>
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() => handleAddRegisteredToExisting(a)}
                                  className="px-2 py-0.5 bg-[#194e42] text-white rounded text-[10px] font-bold hover:bg-[#123930] cursor-pointer disabled:opacity-50"
                                >
                                  + Add to Team
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <form onSubmit={handleAddManualToExisting} className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-[#526668] mb-0.5">Player Name *</label>
                            <input
                              required
                              type="text"
                              placeholder="e.g. Rahul Kumar"
                              value={manualName}
                              onChange={e => setManualName(e.target.value)}
                              className="w-full border border-[#d8ded5] rounded-lg p-1.5 text-xs text-[#173235]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-[#526668] mb-0.5">Mobile Number *</label>
                            <input
                              required
                              type="text"
                              placeholder="e.g. 9876543210"
                              value={manualMobile}
                              onChange={e => setManualMobile(e.target.value)}
                              className="w-full border border-[#d8ded5] rounded-lg p-1.5 text-xs text-[#173235]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-[#526668] mb-0.5">Email (Optional)</label>
                            <input
                              type="email"
                              placeholder="e.g. rahul@example.com"
                              value={manualEmail}
                              onChange={e => setManualEmail(e.target.value)}
                              className="w-full border border-[#d8ded5] rounded-lg p-1.5 text-xs text-[#173235]"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end pt-1">
                          <button
                            type="submit"
                            disabled={actionLoading}
                            className="px-3 py-1.5 rounded-lg bg-[#194e42] text-white text-xs font-bold cursor-pointer hover:bg-[#123930] disabled:opacity-50"
                          >
                            {actionLoading ? 'Adding…' : '+ Add Player'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-[#f4f8f5] border border-[#2f6d5a] rounded-xl text-center text-xs text-[#194e42] font-bold">
                    ✓ Maximum team size reached ({sport.maximumTeamSize} athletes). Your roster is complete.
                  </div>
                )}
              </div>
            )}

            {/* 2. ATHLETE IS CONFIRMED TEAM MEMBER (Not Captain) */}
            {athleteStatus === 'TEAM_MEMBER' && teamData && (
              <div className="space-y-4">
                <div className="p-4 bg-[#f8faf7] border border-[#2f6d5a] rounded-xl space-y-3">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#194e42] text-white uppercase">
                    Already Registered (Team Member)
                  </span>
                  <h4 className="font-extrabold text-base text-[#173235] mt-1">{teamData.name}</h4>
                  <p className="text-xs text-[#526668]">
                    Captain: <strong>{teamData.captain?.name}</strong>
                  </p>
                  <div className="flex justify-between items-center pt-2 border-t border-[#d8ded5] text-xs">
                    <div>Members: <strong>{teamData.confirmedSize} / {sport.maximumTeamSize}</strong></div>
                    <div>Status: <strong className="text-[#194e42]">CONFIRMED</strong></div>
                  </div>

                  {/* ROSTER LIST */}
                  <div className="border-t border-[#d8ded5] pt-3 space-y-2">
                    <div className="text-xs font-extrabold text-[#173235] uppercase tracking-wider">
                      Current Team Roster:
                    </div>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      <div className="p-2 bg-white rounded-lg border border-[#d8ded5] flex justify-between items-center text-xs">
                        <span className="font-bold text-[#173235]">1. {teamData.captain?.name}</span>
                        <span className="text-[9px] bg-[#194e42] text-white px-1.5 py-0.5 rounded font-extrabold">CAPTAIN</span>
                      </div>
                      {teamData.members?.filter(m => String(m.athlete?._id || m.athlete) !== String(teamData.captain?._id || teamData.captain)).map((m, i) => (
                        <div key={m.athlete?._id || i} className="p-2 bg-white rounded-lg border border-[#d8ded5] flex justify-between items-center text-xs">
                          <span className="font-bold text-[#173235]">{i + 2}. {m.athlete?.name || 'Athlete'}</span>
                          <span className="text-[9px] bg-[#2f6d5a] text-white px-1.5 py-0.5 rounded font-extrabold">REGISTERED</span>
                        </div>
                      ))}
                      {teamData.manualPlayers?.map((p, idx) => (
                        <div key={`man-${idx}`} className="p-2 bg-[#fffdf8] rounded-lg border border-[#e0c068] flex justify-between items-center text-xs">
                          <span className="font-bold text-[#9a6c00]">{teamData.members?.length + idx + 1}. {p.name}</span>
                          <span className="text-[9px] bg-[#d97706] text-white px-1.5 py-0.5 rounded font-extrabold">EXTERNAL</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#f4f8f5] border border-[#d2dad2] rounded-xl text-xs text-[#526668]">
                  ℹ️ You are a confirmed member of <strong>{teamData.name}</strong>. Team roster additions and modifications are managed exclusively by team captain <strong>{teamData.captain?.name}</strong>.
                </div>
              </div>
            )}

            {/* 3. JOIN REQUEST PENDING */}
            {athleteStatus === 'JOIN_REQUEST_PENDING' && teamData && (
              <div className="space-y-4">
                <div className="p-4 bg-[#fff8ea] border border-[#e0c068] rounded-xl space-y-3">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#d97706] text-white uppercase">
                    Join Request Pending
                  </span>
                  <h4 className="font-extrabold text-base text-[#173235] mt-1">{teamData.name}</h4>
                  <p className="text-xs text-[#526668]">
                    Captain: <strong>{teamData.captain?.name}</strong>
                  </p>
                  <div className="text-xs text-[#9a6c00] font-bold">
                    Status: PENDING CAPTAIN REVIEW
                  </div>
                  <p className="text-xs text-[#526668]">
                    Your request to join this team has been submitted and is awaiting the team captain's approval. You cannot submit additional join requests for this event sport while one is pending.
                  </p>
                  <div className="pt-2 border-t border-[#e0c068] flex justify-end">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleCancelJoinRequest}
                      className="px-3 py-1.5 rounded-lg border border-[#e07050] text-[#e07050] text-xs font-bold hover:bg-[#fff0ed] cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading ? 'Cancelling…' : 'Cancel Request'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 4. TEAM TERMINATED */}
            {athleteStatus === 'TERMINATED' && (
              <div className="space-y-4">
                <div className="p-4 bg-[#fdf2f2] border border-[#f8b4b4] rounded-xl space-y-3">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#9b1c1c] text-white uppercase">
                    Team Terminated
                  </span>
                  <h4 className="font-extrabold text-base text-[#173235] mt-1">
                    {teamData?.name || 'Your Team'}
                  </h4>
                  <p className="text-xs text-[#9b1c1c] font-bold">
                    {teamData?.terminationReason || 'This team was terminated because the minimum team size was not reached by the team formation deadline.'}
                  </p>
                  {event.registrationDeadline && new Date() <= new Date(event.registrationDeadline) ? (
                    <div className="pt-2 border-t border-[#f8b4b4] flex justify-end">
                      <button
                        type="button"
                        onClick={() => { setAthleteStatus('NOT_REGISTERED'); setTeamData(null); }}
                        className="px-3 py-1.5 rounded-lg bg-[#194e42] text-white text-xs font-bold hover:bg-[#123930] cursor-pointer"
                      >
                        Register for Another Team
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-[#526668]">
                      Registration deadline has passed. New registrations are closed.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. NOT REGISTERED (CREATE NEW TEAM / JOIN EXISTING TEAM) */}
            {athleteStatus === 'NOT_REGISTERED' && (
              <div className="space-y-4">
                <div className="flex border-b border-[#e2eee4] bg-[#f8faf7] p-2 gap-2 rounded-xl">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('create'); setStatusError(''); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
                      activeTab === 'create' ? 'bg-[#194e42] text-white shadow-xs' : 'text-[#194e42] bg-white border border-[#d2dad2]'
                    }`}
                  >
                    CREATE NEW TEAM
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('join'); setStatusError(''); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
                      activeTab === 'join' ? 'bg-[#194e42] text-white shadow-xs' : 'text-[#194e42] bg-white border border-[#d2dad2]'
                    }`}
                  >
                    JOIN EXISTING TEAM
                  </button>
                </div>

                {activeTab === 'create' && (
                  <form onSubmit={handleCreateTeam} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-[#173235] mb-1">Team Name *</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Thunder Strikers"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        className="w-full border border-[#d8ded5] rounded-lg p-2.5 text-xs text-[#173235] focus:outline-none focus:border-[#194e42]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#173235] mb-1">Team Captain *</label>
                      <div className="flex gap-4 mb-2">
                        <label className="flex items-center gap-1.5 text-xs text-[#173235] cursor-pointer">
                          <input
                            type="radio"
                            name="captainType"
                            checked={captainType === 'myself'}
                            onChange={() => { setCaptainType('myself'); setSelectedCaptain(null); }}
                          />
                          <span>Myself</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-[#173235] cursor-pointer">
                          <input
                            type="radio"
                            name="captainType"
                            checked={captainType === 'other'}
                            onChange={() => setCaptainType('other')}
                          />
                          <span>Another Registered Athlete</span>
                        </label>
                      </div>

                      {captainType === 'other' && (
                        <div className="space-y-2">
                          {selectedCaptain ? (
                            <div className="p-2 bg-[#e2eee4] rounded-lg border border-[#2f6d5a] flex justify-between items-center text-xs">
                              <div>
                                <strong className="text-[#194e42]">{selectedCaptain.name}</strong> ({selectedCaptain.athleteId})
                                <div className="text-[10px] text-[#526668]">{selectedCaptain.email}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedCaptain(null)}
                                className="text-[#cc694e] font-bold cursor-pointer hover:underline text-[11px]"
                              >
                                Change
                              </button>
                            </div>
                          ) : (
                            <div>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Search athlete by Name, Athlete ID, or Email…"
                                  value={captainSearchQuery}
                                  onChange={(e) => {
                                    setCaptainSearchQuery(e.target.value);
                                    searchAthletes(e.target.value, 'captain');
                                  }}
                                  className="w-full border border-[#d8ded5] rounded-lg p-2 text-xs text-[#173235]"
                                />
                                <Search className="w-3.5 h-3.5 text-[#526668] absolute right-2.5 top-3" />
                              </div>
                              {captainSearchResults.length > 0 && (
                                <div className="border border-[#d8ded5] rounded-lg mt-1 max-h-36 overflow-y-auto bg-white shadow-xs">
                                  {captainSearchResults.map(a => (
                                    <div
                                      key={a._id}
                                      onClick={() => { setSelectedCaptain(a); setCaptainSearchResults([]); }}
                                      className="p-2 hover:bg-[#e2eee4] cursor-pointer text-xs flex justify-between border-b last:border-0"
                                    >
                                      <span><strong>{a.name}</strong> ({a.athleteId})</span>
                                      <span className="text-[#526668]">{a.sport}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Team Members Section */}
                    <div className="border-t border-[#e2eee4] pt-3">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-[#173235]">Add Team Members</label>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[#f4f8f5] text-[#194e42] border border-[#d2dad2]">
                          Total: {totalCreateSize} / {sport.maximumTeamSize} athletes (Min: {sport.minimumTeamSize})
                        </span>
                      </div>

                      <div className="flex gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => { setCreateAddMode('registered'); setCreateManualError(''); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                            createAddMode === 'registered' ? 'bg-[#194e42] text-white' : 'bg-white border border-[#d2dad2] text-[#173235]'
                          }`}
                        >
                          ADD REGISTERED ATHLETE
                        </button>
                        <button
                          type="button"
                          onClick={() => { setCreateAddMode('manual'); setCreateManualError(''); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                            createAddMode === 'manual' ? 'bg-[#194e42] text-white' : 'bg-white border border-[#d2dad2] text-[#173235]'
                          }`}
                        >
                          ADD PLAYER MANUALLY
                        </button>
                      </div>

                      {createAddMode === 'registered' ? (
                        <div className="space-y-2">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Search and add registered athletes…"
                              value={memberSearchQuery}
                              onChange={(e) => {
                                setMemberSearchQuery(e.target.value);
                                searchAthletes(e.target.value, 'member');
                              }}
                              className="w-full border border-[#d8ded5] rounded-lg p-2 text-xs text-[#173235]"
                            />
                            <UserPlus className="w-3.5 h-3.5 text-[#526668] absolute right-2.5 top-3" />
                          </div>
                          {memberSearchResults.length > 0 && (
                            <div className="border border-[#d8ded5] rounded-lg mt-1 max-h-36 overflow-y-auto bg-white shadow-xs">
                              {memberSearchResults.map(a => (
                                <div
                                  key={a._id}
                                  onClick={() => {
                                    if (totalCreateSize >= sport.maximumTeamSize) {
                                      setStatusError(`Team exceeds maximum size of ${sport.maximumTeamSize}.`);
                                      return;
                                    }
                                    if (!members.some(m => m._id === a._id)) {
                                      setMembers([...members, a]);
                                    }
                                    setMemberSearchResults([]);
                                    setMemberSearchQuery('');
                                  }}
                                  className="p-2 hover:bg-[#e2eee4] cursor-pointer text-xs flex justify-between border-b last:border-0"
                                >
                                  <span><strong>{a.name}</strong> ({a.athleteId})</span>
                                  <span className="text-[#194e42] font-bold">+ Add</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 bg-[#f9faf8] border border-[#d8ded5] rounded-xl space-y-2">
                          {createManualError && (
                            <div className="text-[11px] text-red-600 font-bold">{createManualError}</div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-[#526668] mb-0.5">Player Name *</label>
                              <input
                                type="text"
                                placeholder="e.g. Rahul Kumar"
                                value={createManualName}
                                onChange={e => setCreateManualName(e.target.value)}
                                className="w-full border border-[#d8ded5] rounded-lg p-1.5 text-xs text-[#173235]"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-[#526668] mb-0.5">Mobile Number *</label>
                              <input
                                type="text"
                                placeholder="e.g. 9876543210"
                                value={createManualMobile}
                                onChange={e => setCreateManualMobile(e.target.value)}
                                className="w-full border border-[#d8ded5] rounded-lg p-1.5 text-xs text-[#173235]"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-[#526668] mb-0.5">Email (Optional)</label>
                              <input
                                type="email"
                                placeholder="e.g. rahul@example.com"
                                value={createManualEmail}
                                onChange={e => setCreateManualEmail(e.target.value)}
                                className="w-full border border-[#d8ded5] rounded-lg p-1.5 text-xs text-[#173235]"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={handleAddCreateManualPlayer}
                              className="px-3 py-1 rounded-lg bg-[#194e42] text-white text-xs font-bold cursor-pointer hover:bg-[#123930]"
                            >
                              + Add Manual Player
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Team Roster display */}
                      <div className="space-y-1.5 mt-3">
                        <div className="text-[11px] font-extrabold text-[#194e42] uppercase tracking-wider">
                          Current Team Roster:
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="px-2.5 py-1 bg-[#f4f8f5] border border-[#2f6d5a] rounded-lg text-xs font-bold text-[#194e42]">
                            You (Team Creator {captainType === 'myself' ? '& Captain' : ''})
                          </span>

                          {captainType === 'other' && selectedCaptain && (
                            <span className="px-2.5 py-1 bg-[#e2eee4] border border-[#2f6d5a] rounded-lg text-xs font-bold text-[#194e42] flex items-center gap-1">
                              Captain: {selectedCaptain.name} ({selectedCaptain.athleteId})
                            </span>
                          )}

                          {members.map(m => (
                            <span key={m._id} className="px-2 py-1 bg-[#e2eee4] border border-[#2f6d5a] rounded-lg text-xs font-bold text-[#194e42] flex items-center gap-1.5">
                              <span className="text-[9px] bg-[#194e42] text-white px-1.5 py-0.2 rounded font-extrabold">REGISTERED</span>
                              {m.name} ({m.athleteId})
                              <button
                                type="button"
                                onClick={() => setMembers(members.filter(x => x._id !== m._id))}
                                className="cursor-pointer hover:text-red-600 ml-1 font-bold"
                              >
                                ✕
                              </button>
                            </span>
                          ))}

                          {createManualPlayers.map((p, idx) => (
                            <span key={`manual-${idx}`} className="px-2 py-1 bg-[#fff8ea] border border-[#e0c068] rounded-lg text-xs font-bold text-[#9a6c00] flex items-center gap-1.5">
                              <span className="text-[9px] bg-[#d97706] text-white px-1.5 py-0.2 rounded font-extrabold">EXTERNAL</span>
                              {p.name} · {p.mobile}
                              <button
                                type="button"
                                onClick={() => setCreateManualPlayers(createManualPlayers.filter((_, i) => i !== idx))}
                                className="cursor-pointer hover:text-red-600 ml-1 font-bold"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>

                        <div className="mt-2 text-xs">
                          {totalCreateSize < sport.minimumTeamSize ? (
                            <span className="text-[#9a6c00] font-bold">
                              ⚠️ Incomplete: {sport.minimumTeamSize - totalCreateSize} more player(s) required to reach minimum team size of {sport.minimumTeamSize}.
                            </span>
                          ) : totalCreateSize === sport.maximumTeamSize ? (
                            <span className="text-[#194e42] font-bold">
                              ✓ Full: Maximum team size of {sport.maximumTeamSize} reached.
                            </span>
                          ) : (
                            <span className="text-[#194e42] font-bold">
                              ✓ Valid: Minimum team size satisfied. {sport.maximumTeamSize - totalCreateSize} slot(s) available.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-[#d8ded5] text-xs font-bold text-[#526668] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="px-5 py-2 rounded-lg bg-[#e07050] text-white text-xs font-bold cursor-pointer hover:bg-[#c95d3e] disabled:opacity-50"
                      >
                        {actionLoading ? 'Creating Team…' : 'Create & Register Team'}
                      </button>
                    </div>
                  </form>
                )}

                {activeTab === 'join' && (
                  <div className="space-y-3">
                    {loadingTeams ? (
                      <div className="text-center py-6 text-xs text-[#697c7c]">Loading available teams…</div>
                    ) : existingTeams.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#697c7c] bg-[#f8faf7] rounded-xl border border-dashed border-[#d8ded5]">
                        No open teams available to join for this sport yet. You can create a new team using the "CREATE NEW TEAM" tab above!
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {existingTeams.map(t => (
                          <div
                            key={t._id}
                            className="p-3 rounded-xl border border-[#d8ded5] bg-white flex items-center justify-between gap-3 shadow-2xs"
                          >
                            <div>
                              <h5 className="font-extrabold text-sm text-[#173235]">{t.name}</h5>
                              <div className="text-xs text-[#526668] mt-0.5">
                                Captain: <strong>{t.captain?.name || 'Athlete'}</strong> ({t.captain?.athleteId})
                              </div>
                              <div className="text-[11px] text-[#194e42] font-bold mt-1">
                                Members: {t.confirmedSize || 0} / {sport.maximumTeamSize} athletes
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleJoinRequest(t._id)}
                              className="px-3 py-1.5 rounded-lg bg-[#194e42] text-white text-xs font-bold cursor-pointer hover:bg-[#173235] disabled:opacity-50"
                            >
                              Request to Join
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* MODAL FOOTER FOR EXISTING TEAM VIEWS */}
        {athleteStatus !== 'NOT_REGISTERED' && !statusLoading && (
          <div className="p-3 bg-[#f8faf7] border-t border-[#d8ded5] flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-[#173235] text-white font-bold text-xs cursor-pointer hover:bg-[#12282a]"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
