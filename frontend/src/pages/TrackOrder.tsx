import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { Order } from '../types';
import { Truck, Clock, MapPin, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';

export const TrackOrder: React.FC = () => {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.trackOrder(orderNumber, email, phone);
      setOrder(res as Order);
    } catch (err: any) {
      setError(err.message || 'Order not found');
    } finally {
      setLoading(false);
    }
  };

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
    <div className="min-h-screen bg-neutral-bg py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-charcoal-900 mb-8">Track Your Order</h1>

        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleTrack} className="card p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-1">Order Number</label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="Enter your order number"
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email used for order"
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone used for order"
                  className="input"
                  required
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary text-sm font-medium"
              >
                {loading ? 'Tracking...' : 'Track Order'}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
              {error}
            </div>
          )}

          {order && (
            <OrderTrackingCard order={order} statusClass={statusClass} />
          )}
        </div>
      </div>
    </div>
  );
};

const OrderTrackingCard: React.FC<{ order: Order; statusClass: Record<string, string> }> = ({ order, statusClass }) => {
  const statusSteps = [
    { label: 'Pending', completed: ['pending', 'confirmed', 'processing', 'shipped', 'delivered'].includes(order.status) },
    { label: 'Confirmed', completed: ['confirmed', 'processing', 'shipped', 'delivered'].includes(order.status) },
    { label: 'Processing', completed: ['processing', 'shipped', 'delivered'].includes(order.status) },
    { label: 'Shipped', completed: ['shipped', 'delivered'].includes(order.status) },
    { label: 'Delivered', completed: order.status === 'delivered' },
  ];

  return (
    <div className="mt-8 card p-6">
      <h2 className="text-xl font-bold text-charcoal-900 mb-6">Order #{order.order_number}</h2>

      <div className="space-y-4 mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-charcoal-100 flex items-center justify-center">
            <svg className="h-4 w-4 text-charcoal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-charcoal-900">{order.status.toUpperCase()}</p>
            <p className="text-xs text-charcoal-500">{order.created_at_formatted}</p>
          </div>
          <div className={`text-sm font-medium ${statusClass[order.status] || ''}`}>
            {order.status.toUpperCase()}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {statusSteps.map((step, index) => (
          <div key={index} className="flex items-center space-x-4">
            <div className={`w-8 h-8 rounded-full ${
              step.completed ? 'bg-automotive-red text-white' : 'bg-charcoal-100'
            } flex items-center justify-center`}>
              {index + 1}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                step.completed ? 'text-charcoal-900' : 'text-charcoal-500'
              }`}>
                {step.label}
              </p>
              <p className="text-xs text-charcoal-400">
                {step.completed ? order.status === 'delivered' && order.delivered_at
                  ? order.delivered_at
                  : order.status !== 'delivered' && index === statusSteps.length - 1
                  ? 'In progress'
                  : 'Completed'
                  : 'Pending'}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-medium text-charcoal-900 mb-4">Shipping Information</h3>
        <div className="p-4 bg-white rounded-lg border border-neutral-border">
          <p className="text-charcoal-700">{order.shipping_address.recipient_name}</p>
          <p className="text-charcoal-700">{order.shipping_address.address_line1}</p>
          {order.shipping_address.address_line2 && (
            <p className="text-charcoal-700">{order.shipping_address.address_line2}</p>
          )}
          <p className="text-charcoal-700">
            {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}
          </p>
          <p className="text-charcoal-700">{order.shipping_address.country}</p>
          <p className="text-charcoal-700">{order.shipping_address.phone}</p>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-medium text-charcoal-900 mb-4">Order Items</h3>
        <div className="space-y-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-start space-x-4 pb-4 border-b border-neutral-border last:border-b-0">
              <div className="w-16 h-16 bg-charcoal-100 rounded-lg flex items-center justify-center">
                <span className="text-xs text-charcoal-500">{item.product_sku}</span>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-charcoal-900">{item.product_name}</h4>
                <p className="text-xs text-charcoal-500">
                  SKU: {item.product_sku} • Qty: {item.quantity}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-sm font-medium text-charcoal-900">
                  Rs. {item.line_total.toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
