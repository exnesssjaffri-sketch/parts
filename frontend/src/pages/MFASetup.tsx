import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export const MFASetup: React.FC = () => {
  useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'setup' | 'qr' | 'verify'>('setup');
  const [qrCodeUri, setQrCodeUri] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const res = await api.setupMFA();
        if (res.already_enabled) {
          navigate('/account');
          return;
        }
        setQrCodeUri(res.qr_code_uri || '');
        setSecret(res.secret || '');
        setStep('qr');
      } catch (err: any) {
        setError(err.message || 'Failed to setup MFA');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate]);

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }
    try {
      setLoading(true);
      await api.verifyMFA(code);
      navigate('/account');
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  if (loading && step === 'setup') {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-12">
      <div className="max-w-md mx-auto px-4">
        <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-8">
          <h1 className="text-2xl font-bold text-charcoal-900 mb-2">Enable Two-Factor Authentication</h1>
          <p className="text-charcoal-600 mb-6">Protect your account with an authenticator app</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
          )}

          {step === 'qr' && (
            <>
              <div className="bg-white p-4 rounded-lg border-2 border-dashed border-neutral-200 mb-6">
                {qrCodeUri ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUri)}`}
                    alt="QR Code for MFA setup"
                    className="mx-auto"
                  />
                ) : (
                  <div className="text-center py-8 text-charcoal-500">Generating QR code...</div>
                )}
              </div>
              <div className="text-center mb-6">
                <p className="text-sm text-charcoal-600 mb-2">Or enter this secret manually:</p>
                <code className="text-lg font-mono font-bold text-charcoal-900 tracking-widest bg-neutral-100 px-3 py-1 rounded">
                  {secret}
                </code>
              </div>
              <p className="text-sm text-charcoal-500 mb-6 text-center">
                Open your authenticator app (Google Authenticator, Authy, etc.) and scan the QR code or enter the secret manually.
              </p>
            </>
          )}

          {step === 'verify' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-charcoal-700 mb-2">Enter 6-digit code</label>
              <input
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-neutral-border rounded-lg text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-automotive-red"
                placeholder="000000"
              />
            </div>
          )}

          <button
            onClick={() => { if (step === 'qr') setStep('verify'); }}
            disabled={step !== 'qr' || !code || loading}
            className="w-full px-4 py-3 btn-primary text-sm font-medium disabled:opacity-50 mb-3"
          >
            {loading ? 'Verifying...' : 'Continue'}
          </button>

          {step === 'verify' && (
            <button
              onClick={handleVerify}
              disabled={!code || code.length !== 6 || loading}
              className="w-full px-4 py-3 btn-primary text-sm font-medium disabled:opacity-50 bg-charcoal-900 hover:bg-charcoal-800"
            >
              {loading ? 'Enabling...' : 'Enable MFA'}
            </button>
          )}

          <p className="text-xs text-charcoal-500 text-center mt-4">
            You can disable MFA anytime from your Account settings.
          </p>
        </div>
      </div>
    </div>
  );
};
