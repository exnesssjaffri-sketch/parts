import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthCallback } from './pages/AuthCallback';
import { MFASetup } from './pages/MFASetup';
import { MFALogin } from './pages/MFALogin';
import { CartProvider } from './context/CartContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { Products } from './pages/Products';
import { ProductDetail } from './pages/ProductDetail';
import { Cart } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { Orders } from './pages/Orders';
import { OrderDetail } from './pages/OrderDetail';
import { TrackOrder } from './pages/TrackOrder';
import { Account } from './pages/Account';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Profile } from './pages/Profile';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminProducts } from './pages/AdminProducts';
import { AdminOrders } from './pages/AdminOrders';
import { AdminCustomers } from './pages/AdminCustomers';
import { AdminCoupons } from './pages/AdminCoupons';

const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !user.is_admin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Header />
          <main className="min-h-screen bg-neutral-50">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:slug" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
              <Route path="/orders/:orderNumber" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
              <Route path="/track-order" element={<TrackOrder />} />
              <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/mfa/setup" element={<ProtectedRoute><MFASetup /></ProtectedRoute>} />
              <Route path="/mfa/login" element={<MFALogin />} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/products" element={<ProtectedRoute adminOnly><AdminProducts /></ProtectedRoute>} />
              <Route path="/admin/orders" element={<ProtectedRoute adminOnly><AdminOrders /></ProtectedRoute>} />
              <Route path="/admin/customers" element={<ProtectedRoute adminOnly><AdminCustomers /></ProtectedRoute>} />
              <Route path="/admin/coupons" element={<ProtectedRoute adminOnly><AdminCoupons /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
};
export default App;
