import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Input,
  Label,
  Switch,
  ProgressChart,
  Alert,
  AlertTitle,
  AlertDescription,
  useToast,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import ChatPanel from '../components/ChatPanel';
import FederationVerifiedSection from '../components/FederationVerifiedSection';
import OfficialTournamentsSection, { TeamRegistrationModal } from '../components/OfficialTournamentsSection';
import FederationListsSection from '../components/FederationListsSection';
import AthleteAcademiesSection from '../components/AthleteAcademiesSection';
import OrganizedEventsSection from '../components/OrganizedEventsSection';
import ErrorBoundary from '../components/ErrorBoundary';
import {
  Shield,
  User,
  Building2,
  MapPin,
  Award,
  CheckCircle2,
  Search,
  Send,
  Sparkles,
  Users,
  MessageCircle,
  Clock,
  BookOpen,
  ChevronDown,
  UserCheck,
  Trophy,
  Plus,
  Trash2,
  PlayCircle,
  ExternalLink,
  Calendar,
  X,
  Eye,
  FileText,
  RefreshCw,
  Download
} from 'lucide-react';

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11
    ? `https://www.youtube.com/embed/${match[2]}`
    : null;
}

function MyEventRegistrations() {
  const { user } = useAuth() || {};
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState('');
  const [manageTeamModal, setManageTeamModal] = useState(null);

  const loadRegs = () => {
    setLoading(true);
    api.get('/organizer-events/my/registrations')
      .then(({ data }) => setRegistrations(data.registrations || []))
      .catch(() => setRegistrations([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRegs();
  }, []);

  const handleCancelRequest = async (teamId) => {
    if (!teamId) return;
    setActionBusy(teamId);
    try {
      await api.post(`/organizer-events/teams/${teamId}/join-requests/cancel`);
      loadRegs();
    } catch {
      // Ignore
    } finally {
      setActionBusy('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Event Registrations</CardTitle>
        <CardDescription>Event registrations, team memberships and join-request outcomes.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-[#526668]">Loading registrations…</p>
        ) : registrations.length === 0 ? (
          <p className="text-sm text-[#526668]">You have no event registrations yet.</p>
        ) : (
          <div className="space-y-3">
            {registrations.map(r => {
              const sport = r.event?.sports?.find(s => String(s._id) === String(r.sportConfigId));
              const isOrg = !r.source || r.source === 'organizer';
              const isPendingJoin = r.status === 'join_request_pending';
              const isTeam = r.type === 'team' && r.team;
              const confirmedMembers = (r.team?.members?.filter(m => m.status === 'confirmed').length || 0) + (r.team?.manualPlayers?.length || 0);
              const isCaptain = r.team && (
                String(r.team.captain?._id || r.team.captain) === String(user?._id) ||
                (user?.name && r.team.captain?.name && user.name.trim().toLowerCase() === r.team.captain.name.trim().toLowerCase())
              );
              const minSize = sport?.minimumTeamSize || 11;
              const maxSize = sport?.maximumTeamSize || 15;
              const isTerminated = r.team?.status === 'terminated' || r.status === 'terminated';
              const teamStatusLabel = isTerminated
                ? 'TERMINATED'
                : (confirmedMembers < minSize ? 'INCOMPLETE' : (confirmedMembers >= maxSize ? 'FULL' : 'READY / CONFIRMED'));

              return (
                <div key={r._id} className="border border-[#2f6d5a]/30 rounded-xl p-4 bg-white shadow-2xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#fef9e7] text-[#9a6c00] border border-[#f0d060]">
                      {isOrg ? '[ ORGANIZER EVENT ] Organizer Verified' : '[ FEDERATION ] Federation Recognized'}
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                      isPendingJoin
                        ? 'bg-[#fff8ea] text-[#9a6c00] border-[#e0c068]'
                        : isTerminated
                        ? 'bg-[#fdf2f2] text-[#9b1c1c] border-[#f8b4b4]'
                        : 'bg-[#f4f8f5] text-[#173235] border-[#d2dad2]'
                    }`}>
                      Status: {String(r.status).replaceAll('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="font-extrabold text-[#173235] text-base">{r.event?.eventName || 'Event'}</div>
                  <div className="flex flex-wrap gap-2 items-center text-xs text-[#526668]">
                    {sport?.sportName && (
                      <span className="px-2 py-0.5 rounded border border-[#2f6d5a] bg-[#e2eee4] text-[10px] font-extrabold text-[#194e42] uppercase">
                        [{sport.sportName.toUpperCase()}]
                      </span>
                    )}
                    <span>·</span>
                    <span>{r.type === 'team' ? `Team: ${r.team?.name || 'Team registration'}` : 'Individual'}</span>
                    <span>·</span>
                    <span>Organizer: {r.event?.organizer?.organizationName || r.event?.organizer?.name || '—'}</span>
                    <span>·</span>
                    <span>Venue: {r.event?.venue || '—'}</span>
                    <span>·</span>
                    <span>Event Date: {r.event?.eventDate ? new Date(r.event.eventDate).toLocaleDateString('en-IN') : '—'}</span>
                  </div>

                  {isPendingJoin && r.team?._id && (
                    <div className="pt-2 border-t border-[#e2eee4] flex items-center justify-between">
                      <span className="text-xs text-[#9a6c00] font-bold">Join request is awaiting team captain review.</span>
                      <button
                        type="button"
                        disabled={actionBusy === r.team._id}
                        onClick={() => handleCancelRequest(r.team._id)}
                        className="px-2.5 py-1 rounded-lg border border-[#e07050] text-[#e07050] text-xs font-bold hover:bg-[#fff0ed] cursor-pointer disabled:opacity-50"
                      >
                        {actionBusy === r.team._id ? 'Cancelling…' : 'Cancel Request'}
                      </button>
                    </div>
                  )}

                  {isTeam && !isPendingJoin && (
                    <div className="pt-2 border-t border-[#e2eee4] flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-[#526668]">
                        Team: <strong className="text-[#173235]">{r.team.name}</strong> · Captain: <strong>{r.team.captain?.name || (isCaptain ? user?.name : 'Athlete')}</strong> {isCaptain && '(You)'} · Members: <strong>{confirmedMembers} / {maxSize}</strong> · Status: <strong className={isTerminated ? 'text-[#9b1c1c]' : confirmedMembers < minSize ? 'text-[#9a6c00]' : 'text-[#194e42]'}>{teamStatusLabel}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => setManageTeamModal({ event: r.event, sport })}
                        className="px-3 py-1 rounded-lg bg-[#194e42] text-white text-xs font-bold hover:bg-[#173235] cursor-pointer"
                      >
                        {isCaptain ? 'VIEW / MANAGE TEAM' : 'VIEW TEAM'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {manageTeamModal && (
          <TeamRegistrationModal
            event={manageTeamModal.event}
            sport={manageTeamModal.sport}
            onClose={() => setManageTeamModal(null)}
            onSuccess={() => {
              loadRegs();
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function OrganizerAchievementsSection({ athleteUserId }) {
  const { user } = useAuth() || {};
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfModal, setPdfModal] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    api.get('/organizer-events/my/achievements')
      .then(({ data }) => {
        if (isMounted) setAchievements(data?.achievements || []);
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.response?.data?.error || err.message || 'Failed to load organizer achievements');
          setAchievements([]);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [athleteUserId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#cc694e]" /> Organizer Verified Achievements
          </CardTitle>
          <CardDescription>Official verified results and podium awards from organizer competitions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-xs text-[#697c7c] flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-[#194e42]" />
            <span>Loading organizer-verified achievements...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#cc694e]" /> Organizer Verified Achievements
          </CardTitle>
          <CardDescription>Official verified results and podium awards from organizer competitions</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[#a34028] p-4 bg-[#fff3f0] rounded-lg border border-[#efcbc3] text-center">
            {error}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!achievements || achievements.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#cc694e]" /> Organizer Verified Achievements (0)
          </CardTitle>
          <CardDescription>Official verified results and podium awards from organizer competitions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-6 bg-[#f9faf8] rounded-xl border border-[#d8ded5] text-center space-y-1">
            <Award className="w-8 h-8 text-[#a5c5bd] mx-auto mb-2" />
            <p className="text-sm font-bold text-[#173235]">No Organizer Achievements Yet</p>
            <p className="text-xs text-[#697c7c] max-w-md mx-auto">
              Verified competition results, certificates, and podium honors published by tournament organizers will appear here automatically.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5 text-[#cc694e]" /> Organizer Verified Achievements ({achievements.length})
        </CardTitle>
        <CardDescription>Official verified results and podium awards from organizer competitions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {achievements.map((ach) => {
            const athleteName = ach.athlete?.name || user?.name || 'Athlete';
            const rawCert = ach.certificateData;
            const pdfSrc = rawCert
              ? (rawCert.startsWith('data:') || rawCert.startsWith('http://') || rawCert.startsWith('https://') || rawCert.startsWith('blob:')
                  ? rawCert
                  : `data:application/pdf;base64,${rawCert}`)
              : null;

            const eventDateStr = ach.event?.eventDate
              ? new Date(ach.event.eventDate).toLocaleDateString('en-IN')
              : 'Completed';

            return (
              <div key={ach._id} className="p-4 bg-white rounded-xl border border-[#d8ded5] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
                      [ ORGANIZER EVENT ]
                    </span>
                    <span className="text-[10px] font-bold text-[#526668]">
                      Organizer Verified
                    </span>
                    {ach.event?.eventName && ach.event.eventName.trim().toLowerCase() !== athleteName.trim().toLowerCase() && (
                      <span className="text-[10px] font-semibold text-[#173235] bg-[#f4f8f5] px-2 py-0.5 rounded border border-[#d2dad2]">
                        Tournament: {ach.event.eventName}
                      </span>
                    )}
                  </div>

                  {/* Logged-in Athlete's actual name */}
                  <h4 className="font-extrabold text-base text-[#173235] mt-1.5">
                    {athleteName}
                  </h4>

                  {/* Sport, Team, Date */}
                  <p className="text-xs text-[#526668] mt-0.5 flex flex-wrap items-center gap-1.5 font-medium">
                    {ach.sportName && <span className="font-bold text-[#194e42]">[{ach.sportName.toUpperCase()}]</span>}
                    {ach.teamName && <span>· Team: <strong className="text-[#173235]">{ach.teamName}</strong></span>}
                    <span>· {eventDateStr}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
                    {ach.outcome || (ach.position ? `Rank #${ach.position}` : (ach.medal ? `${ach.medal} Medal` : '1st Place'))}
                  </span>
                  {pdfSrc && (
                    <button
                      type="button"
                      onClick={() => setPdfModal({
                        data: pdfSrc,
                        name: ach.certificateFileName || `${athleteName}_Certificate.pdf`,
                        title: `${athleteName} — Official Certificate`
                      })}
                      className="px-3 py-1.5 rounded-lg bg-[#194e42] text-white text-xs font-bold hover:bg-[#143d34] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Eye size={12} /> View My Certificate
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {pdfModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl border border-[#2f6d5a]">
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#194e42]" />
                  <div>
                    <h3 className="font-bold text-base text-[#173235]">{pdfModal.title || 'Official Certificate Preview'}</h3>
                    <p className="text-[11px] text-[#526668]">Personal Verified Certificate</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPdfModal(null)}
                  className="p-1 rounded-lg text-[#697c7c] hover:text-[#173235] hover:bg-[#f4f8f5] transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 bg-[#f8faf7] rounded-xl border text-center space-y-3">
                <p className="text-xs text-[#526668]">File: <b>{pdfModal.name}</b></p>
                <div className="overflow-hidden rounded-lg border border-[#d8ded5] bg-white">
                  <iframe
                    src={pdfModal.data}
                    style={{ width: '100%', height: '50vh', border: 'none' }}
                    title="Certificate Preview"
                  />
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <a
                    href={pdfModal.data}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-lg bg-[#194e42] text-white text-xs font-bold hover:bg-[#143d34] transition flex items-center gap-1.5"
                  >
                    <ExternalLink size={14} /> Open in New Tab
                  </a>
                  <a
                    href={pdfModal.data}
                    download={pdfModal.name}
                    className="px-4 py-2 rounded-lg border border-[#2f6d5a] text-[#194e42] text-xs font-bold hover:bg-[#e2eee4] transition flex items-center gap-1.5"
                  >
                    <Download size={14} /> Download Certificate
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AthleteDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { socket, unreadByConnection, totalUnreadMessages, openChatForConnection, closeChat } = useSocket();

  const [optInSponsorship, setOptInSponsorship] = useState(user?.seekingSponsorship ?? true);
  const [relocationFlexible, setRelocationFlexible] = useState(user?.relocationFlexible ?? true);
  const [activeTab, setActiveTab] = useState('eligible');
  const [myOrganizedData, setMyOrganizedData] = useState(null);
  const [profile, setProfile] = useState({
    name: user?.name || '',
    sport: user?.sport || 'Taekwondo',
    age: user?.age ? String(user.age) : '16',
    state: user?.state || 'Andhra Pradesh',
    city: user?.city || 'Vijayawada',
    level: user?.beltRank || 'State Representative',
    videoLink: user?.videoLink || '',
    tournaments: user?.tournaments || []
  });

  // New Tournament Input State
  const [newTournament, setNewTournament] = useState({
    tournamentName: '',
    year: '2026',
    category: '',
    position: 'Gold'
  });

  // Coach & Mentorship States
  const [coaches, setCoaches] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loadingCoaches, setLoadingCoaches] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSport, setSelectedSport] = useState('all');

  // Request modal / state
  const [requestCoach, setRequestCoach] = useState(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  // Chat state
  const [chatConnectionId, setChatConnectionId] = useState(null);
  const [chatOtherName, setChatOtherName] = useState('');

  // Expanded session notes on active coaches
  const [expandedCoachId, setExpandedCoachId] = useState(null);

  // Fetch coaches and existing connections
  const fetchData = useCallback(async () => {
    if (!user?._id) return;
    setLoadingCoaches(true);
    try {
      const [coachesRes, connsRes, profileRes, orgEventsRes] = await Promise.all([
        api.get('/athlete/coaches/list'),
        api.get(`/athlete/${user._id}/connections`),
        api.get(`/athlete/${user._id}/profile`),
        api.get('/organizer-events/my-organized-events').catch(() => ({ data: { hasLinkedOrganizer: false, events: [] } }))
      ]);
      setCoaches(coachesRes.data || []);
      setConnections(connsRes.data || []);
      if (orgEventsRes?.data) setMyOrganizedData(orgEventsRes.data);
      if (profileRes.data) {
        const d = profileRes.data;
        setProfile(prev => ({
          ...prev,
          name: d.name || prev.name,
          sport: d.sport || prev.sport,
          age: d.age ? String(d.age) : prev.age,
          state: d.state || prev.state,
          city: d.city || prev.city,
          level: d.beltRank || prev.level,
          videoLink: d.videoLink || prev.videoLink,
          tournaments: d.tournaments || prev.tournaments || []
        }));
        if (d.seekingSponsorship !== undefined) setOptInSponsorship(d.seekingSponsorship);
        if (d.relocationFlexible !== undefined) setRelocationFlexible(d.relocationFlexible);
      }
    } catch (err) {
      console.error('Error fetching athlete dashboard data:', err);
    } finally {
      setLoadingCoaches(false);
    }
  }, [user?._id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Socket listener for connection status changes
  useEffect(() => {
    if (!socket) return;

    const handleAccepted = (data) => {
      fetchData();
    };

    const handleRejected = (data) => {
      fetchData();
    };

    socket.on('connection-accepted', handleAccepted);
    socket.on('connection-rejected', handleRejected);

    return () => {
      socket.off('connection-accepted', handleAccepted);
      socket.off('connection-rejected', handleRejected);
    };
  }, [socket, fetchData]);

  // Handle saving profile changes
  const handleSaveProfile = async () => {
    try {
      if (user?._id) {
        await api.put(`/athlete/${user._id}/profile`, {
          name: profile.name,
          sport: profile.sport,
          age: Number(profile.age) || undefined,
          state: profile.state,
          city: profile.city,
          beltRank: profile.level,
          seekingSponsorship: optInSponsorship,
          relocationFlexible: relocationFlexible,
          videoLink: profile.videoLink,
          tournaments: profile.tournaments
        });
      }
      toast({
        title: 'Profile Updated',
        description: 'Your athlete portfolio & tournament records have been saved.',
        variant: 'success'
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update profile: ' + (err.response?.data?.error || err.message),
        variant: 'destructive'
      });
    }
  };

  // Add tournament record to profile
  const handleAddTournament = () => {
    if (!newTournament.tournamentName.trim()) {
      toast({ title: 'Missing tournament name', description: 'Please enter the tournament or championship title.', variant: 'destructive' });
      return;
    }
    setProfile(prev => ({
      ...prev,
      tournaments: [...(prev.tournaments || []), { ...newTournament }]
    }));
    setNewTournament({
      tournamentName: '',
      year: '2026',
      category: '',
      position: 'Gold'
    });
    toast({ title: 'Record Added', description: 'Click Save Profile Changes to persist.', variant: 'success' });
  };

  const handleRemoveTournament = (idx) => {
    setProfile(prev => ({
      ...prev,
      tournaments: prev.tournaments.filter((_, i) => i !== idx)
    }));
  };

  // Send mentorship request to a coach
  const handleSendRequest = async () => {
    if (!requestCoach || !user?._id) return;
    setSendingRequest(true);
    try {
      await api.post(`/athlete/${user._id}/connect`, {
        coachId: requestCoach._id,
        message: requestMessage.trim() || 'Hi Coach, I would like to seek your guidance and technical mentorship.'
      });
      toast({
        title: 'Request Sent! 🚀',
        description: `Your mentorship request has been sent to Coach ${requestCoach.name}.`,
        variant: 'success'
      });
      setRequestCoach(null);
      setRequestMessage('');
      fetchData();
    } catch (err) {
      toast({
        title: 'Request Failed',
        description: err.response?.data?.error || err.message,
        variant: 'destructive'
      });
    } finally {
      setSendingRequest(false);
    }
  };

  const getConnectionForCoach = (coachId) => {
    return connections.find(c => (c.coach?._id === coachId || c.coach === coachId));
  };

  const activeConnections = connections.filter(c => c.status === 'Active');
  const pendingConnections = connections.filter(c => c.status === 'Pending');

  const filteredCoaches = coaches.filter(c => {
    const matchesSearch =
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.sport?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.state?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSport = selectedSport === 'all' || c.sport?.toLowerCase() === selectedSport.toLowerCase();
    return matchesSearch && matchesSport;
  });

  const uniqueSports = Array.from(new Set(coaches.map(c => c.sport).filter(Boolean)));
  const embedUrl = getYouTubeEmbedUrl(profile.videoLink);

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#173d3c] via-[#123130] to-[#0c292c] border border-[#2f6d5a] p-5 sm:p-6 rounded-2xl text-white shadow-md">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#cc694e]" /> Verified Athlete Profile
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono text-[#c5d3ce] border border-white/20">
              ID: ATH-{user?._id?.slice(-6)?.toUpperCase() || '89201'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-normal text-white" style={{ fontFamily: 'Georgia, serif' }}>
            <span style={{ textTransform: 'capitalize' }}>{profile.name || user?.name || 'Athlete'}</span> <em style={{ color: '#b9d9bf', fontStyle: 'italic' }}>Portfolio</em>
          </h1>
          <p className="text-xs text-[#c5d3ce]">
            {profile.sport} · {profile.level} · {profile.city}, {profile.state}
          </p>
        </div>

        <div className="flex shrink-0">
          <button
            type="button"
            onClick={handleSaveProfile}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 h-10 px-5 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
          >
            <Sparkles className="w-4 h-4 mr-1" /> Save Changes
          </button>
        </div>
      </div>

      <Alert variant="info" icon={Shield}>
        <AlertTitle>Federation Recognition Active</AlertTitle>
        <AlertDescription>
          Your state tournament achievements and competitive record are tracked under recognized National Sports Federation guidelines.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="eligible">
            <Trophy className="w-4 h-4 mr-1.5" /> Eligible For You
          </TabsTrigger>
          <TabsTrigger value="achievements">
            <Award className="w-4 h-4 mr-1.5" /> Personal Achievements
          </TabsTrigger>
          {myOrganizedData?.hasLinkedOrganizer && (
            <TabsTrigger value="organized-events">
              <Calendar className="w-4 h-4 mr-1.5 text-[#cc694e]" /> Organized Events ({myOrganizedData.events?.length || 0})
            </TabsTrigger>
          )}
          <TabsTrigger value="event-registrations">
            <Calendar className="w-4 h-4 mr-1.5" /> My Event Registrations
          </TabsTrigger>
          <TabsTrigger value="connect">
            <Users className="w-4 h-4 mr-1.5" />
            Coaches & Mentors
            {totalUnreadMessages > 0 ? (
              <span style={{ marginLeft: 6, minWidth: 18, height: 18, borderRadius: 9, background: '#e07050', color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                {totalUnreadMessages}
              </span>
            ) : activeConnections.length > 0 ? (
              <span className="ml-1.5 px-2 py-0.2 rounded-full text-[10px] font-extrabold bg-[#2f6d5a] text-[#b9d9bf]">
                {activeConnections.length} Active
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="federation-lists">
            <Shield className="w-4 h-4 mr-1.5" /> Federation Lists
          </TabsTrigger>
          <TabsTrigger value="academies">
            <Building2 className="w-4 h-4 mr-1.5" /> Academies & Centers
          </TabsTrigger>
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-1.5" /> Profile & Preferences
          </TabsTrigger>
        </TabsList>

        {/* ── PROFILE & PREFERENCES TAB ──────────────────────────────── */}
        <TabsContent value="profile" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Athlete Details & Relocation Readiness</CardTitle>
                <CardDescription>Update your competitive details for academy match recommendations and coach evaluations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label required>Full Name</Label>
                    <Input
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label required>Primary Discipline</Label>
                    <Input
                      value={profile.sport}
                      onChange={(e) => setProfile({ ...profile, sport: e.target.value })}
                      className="bg-[#fffefa] text-[#194e42] font-bold border-[#2f6d5a]/40"
                    />
                  </div>
                  <div>
                    <Label>Age</Label>
                    <Input
                      value={profile.age}
                      onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Highest Competition Level / Rank</Label>
                    <Input
                      value={profile.level}
                      onChange={(e) => setProfile({ ...profile, level: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>City</Label>
                    <Input
                      value={profile.city}
                      onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>State</Label>
                    <Input
                      value={profile.state}
                      onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-3 space-y-3 border-t border-[#d8ded5]">
                  <Switch
                    checked={relocationFlexible}
                    onChange={setRelocationFlexible}
                    label="Willing to Relocate for SAI NCOE Centre / Residential Academy"
                  />
                  <Switch
                    checked={optInSponsorship}
                    onChange={setOptInSponsorship}
                    label="Opt-in to Verified CSR Sponsor Browser Ledger"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pathway Compatibility</CardTitle>
                <CardDescription>Automated readiness index</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProgressChart value={88} label="Federation State Recognition" />
                <ProgressChart value={94} label="SAI Centre Eligibility" />
                <ProgressChart value={70} label="Sports Quota University Match" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── ELIGIBLE FOR YOU TAB ──────────────────────────────── */}
        <TabsContent value="eligible" className="space-y-6">
          <OfficialTournamentsSection athleteSport={profile.sport} eligibleOnly={true} />
        </TabsContent>

        {/* ── PERSONAL ACHIEVEMENTS TAB ─────────────────────────── */}
        <TabsContent value="achievements" className="space-y-6">
          <ErrorBoundary title="Failed to load Federation Verified Achievements">
            <FederationVerifiedSection athleteUserId={user?._id} />
          </ErrorBoundary>
          <ErrorBoundary title="Failed to load Organizer Verified Achievements">
            <OrganizerAchievementsSection athleteUserId={user?._id} />
          </ErrorBoundary>

          <Card>
            <CardHeader>
              <CardTitle>Add Tournament Achievement Record</CardTitle>
              <CardDescription>Record championship medals, categories, and competition results for coach review</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <Label required>Tournament / Championship Name</Label>
                  <Input
                    placeholder="e.g. State Championship"
                    value={newTournament.tournamentName}
                    onChange={e => setNewTournament({ ...newTournament, tournamentName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Year</Label>
                  <Input
                    placeholder="2026"
                    value={newTournament.year}
                    onChange={e => setNewTournament({ ...newTournament, year: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Podium / Result</Label>
                  <select
                    value={newTournament.position}
                    onChange={e => setNewTournament({ ...newTournament, position: e.target.value })}
                    className="w-full h-10 bg-white border border-[#d2dad2] rounded-lg px-3 text-xs text-[#1d2c31] outline-none"
                  >
                    <option value="Gold Medal 🥇">Gold Medal 🥇</option>
                    <option value="Silver Medal 🥈">Silver Medal 🥈</option>
                    <option value="Bronze Medal 🥉">Bronze Medal 🥉</option>
                    <option value="Quarter Finalist">Quarter Finalist</option>
                    <option value="Participant">Participant</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddTournament}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#194e42] hover:bg-[#123930] text-white font-extrabold text-xs uppercase tracking-wider cursor-pointer shadow-xs transition"
                >
                  <Plus size={14} /> Add Record
                </button>
              </div>

              {/* Tournaments List */}
              <div className="space-y-2 mt-4 pt-4 border-t border-[#d8ded5]">
                <div className="text-xs font-extrabold text-[#194e42] uppercase tracking-wider mb-2">
                  Logged Tournament Records ({profile.tournaments?.length || 0})
                </div>
                {(!profile.tournaments || profile.tournaments.length === 0) ? (
                  <p className="text-xs text-[#697c7c] p-4 bg-[#f9faf8] rounded-lg border border-[#d8ded5] text-center">
                    No tournament records added yet. Fill the fields above to add records.
                  </p>
                ) : (
                  profile.tournaments.map((t, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white rounded-xl border border-[#d8ded5] shadow-2xs gap-3">
                      <div className="flex items-center gap-3">
                        <Trophy size={16} className="text-[#cc694e] shrink-0" />
                        <div>
                          <div className="font-bold text-sm text-[#173235]">{t.tournamentName}</div>
                          <div className="text-xs text-[#526668]">{t.category && `${t.category} · `}{t.year}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]/40">
                          {t.position}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTournament(idx)}
                          className="text-[#a44e3d] hover:bg-[#fff3f0] p-1.5 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sparring / Video Showcase */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Video Reel (YouTube / Match Showcase)</CardTitle>
              <CardDescription>Link your competitive match or sparring video for coaches to evaluate technique</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Video URL</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="e.g. https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    value={profile.videoLink}
                    onChange={e => setProfile({ ...profile, videoLink: e.target.value })}
                  />
                  {profile.videoLink && (
                    <a
                      href={profile.videoLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-[#e2eee4] text-[#194e42] font-bold text-xs border border-[#2f6d5a]/40 shrink-0"
                    >
                      <ExternalLink size={13} /> Open
                    </a>
                  )}
                </div>
              </div>

              {embedUrl && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#194e42] flex items-center gap-1.5">
                    <PlayCircle size={14} className="text-[#cc694e]" /> Video Player Preview
                  </div>
                  <div className="aspect-video w-full max-w-xl rounded-xl overflow-hidden border border-[#2f6d5a] bg-black shadow-md">
                    <iframe
                      src={embedUrl}
                      title="Athlete Performance"
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ORGANIZED EVENTS TAB (SEPARATE FROM PERSONAL ACHIEVEMENTS) ── */}
        {myOrganizedData?.hasLinkedOrganizer && (
          <TabsContent value="organized-events" className="space-y-6">
            <OrganizedEventsSection initialData={myOrganizedData} />
          </TabsContent>
        )}

        <TabsContent value="federation-lists" className="space-y-6">
          <FederationListsSection />
        </TabsContent>
        <TabsContent value="event-registrations" className="space-y-6">
          <MyEventRegistrations />
        </TabsContent>
        <TabsContent value="academies" className="space-y-6">
          <AthleteAcademiesSection athleteSport={profile.sport || user?.sport} />
        </TabsContent>

        {/* ── COACHES & MENTORSHIP TAB ──────────────────────────────── */}
        <TabsContent value="connect" className="space-y-6">
          {/* 1. ACTIVE / CONNECTED COACHES */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <UserCheck className="w-5 h-5 text-[#2f6d5a] shrink-0" />
                My Active Mentors & Coaches ({activeConnections.length})
              </CardTitle>
              <CardDescription>
                Coaches currently guiding you with tactical training, live chat, and session evaluation notes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeConnections.length === 0 ? (
                <div className="text-center py-8 px-4 bg-[#f8faf7] rounded-xl border border-dashed border-[#d8ded5] space-y-2">
                  <Users className="w-8 h-8 mx-auto text-[#8a9d9a]" />
                  <p className="text-sm font-bold text-[#173235]">No Active Coach Connected Yet</p>
                  <p className="text-xs text-[#697c7c] max-w-md mx-auto">
                    Explore the accredited coaches directory below and click <strong>Request Mentorship</strong> to connect.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeConnections.map(conn => {
                    const coach = conn.coach || {};
                    const isExpanded = expandedCoachId === conn._id;
                    return (
                      <div key={conn._id} className="rounded-xl border border-[#2f6d5a]/40 bg-white overflow-hidden shadow-xs">
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div style={{
                              width: 44, height: 44, borderRadius: '50%',
                              background: '#e2eee4', border: '2px solid #2f6d5a',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 800, fontSize: 16, color: '#194e42', flexShrink: 0
                            }}>
                              {coach.name?.charAt(0)?.toUpperCase() || 'C'}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-bold text-[#173235] text-sm">{coach.name}</h4>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
                                  Active Coach
                                </span>
                              </div>
                              <p className="text-xs text-[#526668] mt-0.5">
                                {coach.sport || 'Sports'} Specialist · {coach.city || 'India'}, {coach.state || ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                            <button
                              onClick={() => {
                                openChatForConnection(conn._id);
                                setChatConnectionId(conn._id);
                                setChatOtherName(coach.name || 'Coach');
                              }}
                              className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-bold bg-[#173d3c] hover:bg-[#0c292c] text-[#b9d9bf] border border-[#2f6d5a] transition-all cursor-pointer shadow-xs"
                            >
                              <MessageCircle size={14} /> Open Chat
                              {unreadByConnection[conn._id] > 0 && (
                                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-[#e07050] text-white">
                                  {unreadByConnection[conn._id]}
                                </span>
                              )}
                            </button>
                            <button
                              onClick={() => setExpandedCoachId(isExpanded ? null : conn._id)}
                              className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-bold bg-[#e2eee4] hover:bg-[#d4e6d7] text-[#194e42] border border-[#2f6d5a]/30 transition-all cursor-pointer"
                            >
                              <BookOpen size={14} /> Session Notes ({conn.sessionNotes?.length || 0})
                              <ChevronDown size={13} style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
                            </button>
                          </div>
                        </div>

                        {/* Session Notes Section */}
                        {isExpanded && (
                          <div className="border-t border-[#e8ede6] bg-[#f9faf8] p-4 space-y-3">
                            <div className="text-[11px] font-extrabold text-[#194e42] uppercase tracking-wider">
                              Coach's Session Evaluation & Feedback Log
                            </div>
                            {conn.sessionNotes?.length > 0 ? (
                              <div className="space-y-2">
                                {[...conn.sessionNotes].reverse().map((note, idx) => (
                                  <div key={idx} className="p-3 bg-white rounded-lg border border-[#e2ede4] shadow-2xs">
                                    <div className="flex items-center justify-between text-[11px] text-[#697c7c] mb-1 font-mono">
                                      <span className="flex items-center gap-1">
                                        <Clock size={12} className="text-[#cc694e]" />
                                        {new Date(note.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                      </span>
                                    </div>
                                    <p className="text-xs text-[#173235] leading-relaxed">{note.note}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-[#697c7c] italic p-3 bg-white rounded-lg border border-[#e2ede4]">
                                No session notes logged by coach yet. Your coach will log notes after training evaluations.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. PENDING REQUESTS */}
          {pendingConnections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#cc694e]" /> Pending Coach Requests ({pendingConnections.length})
                </CardTitle>
                <CardDescription>Requests awaiting coach review and acceptance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingConnections.map(conn => {
                  const coach = conn.coach || {};
                  return (
                    <div key={conn._id} className="p-4 rounded-xl border border-[#f0d060] bg-[#fefdf5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-[#173235] text-sm">Coach {coach.name}</h4>
                          <Badge variant="outline" className="text-xs bg-[#fef9e7] text-[#9a6c00] border-[#f0d060]">
                            ⏳ Pending Review
                          </Badge>
                        </div>
                        <p className="text-xs text-[#526668] mt-0.5">
                          {coach.sport} Specialist · {coach.city}, {coach.state}
                        </p>
                        {conn.message && (
                          <p className="text-xs text-[#697c7c] mt-1 italic">"{conn.message}"</p>
                        )}
                      </div>
                      <span className="text-xs text-[#697c7c]">
                        Sent on {new Date(conn.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* 3. EXPLORE ACCREDITED COACHES DIRECTORY */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base sm:text-lg">Explore Accredited Coaches Directory</CardTitle>
                  <CardDescription>
                    Browse coaches registered on TrackAthlete, view their certifications, and request mentorship
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#8a9d9a]" />
                    <input
                      type="text"
                      placeholder="Search coach, sport, city…"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="h-9 pl-8 pr-3 text-xs bg-[#f4f8f3] border border-[#d8ded5] rounded-lg text-[#173235] outline-none focus:border-[#2f6d5a] w-full sm:w-56"
                    />
                  </div>
                  {uniqueSports.length > 0 && (
                    <select
                      value={selectedSport}
                      onChange={e => setSelectedSport(e.target.value)}
                      className="h-9 px-2 text-xs bg-[#f4f8f3] border border-[#d8ded5] rounded-lg text-[#173235] outline-none focus:border-[#2f6d5a]"
                    >
                      <option value="all">All Sports</option>
                      {uniqueSports.map(sp => (
                        <option key={sp} value={sp}>{sp}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {loadingCoaches ? (
                <div className="text-center py-10 text-xs text-[#697c7c]">
                  Loading registered coaches…
                </div>
              ) : filteredCoaches.length === 0 ? (
                <div className="text-center py-10 px-4 bg-[#f8faf7] rounded-xl border border-[#d8ded5]">
                  <p className="text-sm font-bold text-[#173235]">No Coaches Found</p>
                  <p className="text-xs text-[#697c7c] mt-1">
                    {searchTerm ? 'No coaches matched your search criteria.' : 'No registered coaches available right now.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredCoaches.map(c => {
                    const conn = getConnectionForCoach(c._id);
                    const isConnected = conn?.status === 'Active';
                    const isPending = conn?.status === 'Pending';

                    return (
                      <div
                        key={c._id}
                        className="p-4 rounded-xl border border-[#d8ded5] bg-white hover:border-[#2f6d5a]/60 transition-all shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-3">
                              <div style={{
                                width: 42, height: 42, borderRadius: '50%',
                                background: '#e2eee4', border: '2px solid #2f6d5a',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, fontSize: 15, color: '#194e42', flexShrink: 0
                              }}>
                                {c.name?.charAt(0)?.toUpperCase() || 'C'}
                              </div>
                              <div>
                                <h4 className="font-bold text-[#173235] text-sm">{c.name}</h4>
                                <p className="text-xs text-[#526668]">
                                  {c.sport || 'Sports'} Specialist
                                </p>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a] shrink-0">
                              Accredited
                            </span>
                          </div>

                          <div className="space-y-1 my-3 text-xs text-[#526668]">
                            <div className="flex items-center gap-1.5">
                              <MapPin size={13} className="text-[#cc694e] shrink-0" />
                              <span>{c.city || 'Vijayawada'}, {c.state || 'Andhra Pradesh'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Award size={13} className="text-[#cc694e] shrink-0" />
                              <span>{c.yearsExperience || 0}+ Years Coaching Experience</span>
                            </div>
                            {c.certifications?.length > 0 && (
                              <div className="flex items-center gap-1.5 text-[#194e42] font-mono text-[11px]">
                                <span>Certifications: {c.certifications.join(', ')}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-[#f0f4f0] flex items-center justify-between">
                          {isConnected ? (
                            <div className="flex items-center justify-between w-full">
                              <Badge className="bg-[#e2eee4] text-[#194e42] border-[#2f6d5a]">Connected Mentor</Badge>
                              <button
                                onClick={() => {
                                  openChatForConnection(conn._id);
                                  setChatConnectionId(conn._id);
                                  setChatOtherName(c.name);
                                }}
                                className="text-xs font-bold text-[#194e42] underline cursor-pointer"
                              >
                                Chat Now →
                              </button>
                            </div>
                          ) : isPending ? (
                            <Badge variant="outline" className="bg-[#fef9e7] text-[#9a6c00] border-[#f0d060]">
                              Request Pending Review
                            </Badge>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setRequestCoach(c);
                                setRequestMessage(`Hi Coach ${c.name}, I am an athlete competing in ${profile.sport}. I would appreciate your technical mentorship and guidance.`);
                              }}
                              className="w-full flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-[#e2eee4] hover:bg-[#173d3c] text-[#194e42] hover:text-white font-bold text-xs border border-[#2f6d5a]/40 transition-all cursor-pointer shadow-xs"
                            >
                              <Send className="w-3.5 h-3.5 text-[#cc694e]" /> Request Mentorship / Connect
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
        </TabsContent>
      </Tabs>

      {/* REQUEST MODAL */}
      {requestCoach && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(12, 41, 44, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, padding: 16
        }}>
          <div style={{
            background: '#fcfcf8', borderRadius: 20,
            border: '1px solid #2f6d5a', width: '100%', maxWidth: 480,
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)', overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #173d3c, #0c292c)',
              padding: '18px 24px', borderBottom: '1px solid #2f6d5a',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ color: '#b9d9bf', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Mentorship Request
                </div>
                <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                  Connect with Coach {requestCoach.name}
                </div>
              </div>
              <button
                onClick={() => setRequestCoach(null)}
                className="text-[#b9d9bf] hover:text-white transition cursor-pointer p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#f4f8f3', padding: 12, borderRadius: 10, border: '1px solid #d8ded5', fontSize: 12, color: '#173235' }}>
                <span className="font-bold">{requestCoach.sport} Specialist</span> · {requestCoach.city}, {requestCoach.state} ({requestCoach.yearsExperience || 0}+ yrs exp)
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#173235', marginBottom: 6 }}>
                  Introduction & Mentorship Objective
                </label>
                <textarea
                  rows={4}
                  value={requestMessage}
                  onChange={e => setRequestMessage(e.target.value)}
                  placeholder="Introduce yourself, your sporting goals, tournament background, or what areas you want guidance on..."
                  style={{
                    width: '100%', borderRadius: 10, border: '1px solid #d2dad2',
                    padding: '10px 14px', fontSize: 13, background: '#fff',
                    color: '#1d2c31', outline: 'none', resize: 'vertical', fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setRequestCoach(null)}
                  disabled={sendingRequest}
                  style={{
                    height: 40, padding: '0 16px', borderRadius: 10,
                    border: '1px solid #d8ded5', background: '#fff',
                    color: '#526668', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendRequest}
                  disabled={sendingRequest || !requestMessage.trim()}
                  style={{
                    height: 40, padding: '0 20px', borderRadius: 10,
                    border: 'none', background: '#e07050',
                    color: '#fff', fontSize: 12, fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 4px 12px rgba(224, 112, 80, 0.3)'
                  }}
                >
                  <Send size={14} /> {sendingRequest ? 'Sending…' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING CHAT WIDGET */}
      {chatConnectionId && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 420,
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
