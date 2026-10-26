import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Order, CartItem } from '../types';
import { CreditCard, Truck, MapPin, ShieldCheck, User } from 'lucide-react';

export const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, summary, loading: cartLoading } = useCart();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [step, setStep] = useState<number>(1);

  const couponCode = new URLSearchParams(location.search).get('coupon_code') || '';

  const [formData, setFormData] = useState({
    email: user?.email || '',
    phone: user?.phone || '',
    shipping_address: {
      recipient_name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
      phone: user?.phone || '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'China',
    },
    billing_address: {
      recipient_name: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'China',
    },
    payment_method: 'credit_card',
    notes: '',
  });

  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart');
    }
  }, [items, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = {
        ...formData,
        shipping_address: formData.shipping_address,
        billing_address: formData.billing_address,
        payment_method: formData.payment_method,
        coupon_code: couponCode,
        notes: formData.notes,
      };

      const res = await api.checkout(data);
      setSuccess('Order placed successfully!');
      setStep(3);
      navigate(`/orders/${res.order.order_number}`);
    } catch (err: any) {
      setError(err.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  if (cartLoading || authLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-charcoal-900 mb-8">Checkout</h1>
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
        <div className="mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-charcoal-100 flex items-center justify-center">
              <span className="text-charcoal-600">1</span>
            </div>
            <h2 className="text-2xl font-bold text-charcoal-900">Checkout</h2>
          </div>
          <p className="mt-2 text-charcoal-600">
            Complete your order in {step === 1 ? '3' : step === 2 ? '2' : '1'} simple steps
          </p>
        </div>

        <div className="space-y-8">
          {step === 1 && (
            <CheckoutForm
              formData={formData}
              onChange={(e) => {
                const { name, value } = e.target;
                setFormData((prev) => ({
                  ...prev,
                  [name]: value,
                }));
              }}
              setStep={setStep}
              user={user}
            />
          )}

          {step === 2 && (
            <OrderReview
              items={items}
              summary={summary}
              couponCode={couponCode}
              shippingAddress={formData.shipping_address}
              billingAddress={formData.billing_address}
              onBack={() => setStep(1)}
              onNext={setStep}
            />
          )}

          {step === 3 && (
            <OrderSuccess
              setStep={setStep}
              successMessage={success}
              errorMessage={error}
            />
          )}
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-3 btn-primary text-sm font-medium"
          >
            {loading ? 'Processing...' : 'Place Order'}
          </button>
        </div>
      </div>
    </div>
  );
};

const CheckoutForm: React.FC<{
  formData: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  setStep: (step: number) => void;
  user: any;
}> = ({ formData, onChange, setStep, user }) => {
  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
      <h2 className="text-xl font-bold text-charcoal-900 mb-4">Shipping Information</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1">Recipient Name</label>
          <input
            type="text"
            name="shipping_address.recipient_name"
            value={formData.shipping_address.recipient_name}
            onChange={onChange}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1">Phone</label>
          <input
            type="tel"
            name="shipping_address.phone"
            value={formData.shipping_address.phone}
            onChange={onChange}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1">Address Line 1</label>
          <input
            type="text"
            name="shipping_address.address_line1"
            value={formData.shipping_address.address_line1}
            onChange={onChange}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1">Address Line 2</label>
          <input
            type="text"
            name="shipping_address.address_line2"
            value={formData.shipping_address.address_line2}
            onChange={onChange}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1">City</label>
          <input
            type="text"
            name="shipping_address.city"
            value={formData.shipping_address.city}
            onChange={onChange}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1">State / Province</label>
          <input
            type="text"
            name="shipping_address.state"
            value={formData.shipping_address.state}
            onChange={onChange}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1">Postal Code</label>
          <input
            type="text"
            name="shipping_address.postal_code"
            value={formData.shipping_address.postal_code}
            onChange={onChange}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1">Country</label>
          <input
            type="text"
            name="shipping_address.country"
            value={formData.shipping_address.country}
            onChange={onChange}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          />
        </div>
      </div>

      <h2 className="text-xl font-bold text-charcoal-900 mb-4">Billing Information</h2>
      <div className="flex items-center mb-2">
        <input
          type="checkbox"
          id="same-address"
          checked={formData.billing_address.recipient_name === formData.shipping_address.recipient_name}
          onChange={(e) => {
            if (e.target.checked) {
              setFormData({
                ...formData,
                billing_address: { ...formData.shipping_address },
              });
            }
          }}
          className="h-4 w-4 text-automotive-red focus:ring-automotive-red"
        />
        <label htmlFor="same-address" className="ml-2 text-charcoal-600">
          Same as shipping address
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1">Recipient Name</label>
          <input
            type="text"
            name="billing_address.recipient_name"
            value={formData.billing_address.recipient_name}
            onChange={onChange}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1">Phone</label>
          <input
            type="tel"
            name="billing_address.phone"
            value={formData.billing_address.phone}
            onChange={onChange}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1">Address Line 1</label>
          <input
            type="text"
            name="billing_address.address_line1"
            value={formData.billing_address.address_line1}
            onChange={onChange}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1">Address Line 2</label>
          <input
            type="text"
            name="billing_address.address_line2"
            value={formData.billing_address.address_line2}
            onChange={onChange}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1">City</label>
          <input
            type="text"
            name="billing_address.city"
            value={formData.billing_address.city}
            onChange={onChange}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1">State / Province</label>
          <input
            type="text"
            name="billing_address.state"
            value={formData.billing_address.state}
            onChange={onChange}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1">Postal Code</label>
          <input
            type="text"
            name="billing_address.postal_code"
            value={formData.billing_address.postal_code}
            onChange={onChange}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1">Country</label>
          <input
            type="text"
            name="billing_address.country"
            value={formData.billing_address.country}
            onChange={onChange}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          />
        </div>
      </div>

      <h2 className="text-xl font-bold text-charcoal-900 mb-4">Payment Method</h2>
      <div className="space-y-4">
        <div>
          <input
            type="radio"
            id="credit-card"
            name="payment_method"
            value="credit_card"
            checked={formData.payment_method === 'credit_card'}
            onChange={onChange}
            className="h-4 w-4 text-automotive-red focus:ring-automotive-red"
          />
          <label htmlFor="credit-card" className="ml-2 text-charcoal-600">
            Credit Card
          </label>
        </div>
        <div>
          <input
            type="radio"
            id="paypal"
            name="payment_method"
            value="paypal"
            checked={formData.payment_method === 'paypal'}
            onChange={onChange}
            className="h-4 w-4 text-automotive-red focus:ring-automotive-red"
          />
          <label htmlFor="paypal" className="ml-2 text-charcoal-600">
            PayPal
          </label>
        </div>
        <div>
          <input
            type="radio"
            id="bank-transfer"
            name="payment_method"
            value="bank_transfer"
            checked={formData.payment_method === 'bank_transfer'}
            onChange={onChange}
            className="h-4 w-4 text-automotive-red focus:ring-automotive-red"
          />
          <label htmlFor="bank-transfer" className="ml-2 text-charcoal-600">
            Bank Transfer
          </label>
        </div>
      </div>

      <h2 className="text-xl font-bold text-charcoal-900 mb-4">Order Notes (Optional)</h2>
      <textarea
        name="notes"
        value={formData.notes}
        onChange={onChange}
        rows={4}
        className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
      />

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="px-4 py-2 btn-outline hover:bg-charcoal-50 text-sm"
        >
          Review Order
        </button>
      </div>
    </form>
  );
};

