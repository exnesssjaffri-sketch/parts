export interface Product {
  id: number;
  sku: string;
  name: string;
  slug: string;
  short_description?: string;
  description?: string;
  price: number;
  sale_price: number | null;
  effective_price: number;
  price_formatted: string;
  sale_price_formatted: string | null;
  effective_price_formatted: string;
  stock_quantity: number;
  in_stock: boolean;
  max_quantity: number;
  category_slug: string;
  brand_name: string | null;
  primary_image: string | null;
  weight_grams: number | null;
  discount_percent: number;
  condition: string;
  warranty_months: number | null;
  is_featured: boolean;
}

export interface ProductDetail extends Product {
  images: Image[];
  specifications: Specification[];
  compatibility: Compatibility[];
  related_products: Product[];
}

export interface Image {
  id: number;
  url: string;
  alt_text: string;
  sort_order: number;
  is_primary: boolean;
}

export interface Specification {
  id: number;
  spec_key: string;
  spec_value: string;
  sort_order: number;
}

export interface Compatibility {
  id: number;
  variant_id: number;
  notes: string | null;
  year: number;
  engine: string | null;
  model_name: string;
  make_name: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  image_url?: string | null;
  product_count: number;
  sort_order: number;
}

export interface Brand {
  id: number;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string | null;
  product_count: number;
}

export interface VehicleMake {
  id: number;
  name: string;
  slug: string;
  logo_url?: string | null;
}

export interface VehicleModel {
  id: number;
  make_id: number;
  name: string;
  slug: string;
  description?: string;
  make_name: string;
  make_slug: string;
}

export interface VehicleVariant {
  id: number;
  model_id: number;
  year: number;
  engine: string | null;
  transmission: string | null;
  fuel_type: string | null;
  body_type: string | null;
  model_name: string;
  model_slug: string;
  make_name: string;
  make_slug: string;
}

export interface CartItem {
  id: number;
  quantity: number;
  product: Product;
  line_total: number;
  line_total_formatted: string;
}

export interface CartSummary {
  item_count: number;
  subtotal: number;
  subtotal_formatted: string;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_admin: boolean;
  email_verified: boolean;
  mfa_enabled?: boolean;
  created_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  subtotal: number;
  delivery_charge: number;
  discount_amount: number;
  total_amount: number;
  subtotal_formatted: string;
  delivery_charge_formatted: string;
  discount_formatted: string;
  total_formatted: string;
  currency: string;
  shipping_address: Address;
  billing_address: Address;
  notes: string | null;
  items: OrderItem[];
  status_history: StatusHistory[];
  created_at: string;
  created_at_formatted: string;
  confirmed_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
}

export interface OrderItem {
  id: number;
  product_id: number;
  product_sku: string;
  product_slug?: string | null;
  product_name: string;
  unit_price: number;
  unit_price_formatted: string;
  quantity: number;
  line_total: number;
  line_total_formatted: string;
}

export interface Address {
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface StatusHistory {
  status: string;
  status_label?: string;
  notes: string | null;
  changed_by: string;
  created_at: string;
  created_at_formatted: string;
}

export interface Coupon {
  id: number;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  usage_limit: number | null;
  user_limit: number;
  expires_at: string | null;
  is_active: number;
  usage_count: number;
}

export interface DashboardStats {
  total_orders: number;
  total_revenue: number;
  total_revenue_formatted: string;
  total_products: number;
  low_stock_products: number;
  out_of_stock_products: number;
  pending_orders: number;
  total_customers: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, string[]>;
  product_id?: number;
  available?: number;
}