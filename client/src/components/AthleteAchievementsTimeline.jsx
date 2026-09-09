import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Award,
  FileText,
  Eye,
  Trophy,
  RefreshCw,
  Calendar,
  MapPin,
  Plus,
  Trash2,
  ExternalLink,
  Download,
  X,
  CheckCircle2,
  Lock,
  AlertTriangle,
  Users,
  Upload
} from 'lucide-react';
import api from '../services/api';

function isMedalType(item, type) {
  if (!item) return false;
  const posStr = String(item.position !== undefined && item.position !== null ? item.position : '').toLowerCase();
  const outcomeStr = String(item.outcome || '').toLowerCase();
  const medalStr = String(item.medal || '').toLowerCase();

  if (type === 'gold') {
    return posStr.includes('gold') || posStr === '1' || outcomeStr.includes('1st') || outcomeStr.includes('gold') || medalStr.includes('gold') || item.position === 1;
  }
  if (type === 'silver') {
    return posStr.includes('silver') || posStr === '2' || outcomeStr.includes('2nd') || outcomeStr.includes('silver') || medalStr.includes('silver') || item.position === 2;
  }
  if (type === 'bronze') {
    return posStr.includes('bronze') || posStr === '3' || outcomeStr.includes('3rd') || outcomeStr.includes('bronze') || medalStr.includes('bronze') || item.position === 3;
  }
  return false;
}