const OrderReview: React.FC<{
  items: CartItem[];
  summary: any;
  couponCode: string;
  shippingAddress: any;
  billingAddress: any;
  onBack: () => void;
  onNext: (step: number) => void;
}> = ({ items, summary, couponCode, shippingAddress, billingAddress, onBack, onNext }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-charcoal-900 mb-4">Review Order</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-medium text-charcoal-900 mb-2">Items</h3>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-center space-x-4 pb-4 border-b border-neutral-border last:border-b-0">
                <div className="w-16 h-16 bg-charcoal-100 rounded-lg flex items-center justify-center">
                  <img
                    src={item.product.primary_image || ''}
                    alt={item.product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-charcoal-900">{item.product.name}</h4>
                  <p className="text-xs text-charcoal-500">
                    SKU: {item.product.sku} • Qty: {item.quantity}
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-sm font-medium text-charcoal-900">
                    ¥{item.line_total.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-charcoal-900 mb-2">Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-charcoal-600">
              <span>Subtotal</span>
              <span>¥{summary.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-charcoal-600">
              <span>Delivery</span>
              <span>¥0.00</span>
            </div>
            {couponCode && (
              <div className="flex justify-between text-sm text-charcoal-600">
                <span>Coupon Discount</span>
                <span>-¥0.00</span>
              </div>
            )}
            <div className="flex justify-between items-baseline border-t border-neutral-border pt-4 mb-4">
              <span className="text-lg font-medium text-charcoal-900">Total</span>
              <span className="text-lg font-medium text-automotive-red">¥{summary.subtotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-medium text-charcoal-900 mb-2">Shipping Address</h3>
        <div className="p-3 bg-white rounded-lg border border-neutral-border">
          <p className="text-charcoal-700">{shippingAddress.recipient_name}</p>
          <p className="text-charcoal-700">{shippingAddress.address_line1}</p>
          {shippingAddress.address_line2 && <p className="text-charcoal-700">{shippingAddress.address_line2}</p>}
          <p className="text-charcoal-700">
            {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postal_code}
          </p>
          <p className="text-charcoal-700">{shippingAddress.country}</p>
          <p className="text-charcoal-700">{shippingAddress.phone}</p>
        </div>
      </div>

      <div className="mt-6 flex justify-end space-x-3">
        <button
          onClick={onBack}
          className="px-4 py-2 btn-outline hover:bg-charcoal-50 text-sm"
        >
          Back to Shipping
        </button>
        <button
          onClick={() => onNext(3)}
          className="px-6 py-2 btn-primary text-sm font-medium"
        >
          Place Order
        </button>
      </div>
    </div>
  );
};

const OrderSuccess: React.FC<{
  setStep: (step: number) => void;
  successMessage: string | null;
  errorMessage: string | null;
}> = ({ setStep, successMessage, errorMessage }) => {
  return (
    <div className="text-center py-20">
      {successMessage ? (
        <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-lg text-green-600">
          {successMessage}
        </div>
      ) : (
        <div className="mb-8 p-6 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {errorMessage || 'An error occurred'}
        </div>
      )}

      <div className="h-24 w-24 mx-auto mb-6">
        {successMessage ? (
          <svg className="h-12 w-12 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg className="h-12 w-12 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        )}
      </div>

      <h2 className="text-2xl font-bold text-charcoal-900 mb-4">
        {successMessage ? 'Order Placed Successfully!' : 'Order Failed'}
      </h2>
      <p className="text-charcoal-600 mb-8">
        {successMessage
          ? 'Thank you for your purchase. Your order has been confirmed.'
          : 'Please check your information and try again.'}
      </p>

      <div className="mt-8">
        <Link
          to="/orders"
          className="px-6 py-3 btn-primary text-sm font-medium mr-3"
        >
          View Orders
        </Link>
        <Link
          to="/products"
          className="px-6 py-3 btn-outline hover:bg-charcoal-50 text-sm font-medium"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
};