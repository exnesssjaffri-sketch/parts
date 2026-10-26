import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { ProductCard } from '../components/ProductCard';
import { Product, Category, Brand } from '../types';

export const Products: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  }>({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1,
    has_next: false,
    has_prev: false,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const query = {
    page: searchParams.get('page') || '1',
    limit: '20',
    category: searchParams.get('category') || '',
    brand: searchParams.get('brand') || '',
    search: searchParams.get('search') || '',
    min_price: searchParams.get('min_price') || '',
    max_price: searchParams.get('max_price') || '',
    condition: searchParams.get('condition') || '',
    sort: searchParams.get('sort') || 'newest',
  };

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      try {
        const params = Object.entries(query)
          .filter(([_, v]) => v !== '')
          .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

        const res = await api.getProducts(params);
        setProducts(res);
        setPagination({
          page: Number(query.page),
          limit: Number(query.limit),
          total: res.length, // This would come from a paginated response in a real API
          total_pages: 1,
          has_next: false,
          has_prev: false,
        });
      } catch (err: any) {
        setError(err.message || 'Failed to load products');
      } finally {
        setLoading(false);
      }
    };

    const loadMetadata = async () => {
      try {
        const [catsRes, brandsRes] = await Promise.all([
          api.getCategories(),
          api.getBrands(),
        ]);
        setCategories(catsRes);
        setBrands(brandsRes);
      } catch (err) {
        console.error('Failed to load filters:', err);
      }
    };

    loadProducts();
    loadMetadata();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-charcoal-900 mb-8">Products</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(12)].map((_, i) => (
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
        <div className="flex flex-col md:flex-row md:items-start md:justify-between md:mb-8">
          <h1 className="text-3xl font-bold text-charcoal-900 mb-4 md:mb-0">Products</h1>
          <div className="flex items-center space-x-4 md:ml-auto">
            <select
              value={query.sort}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams);
                params.set('sort', e.target.value);
                params.set('page', '1');
                window.history.pushState({}, '', `?${params.toString()}`);
                window.location.reload();
              }}
              className="px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
            >
              <option value="newest">Newest</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="name">Name: A-Z</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        <Filters categories={categories} brands={brands} query={query} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} className="card" />
          ))}
        </div>

        <Pagination pagination={pagination} query={query} />
      </div>
    </div>
  );
};

const Filters: React.FC<{
  categories: Category[];
  brands: Brand[];
  query: Record<string, string>;
}> = ({ categories, brands, query }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-6 mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-2">Category</label>
          <select
            value={query.category}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams);
              params.set('category', e.target.value);
              params.set('page', '1');
              window.history.pushState({}, '', `?${params.toString()}`);
              window.location.reload();
            }}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-2">Brand</label>
          <select
            value={query.brand}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams);
              params.set('brand', e.target.value);
              params.set('page', '1');
              window.history.pushState({}, '', `?${params.toString()}`);
              window.location.reload();
            }}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          >
            <option value="">All Brands</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.slug}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-2">Price Range</label>
          <div className="flex space-x-2">
            <input
              type="number"
              value={query.min_price}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams);
                params.set('min_price', e.target.value);
                window.history.pushState({}, '', `?${params.toString()}`);
                window.location.reload();
              }}
              placeholder="Min"
              className="flex-1 px-3 py-2 border border-neutral-border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
            />
            <input
              type="number"
              value={query.max_price}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams);
                params.set('max_price', e.target.value);
                window.history.pushState({}, '', `?${params.toString()}`);
                window.location.reload();
              }}
              placeholder="Max"
              className="flex-1 px-3 py-2 border border-neutral-border rounded-r-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-2">Condition</label>
          <select
            value={query.condition}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams);
              params.set('condition', e.target.value);
              window.history.pushState({}, '', `?${params.toString()}`);
              window.location.reload();
            }}
            className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
          >
            <option value="">All Conditions</option>
            <option value="new">New</option>
            <option value="used">Used</option>
            <option value="remanufactured">Remanufactured</option>
          </select>
        </div>
      </div>
    </div>
  );
};

const Pagination: React.FC<{
  pagination: {
    page: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
  query: Record<string, string>;
}> = ({ pagination, query }) => {
  return (
    <div className="flex items-center justify-between pt-6 border-t border-neutral-border">
      <div className="text-sm text-charcoal-500">
        Page {pagination.page} of {pagination.total_pages}
      </div>
      <div className="flex space-x-2">
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams);
            params.set('page', String(pagination.page - 1));
            window.history.pushState({}, '', `?${params.toString()}`);
            window.location.reload();
          }}
          disabled={!pagination.has_prev}
          className="px-3 py-2 border border-neutral-border rounded-lg hover:bg-charcoal-50 transition-colors disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams);
            params.set('page', String(pagination.page + 1));
            window.history.pushState({}, '', `?${params.toString()}`);
            window.location.reload();
          }}
          disabled={!pagination.has_next}
          className="px-3 py-2 bg-automotive-red text-white rounded-lg hover:bg-automotive-red-dark transition-colors disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};