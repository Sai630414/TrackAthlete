import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Label,
  useToast,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge
} from '../components/ui';
import { Shield, Key, Mail, Lock, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Building, Search, Check, Globe, Sparkles } from 'lucide-react';
import api from '../services/api';

export default function FederationLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('signin');

  // SIGN IN STATE
  const [signInForm, setSignInForm] = useState({
    federationId: '',
    password: ''
  });
  const [signInStep, setSignInStep] = useState('credentials'); // 'credentials' | 'otp'
  const [signInOtp, setSignInOtp] = useState('');
  const [signInLoading, setSignInLoading] = useState(false);
  const [maskedEmailNotice, setMaskedEmailNotice] = useState('');

  // CREATE ACCOUNT / ACTIVATION STATE
  const [availableFederations, setAvailableFederations] = useState([]);
  const [loadingFederations, setLoadingFederations] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedFedId, setSelectedFedId] = useState('');
  const [selectedFed, setSelectedFed] = useState(null);

  // Activation Steps: 'select' | 'verify-email' | 'otp' | 'password' | 'activated'
  const [activationStep, setActivationStep] = useState('select');
  const [activationOtp, setActivationOtp] = useState('');
  const [activationPassword, setActivationPassword] = useState({
    password: '',
    confirmPassword: ''
  });
  const [activationLoading, setActivationLoading] = useState(false);

  // Load available federations dynamically from MongoDB Atlas
  const fetchAvailableFederations = async () => {
    try {
      setLoadingFederations(true);
      const { data } = await api.get('/federation/available');
      setAvailableFederations(data || []);
    } catch (err) {
      console.error('Failed to load federations list:', err);
      toast({
        title: 'Network Error',
        description: 'Failed to load official federations from server.',
        variant: 'destructive'
      });
    } finally {
      setLoadingFederations(false);
    }
  };

  useEffect(() => {
    fetchAvailableFederations();
  }, []);

  // When selected federation changes
  const handleSelectFederation = (fedId) => {
    setSelectedFedId(fedId);
    const fed = availableFederations.find(f => f.federationId === fedId);
    setSelectedFed(fed || null);
    setActivationStep('select');
    setActivationOtp('');
    setActivationPassword({ password: '', confirmPassword: '' });
  };

  // Filtered Federations for search dropdown
  const filteredFederations = availableFederations.filter(f => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return f.name.toLowerCase().includes(q) ||
           f.sport.toLowerCase().includes(q) ||
           f.federationId.toLowerCase().includes(q) ||
           (f.abbreviation && f.abbreviation.toLowerCase().includes(q));
  });

  // SIGN IN: Step 1 Submit
  const handleSignInCredentials = async (e) => {
    e.preventDefault();
    if (!signInForm.federationId.trim() || !signInForm.password) {
      toast({ title: 'Validation Error', description: 'Federation ID and password are required.', variant: 'destructive' });
      return;
    }

    try {
      setSignInLoading(true);
      const { data } = await api.post('/federation/login', {
        federationId: signInForm.federationId.trim(),
        password: signInForm.password
      });

      if (data.requireOTP) {
        setMaskedEmailNotice(data.officialEmail || 'your official registered email');
        setSignInStep('otp');
        toast({ title: '🔑 2FA Verification Code Sent', description: 'Enter the 6-digit OTP sent to official registered email.', variant: 'success' });
      }
    } catch (err) {
      toast({ title: 'Sign In Failed', description: err.response?.data?.error || 'Invalid credentials or unactivated account.', variant: 'destructive' });
    } finally {
      setSignInLoading(false);
    }
  };

  // SIGN IN: Step 2 OTP Verification Submit
  const handleSignInOtpVerify = async (e) => {
    e.preventDefault();
    if (!signInOtp || signInOtp.length !== 6) {
      toast({ title: 'Validation Error', description: 'Please enter a valid 6-digit OTP code.', variant: 'destructive' });
      return;
    }

    try {
      setSignInLoading(true);
      const { data } = await api.post('/federation/verify-otp', {
        federationId: signInForm.federationId.trim(),
        otp: signInOtp.trim()
      });

      localStorage.setItem('trackathlete-federation-token', data.token);
      localStorage.setItem('trackathlete-session', JSON.stringify({ token: data.token, user: { ...data.federation, role: 'federation' } }));
      toast({ title: 'Authentication Verified', description: `Welcome back, ${data.federation.name}!`, variant: 'success' });
      navigate('/federation/dashboard');
    } catch (err) {
      toast({ title: 'Verification Failed', description: err.response?.data?.error || 'Invalid or expired OTP code.', variant: 'destructive' });
    } finally {
      setSignInLoading(false);
    }
  };

  // ACTIVATION: Step 1 Send Activation OTP
  const handleSendActivationOtp = async () => {
    if (!selectedFedId || !selectedFed) {
      toast({ title: 'Selection Required', description: 'Please search and select your official federation.', variant: 'destructive' });
      return;
    }

    try {
      setActivationLoading(true);
      const { data } = await api.post('/federation/send-activation-otp', { federationId: selectedFedId });
      setActivationStep('otp');
      toast({ title: '📩 Activation Code Sent', description: `OTP sent to registered official email (${data.officialEmailMasked}).`, variant: 'success' });
    } catch (err) {
      toast({ title: 'Activation OTP Failed', description: err.response?.data?.error || 'Failed to dispatch activation code.', variant: 'destructive' });
    } finally {
      setActivationLoading(false);
    }
  };

  // ACTIVATION: Step 2 Verify Activation OTP
  const handleVerifyActivationOtp = async (e) => {
    e.preventDefault();
    if (!activationOtp || activationOtp.length !== 6) {
      toast({ title: 'Validation Error', description: 'Please enter a valid 6-digit activation code.', variant: 'destructive' });
      return;
    }

    try {
      setActivationLoading(true);
      await api.post('/federation/verify-activation-otp', {
        federationId: selectedFedId,
        otp: activationOtp.trim()
      });
      setActivationStep('password');
      toast({ title: 'Official Email Verified ✓', description: 'Official email identity confirmed. Please set your password.', variant: 'success' });
    } catch (err) {
      toast({ title: 'OTP Failed', description: err.response?.data?.error || 'Invalid activation code.', variant: 'destructive' });
    } finally {
      setActivationLoading(false);
    }
  };

  // ACTIVATION: Step 3 Set Password & Activate
  const handleActivateAccount = async (e) => {
    e.preventDefault();
    if (!activationPassword.password || !activationPassword.confirmPassword) {
      toast({ title: 'Validation Error', description: 'Password and confirm password are required.', variant: 'destructive' });
      return;
    }
    if (activationPassword.password !== activationPassword.confirmPassword) {
      toast({ title: 'Validation Error', description: 'Passwords do not match.', variant: 'destructive' });
      return;
    }
    if (activationPassword.password.length < 8) {
      toast({ title: 'Validation Error', description: 'Password must be at least 8 characters long.', variant: 'destructive' });
      return;
    }

    try {
      setActivationLoading(true);
      await api.post('/federation/activate-account', {
        federationId: selectedFedId,
        password: activationPassword.password,
        confirmPassword: activationPassword.confirmPassword
      });
      setActivationStep('activated');
      toast({ title: '🎉 Account Activated', description: 'Federation account activated successfully.', variant: 'success' });
      fetchAvailableFederations();
    } catch (err) {
      toast({ title: 'Activation Failed', description: err.response?.data?.error || 'Failed to activate account.', variant: 'destructive' });
    } finally {
      setActivationLoading(false);
    }
  };

  // Switch to sign in tab pre-filling Federation ID
  const handleContinueToSignIn = () => {
    setSignInForm(prev => ({ ...prev, federationId: selectedFedId || prev.federationId }));
    setActiveTab('signin');
    setSignInStep('credentials');
  };

  return (
    <div className="min-h-screen bg-[#f7f9f6] flex flex-col justify-center items-center p-4 md:p-8">

      {/* Top Branding Banner */}
      <div className="text-center max-w-md mx-auto mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]/30 text-xs font-bold mb-3">
          <Shield className="w-4 h-4 text-[#cc694e]" /> Official Governing Body Portal
        </div>
        <h1 className="text-3xl font-extrabold text-[#173235] tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
          TrackAthlete Federation
        </h1>
        <p className="text-xs text-[#526668] mt-1">
          Authorized Verification Desk for MYAS Recognized National Sports Federations
        </p>
      </div>

      {/* Main Unified Auth Card */}
      <Card className="max-w-xl w-full border border-[#2f6d5a]/40 bg-white shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-[#173d3c] text-white p-6">
          <CardTitle className="text-xl font-bold flex items-center justify-between">
            <span>Official Federation Portal</span>
            <Building className="w-5 h-5 text-[#b9d9bf]" />
          </CardTitle>
          <CardDescription className="text-xs text-[#c5d3ce] mt-1">
            MongoDB-backed authentication for verified sports governing bodies.
          </CardDescription>
        </CardHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6 pt-4 border-b border-[#e2eee4] bg-[#fcfcf8]">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin" className="font-bold text-xs">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="create" className="font-bold text-xs">
                Create Federation Account
              </TabsTrigger>
            </TabsList>
          </div>

          {/* =================================================== */}
          {/* TAB 1: SIGN IN */}
          {/* =================================================== */}
          <TabsContent value="signin" className="p-6 space-y-4">
            {signInStep === 'credentials' ? (
              <form onSubmit={handleSignInCredentials} className="space-y-4">
                <div>
                  <Label required>Federation Permanent ID or Official Email</Label>
                  <div className="relative mt-1">
                    <Building className="w-4 h-4 absolute left-3 top-3 text-[#697c7c]" />
                    <Input
                      value={signInForm.federationId}
                      onChange={e => setSignInForm({ ...signInForm, federationId: e.target.value })}
                      placeholder="e.g. FED-TKD001 or official@taekwondo.org.in"
                      className="pl-9 font-mono font-bold text-xs uppercase"
                    />
                  </div>
                </div>

                <div>
                  <Label required>Password</Label>
                  <div className="relative mt-1">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-[#697c7c]" />
                    <Input
                      type="password"
                      value={signInForm.password}
                      onChange={e => setSignInForm({ ...signInForm, password: e.target.value })}
                      placeholder="Enter password…"
                      className="pl-9 text-xs"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={signInLoading}
                    className="w-full h-11 rounded-xl bg-[#173d3c] hover:bg-[#0c292c] text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
                  >
                    {signInLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSignInOtpVerify} className="space-y-4 text-center">
                <div className="p-4 rounded-xl bg-[#e2eee4] border border-[#2f6d5a] space-y-1">
                  <div className="text-xs font-bold text-[#194e42] flex items-center justify-center gap-1.5">
                    <Key className="w-4 h-4 text-[#cc694e]" /> 2FA Email Code Required
                  </div>
                  <p className="text-xs text-[#526668]">
                    A 6-digit OTP code was sent to <strong>{maskedEmailNotice}</strong>.
                  </p>
                </div>

                <div>
                  <Label required>Enter 6-Digit Verification Code</Label>
                  <Input
                    type="text"
                    maxLength={6}
                    value={signInOtp}
                    onChange={e => setSignInOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 654321"
                    className="text-center font-mono font-extrabold text-xl tracking-widest h-12 mt-1"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSignInStep('credentials')}
                    className="flex-1 h-10 rounded-lg border border-[#d8ded5] bg-white font-bold text-xs text-[#526668] cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={signInLoading || signInOtp.length !== 6}
                    className="flex-1 h-10 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    {signInLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verify & Enter Dashboard'}
                  </button>
                </div>
              </form>
            )}
          </TabsContent>

          {/* =================================================== */}
          {/* TAB 2: CREATE FEDERATION ACCOUNT (ACTIVATION & SETUP) */}
          {/* =================================================== */}
          <TabsContent value="create" className="p-6 space-y-4">

            {/* Step 1: Search and Select Federation */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label required>Search Your Federation from MongoDB Directory</Label>
                {loadingFederations && <span className="text-[11px] text-[#697c7c] flex items-center gap-1"><RefreshCw size={11} className="animate-spin" /> Loading…</span>}
              </div>

              {/* Search Filter Box */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-[#697c7c]" />
                <Input
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  placeholder="Type to filter federations by name, sport, or ID…"
                  className="pl-9 text-xs"
                />
              </div>

              {/* Dynamic Select Dropdown */}
              <select
                value={selectedFedId}
                onChange={e => handleSelectFederation(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-[#d2dad2] bg-white text-xs font-bold text-[#173235] focus:outline-none focus:ring-2 focus:ring-[#2f6d5a]"
              >
                <option value="">-- Select Your Official Federation ({filteredFederations.length}) --</option>
                {filteredFederations.map(fed => (
                  <option key={fed.federationId} value={fed.federationId}>
                    {fed.name} ({fed.sport}) [{fed.federationId}] {fed.accountActivated ? '✓ Activated' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Display Selected Federation Live MongoDB Details */}
            {selectedFed && (
              <div className="p-4 rounded-xl border border-[#d8ded5] bg-[#fcfcf8] space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-mono font-bold bg-[#e2eee4] text-[#194e42] px-2 py-0.5 rounded border border-[#2f6d5a]/30">
                      {selectedFed.federationId}
                    </span>
                    <h4 className="font-extrabold text-[#173235] text-sm mt-1">{selectedFed.name}</h4>
                  </div>
                  <Badge className={selectedFed.accountActivated ? 'bg-[#e2eee4] text-[#194e42] border-[#2f6d5a]' : 'bg-[#fff3f0] text-[#e07050] border-[#efcbc3]'}>
                    {selectedFed.accountActivated ? 'Activated ✓' : 'Setup Required'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#526668]">
                  <div>Sport: <strong>{selectedFed.sport}</strong></div>
                  <div>Abbreviation: <strong>{selectedFed.abbreviation || 'N/A'}</strong></div>
                  <div>Status: <strong>{selectedFed.recognitionStatus} ({selectedFed.recognitionYear})</strong></div>
                  <div>State: <strong>{selectedFed.state}</strong></div>
                  <div className="col-span-2 text-[#194e42] font-bold">
                    Official Email: <span>{selectedFed.officialEmailMasked}</span>
                  </div>
                </div>

                {/* Permanent Federation ID Notice */}
                <div className="p-2.5 rounded-lg bg-[#e2eee4] border border-[#2f6d5a]/40 text-center text-xs">
                  <span className="text-[#526668]">Your Permanent Federation ID: </span>
                  <strong className="font-mono text-[#194e42] tracking-wider">{selectedFed.federationId}</strong>
                </div>

                {/* ALREADY ACTIVATED NOTICE */}
                {selectedFed.accountActivated ? (
                  <div className="p-3 rounded-lg bg-[#fff9e6] border border-[#f0d060] text-center space-y-2">
                    <p className="text-xs font-bold text-[#9a6c00]">
                      This federation account is already activated. Please use Sign In.
                    </p>
                    <button
                      type="button"
                      onClick={handleContinueToSignIn}
                      className="h-9 px-4 rounded-lg bg-[#173d3c] text-white font-bold text-xs cursor-pointer shadow-xs"
                    >
                      Continue to Federation Sign In →
                    </button>
                  </div>
                ) : (
                  <>
                    {/* ACTIVATION FLOW STEPS */}
                    {activationStep === 'select' && (
                      <button
                        type="button"
                        onClick={handleSendActivationOtp}
                        disabled={activationLoading}
                        className="w-full h-10 rounded-lg bg-[#173d3c] hover:bg-[#0c292c] text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      >
                        {activationLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Verify Official Email <Mail className="w-4 h-4" /></>}
                      </button>
                    )}

                    {/* Step 2: Enter Activation OTP */}
                    {activationStep === 'otp' && (
                      <form onSubmit={handleVerifyActivationOtp} className="space-y-3 pt-2">
                        <div className="text-xs font-bold text-[#194e42]">
                          Enter 6-Digit Activation Code Sent to {selectedFed.officialEmailMasked}:
                        </div>
                        <Input
                          type="text"
                          maxLength={6}
                          value={activationOtp}
                          onChange={e => setActivationOtp(e.target.value.replace(/\D/g, ''))}
                          placeholder="Enter 6-digit OTP…"
                          className="text-center font-mono font-extrabold text-lg tracking-widest h-10"
                        />
                        <button
                          type="submit"
                          disabled={activationLoading || activationOtp.length !== 6}
                          className="w-full h-10 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white font-extrabold text-xs uppercase cursor-pointer"
                        >
                          {activationLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verify Code & Proceed'}
                        </button>
                      </form>
                    )}

                    {/* Step 3: Create Password */}
                    {activationStep === 'password' && (
                      <form onSubmit={handleActivateAccount} className="space-y-3 pt-2">
                        <div className="text-xs font-bold text-[#194e42] flex items-center gap-1.5">
                          <CheckCircle2 size={15} /> Email Verified! Create Federation Password:
                        </div>
                        <div>
                          <Label required>New Password (min 8 chars)</Label>
                          <Input
                            type="password"
                            value={activationPassword.password}
                            onChange={e => setActivationPassword({ ...activationPassword, password: e.target.value })}
                            placeholder="Set strong password…"
                            className="text-xs mt-1"
                          />
                        </div>
                        <div>
                          <Label required>Confirm Password</Label>
                          <Input
                            type="password"
                            value={activationPassword.confirmPassword}
                            onChange={e => setActivationPassword({ ...activationPassword, confirmPassword: e.target.value })}
                            placeholder="Confirm password…"
                            className="text-xs mt-1"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={activationLoading || !activationPassword.password}
                          className="w-full h-10 rounded-lg bg-[#173d3c] hover:bg-[#0c292c] text-white font-extrabold text-xs uppercase cursor-pointer shadow-xs"
                        >
                          {activationLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Activate Federation Account'}
                        </button>
                      </form>
                    )}

                    {/* Step 4: Activated Success Confirmation */}
                    {activationStep === 'activated' && (
                      <div className="p-4 rounded-xl bg-[#e2eee4] border border-[#2f6d5a] text-center space-y-2">
                        <Sparkles className="w-6 h-6 text-[#cc694e] mx-auto" />
                        <h4 className="font-extrabold text-[#194e42] text-sm">Federation Account Activated Successfully!</h4>
                        <p className="text-xs text-[#526668]">
                          Your Permanent Federation ID: <strong className="font-mono text-[#173235]">{selectedFed.federationId}</strong>
                        </p>
                        <p className="text-[11px] text-[#697c7c]">Use this Federation ID and your password to sign in.</p>
                        <button
                          type="button"
                          onClick={handleContinueToSignIn}
                          className="h-10 px-5 rounded-lg bg-[#173d3c] text-white font-bold text-xs uppercase cursor-pointer shadow-sm mt-1"
                        >
                          Continue to Federation Sign In →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          </TabsContent>
        </Tabs>

        <CardFooter className="bg-[#fcfcf8] p-4 border-t border-[#e2eee4] text-center justify-center">
          <p className="text-[11px] text-[#8a9d9a]">
            Protected by TrackAthlete 2FA Encryption & Brevo Verification Ledger
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
