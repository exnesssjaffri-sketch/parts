import React from 'react';
import { Link } from 'react-router-dom';

const footerLinkClass = 'text-sm text-charcoal-300 transition-colors hover:text-white';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-charcoal-800 bg-charcoal-900 py-12 text-charcoal-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="text-xl font-semibold text-white">AutoMarts</Link>
            <p className="mt-4 text-sm leading-6 text-charcoal-300">
              Find the right automotive parts for your vehicle, browse the catalogue and follow your order from checkout to delivery.
            </p>
          </div>
          <div>
            <h3 className="mb-4 font-medium text-white">Shop</h3>
            <ul className="space-y-3">
              <li><Link to="/" className={footerLinkClass}>Home</Link></li>
              <li><Link to="/products" className={footerLinkClass}>All Products</Link></li>
              <li><Link to="/cart" className={footerLinkClass}>Shopping Cart</Link></li>
              <li><Link to="/checkout" className={footerLinkClass}>Checkout</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 font-medium text-white">Orders</h3>
            <ul className="space-y-3">
              <li><Link to="/track-order" className={footerLinkClass}>Track an Order</Link></li>
              <li><Link to="/orders" className={footerLinkClass}>My Orders</Link></li>
              <li><Link to="/account" className={footerLinkClass}>My Account</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 font-medium text-white">Your Account</h3>
            <ul className="space-y-3">
              <li><Link to="/login" className={footerLinkClass}>Login</Link></li>
              <li><Link to="/register" className={footerLinkClass}>Create Account</Link></li>
              <li><Link to="/profile" className={footerLinkClass}>Profile & Password</Link></li>
              <li><Link to="/mfa/setup" className={footerLinkClass}>Two-Factor Security</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-charcoal-800 pt-6 text-center text-sm text-charcoal-400">
          © {new Date().getFullYear()} AutoMarts. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
