import React from 'react';
import { Product } from '../types';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { Image } from 'lucide-react';
import { Star } from 'lucide-react';
import { Share2 } from 'lucide-react';
import { ShoppingCart } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, className = '' }) => {
  const { addToCart } = useCart();
  const discountPercent = product.discount_percent > 0 ? product.discount_percent : 0;
  const price = product.effective_price;
  const compareAtPrice = product.price > price ? product.price : null;

  const handleAddToCart = () => {
    addToCart(product.id, 1);
  };

  return (
    <Link
      to={`/products/${product.slug}`}
      className={`block hover:shadow-md transition-shadow duration-200 ${className}`}
    >
      <div className="relative group">
        {/* Image */}
        <div className="aspect-w-4 aspect-h-3 w-full bg-neutral-100 rounded-t-lg overflow-hidden">
          {product.primary_image ? (
            <img
              src={product.primary_image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-charcoal-100 text-charcoal-400">
              No Image
            </div>
          )}
          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col space-y-2">
            {product.is_featured && (
              <span className="badge badge-primary px-2 py-0.5 text-xs">Featured</span>
            )}
            {discountPercent > 0 && (
              <span className="badge badge-danger px-2 py-0.5 text-xs">-{discountPercent}%</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-lg font-medium text-charcoal-900 line-clamp-2">
            {product.name}
          </h3>
          <p className="text-sm text-charcoal-600 line-clamp-2 mt-1">
            {product.short_description || ''}
          </p>

          {/* Price */}
          <div className="mt-3 flex items-baseline space-x-3">
            <span className="text-xl font-bold text-automotive-red">
              ¥{price.toFixed(2)}
            </span>
            {compareAtPrice && (
              <span className="text-sm text-charcoal-400 line-through">
                ¥{compareAtPrice.toFixed(2)}
              </span>
            )}
          </div>

          {/* Stock & Rating */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-charcoal-500">
            <span>
              {product.in_stock ? 'In Stock' : 'Out of Stock'}
            </span>
            {product.stock_quantity > 0 && (
              <span className="border border-neutral-border rounded px-1 py-0">
                {product.stock_quantity} left
              </span>
            )}
            <div className="flex items-center space-x-1">
              <Star className="h-4 w-4 text-yellow-400" />
              <span>4.5</span>
            </div>
          </div>

          {/* Add to Cart */}
          <button
            onClick={handleAddToCart}
            className="w-full mt-4 btn-primary text-sm font-medium"
            disabled={!product.in_stock}
          >
            {product.in_stock ? 'Add to Cart' : 'Out of Stock'}
          </button>
        </div>
      </div>
    </Link>
  );
};