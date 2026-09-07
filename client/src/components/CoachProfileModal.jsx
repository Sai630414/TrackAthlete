import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  MapPin,
  FileText,
  Mail,
  Phone,
  X,
  Check,
  Building,
  User,
  Calendar,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Clock
} from 'lucide-react';

export default function CoachProfileModal({
  coach,
  request,
  isOpen,
  onClose,
  onAccept,
  onReject
}) {
  const [showPdf, setShowPdf] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || (!coach && !request)) return null;

  const data = coach || request?.coachUserId || {};
  const coachName = data.name || request?.name || 'Coach';
  const coachId = data.coachId || request?.coachId || null;
  const nisId = data.nisId || request?.nisId || null;
  const sportName = data.sport || request?.sportName || 'Sports';
  const certData = request?.certificateData || data.certificateData || null;
  const certFileName = request?.certificateFileName || data.certificateFileName || 'Coach_Certificate.pdf';

  const handleAcceptClick = async () => {
    if (!onAccept || !request?._id) return;
    setSubmitting(true);
    try {
      await onAccept(request._id);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectClick = async () => {
    if (!onReject || !request?._id) return;
    setSubmitting(true);
    try {
      await onReject(request._id);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(12, 41, 44, 0.72)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 60,
      padding: '16px'
    }}>
      <div style={{
        background: '#fcfcf8',
        borderRadius: 24,
        border: '1px solid #2f6d5a',
        width: '100%',
        maxWidth: 680,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 32px 72px rgba(0,0,0,0.35)',
        overflow: 'hidden'
      }}>
        {/* Hero Header */}
        <div style={{
          background: 'linear-gradient(135deg, #173d3c, #103332, #0c292c)',
          padding: '24px 28px',
          color: '#fff',
          position: 'relative',
          borderBottom: '1px solid #2f6d5a'
        }}>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 18,
              right: 18,
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c5d3ce',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            <X size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #2f6d5a, #1a4d3e)',
              border: '2px solid #b9d9bf',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 'bold',
              color: '#fff',
              flexShrink: 0
            }}>
              {coachName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{
                  fontSize: 22,
                  fontFamily: 'Georgia, serif',
                  fontWeight: 600,
                  margin: 0,
                  color: '#fff'
                }}>
                  {coachName}
                </h2>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: '#2f6d5a',
                  color: '#e2eee4',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  {sportName}
                </span>
                {coachId ? (
                  <span style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.15)',
                    color: '#c5d3ce'
                  }}>
                    {coachId}
                  </span>
                ) : (
                  <span style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.08)',
                    color: '#8ea69d'
                  }}>
                    Not Linked
                  </span>
                )}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#c5d3ce', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>NIS ID: <strong style={{ color: '#fff' }}>{nisId || '—'}</strong></span>
                {data.city && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={12} color="#e9a68e" /> {data.city}, {data.state || 'India'}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div style={{
              background: '#f4f6f4',
              borderRadius: 12,
              padding: '14px 16px',
              border: '1px solid #dce4de'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#526668', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Award size={14} color="#2f6d5a" /> Experience
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#173235' }}>
                {data.yearsExperience ? `${data.yearsExperience} Years Coaching` : 'Senior Coach'}
              </div>
            </div>

            <div style={{
              background: '#f4f6f4',
              borderRadius: 12,
              padding: '14px 16px',
              border: '1px solid #dce4de'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#526668', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={14} color="#2f6d5a" /> NIS Credential
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#173235' }}>
                {nisId ? `NIS ID: ${nisId}` : 'Not Specified'}
              </div>
            </div>

            {request?.salary && (
              <div style={{
                background: '#f4f6f4',
                borderRadius: 12,
                padding: '14px 16px',
                border: '1px solid #dce4de'
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#526668', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} color="#2f6d5a" /> Expected Terms
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#173235' }}>
                  {request.salary}
                </div>
              </div>
            )}
          </div>

          {/* Contact Details */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#173235', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Contact Information
            </h4>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, color: '#526668' }}>
              {data.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Mail size={14} color="#2f6d5a" /> {data.email}
                </div>
              )}
              {(data.phone || request?.mobile) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={14} color="#2f6d5a" /> {data.phone || request?.mobile}
                </div>
              )}
            </div>
          </div>

          {/* Bio / Background */}
          {data.bio && (
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#173235', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Coaching Profile & Philosophy
              </h4>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: '#334155', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px' }}>
                {data.bio}
              </p>
            </div>
          )}

          {/* Certifications and Documents */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#173235', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Certifications & Documents
            </h4>
            {certData ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'between',
                background: '#eef6f2',
                border: '1px solid #b9d9bf',
                borderRadius: 12,
                padding: '12px 16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={20} color="#2f6d5a" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#173235' }}>
                      {certFileName}
                    </div>
                    <div style={{ fontSize: 11, color: '#526668' }}>Verified Certificate PDF</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPdf(!showPdf)}
                  style={{
                    marginLeft: 'auto',
                    padding: '6px 14px',
                    borderRadius: 8,
                    background: '#2f6d5a',
                    color: '#fff',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {showPdf ? 'Hide Preview' : 'Preview Certificate'}
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#8ea69d', fontStyle: 'italic' }}>
                No uploaded certificate document attached.
              </div>
            )}

            {/* Embedded PDF Preview */}
            {showPdf && certData && (
              <div style={{ marginTop: 14, border: '1px solid #2f6d5a', borderRadius: 12, overflow: 'hidden', height: 350 }}>
                <iframe
                  src={certData}
                  title="Certificate Preview"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer / Actions */}
        <div style={{
          padding: '16px 28px',
          background: '#f4f6f4',
          borderTop: '1px solid #dce4de',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12
        }}>
          {onAccept && request ? (
            <>
              <button
                type="button"
                onClick={handleRejectClick}
                disabled={submitting}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#64748b',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Reject Application
              </button>
              <button
                type="button"
                onClick={handleAcceptClick}
                disabled={submitting}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#2f6d5a',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Check size={16} /> Accept Coach
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#334155',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
