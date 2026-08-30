import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Shield, CheckCircle2, AlertTriangle, FileText, Award, Calendar, MapPin, Eye, Lock, RefreshCw, XCircle } from 'lucide-react';
import api from '../services/api';

export default function VerificationPortal() {
  const { recordId } = useParams();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewPdf, setViewPdf] = useState(false);

  const fetchRecord = useCallback(async () => {
    if (!recordId) return;
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/verify/${recordId}`);
      setRecord(res.data);
    } catch (err) {
      setError(err.response?.data?.error || `No official federation record found for ID '${recordId}'.`);
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f4f6f4',
      padding: '40px 20px',
      fontFamily: 'Helvetica Neue, Arial, sans-serif',
      color: '#173235'
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #173d3c 0%, #0c292c 100%)',
          borderRadius: 20,
          padding: '24px 32px',
          color: '#fff',
          border: '1px solid #2f6d5a',
          boxShadow: '0 12px 32px rgba(12, 41, 44, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              background: '#e07050',
              width: 44,
              height: 44,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <Shield size={24} />
            </div>
            <div>
              <div style={{ color: '#b9d9bf', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                TrackAthlete Official Verification Ledger
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, fontFamily: 'Georgia, serif' }}>
                Public Trust & Achievement Verification Portal
              </h1>
            </div>
          </div>
          <Link to="/" style={{ color: '#b9d9bf', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
            TrackAthlete Home →
          </Link>
        </div>

        {/* Loading State */}
        {loading ? (
          <div style={{
            background: '#fff',
            borderRadius: 20,
            padding: 60,
            textAlign: 'center',
            border: '1px solid #d8ded5',
            color: '#697c7c'
          }}>
            <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 12px', color: '#194e42' }} />
            <div style={{ fontSize: 14, fontWeight: 700 }}>Querying Official MongoDB Verification Ledger…</div>
          </div>
        ) : error ? (
          /* Error State */
          <div style={{
            background: '#fff',
            borderRadius: 20,
            padding: 40,
            textAlign: 'center',
            border: '1px solid #efcbc3',
            boxShadow: '0 8px 24px rgba(0,0,0,0.05)'
          }}>
            <XCircle size={48} style={{ color: '#e07050', margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#173235', margin: '0 0 8px', fontFamily: 'Georgia, serif' }}>
              Record Not Verified
            </h3>
            <p style={{ fontSize: 14, color: '#697c7c', maxWidth: 480, margin: '0 auto 20px' }}>
              {error}
            </p>
            <div style={{ fontSize: 12, color: '#8a9d9a' }}>
              Official Record ID queried: <strong>{recordId}</strong>
            </div>
          </div>
        ) : record ? (
          /* VERIFIED RECORD CARD */
          <div style={{
            background: '#fff',
            borderRadius: 20,
            border: '1px solid #d8ded5',
            boxShadow: '0 12px 36px rgba(0,0,0,0.06)',
            overflow: 'hidden'
          }}>
            {/* Status Banner */}
            <div style={{
              background: record.verificationStatus === 'REVOKED'
                ? '#fff3f0'
                : record.verificationStatus === 'FROZEN'
                ? '#fef9e7'
                : '#e2eee4',
              borderBottom: '1px solid #d8ded5',
              padding: '18px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {record.verificationStatus === 'REVOKED' ? (
                  <AlertTriangle size={24} style={{ color: '#e07050' }} />
                ) : record.verificationStatus === 'FROZEN' ? (
                  <Lock size={24} style={{ color: '#9a6c00' }} />
                ) : (
                  <CheckCircle2 size={24} style={{ color: '#194e42' }} />
                )}
                <div>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: record.verificationStatus === 'REVOKED' ? '#e07050' : record.verificationStatus === 'FROZEN' ? '#9a6c00' : '#194e42'
                  }}>
                    {record.verificationStatus === 'REVOKED'
                      ? 'REVOKED RECORD ❌'
                      : record.verificationStatus === 'FROZEN'
                      ? 'VERIFIED & FROZEN 🔒'
                      : 'OFFICIALLY VERIFIED ✓'}
                  </div>
                  <div style={{ fontSize: 12, color: '#526668' }}>
                    Authentic Federation Result Record
                  </div>
                </div>
              </div>

              <div style={{
                background: '#fff',
                padding: '6px 14px',
                borderRadius: 10,
                border: '1px solid #d2dad2',
                fontFamily: 'monospace',
                fontSize: 13,
                fontWeight: 800,
                color: '#173235'
              }}>
                {record.officialRecordId}
              </div>
            </div>

            {/* Content Details */}
            <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: '#f8faf7', padding: 20, borderRadius: 14, border: '1px solid #e2eee4' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#697c7c' }}>Athlete Candidate</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#173235', marginTop: 2 }}>{record.athleteName}</div>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#194e42', marginTop: 2 }}>
                    Permanent ID: {record.athleteId}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#697c7c' }}>Issuing Federation</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#173235', marginTop: 2 }}>{record.federationName}</div>
                  <div style={{ fontSize: 12, color: '#526668', marginTop: 2 }}>
                    {record.federationState} Jurisdiction · {record.sport}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Award size={20} style={{ color: '#e07050' }} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#173235' }}>
                      {record.achievementType === 'medal' ? `${record.medal} Medal` : `Rank #${record.rank}`} — {record.tournamentName}
                    </div>
                    <div style={{ fontSize: 12, color: '#526668', marginTop: 2 }}>
                      Category: {record.category} · Year {record.year}
                    </div>
                  </div>
                </div>

                {record.description && (
                  <div style={{ fontSize: 13, color: '#526668', background: '#fcfcf8', padding: '12px 16px', borderRadius: 10, border: '1px solid #e2ede4', italic: 'true' }}>
                    "{record.description}"
                  </div>
                )}
              </div>

              {/* Certificate Attachment */}
              {record.hasCertificate && record.certificateData && (
                <div style={{ paddingTop: 16, borderTop: '1px solid #f0f4f0', display: 'flex', alignItems: 'center', justifyBetween: 'space-between', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FileText size={24} style={{ color: '#194e42' }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#173235' }}>{record.certificateFileName}</div>
                      <div style={{ fontSize: 11, color: '#697c7c' }}>Official Signed Federation Certificate PDF Document</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setViewPdf(!viewPdf)}
                    style={{
                      height: 38,
                      padding: '0 16px',
                      borderRadius: 10,
                      border: '1px solid #2f6d5a',
                      background: '#e2eee4',
                      color: '#194e42',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Eye size={14} /> {viewPdf ? 'Hide Document' : 'View Official Document'}
                  </button>
                </div>
              )}

              {/* PDF Viewer */}
              {viewPdf && record.certificateData && (
                <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #d8ded5', background: '#f4f8f5' }}>
                  <iframe
                    src={record.certificateData}
                    style={{ width: '100%', height: '500px', border: 'none' }}
                    title="Official Certificate Viewer"
                  />
                </div>
              )}

            </div>

            {/* Footer */}
            <div style={{ background: '#f8faf7', padding: '16px 28px', borderTop: '1px solid #e2eee4', fontSize: 11, color: '#8a9d9a', textAlign: 'center' }}>
              Official Record Issued on {new Date(record.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · Cryptographically Verified MongoDB Ledger
            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}
