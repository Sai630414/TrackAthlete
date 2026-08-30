import React, { useState, useEffect, useCallback } from 'react';
import { Shield, CheckCircle2, Lock, AlertTriangle, FileText, Eye, Trophy, RefreshCw, Calendar, MapPin } from 'lucide-react';
import api from '../services/api';

export default function FederationVerifiedSection({ athleteUserId, isCoachView = false }) {
  const [officialAchievements, setOfficialAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePdfModal, setActivePdfModal] = useState(null);

  const fetchOfficialAchievements = useCallback(async () => {
    if (!athleteUserId) return;
    try {
      setLoading(true);
      const res = await api.get(`/athlete/${athleteUserId}/official-achievements`);
      setOfficialAchievements(res.data || []);
    } catch (err) {
      console.error('Error fetching official achievements:', err);
    } finally {
      setLoading(false);
    }
  }, [athleteUserId]);

  useEffect(() => {
    fetchOfficialAchievements();
  }, [fetchOfficialAchievements]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', fontSize: 12, color: '#697c7c' }}>
        <RefreshCw className="animate-spin" size={18} style={{ margin: '0 auto 6px', color: '#194e42' }} />
        Loading federation-verified achievements…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#e2eee4', padding: 8, borderRadius: 10, color: '#194e42', border: '1px solid #2f6d5a' }}>
            <Shield size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#173235', margin: 0, fontFamily: 'Georgia, serif' }}>
              Federation Verified Achievements ({officialAchievements.length})
            </h3>
            <p style={{ fontSize: 12, color: '#526668', margin: '2px 0 0' }}>
              Official trusted records created directly by recognized sports federations. Immutable & verified.
            </p>
          </div>
        </div>
      </div>

      {officialAchievements.length === 0 ? (
        <div style={{ padding: '32px 24px', borderRadius: 16, border: '2px dashed #d8ded5', background: '#fffefa', textAlign: 'center' }}>
          <Shield size={32} style={{ color: '#a5c5bd', margin: '0 auto 8px' }} />
          <div style={{ fontSize: 14, fontWeight: 800, color: '#173235' }}>No Official Federation Achievements Yet</div>
          <div style={{ fontSize: 12, color: '#697c7c', marginTop: 4, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
            Official results issued by recognized federations during tournaments will automatically appear here.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {officialAchievements.map((item) => {
            const fedName = item.federation?.name || 'Recognized Sports Federation';
            const isFrozen = item.verificationStatus === 'FROZEN' || (item.event?.submissionDeadline && new Date() > new Date(item.event.submissionDeadline));
            const isRevoked = item.verificationStatus === 'REVOKED';

            return (
              <div key={item._id} style={{
                background: '#ffffff',
                borderRadius: 16,
                border: '1px solid #2f6d5a',
                padding: 18,
                boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 14
              }}>
                <div>
                  {/* Badge Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 800,
                      background: isRevoked ? '#fff3f0' : isFrozen ? '#fef9e7' : '#e2eee4',
                      color: isRevoked ? '#e07050' : isFrozen ? '#9a6c00' : '#194e42',
                      border: `1px solid ${isRevoked ? '#efcbc3' : isFrozen ? '#f0d060' : '#2f6d5a'}`
                    }}>
                      {isRevoked ? (
                        <> <AlertTriangle size={12} /> REVOKED </>
                      ) : isFrozen ? (
                        <> <Lock size={12} /> VERIFIED & FROZEN 🔒 </>
                      ) : (
                        <> <CheckCircle2 size={12} /> FEDERATION VERIFIED ✓ </>
                      )}
                    </span>

                    <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 800, color: '#173235', background: '#f4f8f5', padding: '2px 6px', borderRadius: 4, border: '1px solid #d2dad2' }}>
                      {item.officialRecordId}
                    </span>
                  </div>

                  {/* Title */}
                  <h4 style={{ fontSize: 15, fontWeight: 800, color: '#173235', margin: 0 }}>
                    {item.achievementType === 'medal' ? `${item.medal} Medal` : `Rank #${item.rank}`} — {item.tournamentName}
                  </h4>

                  <div style={{ fontSize: 12, fontWeight: 700, color: '#194e42', marginTop: 4 }}>
                    Issuer: {fedName}
                  </div>

                  <div style={{ fontSize: 11, color: '#526668', marginTop: 4 }}>
                    Category: {item.category} · Year {item.year}
                  </div>

                  {item.description && (
                    <div style={{ fontSize: 11, color: '#697c7c', fontStyle: 'italic', marginTop: 8, background: '#fcfcf8', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2ede4' }}>
                      "{item.description}"
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div style={{ paddingTop: 10, borderTop: '1px solid #f0f4f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <a
                    href={`/verify/${item.officialRecordId}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 11, fontWeight: 800, color: '#e07050', textDecoration: 'none' }}
                  >
                    Public Verification →
                  </a>

                  {item.certificateData && (
                    <button
                      type="button"
                      onClick={() => setActivePdfModal(item)}
                      style={{
                        height: 30,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: '1px solid #d8ded5',
                        background: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#173235',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Eye size={12} /> View Certificate
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Certificate PDF Viewer Modal */}
      {activePdfModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(12, 41, 44, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', border: '1px solid #2f6d5a' }}>
            <div style={{ padding: '16px 24px', background: '#173235', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileText size={18} style={{ color: '#e07050' }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{activePdfModal.tournamentName} — Official Certificate</div>
                  <div style={{ fontSize: 11, color: '#b9d9bf' }}>Official Record ID: {activePdfModal.officialRecordId}</div>
                </div>
              </div>
              <button onClick={() => setActivePdfModal(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ flex: 1, padding: 16, background: '#f4f8f5', overflow: 'auto' }}>
              <iframe
                src={activePdfModal.certificateData}
                style={{ width: '100%', height: '60vh', border: '1px solid #d8ded5', borderRadius: 12, background: '#fff' }}
                title="Official Certificate Viewer"
              />
            </div>
            <div style={{ padding: '12px 24px', background: '#fff', borderTop: '1px solid #e2ede4', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setActivePdfModal(null)} style={{ height: 36, padding: '0 20px', borderRadius: 8, border: 'none', background: '#173235', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Close Viewer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
