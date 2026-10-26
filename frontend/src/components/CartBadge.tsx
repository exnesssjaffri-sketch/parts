import React from 'react';
import { useCart } from '../context/CartContext';
import { ShoppingCart } from 'lucide-react';

export const CartBadge: React.FC = () => {
  const { summary } = useCart();

  return (
    <div className="relative inline-block">
      <ShoppingCart className="h-5 w-5 text-charcoal-800" />
      {summary.item_count > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-automotive-red text-white text-xs font-medium">
          {summary.item_count}
        </span>
      )}
    </div>
  );
};
