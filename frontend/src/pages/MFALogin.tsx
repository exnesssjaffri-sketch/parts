import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export const MFALogin: React.FC = () => {
  const { user, mfaEmail, mfaPassword, mfaChallengeToken, mfaMethod, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Please enter a 6-digit code');
      return;
    }
    if (!mfaChallengeToken) {
      setError('MFA challenge expired. Please sign in again.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (mfaMethod === 'oauth') {
        await api.challengeOAuthMFA({ code, challenge_token: mfaChallengeToken });
      } else {
        const email = mfaEmail || user?.email || '';
        if (!email || !mfaPassword) {
          throw new Error('Your sign-in challenge is incomplete. Please sign in again.');
        }
        await api.challengeMFA({ email, password: mfaPassword, code, challenge_token: mfaChallengeToken });
      }

      await refreshUser();
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-12">
      <div className="mx-auto max-w-md px-4">
        <div className="rounded-xl border border-neutral-border bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-charcoal-900">Two-Factor Authentication</h1>
            <p className="mt-2 text-charcoal-600">Enter the 6-digit code from your authenticator app</p>
          </div>

          {error && (
            <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-charcoal-700">Authentication Code</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-lg border border-neutral-border px-3 py-3 text-center font-mono text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-automotive-red"
                placeholder="000000"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={code.length !== 6 || loading}
              className="btn-primary w-full px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-charcoal-500">
            Lost access to your authenticator? Contact support.
          </p>
        </div>
      </div>
    </div>
  );
};
