import type {
  Product,
  ProductDetail,
  Category,
  Brand,
  VehicleMake,
  VehicleModel,
  VehicleVariant,
  CartItem,
  CartSummary,
  User,
  Order,
  Coupon,
  DashboardStats,
  ApiError,
} from '../types';

const API_BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
    ...options,
  });

  const data = await response.json() as T | ApiError;

  if (!response.ok) {
    const error = data as ApiError;
    throw new Error(error.message || response.statusText);
  }

  return data as T;
}

export const api = {
  // Products
  getProducts: (params?: Record<string, string>) =>
    request<{ products: Product[] }>(params ? `/products?${new URLSearchParams(params).toString()}` : '/products')
      .then(res => res.products),

  getProduct: (slug: string) =>
    request<ProductDetail>(`/products/${slug}`),

  getFeaturedProducts: () =>
    request<{ products: Product[] }>('/products/featured').then(res => res.products),

  getNewArrivals: () =>
    request<{ products: Product[] }>('/products/new-arrivals').then(res => res.products),

  getCategories: () =>
    request<{ categories: Category[] }>('/products/categories').then(res => res.categories),

  getBrands: () =>
    request<{ brands: Brand[] }>('/products/brands').then(res => res.brands),

  searchSuggestions: (query: string) =>
    request<string[]>(`/products/search/suggestions?q=${encodeURIComponent(query)}`),

  getRelatedProducts: (slug: string) =>
    request<{ products: Product[] }>(`/products/${slug}/related`).then(res => res.products),

  // Vehicle
  getVehicleMakes: () =>
    request<{ makes: VehicleMake[] }>('/products/vehicles/makes'),

  getVehicleModels: (makeSlug: string) =>
    request<{ models: VehicleModel[] }>(`/products/vehicles/models?make=${makeSlug}`),

  getVehicleVariants: (modelSlug: string) =>
    request<{ variants: VehicleVariant[] }>(`/products/vehicles/variants?model=${modelSlug}`),

  getCompatibleProducts: (variantId: number) =>
    request<{ products: Product[] }>(`/products/vehicles/compatible-products?variant_id=${variantId}`).then(res => res.products),

  // Cart
  getCart: () =>
    request<{ items: CartItem[]; summary: CartSummary }>('/cart'),

  addToCart: (productId: number, quantity: number = 1) =>
    request<{ success: boolean; message: string; summary: CartSummary }>(`/cart`, {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, quantity }),
    }),

  updateCartItem: (productId: number, quantity: number) =>
    request<{ success: boolean; message: string; summary: CartSummary }>(`/cart/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    }),

  removeFromCart: (productId: number) =>
    request<{ success: boolean; message: string; summary: CartSummary }>(`/cart/${productId}`, {
      method: 'DELETE',
    }),

  clearCart: () =>
    request<{ success: boolean; message: string }>('/cart', { method: 'DELETE' }),

  getCartCount: () =>
    request<{ count: number }>('/cart/count'),

  mergeCart: (sessionId: string) =>
    request<{ success: boolean; message: string }>('/cart/merge', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    }),

  // Auth
  register: (data: { email: string; password: string; first_name: string; last_name: string; phone?: string }) =>
    request<{ success: boolean; message: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request<{ success: boolean; message: string; user: User; mfa_required?: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getMFAStatus: () =>
    request<{ success: boolean; mfa_enabled: boolean; mfa_pending: boolean }>('/auth/mfa/status'),
  setupMFA: () =>
    request<{ success: boolean; already_enabled: boolean; secret?: string; qr_code_uri?: string }>('/auth/mfa/setup'),
  verifyMFA: (code: string) =>
    request<{ success: boolean; message: string }>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  disableMFA: (code: string) =>
    request<{ success: boolean; message: string }>('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  challengeMFA: (data: { email: string; password: string; code: string }) =>
    request<{ success: boolean; message: string; user: User; mfa_required?: boolean }>('/auth/mfa/challenge', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () =>
    request<{ success: boolean; message: string }>('/auth/logout', {
      method: 'POST',
    }),

  getCurrentUser: () =>
    request<{ user: User }>('/auth/me'),

  updateProfile: (data: { first_name?: string; last_name?: string; phone?: string }) =>
    request<{ success: boolean; message: string; user: User }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  changePassword: (data: { current_password: string; new_password: string }) =>
    request<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Orders
  checkout: (data: {
    email: string;
    phone: string;
    shipping_address: any;
    billing_address?: any;
    payment_method: string;
    coupon_code?: string;
    notes?: string;
    idempotency_key?: string;
  }) =>
    request<{ success: boolean; message: string; order: Order }>('/orders/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getOrders: (page: number = 1, status?: string) =>
    request<{ orders: Order[]; pagination: any }>(`/orders?page=${page}${status ? `&status=${status}` : ''}`),

  getOrder: (orderNumber: string) =>
    request<{ order: Order }>(`/orders/${orderNumber}`),

  trackOrder: (orderNumber: string, email?: string, phone?: string) =>
    request<any>(`/orders/track/${orderNumber}?${new URLSearchParams({ email: email || '', phone: phone || '' }).toString()}`),

  cancelOrder: (orderNumber: string, reason: string) =>
    request<{ success: boolean; message: string }>(`/orders/${orderNumber}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // Admin
  getDashboard: () =>
    request<{ stats: DashboardStats; recent_orders: any[]; top_products: any[] }>('/admin/dashboard'),

  getAdminProducts: (params?: Record<string, string>) =>
    request<any>('/admin/products?' + new URLSearchParams(params || {}).toString()),

  getAdminProduct: (id: number) =>
    request<any>(`/admin/products/${id}`),

  createProduct: (data: any) =>
    request<any>('/admin/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProduct: (id: number, data: any) =>
    request<any>(`/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteProduct: (id: number) =>
    request<any>(`/admin/products/${id}`, {
      method: 'DELETE',
    }),

  getAdminOrders: (params?: Record<string, string>) =>
    request<any>('/admin/orders?' + new URLSearchParams(params || {}).toString()),

  getAdminOrder: (id: number) =>
    request<any>(`/admin/orders/${id}`),

  updateOrderStatus: (id: number, data: { status: string; notes?: string }) =>
    request<any>(`/admin/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getAdminCustomers: (params?: Record<string, string>) =>
    request<any>('/admin/customers?' + new URLSearchParams(params || {}).toString()),

  getAdminCategories: () =>
    request<any>('/admin/categories'),

  createCategory: (data: { name: string; slug?: string; description?: string; parent_id?: number; sort_order?: number }) =>
    request<any>('/admin/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAdminBrands: () =>
    request<any>('/admin/brands'),

  createBrand: (data: { name: string; slug?: string; description?: string; website_url?: string }) =>
    request<any>('/admin/brands', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAdminCoupons: () =>
    request<any>('/admin/coupons'),

  createCoupon: (data: any) =>
    request<any>('/admin/coupons', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSalesReport: (period: string = 'month') =>
    request<any>(`/admin/reports/sales?period=${period}`),

  getInventoryReport: () =>
    request<any>('/admin/reports/inventory'),
};