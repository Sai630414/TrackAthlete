import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, CalendarPlus, CheckCircle2, HeartHandshake, KeyRound, LoaderCircle, LockKeyhole, Mail, UserRound, UsersRound, MapPin, Plus, Trash2, Trophy, Compass } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AcademySignup from '../components/AcademySignup';

const routeForRole = {
  parent: '/parent',
  athlete: '/athlete',
  coach: '/coach',
  sponsor: '/sponsor',
  academy: '/academy',
  admin: '/academy'
};

const roles = [
  { id: 'parent', label: 'Parent', copy: 'Plan a clearer pathway', icon: UsersRound },
  { id: 'athlete', label: 'Athlete', copy: 'Build your sporting profile', icon: UserRound },
  { id: 'coach', label: 'Coach', copy: 'Guide your athletes', icon: UsersRound },
  { id: 'sponsor', label: 'Sponsor', copy: 'Support with clarity', icon: HeartHandshake },
  { id: 'academy', label: 'Academy', copy: 'Manage your listing', icon: Building2 }
  ,{ id: 'organizer', label: 'Organize Event', copy: 'Create and manage sports events', icon: CalendarPlus }
];

export default function Login({ initialMode }) {
  const [searchParams] = useSearchParams();
  const requestedMode = initialMode || searchParams.get('mode') || 'signin';
  const { user, login, signup, forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState(requestedMode === 'signup' ? 'signup' : (requestedMode === 'forgot' ? 'forgot' : 'signin'));
  const [role, setRole] = useState(searchParams.get('role') || 'parent');

  // Common Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Checkboxes
  const [rememberMe, setRememberMe] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Role-Specific Payload State
  const [parentFields, setParentFields] = useState({ childName: '', childAge: '', childSport: 'Taekwondo' });
  const [athleteFields, setAthleteFields] = useState({ sport: '', beltRank: '', age: '', federationState: 'Andhra Pradesh', aadhaarNumber: '', seekingSponsorship: false, sponsorshipReason: '' });
  const [coachFields, setCoachFields] = useState({ sport: 'Taekwondo', yearsExperience: '', certifications: '', acceptingAthletes: true });
  const [sponsorFields, setSponsorFields] = useState({ organizationName: '', budgetRange: '₹50,000 - ₹2,000,000', targetSports: 'Taekwondo' });
  const [academyFields, setAcademyFields] = useState({
    academyName: '',
    contactPhone: '',
    addressLine1: '',
    addressLine2: '',
    pincode: '',
    country: 'India',
    longitude: 80.6480,
    latitude: 16.5062,
    districtPlayers: 0,
    statePlayers: 0,
    nationalPlayers: 0,
    internationalPlayers: 0
  });

  const [academySports, setAcademySports] = useState([
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

  const handleAddSportRow = () => {
    setAcademySports(prev => [
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

  const handleRemoveSportRow = (index) => {
    if (academySports.length <= 1) return;
    setAcademySports(prev => prev.filter((_, i) => i !== index));
  };

  const updateSportRow = (index, field, value) => {
    setAcademySports(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSportCertUpload = (e, index) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateSportRow(index, 'coachCertificateData', reader.result);
      updateSportRow(index, 'coachCertificateFileName', file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleUseCurrentLocationInSignup = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAcademyFields(prev => ({
          ...prev,
          longitude: Number(pos.coords.longitude.toFixed(6)),
          latitude: Number(pos.coords.latitude.toFixed(6))
        }));
      },
      (err) => {
        setError('Could not retrieve coordinates: ' + err.message);
      }
    );
  };

  // Forgot Password Flow State
  const [forgotStep, setForgotStep] = useState('request'); // 'request' | 'verify'
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (user) {
    return <Navigate to={routeForRole[user.role] || '/parent'} replace />;
  }

  if (mode === 'signup' && role === 'academy') {
    return (
      <AcademySignup
        onSwitchRole={(newRole) => setRole(newRole)}
        onSwitchToSignIn={() => setMode('signin')}
      />
    );
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (mode === 'signin') {
        await login({ email, password, role, rememberMe });
      } else if (mode === 'signup') {
        if (!agreeTerms) {
          setError('You must accept the Terms of Service & Privacy Policy to sign up.');
          setLoading(false);
          return;
        }

        // Build role specific payload
        let rolePayload = {};
        if (role === 'parent') rolePayload = { childName: parentFields.childName, childAge: Number(parentFields.childAge) || 0, childSport: parentFields.childSport };
        else if (role === 'athlete') rolePayload = { sport: String(athleteFields.sport || '').trim(), age: Number(athleteFields.age) || 0, beltRank: athleteFields.beltRank, federationState: athleteFields.federationState, aadhaarNumber: athleteFields.aadhaarNumber, seekingSponsorship: athleteFields.seekingSponsorship, sponsorshipReason: athleteFields.sponsorshipReason };
        else if (role === 'coach') rolePayload = { sport: coachFields.sport, yearsExperience: Number(coachFields.yearsExperience) || 0, certifications: coachFields.certifications.split(',').map(s => s.trim()).filter(Boolean), acceptingAthletes: coachFields.acceptingAthletes };
        else if (role === 'sponsor') rolePayload = { organizationName: sponsorFields.organizationName, budgetRange: sponsorFields.budgetRange, targetSports: sponsorFields.targetSports.split(',').map(s => s.trim()).filter(Boolean) };
        else if (role === 'academy') rolePayload = {
          academyName: academyFields.academyName || name,
          contactPhone: academyFields.contactPhone,
          address: {
            addressLine1: academyFields.addressLine1,
            addressLine2: academyFields.addressLine2,
            city: city,
            state: state,
            pincode: academyFields.pincode,
            country: academyFields.country || 'India'
          },
          location: {
            type: 'Point',
            coordinates: [Number(academyFields.longitude) || 80.6480, Number(academyFields.latitude) || 16.5062]
          },
          rankingStats: {
            districtPlayers: Number(academyFields.districtPlayers) || 0,
            statePlayers: Number(academyFields.statePlayers) || 0,
            nationalPlayers: Number(academyFields.nationalPlayers) || 0,
            internationalPlayers: Number(academyFields.internationalPlayers) || 0
          },
          sports: academySports.filter(s => s.sportName && s.sportName.trim())
        };

        await signup({
          name,
          email,
          password,
          role,
          city,
          state,
          rememberMe,
          ...rolePayload
        });
      }
    } catch (err) {
      const serverMsg = err.response?.data?.error || err.response?.data?.message || err.message;
      setError(serverMsg || `We could not ${mode === 'signin' ? 'sign you in' : 'create your account'}. Please try again.`);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPasswordRequest(e) {
    e.preventDefault();
    if (!email) {
      setError('Please enter your registered email address.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await forgotPassword(email);
      setSuccessMsg(res.message || 'Verification code sent to your email via Brevo!');
      setForgotStep('verify');
    } catch (err) {
      const serverMsg = err.response?.data?.error || err.response?.data?.message || err.message;
      setError(serverMsg || 'Failed to send password reset code. Please check your email address.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPasswordSubmit(e) {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      setError('Please enter the 6-digit verification code received in your email.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation password do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await resetPassword({ email, otp: otpCode, newPassword });
      setSuccessMsg(res.message || 'Password updated successfully! Please sign in with your new password.');
      setMode('signin');
      setPassword('');
      setForgotStep('request');
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const serverMsg = err.response?.data?.error || err.response?.data?.message || err.message;
      setError(serverMsg || 'Failed to reset password. The OTP code may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  }

  return <div className="login-page">
    <section className="login-story">
      <div className="login-logo"><span>ta</span> trackathlete</div>
      <div className="story-copy">
        <p className="eyebrow">ONE PLATFORM · FIVE VIEWPOINTS</p>
        <h1>Every athlete needs a <em>way forward.</em></h1>
        <p>From the first academy search to a verified opportunity, TrackAthlete helps the people around an athlete make the next decision with confidence.</p>
      </div>
      <div className="story-foot"><i /> Built for the Indian sports ecosystem</div>
    </section>
    <section className="login-panel">
        <div className="login-card">
          <p className="login-help" style={{ marginBottom: 12 }}>Organizing a competition? <Link to="/organizer/login">Open the Organizer workspace</Link></p>

        {/* Auth Mode Tabs */}
        {mode !== 'forgot' && (
          <div className="auth-tabs">
            <button type="button" onClick={() => { setMode('signin'); setError(''); setSuccessMsg(''); }} className={mode === 'signin' ? 'auth-tab active' : 'auth-tab'}>Sign In</button>
            <button type="button" onClick={() => { setMode('signup'); setError(''); setSuccessMsg(''); }} className={mode === 'signup' ? 'auth-tab active' : 'auth-tab'}>Create Account (Sign Up)</button>
          </div>
        )}

        <div className="login-heading">
          <p className="eyebrow">
            {mode === 'forgot' ? 'RECOVER ACCOUNT' : (mode === 'signin' ? 'WELCOME BACK' : 'GET STARTED')}
          </p>
          <h2>
            {mode === 'forgot' ? 'Reset your password.' : (mode === 'signin' ? 'Choose your workspace.' : 'Create your profile.')}
          </h2>
          <p>
            {mode === 'forgot'
              ? (forgotStep === 'request' ? 'Enter your email address to receive a Brevo verification code.' : 'Enter the 6-digit verification code and set your new password.')
              : (mode === 'signin' ? 'Use the role your account was registered with.' : 'Fill in your details according to your selected role.')}
          </p>
        </div>

        {/* Role Selection (Shown for Sign In and Sign Up) */}
        {mode !== 'forgot' && (
          <div className="role-picker" role="radiogroup" aria-label="Select account role">
            {roles.map(({ id, label, copy, icon: Icon }) => (
              <button type="button" role="radio" aria-checked={role === id} key={id} onClick={() => id === 'organizer' ? navigate('/organizer/login') : setRole(id)} className={role === id ? 'role-option selected' : 'role-option'}>
                <Icon size={17} />
                <span><b>{label}</b><small>{copy}</small></span>
              </button>
            ))}
          </div>
        )}

        {/* FORGOT PASSWORD FORM FLOW */}
        {mode === 'forgot' ? (
          <div className="forgot-password-flow">
            {error && <div className="login-error"><LockKeyhole size={15} /> {error}</div>}
            {successMsg && <div className="login-success" style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px', borderRadius: '8px', background: '#e2eee4', color: '#194e42', fontSize: '11px', border: '1px solid #b7da78', marginBottom: '14px' }}><CheckCircle2 size={15} /> {successMsg}</div>}

            {forgotStep === 'request' ? (
              <form onSubmit={handleForgotPasswordRequest} className="login-form">
                <label>Registered Email address
                  <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@example.com" required autoComplete="email" />
                </label>

                <button type="submit" className="login-submit" disabled={loading}>
                  {loading ? (
                    <><LoaderCircle className="spin" size={17} /> Sending Verification Code...</>
                  ) : (
                    <><Mail size={17} /> Send Reset Code via Brevo <ArrowRight size={17} /></>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="login-form">
                <label>Email address
                  <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@example.com" required readOnly style={{ background: '#f4f8f2' }} />
                </label>
                <label>6-Digit Verification Code (OTP)
                  <input value={otpCode} onChange={e => setOtpCode(e.target.value.trim())} type="text" maxLength={6} placeholder="e.g. 123456" required style={{ letterSpacing: '4px', fontWeight: 'bold', fontSize: '16px' }} />
                </label>
                <label>New Password
                  <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" placeholder="At least 6 characters" required autoComplete="new-password" />
                </label>
                <label>Confirm New Password
                  <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type="password" placeholder="Re-enter new password" required autoComplete="new-password" />
                </label>

                <button type="submit" className="login-submit" disabled={loading}>
                  {loading ? (
                    <><LoaderCircle className="spin" size={17} /> Updating Password...</>
                  ) : (
                    <><KeyRound size={17} /> Reset Password & Sign In <ArrowRight size={17} /></>
                  )}
                </button>

                <button type="button" onClick={() => setForgotStep('request')} style={{ background: 'none', border: 'none', color: '#697c7c', fontSize: '11px', cursor: 'pointer', textAlign: 'center', marginTop: '6px' }}>
                  Didn't receive code? Resend OTP
                </button>
              </form>
            )}

            <p className="login-help">
              <button type="button" onClick={() => { setMode('signin'); setError(''); setSuccessMsg(''); setForgotStep('request'); }} style={{ background: 'none', border: 'none', color: '#e07050', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ArrowLeft size={13} /> Back to Sign In
              </button>
            </p>
          </div>
        ) : (
          /* SIGN IN AND SIGN UP FORMS */
          <form onSubmit={submit} className="login-form">
            {error && <div className="login-error"><LockKeyhole size={15} /> {error}</div>}
            {successMsg && <div className="login-success" style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px', borderRadius: '8px', background: '#e2eee4', color: '#194e42', fontSize: '11px', border: '1px solid #b7da78' }}><CheckCircle2 size={15} /> {successMsg}</div>}

            {/* Common Sign Up Fields */}
            {mode === 'signup' && (
              <>
                <label>Full Name
                  <input value={name} onChange={e => setName(e.target.value)} type="text" placeholder="e.g. Rajesh Kumar" required />
                </label>
                <div className="form-row">
                  <label>City
                    <input value={city} onChange={e => setCity(e.target.value)} type="text" placeholder="e.g. Vijayawada" required />
                  </label>
                  <label>State
                    <input value={state} onChange={e => setState(e.target.value)} type="text" placeholder="e.g. Andhra Pradesh" required />
                  </label>
                </div>
              </>
            )}

            {/* Role-Specific Sign Up Fields */}
            {mode === 'signup' && role === 'parent' && (
              <>
                <label>Child's Full Name
                  <input value={parentFields.childName} onChange={e => setParentFields({ ...parentFields, childName: e.target.value })} type="text" placeholder="e.g. Ananya Kumar" required />
                </label>
                <div className="form-row">
                  <label>Child's Age
                    <input value={parentFields.childAge} onChange={e => setParentFields({ ...parentFields, childAge: e.target.value })} type="number" min="3" max="25" placeholder="e.g. 14" required />
                  </label>
                  <label>Primary Sport Interested In
                    <select value={parentFields.childSport} onChange={e => setParentFields({ ...parentFields, childSport: e.target.value })}>
                      <option value="Taekwondo">Taekwondo</option>
                      <option value="Badminton">Badminton</option>
                      <option value="Table Tennis">Table Tennis</option>
                      <option value="Athletics">Athletics</option>
                      <option value="Boxing">Boxing</option>
                    </select>
                  </label>
                </div>
              </>
            )}

            {mode === 'signup' && role === 'athlete' && (
              <>
                <div className="form-row">
                  <label>Sport *
                    <input value={athleteFields.sport} onChange={e => setAthleteFields({ ...athleteFields, sport: e.target.value })} type="text" placeholder="e.g. Cricket" required />
                  </label>
                  <label>Age
                    <input value={athleteFields.age} onChange={e => setAthleteFields({ ...athleteFields, age: e.target.value })} type="number" min="5" max="40" placeholder="e.g. 16" required />
                  </label>
                </div>
                <div className="form-row">
                  <label>Belt / Rank Level
                    <input value={athleteFields.beltRank} onChange={e => setAthleteFields({ ...athleteFields, beltRank: e.target.value })} type="text" placeholder="e.g. Black Belt 1st Dan" required />
                  </label>
                  <label>Federation State
                    <input value={athleteFields.federationState} onChange={e => setAthleteFields({ ...athleteFields, federationState: e.target.value })} type="text" placeholder="e.g. Andhra Pradesh" required />
                  </label>
                </div>
                <label>Athlete Aadhaar Number
                  <input value={athleteFields.aadhaarNumber} onChange={e => setAthleteFields({ ...athleteFields, aadhaarNumber: e.target.value.replace(/\D/g, '').slice(0, 12) })} type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{12}" minLength="12" maxLength="12" placeholder="12-digit Aadhaar number" required />
                  <small>Used only for secure federation-result matching. It is never displayed.</small>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={athleteFields.seekingSponsorship} onChange={e => setAthleteFields({ ...athleteFields, seekingSponsorship: e.target.checked })} />
                  Actively seeking sponsorship for upcoming national/international events
                </label>
                {athleteFields.seekingSponsorship && (
                  <label>Sponsorship Goal / Tournament Notes
                    <input value={athleteFields.sponsorshipReason} onChange={e => setAthleteFields({ ...athleteFields, sponsorshipReason: e.target.value })} type="text" placeholder="e.g. Funding for National Championship equipment and travel" />
                  </label>
                )}
              </>
            )}

            {mode === 'signup' && role === 'coach' && (
              <>
                <div className="form-row">
                  <label>Coaching Sport
                    <select value={coachFields.sport} onChange={e => setCoachFields({ ...coachFields, sport: e.target.value })}>
                      <option value="Taekwondo">Taekwondo</option>
                      <option value="Badminton">Badminton</option>
                      <option value="Table Tennis">Table Tennis</option>
                      <option value="Athletics">Athletics</option>
                      <option value="Boxing">Boxing</option>
                    </select>
                  </label>
                  <label>Years of Experience
                    <input value={coachFields.yearsExperience} onChange={e => setCoachFields({ ...coachFields, yearsExperience: e.target.value })} type="number" min="0" max="50" placeholder="e.g. 8" required />
                  </label>
                </div>
                <label>Certifications (comma separated)
                  <input value={coachFields.certifications} onChange={e => setCoachFields({ ...coachFields, certifications: e.target.value })} type="text" placeholder="e.g. NIS Certified, World Taekwondo Level 2" />
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={coachFields.acceptingAthletes} onChange={e => setCoachFields({ ...coachFields, acceptingAthletes: e.target.checked })} />
                  Currently accepting new athletes for coaching sessions
                </label>
              </>
            )}

            {mode === 'signup' && role === 'sponsor' && (
              <>
                <label>Organization / Brand Name
                  <input value={sponsorFields.organizationName} onChange={e => setSponsorFields({ ...sponsorFields, organizationName: e.target.value })} type="text" placeholder="e.g. Apex Sports Foundation" required />
                </label>
                <div className="form-row">
                  <label>Sponsorship Budget Range
                    <input value={sponsorFields.budgetRange} onChange={e => setSponsorFields({ ...sponsorFields, budgetRange: e.target.value })} type="text" placeholder="e.g. ₹50,000 - ₹2,000,000" required />
                  </label>
                  <label>Target Sports
                    <input value={sponsorFields.targetSports} onChange={e => setSponsorFields({ ...sponsorFields, targetSports: e.target.value })} type="text" placeholder="e.g. Taekwondo, Badminton" required />
                  </label>
                </div>
              </>
            )}

            {mode === 'signup' && role === 'academy' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '4px 0' }}>
                <label>Academy / Center Name *
                  <input value={academyFields.academyName} onChange={e => setAcademyFields({ ...academyFields, academyName: e.target.value })} type="text" placeholder="e.g. Apex National Sports Academy" required />
                </label>

                <label>Contact Phone *
                  <input value={academyFields.contactPhone} onChange={e => setAcademyFields({ ...academyFields, contactPhone: e.target.value })} type="tel" placeholder="e.g. +91 98765 43210" required />
                </label>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#173235', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Physical Address Details
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    <input value={academyFields.addressLine1} onChange={e => setAcademyFields({ ...academyFields, addressLine1: e.target.value })} type="text" placeholder="Address Line 1 (Plot, Street, Area)" />
                    <input value={academyFields.addressLine2} onChange={e => setAcademyFields({ ...academyFields, addressLine2: e.target.value })} type="text" placeholder="Address Line 2 (Landmark, Sector)" />
                    <input value={academyFields.pincode} onChange={e => setAcademyFields({ ...academyFields, pincode: e.target.value })} type="text" placeholder="Pincode (e.g. 520010)" />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#173235', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      GeoJSON Location Coordinates
                    </span>
                    <button
                      type="button"
                      onClick={handleUseCurrentLocationInSignup}
                      style={{
                        background: '#eef6f2',
                        border: '1px solid #2f6d5a',
                        color: '#2f6d5a',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '10px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <MapPin size={11} /> Use My Current Location
                    </button>
                  </div>
                  <div className="form-row">
                    <label>Longitude (lng)
                      <input type="number" step="any" value={academyFields.longitude} onChange={e => setAcademyFields({ ...academyFields, longitude: e.target.value })} />
                    </label>
                    <label>Latitude (lat)
                      <input type="number" step="any" value={academyFields.latitude} onChange={e => setAcademyFields({ ...academyFields, latitude: e.target.value })} />
                    </label>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#173235', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Ranking Statistics (Player Representation)
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '6px' }}>
                    <label style={{ fontSize: '10px' }}>District
                      <input type="number" min="0" value={academyFields.districtPlayers} onChange={e => setAcademyFields({ ...academyFields, districtPlayers: e.target.value })} />
                    </label>
                    <label style={{ fontSize: '10px' }}>State
                      <input type="number" min="0" value={academyFields.statePlayers} onChange={e => setAcademyFields({ ...academyFields, statePlayers: e.target.value })} />
                    </label>
                    <label style={{ fontSize: '10px' }}>National
                      <input type="number" min="0" value={academyFields.nationalPlayers} onChange={e => setAcademyFields({ ...academyFields, nationalPlayers: e.target.value })} />
                    </label>
                    <label style={{ fontSize: '10px' }}>Internat'l
                      <input type="number" min="0" value={academyFields.internationalPlayers} onChange={e => setAcademyFields({ ...academyFields, internationalPlayers: e.target.value })} />
                    </label>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#173235', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Sport Disciplines & Coaches
                    </span>
                    <button
                      type="button"
                      onClick={handleAddSportRow}
                      style={{
                        background: '#e07050',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '10px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Plus size={12} /> Add Sport
                    </button>
                  </div>

                  {academySports.map((sp, idx) => (
                    <div key={idx} style={{ background: '#f8faf8', border: '1px solid #dce4de', borderRadius: '10px', padding: '10px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#2f6d5a', textTransform: 'uppercase' }}>
                          Sport #{idx + 1}
                        </span>
                        {academySports.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSportRow(idx)}
                            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 0 }}
                            title="Remove Sport"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      <div className="form-row">
                        <input
                          type="text"
                          required={idx === 0}
                          placeholder="Sport Discipline (e.g. CRICKET) *"
                          value={sp.sportName}
                          onChange={e => updateSportRow(idx, 'sportName', e.target.value)}
                          style={{ fontWeight: '600' }}
                        />
                        <input
                          type="text"
                          required
                          placeholder="Coach Name *"
                          value={sp.coachName}
                          onChange={e => updateSportRow(idx, 'coachName', e.target.value)}
                        />
                      </div>

                      <div className="form-row">
                        <input
                          type="password"
                          required
                          pattern="[0-9]{12}"
                          minLength={12}
                          maxLength={12}
                          placeholder="Coach Aadhaar (12 digits) *"
                          value={sp.coachAadhaar}
                          onChange={e => updateSportRow(idx, 'coachAadhaar', e.target.value.replace(/\D/g, ''))}
                        />
                        <input
                          type="text"
                          placeholder="NIS ID (Optional)"
                          value={sp.coachNisId}
                          onChange={e => updateSportRow(idx, 'coachNisId', e.target.value)}
                        />
                      </div>

                      <div className="form-row">
                        <input
                          type="text"
                          placeholder="Coach TrackAthlete ID (Optional)"
                          value={sp.coachTrackAthleteId}
                          onChange={e => updateSportRow(idx, 'coachTrackAthleteId', e.target.value)}
                        />
                        <input
                          type="file"
                          required
                          accept=".pdf,image/*"
                          onChange={e => handleSportCertUpload(e, idx)}
                          style={{ fontSize: '10px' }}
                          title="Upload Coach Certificate *"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email & Password (Common for both Sign In and Sign Up) */}
            <label>Email address
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@example.com" required autoComplete="email" />
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#526668', fontSize: '11px', fontWeight: '800', letterSpacing: '.03em' }}>Password</span>
                {mode === 'signin' && (
                  <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccessMsg(''); setForgotStep('request'); }} style={{ background: 'none', border: 'none', color: '#e07050', fontSize: '11px', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}>
                    Forgot password?
                  </button>
                )}
              </div>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Your password" required autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
            </div>

            {/* Checkboxes */}
            <label className="checkbox-label">
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
              Remember me on this device
            </label>

            {mode === 'signup' && (
              <label className="checkbox-label">
                <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} required />
                I agree to the Terms of Service & Privacy Policy
              </label>
            )}

            {/* Submit Button */}
            <button className="login-submit" disabled={loading}>
              {loading ? (
                <><LoaderCircle className="spin" size={17} /> {mode === 'signin' ? 'Signing in...' : 'Creating profile...'}</>
              ) : (
                <>{mode === 'signin' ? `Enter ${roles.find(item => item.id === role)?.label} workspace` : `Register as ${roles.find(item => item.id === role)?.label}`} <ArrowRight size={17} /></>
              )}
            </button>
          </form>
        )}

        {mode !== 'forgot' && (
          <p className="login-help">
            {mode === 'signin' ? (
              <>New to TrackAthlete? <button type="button" onClick={() => { setMode('signup'); setError(''); setSuccessMsg(''); }} style={{ background: 'none', border: 'none', color: '#e07050', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}>Click here to Sign Up</button></>
            ) : (
              <>Already have an account? <button type="button" onClick={() => { setMode('signin'); setError(''); setSuccessMsg(''); }} style={{ background: 'none', border: 'none', color: '#e07050', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}>Click here to Sign In</button></>
            )}
          </p>
        )}

      </div>
    </section>
  </div>;
}
