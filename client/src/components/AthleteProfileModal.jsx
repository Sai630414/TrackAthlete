import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  MapPin,
  Trophy,
  PlayCircle,
  ExternalLink,
  Shield,
  MessageCircle,
  X,
  Check,
  Building,
  User,
  Calendar,
  Sparkles,
  ChevronRight,
  Clock
} from 'lucide-react';
import AthleteAchievementsTimeline from './AthleteAchievementsTimeline';

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11
    ? `https://www.youtube.com/embed/${match[2]}`
    : null;
}

export default function AthleteProfileModal({
  athlete,
  request,
  isOpen,
  onClose,
  onAccept,
  onReject,
  onOpenChat,
  isAlreadyConnected = false
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [rejectionNote, setRejectionNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || (!athlete && !request)) return null;

  const data = athlete || request?.athlete || {};
  const embedUrl = getYouTubeEmbedUrl(data.videoLink);

  const handleAcceptClick = async () => {
    if (!onAccept || !request?._id) return;
    setSubmitting(true);
    await onAccept(request._id);
    setSubmitting(false);
    onClose();
  };

  const handleRejectClick = async () => {
    if (!onReject || !request?._id) return;
    setSubmitting(true);
    await onReject(request._id, rejectionNote);
    setSubmitting(false);
    onClose();
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
        maxWidth: 720,
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
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              right: 20,
              top: 20,
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              borderRadius: 8,
              padding: '6px 8px',
              color: '#c5d3ce',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'background 0.2s'
            }}
          >
            <X size={16} />
          </button>

          {/* Top badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              borderRadius: 20,
              background: '#e2eee4',
              border: '1px solid #2f6d5a',
              fontSize: 11,
              fontWeight: 800,
              color: '#194e42'
            }}>
              <CheckCircle2 size={12} color="#cc694e" /> Verified Athlete Profile
            </span>
            <span style={{
              fontSize: 11,
              fontFamily: data.athleteId ? 'monospace' : 'inherit',
              color: data.athleteId ? '#c5d3ce' : '#8ea69d',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6,
              padding: '2px 8px'
            }}>
              ID: {data.athleteId || 'Not Linked'}
            </span>
            {isAlreadyConnected && (
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#b7da78',
                background: 'rgba(183,218,120,0.15)',
                border: '1px solid rgba(183,218,120,0.3)',
                borderRadius: 20,
                padding: '2px 10px'
              }}>
                ● Active Roster
              </span>
            )}
          </div>

          {/* Avatar and Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: '#e2eee4',
              border: '3px solid #2f6d5a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 24,
              color: '#194e42',
              flexShrink: 0
            }}>
              {data.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 500, margin: 0, lineHeight: 1.2 }}>
                {data.name} <em style={{ color: '#b9d9bf', fontStyle: 'italic' }}>Portfolio</em>
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 6, fontSize: 13, color: '#c5d3ce' }}>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(Array.isArray(data.sports) && data.sports.length > 0 ? data.sports : (data.sport ? [data.sport] : [])).map((sp, i) => (
                    <span key={i} style={{ fontWeight: 800, color: '#b9d9bf', background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase', fontSize: 11 }}>
                      [ {String(sp).toUpperCase()} ]
                    </span>
                  ))}
                </span>
                <span>·</span>
                <span>{data.beltRank || data.athleteLevel || 'Rank / Level'}</span>
                <span>·</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={13} color="#cc694e" /> {data.city || 'City'}, {data.state || 'State'}
                </span>
                {data.age && (
                  <>
                    <span>·</span>
                    <span>{data.age} Years</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            {[
              { id: 'overview', label: 'Profile Overview' },
              { id: 'tournaments', label: 'Achievements & Certificates' },
              { id: 'video', label: 'Sparring / Showcase Video' },
              ...(request?.message ? [{ id: 'message', label: 'Request Note' }] : [])
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: activeTab === tab.id ? '#e2eee4' : 'rgba(255,255,255,0.08)',
                  color: activeTab === tab.id ? '#194e42' : '#c5d3ce',
                  transition: 'all 0.2s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Federation Alert */}
              <div style={{
                background: '#f4f8f3',
                border: '1px solid #2f6d5a',
                borderRadius: 14,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12
              }}>
                <Shield size={20} color="#2f6d5a" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#194e42' }}>
                    National Sports Federation (NSF) Recognition
                  </div>
                  <div style={{ fontSize: 12, color: '#526668', marginTop: 2 }}>
                    This athlete's profile state is registered as <strong>{data.federationState || data.state || 'Andhra Pradesh'}</strong> with official NSF tournament participation pathway.
                  </div>
                </div>
              </div>

              {/* Key Attributes Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div style={{ background: '#fff', border: '1px solid #d8ded5', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#697c7c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Primary Discipline
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#173235', marginTop: 4 }}>
                    {data.sport || 'N/A'}
                  </div>
                  <div style={{ fontSize: 11, color: '#526668', marginTop: 2 }}>
                    Rank / Level: {data.beltRank || 'State Representative'}
                  </div>
                </div>

                <div style={{ background: '#fff', border: '1px solid #d8ded5', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#697c7c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Relocation Readiness
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: data.relocationFlexible !== false ? '#194e42' : '#526668', marginTop: 4 }}>
                    {data.relocationFlexible !== false ? '✓ Willing to Relocate' : 'Local Only'}
                  </div>
                  <div style={{ fontSize: 11, color: '#526668', marginTop: 2 }}>
                    For SAI NCOE / Residential training
                  </div>
                </div>

                <div style={{ background: '#fff', border: '1px solid #d8ded5', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#697c7c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Sponsorship Status
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: data.seekingSponsorship ? '#e07050' : '#526668', marginTop: 4 }}>
                    {data.seekingSponsorship ? 'Seeking CSR Support' : 'Self-Funded'}
                  </div>
                  <div style={{ fontSize: 11, color: '#526668', marginTop: 2 }}>
                    {data.sponsorshipReason || 'Verified athlete ledger'}
                  </div>
                </div>
              </div>

              {/* Achievements list */}
              {data.achievements?.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #d8ded5', borderRadius: 14, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#194e42', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Notable Achievements & Honors
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {data.achievements.map((ach, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#173235' }}>
                        <Trophy size={14} color="#cc694e" />
                        <span>{ach}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ACHIEVEMENTS & CERTIFICATES */}
          {activeTab === 'tournaments' && (
            <AthleteAchievementsTimeline
              athleteUserId={data?._id}
              athleteName={data?.name}
              isCoachView={true}
              isOwner={false}
            />
          )}

          {/* TAB 3: VIDEO SHOWCASE */}
          {activeTab === 'video' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {embedUrl ? (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#194e42', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PlayCircle size={15} color="#cc694e" /> Embedded Performance Reel
                  </div>
                  <div style={{
                    aspectRatio: '16/9', width: '100%', borderRadius: 16, overflow: 'hidden',
                    border: '1px solid #2f6d5a', background: '#000', boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                  }}>
                    <iframe
                      src={embedUrl}
                      title="Athlete Performance Video"
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              ) : data.videoLink ? (
                <div style={{
                  padding: 16, background: '#e2eee4', borderRadius: 14, border: '1px solid #2f6d5a',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#194e42' }}>Direct Video Link Provided</div>
                    <div style={{ fontSize: 12, color: '#526668', marginTop: 2 }}>{data.videoLink}</div>
                  </div>
                  <a
                    href={data.videoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                      borderRadius: 10, background: '#194e42', color: '#fff', fontSize: 12,
                      fontWeight: 700, textDecoration: 'none'
                    }}
                  >
                    <ExternalLink size={13} /> Open Video
                  </a>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '36px 16px', background: '#f8faf7', borderRadius: 14, border: '1px dashed #d8ded5' }}>
                  <PlayCircle size={32} color="#8a9d9a" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#173235' }}>No Video Reel Added</div>
                  <div style={{ fontSize: 12, color: '#697c7c', marginTop: 4 }}>
                    Athlete has not linked sparring or training match footage yet.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MENTORSHIP MESSAGE */}
          {(activeTab === 'message' || request?.message) && (
            <div style={{
              background: '#fefdf5',
              border: '1px solid #f0d060',
              borderRadius: 14,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#9a6c00', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Personal Note from Athlete
                </span>
                {request?.createdAt && (
                  <span style={{ fontSize: 11, color: '#8a9d9a', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} /> {new Date(request.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 14, color: '#173235', fontStyle: 'italic', margin: 0, lineHeight: 1.6 }}>
                "{request?.message || 'Hi Coach, I am looking for your technical mentorship and training guidance.'}"
              </p>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div style={{
          padding: '16px 28px',
          background: '#ffffff',
          borderTop: '1px solid #e2ede4',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          {showRejectInput ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#173235' }}>
                Reason for declining (optional feedback for athlete):
              </label>
              <input
                type="text"
                value={rejectionNote}
                onChange={e => setRejectionNote(e.target.value)}
                placeholder="e.g. Academy currently full / category not matching..."
                style={{
                  height: 38, border: '1px solid #d2dad2', borderRadius: 8,
                  padding: '0 12px', fontSize: 13, background: '#f9faf8', outline: 'none'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowRejectInput(false)}
                  style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid #d8ded5', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRejectClick}
                  disabled={submitting}
                  style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#e05050', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                >
                  Confirm Decline
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, color: '#697c7c' }}>
                {isAlreadyConnected
                  ? 'Connected Athlete on your roster'
                  : 'Review profile thoroughly before accepting mentorship'}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isAlreadyConnected ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onOpenChat) onOpenChat();
                      }}
                      style={{
                        height: 42, padding: '0 20px', borderRadius: 10,
                        border: 'none', background: '#173d3c', color: '#b9d9bf',
                        fontSize: 12, fontWeight: 800, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6
                      }}
                    >
                      <MessageCircle size={15} /> Open Chat
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      style={{
                        height: 42, padding: '0 18px', borderRadius: 10,
                        border: '1px solid #d8ded5', background: '#fff',
                        color: '#526668', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      Close
                    </button>
                  </>
                ) : onAccept ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowRejectInput(true)}
                      style={{
                        height: 42, padding: '0 16px', borderRadius: 10,
                        border: '1px solid #e0705040', background: '#fff5f2',
                        color: '#c85c40', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6
                      }}
                    >
                      <X size={14} /> Decline Request
                    </button>
                    <button
                      type="button"
                      onClick={handleAcceptClick}
                      disabled={submitting}
                      style={{
                        height: 42, padding: '0 24px', borderRadius: 10,
                        border: 'none', background: '#e07050', color: '#ffffff',
                        fontSize: 12, fontWeight: 800, textTransform: 'uppercase',
                        letterSpacing: '0.04em', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                        boxShadow: '0 4px 14px rgba(224,112,80,0.35)'
                      }}
                    >
                      <Check size={16} /> {submitting ? 'Accepting…' : 'Accept Connection'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      height: 40, padding: '0 18px', borderRadius: 10,
                      border: '1px solid #d8ded5', background: '#fff',
                      color: '#526668', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
