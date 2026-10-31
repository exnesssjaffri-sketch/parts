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
    request<Product[]>('/products', {
      signal: params ? undefined : undefined,
    }).then(products => products),

  getProduct: (slug: string) =>
    request<ProductDetail>(`/products/${slug}`),

  getFeaturedProducts: () =>
    request<Product[]>('/products/featured'),

  getNewArrivals: () =>
    request<Product[]>('/products/new-arrivals'),

  getCategories: () =>
    request<Category[]>('/products/categories'),

  getBrands: () =>
    request<Brand[]>('/products/brands'),

  searchSuggestions: (query: string) =>
    request<string[]>(`/products/search/suggestions?q=${encodeURIComponent(query)}`),

  getRelatedProducts: (slug: string) =>
    request<Product[]>(`/products/${slug}/related`),

  // Vehicle
  getVehicleMakes: () =>
    request<{ makes: VehicleMake[] }>('/products/vehicles/makes'),

  getVehicleModels: (makeId: number) =>
    request<{ models: VehicleModel[] }>(`/products/vehicles/make/${makeId}/models`),

  getVehicleVariants: (modelId: number) =>
    request<{ variants: VehicleVariant[] }>(`/products/vehicles/model/${modelId}/variants`),

  getCompatibleProducts: (variantId: number) =>
    request<Product[]>(`/products/vehicles/compatible-products?variant_id=${variantId}`),

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
  challengeMFA: (data: { email: string; password: string; code: string; challenge_token?: string }) =>
    request<{ success: boolean; message: string; user: User; mfa_required?: boolean }>('/auth/mfa/challenge', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  challengeOAuthMFA: (data: { code: string; challenge_token: string }) =>
    request<{ success: boolean; message: string; user: User }>('/auth/mfa/oauth-challenge', {
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