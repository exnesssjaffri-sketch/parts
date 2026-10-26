import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export const Account: React.FC = () => {
  const { user } = useAuth();
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaPending, setMfaPending] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);

  useEffect(() => {
    api.getMFAStatus().then((res) => {
      setMfaEnabled(res.mfa_enabled);
      setMfaPending(res.mfa_pending);
    }).catch(() => {});
  }, []);

  const handleDisableMFA = async () => {
    if (!mfaCode) {
      setMfaError('Please enter your MFA code');
      return;
    }
    try {
      setMfaLoading(true);
      setMfaError(null);
      setMfaMessage(null);
      const res = await api.disableMFA(mfaCode);
      if (res.success) {
        setMfaEnabled(false);
        setMfaPending(false);
        setMfaMessage('MFA disabled successfully');
        setMfaCode('');
      }
    } catch (err: any) {
      setMfaError(err.message || 'Failed to disable MFA');
    } finally {
      setMfaLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-charcoal-900 mb-8">Account</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Profile */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-6">
            <h2 className="text-xl font-bold text-charcoal-900 mb-6">Profile</h2>
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-charcoal-100 rounded-full flex items-center justify-center">
                  <span className="text-charcoal-500 text-xl font-bold">
                    {(user?.first_name || 'U')[0]}{(user?.last_name || 'S')[0]}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-charcoal-900">
                    {user?.first_name} {user?.last_name}
                  </h3>
                  <p className="text-sm text-charcoal-600">{user?.email}</p>
                </div>
              </div>

              <Link
                to="/profile"
                className="inline-flex items-center px-4 py-2 btn-outline hover:bg-charcoal-50 text-sm"
              >
                Edit Profile
              </Link>
            </div>
          </div>

          {/* Security / MFA */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-6">
            <h2 className="text-xl font-bold text-charcoal-900 mb-6">Security</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-charcoal-50 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-charcoal-900">Two-Factor Authentication</h3>
                  <p className="text-xs text-charcoal-600 mt-1">
                    {mfaEnabled ? 'MFA is enabled on your account' : mfaPending ? 'MFA setup pending verification' : 'MFA is not enabled'}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  mfaEnabled ? 'bg-green-100 text-green-800' : mfaPending ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                }`}>
                  {mfaEnabled ? 'Enabled' : mfaPending ? 'Pending' : 'Disabled'}
                </span>
              </div>

              {!mfaEnabled && !mfaPending && (
                <Link
                  to="/mfa/setup"
                  className="inline-flex items-center px-4 py-2 btn-primary text-sm"
                >
                  Enable MFA
                </Link>
              )}

              {mfaEnabled && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-charcoal-700 mb-1">Enter MFA Code to Disable</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 border border-neutral-border rounded-lg text-center font-mono focus:outline-none focus:ring-2 focus:ring-automotive-red"
                      placeholder="000000"
                    />
                  </div>
                  <button
                    onClick={handleDisableMFA}
                    disabled={mfaLoading || mfaCode.length !== 6}
                    className="w-full px-4 py-2 btn-outline text-sm disabled:opacity-50"
                  >
                    {mfaLoading ? 'Disabling...' : 'Disable MFA'}
                  </button>
                  {mfaError && <p className="text-sm text-red-600">{mfaError}</p>}
                  {mfaMessage && <p className="text-sm text-green-600">{mfaMessage}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Orders */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-6">
            <h2 className="text-xl font-bold text-charcoal-900 mb-6">Recent Orders</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-charcoal-600">Order #AUTO-1234</span>
                <span className="px-3 py-1 rounded text-sm font-medium bg-green-100 text-green-800">
                  Delivered
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-charcoal-600">Order #AUTO-1233</span>
                <span className="px-3 py-1 rounded text-sm font-medium bg-blue-100 text-blue-800">
                  Shipped
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-charcoal-600">Order #AUTO-1232</span>
                <span className="px-3 py-1 rounded text-sm font-medium bg-indigo-100 text-indigo-800">
                  Processing
                </span>
              </div>
            </div>
            <Link
              to="/orders"
              className="inline-flex items-center px-4 py-2 btn-outline hover:bg-charcoal-50 text-sm mt-4"
            >
              View All Orders
            </Link>
          </div>

          {/* Addresses */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-6">
            <h2 className="text-xl font-bold text-charcoal-900 mb-6">Addresses</h2>
            <div className="space-y-4">
              <div className="p-4 bg-charcoal-50 rounded-lg border border-charcoal-100">
                <h3 className="text-sm font-medium text-charcoal-900 mb-2">Default Shipping</h3>
                <p className="text-charcoal-600">123 Auto Parts St, Beijing, China 100000</p>
              </div>
              <div className="p-4 bg-charcoal-50 rounded-lg border border-charcoal-100">
                <h3 className="text-sm font-medium text-charcoal-900 mb-2">Default Billing</h3>
                <p className="text-charcoal-600">123 Auto Parts St, Beijing, China 100000</p>
              </div>
            </div>
            <Link
              to="/profile"
              className="inline-flex items-center px-4 py-2 btn-outline hover:bg-charcoal-50 text-sm mt-4"
            >
              Manage Addresses
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
