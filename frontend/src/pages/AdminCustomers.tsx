import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Trash2, Edit, Calendar } from 'lucide-react';

export const AdminCustomers: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
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

    const loadCustomers = async () => {
      setLoading(true);
      try {
        const res = await api.getAdminCustomers(filters);
        setCustomers(res.items || []);
        setPagination(res.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        });
      } catch (err: any) {
        setError(err.message || 'Failed to load customers');
      } finally {
        setLoading(false);
      }
    };

    loadCustomers();
  }, [user, filters]);

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        // API might not have delete customer - just soft delete or disable
        setCustomers(customers.filter((c) => c.id !== id));
      } catch (err: any) {
        setError(err.message || 'Failed to delete customer');
      }
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, search: e.target.value, page: 1 });
  };

  const handlePageChange = (page: number) => {
    setFilters({ ...filters, page });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-charcoal-900 mb-8">Admin Customers</h1>
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
          <h1 className="text-3xl font-bold text-charcoal-900">Admin Customers</h1>
          <Link
            to="/admin/customers/create"
            className="inline-flex items-center px-6 py-3 btn-primary text-sm font-medium"
          >
            <Users className="h-4 w-4 mr-2" /> Add New Customer
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
              placeholder="Search customers..."
              className="flex-1 px-3 py-2 border border-neutral-border rounded-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
            />
            <button
              onClick={() => setFilters({ ...filters, search: '', page: 1 })}
              className="px-3 py-2 btn-outline hover:bg-charcoal-50 text-sm"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-border">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-border">
              <thead className="bg-charcoal-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Orders</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Total Spent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-border">
                {customers.length > 0 ? (
                  customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-charcoal-50">
                      <td className="px-6 py-4 whitespace-nowrap flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full bg-charcoal-100 flex items-center justify-center">
                          <span className="text-charcoal-500 text-xl font-bold">
                            {(customer.first_name || 'C')[0]}{(customer.last_name || 'U')[0]}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-charcoal-900">
                            {customer.first_name} {customer.last_name}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal-900">{customer.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal-900">{customer.phone || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal-900">{customer.orders_count || 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal-900">¥{(customer.total_spent || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal-900">{customer.created_at_formatted}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          to={`/admin/customers/${customer.id}`}
                          className="text-sm text-charcoal-600 hover:text-automotive-red mr-2"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(customer.id)}
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
                      No customers found
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
            {customers.length} of {pagination.total} customers
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