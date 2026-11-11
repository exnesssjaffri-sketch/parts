import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { DashboardStats } from '../types';
import { Truck, Users, ChartBar, Package, BarChart2, DollarSign, Clock, CheckCircle, XCircle } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.is_admin) {
      // Redirect to home if not admin
      window.location.href = '/';
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const res = await api.getDashboard();
        setStats(res.stats);
        setRecentOrders(res.recent_orders);
        setTopProducts(res.top_products);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-charcoal-900 mb-8">Admin Dashboard</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-neutral-border p-6 animate-pulse">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 rounded-full bg-charcoal-100 flex items-center justify-center">
                    <svg className="h-6 w-6 text-charcoal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  </div>
                  <h3 className="h-6 w-32 bg-charcoal-100 rounded mb-2" />
                  <p className="h-4 w-20 bg-charcoal-100 rounded mb-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-charcoal-900 mb-8">Error</h1>
          <p className="text-charcoal-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-charcoal-900">Admin Dashboard</h1>
          <div className="flex space-x-4">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 btn-outline hover:bg-charcoal-50 text-sm"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Orders"
            value={stats?.total_orders || 0}
            icon={<Truck className="h-6 w-6 text-automotive-red" />}
            bgClass="bg-red-50"
          />
          <StatsCard
            title="Total Revenue"
            value={stats?.total_revenue_formatted || '¥0.00'}
            icon={<DollarSign className="h-6 w-6 text-automotive-red" />}
            bgClass="bg-red-50"
          />
          <StatsCard
            title="Total Products"
            value={stats?.total_products || 0}
            icon={<Package className="h-6 w-6 text-automotive-red" />}
            bgClass="bg-red-50"
          />
          <StatsCard
            title="Total Customers"
            value={stats?.total_customers || 0}
            icon={<Users className="h-6 w-6 text-automotive-red" />}
            bgClass="bg-red-50"
          />
          <StatsCard
            title="Low Stock Products"
            value={stats?.low_stock_products || 0}
            icon={<Clock className="h-6 w-6 text-automotive-red" />}
            bgClass="bg-yellow-50"
          />
          <StatsCard
            title="Out of Stock"
            value={stats?.out_of_stock_products || 0}
            icon={<XCircle className="h-6 w-6 text-automotive-red" />}
            bgClass="bg-red-50"
          />
          <StatsCard
            title="Pending Orders"
            value={stats?.pending_orders || 0}
            icon={<CheckCircle className="h-6 w-6 text-automotive-red" />}
            bgClass="bg-green-50"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-6">
            <h2 className="text-xl font-bold text-charcoal-900 mb-4">Monthly Revenue</h2>
            <div className="h-64 bg-charcoal-100 rounded-lg">
              {/* Chart would go here - using a placeholder */}
              <div className="flex items-center justify-center h-full text-charcoal-400">
                Revenue Chart
              </div>
            </div>
          </div>

          {/* Orders Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-6">
            <h2 className="text-xl font-bold text-charcoal-900 mb-4">Order Status</h2>
            <div className="h-64 bg-charcoal-100 rounded-lg">
              {/* Chart would go here - using a placeholder */}
              <div className="flex items-center justify-center h-full text-charcoal-400">
                Order Status Chart
              </div>
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-charcoal-900">Recent Orders</h2>
            <Link
              to="/admin/orders"
              className="px-4 py-2 btn-outline hover:bg-charcoal-50 text-sm"
            >
              View All
            </Link>
          </div>

          <div className="space-y-4">
            {recentOrders.length > 0 ? (
              recentOrders.map((order: any) => (
                <OrderSummaryCard key={order.id} order={order} />
              ))
            ) : (
              <div className="text-center py-8 text-charcoal-500">
                No recent orders
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-charcoal-900">Top Selling Products</h2>
            <Link
              to="/admin/products"
              className="px-4 py-2 btn-outline hover:bg-charcoal-50 text-sm"
            >
              View All
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topProducts.length > 0 ? (
              topProducts.map((product: any) => (
                <ProductSummaryCard key={product.id} product={product} />
              ))
            ) : (
              <div className="text-center py-8 text-charcoal-500">
                No product data
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatsCard: React.FC<{
  title: string;
  value: number | string;
  icon: JSX.Element;
  bgClass: string;
}> = ({ title, value, icon, bgClass }) => {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-neutral-border p-6 ${bgClass}`}>
      <div className="flex items-center space-x-3">
        <div className="h-10 w-10 rounded-full bg-automotive-red flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="text-sm text-charcoal-500">{title}</p>
          <p className="text-2xl font-bold text-charcoal-900">{value}</p>
        </div>
      </div>
    </div>
  );
};

const OrderSummaryCard: React.FC<{ order: any }> = ({ order }) => {
  return (
    <div className="flex items-center space-x-4">
      <div className="w-12 h-12 rounded-full bg-charcoal-100 flex items-center justify-center">
        <svg className="h-6 w-6 text-charcoal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 8v4l3 3" />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-charcoal-900">Order #{order.order_number}</p>
        <p className="text-xs text-charcoal-500">{order.created_at_formatted}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-charcoal-900">¥{order.total_amount.toFixed(2)}</p>
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
          {order.status.toUpperCase()}
        </span>
      </div>
    </div>
  );
};

const ProductSummaryCard: React.FC<{ product: any }> = ({ product }) => {
  return (
    <div className="flex items-center space-x-4">
      <div className="w-12 h-12 rounded-full bg-charcoal-100 flex items-center justify-center">
        <img
          src={product.primary_image || ''}
          alt={product.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-charcoal-900">{product.name}</p>
        <p className="text-xs text-charcoal-500">SKU: {product.sku}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-charcoal-900">¥{product.effective_price.toFixed(2)}</p>
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
          {product.stock_quantity} in stock
        </span>
      </div>
    </div>
  );
};