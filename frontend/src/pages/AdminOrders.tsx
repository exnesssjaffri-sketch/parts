import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Link, useNavigate } from 'react-router-dom';
import { Truck, Users, Calendar, CheckCircle, XCircle, Edit, Trash2 } from 'lucide-react';

export const AdminOrders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    status: '',
    search: '',
    start_date: '',
    end_date: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1,
    has_next: false,
    has_prev: false,
  });

  useEffect(() => {
    if (!user?.is_admin) {
      window.location.href = '/';
      return;
    }

    const loadOrders = async () => {
      setLoading(true);
      try {
        const res = await api.getAdminOrders(filters);
        setOrders(res.items || []);
        setPagination(res.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        });
      } catch (err: any) {
        setError(err.message || 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [user, filters]);

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await api.updateOrderStatus(id, { status });
      setOrders(orders.map((o) => (o.id === id ? { ...o, status } : o)));
    } catch (err: any) {
      setError(err.message || 'Failed to update order status');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this order?')) {
      try {
        // Note: API might not have delete order, just cancel
        await api.cancelOrder(orders.find((o) => o.id === id)?.order_number || '', 'Admin deleted');
        setOrders(orders.filter((o) => o.id !== id));
      } catch (err: any) {
        setError(err.message || 'Failed to delete order');
      }
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, search: e.target.value, page: 1 });
  };

  const handleFilterChange = (name: string, value: string) => {
    setFilters({ ...filters, [name]: value, page: 1 });
  };

  const handlePageChange = (page: number) => {
    setFilters({ ...filters, page });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-charcoal-900 mb-8">Admin Orders</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
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

  const statusClass = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    processing: 'bg-indigo-100 text-indigo-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    returned: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-charcoal-900">Admin Orders</h1>
          <Link
            to="/admin/orders/create"
            className="inline-flex items-center px-6 py-3 btn-primary text-sm font-medium"
          >
            <Truck className="h-4 w-4 mr-2" /> Create Order
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={handleSearch}
                placeholder="Search orders..."
                className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="returned">Returned</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1">Date Range</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
              />
            </div>

            <div>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
              />
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-border">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-border">
              <thead className="bg-charcoal-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Order #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-border">
                {orders.length > 0 ? (
                  orders.map((order) => (
                    <tr key={order.id} className="hover:bg-charcoal-50">
                      <td className="px-6 py-4 whitespace-nowrap flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full bg-charcoal-100 flex items-center justify-center">
                          <Truck className="h-6 w-6 text-charcoal-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-charcoal-900">#{order.order_number}</p>
                          <p className="text-xs text-charcoal-500">{order.created_at_formatted}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal-900">
                        {order.shipping_address.recipient_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal-900">
                        {order.created_at_formatted}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal-900">
                        ¥{order.total_amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusClass[order.status]}`}>
                          {order.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal-900">
                        {order.payment_method.replace('_', ' ').toUpperCase()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          to={`/admin/orders/${order.id}`}
                          className="text-sm text-charcoal-600 hover:text-automotive-red mr-2"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(order.id)}
                          className="text-sm text-charcoal-600 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-6 py-12 text-center text-charcoal-500" colSpan="7">
                      No orders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-between pt-6 border-t border-neutral-border">
          <div className="text-sm text-charcoal-500">
            {orders.length} of {pagination.total} orders
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!pagination.has_prev}
              className="px-3 py-2 border border-neutral-border rounded-lg hover:bg-charcoal-50 transition-colors disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.has_next}
              className="px-3 py-2 bg-automotive-red text-white rounded-lg hover:bg-automotive-red-dark transition-colors disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};