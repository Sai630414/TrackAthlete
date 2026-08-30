import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, KeyRound, Mail, ArrowRight, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function FederationLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Credentials, 2: OTP Verification
  const [formData, setFormData] = useState({
    federationId: 'FED-TKD92841',
    password: '',
    otp: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Step 1: Submit Credentials
  const handleCredentialSubmit = async (e) => {
    e?.preventDefault();
    if (!formData.federationId || !formData.password) {
      setError('Federation ID / Email and password are required.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setNotice('');

      const res = await api.post('/federation/login', {
        federationId: formData.federationId,
        password: formData.password
      });

      if (res.data?.requireOTP) {
        setStep(2);
        setNotice(`Verification code sent to registered official email: ${res.data.officialEmail}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Federation authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit OTP Code
  const handleOTPSubmit = async (e) => {
    e?.preventDefault();
    if (!formData.otp || formData.otp.length < 6) {
      setError('Please enter the complete 6-digit OTP code.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const res = await api.post('/federation/verify-otp', {
        federationId: formData.federationId,
        otp: formData.otp
      });

      if (res.data?.token) {
        localStorage.setItem('trackathlete-federation-token', res.data.token);
        localStorage.setItem('trackathlete-session', JSON.stringify({
          token: res.data.token,
          user: {
            _id: res.data.federation._id,
            name: res.data.federation.name,
            role: 'federation',
            federationId: res.data.federation.federationId,
            sport: res.data.federation.sport
          }
        }));

        navigate('/federation/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0c292c 0%, #173d3c 50%, #173235 100%)',
      padding: 20
    }}>
      <div style={{
        background: '#fcfcf8',
        borderRadius: 24,
        border: '1px solid #2f6d5a',
        width: '100%',
        maxWidth: 460,
        boxShadow: '0 24px 64px rgba(12, 41, 44, 0.4)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #173d3c, #0c292c)',
          padding: '28px 32px',
          borderBottom: '1px solid #2f6d5a',
          color: '#fff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              background: '#e07050',
              width: 34,
              height: 34,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <Shield size={20} />
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#b9d9bf' }}>
                Official Federation Portal
              </span>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#fff', fontFamily: 'Georgia, serif' }}>
                Federation Sign In
              </h2>
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#c5d3ce', margin: 0 }}>
            Secure 2-Factor authentication desk for official sports bodies.
          </p>
        </div>

        <div style={{ padding: 32 }}>
          {error && (
            <div style={{
              background: '#fff3f0',
              border: '1px solid #efcbc3',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 20,
              color: '#e07050',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div style={{
              background: '#e2eee4',
              border: '1px solid #2f6d5a',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 20,
              color: '#194e42',
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <CheckCircle2 size={16} />
              <span>{notice}</span>
            </div>
          )}

          {step === 1 ? (
            /* STEP 1: CREDENTIAL FORM */
            <form onSubmit={handleCredentialSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#173235', marginBottom: 6 }}>
                  Federation Permanent ID or Official Email
                </label>
                <div style={{ position: 'relative' }}>
                  <Shield size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#697c7c' }} />
                  <input
                    type="text"
                    value={formData.federationId}
                    onChange={e => setFormData({ ...formData, federationId: e.target.value })}
                    placeholder="e.g. FED-TKD92841 or official@taekwondo.org.in"
                    style={{
                      width: '100%',
                      height: 42,
                      borderRadius: 10,
                      border: '1px solid #d2dad2',
                      paddingLeft: 38,
                      paddingRight: 14,
                      fontSize: 13,
                      outline: 'none',
                      background: '#fff'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#173235', marginBottom: 6 }}>
                  Federation Account Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#697c7c' }} />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••••••"
                    style={{
                      width: '100%',
                      height: 42,
                      borderRadius: 10,
                      border: '1px solid #d2dad2',
                      paddingLeft: 38,
                      paddingRight: 14,
                      fontSize: 13,
                      outline: 'none',
                      background: '#fff'
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  height: 44,
                  borderRadius: 12,
                  border: 'none',
                  background: '#e07050',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 10,
                  boxShadow: '0 4px 12px rgba(224, 112, 80, 0.3)'
                }}
              >
                {loading ? 'Verifying Credentials…' : 'Proceed to 2FA OTP Verification'}
                <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            /* STEP 2: 2FA OTP FORM */
            <form onSubmit={handleOTPSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#173235', marginBottom: 6, textAlign: 'center' }}>
                  Enter 6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={formData.otp}
                  onChange={e => setFormData({ ...formData, otp: e.target.value.replace(/\D/g, '') })}
                  placeholder="123456"
                  style={{
                    width: '100%',
                    height: 52,
                    borderRadius: 12,
                    border: '2px dashed #2f6d5a',
                    fontSize: 24,
                    fontWeight: 900,
                    textAlign: 'center',
                    letterSpacing: 8,
                    outline: 'none',
                    background: '#e2eee4',
                    color: '#194e42',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || formData.otp.length < 6}
                style={{
                  height: 44,
                  borderRadius: 12,
                  border: 'none',
                  background: formData.otp.length === 6 ? '#194e42' : '#ccc',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: formData.otp.length === 6 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 10
                }}
              >
                {loading ? 'Verifying OTP…' : 'Verify Code & Launch Dashboard'}
                <CheckCircle2 size={16} />
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                style={{ background: 'none', border: 'none', color: '#697c7c', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'center', marginTop: 4 }}
              >
                ← Back to Credentials
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
