import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Input,
  Label,
  useToast,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../components/ui';
import { Shield, Award, Calendar, MapPin, Search, Plus, FileText, CheckCircle2, Lock, Eye, LogOut, Upload, UserCheck, AlertTriangle, XCircle, RefreshCw, Building, Globe } from 'lucide-react';
import api from '../services/api';

export default function FederationDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [federation, setFederation] = useState(null);
  const [events, setEvents] = useState([]);
  const [achievements, setAchievements] = useState([]);

  // Dynamic MongoDB Organization Directory
  const [allFederations, setAllFederations] = useState([]);
  const [allAssociations, setAllAssociations] = useState([]);
  const [selectedSportFilter, setSelectedSportFilter] = useState('');
  const [selectedStateFilter, setSelectedStateFilter] = useState('');
  const [searchOrgQuery, setSearchOrgQuery] = useState('');

  // Create Event Modal State
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({
    eventName: '',
    sport: '',
    category: 'Senior Championship',
    location: '',
    tournamentDate: '',
    startDate: '',
    endDate: '',
    submissionDeadline: ''
  });
  const [creatingEvent, setCreatingEvent] = useState(false);

  // Search & Candidate Match State
  const [athleteSearchInput, setAthleteSearchInput] = useState('ATH-1B2CD580');
  const [candidateAthlete, setCandidateAthlete] = useState(null);
  const [searchingCandidate, setSearchingCandidate] = useState(false);
  const [candidateError, setCandidateError] = useState('');

  // Record Achievement Modal State
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [achievementForm, setAchievementForm] = useState({
    winnerName: '',
    aadhaarNumber: '',
    achievementType: 'medal',
    medal: 'Gold',
    rank: 1,
    year: new Date().getFullYear(),
    eventDate: '',
    description: '',
    certificateData: null,
    certificateFileName: '',
    certificateFileSize: 0
  });
  const [recordingAchievement, setRecordingAchievement] = useState(false);

  // Active PDF Viewer State
  const [viewPdfModal, setViewPdfModal] = useState(null);

  const fetchFederationData = useCallback(async () => {
    try {
      setLoading(true);
      const [profileRes, eventsRes, achRes, fedsRes, assocRes] = await Promise.all([
        api.get('/federation/profile').catch(() => ({ data: null })),
        api.get('/federation/events').catch(() => ({ data: [] })),
        api.get('/federation/achievements').catch(() => ({ data: [] })),
        api.get('/federations').catch(() => ({ data: [] })),
        api.get('/associations').catch(() => ({ data: [] }))
      ]);

      if (profileRes.data) {
        setFederation(profileRes.data);
        setEventForm(prev => ({ ...prev, sport: profileRes.data.sport || 'Taekwondo' }));
      }
      setEvents(eventsRes.data || []);
      setAchievements(achRes.data || []);
      setAllFederations(fedsRes.data || []);
      setAllAssociations(assocRes.data || []);
    } catch (err) {
      console.error('Fetch Federation Data Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFederationData();
  }, [fetchFederationData]);

  // Derived Dynamic Filters from MongoDB Records
  const uniqueSports = Array.from(new Set(allFederations.map(f => f.sport).filter(Boolean))).sort();
  const uniqueStates = Array.from(new Set(allAssociations.map(a => a.state).filter(Boolean))).sort();

  // Filtered MongoDB Organizations
  const filteredFederations = allFederations.filter(f => {
    const matchSport = !selectedSportFilter || f.sport.toLowerCase() === selectedSportFilter.toLowerCase();
    const matchQuery = !searchOrgQuery || f.name.toLowerCase().includes(searchOrgQuery.toLowerCase()) || f.sport.toLowerCase().includes(searchOrgQuery.toLowerCase());
    return matchSport && matchQuery;
  });

  const filteredAssociations = allAssociations.filter(a => {
    const matchSport = !selectedSportFilter || a.sport.toLowerCase() === selectedSportFilter.toLowerCase();
    const matchState = !selectedStateFilter || a.state.toLowerCase() === selectedStateFilter.toLowerCase();
    const matchQuery = !searchOrgQuery || a.associationName.toLowerCase().includes(searchOrgQuery.toLowerCase()) || a.sport.toLowerCase().includes(searchOrgQuery.toLowerCase());
    return matchSport && matchState && matchQuery;
  });

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('trackathlete-federation-token');
    localStorage.removeItem('trackathlete-session');
    navigate('/federation/login');
  };

  // Create Event Submit
  const handleCreateEvent = async (e) => {
    e?.preventDefault();
    if (!eventForm.eventName || !eventForm.tournamentDate || !eventForm.submissionDeadline) {
      toast({ title: 'Required Fields', description: 'Please enter event name, tournament date, and submission deadline.', variant: 'destructive' });
      return;
    }

    try {
      setCreatingEvent(true);
      const { data } = await api.post('/federation/events', {
        ...eventForm,
        sport: eventForm.sport || federation?.sport || 'Taekwondo'
      });
      setEvents(prev => [data, ...prev]);
      toast({ title: '🏆 Official Event Created', description: `Event ${data.eventName} (${data.eventId}) published.`, variant: 'success' });
      setShowCreateEventModal(false);
      setEventForm({
        eventName: '',
        sport: federation?.sport || 'Taekwondo',
        category: 'Senior Championship',
        location: '',
        tournamentDate: '',
        startDate: '',
        endDate: '',
        submissionDeadline: ''
      });
    } catch (err) {
      toast({ title: 'Creation Failed', description: err.response?.data?.error || 'Failed to create event.', variant: 'destructive' });
    } finally {
      setCreatingEvent(false);
    }
  };

  // Search Candidate Athlete
  const handleSearchAthlete = async (e) => {
    e?.preventDefault();
    if (!athleteSearchInput.trim()) return;

    try {
      setSearchingCandidate(true);
      setCandidateError('');
      setCandidateAthlete(null);
      const { data } = await api.get(`/federation/search-athlete/${athleteSearchInput.trim()}`);
      setCandidateAthlete(data);
      setAchievementForm(prev => ({ ...prev, winnerName: data.name }));
      toast({ title: 'Athlete Identified', description: `Matched candidate ${data.name} (${data.athleteId}).`, variant: 'success' });
    } catch (err) {
      setCandidateError(err.response?.data?.error || 'No matching registered athlete found.');
    } finally {
      setSearchingCandidate(false);
    }
  };

  // Certificate PDF File Selection
  const handleCertificateFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast({ title: 'Invalid File', description: 'Official certificate document must be a PDF.', variant: 'destructive' });
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast({ title: 'File Too Large', description: 'Maximum certificate file size is 1 MB.', variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAchievementForm(prev => ({
        ...prev,
        certificateData: reader.result,
        certificateFileName: file.name,
        certificateFileSize: file.size
      }));
    };
    reader.readAsDataURL(file);
  };

  // Record Achievement Submit
  const handleRecordAchievement = async (e) => {
    e?.preventDefault();
    const finalWinnerName = achievementForm.winnerName || candidateAthlete?.name;
    if (!selectedEventId || !finalWinnerName) {
      toast({ title: 'Selection Required', description: 'Please select an event and provide winner name.', variant: 'destructive' });
      return;
    }
    if (!achievementForm.certificateData) {
      toast({ title: 'Certificate Required', description: 'Please upload the official certificate PDF to freeze the result.', variant: 'destructive' });
      return;
    }

    try {
      setRecordingAchievement(true);
      const { data } = await api.post('/federation/achievements', {
        eventId: selectedEventId,
        winnerName: finalWinnerName,
        aadhaarNumber: achievementForm.aadhaarNumber,
        athleteUserId: candidateAthlete?.athleteUserId,
        athleteId: candidateAthlete?.athleteId,
        achievementType: achievementForm.achievementType,
        medal: achievementForm.achievementType === 'medal' ? achievementForm.medal : undefined,
        rank: achievementForm.achievementType === 'ranking' ? Number(achievementForm.rank) : undefined,
        year: Number(achievementForm.year),
        eventDate: achievementForm.eventDate || undefined,
        description: achievementForm.description,
        certificateData: achievementForm.certificateData,
        certificateFileName: achievementForm.certificateFileName,
        certificateFileSize: achievementForm.certificateFileSize
      });

      setAchievements(prev => [data, ...prev]);
      toast({ title: '🔒 Official Result Frozen', description: `Permanent Record ${data.officialRecordId} generated for ${finalWinnerName}. Result is now frozen & public.`, variant: 'success' });
      setShowRecordModal(false);
      setCandidateAthlete(null);
      setAchievementForm({
        winnerName: '',
        aadhaarNumber: '',
        achievementType: 'medal',
        medal: 'Gold',
        rank: 1,
        year: new Date().getFullYear(),
        eventDate: '',
        description: '',
        certificateData: null,
        certificateFileName: '',
        certificateFileSize: 0
      });
    } catch (err) {
      toast({ title: 'Issuance Failed', description: err.response?.data?.error || 'Failed to issue achievement.', variant: 'destructive' });
    } finally {
      setRecordingAchievement(false);
    }
  };

  const fedName = federation?.name || 'Andhra Pradesh Taekwondo Federation';
  const fedId = federation?.federationId || 'FED-TKD001';

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#173d3c] via-[#123130] to-[#0c292c] border border-[#2f6d5a] p-6 rounded-2xl text-white shadow-md">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
              <Shield className="w-3.5 h-3.5 text-[#cc694e]" /> Official Governing Body
            </span>

            {/* Permanent Federation ID Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#274c49] border border-[#3e6b67] text-xs font-mono font-bold text-white shadow-xs">
              <span className="text-[#a5c5bd]">Federation ID:</span>
              <span className="text-[#f1f7f5] tracking-wider">{fedId}</span>
            </div>
          </div>

          <h1 className="text-3xl font-normal text-white" style={{ fontFamily: 'Georgia, serif' }}>
            {fedName} <em style={{ color: '#b9d9bf', fontStyle: 'italic' }}>Verification Desk</em>
          </h1>
          <p className="text-xs text-[#c5d3ce] mt-1">
            {federation?.sport || 'Sports'} Governing Federation · {federation?.state || 'National'} Jurisdiction · Dynamic MongoDB Directory Active
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCreateEventModal(true)}
            className="flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Official Event
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-[#274c49] hover:bg-[#345d5a] text-[#b9d9bf] hover:text-white font-bold text-xs border border-[#3e6b67] transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="events" className="w-full flex flex-col gap-6">
        <TabsList>
          <TabsTrigger value="events">Official Events ({events.length})</TabsTrigger>
          <TabsTrigger value="record">Record Athlete Result</TabsTrigger>
          <TabsTrigger value="ledger">Issued Achievements Ledger ({achievements.length})</TabsTrigger>
          <TabsTrigger value="directory">Organizations Directory ({allFederations.length + allAssociations.length})</TabsTrigger>
          <TabsTrigger value="profile">Federation Profile</TabsTrigger>
        </TabsList>

        {/* TAB 1: OFFICIAL EVENTS */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#194e42]" /> Official Federation Events & Tournaments
                </CardTitle>
                <CardDescription className="mt-1">
                  Events hosted by this federation. Results submitted before the deadline are verified; after deadline events become FROZEN.
                </CardDescription>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateEventModal(true)}
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#e2eee4] hover:bg-[#173d3c] text-[#194e42] hover:text-white font-bold text-xs border border-[#2f6d5a]/40 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#cc694e]" /> Add New Event
              </button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-xs text-[#697c7c]">Loading official events…</div>
              ) : events.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-[#d8ded5] bg-[#fffefa] text-center space-y-2">
                  <Calendar className="w-8 h-8 text-[#8a9d9a] mx-auto mb-1" />
                  <h4 className="font-bold text-[#173235] text-sm">No Events Created Yet</h4>
                  <p className="text-xs text-[#526668] max-w-md mx-auto">
                    Click "Create Official Event" to publish championships and set result deadlines.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {events.map((evt) => (
                    <div key={evt._id} className="p-4 rounded-2xl border border-[#d8ded5] bg-white shadow-xs flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="text-[11px] font-mono font-bold text-[#194e42] bg-[#e2eee4] px-2 py-0.5 rounded border border-[#2f6d5a]/30">
                              {evt.eventId}
                            </span>
                            <h4 className="font-extrabold text-[#173235] text-base mt-1.5">{evt.eventName}</h4>
                          </div>
                          <Badge className={evt.isFrozen ? 'bg-[#fef9e7] text-[#9a6c00] border-[#f0d060]' : 'bg-[#e2eee4] text-[#194e42] border-[#2f6d5a]'}>
                            {evt.isFrozen ? 'FROZEN 🔒' : 'OPEN'}
                          </Badge>
                        </div>

                        <div className="space-y-1 my-2 text-xs text-[#526668]">
                          <div>Category: <strong>{evt.category}</strong> · Sport: <strong>{evt.sport}</strong></div>
                          {evt.location && <div>Location: {evt.location}</div>}
                          <div className="text-[#c85c40] font-bold mt-1">
                            Deadline: {new Date(evt.submissionDeadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#f0f4f0] flex items-center justify-between">
                        <button
                          type="button"
                          disabled={evt.isFrozen}
                          onClick={() => {
                            setSelectedEventId(evt._id);
                            setShowRecordModal(true);
                          }}
                          className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold ${evt.isFrozen ? 'bg-[#ccc] text-[#666] cursor-not-allowed' : 'bg-[#173d3c] text-[#b9d9bf] hover:text-white cursor-pointer'}`}
                        >
                          <Plus size={13} /> {evt.isFrozen ? 'Event Frozen' : 'Record Result for Event'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: SEARCH ATHLETE & RECORD RESULT */}
        <TabsContent value="record" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5 text-[#194e42]" /> Search Candidate Athlete by Permanent Athlete ID
              </CardTitle>
              <CardDescription>
                Search and confirm candidate athlete details using their permanent ID (e.g. ATH-1B2CD580) before issuing an official achievement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSearchAthlete} className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-[#697c7c]" />
                  <Input
                    value={athleteSearchInput}
                    onChange={e => setAthleteSearchInput(e.target.value)}
                    placeholder="Enter Permanent Athlete ID (e.g. ATH-1B2CD580)…"
                    className="pl-9 font-mono font-bold uppercase text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searchingCandidate}
                  className="h-10 px-5 rounded-lg bg-[#173d3c] hover:bg-[#0c292c] text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  {searchingCandidate ? 'Searching…' : 'Find Athlete'}
                </button>
              </form>

              {candidateError && (
                <div className="p-3 rounded-lg bg-[#fff3f0] border border-[#efcbc3] text-[#e07050] text-xs font-bold flex items-center gap-2">
                  <AlertTriangle size={15} /> {candidateError}
                </div>
              )}

              {candidateAthlete && (
                <div className="p-5 rounded-2xl border border-[#2f6d5a] bg-[#f4f8f5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-[#173235] text-base">{candidateAthlete.name}</h4>
                      <span className="text-xs font-mono font-bold bg-[#e2eee4] text-[#194e42] px-2 py-0.5 rounded border border-[#2f6d5a]/30">
                        {candidateAthlete.athleteId}
                      </span>
                    </div>
                    <p className="text-xs text-[#526668] mt-1 font-semibold">
                      Sport: {candidateAthlete.sport} · Location: {candidateAthlete.city}, {candidateAthlete.state}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowRecordModal(true)}
                    className="flex items-center gap-1.5 h-10 px-5 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white font-extrabold text-xs uppercase tracking-wider shadow-sm cursor-pointer"
                  >
                    <UserCheck size={16} /> Confirm & Record Official Result
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: ISSUED OFFICIAL ACHIEVEMENTS LEDGER */}
        <TabsContent value="ledger" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#e07050]" /> Issued Official Achievements Ledger
              </CardTitle>
              <CardDescription>
                Permanent trusted achievement records issued by {fedName}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-6 text-xs text-[#697c7c]">Loading issued records…</div>
              ) : achievements.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-[#d8ded5] bg-[#fffefa] text-center space-y-2">
                  <FileText className="w-8 h-8 text-[#8a9d9a] mx-auto mb-1" />
                  <h4 className="font-bold text-[#173235] text-sm">No Official Achievements Issued Yet</h4>
                  <p className="text-xs text-[#526668] max-w-md mx-auto">
                    Results recorded for official events will appear here with unique TA-ACH-XXXXXXXX verification codes.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {achievements.map((ach) => (
                    <div key={ach._id} className="p-4 rounded-xl border border-[#d8ded5] bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[#194e42] bg-[#e2eee4] px-2 py-0.5 rounded border border-[#2f6d5a]/30">
                            {ach.officialRecordId}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${ach.verificationStatus === 'FROZEN' ? 'bg-[#fef9e7] text-[#9a6c00]' : 'bg-[#e2eee4] text-[#194e42]'}`}>
                            {ach.verificationStatus}
                          </span>
                        </div>
                        <h4 className="font-bold text-[#173235] text-sm">{ach.athleteName} ({ach.athleteId || 'ATH-RECORD'})</h4>
                        <p className="text-xs text-[#526668]">
                          {ach.achievementType === 'medal' ? `${ach.medal} Medal` : `Rank #${ach.rank}`} · {ach.tournamentName} · Category: {ach.category} · Year {ach.year}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={`/verify/${ach.officialRecordId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="h-8 px-3 rounded-lg bg-white border border-[#d8ded5] text-[#173235] font-bold text-xs flex items-center gap-1 cursor-pointer hover:bg-[#f4f8f5]"
                        >
                          <Eye size={13} /> Verify Portal
                        </a>
                        {ach.certificateData && (
                          <button
                            type="button"
                            onClick={() => setViewPdfModal(ach)}
                            className="h-8 px-3 rounded-lg bg-[#e2eee4] border border-[#2f6d5a] text-[#194e42] font-bold text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <FileText size={13} /> PDF
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: DYNAMIC MONGODB ORGANIZATIONS DIRECTORY */}
        <TabsContent value="directory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5 text-[#194e42]" /> Official Organizations Directory (MongoDB Live Ledger)
              </CardTitle>
              <CardDescription>
                Live database records imported from MYAS National Sports Federations and Official State Associations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Dynamic Filter Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#f4f8f5] p-4 rounded-xl border border-[#e2eee4]">
                <div>
                  <Label>Filter by Sport (Dynamic)</Label>
                  <select
                    value={selectedSportFilter}
                    onChange={e => setSelectedSportFilter(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-[#d2dad2] bg-white text-xs font-bold mt-1"
                  >
                    <option value="">-- All Sports ({uniqueSports.length}) --</option>
                    {uniqueSports.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Filter by State (Dynamic)</Label>
                  <select
                    value={selectedStateFilter}
                    onChange={e => setSelectedStateFilter(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-[#d2dad2] bg-white text-xs font-bold mt-1"
                  >
                    <option value="">-- All States ({uniqueStates.length}) --</option>
                    {uniqueStates.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Search Organizations</Label>
                  <div className="relative mt-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#697c7c]" />
                    <Input
                      value={searchOrgQuery}
                      onChange={e => setSearchOrgQuery(e.target.value)}
                      placeholder="Type name or code…"
                      className="pl-8 h-9 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* National Federations Grid */}
              <div>
                <h4 className="font-extrabold text-[#173235] text-sm mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#cc694e]" /> Recognized National Sports Federations ({filteredFederations.length})
                </h4>

                {filteredFederations.length === 0 ? (
                  <div className="p-4 rounded-lg bg-[#f8faf7] text-xs text-[#697c7c] border border-dashed text-center">
                    No National Federations match the selected filter.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredFederations.map((fed) => (
                      <div key={fed._id} className="p-3.5 rounded-xl border border-[#d8ded5] bg-white shadow-2xs flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-[10px] font-mono font-bold bg-[#e2eee4] text-[#194e42] px-2 py-0.5 rounded border border-[#2f6d5a]/30">
                              {fed.federationId}
                            </span>
                            <Badge className="bg-[#e2eee4] text-[#194e42] text-[10px] border-[#2f6d5a]">
                              {fed.recognitionStatus || 'Recognized'}
                            </Badge>
                          </div>
                          <h5 className="font-bold text-[#173235] text-xs mt-2">{fed.name}</h5>
                          <p className="text-[11px] text-[#526668] mt-0.5">Sport: <strong>{fed.sport}</strong></p>
                        </div>
                        {fed.website && (
                          <a href={fed.website} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-[#e07050] mt-2 block hover:underline">
                            Official Site →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Official State Associations Grid */}
              <div className="pt-4 border-t border-[#e2eee4]">
                <h4 className="font-extrabold text-[#173235] text-sm mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4 text-[#194e42]" /> Official State & Regional Associations ({filteredAssociations.length})
                </h4>

                {filteredAssociations.length === 0 ? (
                  <div className="p-4 rounded-lg bg-[#f8faf7] text-xs text-[#697c7c] border border-dashed text-center">
                    No State Associations match the selected filter.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredAssociations.map((assoc) => (
                      <div key={assoc._id} className="p-3.5 rounded-xl border border-[#d8ded5] bg-white shadow-2xs flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-[10px] font-mono font-bold bg-[#f4f8f5] text-[#173235] px-2 py-0.5 rounded border border-[#d2dad2]">
                              {assoc.state}
                            </span>
                            <span className="text-[10px] font-bold text-[#194e42] bg-[#e2eee4] px-2 py-0.5 rounded">
                              {assoc.sport}
                            </span>
                          </div>
                          <h5 className="font-bold text-[#173235] text-xs mt-2">{assoc.associationName}</h5>
                          {assoc.secretary?.name && (
                            <p className="text-[11px] text-[#526668] mt-1">Secretary: {assoc.secretary.name}</p>
                          )}
                          {assoc.email && (
                            <p className="text-[11px] text-[#697c7c] mt-0.5">{assoc.email}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: FEDERATION PROFILE */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Federation Official Profile & Credentials</CardTitle>
              <CardDescription>Verified governing body metadata</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <Label>Federation Name</Label>
                  <div className="p-2.5 rounded-lg border border-[#d2dad2] bg-[#f8faf7] font-bold text-[#173235]">{fedName}</div>
                </div>
                <div>
                  <Label>Permanent Federation ID</Label>
                  <div className="p-2.5 rounded-lg border border-[#d2dad2] bg-[#f8faf7] font-mono font-bold text-[#194e42]">{fedId}</div>
                </div>
                <div>
                  <Label>Discipline / Sport</Label>
                  <div className="p-2.5 rounded-lg border border-[#d2dad2] bg-[#f8faf7] font-bold text-[#173235]">{federation?.sport || 'Taekwondo'}</div>
                </div>
                <div>
                  <Label>Registered Official Email</Label>
                  <div className="p-2.5 rounded-lg border border-[#d2dad2] bg-[#f8faf7] font-bold text-[#173235]">{federation?.officialEmail || 'official@taekwondo.org.in'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CREATE EVENT MODAL */}
      {showCreateEventModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#fcfcf8] rounded-2xl border border-[#2f6d5a] max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="p-4 bg-[#173d3c] text-white flex justify-between items-center">
              <div>
                <div className="text-[11px] font-bold text-[#b9d9bf] uppercase">Official Event Creation</div>
                <h3 className="text-base font-bold">Publish Federation Championship</h3>
              </div>
              <button onClick={() => setShowCreateEventModal(false)} className="text-[#b9d9bf] hover:text-white cursor-pointer"><XCircle size={18} /></button>
            </div>

            <form onSubmit={handleCreateEvent} className="p-5 space-y-4">
              {/* 1. Championship / Event Name * */}
              <div>
                <Label required className="font-bold text-xs">Championship / Event Name *</Label>
                <Input
                  value={eventForm.eventName}
                  onChange={e => setEventForm({ ...eventForm, eventName: e.target.value })}
                  placeholder="e.g. 42nd Senior National Championship"
                  className="mt-1 text-xs font-bold"
                  required
                />
              </div>

              {/* 2 & 3. Sport Discipline * & Category * */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label required className="font-bold text-xs">Sport Discipline *</Label>
                  <select
                    value={eventForm.sport}
                    onChange={e => setEventForm({ ...eventForm, sport: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#d2dad2] bg-white text-xs font-bold mt-1"
                    required
                  >
                    <option value={federation?.sport || 'Taekwondo'}>{federation?.sport || 'Taekwondo'}</option>
                    {uniqueSports.filter(s => s !== (federation?.sport || 'Taekwondo')).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label required className="font-bold text-xs">Category *</Label>
                  <Input
                    value={eventForm.category}
                    onChange={e => setEventForm({ ...eventForm, category: e.target.value })}
                    placeholder="e.g. Senior Championship"
                    className="mt-1 text-xs font-bold"
                    required
                  />
                </div>
              </div>

              {/* 4. TOURNAMENT DATE * (Prominently styled date picker) */}
              <div className="p-3.5 rounded-xl border border-[#2f6d5a] bg-[#f0f7f4] shadow-2xs">
                <Label required className="text-[#194e42] font-extrabold text-xs flex items-center gap-1.5 mb-1">
                  <Calendar className="w-4 h-4 text-[#194e42]" /> TOURNAMENT DATE *
                </Label>
                <Input
                  type="date"
                  value={eventForm.tournamentDate}
                  onChange={e => setEventForm({ ...eventForm, tournamentDate: e.target.value })}
                  className="mt-1 text-xs font-bold text-[#194e42] border-[#2f6d5a] bg-white h-10 cursor-pointer"
                  required
                />
                <p className="text-[11px] text-[#194e42] mt-1 font-semibold">
                  Official date on which the championship / tournament takes place.
                </p>
              </div>

              {/* 5. Event Location */}
              <div>
                <Label className="font-bold text-xs">Event Location</Label>
                <Input
                  value={eventForm.location}
                  onChange={e => setEventForm({ ...eventForm, location: e.target.value })}
                  placeholder="e.g. IG Indoor Stadium, New Delhi"
                  className="mt-1 text-xs font-bold"
                />
              </div>

              {/* 6. Result Submission Deadline (Freeze Lock Date) * */}
              <div className="p-3.5 rounded-xl border border-[#efcbc3] bg-[#fff8f6] shadow-2xs">
                <Label required className="text-[#c85c40] font-extrabold text-xs flex items-center gap-1.5 mb-1">
                  <Lock className="w-4 h-4 text-[#c85c40]" /> Result Submission Deadline (Freeze Lock Date) *
                </Label>
                <Input
                  type="date"
                  value={eventForm.submissionDeadline}
                  onChange={e => setEventForm({ ...eventForm, submissionDeadline: e.target.value })}
                  className="mt-1 text-xs font-bold text-[#c85c40] border-[#efcbc3] bg-white h-10 cursor-pointer"
                  required
                />
                <p className="text-[11px] text-[#697c7c] mt-1 font-medium">
                  Note: After this deadline, the event becomes FROZEN 🔒 and official results cannot be edited or submitted.
                </p>
              </div>

              {/* 7. Action Submit Button */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateEventModal(false)}
                  className="h-10 px-4 rounded-lg border border-[#d8ded5] bg-white font-bold text-xs cursor-pointer hover:bg-[#f4f8f5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingEvent}
                  className="h-10 px-6 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white font-extrabold text-xs uppercase tracking-wider cursor-pointer transition-all shadow-md"
                >
                  {creatingEvent ? 'Publishing…' : 'Publish Official Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD RESULT MODAL */}
      {showRecordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#fcfcf8] rounded-2xl border border-[#2f6d5a] max-w-xl w-full overflow-hidden shadow-2xl">
            <div className="p-4 bg-[#173d3c] text-white flex justify-between items-center">
              <div>
                <div className="text-[11px] font-bold text-[#b9d9bf] uppercase">Record Official Athlete Result</div>
                <h3 className="text-base font-bold">Issue Federation-Verified Achievement</h3>
              </div>
              <button onClick={() => setShowRecordModal(false)} className="text-[#b9d9bf] hover:text-white cursor-pointer"><XCircle size={18} /></button>
            </div>

            <form onSubmit={handleRecordAchievement} className="p-5 space-y-3">
              <div>
                <Label required>Select Official Event</Label>
                <select
                  value={selectedEventId}
                  onChange={e => setSelectedEventId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#d2dad2] bg-white text-xs font-bold mt-1"
                >
                  <option value="">-- Choose Published Event --</option>
                  {events.filter(evt => !evt.isFrozen).map(evt => (
                    <option key={evt._id} value={evt._id}>{evt.eventName} ({evt.eventId})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label required>Winner Name *</Label>
                  <Input
                    value={achievementForm.winnerName}
                    onChange={e => setAchievementForm({ ...achievementForm, winnerName: e.target.value })}
                    placeholder="Official Winner Full Name"
                    className="mt-1 text-xs font-bold"
                    required
                  />
                </div>
                <div>
                  <Label required>Aadhaar Number *</Label>
                  <Input
                    type="password"
                    value={achievementForm.aadhaarNumber}
                    onChange={e => setAchievementForm({ ...achievementForm, aadhaarNumber: e.target.value })}
                    placeholder="12-Digit Private Aadhaar"
                    className="mt-1 text-xs font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#f0f7f4] border border-[#b8dbc9] text-[11px] text-[#194e42] font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#cc694e] shrink-0" />
                <span>Aadhaar is private and used only for official verification.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label required>Result Type</Label>
                  <select
                    value={achievementForm.achievementType}
                    onChange={e => setAchievementForm({ ...achievementForm, achievementType: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#d2dad2] bg-white text-xs font-bold mt-1"
                  >
                    <option value="medal">Medal Win (Gold / Silver / Bronze)</option>
                    <option value="ranking">Official Ranking</option>
                  </select>
                </div>

                {achievementForm.achievementType === 'medal' ? (
                  <div>
                    <Label required>Medal</Label>
                    <select
                      value={achievementForm.medal}
                      onChange={e => setAchievementForm({ ...achievementForm, medal: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-[#d2dad2] bg-white text-xs font-bold mt-1"
                    >
                      <option value="Gold">Gold Medal</option>
                      <option value="Silver">Silver Medal</option>
                      <option value="Bronze">Bronze Medal</option>
                      <option value="Participation">Participation</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <Label required>Rank Position</Label>
                    <Input
                      type="number"
                      value={achievementForm.rank}
                      onChange={e => setAchievementForm({ ...achievementForm, rank: e.target.value })}
                      className="mt-1 text-xs"
                    />
                  </div>
                )}
              </div>

              <div>
                <Label required>Year</Label>
                <Input
                  type="number"
                  value={achievementForm.year}
                  onChange={e => setAchievementForm({ ...achievementForm, year: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label>Description / Details</Label>
                <Input
                  value={achievementForm.description}
                  onChange={e => setAchievementForm({ ...achievementForm, description: e.target.value })}
                  placeholder="e.g. Under-68kg Division Final Match Winner"
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label required>Certificate Upload * (PDF, max 1MB)</Label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleCertificateFileSelect}
                  className="mt-1 text-xs w-full"
                  required
                />
                {achievementForm.certificateFileName && (
                  <p className="text-[11px] font-bold text-[#194e42] mt-1">Selected: {achievementForm.certificateFileName}</p>
                )}
              </div>

              <div className="p-2.5 rounded-lg bg-[#fff8eb] border border-[#f3d9a2] text-[11px] text-[#8a5300] font-semibold flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#cc694e] shrink-0" />
                <span>Submitting the certificate will freeze this official result and make the permitted result information publicly visible.</span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowRecordModal(false)} className="h-9 px-4 rounded-lg border border-[#d8ded5] bg-white font-bold text-xs cursor-pointer">Cancel</button>
                <button type="submit" disabled={recordingAchievement || !selectedEventId || !achievementForm.certificateData} className="h-9 px-5 rounded-lg bg-[#e07050] text-white font-extrabold text-xs uppercase cursor-pointer">
                  {recordingAchievement ? 'Freezing & Issuing…' : 'Freeze & Issue Official Result'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF VIEWER MODAL */}
      {viewPdfModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-[#d8ded5]">
            <div className="p-4 bg-[#173235] text-white flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#cc694e]" /> {viewPdfModal.tournamentName} — Official Certificate
              </h3>
              <button onClick={() => setViewPdfModal(null)} className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 p-4 bg-[#f4f8f5] overflow-auto">
              <iframe
                src={viewPdfModal.certificateData}
                className="w-full h-[60vh] border rounded-xl bg-white"
                title="Official Certificate Viewer"
              />
            </div>
            <div className="p-3 bg-white border-t flex justify-end">
              <button onClick={() => setViewPdfModal(null)} className="h-9 px-4 rounded-lg bg-[#173235] text-white font-bold text-xs cursor-pointer">Close Viewer</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
