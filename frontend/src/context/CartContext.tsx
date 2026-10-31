import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CartItem, CartSummary } from '../types';
import { api } from '../utils/api';

interface CartContextType {
  items: CartItem[];
  summary: CartSummary;
  loading: boolean;
  addToCart: (productId: number, quantity?: number) => Promise<void>;
  updateQuantity: (productId: number, quantity: number) => Promise<void>;
  removeItem: (productId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [summary, setSummary] = useState<CartSummary>({ item_count: 0, subtotal: 0, subtotal_formatted: 'Rs. 0' });
  const [loading, setLoading] = useState<boolean>(true);

  const refreshCart = useCallback(async () => {
    try {
      const data = await api.getCart();
      setItems(data.items);
      setSummary(data.summary);
    } catch {
      setItems([]);
      setSummary({ item_count: 0, subtotal: 0, subtotal_formatted: 'Rs. 0' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = async (productId: number, quantity: number = 1) => {
    const res = await api.addToCart(productId, quantity);
    setSummary(res.summary);
    await refreshCart();
  };

  const updateQuantity = async (productId: number, quantity: number) => {
    if (quantity <= 0) {
      await removeItem(productId);
      return;
    }
    const res = await api.updateCartItem(productId, quantity);
    setSummary(res.summary);
    await refreshCart();
  };

  const removeItem = async (productId: number) => {
    const res = await api.removeFromCart(productId);
    setSummary(res.summary);
    await refreshCart();
  };

  const clearCart = async () => {
    await api.clearCart();
    setItems([]);
    setSummary({ item_count: 0, subtotal: 0, subtotal_formatted: 'Rs. 0' });
  };

  return (
    <CartContext.Provider value={{ items, summary, loading, addToCart, updateQuantity, removeItem, clearCart, refreshCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
