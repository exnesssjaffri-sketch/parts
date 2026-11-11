import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { api } from '../utils/api';
import { ProductDetail as ProductDetailType, Product } from '../types';
import { ShoppingCart, X } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';

export const ProductDetail: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<ProductDetailType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'specs' | 'compatibility' | 'related'>('details');
  const [quantity, setQuantity] = useState<number>(1);

  useEffect(() => {
    if (slug) {
      const loadProduct = async () => {
        setLoading(true);
        try {
          const res = await api.getProduct(slug);
          setProduct(res);
        } catch (err: any) {
          setError(err.message || 'Product not found');
        } finally {
          setLoading(false);
        }
      };

      loadProduct();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-charcoal-900 mb-8">Loading product...</h1>
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
          <h1 className="text-3xl font-bold text-charcoal-900 mb-8">Product not found</h1>
          <p className="text-charcoal-600">{error}</p>
          <Link to="/" className="inline-flex items-center px-6 py-3 btn-primary text-sm font-medium mt-6">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return <div>Loading...</div>;
  }

  const handleAddToCart = async () => {
    await addToCart(product.id, quantity);
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Gallery */}
          <div className="md:w-1/2">
            <div className="relative">
              <img
                src={product.primary_image || ''}
                alt={product.name}
                className="w-full h-full object-cover rounded-lg shadow-lg"
              />
              {product.discount_percent > 0 && (
                <span className="absolute top-3 left-3 badge badge-danger px-2 py-0.5 text-xs">
                  -{product.discount_percent}%
                </span>
              )}
              {product.is_featured && (
                <span className="absolute top-10 left-3 badge badge-primary px-2 py-0.5 text-xs">
                  Featured
                </span>
              )}
            </div>

            {product.images.length > 1 && (
              <div className="mt-4 flex space-x-2">
                {product.images.map((img, index) => (
                  <img
                    key={img.id}
                    src={img.url}
                    alt={img.alt_text}
                    className={`w-16 h-16 object-cover rounded-lg border border-neutral-border ${
                      index === 0 ? 'border-automotive-red' : ''
                    } cursor-pointer`}
                    onClick={() => {
                      // In a real app, we'd have a lightbox or gallery component
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="md:w-1/2 space-y-6">
            <h1 className="text-2xl font-bold text-charcoal-900">{product.name}</h1>

            <div className="flex items-center space-x-4 mb-2">
              <span className="badge badge-primary px-2 py-0.5 text-xs">Featured</span>
              {product.condition && (
                <span className="badge badge-secondary px-2 py-0.5 text-xs">{product.condition}</span>
              )}
              {product.warranty_months && (
                <span className="badge badge-secondary px-2 py-0.5 text-xs">{product.warranty_months}-Month Warranty</span>
              )}
            </div>

            <p className="text-charcoal-600 mb-4">{product.short_description || ''}</p>

            {/* Price */}
            <div className="flex items-baseline space-x-4 mb-4">
              <span className="text-3xl font-bold text-automotive-red">
                ¥{product.effective_price.toFixed(2)}
              </span>
              {product.price > product.effective_price && (
                <span className="text-lg text-charcoal-400 line-through">
                  ¥{product.price.toFixed(2)}
                </span>
              )}
              <span className="text-sm text-charcoal-500">
                Save ¥{(product.price - product.effective_price).toFixed(2)} ({product.discount_percent}%)
              </span>
            </div>

            {/* Stock */}
            <div className="flex items-center space-x-4 mb-4">
              <span className="text-sm font-medium">
                {product.in_stock ? 'In Stock' : 'Out of Stock'}
              </span>
              {product.in_stock && (
                <span className="text-sm text-charcoal-500">
                  {product.stock_quantity} available
                </span>
              )}
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center space-x-4 mb-6">
              <label className="text-sm font-medium text-charcoal-700">Quantity</label>
              <div className="flex items-center border border-neutral-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-2 hover:bg-charcoal-50"
                >
                  <X className="h-4 w-4" />
                </button>
                <span className="px-4 text-center text-charcoal-900">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(product.max_quantity, q + 1))}
                  className="px-3 py-2 hover:bg-charcoal-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Add to Cart */}
            <button
              onClick={handleAddToCart}
              className="w-full btn-primary text-sm font-medium"
              disabled={!product.in_stock || quantity > product.max_quantity}
            >
              {product.in_stock ? 'Add to Cart' : 'Out of Stock'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8">
          <div className="flex border-b border-neutral-border mb-6">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-3 text-sm font-medium ${
                activeTab === 'details' ? 'border-b-2 border-automotive-red text-automotive-red' : 'text-charcoal-500 hover:text-charcoal-700'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('specs')}
              className={`px-4 py-3 text-sm font-medium ${
                activeTab === 'specs' ? 'border-b-2 border-automotive-red text-automotive-red' : 'text-charcoal-500 hover:text-charcoal-700'
              }`}
            >
              Specifications
            </button>
            <button
              onClick={() => setActiveTab('compatibility')}
              className={`px-4 py-3 text-sm font-medium ${
                activeTab === 'compatibility' ? 'border-b-2 border-automotive-red text-automotive-red' : 'text-charcoal-500 hover:text-charcoal-700'
              }`}
            >
              Compatibility
            </button>
            <button
              onClick={() => setActiveTab('related')}
              className={`px-4 py-3 text-sm font-medium ${
                activeTab === 'related' ? 'border-b-2 border-automotive-red text-automotive-red' : 'text-charcoal-500 hover:text-charcoal-700'
              }`}
            >
              Related Products
            </button>
          </div>

          {activeTab === 'details' && (
            <div className="text-charcoal-600 space-y-4">
              <p>{product.description || 'No detailed description available.'}</p>
            </div>
          )}

          {activeTab === 'specs' && (
            <div className="space-y-4">
              {product.specifications.map((spec) => (
                <div key={spec.id} className="flex justify-between py-2 border-b border-neutral-border last:border-b-0">
                  <span className="text-charcoal-600">{spec.spec_key}</span>
                  <span className="text-charcoal-900 font-medium">{spec.spec_value}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'compatibility' && (
            <div className="space-y-4">
              {product.compatibility.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-charcoal-900 mb-2">Compatible Vehicles</h3>
                  {product.compatibility.map((comp) => (
                    <div key={comp.id} className="p-3 bg-white rounded-lg border border-neutral-border">
                      <div className="flex items-center space-x-4">
                        <div className="flex-1">
                          <p className="text-charcoal-900 font-medium">
                            {comp.year} {comp.make_name} {comp.model_name}
                          </p>
                          {comp.engine && (
                            <p className="text-sm text-charcoal-500">
                              {comp.engine}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            // Could navigate to compatible products page
                          }}
                          className="text-sm text-automotive-red hover:text-automotive-red-dark"
                        >
                          View Parts
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-charcoal-500">No compatibility data available.</p>
              )}
            </div>
          )}

          {activeTab === 'related' && (
            <div>
              <h3 className="text-lg font-medium text-charcoal-900 mb-4">Related Products</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {product.related_products.map((related) => (
                  <ProductCard key={related.id} product={related} className="card" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
