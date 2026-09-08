import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Building2,
  MapPin,
  Trophy,
  Phone,
  Mail,
  Send,
  CheckCircle2,
  Clock,
  Search,
  Users,
  Compass,
  X
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui';

export default function AthleteAcademiesSection({ athleteSport, athleteSports }) {
  const [academies, setAcademies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myStatus, setMyStatus] = useState({ memberships: [], requests: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAcademyForJoin, setSelectedAcademyForJoin] = useState(null);
  const [joiningPayment, setJoiningPayment] = useState('Negotiated During Joining');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    fetchAcademies();
    fetchStatus();
  }, [athleteSport, JSON.stringify(athleteSports)]);

  const showNotification = (msg, type = 'success') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchAcademies = async () => {
    setLoading(true);
    try {
      let sportParam = '';
      if (Array.isArray(athleteSports) && athleteSports.length > 0) {
        sportParam = `?sports=${encodeURIComponent(athleteSports.join(','))}`;
      } else if (athleteSport) {
        sportParam = `?sport=${encodeURIComponent(athleteSport)}`;
      }
      const res = await api.get(`/academy/discovery${sportParam}`);
      setAcademies(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error discovering academies:', err);
      setAcademies([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await api.get('/academy/my/athlete-status');
      setMyStatus(res.data || { memberships: [], requests: [] });
    } catch (err) {
      console.error('Error fetching athlete academy status:', err);
    }
  };

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAcademyForJoin) return;
    setSubmitting(true);
    try {
      await api.post(`/academy/${selectedAcademyForJoin._id}/request-join`, {
        sportName: athleteSport || 'SPORTS',
        joiningPayment
      });
      showNotification(`Join request sent to ${selectedAcademyForJoin.name} successfully!`);
      setSelectedAcademyForJoin(null);
      fetchStatus();
    } catch (err) {
      console.error('Error sending join request:', err);
      showNotification(err.response?.data?.error || 'Failed to submit join request.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAcademies = academies.filter(a => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      a.name?.toLowerCase().includes(term) ||
      a.city?.toLowerCase().includes(term) ||
      a.address?.city?.toLowerCase().includes(term) ||
      a.sports?.some(s => s.sportName?.toLowerCase().includes(term))
    );
  });

  const pendingAcademyIds = new Set(
    (myStatus.requests || [])
      .filter(r => r.status === 'PENDING')
      .map(r => r.academyId?._id || r.academyId)
  );

  const enrolledAcademyIds = new Set(
    (myStatus.memberships || [])
      .filter(m => m.status === 'ACTIVE')
      .map(m => m.academyId?._id || m.academyId)
  );

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{feedback.msg}</span>
          <button onClick={() => setFeedback(null)} className="cursor-pointer ml-3 font-bold">×</button>
        </div>
      )}

      {/* Enrolled Academy Banner if any */}
      {myStatus.memberships?.length > 0 && (
        <div className="bg-gradient-to-r from-[#194e42] to-[#123130] text-white p-5 rounded-2xl border border-[#2f6d5a] shadow-md space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#b9d9bf]" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Enrolled Training Academy</h3>
          </div>
          {myStatus.memberships.map((m) => (
            <div key={m._id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-white/10 text-xs">
              <div>
                <h4 className="font-bold text-base text-white">{m.academyId?.name || 'Sports Academy'}</h4>
                <p className="text-[#c5d3ce] flex items-center gap-2 mt-0.5">
                  <span>Discipline: <strong>{m.sportName}</strong></span>
                  <span>·</span>
                  <span>Enrolled: {new Date(m.joinedAt).toLocaleDateString()}</span>
                  <span>·</span>
                  <span>Status: <strong>{m.status}</strong></span>
                </p>
              </div>
              {m.academyId?.contactPhone && (
                <div className="flex items-center gap-1.5 text-xs text-[#b9d9bf]">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{m.academyId.contactPhone}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pending Requests Banner if any */}
      {myStatus.requests?.some(r => r.status === 'PENDING') && (
        <div className="bg-[#fffdfa] border border-amber-200 p-4 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
            <Clock className="w-4 h-4" /> Pending Admission Requests
          </div>
          <div className="space-y-2">
            {myStatus.requests.filter(r => r.status === 'PENDING').map((r) => (
              <div key={r._id} className="flex items-center justify-between text-xs text-gray-700 bg-white p-2.5 rounded-lg border border-amber-100">
                <div>
                  <span className="font-bold text-[#173235]">{r.academyId?.name || 'Academy'}</span>
                  <span className="text-gray-500 ml-2">({r.sportName})</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                  Awaiting Academy Review
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Academies Search & Discovery */}
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="w-5 h-5 text-[#2f6d5a]" />
              Accredited Sports Academies & Training Centers
            </CardTitle>
            <CardDescription className="text-xs">
              Find verified training facilities for <strong>{athleteSport || 'your sport'}</strong> with certified coaches and competition pathways.
            </CardDescription>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search academy or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
            />
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-xs text-gray-500">
              Discovering academies for {athleteSport}...
            </div>
          ) : filteredAcademies.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
              <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">No academies found matching your search.</p>
              <p className="text-xs text-gray-400 mt-1">Check back soon as new verified academies register weekly.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAcademies.map((acad) => {
                const isEnrolled = enrolledAcademyIds.has(acad._id);
                const isPending = pendingAcademyIds.has(acad._id);

                return (
                  <div
                    key={acad._id}
                    className="border border-[#e2e8f0] bg-white rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-[#2f6d5a] transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-base text-[#173235]">{acad.name}</h3>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-[#e07050]" />
                            {acad.city || acad.address?.city || 'India'}, {acad.state || acad.address?.state || ''}
                            {acad.distanceKm !== undefined && (
                              <span className="text-gray-400 ml-1 font-mono">({acad.distanceKm} km away)</span>
                            )}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#eef6f2] text-[#2f6d5a] border border-[#b9d9bf] shrink-0">
                          Verified
                        </span>
                      </div>

                      {/* Ranking Stats */}
                      <div className="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-gray-100 text-center">
                        <div className="bg-gray-50 p-1.5 rounded-lg">
                          <div className="text-[10px] text-gray-500">District</div>
                          <div className="text-xs font-bold text-gray-800">{acad.rankingStats?.districtPlayers || 0}</div>
                        </div>
                        <div className="bg-gray-50 p-1.5 rounded-lg">
                          <div className="text-[10px] text-gray-500">State</div>
                          <div className="text-xs font-bold text-gray-800">{acad.rankingStats?.statePlayers || 0}</div>
                        </div>
                        <div className="bg-gray-50 p-1.5 rounded-lg">
                          <div className="text-[10px] text-gray-500">National</div>
                          <div className="text-xs font-bold text-gray-800">{acad.rankingStats?.nationalPlayers || 0}</div>
                        </div>
                        <div className="bg-gray-50 p-1.5 rounded-lg">
                          <div className="text-[10px] text-gray-500">Int'l</div>
                          <div className="text-xs font-bold text-gray-800">{acad.rankingStats?.internationalPlayers || 0}</div>
                        </div>
                      </div>

                      {/* Sports badges */}
                      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Disciplines:</span>
                        {acad.sports?.map((sp) => (
                          <span
                            key={sp.sportName}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              sp.sportName?.toUpperCase() === athleteSport?.toUpperCase()
                                ? 'bg-[#2f6d5a] text-white'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {sp.sportName}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span>{acad.contactPhone || '—'}</span>
                      </div>

                      {isEnrolled ? (
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">
                          Enrolled Member
                        </span>
                      ) : isPending ? (
                        <span className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold">
                          Request Pending
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedAcademyForJoin(acad)}
                          className="px-3.5 py-1.5 rounded-lg bg-[#2f6d5a] hover:bg-[#235344] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition shadow-xs"
                        >
                          <Send className="w-3.5 h-3.5" /> Request Admission
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* JOIN REQUEST MODAL */}
      {selectedAcademyForJoin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-[#173235]">Request Academy Admission</h3>
                <p className="text-xs text-gray-500">Apply to join {selectedAcademyForJoin.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAcademyForJoin(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Sport Discipline
                </label>
                <input
                  type="text"
                  readOnly
                  value={athleteSport || 'SPORTS'}
                  className="w-full px-3 py-2 text-xs border border-gray-200 bg-gray-50 rounded-lg text-gray-700 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Admission Fee / Terms Preference
                </label>
                <input
                  type="text"
                  value={joiningPayment}
                  onChange={(e) => setJoiningPayment(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Your full TrackAthlete profile and verified achievements will be shared with the academy head coaches for evaluation.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedAcademyForJoin(null)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-bold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-[#2f6d5a] hover:bg-[#235344] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? 'Submitting...' : 'Send Admission Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
