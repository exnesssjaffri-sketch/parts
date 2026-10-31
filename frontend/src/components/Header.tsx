import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CartBadge } from './CartBadge';
import { SearchBar } from './SearchBar';
import { VehicleFinder } from './VehicleFinder';

const navClass = 'rounded-md px-3 py-2 text-sm font-medium text-charcoal-700 transition-colors hover:bg-charcoal-50 hover:text-automotive-red';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <header className="border-b border-neutral-border bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-4 py-3">
          <Link to="/" className="flex shrink-0 items-center" aria-label="AutoMarts home">
            <span className="text-2xl font-bold text-charcoal-900">AutoMarts</span>
          </Link>

          <div className="hidden min-w-0 flex-1 items-center gap-4 xl:flex">
            <SearchBar />
            <VehicleFinder />
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/cart"
              aria-label="Shopping cart"
              className="relative inline-flex items-center rounded-md p-2 hover:bg-charcoal-50"
            >
              <CartBadge />
            </Link>

            {user ? (
              <>
                <Link to="/account" className="hidden text-sm text-charcoal-700 hover:text-automotive-red sm:inline">
                  {user.first_name} {user.last_name}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-md border border-neutral-border px-3 py-2 text-sm font-medium text-charcoal-700 transition-colors hover:border-automotive-red hover:text-automotive-red"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm text-charcoal-700 transition-colors hover:text-automotive-red">Login</Link>
                <Link
                  to="/register"
                  className="inline-flex items-center rounded-md bg-automotive-red px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-automotive-red-dark"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>

        <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-1 border-t border-neutral-border py-2">
          <Link to="/" className={navClass}>Home</Link>
          <Link to="/products" className={navClass}>Shop Parts</Link>
          <Link to="/track-order" className={navClass}>Track Order</Link>
          <Link to="/cart" className={navClass}>Cart</Link>
          {user && (
            <>
              <Link to="/orders" className={navClass}>My Orders</Link>
              <Link to="/account" className={navClass}>Account</Link>
              <Link to="/profile" className={navClass}>Profile</Link>
            </>
          )}
          {user?.is_admin && (
            <>
              <Link to="/admin" className={navClass}>Admin</Link>
              <Link to="/admin/products" className={navClass}>Inventory</Link>
              <Link to="/admin/orders" className={navClass}>Manage Orders</Link>
              <Link to="/admin/customers" className={navClass}>Customers</Link>
              <Link to="/admin/coupons" className={navClass}>Coupons</Link>
            </>
          )}
        </nav>

        <div className="grid grid-cols-1 gap-3 py-3 md:grid-cols-2 xl:hidden">
          <SearchBar />
          <VehicleFinder />
        </div>
      </div>
    </header>
  );
};
