import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Building2,
  ShieldCheck,
  MapPin,
  Award,
  CheckCircle2,
  Save,
  Check,
  Plus,
  Users,
  Briefcase,
  Inbox,
  UserCheck,
  FileText,
  Clock,
  Eye,
  X,
  Trash2,
  AlertCircle,
  Compass,
  Trophy,
  ExternalLink,
  ChevronRight,
  UserPlus
} from 'lucide-react';
import AthleteProfileModal from '../components/AthleteProfileModal';
import CoachProfileModal from '../components/CoachProfileModal';

export default function AcademyDashboard() {
  const { user } = useAuth();

  // Active navigation tab: 'sports' | 'openings' | 'requests' | 'profile'
  const [activeNav, setActiveNav] = useState('sports');

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  // Profile data
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    contactPhone: '',
    email: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    longitude: 80.6480,
    latitude: 16.5062,
    districtPlayers: 0,
    statePlayers: 0,
    nationalPlayers: 0,
    internationalPlayers: 0
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Sports & Memberships
  const [sports, setSports] = useState([]);
  const [selectedSport, setSelectedSport] = useState('');
  const [sportDetails, setSportDetails] = useState({ coaches: [], athletes: [] });
  const [loadingSportDetails, setLoadingSportDetails] = useState(false);

  // Openings
  const [openings, setOpenings] = useState([]);
  const [loadingOpenings, setLoadingOpenings] = useState(false);

  // Requests
  const [athleteRequests, setAthleteRequests] = useState([]);
  const [coachRequests, setCoachRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Modals
  const [showAddSportModal, setShowAddSportModal] = useState(false);
  const [addSportForm, setAddSportForm] = useState({
    sportName: '',
    coachName: '',
    coachAadhaar: '',
    coachNisId: '',
    coachCertificateData: null,
    coachCertificateFileName: '',
    coachTrackAthleteId: ''
  });

  const [showAddCoachModal, setShowAddCoachModal] = useState(false);
  const [addCoachForm, setAddCoachForm] = useState({
    name: '',
    aadhaar: '',
    nisId: '',
    coachTrackAthleteId: '',
    role: 'Coach',
    certificateData: null,
    certificateFileName: ''
  });

  const [showAddAthleteModal, setShowAddAthleteModal] = useState(false);
  const [addAthleteForm, setAddAthleteForm] = useState({
    name: '',
    mobile: '',
    aadhaar: '',
    athleteTrackAthleteId: '',
    negotiatedPayment: 'Negotiated During Joining'
  });

  const [showCreateOpeningModal, setShowCreateOpeningModal] = useState(false);
  const [openingForm, setOpeningForm] = useState({
    sportName: '',
    position: '',
    description: '',
    location: '',
    salary: 'Negotiated During Joining'
  });

  // Certificate Viewer Modal
  const [viewPdfModal, setViewPdfModal] = useState(null);

  // Review Modals
  const [selectedAthleteReview, setSelectedAthleteReview] = useState(null);
  const [selectedAthleteRequest, setSelectedAthleteRequest] = useState(null);

  const [selectedCoachReview, setSelectedCoachReview] = useState(null);
  const [selectedCoachRequest, setSelectedCoachRequest] = useState(null);

  // Initial Data Fetch
  useEffect(() => {
    fetchProfile();
    fetchSports();
    fetchOpenings();
    fetchRequests();
  }, []);

  // Fetch sport details when selected sport changes
  useEffect(() => {
    if (selectedSport) {
      fetchSportDetails(selectedSport);
    }
  }, [selectedSport]);

  const showNotification = (msg, type = 'success') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchProfile = async () => {
    try {
      const res = await api.get('/academy/my/profile');
      if (res.data) {
        setProfile(res.data);
        setProfileForm({
          name: res.data.name || '',
          contactPhone: res.data.contactPhone || '',
          email: res.data.email || '',
          addressLine1: res.data.address?.addressLine1 || '',
          addressLine2: res.data.address?.addressLine2 || '',
          city: res.data.address?.city || res.data.city || '',
          state: res.data.address?.state || res.data.state || '',
          pincode: res.data.address?.pincode || '',
          country: res.data.address?.country || 'India',
          longitude: res.data.location?.coordinates?.[0] ?? 80.6480,
          latitude: res.data.location?.coordinates?.[1] ?? 16.5062,
          districtPlayers: res.data.rankingStats?.districtPlayers || 0,
          statePlayers: res.data.rankingStats?.statePlayers || 0,
          nationalPlayers: res.data.rankingStats?.nationalPlayers || 0,
          internationalPlayers: res.data.rankingStats?.internationalPlayers || 0
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSports = async () => {
    try {
      const res = await api.get('/academy/my/sports');
      if (Array.isArray(res.data)) {
        setSports(res.data);
        if (res.data.length > 0 && !selectedSport) {
          setSelectedSport(res.data[0].sportName);
        }
      }
    } catch (err) {
      console.error('Error fetching sports:', err);
    }
  };

  const fetchSportDetails = async (sport) => {
    setLoadingSportDetails(true);
    try {
      const res = await api.get(`/academy/my/sports/${encodeURIComponent(sport)}/details`);
      setSportDetails(res.data || { coaches: [], athletes: [] });
    } catch (err) {
      console.error('Error fetching sport details:', err);
      setSportDetails({ coaches: [], athletes: [] });
    } finally {
      setLoadingSportDetails(false);
    }
  };

  const fetchOpenings = async () => {
    setLoadingOpenings(true);
    try {
      const res = await api.get('/academy/my/openings');
      setOpenings(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching openings:', err);
    } finally {
      setLoadingOpenings(false);
    }
  };

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await api.get('/academy/my/requests');
      setAthleteRequests(res.data?.athleteRequests || []);
      setCoachRequests(res.data?.coachRequests || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Profile Save
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const payload = {
        name: profileForm.name,
        contactPhone: profileForm.contactPhone,
        email: profileForm.email,
        address: {
          addressLine1: profileForm.addressLine1,
          addressLine2: profileForm.addressLine2,
          city: profileForm.city,
          state: profileForm.state,
          pincode: profileForm.pincode,
          country: profileForm.country
        },
        city: profileForm.city,
        state: profileForm.state,
        location: {
          type: 'Point',
          coordinates: [Number(profileForm.longitude) || 80.6480, Number(profileForm.latitude) || 16.5062]
        },
        rankingStats: {
          districtPlayers: Number(profileForm.districtPlayers) || 0,
          statePlayers: Number(profileForm.statePlayers) || 0,
          nationalPlayers: Number(profileForm.nationalPlayers) || 0,
          internationalPlayers: Number(profileForm.internationalPlayers) || 0
        }
      };

      const res = await api.put('/academy/my/profile', payload);
      setProfile(res.data);
      showNotification('Academy profile updated successfully!');
    } catch (err) {
      console.error('Error saving profile:', err);
      showNotification(err.response?.data?.error || 'Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Browser Geolocation
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      showNotification('Geolocation is not supported by your browser.', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setProfileForm(prev => ({
          ...prev,
          longitude: Number(pos.coords.longitude.toFixed(6)),
          latitude: Number(pos.coords.latitude.toFixed(6))
        }));
        showNotification('Coordinates updated from your current location.');
      },
      (err) => {
        showNotification('Could not retrieve location: ' + err.message, 'error');
      },
      { timeout: 10000 }
    );
  };

  // Add Sport Handler
  const handleAddSportSubmit = async (e) => {
    e.preventDefault();
    if (!addSportForm.sportName) {
      showNotification('Sport name is required.', 'error');
      return;
    }

    try {
      await api.post('/academy/my/sports', addSportForm);
      showNotification(`Sport "${addSportForm.sportName}" added successfully.`);
      setShowAddSportModal(false);
      setAddSportForm({
        sportName: '',
        coachName: '',
        coachAadhaar: '',
        coachNisId: '',
        coachCertificateData: null,
        coachCertificateFileName: '',
        coachTrackAthleteId: ''
      });
      fetchSports();
      setSelectedSport(addSportForm.sportName.trim().toUpperCase());
    } catch (err) {
      console.error('Error adding sport:', err);
      showNotification(err.response?.data?.error || 'Failed to add sport.', 'error');
    }
  };

  // Add Coach to Selected Sport
  const handleAddCoachSubmit = async (e) => {
    e.preventDefault();
    if (!addCoachForm.name) {
      showNotification('Coach name is required.', 'error');
      return;
    }

    try {
      await api.post(`/academy/my/sports/${encodeURIComponent(selectedSport)}/coaches`, addCoachForm);
      showNotification(`Coach added to ${selectedSport} successfully.`);
      setShowAddCoachModal(false);
      setAddCoachForm({
        name: '',
        aadhaar: '',
        nisId: '',
        coachTrackAthleteId: '',
        role: 'Coach',
        certificateData: null,
        certificateFileName: ''
      });
      fetchSportDetails(selectedSport);
      fetchSports();
    } catch (err) {
      console.error('Error adding coach:', err);
      showNotification(err.response?.data?.error || 'Failed to add coach.', 'error');
    }
  };

  // Add Athlete to Selected Sport (Athlete ID is strictly optional)
  const handleAddAthleteSubmit = async (e) => {
    e.preventDefault();
    if (!addAthleteForm.name) {
      showNotification('Athlete name is required.', 'error');
      return;
    }
    if (!addAthleteForm.mobile) {
      showNotification('Athlete mobile is required.', 'error');
      return;
    }

    try {
      await api.post(`/academy/my/sports/${encodeURIComponent(selectedSport)}/athletes`, addAthleteForm);
      showNotification(`Athlete added to ${selectedSport} successfully.`);
      setShowAddAthleteModal(false);
      setAddAthleteForm({
        name: '',
        mobile: '',
        aadhaar: '',
        athleteTrackAthleteId: '',
        negotiatedPayment: 'Negotiated During Joining'
      });
      fetchSportDetails(selectedSport);
      fetchSports();
    } catch (err) {
      console.error('Error adding athlete:', err);
      showNotification(err.response?.data?.error || 'Failed to add athlete.', 'error');
    }
  };

  // Openings actions
  const handleCreateOpeningSubmit = async (e) => {
    e.preventDefault();
    if (!openingForm.sportName || !openingForm.position) {
      showNotification('Sport and position are required.', 'error');
      return;
    }

    try {
      await api.post('/academy/my/openings', openingForm);
      showNotification('Opening published successfully.');
      setShowCreateOpeningModal(false);
      setOpeningForm({
        sportName: '',
        position: '',
        description: '',
        location: `${profile?.city || ''}, ${profile?.state || ''}`.trim(),
        salary: 'Negotiated During Joining'
      });
      fetchOpenings();
    } catch (err) {
      console.error('Error creating opening:', err);
      showNotification(err.response?.data?.error || 'Failed to create opening.', 'error');
    }
  };

  const handleToggleOpeningStatus = async (openingId, currentStatus) => {
    try {
      await api.patch(`/academy/my/openings/${openingId}/status`, {
        status: currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN'
      });
      showNotification('Opening status updated.');
      fetchOpenings();
    } catch (err) {
      console.error('Error updating opening status:', err);
      showNotification('Failed to update opening status.', 'error');
    }
  };

  const handleDeleteOpening = async (openingId) => {
    if (!window.confirm('Are you sure you want to delete this opening?')) return;
    try {
      await api.delete(`/academy/my/openings/${openingId}`);
      showNotification('Opening removed.');
      fetchOpenings();
    } catch (err) {
      console.error('Error deleting opening:', err);
      showNotification('Failed to delete opening.', 'error');
    }
  };

  // Request Review & Decision Actions
  const handleReviewAthlete = async (req) => {
    try {
      setSelectedAthleteRequest(req);
      if (req.athleteUserId?._id || req.athleteUserId) {
        const userId = req.athleteUserId._id || req.athleteUserId;
        const res = await api.get(`/academy/athletes/${userId}/full-portfolio`);
        setSelectedAthleteReview(res.data);
      } else {
        setSelectedAthleteReview({ athlete: { name: req.name, sport: req.sportName } });
      }
    } catch (err) {
      console.error('Error fetching full portfolio:', err);
      setSelectedAthleteReview({ athlete: { name: req.name, sport: req.sportName } });
    }
  };

  const handleAcceptAthleteRequest = async (requestId) => {
    try {
      await api.post(`/academy/my/athlete-requests/${requestId}/accept`);
      showNotification('Athlete request accepted. Added to sport membership.');
      fetchRequests();
      fetchSports();
      if (selectedSport) fetchSportDetails(selectedSport);
    } catch (err) {
      console.error('Error accepting athlete request:', err);
      showNotification(err.response?.data?.error || 'Failed to accept request.', 'error');
    }
  };

  const handleRejectAthleteRequest = async (requestId) => {
    try {
      await api.post(`/academy/my/athlete-requests/${requestId}/reject`);
      showNotification('Athlete request rejected.');
      fetchRequests();
    } catch (err) {
      console.error('Error rejecting athlete request:', err);
      showNotification(err.response?.data?.error || 'Failed to reject request.', 'error');
    }
  };

  const handleReviewCoach = async (req) => {
    try {
      setSelectedCoachRequest(req);
      if (req.coachUserId?._id || req.coachUserId) {
        const userId = req.coachUserId._id || req.coachUserId;
        const res = await api.get(`/academy/coaches/${userId}/full-profile`);
        setSelectedCoachReview(res.data?.coach || req.coachUserId);
      } else {
        setSelectedCoachReview({
          name: req.name,
          sport: req.sportName,
          nisId: req.nisId,
          certificateData: req.certificateData,
          certificateFileName: req.certificateFileName
        });
      }
    } catch (err) {
      console.error('Error fetching coach profile:', err);
      setSelectedCoachReview({
        name: req.name,
        sport: req.sportName,
        nisId: req.nisId,
        certificateData: req.certificateData,
        certificateFileName: req.certificateFileName
      });
    }
  };

  const handleAcceptCoachRequest = async (requestId) => {
    try {
      await api.post(`/academy/my/coach-requests/${requestId}/accept`);
      showNotification('Coach application accepted. Assigned to sport.');
      fetchRequests();
      fetchSports();
      if (selectedSport) fetchSportDetails(selectedSport);
    } catch (err) {
      console.error('Error accepting coach application:', err);
      showNotification(err.response?.data?.error || 'Failed to accept coach.', 'error');
    }
  };

  const handleRejectCoachRequest = async (requestId) => {
    try {
      await api.post(`/academy/my/coach-requests/${requestId}/reject`);
      showNotification('Coach application rejected.');
      fetchRequests();
    } catch (err) {
      console.error('Error rejecting coach application:', err);
      showNotification(err.response?.data?.error || 'Failed to reject coach.', 'error');
    }
  };

  // Helper for reading PDF / files as Base64 Data URL
  const handleFileUpload = (e, setter) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setter(reader.result, file.name);
    };
    reader.readAsDataURL(file);
  };

  const pendingRequestsCount =
    athleteRequests.filter(r => r.status === 'PENDING').length +
    coachRequests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast / Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between shadow-sm transition-all ${
            feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{feedback.msg}</span>
          <button onClick={() => setFeedback(null)} className="cursor-pointer ml-4 font-bold">×</button>
        </div>
      )}

      {/* HEADER HERO */}
      <div className="bg-gradient-to-r from-[#173d3c] via-[#123130] to-[#0c292c] border border-[#2f6d5a] p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#cc694e]" /> Verified Sports Academy
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono text-[#c5d3ce] border border-white/20">
              TrackAthlete Facility
            </span>
          </div>
          <h1 className="text-3xl font-normal text-white" style={{ fontFamily: 'Georgia, serif' }}>
            {profile?.name || user?.name || 'Sports Academy'} <em style={{ color: '#b9d9bf', fontStyle: 'italic' }}>Portal</em>
          </h1>
          <p className="text-xs text-[#c5d3ce] mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#e9a68e]" />
              {profile?.city || profile?.address?.city || 'India'}, {profile?.state || profile?.address?.state || ''}
            </span>
            <span>·</span>
            <span>Sports Offered: {sports.map(s => s.sportName).join(', ') || 'None Registered'}</span>
          </p>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/15 text-center">
            <div className="text-xs text-[#c5d3ce]">Active Sports</div>
            <div className="text-lg font-bold text-white">{sports.length}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/15 text-center">
            <div className="text-xs text-[#c5d3ce]">Openings</div>
            <div className="text-lg font-bold text-white">{openings.filter(o => o.status === 'OPEN').length}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/15 text-center">
            <div className="text-xs text-[#c5d3ce]">Pending Requests</div>
            <div className="text-lg font-bold text-[#f59e0b]">{pendingRequestsCount}</div>
          </div>
        </div>
      </div>

      {/* HORIZONTAL NAVIGATION BAR */}
      <div className="flex items-center gap-2 border-b border-[#cbd5e1] pb-1 overflow-x-auto">
        <button
          id="tab-sports"
          type="button"
          onClick={() => setActiveNav('sports')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
            activeNav === 'sports'
              ? 'bg-[#173d3c] text-white shadow-sm'
              : 'text-[#526668] hover:bg-[#f1f5f9]'
          }`}
        >
          <Trophy className="w-4 h-4" />
          SPORTS DETAILS
        </button>

        <button
          id="tab-openings"
          type="button"
          onClick={() => setActiveNav('openings')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
            activeNav === 'openings'
              ? 'bg-[#173d3c] text-white shadow-sm'
              : 'text-[#526668] hover:bg-[#f1f5f9]'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          OPENINGS
        </button>

        <button
          id="tab-requests"
          type="button"
          onClick={() => setActiveNav('requests')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap relative ${
            activeNav === 'requests'
              ? 'bg-[#173d3c] text-white shadow-sm'
              : 'text-[#526668] hover:bg-[#f1f5f9]'
          }`}
        >
          <Inbox className="w-4 h-4" />
          REQUESTS
          {pendingRequestsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e07050] text-white">
              {pendingRequestsCount}
            </span>
          )}
        </button>

        <button
          id="tab-profile"
          type="button"
          onClick={() => setActiveNav('profile')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
            activeNav === 'profile'
              ? 'bg-[#173d3c] text-white shadow-sm'
              : 'text-[#526668] hover:bg-[#f1f5f9]'
          }`}
        >
          <Building2 className="w-4 h-4" />
          ACADEMY PROFILE
        </button>
      </div>

      {/* =========================================================================
          TAB 1: SPORTS DETAILS
          ========================================================================= */}
      {activeNav === 'sports' && (
        <div className="space-y-6">
          {/* Sports Bar & + Add Sport */}
          <div className="bg-white border border-[#e2e8f0] p-4 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#526668] uppercase tracking-wider mr-1">Disciplines:</span>
              {sports.length === 0 ? (
                <span className="text-xs text-gray-500 italic">No sports added yet.</span>
              ) : (
                sports.map((sp) => {
                  const isActive = selectedSport === sp.sportName;
                  return (
                    <button
                      key={sp.sportName}
                      type="button"
                      onClick={() => setSelectedSport(sp.sportName)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                        isActive
                          ? 'bg-[#2f6d5a] text-white shadow-sm'
                          : 'bg-[#f4f6f4] text-[#173235] hover:bg-[#e8eee9] border border-[#dce4de]'
                      }`}
                    >
                      <span>{sp.sportName}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-700'}`}>
                        {sp.coachCount || 0}C / {sp.athleteCount || 0}A
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowAddSportModal(true)}
              className="px-4 py-2 rounded-xl bg-[#e07050] hover:bg-[#c85c40] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm self-start md:self-auto"
            >
              <Plus className="w-4 h-4" /> Add Sport
            </button>
          </div>

          {/* Selected Sport Details View */}
          {selectedSport ? (
            <div className="space-y-6">
              {/* Sport Section Title */}
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <div>
                  <h2 className="text-xl font-bold text-[#173235] flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-[#2f6d5a]" />
                    {selectedSport} <span className="text-sm font-normal text-gray-500">Facility Roster</span>
                  </h2>
                </div>
              </div>

              {/* COACHES SUBSECTION */}
              <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-[#2f6d5a]" />
                    <h3 className="font-bold text-sm text-[#173235] uppercase tracking-wider">
                      Coaches ({sportDetails.coaches?.length || 0})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddCoachModal(true)}
                    className="px-3 py-1.5 rounded-lg border border-[#2f6d5a] text-[#2f6d5a] hover:bg-[#f0f7f4] text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Coach
                  </button>
                </div>

                {loadingSportDetails ? (
                  <div className="text-center py-6 text-xs text-gray-500">Loading coaching staff...</div>
                ) : !sportDetails.coaches || sportDetails.coaches.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
                    <p className="text-xs text-gray-500">No coaches assigned to {selectedSport} yet.</p>
                    <button
                      type="button"
                      onClick={() => setShowAddCoachModal(true)}
                      className="mt-2 text-xs font-bold text-[#2f6d5a] hover:underline"
                    >
                      + Add Coach to {selectedSport}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sportDetails.coaches.map((c) => (
                      <div
                        key={c._id}
                        className="border border-[#e2e8f0] bg-[#fbfdfb] rounded-xl p-4 flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-bold text-sm text-[#173235]">{c.name}</h4>
                              <span className="text-[11px] text-gray-500">{c.role || 'Coach'}</span>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                c.coachUserId
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {c.coachUserId ? 'Linked Account' : 'Academy Added'}
                            </span>
                          </div>

                          <div className="mt-3 space-y-1 text-xs text-gray-600">
                            <div>
                              <span className="text-gray-400">Coach ID: </span>
                              <strong className="font-mono text-gray-800">{c.coachId || 'Not Linked'}</strong>
                            </div>
                            <div>
                              <span className="text-gray-400">NIS ID: </span>
                              <strong>{c.nisId || '—'}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                          {c.certificateData ? (
                            <button
                              type="button"
                              onClick={() => setViewPdfModal({ title: `${c.name} Certificate`, data: c.certificateData })}
                              className="text-xs font-bold text-[#2f6d5a] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" /> View Certificate
                            </button>
                          ) : (
                            <span className="text-[11px] text-gray-400 italic">No cert attached</span>
                          )}

                          {c.coachUserId && (
                            <button
                              type="button"
                              onClick={() => handleReviewCoach({ coachUserId: c.coachUserId, name: c.name, sportName: selectedSport })}
                              className="text-xs text-gray-600 hover:text-black font-semibold flex items-center gap-0.5 cursor-pointer"
                            >
                              Profile <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ATHLETES SUBSECTION */}
              <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#2f6d5a]" />
                    <h3 className="font-bold text-sm text-[#173235] uppercase tracking-wider">
                      Enrolled Athletes ({sportDetails.athletes?.length || 0})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddAthleteModal(true)}
                    className="px-3 py-1.5 rounded-lg border border-[#2f6d5a] text-[#2f6d5a] hover:bg-[#f0f7f4] text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Add Athlete
                  </button>
                </div>

                {loadingSportDetails ? (
                  <div className="text-center py-6 text-xs text-gray-500">Loading athlete roster...</div>
                ) : !sportDetails.athletes || sportDetails.athletes.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
                    <p className="text-xs text-gray-500">No athletes enrolled in {selectedSport} yet.</p>
                    <button
                      type="button"
                      onClick={() => setShowAddAthleteModal(true)}
                      className="mt-2 text-xs font-bold text-[#2f6d5a] hover:underline"
                    >
                      + Add Athlete to {selectedSport}
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-700">
                      <thead className="bg-[#f8faf8] text-gray-500 font-bold uppercase tracking-wider border-b border-gray-200">
                        <tr>
                          <th className="py-2.5 px-3">Athlete Name</th>
                          <th className="py-2.5 px-3">TrackAthlete ID</th>
                          <th className="py-2.5 px-3">Contact</th>
                          <th className="py-2.5 px-3">Enrolled Source</th>
                          <th className="py-2.5 px-3">Joining Terms</th>
                          <th className="py-2.5 px-3 text-right">Portfolio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sportDetails.athletes.map((a) => (
                          <tr key={a._id} className="hover:bg-[#fcfdfc]">
                            <td className="py-3 px-3 font-semibold text-[#173235]">{a.name}</td>
                            <td className="py-3 px-3 font-mono text-gray-600">{a.athleteId || 'Not Linked'}</td>
                            <td className="py-3 px-3">{a.mobile || '—'}</td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  a.athleteUserId || a.athleteId
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {a.athleteUserId || a.athleteId ? 'Linked' : 'Offline'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-gray-600">{a.negotiatedPayment || 'Negotiated'}</td>
                            <td className="py-3 px-3 text-right">
                              {a.athleteUserId ? (
                                <button
                                  type="button"
                                  onClick={() => handleReviewAthlete({ athleteUserId: a.athleteUserId, name: a.name, sportName: selectedSport })}
                                  className="px-2.5 py-1 rounded bg-[#2f6d5a] hover:bg-[#235344] text-white text-[11px] font-bold cursor-pointer"
                                >
                                  View Portfolio
                                </button>
                              ) : (
                                <span className="text-[11px] text-gray-400 italic">Offline Record</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-white border border-[#e2e8f0] rounded-2xl">
              <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">Please select or add a sport discipline above to view its coaches and athletes.</p>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: OPENINGS
          ========================================================================= */}
      {activeNav === 'openings' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#e2e8f0] p-4 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#173235] uppercase tracking-wider">
                Coach Hiring Openings
              </h2>
              <p className="text-xs text-gray-500">
                Publish coaching roles visible to certified TrackAthlete coaches matching your sport disciplines.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateOpeningModal(true)}
              className="px-4 py-2 rounded-xl bg-[#e07050] hover:bg-[#c85c40] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm self-start md:self-auto"
            >
              <Plus className="w-4 h-4" /> Create Opening
            </button>
          </div>

          {loadingOpenings ? (
            <div className="text-center py-12 text-xs text-gray-500">Loading academy openings...</div>
          ) : openings.length === 0 ? (
            <div className="text-center py-16 bg-white border border-[#e2e8f0] rounded-2xl">
              <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">No coach openings published yet.</p>
              <button
                type="button"
                onClick={() => setShowCreateOpeningModal(true)}
                className="mt-3 px-4 py-2 rounded-xl bg-[#2f6d5a] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                + Post Your First Opening
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {openings.map((op) => (
                <div
                  key={op._id}
                  className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#eef6f2] text-[#2f6d5a] border border-[#b9d9bf]">
                          {op.sportName}
                        </span>
                        <h3 className="font-bold text-base text-[#173235] mt-1.5">{op.position}</h3>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          op.status === 'OPEN'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {op.status}
                      </span>
                    </div>

                    {op.description && (
                      <p className="text-xs text-gray-600 mt-2 line-clamp-3">{op.description}</p>
                    )}

                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-xs text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span>{op.location || 'Facility On-Site'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>Salary: <strong>{op.salary}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => handleToggleOpeningStatus(op._id, op.status)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer ${
                        op.status === 'OPEN'
                          ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                          : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {op.status === 'OPEN' ? 'Close Opening' : 'Re-open Opening'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteOpening(op._id)}
                      className="text-xs text-rose-600 hover:text-rose-800 p-1.5 rounded hover:bg-rose-50 cursor-pointer"
                      title="Delete Opening"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: REQUESTS
          ========================================================================= */}
      {activeNav === 'requests' && (
        <div className="space-y-8">
          {/* Athlete Join Requests */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="border-b border-gray-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#173235] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#2f6d5a]" />
                  Athlete Admission Requests ({athleteRequests.length})
                </h3>
                <p className="text-xs text-gray-500">
                  Athletes applying to join your training academy. Review their complete TrackAthlete portfolio before accepting.
                </p>
              </div>
            </div>

            {loadingRequests ? (
              <div className="text-center py-6 text-xs text-gray-500">Loading athlete requests...</div>
            ) : athleteRequests.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400 italic">
                No athlete admission requests received yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-700">
                  <thead className="bg-[#f8faf8] text-gray-500 font-bold uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-3">Athlete Name</th>
                      <th className="py-2.5 px-3">Athlete ID</th>
                      <th className="py-2.5 px-3">Sport</th>
                      <th className="py-2.5 px-3">Contact</th>
                      <th className="py-2.5 px-3">Expected Terms</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {athleteRequests.map((r) => (
                      <tr key={r._id} className="hover:bg-[#fcfdfc]">
                        <td className="py-3 px-3 font-semibold text-[#173235]">{r.name}</td>
                        <td className="py-3 px-3 font-mono text-gray-600">{r.athleteId || 'Not Linked'}</td>
                        <td className="py-3 px-3 font-bold text-[#2f6d5a]">{r.sportName}</td>
                        <td className="py-3 px-3">{r.mobile || '—'}</td>
                        <td className="py-3 px-3 text-gray-600">{r.joiningPayment || 'Negotiated'}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.status === 'ACCEPTED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleReviewAthlete(r)}
                            className="px-2.5 py-1 rounded bg-[#2f6d5a] hover:bg-[#235344] text-white text-[11px] font-bold cursor-pointer"
                          >
                            View Full Portfolio
                          </button>
                          {r.status === 'PENDING' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAcceptAthleteRequest(r._id)}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectAthleteRequest(r._id)}
                                className="px-2.5 py-1 rounded border border-rose-300 text-rose-700 hover:bg-rose-50 text-[11px] font-bold cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Coach Job Applications */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="border-b border-gray-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#173235] flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-[#2f6d5a]" />
                  Coach Job Applications ({coachRequests.length})
                </h3>
                <p className="text-xs text-gray-500">
                  Certified coaches applying for published openings. Review credentials and certifications before accepting.
                </p>
              </div>
            </div>

            {loadingRequests ? (
              <div className="text-center py-6 text-xs text-gray-500">Loading coach applications...</div>
            ) : coachRequests.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400 italic">
                No coach applications received yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-700">
                  <thead className="bg-[#f8faf8] text-gray-500 font-bold uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-3">Coach Name</th>
                      <th className="py-2.5 px-3">Coach ID</th>
                      <th className="py-2.5 px-3">NIS ID</th>
                      <th className="py-2.5 px-3">Sport</th>
                      <th className="py-2.5 px-3">Certificate</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {coachRequests.map((c) => (
                      <tr key={c._id} className="hover:bg-[#fcfdfc]">
                        <td className="py-3 px-3 font-semibold text-[#173235]">{c.name}</td>
                        <td className="py-3 px-3 font-mono text-gray-600">{c.coachId || 'Not Linked'}</td>
                        <td className="py-3 px-3">{c.nisId || '—'}</td>
                        <td className="py-3 px-3 font-bold text-[#2f6d5a]">{c.sportName}</td>
                        <td className="py-3 px-3">
                          {c.certificateData ? (
                            <button
                              type="button"
                              onClick={() => setViewPdfModal({ title: `${c.name} Certificate`, data: c.certificateData })}
                              className="text-xs font-bold text-[#2f6d5a] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" /> PDF
                            </button>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              c.status === 'ACCEPTED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : c.status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleReviewCoach(c)}
                            className="px-2.5 py-1 rounded bg-[#2f6d5a] hover:bg-[#235344] text-white text-[11px] font-bold cursor-pointer"
                          >
                            View Full Profile
                          </button>
                          {c.status === 'PENDING' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAcceptCoachRequest(c._id)}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectCoachRequest(c._id)}
                                className="px-2.5 py-1 rounded border border-rose-300 text-rose-700 hover:bg-rose-50 text-[11px] font-bold cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: ACADEMY PROFILE
          ========================================================================= */}
      {activeNav === 'profile' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-5">
            <div className="border-b border-gray-200 pb-3">
              <h2 className="text-base font-bold text-[#173235] uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#2f6d5a]" />
                Academy Information & Contact
              </h2>
              <p className="text-xs text-gray-500">
                Facility identity displayed across national discovery and athlete recommendations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Academy Name *
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Contact Phone *
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.contactPhone}
                  onChange={(e) => setProfileForm({ ...profileForm, contactPhone: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Official Email
                </label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>
            </div>
          </div>

          {/* Structured Address */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-5">
            <div className="border-b border-gray-200 pb-3">
              <h2 className="text-base font-bold text-[#173235] uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#2f6d5a]" />
                Structured Physical Address
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Address Line 1
                </label>
                <input
                  type="text"
                  value={profileForm.addressLine1}
                  onChange={(e) => setProfileForm({ ...profileForm, addressLine1: e.target.value })}
                  placeholder="Plot No., Street, Landmark"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={profileForm.addressLine2}
                  onChange={(e) => setProfileForm({ ...profileForm, addressLine2: e.target.value })}
                  placeholder="Area, Sector"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={profileForm.city}
                  onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={profileForm.state}
                  onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Pincode
                </label>
                <input
                  type="text"
                  value={profileForm.pincode}
                  onChange={(e) => setProfileForm({ ...profileForm, pincode: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={profileForm.country}
                  onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>
            </div>
          </div>

          {/* GeoJSON Coordinates & Location Button */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-5">
            <div className="border-b border-gray-200 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#173235] uppercase tracking-wider flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[#2f6d5a]" />
                  GeoJSON Coordinates [Longitude, Latitude]
                </h2>
                <p className="text-xs text-gray-500">
                  Used by MongoDB 2dsphere indexing for nearest-facility athlete search.
                </p>
              </div>

              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="px-3 py-1.5 rounded-lg bg-[#eef6f2] hover:bg-[#dcefe5] text-[#2f6d5a] border border-[#2f6d5a] text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
              >
                <MapPin className="w-3.5 h-3.5" /> Use My Current Location
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Longitude (lng)
                </label>
                <input
                  type="number"
                  step="any"
                  value={profileForm.longitude}
                  onChange={(e) => setProfileForm({ ...profileForm, longitude: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Latitude (lat)
                </label>
                <input
                  type="number"
                  step="any"
                  value={profileForm.latitude}
                  onChange={(e) => setProfileForm({ ...profileForm, latitude: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>
            </div>
          </div>

          {/* Ranking Statistics */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-5">
            <div className="border-b border-gray-200 pb-3">
              <h2 className="text-base font-bold text-[#173235] uppercase tracking-wider flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#cc694e]" />
                Academy Ranking & Representation Statistics
              </h2>
              <p className="text-xs text-gray-500">
                Number of players trained at your facility who achieved competitive representation.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#f8faf8] border border-gray-200 rounded-xl p-3 text-center">
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                  District Players
                </label>
                <input
                  type="number"
                  min="0"
                  value={profileForm.districtPlayers}
                  onChange={(e) => setProfileForm({ ...profileForm, districtPlayers: e.target.value })}
                  className="w-full text-center py-1.5 text-base font-bold border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div className="bg-[#f8faf8] border border-gray-200 rounded-xl p-3 text-center">
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                  State Players
                </label>
                <input
                  type="number"
                  min="0"
                  value={profileForm.statePlayers}
                  onChange={(e) => setProfileForm({ ...profileForm, statePlayers: e.target.value })}
                  className="w-full text-center py-1.5 text-base font-bold border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div className="bg-[#f8faf8] border border-gray-200 rounded-xl p-3 text-center">
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                  National Players
                </label>
                <input
                  type="number"
                  min="0"
                  value={profileForm.nationalPlayers}
                  onChange={(e) => setProfileForm({ ...profileForm, nationalPlayers: e.target.value })}
                  className="w-full text-center py-1.5 text-base font-bold border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div className="bg-[#f8faf8] border border-gray-200 rounded-xl p-3 text-center">
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                  International
                </label>
                <input
                  type="number"
                  min="0"
                  value={profileForm.internationalPlayers}
                  onChange={(e) => setProfileForm({ ...profileForm, internationalPlayers: e.target.value })}
                  className="w-full text-center py-1.5 text-base font-bold border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-6 py-2.5 rounded-xl bg-[#e07050] hover:bg-[#c85c40] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md transition-all"
            >
              <Save className="w-4 h-4" /> {savingProfile ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      )}

      {/* =========================================================================
          MODAL: ADD SPORT
          ========================================================================= */}
      {showAddSportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-[#173235] flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#2f6d5a]" /> Add Sport Discipline
              </h3>
              <button
                type="button"
                onClick={() => setShowAddSportModal(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Sport Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CRICKET, BADMINTON, TENNIS"
                  value={addSportForm.sportName}
                  onChange={(e) => setAddSportForm({ ...addSportForm, sportName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div className="pt-2 border-t border-gray-100">
                <h4 className="text-xs font-bold text-gray-800 uppercase mb-2">
                  Head Coach Assignment (Optional)
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                      Coach Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Kumar"
                      value={addSportForm.coachName}
                      onChange={(e) => setAddSportForm({ ...addSportForm, coachName: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                        Coach Aadhaar (12 Digits)
                      </label>
                      <input
                        type="text"
                        maxLength="12"
                        placeholder="12 digits"
                        value={addSportForm.coachAadhaar}
                        onChange={(e) => setAddSportForm({ ...addSportForm, coachAadhaar: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                        NIS ID (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. NIS-2024-098"
                        value={addSportForm.coachNisId}
                        onChange={(e) => setAddSportForm({ ...addSportForm, coachNisId: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                      TrackAthlete Coach ID (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Optional (leave blank if offline)"
                      value={addSportForm.coachTrackAthleteId}
                      onChange={(e) => setAddSportForm({ ...addSportForm, coachTrackAthleteId: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">Optional. If unlinked, coach is stored as an offline academy record.</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                      Coach Certificate PDF
                    </label>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => handleFileUpload(e, (data, name) => {
                        setAddSportForm(prev => ({ ...prev, coachCertificateData: data, coachCertificateFileName: name }));
                      })}
                      className="w-full text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-[#eef6f2] file:text-[#2f6d5a] cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddSportModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-bold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#2f6d5a] hover:bg-[#235344] text-white text-xs font-bold uppercase tracking-wider"
                >
                  Add Sport Discipline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD COACH TO SELECTED SPORT
          ========================================================================= */}
      {showAddCoachModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-[#173235] flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#2f6d5a]" /> Add Coach to {selectedSport}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCoachModal(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCoachSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Coach Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Suresh Raina"
                  value={addCoachForm.name}
                  onChange={(e) => setAddCoachForm({ ...addCoachForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Role
                </label>
                <input
                  type="text"
                  placeholder="e.g. Head Coach, Assistant Coach, Fitness Trainer"
                  value={addCoachForm.role}
                  onChange={(e) => setAddCoachForm({ ...addCoachForm, role: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Aadhaar (12 Digits)
                  </label>
                  <input
                    type="text"
                    maxLength="12"
                    placeholder="12 digits"
                    value={addCoachForm.aadhaar}
                    onChange={(e) => setAddCoachForm({ ...addCoachForm, aadhaar: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    NIS ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NIS-XXXX"
                    value={addCoachForm.nisId}
                    onChange={(e) => setAddCoachForm({ ...addCoachForm, nisId: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  TrackAthlete Coach ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Optional (leave blank if offline)"
                  value={addCoachForm.coachTrackAthleteId}
                  onChange={(e) => setAddCoachForm({ ...addCoachForm, coachTrackAthleteId: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">Optional. If not entered, coach remains an unlinked offline record.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Certificate PDF (Optional)
                </label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => handleFileUpload(e, (data, name) => {
                    setAddCoachForm(prev => ({ ...prev, certificateData: data, certificateFileName: name }));
                  })}
                  className="w-full text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-[#eef6f2] file:text-[#2f6d5a] cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddCoachModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-bold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#2f6d5a] hover:bg-[#235344] text-white text-xs font-bold uppercase tracking-wider"
                >
                  Assign Coach
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD ATHLETE TO SELECTED SPORT
          ========================================================================= */}
      {showAddAthleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-[#173235] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#2f6d5a]" /> Add Athlete to {selectedSport}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddAthleteModal(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAthleteSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Athlete Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rohit Sharma"
                  value={addAthleteForm.name}
                  onChange={(e) => setAddAthleteForm({ ...addAthleteForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Mobile Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter 10-digit mobile number"
                  value={addAthleteForm.mobile}
                  onChange={(e) => setAddAthleteForm({ ...addAthleteForm, mobile: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Aadhaar (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength="12"
                    placeholder="12 digits"
                    value={addAthleteForm.aadhaar}
                    onChange={(e) => setAddAthleteForm({ ...addAthleteForm, aadhaar: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Athlete ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Optional (leave blank if offline)"
                    value={addAthleteForm.athleteTrackAthleteId}
                    onChange={(e) => setAddAthleteForm({ ...addAthleteForm, athleteTrackAthleteId: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Joining Payment / Fee Structure
                </label>
                <input
                  type="text"
                  value={addAthleteForm.negotiatedPayment}
                  onChange={(e) => setAddAthleteForm({ ...addAthleteForm, negotiatedPayment: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddAthleteModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-bold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#2f6d5a] hover:bg-[#235344] text-white text-xs font-bold uppercase tracking-wider"
                >
                  Enroll Athlete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CREATE OPENING
          ========================================================================= */}
      {showCreateOpeningModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-[#173235] flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#2f6d5a]" /> Post Coach Opening
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateOpeningModal(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOpeningSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Sport Discipline *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CRICKET"
                  value={openingForm.sportName}
                  onChange={(e) => setOpeningForm({ ...openingForm, sportName: e.target.value })}
                  list="academy-sports-list"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
                <datalist id="academy-sports-list">
                  {sports.map(s => <option key={s.sportName} value={s.sportName} />)}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Role / Position *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Bowling Coach, Fitness Specialist"
                  value={openingForm.position}
                  onChange={(e) => setOpeningForm({ ...openingForm, position: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Job Description
                </label>
                <textarea
                  rows="3"
                  placeholder="Requirements, coaching schedules, expected qualifications..."
                  value={openingForm.description}
                  onChange={(e) => setOpeningForm({ ...openingForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={openingForm.location}
                    onChange={(e) => setOpeningForm({ ...openingForm, location: e.target.value })}
                    placeholder="City / On-site"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Salary / Terms
                  </label>
                  <input
                    type="text"
                    value={openingForm.salary}
                    onChange={(e) => setOpeningForm({ ...openingForm, salary: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateOpeningModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-bold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#2f6d5a] hover:bg-[#235344] text-white text-xs font-bold uppercase tracking-wider"
                >
                  Publish Opening
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CERTIFICATE VIEWER
          ========================================================================= */}
      {viewPdfModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-4 shadow-2xl border border-gray-300 flex flex-col h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="font-bold text-sm text-[#173235] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#2f6d5a]" /> {viewPdfModal.title || 'Verified Certificate Document'}
              </h3>
              <button
                type="button"
                onClick={() => setViewPdfModal(null)}
                className="text-gray-400 hover:text-black"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 my-3 border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
              <iframe
                src={viewPdfModal.data}
                title="Certificate"
                className="w-full h-full border-0"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <a
                href={viewPdfModal.data}
                download="Certificate.pdf"
                className="px-4 py-1.5 rounded-lg bg-[#2f6d5a] text-white text-xs font-bold"
              >
                Download Document
              </a>
              <button
                type="button"
                onClick={() => setViewPdfModal(null)}
                className="px-4 py-1.5 rounded-lg border border-gray-300 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ATHLETE FULL PORTFOLIO REVIEW
          ========================================================================= */}
      {selectedAthleteReview && (
        <AthleteProfileModal
          athlete={selectedAthleteReview.athlete}
          request={selectedAthleteRequest}
          isOpen={true}
          onClose={() => {
            setSelectedAthleteReview(null);
            setSelectedAthleteRequest(null);
          }}
          onAccept={selectedAthleteRequest ? () => handleAcceptAthleteRequest(selectedAthleteRequest._id) : null}
          onReject={selectedAthleteRequest ? () => handleRejectAthleteRequest(selectedAthleteRequest._id) : null}
        />
      )}

      {/* =========================================================================
          MODAL: COACH FULL PROFILE REVIEW
          ========================================================================= */}
      {selectedCoachReview && (
        <CoachProfileModal
          coach={selectedCoachReview}
          request={selectedCoachRequest}
          isOpen={true}
          onClose={() => {
            setSelectedCoachReview(null);
            setSelectedCoachRequest(null);
          }}
          onAccept={selectedCoachRequest ? () => handleAcceptCoachRequest(selectedCoachRequest._id) : null}
          onReject={selectedCoachRequest ? () => handleRejectCoachRequest(selectedCoachRequest._id) : null}
        />
      )}
    </div>
  );
}
