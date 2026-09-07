import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  MapPin,
  Compass,
  Trophy,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  UploadCloud,
  FileText,
  X,
  Loader2,
  UsersRound,
  UserRound,
  CalendarPlus,
  HeartHandshake,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const roleOptions = [
  { id: 'athlete', label: 'Athlete', icon: UserRound },
  { id: 'parent', label: 'Parent', icon: UsersRound },
  { id: 'coach', label: 'Coach', icon: UsersRound },
  { id: 'sponsor', label: 'Sponsor', icon: HeartHandshake },
  { id: 'organizer', label: 'Organizer', icon: CalendarPlus }
];

export default function AcademySignup({ onSwitchRole, onSwitchToSignIn }) {
  const { signup } = useAuth();
  const navigate = useNavigate();

  // Role Switcher Dropdown
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  // Form State
  const [academyName, setAcademyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Address
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [country, setCountry] = useState('India');

  // Location
  const [longitude, setLongitude] = useState(80.6480);
  const [latitude, setLatitude] = useState(16.5062);
  const [locating, setLocating] = useState(false);

  // Representation Stats
  const [districtPlayers, setDistrictPlayers] = useState(0);
  const [statePlayers, setStatePlayers] = useState(0);
  const [nationalPlayers, setNationalPlayers] = useState(0);
  const [internationalPlayers, setInternationalPlayers] = useState(0);

  // Sports & Coaches
  const [sports, setSports] = useState([
    {
      sportName: '',
      coachName: '',
      coachAadhaar: '',
      coachNisId: '',
      coachCertificateData: null,
      coachCertificateFileName: '',
      coachTrackAthleteId: ''
    }
  ]);

  // Submission Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add & Remove Sport
  const handleAddSport = () => {
    setSports(prev => [
      ...prev,
      {
        sportName: '',
        coachName: '',
        coachAadhaar: '',
        coachNisId: '',
        coachCertificateData: null,
        coachCertificateFileName: '',
        coachTrackAthleteId: ''
      }
    ]);
  };

  const handleRemoveSport = (index) => {
    if (sports.length <= 1) return;
    setSports(prev => prev.filter((_, i) => i !== index));
  };

  const handleSportChange = (index, field, value) => {
    setSports(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Certificate Upload
  const handleCertUpload = (e, index) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Certificate file size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      handleSportChange(index, 'coachCertificateData', reader.result);
      handleSportChange(index, 'coachCertificateFileName', file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCert = (index) => {
    handleSportChange(index, 'coachCertificateData', null);
    handleSportChange(index, 'coachCertificateFileName', '');
  };

  // Geolocation
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLongitude(Number(pos.coords.longitude.toFixed(6)));
        setLatitude(Number(pos.coords.latitude.toFixed(6)));
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setError('Could not retrieve current location: ' + err.message);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!agreeTerms) {
      setError('Please agree to the Terms of Service & Privacy Policy to register.');
      return;
    }

    const validSports = sports.filter(s => s.sportName && s.sportName.trim());
    if (validSports.length === 0) {
      setError('Please add at least one sport discipline offered at your academy.');
      return;
    }

    // Validate Aadhaar if coach entered any
    for (const sp of validSports) {
      if (sp.coachAadhaar && sp.coachAadhaar.replace(/\D/g, '').length !== 12) {
        setError(`Coach Aadhaar for ${sp.sportName || 'sport'} must contain exactly 12 digits or be left blank.`);
        return;
      }
    }

    setLoading(true);

    try {
      await signup({
        name: contactName.trim() || academyName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: 'academy',
        city: city.trim(),
        state: state.trim(),
        rememberMe,
        academyName: academyName.trim(),
        contactPhone: contactPhone.trim(),
        address: addressLine1.trim() + (addressLine2 ? ', ' + addressLine2.trim() : ''),
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim(),
        pincode: pincode.trim(),
        country: country.trim() || 'India',
        location: {
          type: 'Point',
          coordinates: [Number(longitude) || 80.6480, Number(latitude) || 16.5062]
        },
        rankingStats: {
          districtPlayers: Number(districtPlayers) || 0,
          statePlayers: Number(statePlayers) || 0,
          nationalPlayers: Number(nationalPlayers) || 0,
          internationalPlayers: Number(internationalPlayers) || 0
        },
        sports: validSports.map(s => ({
          ...s,
          sportName: s.sportName.trim().toUpperCase()
        }))
      });
    } catch (err) {
      console.error('Academy signup error:', err);
      const serverMsg = err.response?.data?.error || err.response?.data?.message || err.message;
      setError(serverMsg || 'Failed to create academy account. Please review your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page lg:!grid-cols-[minmax(360px,30%)_1fr] !grid-cols-1 min-h-screen">
      {/* ── LEFT SIDE: ORIGINAL TRACKATHLETE BRANDING / STORY PANEL ── */}
      <section
        className="login-story lg:sticky lg:top-0 lg:h-screen lg:min-h-screen"
        style={{
          padding: '48px 36px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden'
        }}
      >
        <div className="login-logo">
          <span>ta</span> trackathlete
        </div>
        <div className="story-copy" style={{ margin: 'auto 0', maxWidth: '100%' }}>
          <p className="eyebrow" style={{ letterSpacing: '0.15em', marginBottom: '14px' }}>
            ONE PLATFORM · FIVE VIEWPOINTS
          </p>
          <h1
            style={{
              fontSize: 'clamp(32px, 2.7vw, 44px)',
              lineHeight: 1.06,
              letterSpacing: '-0.04em',
              maxWidth: '100%',
              wordBreak: 'normal',
              overflowWrap: 'normal',
              whiteSpace: 'normal'
            }}
          >
            Every athlete needs a <em>way forward.</em>
          </h1>
          <p
            style={{
              fontSize: '14px',
              lineHeight: 1.7,
              maxWidth: '100%',
              marginTop: '18px',
              color: '#c5d3ce'
            }}
          >
            From the first academy search to a verified opportunity, TrackAthlete helps the people around an athlete make the next decision with confidence.
          </p>
        </div>
        <div className="story-foot">
          <i /> Built for the Indian sports ecosystem
        </div>
      </section>

      {/* ── RIGHT SIDE: ACADEMY REGISTRATION PANEL ── */}
      <section
        className="login-panel min-h-screen py-8 sm:py-10 flex justify-start items-start overflow-y-auto w-full"
        style={{ padding: '32px 36px' }}
      >
        <div className="w-full max-w-5xl">
          {/* Top Help Header / Quick Sign In Link */}
          <div className="flex items-center justify-between pb-3 mb-5 border-b border-[#d8ded5]">
            <p className="login-help !m-0 !text-left text-xs text-[#526668]">
              Organizing a competition? <Link to="/organizer/login" className="text-[#2f6d5a] font-semibold hover:underline">Open Organizer</Link>
            </p>
            <button
              type="button"
              onClick={onSwitchToSignIn}
              className="text-xs font-bold text-[#cc694e] hover:underline cursor-pointer"
            >
              Already registered? Sign In →
            </button>
          </div>

          {/* Heading and Role Switcher */}
          <div className="login-heading mb-6">
            <p className="eyebrow !mb-1 text-[10px] font-extrabold tracking-widest text-[#cc694e] uppercase">
              ACADEMY REGISTRATION
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#173235] tracking-tight m-0" style={{ fontFamily: 'Georgia, serif' }}>
              Create your academy account.
            </h2>
            <p className="text-xs sm:text-sm text-[#697c7c] mt-1 mb-3">
              Fill in your academy facility, contact details, coaching staff, and sports disciplines.
            </p>

            {/* Compact Role Switcher */}
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="inline-flex items-center gap-1.5 text-xs text-[#526668] hover:text-[#173235] font-semibold cursor-pointer py-1 px-2.5 rounded-md bg-black/5 hover:bg-black/10 transition"
              >
                <span>Signing up as an academy</span>
                <span className="text-[#cc694e] font-bold underline decoration-dotted">Change account type</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#cc694e]" />
              </button>

              {showRoleMenu && (
                <div className="absolute left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-[#cbd5e1] p-1.5 z-30 text-left">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">
                    Choose Account Type
                  </div>
                  {roleOptions.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setShowRoleMenu(false);
                          if (opt.id === 'organizer') navigate('/organizer/login');
                          else onSwitchRole(opt.id);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-[#f1f5f9] hover:text-[#173235] rounded-lg transition text-left cursor-pointer"
                      >
                        <Icon className="w-4 h-4 text-[#2f6d5a]" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Global Error Banner */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2.5 shadow-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">Registration Alert: </span>
                {error}
              </div>
              <button type="button" onClick={() => setError('')} className="text-rose-600 hover:text-rose-900 font-bold ml-2">×</button>
            </div>
          )}

          {/* Global Success Banner */}
          {successMsg && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2.5 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form Card */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ─────────────────────────────────────────────────────────────
                SECTION 1: ACADEMY & CONTACT INFORMATION
                ───────────────────────────────────────────────────────────── */}
            <div className="bg-white border border-[#d8ded5] rounded-2xl p-5 sm:p-7 shadow-xs">
              <div className="border-b border-[#e8ede6] pb-3 mb-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#173235] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#2f6d5a]" />
                1. Academy & Administrative Information
              </h2>
              <p className="text-xs text-[#697c7c] mt-0.5">
                Official academy identity and primary administrative contact details.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#173235] uppercase tracking-wider mb-1.5">
                  Academy / Center Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex National Sports Academy"
                  value={academyName}
                  onChange={e => setAcademyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#fcfcfb] border border-[#d8ded5] rounded-xl focus:outline-none focus:border-[#2f6d5a] focus:ring-1 focus:ring-[#2f6d5a] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#173235] uppercase tracking-wider mb-1.5">
                  Contact Person / Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Kumar (Director / Head Coach)"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#fcfcfb] border border-[#d8ded5] rounded-xl focus:outline-none focus:border-[#2f6d5a] focus:ring-1 focus:ring-[#2f6d5a] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#173235] uppercase tracking-wider mb-1.5">
                  Contact Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +91 98765 43210"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#fcfcfb] border border-[#d8ded5] rounded-xl focus:outline-none focus:border-[#2f6d5a] focus:ring-1 focus:ring-[#2f6d5a] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#173235] uppercase tracking-wider mb-1.5">
                  Official Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="academy@example.org"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#fcfcfb] border border-[#d8ded5] rounded-xl focus:outline-none focus:border-[#2f6d5a] focus:ring-1 focus:ring-[#2f6d5a] transition"
                />
                <p className="text-[10px] text-[#697c7c] mt-1">Used for signing in to the Academy portal.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#173235] uppercase tracking-wider mb-1.5">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#fcfcfb] border border-[#d8ded5] rounded-xl focus:outline-none focus:border-[#2f6d5a] focus:ring-1 focus:ring-[#2f6d5a] transition"
                />
                <p className="text-[10px] text-[#697c7c] mt-1">Minimum 6 characters for secure workspace access.</p>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 2: PHYSICAL ADDRESS
              ───────────────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#d8ded5] rounded-2xl p-5 sm:p-7 shadow-xs">
            <div className="border-b border-[#e8ede6] pb-3 mb-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#173235] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#2f6d5a]" />
                2. Physical Facility Address
              </h2>
              <p className="text-xs text-[#697c7c] mt-0.5">
                Structured address displayed across national discovery and athlete search.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#173235] uppercase tracking-wider mb-1.5">
                  Address Line 1 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Plot No., Sports Complex, Street Name"
                  value={addressLine1}
                  onChange={e => setAddressLine1(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#fcfcfb] border border-[#d8ded5] rounded-xl focus:outline-none focus:border-[#2f6d5a] focus:ring-1 focus:ring-[#2f6d5a] transition"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#173235] uppercase tracking-wider mb-1.5">
                  Address Line 2 (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Landmark, Sector, Area"
                  value={addressLine2}
                  onChange={e => setAddressLine2(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#fcfcfb] border border-[#d8ded5] rounded-xl focus:outline-none focus:border-[#2f6d5a] focus:ring-1 focus:ring-[#2f6d5a] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#173235] uppercase tracking-wider mb-1.5">
                  City *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vijayawada"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#fcfcfb] border border-[#d8ded5] rounded-xl focus:outline-none focus:border-[#2f6d5a] focus:ring-1 focus:ring-[#2f6d5a] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#173235] uppercase tracking-wider mb-1.5">
                  State *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Andhra Pradesh"
                  value={state}
                  onChange={e => setState(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#fcfcfb] border border-[#d8ded5] rounded-xl focus:outline-none focus:border-[#2f6d5a] focus:ring-1 focus:ring-[#2f6d5a] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#173235] uppercase tracking-wider mb-1.5">
                  Pincode *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 520010"
                  value={pincode}
                  onChange={e => setPincode(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#fcfcfb] border border-[#d8ded5] rounded-xl focus:outline-none focus:border-[#2f6d5a] focus:ring-1 focus:ring-[#2f6d5a] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#173235] uppercase tracking-wider mb-1.5">
                  Country *
                </label>
                <input
                  type="text"
                  required
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#fcfcfb] border border-[#d8ded5] rounded-xl focus:outline-none focus:border-[#2f6d5a] focus:ring-1 focus:ring-[#2f6d5a] transition"
                />
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 3: ACADEMY LOCATION
              ───────────────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#d8ded5] rounded-2xl p-5 sm:p-7 shadow-xs">
            <div className="border-b border-[#e8ede6] pb-3 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#173235] flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#2f6d5a]" />
                  3. Academy Location
                </h2>
                <p className="text-xs text-[#697c7c] mt-0.5">
                  Add your academy's location so athletes can discover it nearby.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGetLocation}
                disabled={locating}
                className="px-3.5 py-2 rounded-xl bg-[#eef6f2] hover:bg-[#dcefe5] text-[#2f6d5a] border border-[#2f6d5a]/40 text-xs font-bold flex items-center gap-2 cursor-pointer transition self-start sm:self-auto disabled:opacity-50"
              >
                {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5 text-[#cc694e]" />}
                {locating ? 'Detecting Coordinates...' : 'Use My Current Location'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#173235] uppercase tracking-wider mb-1.5">
                  Longitude (lng) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={longitude}
                  onChange={e => setLongitude(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono bg-[#fcfcfb] border border-[#d8ded5] rounded-xl focus:outline-none focus:border-[#2f6d5a] focus:ring-1 focus:ring-[#2f6d5a] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#173235] uppercase tracking-wider mb-1.5">
                  Latitude (lat) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={latitude}
                  onChange={e => setLatitude(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono bg-[#fcfcfb] border border-[#d8ded5] rounded-xl focus:outline-none focus:border-[#2f6d5a] focus:ring-1 focus:ring-[#2f6d5a] transition"
                />
              </div>
            </div>
            <p className="text-[11px] text-[#697c7c] mt-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2f6d5a]" /> Stored as GeoJSON coordinates for MongoDB 2dsphere nearest-facility queries.
            </p>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 4: PLAYER REPRESENTATION STATISTICS
              ───────────────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#d8ded5] rounded-2xl p-5 sm:p-7 shadow-xs">
            <div className="border-b border-[#e8ede6] pb-3 mb-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#173235] flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#cc694e]" />
                4. Player Representation Statistics
              </h2>
              <p className="text-xs text-[#697c7c] mt-0.5">
                Number of players trained at your facility who achieved competitive representation.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="bg-[#f8faf8] border border-[#d8ded5] rounded-xl p-3 text-center">
                <label className="block text-[11px] font-bold text-[#526668] uppercase mb-1">
                  District
                </label>
                <input
                  type="number"
                  min="0"
                  value={districtPlayers}
                  onChange={e => setDistrictPlayers(e.target.value)}
                  className="w-full text-center py-2 text-base sm:text-lg font-bold text-[#173235] border border-[#d8ded5] rounded-lg bg-white focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div className="bg-[#f8faf8] border border-[#d8ded5] rounded-xl p-3 text-center">
                <label className="block text-[11px] font-bold text-[#526668] uppercase mb-1">
                  State
                </label>
                <input
                  type="number"
                  min="0"
                  value={statePlayers}
                  onChange={e => setStatePlayers(e.target.value)}
                  className="w-full text-center py-2 text-base sm:text-lg font-bold text-[#173235] border border-[#d8ded5] rounded-lg bg-white focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div className="bg-[#f8faf8] border border-[#d8ded5] rounded-xl p-3 text-center">
                <label className="block text-[11px] font-bold text-[#526668] uppercase mb-1">
                  National
                </label>
                <input
                  type="number"
                  min="0"
                  value={nationalPlayers}
                  onChange={e => setNationalPlayers(e.target.value)}
                  className="w-full text-center py-2 text-base sm:text-lg font-bold text-[#173235] border border-[#d8ded5] rounded-lg bg-white focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>

              <div className="bg-[#f8faf8] border border-[#d8ded5] rounded-xl p-3 text-center">
                <label className="block text-[11px] font-bold text-[#526668] uppercase mb-1">
                  International
                </label>
                <input
                  type="number"
                  min="0"
                  value={internationalPlayers}
                  onChange={e => setInternationalPlayers(e.target.value)}
                  className="w-full text-center py-2 text-base sm:text-lg font-bold text-[#173235] border border-[#d8ded5] rounded-lg bg-white focus:outline-none focus:border-[#2f6d5a]"
                />
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 5: SPORTS OFFERED & COACHING STAFF
              ───────────────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#d8ded5] rounded-2xl p-5 sm:p-7 shadow-xs space-y-5">
            <div className="border-b border-[#e8ede6] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#173235] flex items-center gap-2">
                  <UsersRound className="w-4 h-4 text-[#2f6d5a]" />
                  5. Sports Offered & Coaching Staff
                </h2>
                <p className="text-xs text-[#697c7c] mt-0.5">
                  Add the sports available at your academy. Each sport supports certified or unlinked coaches.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddSport}
                className="px-3.5 py-2 rounded-xl bg-[#eef6f2] hover:bg-[#dcefe5] text-[#2f6d5a] border border-[#2f6d5a] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" /> Add Another Sport
              </button>
            </div>

            {/* List of Dynamic Sports Cards */}
            <div className="space-y-4">
              {sports.map((sp, idx) => (
                <div
                  key={idx}
                  className="bg-[#f9faf8] border border-[#dce4de] rounded-xl p-4 sm:p-5 relative transition shadow-2xs"
                >
                  {/* Sport Card Top Row */}
                  <div className="flex items-center justify-between border-b border-[#e2ede4] pb-2.5 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-[#2f6d5a] text-white flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-[#173235]">
                        {sp.sportName ? sp.sportName.toUpperCase() : `Sport Discipline #${idx + 1}`}
                      </span>
                    </div>

                    {sports.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSport(idx)}
                        className="text-rose-600 hover:text-rose-800 p-1 rounded-md hover:bg-rose-50 transition cursor-pointer text-xs flex items-center gap-1 font-bold"
                        title="Remove Sport"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Remove</span>
                      </button>
                    )}
                  </div>

                  {/* Sport Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-[#173235] uppercase tracking-wider mb-1">
                        Sport Discipline Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. CRICKET, BADMINTON, TENNIS"
                        value={sp.sportName}
                        onChange={e => handleSportChange(idx, 'sportName', e.target.value)}
                        className="w-full px-3 py-2 text-xs sm:text-sm uppercase font-bold bg-white border border-[#d8ded5] rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#173235] uppercase tracking-wider mb-1">
                        Coach Name (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Devraj Patil"
                        value={sp.coachName}
                        onChange={e => handleSportChange(idx, 'coachName', e.target.value)}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-[#d8ded5] rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#173235] uppercase tracking-wider mb-1">
                        Coach Aadhaar (12 Digits - Optional)
                      </label>
                      <input
                        type="password"
                        maxLength={12}
                        placeholder="12-digit Aadhaar number"
                        value={sp.coachAadhaar}
                        onChange={e => handleSportChange(idx, 'coachAadhaar', e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2 text-xs sm:text-sm font-mono bg-white border border-[#d8ded5] rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                      />
                      <p className="text-[10px] text-[#697c7c] mt-0.5">Encrypted on submission. Never stored in plaintext.</p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#173235] uppercase tracking-wider mb-1">
                        Coach NIS ID (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. NIS-2025-IND"
                        value={sp.coachNisId}
                        onChange={e => handleSportChange(idx, 'coachNisId', e.target.value)}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-[#d8ded5] rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-[#173235] uppercase tracking-wider mb-1">
                        TrackAthlete Coach ID (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Optional (leave blank if offline)"
                        value={sp.coachTrackAthleteId}
                        onChange={e => handleSportChange(idx, 'coachTrackAthleteId', e.target.value)}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-[#d8ded5] rounded-lg focus:outline-none focus:border-[#2f6d5a]"
                      />
                      <p className="text-[10px] text-[#697c7c] mt-0.5">Optional. If left blank, coach remains an unlinked offline record.</p>
                    </div>

                    {/* Coach Certificate Upload Area */}
                    <div className="sm:col-span-2 pt-1">
                      <label className="block text-[11px] font-bold text-[#173235] uppercase tracking-wider mb-1.5">
                        Coach Certificate (Optional)
                      </label>

                      {sp.coachCertificateData ? (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-emerald-300 text-emerald-800 text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span className="font-bold truncate">{sp.coachCertificateFileName || 'Certificate.pdf'}</span>
                            <span className="text-[10px] text-emerald-600 font-mono">(Ready)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCert(idx)}
                            className="p-1 text-rose-600 hover:text-rose-800 font-bold ml-3 cursor-pointer"
                            title="Remove file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="border border-dashed border-[#2f6d5a]/40 hover:border-[#2f6d5a] rounded-xl p-3.5 bg-white flex items-center justify-center gap-2 text-xs text-[#2f6d5a] font-bold cursor-pointer transition hover:bg-[#eef6f2]">
                          <UploadCloud className="w-4 h-4" />
                          <span>Upload Certificate (PDF or Image, max 5MB)</span>
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={e => handleCertUpload(e, idx)}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 6: TERMS & ACCOUNT CREATION ACTION
              ───────────────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#d8ded5] rounded-2xl p-5 sm:p-7 shadow-xs space-y-4">
            <div className="space-y-2">
              <label className="flex items-start gap-2.5 text-xs text-[#526668] cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-[#2f6d5a] focus:ring-[#2f6d5a]"
                />
                <span>Remember me on this device</span>
              </label>

              <label className="flex items-start gap-2.5 text-xs text-[#173235] font-medium cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={agreeTerms}
                  onChange={e => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-[#2f6d5a] focus:ring-[#2f6d5a]"
                />
                <span>
                  I agree to the <span className="underline font-bold text-[#2f6d5a]">Terms of Service</span> and <span className="underline font-bold text-[#2f6d5a]">Privacy Policy</span> of TrackAthlete.
                </span>
              </label>
            </div>

            {/* Primary Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#173d3c] to-[#245849] hover:from-[#133231] hover:to-[#1d483c] text-white text-sm sm:text-base font-bold uppercase tracking-wider transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Registering Academy Facility...</span>
                </>
              ) : (
                <>
                  <Building2 className="w-5 h-5 text-[#cc694e]" />
                  <span>Create Academy Account</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <span className="text-xs text-[#526668]">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={onSwitchToSignIn}
                  className="font-bold text-[#cc694e] hover:underline cursor-pointer ml-1"
                >
                  Click here to Sign In
                </button>
              </span>
            </div>
          </div>
        </form>
      </div>
    </section>
  </div>
);
}
