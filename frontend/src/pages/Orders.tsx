import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Order } from '../types';

export const Orders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    const loadOrders = async () => {
      if (!user) {
        navigate('/login');
        return;
      }
      setLoading(true);
      try {
        const res = await api.getOrders(page, statusFilter);
        setOrders(res.orders);
      } catch (err: any) {
        setError(err.message || 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [user, page, statusFilter, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-charcoal-900 mb-8">My Orders</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-4 border border-neutral-border animate-pulse">
                <div className="h-24 w-full bg-charcoal-100 rounded-lg mb-3" />
                <h3 className="h-6 w-40 bg-charcoal-100 rounded mb-2" />
                <p className="h-4 w-32 bg-charcoal-100 rounded mb-2" />
                <div className="flex items-center space-x-2">
                  <span className="h-4 w-4 bg-charcoal-100 rounded-full" />
                  <span className="h-4 w-20 bg-charcoal-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-charcoal-900">My Orders</h1>
          <Link
            to="/track-order"
            className="inline-flex items-center px-4 py-2 btn-outline hover:bg-charcoal-50 text-sm"
          >
            Track Order
          </Link>
        </div>

        <div className="mb-6">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
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

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {orders.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-xl font-bold text-charcoal-900 mb-4">No orders yet</h2>
            <p className="text-charcoal-600 mb-6">
              Your order history will appear here once you place an order.
            </p>
            <Link
              to="/products"
              className="inline-flex items-center px-6 py-3 btn-primary text-sm font-medium"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const OrderCard: React.FC<{ order: Order }> = ({ order }) => {
  const statusClass = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    processing: 'bg-indigo-100 text-indigo-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    returned: 'bg-gray-100 text-gray-800',
  }[order.status] || 'bg-charcoal-100 text-charcoal-800';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-border hover:shadow-md transition-shadow duration-200">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-medium text-charcoal-900">Order #{order.order_number}</h3>
          <span className={`px-3 py-1 rounded text-sm font-medium ${statusClass}`}>
            {order.status.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-sm text-charcoal-600">Order Date</p>
            <p className="text-charcoal-900 font-medium">{order.created_at_formatted}</p>
          </div>
          <div>
            <p className="text-sm text-charcoal-600">Total</p>
            <p className="text-charcoal-900 font-medium text-automotive-red">
              ¥{order.total_amount.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-charcoal-600">Items</p>
            <p className="text-charcoal-900 font-medium">
              {order.items.length} item{order.items.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <Link
            to={`/orders/${order.order_number}`}
            className="px-4 py-2 btn-primary text-sm font-medium"
          >
            View Details
          </Link>
          {order.status === 'pending' && (
            <button
              onClick={() => {
                // Cancel order logic
              }}
              className="px-4 py-2 btn-outline text-sm text-red-600 hover:bg-red-50"
            >
              Cancel Order
            </button>
          )}
        </div>
      </div>
    </div>
  );
};