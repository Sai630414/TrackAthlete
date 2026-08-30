import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Award, Shield, MapPin, Lock, Eye, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';

export default function OfficialTournamentsSection() {
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [completedResults, setCompletedResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [viewPdfModal, setViewPdfModal] = useState(null);
  const upcomingRail = useRef(null);
  const completedRail = useRef(null);

  const scrollRail = (rail, direction) => {
    rail.current?.scrollBy({ left: direction * 320, behavior: 'smooth' });
  };

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [upRes, compRes] = await Promise.all([
          api.get('/tournaments/upcoming').catch(() => ({ data: [] })),
          api.get('/tournaments/completed').catch(() => ({ data: [] }))
        ]);
        setUpcomingEvents(upRes.data || []);
        setCompletedResults(compRes.data || []);
      } catch (err) {
        console.error('Error fetching tournaments:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#fcfcf8] border border-[#d8ded5] rounded-2xl p-6 text-center text-xs text-[#697c7c]">
        Loading official federation tournaments…
      </div>
    );
  }

  return (
    <div className="bg-[#fcfcf8] border border-[#d8ded5] rounded-2xl p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2eee4] pb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#194e42]" />
          <div>
            <h3 className="font-extrabold text-[#173235] text-base" style={{ fontFamily: 'Georgia, serif' }}>
              Official Federation Tournaments &amp; Results Ledger
            </h3>
            <p className="text-xs text-[#526668]">
              Dynamic MongoDB-backed official events from recognized national sports federations
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
            Upcoming Tournaments ({upcomingEvents.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
              activeTab === 'completed' ? 'bg-[#173235] text-white shadow-xs' : 'text-[#194e42] hover:text-[#173235]'
            }`}
          >
            Completed Official Results ({completedResults.length})
          </button>
        </div>
      </div>

      {activeTab === 'upcoming' ? (
        upcomingEvents.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#697c7c] border border-dashed border-[#d8ded5] rounded-xl bg-[#f8faf7]">
            No upcoming official tournaments published yet.
          </div>
        ) : (
          <div className="relative">
            <RailControls onPrevious={() => scrollRail(upcomingRail, -1)} onNext={() => scrollRail(upcomingRail, 1)} />
            <div ref={upcomingRail} className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 pr-1" aria-label="Upcoming official tournaments">
            {upcomingEvents.map((evt) => (
              <div key={evt._id} className="min-w-[280px] sm:min-w-[310px] max-w-[310px] snap-start p-4 rounded-xl border border-[#2f6d5a] bg-white shadow-2xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
                      UPCOMING TOURNAMENT
                    </span>
                    <span className="text-[10px] font-mono font-bold text-[#173235] bg-[#f4f8f5] px-2 py-0.5 rounded border border-[#d2dad2]">
                      {evt.eventId}
                    </span>
                  </div>

                  <h4 className="font-extrabold text-[#173235] text-sm mt-2">{evt.eventName}</h4>
                  <p className="text-xs font-bold text-[#194e42] mt-0.5">{evt.federation?.name || 'Recognized Federation'}</p>

                  <div className="space-y-1 mt-2 text-xs text-[#526668]">
                    <div className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-[#cc694e]" />
                      <span>Sport: <strong>{evt.sport}</strong> ({evt.category})</span>
                    </div>
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

                <div className="pt-2 border-t border-[#e2eee4] text-[11px] text-[#697c7c]">
                  Official Submission Deadline: {evt.submissionDeadline ? new Date(evt.submissionDeadline).toLocaleDateString('en-IN') : 'Open'}
                </div>
              </div>
            ))}
            </div>
          </div>
        )
      ) : (
        completedResults.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#697c7c] border border-dashed border-[#d8ded5] rounded-xl bg-[#f8faf7]">
            No completed official results published yet.
          </div>
        ) : (
          <div className="relative">
            <RailControls onPrevious={() => scrollRail(completedRail, -1)} onNext={() => scrollRail(completedRail, 1)} />
            <div ref={completedRail} className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 pr-1" aria-label="Completed official tournament results">
            {completedResults.map((resItem) => (
              <div key={resItem._id} className="min-w-[280px] sm:min-w-[310px] max-w-[310px] snap-start p-4 rounded-xl border border-[#2f6d5a] bg-white shadow-2xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#fef9e7] text-[#9a6c00] border border-[#f0d060] flex items-center gap-1">
                      <Lock size={10} /> OFFICIAL &amp; FROZEN
                    </span>
                    <span className="text-[10px] font-mono font-bold text-[#173235] bg-[#f4f8f5] px-2 py-0.5 rounded border border-[#d2dad2]">
                      {resItem.officialRecordId}
                    </span>
                  </div>

                  <h4 className="font-extrabold text-[#173235] text-sm mt-2">
                    {resItem.achievementType === 'medal' ? `${resItem.medal} Medal` : `Rank #${resItem.rank}`} — {resItem.tournamentName}
                  </h4>
                  <p className="text-xs font-bold text-[#194e42] mt-0.5">Winner: <strong>{resItem.athleteName}</strong></p>
                  <p className="text-[11px] text-[#526668]">{resItem.federation?.name || 'Recognized Federation'}</p>

                  <div className="space-y-1 mt-2 text-xs text-[#526668]">
                    <div>Discipline: <strong>{resItem.sport}</strong> ({resItem.category})</div>
                    <div>Tournament Date: {resItem.event?.tournamentDate ? new Date(resItem.event.tournamentDate).toLocaleDateString('en-IN') : new Date(resItem.eventDate).toLocaleDateString('en-IN')}</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#e2eee4] flex items-center justify-between">
                  <a
                    href={`/verify/${resItem.officialRecordId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-extrabold text-[#e07050] hover:underline"
                  >
                    Public Verification →
                  </a>

                  {resItem.certificateData && (
                    <button
                      type="button"
                      onClick={() => setViewPdfModal(resItem)}
                      className="px-2.5 py-1 rounded-md bg-[#e2eee4] text-[#194e42] font-bold text-xs flex items-center gap-1 border border-[#2f6d5a] cursor-pointer"
                    >
                      <Eye size={12} /> Certificate
                    </button>
                  )}
                </div>
              </div>
            ))}
            </div>
          </div>
        )
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
