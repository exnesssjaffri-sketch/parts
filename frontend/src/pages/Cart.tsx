import React, { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { CartItem } from '../types';
import { Trash2, Checkout } from 'lucide-react';

export const Cart: React.FC = () => {
  const { items, summary, loading, removeItem, updateQuantity, clearCart, refreshCart } = useCart();
  const navigate = useNavigate();
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [couponCode, setCouponCode] = useState<string>('');

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    // In a real app, this would call an API to validate and apply coupon
    // For now, we'll just navigate to checkout with coupon
    const params = new URLSearchParams({ coupon_code: couponCode });
    navigate(`/checkout?${params.toString()}`);
  };

  const handleClearCart = async () => {
    setIsClearing(true);
    try {
      await clearCart();
    } finally {
      setIsClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-charcoal-900 mb-8">Shopping Cart</h1>
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

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
          <div className="h-24 w-24 mx-auto mb-6 bg-charcoal-100 rounded-full flex items-center justify-center">
            <ShoppingCart className="h-12 w-12 text-charcoal-300" />
          </div>
          <h2 className="text-2xl font-bold text-charcoal-900 mb-4">Your cart is empty</h2>
          <p className="text-charcoal-600 mb-8">
            Add some parts to get started on your next project.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center px-6 py-3 btn-primary text-sm font-medium"
          >
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-charcoal-900 mb-8">Shopping Cart</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Cart Items */}
          <div className="space-y-6">
            {items.map((item) => (
              <CartItemCard key={item.id} item={item} onRemove={removeItem} onUpdate={updateQuantity} />
            ))}
          </div>

          {/* Cart Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-6">
            <h2 className="text-xl font-bold text-charcoal-900 mb-6">Order Summary</h2>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-sm text-charcoal-600">
                <span>Subtotal</span>
                <span>¥{summary.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-charcoal-600">
                <span>Delivery</span>
                <span>¥0.00</span>
              </div>
              <div className="flex justify-between text-sm text-charcoal-600 mb-4">
                <span>Coupon Discount</span>
                <span>-¥0.00</span>
              </div>
            </div>

            <div className="flex justify-between items-baseline border-t border-neutral-border pt-6">
              <span className="text-2xl font-bold text-charcoal-900">Total</span>
              <span className="text-2xl font-bold text-automotive-red">¥{summary.subtotal.toFixed(2)}</span>
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={handleClearCart}
                disabled={isClearing}
                className="flex-1 px-4 py-3 btn-outline hover:bg-charcoal-50"
              >
                {isClearing ? 'Clearing...' : 'Clear Cart'}
              </button>
              <Link
                to="/checkout"
                className="flex-1 px-4 py-3 btn-primary text-sm font-medium"
              >
                Proceed to Checkout
              </Link>
            </div>
          </div>
        </div>

        {/* Coupon Section */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-neutral-border p-6">
          <h2 className="text-xl font-bold text-charcoal-900 mb-4">Coupon Code</h2>
          <div className="flex space-x-3">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Enter coupon code"
              className="flex-1 px-3 py-2 border border-neutral-border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
            />
            <button
              onClick={applyCoupon}
              className="px-4 py-2 bg-automotive-red text-white rounded-r-lg hover:bg-automotive-red-dark"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CartItemCard: React.FC<{
  item: CartItem;
  onRemove: (productId: number) => Promise<void>;
  onUpdate: (productId: number, quantity: number) => Promise<void>;
}> = ({ item, onRemove, onUpdate }) => {
  const [quantity, setQuantity] = React.useState(item.quantity);

  const handleUpdate = async () => {
    await onUpdate(item.product.id, quantity);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-6">
      <div className="flex items-start space-x-4">
        <div className="w-24 h-24 bg-charcoal-100 rounded-lg flex items-center justify-center">
          <img
            src={item.product.primary_image || ''}
            alt={item.product.name}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-medium text-charcoal-900">{item.product.name}</h3>
          <p className="text-sm text-charcoal-600 mb-2">
            SKU: {item.product.sku} • {item.product.condition}
          </p>

          <div className="flex items-center space-x-4 mb-4">
            <span className="text-xl font-bold text-automotive-red">
              ¥{item.product.effective_price.toFixed(2)}
            </span>
            {item.product.price > item.product.effective_price && (
              <span className="text-sm text-charcoal-400 line-through">
                ¥{item.product.price.toFixed(2)}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center border border-neutral-border rounded-lg overflow-hidden">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-3 py-2 hover:bg-charcoal-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
              <span className="px-4 text-center text-charcoal-900">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(item.product.max_quantity, q + 1))}
                className="px-3 py-2 hover:bg-charcoal-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="6" y1="12" x2="18" y2="12" />
                </svg>
              </button>
            </div>

            <button
              onClick={handleUpdate}
              className="px-3 py-2 text-sm text-charcoal-600 hover:text-charcoal-800"
            >
              Update
            </button>
            <button
              onClick={() => onRemove(item.product.id)}
              className="px-3 py-2 text-sm text-charcoal-600 hover:text-charcoal-800"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};