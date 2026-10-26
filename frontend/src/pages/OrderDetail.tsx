import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Order } from '../types';
import { Truck, Clock, CheckCircle, XCircle, MapPin, ShieldCheck } from 'lucide-react';

export const OrderDetail: React.FC = () => {
  const { orderNumber } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderNumber) return;
    const loadOrder = async () => {
      setLoading(true);
      try {
        const res = await api.getOrder(orderNumber);
        setOrder(res.order);
      } catch (err: any) {
        setError(err.message || 'Order not found');
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderNumber]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-charcoal-900 mb-8">Order Details</h1>
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

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-charcoal-900 mb-8">Order not found</h1>
          <p className="text-charcoal-600">{error}</p>
          <Link to="/orders" className="inline-flex items-center px-6 py-3 btn-primary text-sm font-medium mt-6">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return <div>Loading...</div>;
  }

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
    <div className="min-h-screen bg-neutral-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-charcoal-900">Order #{order.order_number}</h1>
          <Link to="/orders" className="inline-flex items-center px-4 py-2 btn-outline hover:bg-charcoal-50 text-sm">
            Back to Orders
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Order Info */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-6">
            <div className="flex items-center space-x-4 mb-4">
              <h2 className="text-xl font-bold text-charcoal-900">Order Summary</h2>
              <span className={`px-3 py-1 rounded text-sm font-medium ${statusClass}`}>
                {order.status.toUpperCase()}
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between text-sm text-charcoal-600">
                <span>Order Date</span>
                <span>{order.created_at_formatted}</span>
              </div>
              <div className="flex justify-between text-sm text-charcoal-600">
                <span>Status</span>
                <span>{order.status.toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-sm text-charcoal-600">
                <span>Payment Method</span>
                <span>{order.payment_method.replace('_', ' ').toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-sm text-charcoal-600">
                <span>Payment Status</span>
                <span>{order.payment_status.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-6">
            <h2 className="text-xl font-bold text-charcoal-900 mb-6">Items</h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <OrderItemCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-6 mt-6">
          <h2 className="text-xl font-bold text-charcoal-900 mb-6">Order Totals</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-charcoal-600">
              <span>Subtotal</span>
              <span>¥{order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-charcoal-600">
              <span>Delivery</span>
              <span>¥{order.delivery_charge.toFixed(2)}</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-charcoal-600">
                <span>Discount</span>
                <span>-¥{order.discount_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline border-t border-neutral-border pt-4 mb-4">
              <span className="text-lg font-medium text-charcoal-900">Total</span>
              <span className="text-lg font-medium text-automotive-red">¥{order.total_amount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Status History */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-6 mt-6">
          <h2 className="text-xl font-bold text-charcoal-900 mb-6">Status History</h2>
          <div className="space-y-4">
            {order.status_history.map((status) => (
              <StatusHistoryItem key={status.created_at} status={status} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const OrderItemCard: React.FC<{ item: any }> = ({ item }) => {
  return (
    <div className="flex items-start space-x-4 pb-4 border-b border-neutral-border last:border-b-0">
      <div className="w-16 h-16 bg-charcoal-100 rounded-lg flex items-center justify-center">
        <img
          src={item.product_sku ? `/images/${item.product_sku}.jpg` : ''}
          alt={item.product_name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-medium text-charcoal-900">{item.product_name}</h4>
        <p className="text-xs text-charcoal-500">
          SKU: {item.product_sku} • Qty: {item.quantity}
        </p>
      </div>
      <div className="ml-auto text-right">
        <p className="text-sm font-medium text-charcoal-900">
          ¥{item.line_total.toFixed(2)}
        </p>
      </div>
    </div>
  );
};

const StatusHistoryItem: React.FC<{ status: any }> = ({ status }) => {
  const statusColors = {
    pending: 'text-yellow-600',
    confirmed: 'text-blue-600',
    processing: 'text-indigo-600',
    shipped: 'text-purple-600',
    delivered: 'text-green-600',
    cancelled: 'text-red-600',
    returned: 'text-gray-600',
  };

  return (
    <div className="flex items-center space-x-4">
      <div className="w-8 h-8 rounded-full bg-charcoal-100 flex items-center justify-center">
        <svg className="h-4 w-4 text-charcoal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-charcoal-900">{status.status}</p>
        <p className="text-xs text-charcoal-500">{status.created_at_formatted}</p>
        {status.notes && (
          <p className="text-xs text-charcoal-400 mt-1">{status.notes}</p>
        )}
      </div>
      <div className="text-sm font-medium {statusColors[status.status] || 'text-charcoal-600'}">
        {status.status.toUpperCase()}
      </div>
    </div>
  );
};