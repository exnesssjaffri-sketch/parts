import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { api } from '../utils/api';
import { supabase } from '../utils/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  mfaRequired: boolean;
  mfaEmail: string;
  mfaPassword: string;
  mfaChallengeToken: string;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; first_name: string; last_name: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { first_name?: string; last_name?: string; phone?: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  setMFACredentials: (email: string, password: string, challengeToken?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [mfaRequired, setMfaRequired] = useState<boolean>(false);
  const [mfaEmail, setMfaEmail] = useState<string>('');
  const [mfaPassword, setMfaPassword] = useState<string>('');

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.getCurrentUser();
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        refreshUser();
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshUser]);

  const setMFACredentials = (eml: string, pwd: string, challengeToken?: string) => {
    setMfaEmail(eml);
    setMfaPassword(pwd);
    if (challengeToken) setMfaChallengeToken(challengeToken);
  };

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    if (res.mfa_required) {
      setMfaRequired(true);
      setMfaEmail(email);
      setMfaPassword(password);
      setMfaChallengeToken(res.challenge_token || '');
      return;
    }
    setUser(res.user);
  };

  const register = async (data: { email: string; password: string; first_name: string; last_name: string; phone?: string }) => {
    const res = await api.register(data);
    setUser(res.user);
  };

  const logout = async () => {
    await api.logout();
    await supabase.auth.signOut();
    setUser(null);
  };

  const updateProfile = async (data: { first_name?: string; last_name?: string; phone?: string }) => {
    const res = await api.updateProfile(data);
    setUser(res.user);
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, loading, mfaRequired, mfaEmail, mfaPassword, mfaChallengeToken, login, register, logout, updateProfile, refreshUser, signInWithGoogle, setMFACredentials }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
