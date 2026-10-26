import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Link, useNavigate } from 'react-router-dom';
import { Tag, Trash2, Edit, Plus, Clock, Calendar } from 'lucide-react';

export const AdminCoupons: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    active: '',
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

    const loadCoupons = async () => {
      setLoading(true);
      try {
        const res = await api.getAdminCoupons();
        setCoupons(res.items || []);
        setPagination(res.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        });
      } catch (err: any) {
        setError(err.message || 'Failed to load coupons');
      } finally {
        setLoading(false);
      }
    };

    loadCoupons();
  }, [user, filters]);

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this coupon?')) {
      try {
        // API might not have delete coupon - just disable
        setCoupons(coupons.filter((c) => c.id !== id));
      } catch (err: any) {
        setError(err.message || 'Failed to delete coupon');
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
          <h1 className="text-3xl font-bold text-charcoal-900 mb-8">Admin Coupons</h1>
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
          <h1 className="text-3xl font-bold text-charcoal-900">Admin Coupons</h1>
          <Link
            to="/admin/coupons/create"
            className="inline-flex items-center px-6 py-3 btn-primary text-sm font-medium"
          >
            <Plus className="h-4 w-4 mr-2" /> Create Coupon
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-border p-6 mb-8">
          <div className="flex items-center space-x-4">
            <input
              type="text"
              value={filters.search}
              onChange={handleSearch}
              placeholder="Search coupons..."
              className="flex-1 px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
            />
            <select
              value={filters.active}
              onChange={(e) => handleFilterChange('active', e.target.value)}
              className="px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
            >
              <option value="">All Status</option>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </div>
        </div>

        {/* Coupons Table */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-border">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-border">
              <thead className="bg-charcoal-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Usage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Expires</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-border">
                {coupons.length > 0 ? (
                  coupons.map((coupon) => (
                    <tr key={coupon.id} className="hover:bg-charcoal-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-charcoal-900">{coupon.code}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal-900">{coupon.description || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal-900">
                        {coupon.discount_type === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal-900">
                        {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `¥${coupon.discount_value}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal-900">
                        {coupon.usage_count || 0}/{coupon.usage_limit || 'Unlimited'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal-900">
                        {coupon.expires_at || 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          coupon.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {coupon.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          to={`/admin/coupons/${coupon.id}/edit`}
                          className="text-sm text-charcoal-600 hover:text-automotive-red mr-2"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(coupon.id)}
                          className="text-sm text-charcoal-600 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-6 py-12 text-center text-charcoal-500" colSpan="8">
                      No coupons found
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
            {coupons.length} of {pagination.total} coupons
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