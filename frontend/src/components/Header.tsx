import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CartBadge } from './CartBadge';
import { SearchBar } from './SearchBar';
import { VehicleFinder } from './VehicleFinder';
import { Menu } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="border-b border-neutral-border bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-charcoal-900">AutoMarts</span>
            </Link>

            <SearchBar />
            <VehicleFinder />
          </div>

          <div className="flex items-center space-x-4">
            <Link to="/cart" className="relative inline-flex items-center p-1 rounded-md hover:bg-charcoal-50">
              <CartBadge />
            </Link>

            {user ? (
              <div className="relative">
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 text-sm text-charcoal-700 hover:text-automotive-red transition-colors"
                >
                  <Menu className="h-4 w-4" />
                  <span>{user.first_name} {user.last_name}</span>
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" className="text-sm text-charcoal-700 hover:text-automotive-red transition-colors">Login</Link>
                <Link to="/register" className="ml-4 inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-automotive-red hover:bg-automotive-red-dark">Register</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
