import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { refreshUser, setMFACredentials } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      if (!code) {
        navigate('/login', { replace: true });
        return;
      }

      try {
        const response = await fetch('/api/auth/google/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code, redirect_uri: window.location.href }),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Google sign-in could not be completed');
        }

        if (data.mfa_required === true) {
          if (!data.challenge_token || !data.user?.email) {
            throw new Error('The MFA challenge response was incomplete. Please sign in again.');
          }
          setMFACredentials(data.user.email, '', data.challenge_token, 'oauth');
          navigate('/mfa/login', { replace: true });
          return;
        }

        // The backend sets an HttpOnly session cookie; the token is not returned in JSON.
        await refreshUser();
        navigate('/', { replace: true });
      } catch (error) {
        console.error('Google sign-in callback failed:', error);
        navigate('/login', { replace: true });
      }
    };

    void handleCallback();
  }, [navigate, refreshUser, setMFACredentials]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-red-600"></div>
        <p className="text-gray-600">Completing Google sign-in...</p>
      </div>
    </div>
  );
};