export default function AthleteAchievementsTimeline({
  athleteUserId,
  athleteName = 'Athlete',
  isCoachView = false,
  isOwner = true
}) {
  const [achievements, setAchievements] = useState([]);
  const [counts, setCounts] = useState({ total: 0, federation: 0, organizer: 0, selfUploaded: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [certificateModal, setCertificateModal] = useState(null);

  // Add self-uploaded tournament modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [formFeedback, setFormFeedback] = useState(null);

  const [newRecord, setNewRecord] = useState({
    tournamentName: '',
    sport: '',
    year: String(new Date().getFullYear()),
    eventDate: '',
    category: '',
    position: 'Gold Medal 🥇',
    certificateData: '',
    certificateFileName: '',
    certificateFileSize: 0
  });

  const fetchAchievements = useCallback(async () => {
    if (!athleteUserId || athleteUserId === 'undefined') {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/athlete/${athleteUserId}/achievements`);
      const achList = res.data.achievements || [];
      setAchievements(achList);

      const fedCount = achList.filter(a => a.sourceType === 'FEDERATION_RECOGNIZED' || a.sourceType === 'FEDERATION').length;
      const orgCount = achList.filter(a => a.sourceType === 'ORGANIZER_VERIFIED' || a.sourceType === 'ORGANIZER').length;
      const selfCount = achList.filter(a => a.sourceType === 'SELF_UPLOADED').length;

      setCounts({
        total: res.data.counts?.total ?? achList.length,
        federation: res.data.counts?.federation ?? fedCount,
        organizer: res.data.counts?.organizer ?? orgCount,
        selfUploaded: res.data.counts?.selfUploaded ?? selfCount
      });
    } catch (err) {
      console.error('Error fetching unified achievements:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load achievements');
    } finally {
      setLoading(false);
    }
  }, [athleteUserId]);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  const handleCertificateFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Certificate file size must be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setNewRecord(prev => ({
        ...prev,
        certificateData: reader.result,
        certificateFileName: file.name,
        certificateFileSize: file.size
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleCreateTournament = async (e) => {
    e.preventDefault();
    if (!newRecord.tournamentName.trim()) {
      setFormFeedback({ type: 'error', text: 'Tournament / Championship name is required.' });
      return;
    }
    if (!newRecord.sport.trim()) {
      setFormFeedback({ type: 'error', text: 'Sport discipline is required (e.g. TAEKWONDO).' });
      return;
    }

    setIsSubmitting(true);
    setFormFeedback(null);
    try {
      await api.post(`/athlete/${athleteUserId}/tournaments`, {
        ...newRecord,
        sport: newRecord.sport.trim().toUpperCase()
      });
      setFormFeedback({ type: 'success', text: 'Achievement record and certificate uploaded successfully.' });
      setNewRecord({
        tournamentName: '',
        sport: '',
        year: String(new Date().getFullYear()),
        eventDate: '',
        category: '',
        position: 'Gold Medal 🥇',
        certificateData: '',
        certificateFileName: '',
        certificateFileSize: 0
      });
      setIsAddOpen(false);
      fetchAchievements();
    } catch (err) {
      setFormFeedback({ type: 'error', text: err.response?.data?.error || err.message || 'Failed to upload tournament' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTournament = async (tournamentId) => {
    if (!window.confirm('Are you sure you want to delete this self-uploaded tournament record?')) return;
    setDeletingId(tournamentId);
    try {
      await api.delete(`/athlete/${athleteUserId}/tournaments/${tournamentId}`);
      fetchAchievements();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to delete tournament');
    } finally {
      setDeletingId('');
    }
  };

  const filtered = sourceFilter === 'ALL'
    ? achievements
    : achievements.filter(a => {
        const s = (a.sourceType || '').toUpperCase();
        const f = sourceFilter.toUpperCase();
        if (f === 'FEDERATION' || f === 'FEDERATION_RECOGNIZED') {
          return s === 'FEDERATION' || s === 'FEDERATION_RECOGNIZED';
        }
        if (f === 'ORGANIZER' || f === 'ORGANIZER_VERIFIED') {
          return s === 'ORGANIZER' || s === 'ORGANIZER_VERIFIED';
        }
        if (f === 'SELF_UPLOADED') {
          return s === 'SELF_UPLOADED';
        }
        return s === f;
      });

  const getSourceBadge = (sourceType) => {
    const s = (sourceType || '').toUpperCase();
    if (s === 'FEDERATION' || s === 'FEDERATION_RECOGNIZED') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 10px',
          borderRadius: 20,
          background: '#e2eee4',
          color: '#194e42',
          border: '1px solid #2f6d5a',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.03em'
        }}>
          <Shield size={12} color="#194e42" /> [FEDERATION RECOGNIZED]
        </span>
      );
    }
    if (s === 'ORGANIZER' || s === 'ORGANIZER_VERIFIED') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 10px',
          borderRadius: 20,
          background: '#eef2ff',
          color: '#2d3748',
          border: '1px solid #94a3b8',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.03em'
        }}>
          <Award size={12} color="#4338ca" /> [ORGANIZER VERIFIED]
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 20,
        background: '#fef9e7',
        color: '#9a6c00',
        border: '1px solid #f0d060',
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.03em'
      }}>
        <FileText size={12} color="#9a6c00" /> [SELF-UPLOADED — NOT VERIFIED]
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header section */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              background: '#e2eee4',
              padding: 9,
              borderRadius: 12,
              color: '#194e42',
              border: '1px solid #2f6d5a'
            }}>
              <Trophy size={22} color="#194e42" />
            </div>
            <div>
              <h3 style={{
                fontSize: 18,
                fontWeight: 800,
                color: '#173235',
                margin: 0,
                fontFamily: 'Georgia, serif'
              }}>
                Complete Achievement & Certificate Timeline
              </h3>
              <p style={{ fontSize: 12, color: '#526668', margin: '2px 0 0' }}>
                Chronological verified ledger spanning Federation Recognized, Organizer Verified, and Self-Uploaded tournament records.
              </p>
            </div>
          </div>

          {!isCoachView && isOwner && (
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 10,
                background: '#194e42',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.04em',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(25, 78, 66, 0.25)',
                transition: 'all 0.2s'
              }}
            >
              <Plus size={15} /> ADD SELF-UPLOADED ACHIEVEMENT
            </button>
          )}
        </div>

        {/* Source Filter Tabs */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          background: '#f4f7f4',
          padding: 6,
          borderRadius: 12,
          border: '1px solid #d8ded5'
        }}>
          {[
            { key: 'ALL', label: `[ ALL (${counts.total || achievements.length}) ]` },
            { key: 'FEDERATION_RECOGNIZED', label: `[ FEDERATION RECOGNIZED (${counts.federation || 0}) ]` },
            { key: 'ORGANIZER_VERIFIED', label: `[ ORGANIZER VERIFIED (${counts.organizer || 0}) ]` },
            { key: 'SELF_UPLOADED', label: `[ SELF-UPLOADED (${counts.selfUploaded || 0}) ]` }
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSourceFilter(tab.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                border: sourceFilter === tab.key ? '1px solid #2f6d5a' : '1px solid transparent',
                background: sourceFilter === tab.key ? '#194e42' : 'transparent',
                color: sourceFilter === tab.key ? '#ffffff' : '#526668',
                transition: 'all 0.15s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading & Error States */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '36px', fontSize: 13, color: '#697c7c' }}>
          <RefreshCw className="animate-spin" size={20} style={{ margin: '0 auto 8px', color: '#194e42' }} />
          Loading unified achievements ledger…
        </div>
      ) : error ? (
        <div style={{
          padding: '16px 20px',
          borderRadius: 12,
          border: '1px solid #efcbc3',
          background: '#fff5f3',
          color: '#e07050',
          fontSize: 13,
          fontWeight: 600
        }}>
          Error loading achievements: {error}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: '40px 24px',
          borderRadius: 16,
          border: '2px dashed #d8ded5',
          background: '#fffefa',
          textAlign: 'center'
        }}>
          <Trophy size={36} style={{ color: '#a5c5bd', margin: '0 auto 10px' }} />
          <div style={{ fontSize: 15, fontWeight: 800, color: '#173235' }}>
            {sourceFilter === 'ALL'
              ? 'No Achievements Recorded Yet'
              : (sourceFilter === 'FEDERATION' || sourceFilter === 'FEDERATION_RECOGNIZED')
              ? 'No Federation Recognized Achievements'
              : (sourceFilter === 'ORGANIZER' || sourceFilter === 'ORGANIZER_VERIFIED')
              ? 'No Organizer Verified Achievements'
              : 'No Self-Uploaded Achievements'}
          </div>
          <p style={{
            fontSize: 12,
            color: '#697c7c',
            marginTop: 6,
            maxWidth: 480,
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: 1.5
          }}>
            {sourceFilter === 'ALL'
              ? 'Achievements from recognized federations, registered tournament organizers, and your self-uploaded records will appear here chronologically.'
              : sourceFilter === 'FEDERATION'
              ? 'Official achievements issued by recognized sports federations will automatically appear here once finalized and frozen.'
              : sourceFilter === 'ORGANIZER'
              ? 'Official podium finishes and certificates from verified organizer events will appear here once verified.'
              : 'You have not uploaded any past tournament results or certificates yet. Click "+ Add Self-Uploaded Achievement" above to document past medals.'}
          </p>
        </div>
      ) : (
        /* Achievements Timeline Cards */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map((item) => {
            const hasCert = !!item.hasCertificate && !!item.certificateData;
            const certTitle = `${athleteName} — ${item.tournamentName || item.eventName}`;

            return (
              <div
                key={item._id}
                style={{
                  background: '#ffffff',
                  borderRadius: 16,
                  border: item.sourceType === 'FEDERATION'
                    ? '1.5px solid #2f6d5a'
                    : item.sourceType === 'ORGANIZER'
                    ? '1.5px solid #94a3b8'
                    : '1px solid #d8ded5',
                  padding: '18px 20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  transition: 'border-color 0.2s'
                }}
              >
                {/* Card Top Row: Badges & Date */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8
                }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    {getSourceBadge(item.sourceType)}
                    {item.sport && (
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 800,
                        background: '#173235',
                        color: '#ffffff',
                        letterSpacing: '0.04em'
                      }}>
                        [ {String(item.sport).toUpperCase()} ]
                      </span>
                    )}
                    {item.isTeam && item.teamName && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: '#f1f5f9',
                        color: '#334155',
                        border: '1px solid #cbd5e1'
                      }}>
                        <Users size={11} /> Team: {item.teamName}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#526668', fontWeight: 600 }}>
                    <Calendar size={13} color="#cc694e" />
                    <span>
                      {item.eventDate
                        ? new Date(item.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : item.year || '2026'}
                    </span>
                  </div>
                </div>

                {/* Card Middle Row: Title & Details */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12
                }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <h4 style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#173235',
                      fontFamily: 'Georgia, serif'
                    }}>
                      {item.tournamentName || item.eventName}
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 12, color: '#526668' }}>
                      {item.issuedBy && (
                        <span>Issued / Managed by: <strong>{item.issuedBy}</strong></span>
                      )}
                      {item.venue && (
                        <>
                          <span>·</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <MapPin size={11} color="#cc694e" /> {item.venue}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Outcome / Medal badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    alignSelf: 'center'
                  }}>
                    <span style={{
                      padding: '5px 14px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 800,
                      background: isMedalType(item, 'gold')
                        ? '#fef9c3'
                        : isMedalType(item, 'silver')
                        ? '#f1f5f9'
                        : isMedalType(item, 'bronze')
                        ? '#ffedd5'
                        : '#e2eee4',
                      color: isMedalType(item, 'gold')
                        ? '#854d0e'
                        : isMedalType(item, 'silver')
                        ? '#334155'
                        : isMedalType(item, 'bronze')
                        ? '#9a3412'
                        : '#194e42',
                      border: '1px solid rgba(0,0,0,0.1)'
                    }}>
                      {item.outcome || (typeof item.position === 'number' ? `Rank #${item.position}` : item.position) || (item.medal ? `${item.medal} Medal` : 'Participant')}
                    </span>
                  </div>
                </div>

                {/* Card Bottom Row: Certificate & Actions */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 10,
                  borderTop: '1px solid #f1f5f1',
                  gap: 10
                }}>
                  <div>
                    {hasCert ? (
                      <span style={{
                        fontSize: 11,
                        color: '#194e42',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <CheckCircle2 size={12} color="#194e42" />
                        Personal Certificate Available ({item.certificateFileName || 'Official PDF'})
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#8a9d9a', fontStyle: 'italic' }}>
                        No certificate document attached
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {hasCert && (
                      <button
                        type="button"
                        onClick={() => setCertificateModal({
                          data: item.certificateData,
                          name: item.certificateFileName || `${athleteName}_Certificate.pdf`,
                          title: certTitle,
                          sourceLabel: item.sourceLabel,
                          outcome: item.outcome || (typeof item.position === 'number' ? `Rank #${item.position}` : item.position) || 'Verified Record'
                        })}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 14px',
                          borderRadius: 8,
                          background: '#194e42',
                          color: '#ffffff',
                          fontSize: 12,
                          fontWeight: 700,
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                      >
                        <Eye size={13} /> View Certificate
                      </button>
                    )}

                    {!isCoachView && isOwner && item.sourceType === 'SELF_UPLOADED' && (
                      <button
                        type="button"
                        disabled={deletingId === item._id}
                        onClick={() => handleDeleteTournament(item._id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: '#fff1f0',
                          color: '#e07050',
                          fontSize: 12,
                          fontWeight: 700,
                          border: '1px solid #fecdd3',
                          cursor: 'pointer',
                          opacity: deletingId === item._id ? 0.5 : 1
                        }}
                        title="Delete Self-Uploaded Tournament"
                      >
                        <Trash2 size={13} /> {deletingId === item._id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Certificate Viewer Modal */}
      {certificateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(12, 41, 44, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 70,
          padding: 16
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 20,
            maxWidth: 720,
            width: '100%',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '1px solid #2f6d5a',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #d8ded5',
              background: '#f8faf7'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: '#e2eee4', padding: 6, borderRadius: 8, color: '#194e42' }}>
                  <Award size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#173235' }}>
                    {certificateModal.title}
                  </h4>
                  <div style={{ fontSize: 11, color: '#526668', marginTop: 2 }}>
                    Source: <strong>{certificateModal.sourceLabel}</strong> · Result: <strong>{certificateModal.outcome}</strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCertificateModal(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#697c7c',
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#f4f6f4', textAlign: 'center' }}>
              <div style={{
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
              }}>
                {certificateModal.data?.startsWith('data:image') ? (
                  <img
                    src={certificateModal.data}
                    alt={certificateModal.name}
                    style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', margin: '0 auto', display: 'block' }}
                  />
                ) : (
                  <iframe
                    src={certificateModal.data}
                    title="Certificate Preview"
                    style={{ width: '100%', height: '58vh', border: 'none' }}
                  />
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              borderTop: '1px solid #d8ded5',
              background: '#ffffff'
            }}>
              <span style={{ fontSize: 11, color: '#526668', fontFamily: 'monospace' }}>
                {certificateModal.name}
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <a
                  href={certificateModal.data}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: '#194e42',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                >
                  <ExternalLink size={13} /> Open Full View
                </a>
                <a
                  href={certificateModal.data}
                  download={certificateModal.name}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #2f6d5a',
                    background: '#e2eee4',
                    color: '#194e42',
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                >
                  <Download size={13} /> Download
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Self-Uploaded Tournament Modal */}
      {isAddOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(12, 41, 44, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 70,
          padding: 16
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 20,
            maxWidth: 580,
            width: '100%',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '1px solid #2f6d5a',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #d8ded5',
              background: '#f8faf7'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: '#e2eee4', padding: 6, borderRadius: 8, color: '#194e42' }}>
                  <Plus size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#173235' }}>
                    Add Self-Uploaded Tournament Achievement
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#526668' }}>
                    Upload personal certificates and past championship records
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#697c7c', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTournament} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
              {/* Mandatory disclaimer */}
              <div style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: '#fef9e7',
                border: '1px solid #f0d060',
                fontSize: 11,
                color: '#854d0e',
                lineHeight: 1.4
              }}>
                <strong>Notice:</strong> Self-uploaded records are categorized as <strong>[ SELF-UPLOADED ]</strong> (Unverified) and are not certified by recognized sports federations or organizers.
              </div>

              {formFeedback && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: formFeedback.type === 'error' ? '#fff5f3' : '#e2eee4',
                  border: `1px solid ${formFeedback.type === 'error' ? '#efcbc3' : '#2f6d5a'}`,
                  fontSize: 12,
                  fontWeight: 700,
                  color: formFeedback.type === 'error' ? '#e07050' : '#194e42'
                }}>
                  {formFeedback.text}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#173235', marginBottom: 4 }}>
                  Tournament / Championship Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. All India Inter-School Taekwondo Championship"
                  value={newRecord.tournamentName}
                  onChange={e => setNewRecord({ ...newRecord, tournamentName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#173235', marginBottom: 4 }}>
                    Sport Discipline * (CAPITAL LETTERS)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TAEKWONDO"
                    value={newRecord.sport}
                    onChange={e => setNewRecord({ ...newRecord, sport: e.target.value.toUpperCase() })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      boxSizing: 'border-box',
                      textTransform: 'uppercase'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#173235', marginBottom: 4 }}>
                    Podium / Result *
                  </label>
                  <select
                    value={newRecord.position}
                    onChange={e => setNewRecord({ ...newRecord, position: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      boxSizing: 'border-box',
                      background: '#ffffff'
                    }}
                  >
                    <option value="Gold Medal 🥇">Gold Medal 🥇</option>
                    <option value="Silver Medal 🥈">Silver Medal 🥈</option>
                    <option value="Bronze Medal 🥉">Bronze Medal 🥉</option>
                    <option value="1st Place">1st Place</option>
                    <option value="2nd Place">2nd Place</option>
                    <option value="3rd Place">3rd Place</option>
                    <option value="Quarter Finalist">Quarter Finalist</option>
                    <option value="Participant">Participant</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#173235', marginBottom: 4 }}>
                    Year *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="2026"
                    value={newRecord.year}
                    onChange={e => setNewRecord({ ...newRecord, year: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#173235', marginBottom: 4 }}>
                    Weight / Age Category (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Under-58kg Senior Men"
                    value={newRecord.category}
                    onChange={e => setNewRecord({ ...newRecord, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Certificate File Upload */}
              <div style={{
                padding: '14px',
                borderRadius: 12,
                border: '1px dashed #2f6d5a',
                background: '#f8faf7',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#194e42', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Upload size={14} /> Certificate File (PDF or Image, max 5MB)
                  </label>
                  {newRecord.certificateFileName && (
                    <span style={{ fontSize: 11, color: '#2f6d5a', fontWeight: 600 }}>
                      Selected: {newRecord.certificateFileName}
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleCertificateFile}
                  style={{ fontSize: 12, color: '#526668' }}
                />
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#526668',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#194e42',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    opacity: isSubmitting ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {isSubmitting ? 'Saving…' : 'Save Achievement & Certificate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
