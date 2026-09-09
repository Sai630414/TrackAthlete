import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Trophy,
  Building2,
  CheckCircle2,
  ExternalLink,
  Shield,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  Send,
  RefreshCw,
  Award,
  AlertCircle,
  X
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui';

export default function AthleteRecommendationsPage() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [athleteSummary, setAthleteSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Modal states
  const [selectedAcademy, setSelectedAcademy] = useState(null);
  const [loadingAcademyDetails, setLoadingAcademyDetails] = useState(false);
  const [academyDetails, setAcademyDetails] = useState(null);
  const [joinModalAcademy, setJoinModalAcademy] = useState(null);
  const [joiningPayment, setJoiningPayment] = useState('Negotiated During Joining');
  const [submittingJoin, setSubmittingJoin] = useState(false);

  const showNotification = (msg, type = 'success') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [recsRes, summaryRes] = await Promise.all([
        api.get('/recommendations'),
        api.get('/recommendations/athlete-summary')
      ]);
      setRecommendations(Array.isArray(recsRes.data) ? recsRes.data : []);
      setAthleteSummary(Array.isArray(summaryRes.data) ? summaryRes.data : []);
    } catch (err) {
      console.error('Error loading recommendations:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load recommendations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRevalidate = async () => {
    setRevalidating(true);
    try {
      await api.post('/recommendations/revalidate');
      await loadData();
      showNotification('Recommendations synchronized with latest verified achievements!');
    } catch (err) {
      console.error('Error revalidating recommendations:', err);
      showNotification(err.response?.data?.error || 'Failed to revalidate recommendations.', 'error');
    } finally {
      setRevalidating(false);
    }
  };

  const handleMarkAsViewed = async (recId) => {
    try {
      await api.patch(`/recommendations/${recId}/view`);
      setRecommendations(prev =>
        prev.map(r => (r.id === recId || r._id === recId ? { ...r, status: 'VIEWED', viewedAt: new Date() } : r))
      );
    } catch (err) {
      // Non-critical, ignore
    }
  };

  const handleOpenAcademyDetails = async (rec) => {
    setSelectedAcademy(rec);
    if (rec.status === 'UNREAD') {
      handleMarkAsViewed(rec.id || rec._id);
    }

    setLoadingAcademyDetails(true);
    setAcademyDetails(null);
    try {
      const targetId = rec.academyId || rec.academy?._id || rec.academy?.academyId;
      const res = await api.get(`/academy/${targetId}`);
      setAcademyDetails(res.data);
    } catch (err) {
      console.error('Error loading academy details:', err);
      // Fallback to populated academy data in recommendation
      setAcademyDetails(rec.academy || null);
    } finally {
      setLoadingAcademyDetails(false);
    }
  };

  const handleOpenJoinModal = (rec) => {
    setJoinModalAcademy(rec);
    if (rec.status === 'UNREAD') {
      handleMarkAsViewed(rec.id || rec._id);
    }
  };

  const handleSubmitJoin = async (e) => {
    e.preventDefault();
    if (!joinModalAcademy) return;
    setSubmittingJoin(true);
    try {
      const academyDbId = joinModalAcademy.academy?._id || joinModalAcademy.academyId;
      await api.post(`/academy/${academyDbId}/request-join`, {
        sportName: joinModalAcademy.sport,
        joiningPayment
      });
      showNotification(`Join request sent to ${joinModalAcademy.academy?.name || 'Academy'} successfully!`);
      setJoinModalAcademy(null);
    } catch (err) {
      console.error('Error submitting join request:', err);
      showNotification(err.response?.data?.error || 'Failed to submit join request.', 'error');
    } finally {
      setSubmittingJoin(false);
    }
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#173d3c] via-[#123130] to-[#0c292c] border border-[#2f6d5a] p-5 sm:p-6 rounded-2xl text-white shadow-md">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
              <Sparkles className="w-3.5 h-3.5 text-[#e07050]" /> Verified Achievement Match
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono text-[#c5d3ce] border border-white/20">
              {user?.athleteId || 'ATH-N/A'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-normal text-white" style={{ fontFamily: 'Georgia, serif' }}>
            Recommended <em style={{ color: '#b9d9bf', fontStyle: 'italic' }}>Academies</em>
          </h1>
          <p className="text-xs text-[#c5d3ce] max-w-2xl">
            Academies matched strictly to your authoritative verified competition achievements.
            Recommendations are evaluated independently per sport and offer same or higher achievement standards.
          </p>
        </div>

        <div className="flex shrink-0">
          <button
            type="button"
            onClick={handleRevalidate}
            disabled={revalidating}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs uppercase tracking-wider transition-all border border-white/20 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${revalidating ? 'animate-spin' : ''}`} />
            {revalidating ? 'Syncing...' : 'Sync Matches'}
          </button>
        </div>
      </div>

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

      {/* Verified Achievement Summary Banner */}
      <div className="bg-[#fcfcf8] border border-[#d8ded5] rounded-xl p-4 shadow-2xs">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <span className="text-xs font-bold text-[#173235] uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[#e07050]" /> Your Highest Verified Achievements
          </span>
          <span className="text-[11px] text-[#526668]">
            Self-Declared Level: <strong>{user?.athleteLevel || 'BEGINNER'}</strong> (Kept separate)
          </span>
        </div>

        {athleteSummary.length === 0 ? (
          <p className="text-xs text-[#526668] italic">
            No official verified achievements recorded yet. Recommendations will appear when tournament results are verified by recognized Federations or Organizers.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {athleteSummary.map((item, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#2f6d5a]/40 bg-[#eef5f0] text-xs font-bold text-[#194e42]"
              >
                <span className="font-extrabold uppercase">[{item.sport}]</span>
                <span>·</span>
                <span className="text-[#e07050] uppercase font-mono">{item.level}</span>
                <span>·</span>
                <span>{item.outcome}</span>
                <span className="text-[10px] text-[#526668] font-normal">
                  ({item.sourceType === 'FEDERATION_RECOGNIZED' ? 'Federation' : 'Organizer'})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Recommendations Display */}
      {loading ? (
        <div className="text-center py-12 text-[#526668] text-sm">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#2f6d5a]" />
          Loading personalized academy recommendations...
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : recommendations.length === 0 ? (
        /* Genuine Empty State (Rules 36 & 54) */
        <Card className="text-center py-12 px-4 border border-dashed border-[#d8ded5] bg-white">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-[#526668]/40" />
          <h3 className="text-base font-bold text-[#173235]">No academy recommendations yet.</h3>
          <p className="text-xs text-[#526668] max-w-md mx-auto mt-1 mb-4">
            Recommendations require matching academies offering your sport at an Achievement Level equal to or higher than your verified competition achievements.
          </p>
          <div className="inline-block text-left max-w-md bg-[#fcfcf8] border border-[#e5e9e2] rounded-xl p-3 text-[11px] text-[#526668] space-y-1">
            <p className="font-bold text-[#173235]">How Recommendations Work:</p>
            <p>1. Compete in recognized Federation or Organizer tournaments.</p>
            <p>2. Official results automatically establish your Highest Verified Level per sport.</p>
            <p>3. The engine recommends qualifying academies offering that specific sport.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {recommendations.map(rec => {
            const academy = rec.academy || {};
            const isUnread = rec.status === 'UNREAD';

            return (
              <div
                key={rec.id || rec._id}
                className={`relative flex flex-col justify-between rounded-2xl border transition-all duration-200 bg-white shadow-2xs hover:shadow-md p-5 ${
                  isUnread
                    ? 'border-[#e07050] ring-1 ring-[#e07050]/30'
                    : 'border-[#d8ded5]'
                }`}
              >
                {isUnread && (
                  <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#e07050] text-white shadow-xs tracking-wider">
                    ● New Match
                  </div>
                )}

                <div className="space-y-3">
                  {/* Academy Title & ID */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-[#2f6d5a]/10 text-[#194e42] border border-[#2f6d5a]/30">
                        [ {rec.sport} ]
                      </span>
                      <span className="text-[11px] font-mono text-[#526668]">
                        {academy.academyId || 'ACA-VERIFIED'}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-[#173235] mt-1 line-clamp-1 flex items-center gap-1.5">
                      <span>{academy.name || 'Sports Academy'}</span>
                      <CheckCircle2 className="w-4 h-4 text-[#2f6d5a] shrink-0 inline" title="Verified TrackAthlete Sports Academy" />
                      <span className="text-xs font-bold text-[#2f6d5a]">✓</span>
                    </h3>
                    <p className="text-xs font-bold text-[#2f6d5a] flex items-center gap-1 mt-0.5">
                      Verified Sports Academy
                    </p>
                    {(academy.city || academy.state) && (
                      <p className="text-xs text-[#526668] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-[#2f6d5a]" />
                        <span>{academy.city}{academy.city && academy.state ? ', ' : ''}{academy.state}</span>
                      </p>
                    )}
                  </div>

                  {/* Achievement Level Comparison */}
                  <div className="bg-[#fcfcf8] border border-[#e5e9e2] rounded-xl p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#526668]">Academy Level:</span>
                      <span className="font-extrabold uppercase text-[#194e42] bg-[#e2eee4] px-2 py-0.5 rounded border border-[#2f6d5a]/40 text-[11px]">
                        {rec.academyAchievementLevel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#526668]">Your Verified Level:</span>
                      <span className="font-bold uppercase text-[#e07050] bg-[#fff3f0] px-2 py-0.5 rounded border border-[#efcbc3] text-[11px]">
                        {rec.athleteAchievementLevel}
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Reason */}
                  <p className="text-xs text-[#526668] leading-relaxed bg-[#fbfdfa] p-2.5 rounded-lg border border-[#d8ded5]/60 italic">
                    "{rec.reason}"
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 mt-2 border-t border-[#e5e9e2]">
                  <button
                    type="button"
                    onClick={() => handleOpenAcademyDetails(rec)}
                    className="flex-1 flex items-center justify-center gap-1 h-9 px-3 rounded-lg border border-[#2f6d5a] bg-white hover:bg-[#eef5f0] text-[#194e42] font-bold text-xs transition cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View Details
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenJoinModal(rec)}
                    className="flex-1 flex items-center justify-center gap-1 h-9 px-3 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white font-bold text-xs uppercase tracking-wider transition shadow-2xs cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" /> Request Join
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ACADEMY DETAILS MODAL (Rule 37 & 39) */}
      {selectedAcademy && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#d8ded5] p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#e5e9e2] pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#526668]">
                  ID: {academyDetails?.academyId || selectedAcademy.academy?.academyId || 'ACA-VERIFIED'}
                </span>
                <h2 className="text-lg font-extrabold text-[#173235]">
                  {academyDetails?.name || selectedAcademy.academy?.name || 'Academy Details'}
                </h2>
              </div>
              <button
                onClick={() => setSelectedAcademy(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingAcademyDetails ? (
              <div className="text-center py-8 text-xs text-[#526668]">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#2f6d5a]" />
                Loading authoritative academy data...
              </div>
            ) : academyDetails ? (
              <div className="space-y-4 text-xs">
                {/* Achievement Classification */}
                <div className="bg-[#eef5f0] border border-[#2f6d5a]/40 rounded-xl p-3.5 text-[#194e42]">
                  <div className="font-extrabold text-sm uppercase">
                    {academyDetails.achievementLevelLabel || (academyDetails.achievementLevel && academyDetails.achievementLevel !== 'UNRANKED' && academyDetails.achievementLevel !== 'NOT YET QUALIFIED'
                      ? `Achievement Level: ${academyDetails.achievementLevel}`
                      : 'Achievement Level: NOT YET QUALIFIED')}
                  </div>
                  <p className="text-[11px] text-[#526668] mt-0.5">
                    Dynamic classification determined by authoritative verified athlete achievements.
                  </p>
                </div>

                {/* Per-Sport Statistics */}
                {academyDetails.perSportLevels && Object.keys(academyDetails.perSportLevels).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-[#173235] uppercase tracking-wider text-[11px]">
                      Achievement Statistics by Sport:
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(academyDetails.perSportLevels).map(([sportKey, sInfo]) => (
                        <div key={sportKey} className="border border-[#d8ded5] rounded-lg p-2.5 bg-[#fcfcf8]">
                          <div className="flex items-center justify-between mb-1.5 font-bold">
                            <span className="uppercase text-[#173235]">[ {sportKey} ]</span>
                            <span className="text-[#194e42] text-[11px]">Level: {sInfo.achievementLevel}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-[10px] text-center">
                            <div className="bg-white p-1 rounded border border-[#e5e9e2]">
                              <div className="text-[#526668]">District</div>
                              <div className="font-bold text-[#173235]">{sInfo.rankingStats?.districtPlayers ?? 0}</div>
                            </div>
                            <div className="bg-white p-1 rounded border border-[#e5e9e2]">
                              <div className="text-[#526668]">State</div>
                              <div className="font-bold text-[#173235]">{sInfo.rankingStats?.statePlayers ?? 0}</div>
                            </div>
                            <div className="bg-white p-1 rounded border border-[#e5e9e2]">
                              <div className="text-[#526668]">National</div>
                              <div className="font-bold text-[#173235]">{sInfo.rankingStats?.nationalPlayers ?? 0}</div>
                            </div>
                            <div className="bg-white p-1 rounded border border-[#e5e9e2]">
                              <div className="text-[#526668]">International</div>
                              <div className="font-bold text-[#173235]">{sInfo.rankingStats?.internationalPlayers ?? 0}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contact & Location */}
                <div className="space-y-1.5 border-t border-[#e5e9e2] pt-3">
                  <h4 className="font-bold text-[#173235] uppercase tracking-wider text-[11px]">Contact & Location:</h4>
                  {academyDetails.contactPhone && (
                    <p className="flex items-center gap-2 text-[#526668]">
                      <Phone className="w-3.5 h-3.5 text-[#2f6d5a]" />
                      <span>{academyDetails.contactPhone}</span>
                    </p>
                  )}
                  {academyDetails.email && (
                    <p className="flex items-center gap-2 text-[#526668]">
                      <Mail className="w-3.5 h-3.5 text-[#2f6d5a]" />
                      <span>{academyDetails.email}</span>
                    </p>
                  )}
                  {(academyDetails.city || academyDetails.state) && (
                    <p className="flex items-center gap-2 text-[#526668]">
                      <MapPin className="w-3.5 h-3.5 text-[#2f6d5a]" />
                      <span>{academyDetails.city}{academyDetails.city && academyDetails.state ? ', ' : ''}{academyDetails.state}</span>
                    </p>
                  )}
                </div>

                {/* Sports Offered */}
                {academyDetails.sports && academyDetails.sports.length > 0 && (
                  <div className="border-t border-[#e5e9e2] pt-3">
                    <h4 className="font-bold text-[#173235] uppercase tracking-wider text-[11px] mb-1.5">
                      Sports Offered:
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {academyDetails.sports.map((sp, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-[#173235] border border-gray-200">
                          {sp.sportName || sp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex justify-end pt-3 border-t border-[#e5e9e2]">
              <button
                type="button"
                onClick={() => setSelectedAcademy(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#173235] font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQUEST TO JOIN MODAL (Rule 38) */}
      {joinModalAcademy && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#d8ded5] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e5e9e2] pb-3">
              <div>
                <h3 className="font-extrabold text-[#173235] text-base">Request to Join Academy</h3>
                <p className="text-xs text-[#526668]">{joinModalAcademy.academy?.name}</p>
              </div>
              <button
                onClick={() => setJoinModalAcademy(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitJoin} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#173235] mb-1">Sport Discipline:</label>
                <input
                  type="text"
                  disabled
                  value={joinModalAcademy.sport}
                  className="w-full h-9 px-3 rounded-lg border border-[#d8ded5] bg-[#fcfcf8] font-bold text-[#194e42]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#173235] mb-1">Your Verified Level:</label>
                <input
                  type="text"
                  disabled
                  value={`${joinModalAcademy.athleteAchievementLevel} (Authoritative Match)`}
                  className="w-full h-9 px-3 rounded-lg border border-[#d8ded5] bg-[#fcfcf8] font-bold text-[#e07050]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#173235] mb-1">Joining Fee Preference:</label>
                <select
                  value={joiningPayment}
                  onChange={e => setJoiningPayment(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#d8ded5] bg-white text-[#173235]"
                >
                  <option value="Negotiated During Joining">Negotiate during physical visit / trial</option>
                  <option value="Scholarship Requested">Seeking merit-based sports scholarship</option>
                  <option value="Standard Fee">Ready for standard training fee</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e5e9e2]">
                <button
                  type="button"
                  onClick={() => setJoinModalAcademy(null)}
                  disabled={submittingJoin}
                  className="px-4 py-2 rounded-lg border border-[#d8ded5] bg-white text-[#526668] font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingJoin}
                  className="px-5 py-2 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white font-extrabold uppercase tracking-wider cursor-pointer shadow-2xs"
                >
                  {submittingJoin ? 'Sending...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
