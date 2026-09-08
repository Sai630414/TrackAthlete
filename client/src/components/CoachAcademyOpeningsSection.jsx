import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Briefcase,
  MapPin,
  Clock,
  Building2,
  FileText,
  Send,
  CheckCircle2,
  Trophy,
  Phone,
  Search,
  X
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui';

export default function CoachAcademyOpeningsSection({
  coachSport,
  coachSports = [],
  willingToWorkWithAcademies = true,
  defaultCertificate = null
}) {
  const [selectedSportFilter, setSelectedSportFilter] = useState('');
  const [openings, setOpenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myStatus, setMyStatus] = useState({ assignments: [], applications: [] });
  const [selectedOpeningForApply, setSelectedOpeningForApply] = useState(null);
  const [applyForm, setApplyForm] = useState({
    salary: 'Negotiated During Joining',
    certificateData: defaultCertificate?.certificateData || null,
    certificateFileName: defaultCertificate?.certificateFileName || ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (defaultCertificate?.certificateData && !applyForm.certificateData) {
      setApplyForm(prev => ({
        ...prev,
        certificateData: defaultCertificate.certificateData,
        certificateFileName: defaultCertificate.certificateFileName || ''
      }));
    }
  }, [defaultCertificate]);

  useEffect(() => {
    if (willingToWorkWithAcademies === false) {
      setOpenings([]);
      setLoading(false);
      return;
    }
    fetchOpenings();
    fetchStatus();
  }, [coachSport, selectedSportFilter, willingToWorkWithAcademies]);

  const showNotification = (msg, type = 'success') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchOpenings = async () => {
    setLoading(true);
    try {
      const activeSport = selectedSportFilter || (coachSport && coachSport !== 'all' ? coachSport : '');
      const sportParam = activeSport ? `?sport=${encodeURIComponent(activeSport)}` : '';
      const res = await api.get(`/academy/openings/discovery${sportParam}`);
      setOpenings(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error discovering openings:', err);
      setOpenings([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await api.get('/academy/my/coach-status');
      setMyStatus(res.data || { assignments: [], applications: [] });
    } catch (err) {
      console.error('Error fetching coach academy status:', err);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setApplyForm(prev => ({
        ...prev,
        certificateData: reader.result,
        certificateFileName: file.name
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!selectedOpeningForApply) return;
    setSubmitting(true);
    try {
      await api.post(`/academy/openings/${selectedOpeningForApply._id}/apply`, applyForm);
      showNotification('Application submitted to academy successfully!');
      setSelectedOpeningForApply(null);
      setApplyForm({
        salary: 'Negotiated During Joining',
        certificateData: null,
        certificateFileName: ''
      });
      fetchStatus();
    } catch (err) {
      console.error('Error submitting coach application:', err);
      showNotification(err.response?.data?.error || 'Failed to submit application.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const appliedOpeningIds = new Set(
    (myStatus.applications || [])
      .filter(a => a.status === 'PENDING')
      .map(a => a.openingId?._id || a.openingId)
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

      {/* Active Coaching Staff Positions */}
      {myStatus.assignments?.length > 0 && (
        <div className="bg-gradient-to-r from-[#194e42] to-[#123130] text-white p-5 rounded-2xl border border-[#2f6d5a] shadow-md space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#b9d9bf]" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Active Academy Staff Assignments</h3>
          </div>
          {myStatus.assignments.map((asg) => (
            <div key={asg._id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-white/10 text-xs">
              <div>
                <h4 className="font-bold text-base text-white">{asg.academyId?.name || 'Academy Facility'}</h4>
                <p className="text-[#c5d3ce] flex items-center gap-2 mt-0.5">
                  <span>Discipline: <strong>{asg.sportName}</strong></span>
                  <span>·</span>
                  <span>Role: <strong>{asg.role}</strong></span>
                  <span>·</span>
                  <span>Status: <strong>{asg.status}</strong></span>
                </p>
              </div>
              {asg.academyId?.contactPhone && (
                <div className="flex items-center gap-1.5 text-xs text-[#b9d9bf]">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{asg.academyId.contactPhone}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pending Applications */}
      {myStatus.applications?.some(a => a.status === 'PENDING') && (
        <div className="bg-[#fffdfa] border border-amber-200 p-4 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
            <Clock className="w-4 h-4" /> Submitted Applications Awaiting Academy Review
          </div>
          <div className="space-y-2">
            {myStatus.applications.filter(a => a.status === 'PENDING').map((app) => (
              <div key={app._id} className="flex items-center justify-between text-xs text-gray-700 bg-white p-2.5 rounded-lg border border-amber-100">
                <div>
                  <span className="font-bold text-[#173235]">{app.academyId?.name || 'Academy'}</span>
                  <span className="text-gray-500 ml-2">({app.sportName} - {app.openingId?.position || 'Coach'})</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                  Pending Review
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discovery Openings Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Briefcase className="w-5 h-5 text-[#2f6d5a]" />
            Academy Hiring Openings for {coachSport || 'Your Discipline'}
          </CardTitle>
          <CardDescription className="text-xs">
            Apply directly to accredited sports academies looking for certified coaches, trainers, and mentors.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-xs text-gray-500">
              Searching for openings matching {coachSport}...
            </div>
          ) : openings.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
              <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">No active openings found for {coachSport || 'your sport'}.</p>
              <p className="text-xs text-gray-400 mt-1">Academies publish new positions periodically. Check back soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {openings.map((op) => {
                const isPending = appliedOpeningIds.has(op._id);

                return (
                  <div
                    key={op._id}
                    className="border border-[#e2e8f0] bg-white rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-[#2f6d5a] transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#eef6f2] text-[#2f6d5a] border border-[#b9d9bf]">
                            {op.sportName}
                          </span>
                          <h3 className="font-bold text-base text-[#173235] mt-1.5">{op.position}</h3>
                          <p className="text-xs text-gray-600 font-semibold mt-0.5">
                            {op.academyId?.name || 'Sports Academy'}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {op.status}
                        </span>
                      </div>

                      {op.description && (
                        <p className="text-xs text-gray-600 mt-2 line-clamp-3">{op.description}</p>
                      )}

                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-xs text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <span>{op.location || `${op.academyId?.city || ''}, ${op.academyId?.state || ''}`.trim() || 'On-site'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>Expected Terms: <strong>{op.salary}</strong></span>
                        </div>
                      </div>

                      {/* Academy Player Stats */}
                      {op.academyId?.rankingStats && (
                        <div className="grid grid-cols-4 gap-1 mt-3 pt-2 border-t border-gray-100 text-center">
                          <div className="bg-gray-50 p-1 rounded">
                            <div className="text-[9px] text-gray-400">District</div>
                            <div className="text-[11px] font-bold text-gray-700">{op.academyId.rankingStats.districtPlayers || 0}</div>
                          </div>
                          <div className="bg-gray-50 p-1 rounded">
                            <div className="text-[9px] text-gray-400">State</div>
                            <div className="text-[11px] font-bold text-gray-700">{op.academyId.rankingStats.statePlayers || 0}</div>
                          </div>
                          <div className="bg-gray-50 p-1 rounded">
                            <div className="text-[9px] text-gray-400">National</div>
                            <div className="text-[11px] font-bold text-gray-700">{op.academyId.rankingStats.nationalPlayers || 0}</div>
                          </div>
                          <div className="bg-gray-50 p-1 rounded">
                            <div className="text-[9px] text-gray-400">Int'l</div>
                            <div className="text-[11px] font-bold text-gray-700">{op.academyId.rankingStats.internationalPlayers || 0}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                      <div className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span>{op.academyId?.contactPhone || '—'}</span>
                      </div>

                      {isPending ? (
                        <span className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold">
                          Application Pending
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOpeningForApply(op);
                            setApplyForm({
                              salary: op.salary || 'Negotiated During Joining',
                              certificateData: null,
                              certificateFileName: ''
                            });
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-[#2f6d5a] hover:bg-[#235344] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition shadow-xs"
                        >
                          <Send className="w-3.5 h-3.5" /> Apply for Role
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

      {/* APPLY MODAL */}
      {selectedOpeningForApply && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-[#173235]">Apply for Coaching Opening</h3>
                <p className="text-xs text-gray-500">{selectedOpeningForApply.position} at {selectedOpeningForApply.academyId?.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOpeningForApply(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Sport Discipline
                </label>
                <input
                  type="text"
                  readOnly
                  value={selectedOpeningForApply.sportName}
                  className="w-full px-3 py-2 text-xs border border-gray-200 bg-gray-50 rounded-lg text-gray-700 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Expected Salary / Terms
                </label>
                <input
                  type="text"
                  value={applyForm.salary}
                  onChange={(e) => setApplyForm({ ...applyForm, salary: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Attach Coaching Certificate PDF (Optional)
                </label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-[#eef6f2] file:text-[#2f6d5a] cursor-pointer"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Your NIS ID and certifications from your coach profile will also be shared with the academy.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedOpeningForApply(null)}
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
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
