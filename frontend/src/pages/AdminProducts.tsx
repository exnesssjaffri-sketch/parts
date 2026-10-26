import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit, CheckCircle, XCircle } from 'lucide-react';

export const AdminProducts: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    category: '',
    brand: '',
    condition: '',
    in_stock: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1,
    has_next: false,
    has_prev: false,
  });

  useEffect(() => {
    if (!user?.is_admin) {
      window.location.href = '/';
      return;
    }

    const loadProducts = async () => {
      setLoading(true);
      try {
        const res = await api.getAdminProducts(filters);
        setProducts(res.items || []);
        setPagination(res.pagination || {
          page: 1,
          limit: 20,
          total: 0,
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

    loadProducts();
  }, [user, filters]);

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await api.deleteProduct(id);
        setProducts(products.filter((p) => p.id !== id));
      } catch (err: any) {
        setError(err.message || 'Failed to delete product');
      }
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, search: e.target.value, page: 1 });
  };

  const handleFilterChange = (name: string, value: string) => {
    setFilters({ ...filters, [name]: value, page: 1 });
  };

  const handlePageChange = (page: number) => {
    setFilters({ ...filters, page });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-charcoal-900 mb-8">Admin Products</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-neutral-border p-6 animate-pulse">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 rounded-full bg-charcoal-100 flex items-center justify-center">
                    <svg className="h-6 w-6 text-charcoal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  </div>
                  <h3 className="h-6 w-32 bg-charcoal-100 rounded mb-2" />
                  <p className="h-4 w-20 bg-charcoal-100 rounded mb-2" />
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
          <h1 className="text-3xl font-bold text-charcoal-900 mb-8">Error</h1>
          <p className="text-charcoal-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-charcoal-900">Admin Products</h1>
          <Link
            to="/admin/products/create"
            className="inline-flex items-center px-6 py-3 btn-primary text-sm font-medium"
          >
            <Plus className="h-4 w-4 mr-2" /> Add New Product
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={handleSearch}
                placeholder="Search products..."
                className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1">Category</label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
              >
                <option value="">All Categories</option>
                {/* Categories would be loaded from API */}
                <option value="engine">Engine</option>
                <option value="brake">Brake</option>
                <option value="suspension">Suspension</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1">Brand</label>
              <select
                value={filters.brand}
                onChange={(e) => handleFilterChange('brand', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
              >
                <option value="">All Brands</option>
                {/* Brands would be loaded from API */}
                <option value="bosch">Bosch</option>
                <option value="denso">Denso</option>
                <option value="mahle">Mahle</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1">Stock Status</label>
              <select
                value={filters.in_stock}
                onChange={(e) => handleFilterChange('in_stock', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
              >
                <option value="">All</option>
                <option value="in_stock">In Stock</option>
                <option value="out_of_stock">Out of Stock</option>
                <option value="low_stock">Low Stock</option>
              </select>
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-border">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-border">
              <thead className="bg-charcoal-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Brand</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-border">
                {products.length > 0 ? (
                  products.map((product) => (
                    <tr key={product.id} className="hover:bg-charcoal-50">
                      <td className="px-6 py-4 whitespace-nowrap flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full bg-charcoal-100 flex items-center justify-center">
                          <img
                            src={product.primary_image || ''}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-charcoal-900">{product.name}</p>
                          <p className="text-xs text-charcoal-500">Product {product.id}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal-900">{product.sku}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal-900">{product.category_slug}</td>
                      <td className="px-6 py-4 whitespace-nowraw text-sm text-charcoal-900">{product.brand_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal-900">¥{product.effective_price.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          product.stock_quantity > 0
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {product.in_stock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          to={`/admin/products/${product.id}/edit`}
                          className="text-sm text-charcoal-600 hover:text-automotive-red mr-2"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-sm text-charcoal-600 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-6 py-12 text-center text-charcoal-500" colSpan="7">
                      No products found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-between pt-6 border-t border-neutral-border">
          <div className="text-sm text-charcoal-500">
            {products.length} of {pagination.total} products
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!pagination.has_prev}
              className="px-3 py-2 border border-neutral-border rounded-lg hover:bg-charcoal-50 transition-colors disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.has_next}
              className="px-3 py-2 bg-automotive-red text-white rounded-lg hover:bg-automotive-red-dark transition-colors disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};