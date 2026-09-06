import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Award, Shield, MapPin, Lock, Eye, FileText, ChevronLeft, ChevronRight, Users, CheckCircle, AlertCircle, X, Search, UserPlus } from 'lucide-react';
import api from '../services/api';

const normalize = (val) => String(val || '').trim().toLowerCase();

export default function OfficialTournamentsSection({ athleteSport }) {
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [completedResults, setCompletedResults] = useState([]);
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

  const loadData = async () => {
    try {
      setLoading(true);
      const [upRes, compRes, orgCompRes] = await Promise.all([
        api.get('/tournaments/upcoming').catch(() => ({ data: [] })),
        api.get('/tournaments/completed').catch(() => ({ data: [] })),
        api.get('/organizer-events/completed').catch(() => ({ data: { results: [] } }))
      ]);
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

      const fedCompleted = (compRes.data || []).map(r => ({ ...r, source: 'federation' }));
      const orgCompleted = (orgCompRes.data?.results || []).flatMap(r => (r.entries || []).map(entry => ({
        ...entry,
        _id: `${r._id}-${entry._id || entry.name}`,
        resultId: r._id,
        tournamentName: r.event?.eventName || 'Organizer Event',
        eventDate: r.event?.eventDate,
        organizer: r.organizer,
        sportName: r.event?.sports?.find(s => String(s._id) === String(r.sportConfigId))?.sportName || 'Sport',
        source: 'organizer',
        isFrozen: r.isFrozen,
        frozenAt: r.frozenAt
      })));
      setCompletedResults([...fedCompleted, ...orgCompleted].sort((a, b) => new Date(b.createdAt || b.frozenAt || 0) - new Date(a.createdAt || a.frozenAt || 0)));
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

  const eligibleEvents = [];
  if (athleteSport) {
    upcomingEvents.forEach(evt => {
      if (evt.source === 'organizer' || evt.isOrganizerEvent) {
        const matches = (evt.sports || []).filter(s => normalize(s.sportName) === normalize(athleteSport));
        if (matches.length > 0) eligibleEvents.push({ ...evt, matchedSports: matches });
      } else {
        if (normalize(evt.sport) === normalize(athleteSport)) eligibleEvents.push(evt);
      }
    });
  }

  if (loading) {
    return (
      <div className="bg-[#fcfcf8] border border-[#d8ded5] rounded-2xl p-6 text-center text-xs text-[#697c7c]">
        Loading official federation tournaments…
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
          {athleteSport && (
            <div className="bg-[#f4f8f5] border border-[#2f6d5a]/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#cc694e]" />
                  <h4 className="font-extrabold text-[#173235] text-xs uppercase tracking-wider">
                    ELIGIBLE FOR YOU — MATCHING YOUR REGISTERED SPORT ({String(athleteSport).toUpperCase()})
                  </h4>
                </div>
                {eligibleEvents.length > 0 && (
                  <RailControls onPrevious={() => scrollRail(eligibleRail, -1)} onNext={() => scrollRail(eligibleRail, 1)} />
                )}
              </div>

              {eligibleEvents.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#697c7c] bg-white rounded-lg border border-dashed border-[#d8ded5]">
                  No upcoming tournaments currently matching your registered sport ({athleteSport}). View all tournaments below.
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
                                  {isTeam ? (
                                    <button
                                      type="button"
                                      disabled={isClosed}
                                      onClick={() => setTeamModal({ event: evt, sport })}
                                      className="px-3 py-1 rounded-md bg-[#194e42] text-white text-xs font-bold cursor-pointer disabled:opacity-50 hover:bg-[#173235]"
                                    >
                                      {isClosed ? 'Closed' : 'Register Team'}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={isClosed || busyRegister === `${evt._id}:${sport._id}`}
                                      onClick={() => handleIndividualRegister(evt, sport)}
                                      className="px-3 py-1 rounded-md bg-[#e07050] text-white text-xs font-bold cursor-pointer disabled:opacity-50 hover:bg-[#c95d3e]"
                                    >
                                      {isClosed ? 'Closed' : busyRegister === `${evt._id}:${sport._id}` ? 'Registering…' : 'Register'}
                                    </button>
                                  )}
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

                      {athleteSport && isOrg && evt.sports?.some(s => normalize(s.sportName) === normalize(athleteSport)) && (
                        <div className="pt-2 border-t border-[#e2eee4] space-y-1.5">
                          {evt.sports.filter(s => normalize(s.sportName) === normalize(athleteSport)).map(sport => {
                            const isTeam = sport.competitionType === 'team';
                            return (
                              <div key={sport._id} className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-[#194e42]">Eligible</span>
                                {isTeam ? (
                                  <button
                                    type="button"
                                    disabled={isClosed}
                                    onClick={() => setTeamModal({ event: evt, sport })}
                                    className="px-2.5 py-1 rounded bg-[#194e42] text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                                  >
                                    {isClosed ? 'Closed' : 'Team Register'}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isClosed || busyRegister === `${evt._id}:${sport._id}`}
                                    onClick={() => handleIndividualRegister(evt, sport)}
                                    className="px-2.5 py-1 rounded bg-[#e07050] text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                                  >
                                    {isClosed ? 'Closed' : busyRegister === `${evt._id}:${sport._id}` ? 'Registering…' : 'Register'}
                                  </button>
                                )}
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
                          {isOrg ? 'Organizer Verified' : resItem.officialRecordId}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-[#173235] text-sm mt-2">
                        {isOrg
                          ? `${resItem.outcome || 'Awarded'} — ${resItem.tournamentName}`
                          : (resItem.achievementType === 'medal' ? `${resItem.medal} Medal` : `Rank #${resItem.rank}`) + ` — ${resItem.tournamentName}`}
                      </h4>

                      <p className="text-xs font-bold text-[#194e42] mt-0.5">
                        Winner: <strong>{isOrg ? (resItem.name || 'Participant') : resItem.athleteName}</strong>
                      </p>

                      <p className="text-[11px] text-[#526668]">
                        {isOrg
                          ? (resItem.organizer?.organizationName || resItem.organizer?.name || 'Verified Organizer')
                          : (resItem.federation?.name || 'Recognized Federation')}
                      </p>

                      <div className="mt-2.5">
                        <span className="px-2 py-0.5 rounded border border-[#2f6d5a] bg-[#e2eee4] text-[10px] font-extrabold text-[#194e42] uppercase">
                          [{isOrg ? resItem.sportName?.toUpperCase() : resItem.sport?.toUpperCase()}]
                        </span>
                      </div>

                      <div className="space-y-1 mt-2 text-xs text-[#526668]">
                        <div>
                          Tournament Date:{' '}
                          {isOrg
                            ? (resItem.eventDate ? new Date(resItem.eventDate).toLocaleDateString('en-IN') : '—')
                            : (resItem.event?.tournamentDate ? new Date(resItem.event.tournamentDate).toLocaleDateString('en-IN') : new Date(resItem.eventDate).toLocaleDateString('en-IN'))}
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

function TeamRegistrationModal({ event, sport, onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('create');
  const [teamName, setTeamName] = useState('');
  const [captainType, setCaptainType] = useState('myself');
  const [selectedCaptain, setSelectedCaptain] = useState(null);
  const [captainSearchQuery, setCaptainSearchQuery] = useState('');
  const [captainSearchResults, setCaptainSearchResults] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState([]);
  const [existingTeams, setExistingTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (activeTab === 'join') {
      setLoadingTeams(true);
      api.get(`/organizer-events/${event._id}/sports/${sport._id}/teams`)
        .then(({ data }) => setExistingTeams(data.teams || []))
        .catch(() => setExistingTeams([]))
        .finally(() => setLoadingTeams(false));
    }
  }, [activeTab, event._id, sport._id]);

  const searchAthletes = async (query, target) => {
    if (query.trim().length < 2) {
      if (target === 'captain') setCaptainSearchResults([]);
      else setMemberSearchResults([]);
      return;
    }
    try {
      const { data } = await api.get(`/organizer-events/athletes/search?q=${encodeURIComponent(query)}`);
      if (target === 'captain') setCaptainSearchResults(data.athletes || []);
      else setMemberSearchResults(data.athletes || []);
    } catch {
      // Ignore
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setError('');
    if (!teamName.trim()) {
      setError('Please enter a team name.');
      return;
    }
    setSubmitting(true);
    try {
      const memberIds = members.map(m => m._id);
      const captainId = captainType === 'myself' ? undefined : selectedCaptain?._id;
      if (captainType === 'other' && !captainId) {
        setError('Please search and select a team captain.');
        setSubmitting(false);
        return;
      }
      await api.post(`/organizer-events/${event._id}/sports/${sport._id}/teams`, {
        name: teamName.trim(),
        captainId,
        memberIds
      });
      onSuccess(`Team "${teamName.trim()}" created successfully!`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create team.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinRequest = async (teamId) => {
    setError('');
    setSubmitting(true);
    try {
      await api.post(`/organizer-events/teams/${teamId}/join-requests`);
      onSuccess('Join request sent to the team captain!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send join request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-[#d8ded5]">
        <div className="p-4 bg-[#173235] text-white flex justify-between items-center">
          <div>
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-[#cc694e]" /> Team Registration — {event.eventName}
            </h3>
            <p className="text-xs text-[#d8ded5] mt-0.5">
              Sport: <strong className="uppercase">[{sport.sportName.toUpperCase()}]</strong> · Team Size: {sport.minimumTeamSize}–{sport.maximumTeamSize} athletes
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-[#e2eee4] bg-[#f8faf7] p-2 gap-2">
          <button
            type="button"
            onClick={() => { setActiveTab('create'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
              activeTab === 'create' ? 'bg-[#194e42] text-white shadow-xs' : 'text-[#194e42] bg-white border border-[#d2dad2]'
            }`}
          >
            CREATE NEW TEAM
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('join'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
              activeTab === 'join' ? 'bg-[#194e42] text-white shadow-xs' : 'text-[#194e42] bg-white border border-[#d2dad2]'
            }`}
          >
            JOIN EXISTING TEAM
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-[#fdf2f2] border border-[#f8b4b4] rounded-lg text-xs text-[#9b1c1c] font-bold">
              {error}
            </div>
          )}

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

              <div>
                <label className="block text-xs font-bold text-[#173235] mb-1">
                  Add Team Members (Optional — max {sport.maximumTeamSize})
                </label>
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

                  {members.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {members.map(m => (
                        <span key={m._id} className="px-2 py-1 bg-[#e2eee4] border border-[#2f6d5a] rounded-md text-xs font-bold text-[#194e42] flex items-center gap-1">
                          {m.name}
                          <button
                            type="button"
                            onClick={() => setMembers(members.filter(x => x._id !== m._id))}
                            className="cursor-pointer hover:text-red-600 ml-1"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
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
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-[#e07050] text-white text-xs font-bold cursor-pointer hover:bg-[#c95d3e] disabled:opacity-50"
                >
                  {submitting ? 'Creating Team…' : 'Create & Register Team'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'join' && (
            <div className="space-y-3">
              {loadingTeams ? (
                <div className="text-center py-6 text-xs text-[#697c7c]">Loading existing teams…</div>
              ) : existingTeams.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#697c7c] bg-[#f8faf7] rounded-xl border border-dashed border-[#d8ded5]">
                  No teams currently registered for this event sport yet. You can create a new team using the tab above!
                </div>
              ) : (
                <div className="space-y-2">
                  {existingTeams.map(t => {
                    const isFull = t.confirmedSize >= sport.maximumTeamSize;
                    return (
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
                            Members: {t.confirmedSize || 0} / {sport.maximumTeamSize} athletes {isFull && '(Team Full)'}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isFull || submitting}
                          onClick={() => handleJoinRequest(t._id)}
                          className="px-3 py-1.5 rounded-lg bg-[#194e42] text-white text-xs font-bold cursor-pointer disabled:opacity-40 hover:bg-[#173235]"
                        >
                          {isFull ? 'Full' : 'Request to Join'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
