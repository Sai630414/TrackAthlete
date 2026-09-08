import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Label, Textarea, useToast,
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '../components/ui';
import ChatPanel from '../components/ChatPanel';
import AthleteProfileModal from '../components/AthleteProfileModal';
import FederationListsSection from '../components/FederationListsSection';
import CoachAcademyOpeningsSection from '../components/CoachAcademyOpeningsSection';
import OrganizedEventsSection from '../components/OrganizedEventsSection';
import {
  UserCheck, Check, X, Plus, Award, Users, BookOpen,
  Clock, ExternalLink, Trophy, MapPin, MessageCircle, FileText,
  ChevronDown, Inbox, User, Eye, Briefcase, Calendar
} from 'lucide-react';

export default function CoachDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { socket, notifCount, clearNotifs, unreadByConnection, totalUnreadMessages, openChatForConnection, closeChat } = useSocket();

  const [requests, setRequests] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedAthleteProfile, setSelectedAthleteProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('inbox');
  const [myOrganizedData, setMyOrganizedData] = useState(null);

  // My Athletes — note form state
  const [noteConnectionId, setNoteConnectionId] = useState('');
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [expandedAthleteId, setExpandedAthleteId] = useState(null);
  const [chatConnectionId, setChatConnectionId] = useState(null);
  const [chatOtherName, setChatOtherName] = useState('');

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchRequests = useCallback(() => {
    if (!user?._id) return;
    api.get(`/coach/${user._id}/requests`)
      .then(res => setRequests(res.data || []))
      .catch(() => setRequests([]));
  }, [user?._id]);

  const fetchAthletes = useCallback(() => {
    if (!user?._id) return;
    api.get(`/coach/${user._id}/athletes`)
      .then(res => setAthletes(res.data || []))
      .catch(() => setAthletes([]));
  }, [user?._id]);

  useEffect(() => {
    fetchRequests();
    fetchAthletes();
    api.get('/organizer-events/my-organized-events')
      .then(res => setMyOrganizedData(res.data))
      .catch(() => setMyOrganizedData(null));
  }, [fetchRequests, fetchAthletes]);

  // ── Socket.IO — live incoming requests ─────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handleNewRequest = () => fetchRequests();
    socket.on('connection-request', handleNewRequest);
    return () => socket.off('connection-request', handleNewRequest);
  }, [socket, fetchRequests]);

  // ── Tab change: clear badge when opening inbox ──────────────────────────────
  const handleTabChange = (val) => {
    setActiveTab(val);
    if (val === 'inbox') clearNotifs();
  };

  // ── Accept / Reject ────────────────────────────────────────────────────────
  const handleAccept = async (connectionId) => {
    try {
      await api.put(`/coach/requests/${connectionId}`, { status: 'Active' });
      toast({ title: 'Connection Accepted! 🎉', description: 'Athlete has been added to your active roster.', variant: 'success' });
      fetchRequests();
      fetchAthletes();
    } catch {
      toast({ title: 'Error', description: 'Failed to accept request.', variant: 'destructive' });
    }
  };

  const handleReject = async (connectionId, rejectionNote) => {
    try {
      await api.put(`/coach/requests/${connectionId}`, { status: 'Rejected', rejectionNote });
      toast({ title: 'Request Declined', description: 'Athlete has been notified.', variant: 'destructive' });
      fetchRequests();
    } catch {
      toast({ title: 'Error', description: 'Failed to decline request.', variant: 'destructive' });
    }
  };

  // ── Save session note ──────────────────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!noteConnectionId || !noteText.trim()) {
      toast({ title: 'Missing fields', description: 'Please select an athlete and enter a note.', variant: 'destructive' });
      return;
    }
    setSavingNote(true);
    try {
      await api.post(`/coach/${user._id}/athletes/${noteConnectionId}/notes`, { note: noteText.trim() });
      toast({ title: 'Session Note Saved', description: 'Note added to athlete history.', variant: 'success' });
      setNoteText('');
      fetchAthletes(); // refresh notes
    } catch {
      toast({ title: 'Error', description: 'Failed to save note.', variant: 'destructive' });
    } finally {
      setSavingNote(false);
    }
  };

  // ── Download or View Certificate ─────────────────────────────────────────
  const handleDownloadCertificate = () => {
    if (user?.certificateData) {
      const link = document.createElement('a');
      link.href = user.certificateData;
      link.download = user.certificateFileName || `${user.name || 'Coach'}_Certificate.pdf`;
      link.click();
    } else if (user?._id || user?.coachId) {
      api.get(`/coach/${user._id || user.coachId}/certificate`)
        .then(res => {
          if (res.data?.certificateData) {
            const link = document.createElement('a');
            link.href = res.data.certificateData;
            link.download = res.data.certificateFileName || `${user.name || 'Coach'}_Certificate.pdf`;
            link.click();
          } else {
            toast({ title: 'Certificate Not Found', description: 'No certificate file is on record.', variant: 'destructive' });
          }
        })
        .catch(() => {
          toast({ title: 'Certificate Not Found', description: 'Could not load certificate.', variant: 'destructive' });
        });
    }
  };

  // ── Open chat ───────────────────────────────────────────────────────────────
  const openChat = (conn) => {
    openChatForConnection(conn._id);
    setChatConnectionId(conn._id);
    setChatOtherName(conn.athlete?.name || 'Athlete');
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#173d3c] via-[#123130] to-[#0c292c] border border-[#2f6d5a] p-5 sm:p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white shadow-md">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
              <UserCheck className="w-3.5 h-3.5 text-[#cc694e]" /> Certified Coach
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono text-[#c5d3ce] border border-white/20">
              ID: {user?.coachId || user?.trackAthleteId || 'COA-N/A'}
            </span>
            {user?.acceptingAthletes !== false ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
                Accepting Athletes
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-white/20 text-[#c5d3ce] border border-white/20">
                Not Accepting Athletes
              </span>
            )}
            {user?.certifications?.[0] && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono text-[#c5d3ce] border border-white/20">
                {user.certifications[0]}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-normal text-white" style={{ fontFamily: 'Georgia, serif' }}>
            Coach <em style={{ color: '#b9d9bf', fontStyle: 'italic', textTransform: 'capitalize' }}>{user?.name || 'Desk'}</em>
          </h1>
          <p className="text-xs text-[#c5d3ce]">
            Sports: <strong>{user?.sports && user.sports.length > 0 ? user.sports.join(', ') : (user?.sport || 'Sports')}</strong> · {user?.city || 'India'}, {user?.state || ''} {user?.mobile || user?.phone ? `· Mobile: ${user.mobile || user.phone}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
            <Award className="w-3.5 h-3.5 mr-1.5 text-[#cc694e]" /> {user?.yearsExperience || 0}+ Yrs
          </span>
          <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
            <Users className="w-3.5 h-3.5 mr-1.5 text-[#cc694e]" /> {athletes.length} Athletes
          </span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="inbox">
            <Inbox className="w-4 h-4 mr-1.5" />
            Request Inbox
            {notifCount > 0 && (
              <span style={{ marginLeft: 6, minWidth: 18, height: 18, borderRadius: 9, background: '#e07050', color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                {notifCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="athletes">
            <UserCheck className="w-4 h-4 mr-1.5" /> My Athletes ({athletes.length})
            {totalUnreadMessages > 0 && (
              <span style={{ marginLeft: 6, minWidth: 18, height: 18, borderRadius: 9, background: '#e07050', color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                {totalUnreadMessages}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-1.5" /> Coach Profile
          </TabsTrigger>
          <TabsTrigger value="notes">
            <BookOpen className="w-4 h-4 mr-1.5" /> Session Notes
          </TabsTrigger>
          <TabsTrigger value="openings">
            <Briefcase className="w-4 h-4 mr-1.5" /> Academy Openings
          </TabsTrigger>
          <TabsTrigger value="federation-lists">
            <FileText className="w-4 h-4 mr-1.5" /> Federation Lists
          </TabsTrigger>
          {myOrganizedData?.hasLinkedOrganizer && (
            <TabsTrigger value="organized-events">
              <Calendar className="w-4 h-4 mr-1.5 text-[#cc694e]" /> Organized Events ({myOrganizedData.events?.length || 0})
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── INBOX ─────────────────────────────────────────────────── */}
        <TabsContent value="inbox" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mentorship Request Inbox</CardTitle>
              <CardDescription>
                Review incoming athlete mentorship requests. Click any card to inspect their complete tournament portfolio, video reel, and state recognition.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <Inbox size={40} className="text-[#8a9d9a]" />
                  <p className="text-sm font-bold text-[#173235]">No Pending Requests</p>
                  <p className="text-xs text-[#697c7c]">When athletes in your sport send a mentorship request, they will appear here in real-time.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {requests.map(req => {
                    const athlete = req.athlete || {};
                    return (
                      <div
                        key={req._id}
                        onClick={() => setSelectedRequest(req)}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-[#d8ded5] bg-white shadow-xs cursor-pointer hover:border-[#2f6d5a] hover:bg-[#f4f8f3] transition-all gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div style={{
                            width: 44, height: 44, borderRadius: '50%',
                            background: '#e2eee4', border: '2px solid #2f6d5a',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: 16, color: '#194e42', flexShrink: 0
                          }}>
                            {athlete.name?.charAt(0)?.toUpperCase() || 'A'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#173235] text-sm">{athlete.name}</span>
                              <span className="text-[10px] font-mono bg-[#e2eee4] text-[#194e42] px-2 py-0.2 rounded-md border border-[#2f6d5a]/30">
                                {athlete.sport || 'Sport'}
                              </span>
                            </div>
                            <div className="text-xs text-[#526668] mt-0.5">
                              {athlete.beltRank || 'Athlete'} · {athlete.city || 'Vijayawada'}, {athlete.state || 'Andhra Pradesh'}
                            </div>
                            {req.message && (
                              <div className="text-xs text-[#697c7c] italic mt-1 truncate max-w-md">
                                "{req.message}"
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <span className="text-xs text-[#697c7c] hidden md:block">
                            {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                          <Badge variant="outline" className="text-xs bg-[#fef9e7] text-[#9a6c00] border-[#f0d060]">
                            Pending
                          </Badge>
                          <span className="text-xs font-bold text-[#194e42] bg-[#e2eee4] hover:bg-[#d4e6d7] px-3.5 py-1.5 rounded-lg border border-[#2f6d5a]/40 flex items-center gap-1.5 transition">
                            <Eye size={13} /> View Full Profile
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── MY ATHLETES ───────────────────────────────────────────── */}
        <TabsContent value="athletes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Athlete Roster</CardTitle>
              <CardDescription>Athletes currently undergoing structured mentorship and technical evaluations with you</CardDescription>
            </CardHeader>
            <CardContent>
              {athletes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <Users size={40} className="text-[#8a9d9a]" />
                  <p className="text-sm font-bold text-[#173235]">No Active Athletes Yet</p>
                  <p className="text-xs text-[#697c7c]">Accept mentorship requests from the inbox to build your athlete roster.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {athletes.map(conn => {
                    const athlete = conn.athlete || {};
                    const isExpanded = expandedAthleteId === conn._id;
                    return (
                      <div key={conn._id} className="rounded-xl border border-[#d8ded5] bg-white overflow-hidden shadow-xs hover:border-[#2f6d5a]/50 transition">
                        {/* Athlete card header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3">
                          <div className="flex items-center gap-3">
                            <div style={{
                              width: 44, height: 44, borderRadius: '50%',
                              background: '#e2eee4', border: '2px solid #2f6d5a',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 800, fontSize: 16, color: '#194e42', flexShrink: 0
                            }}>
                              {athlete.name?.charAt(0)?.toUpperCase() || 'A'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[#173235] text-sm">{athlete.name}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
                                  Active Mentee
                                </span>
                              </div>
                              <div className="text-xs text-[#526668] mt-0.5">
                                {athlete.sport || 'Sport'} · {athlete.beltRank || 'Athlete'} · {athlete.city || 'India'}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                            <button
                              onClick={() => setSelectedAthleteProfile(conn)}
                              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold bg-[#f4f8f3] text-[#194e42] border border-[#d8ded5] hover:bg-[#e2eee4] transition cursor-pointer"
                            >
                              <Eye size={13} /> Portfolio
                            </button>
                            <button
                              onClick={() => openChat(conn)}
                              className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-bold bg-[#173d3c] text-[#b9d9bf] border border-[#2f6d5a] hover:bg-[#0c292c] transition cursor-pointer shadow-xs"
                            >
                              <MessageCircle size={13} /> Chat
                              {unreadByConnection[conn._id] > 0 && (
                                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-[#e07050] text-white">
                                  {unreadByConnection[conn._id]}
                                </span>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setExpandedAthleteId(isExpanded ? null : conn._id);
                                setNoteConnectionId(conn._id);
                              }}
                              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]/40 hover:bg-[#d4e6d7] transition cursor-pointer"
                            >
                              <FileText size={13} /> Notes ({conn.sessionNotes?.length || 0})
                              <ChevronDown size={12} style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
                            </button>
                          </div>
                        </div>

                        {/* Expanded: Session notes + add note */}
                        {isExpanded && (
                          <div className="border-t border-[#e8ede6] bg-[#f9faf8] p-4 space-y-4">
                            {/* Notes history */}
                            <div>
                              <div className="text-[11px] font-extrabold text-[#194e42] uppercase tracking-wider mb-2">
                                Session Notes & Evaluation History
                              </div>
                              {conn.sessionNotes?.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                  {[...conn.sessionNotes].reverse().map((note, i) => (
                                    <div key={i} className="flex gap-3 p-3 rounded-lg bg-white border border-[#e2ede4] shadow-2xs">
                                      <div className="flex-shrink-0 mt-0.5">
                                        <Clock size={13} className="text-[#cc694e]" />
                                      </div>
                                      <div>
                                        <div className="text-[11px] font-bold text-[#697c7c] mb-1 font-mono">
                                          {new Date(note.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                        <div className="text-xs text-[#173235] leading-relaxed">{note.note}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-[#697c7c] p-3 bg-white border border-[#e2ede4] rounded-lg">
                                  No session notes logged yet.
                                </div>
                              )}
                            </div>

                            {/* Add new note */}
                            <div className="pt-2 border-t border-[#e8ede6]">
                              <div className="text-[11px] font-extrabold text-[#194e42] uppercase tracking-wider mb-2">
                                Log New Tactical / Technical Assessment Note
                              </div>
                              <div className="flex gap-2 items-start">
                                <div className="flex-shrink-0 text-xs text-[#697c7c] pt-2 font-mono">
                                  {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </div>
                                <textarea
                                  value={noteConnectionId === conn._id ? noteText : ''}
                                  onChange={e => { setNoteConnectionId(conn._id); setNoteText(e.target.value); }}
                                  placeholder="Enter session observations, drill scores, smash accuracy %, tactical adjustments…"
                                  rows={3}
                                  style={{
                                    flex: 1, border: '1px solid #d8ded5', borderRadius: 8,
                                    padding: '8px 12px', fontSize: 12, background: '#fff',
                                    color: '#1d2c31', outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                                  }}
                                />
                              </div>
                              <div className="flex justify-end mt-2">
                                <button
                                  onClick={handleSaveNote}
                                  disabled={savingNote || !noteText.trim() || noteConnectionId !== conn._id}
                                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-xs transition"
                                >
                                  <Plus size={13} /> {savingNote ? 'Saving…' : 'Save Session Note'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── COACH PROFILE TAB ────────────────────────────────────────── */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle>Coach Profile &amp; Credentials</CardTitle>
                  <CardDescription>
                    Official accredited coach profile stored on TrackAthlete.
                  </CardDescription>
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a] self-start">
                  Permanent ID: {user?.coachId || user?.trackAthleteId || 'COA-N/A'}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Section 1: Personal & Contact Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-xl bg-[#f4f8f3] border border-[#d8ded5]">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#526668] block">Coach Full Name</span>
                  <span className="text-sm font-bold text-[#173235]">{user?.name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#526668] block">Mobile Number</span>
                  <span className="text-sm font-bold text-[#173235]">{user?.mobile || user?.phone || 'Not Provided'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#526668] block">City &amp; State</span>
                  <span className="text-sm font-bold text-[#173235]">{user?.city || 'India'}, {user?.state || ''}</span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#526668] block">Email Address</span>
                  <span className="text-sm font-bold text-[#173235]">{user?.email || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#526668] block">Years of Experience</span>
                  <span className="text-sm font-bold text-[#173235]">{user?.yearsExperience ? `${user.yearsExperience} Years` : '0 Years'}</span>
                </div>
                {user?.nisId && (
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#526668] block">NIS ID</span>
                    <span className="text-sm font-mono font-bold text-[#194e42]">{user.nisId}</span>
                  </div>
                )}
              </div>

              {/* Section 2: Sports Coached */}
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#173235] block mb-2">
                  Sports Coached
                </span>
                <div className="flex flex-wrap gap-2">
                  {user?.sports && user.sports.length > 0 ? (
                    user.sports.map(sp => (
                      <span
                        key={sp}
                        className="px-3 py-1 rounded-lg text-xs font-extrabold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a] tracking-wider uppercase"
                      >
                        {sp}
                      </span>
                    ))
                  ) : user?.sport ? (
                    <span className="px-3 py-1 rounded-lg text-xs font-extrabold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a] tracking-wider uppercase">
                      {user.sport}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500 italic">No sports recorded.</span>
                  )}
                </div>
              </div>

              {/* Section 3: Certifications & Combined Certificate PDF */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-[#d8ded5] bg-white space-y-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#173235] block">
                    Accreditations &amp; Certifications
                  </span>
                  {user?.certifications && user.certifications.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {user.certifications.map((c, i) => (
                        <span key={i} className="text-xs bg-[#f4f8f3] text-[#194e42] px-2.5 py-1 rounded-md border border-[#d8ded5] font-semibold">
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">No certifications listed.</p>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-[#d8ded5] bg-white space-y-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#173235] block">
                    Combined Coaching Certificate PDF
                  </span>
                  {(user?.certificateData || user?.certificateFileName || user?.hasCertificate) ? (
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#e2eee4] border border-[#2f6d5a]">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#194e42] truncate">
                        <FileText className="w-4 h-4 text-[#cc694e] shrink-0" />
                        <span className="truncate">{user?.certificateFileName || `${user?.name || 'Coach'}_Certificate.pdf`}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadCertificate}
                        className="px-2.5 py-1 rounded bg-[#2f6d5a] hover:bg-[#194e42] text-white text-[11px] font-bold shrink-0 cursor-pointer transition"
                      >
                        View / Download
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">No certificate PDF on record.</p>
                  )}
                </div>
              </div>

              {/* Section 4: Bio / About */}
              {user?.bio && (
                <div className="p-4 rounded-xl border border-[#d8ded5] bg-white space-y-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#173235] block">
                    About / Coaching Bio
                  </span>
                  <p className="text-xs text-[#526668] leading-relaxed whitespace-pre-line">
                    {user.bio}
                  </p>
                </div>
              )}

              {/* Section 5: Availability & Preferences */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-[#f4f8f3] border border-[#d8ded5] text-xs">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#526668] block mb-1">
                    Accepting New Athletes
                  </span>
                  <span className={`inline-flex px-2 py-0.5 rounded font-bold text-[11px] ${
                    user?.acceptingAthletes !== false ? 'bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {user?.acceptingAthletes !== false ? 'YES — Accepting' : 'NO — Busy'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#526668] block mb-1">
                    Coaching Preferences
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {user?.coachingPreferences && user.coachingPreferences.length > 0 ? (
                      user.coachingPreferences.map(p => (
                        <span key={p} className="px-1.5 py-0.5 rounded bg-white text-[#194e42] border border-[#d8ded5] text-[10px] font-bold">
                          {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500">INDIVIDUAL</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#526668] block mb-1">
                    Willing With Academies
                  </span>
                  <span className={`inline-flex px-2 py-0.5 rounded font-bold text-[11px] ${
                    user?.willingToWorkWithAcademies !== false ? 'bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {user?.willingToWorkWithAcademies !== false ? 'YES — Open to Academies' : 'NO — Independent Only'}
                  </span>
                </div>

                {user?.coachingLevels && user.coachingLevels.length > 0 && (
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#526668] block mb-1">
                      Coaching Levels
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {user.coachingLevels.map(lvl => (
                        <span key={lvl} className="px-1.5 py-0.5 rounded bg-white text-[#173235] border border-[#d8ded5] text-[10px] font-bold">
                          {lvl}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {user?.willingToWorkWithAcademies !== false && user?.preferredWorkTypes && user.preferredWorkTypes.length > 0 && (
                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#526668] block mb-1">
                      Preferred Work Types
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {user.preferredWorkTypes.map(wt => (
                        <span key={wt} className="px-2 py-0.5 rounded bg-white text-[#194e42] border border-[#d8ded5] text-[10px] font-bold">
                          {wt}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SESSION NOTES ─────────────────────────────────────────── */}
        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Log Athlete Session Note</CardTitle>
              <CardDescription>Record tactical feedback, biomechanics notes, and physical endurance scores</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label required>Select Athlete</Label>
                <select
                  value={noteConnectionId}
                  onChange={e => setNoteConnectionId(e.target.value)}
                  style={{
                    marginTop: 6, width: '100%', height: 42,
                    border: '1px solid #d2dad2', borderRadius: 8,
                    padding: '0 12px', fontSize: 13, background: '#fffefa',
                    color: noteConnectionId ? '#1d2c31' : '#80908e', outline: 'none',
                  }}
                >
                  <option value="">— Select an athlete from roster —</option>
                  {athletes.map(conn => (
                    <option key={conn._id} value={conn._id}>{conn.athlete?.name} ({conn.athlete?.sport || 'Athlete'})</option>
                  ))}
                </select>
                {athletes.length === 0 && (
                  <p className="text-xs text-[#697c7c] mt-2">No active athletes yet. Accept requests from the inbox first.</p>
                )}
              </div>

              <div>
                <Label required>
                  Session Date: <span className="text-[#cc694e] font-mono">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </Label>
              </div>

              <div>
                <Label required>Technical Assessment & Session Notes</Label>
                <Textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Enter footwork agility scores, technique corrections, smash accuracy %, tactical drills…"
                  className="mt-1 min-h-[140px]"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={savingNote || !noteConnectionId || !noteText.trim()}
                  className="flex items-center justify-center gap-1.5 h-10 px-5 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white font-extrabold text-xs uppercase tracking-wider transition shadow-md cursor-pointer"
                >
                  <Plus className="w-4 h-4 mr-1" /> {savingNote ? 'Saving…' : 'Save Session Note'}
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="openings" className="space-y-4">
          <CoachAcademyOpeningsSection
            coachSport={user?.sport}
            coachSports={user?.sports || (user?.sport ? [user?.sport] : [])}
            willingToWorkWithAcademies={user?.willingToWorkWithAcademies !== false}
            defaultCertificate={user?.certificateData ? { certificateData: user.certificateData, certificateFileName: user.certificateFileName } : null}
          />
        </TabsContent>

        <TabsContent value="federation-lists" className="space-y-4">
          <FederationListsSection />
        </TabsContent>

        {myOrganizedData?.hasLinkedOrganizer && (
          <TabsContent value="organized-events" className="space-y-4">
            <OrganizedEventsSection initialData={myOrganizedData} />
          </TabsContent>
        )}
      </Tabs>

      {/* RICH ATHLETE PROFILE MODAL (From Request Inbox) */}
      {selectedRequest && (
        <AthleteProfileModal
          request={selectedRequest}
          isOpen={Boolean(selectedRequest)}
          onClose={() => setSelectedRequest(null)}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}

      {/* ATHLETE PORTFOLIO MODAL (From Active Roster) */}
      {selectedAthleteProfile && (
        <AthleteProfileModal
          athlete={selectedAthleteProfile.athlete}
          request={selectedAthleteProfile}
          isAlreadyConnected={true}
          isOpen={Boolean(selectedAthleteProfile)}
          onClose={() => setSelectedAthleteProfile(null)}
          onOpenChat={() => openChat(selectedAthleteProfile)}
        />
      )}

      {/* CLEAN FLOATING CHAT DIALOG */}
      {chatConnectionId && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 440,
          maxWidth: 'calc(100vw - 32px)',
          zIndex: 50,
        }}>
          <ChatPanel
            connectionId={chatConnectionId}
            otherPersonName={chatOtherName}
            onClose={() => {
              setChatConnectionId(null);
              closeChat();
            }}
          />
        </div>
      )}
    </div>
  );
}
