export interface ProductSpecs {
  cpu: string;
  ram: string;
  storage: string;
  display: string;
  gpu: string;
  warranty: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  oldPrice: number;
  rating: number;
  stock: number;
  isFeatured: boolean;
  shortDescription: string;
  image: string;
  images: string[];
  specs: ProductSpecs;
}

export interface ProductFilters {
  search?: string;
  brand?: string;
  sort?: 'featured' | 'priceAsc' | 'priceDesc' | 'rating';
  minPrice?: number | null;
  maxPrice?: number | null;
  inStock?: boolean;
}

export interface ProductListResponse {
  total: number;
  products: Product[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface UserCartResponse {
  items: CartItem[];
}

export interface UpdateUserCartRequest {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface ShippingAddress {
  city: string;
  area: string;
  addressLine1: string;
  addressLine2: string;
  buildingNo: string;
  floorNo: string;
  apartmentNo: string;
  landmark: string;
  postalCode: string;
  notes: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'returned';

export interface PaymentSnapshot {
  method: 'cash_on_delivery';
}

export interface CreateOrderRequest {
  customerName: string;
  email: string;
  phone: string;
  city: string;
  area: string;
  addressLine1: string;
  addressLine2: string;
  buildingNo: string;
  floorNo: string;
  apartmentNo: string;
  landmark: string;
  postalCode: string;
  notes: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface CreatedOrder {
  id: string;
  total: number;
  createdAt?: string;
}

export interface AdminOrder extends CreatedOrder {
  orderedByUsername: string;
  orderedByRole: 'owner' | 'customer';
  customerName: string;
  email: string;
  phone: string;
  shippingAddress: ShippingAddress;
  payment: PaymentSnapshot;
  status: OrderStatus;
  statusUpdatedAt?: string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  shippingCost: number;
}

export type UserOrder = AdminOrder;

export interface CreateOrderResponse {
  message: string;
  order: CreatedOrder;
}

export interface AuthLoginRequest {
  username: string;
  password: string;
}

export interface AuthUser {
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: 'owner' | 'customer';
}

export interface AuthLoginResponse {
  token: string;
  user: AuthUser;
}

export interface RegisterUserRequest {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  username: string;
  password: string;
}

export interface RegisterUserResponse {
  message: string;
  token: string;
  user: AuthUser;
}

export interface AuthSessionResponse {
  user: AuthUser;
}

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  username: string;
  createdAt: string;
}

export interface CreateProductRequest {
  name: string;
  brand: string;
  category: string;
  price: number;
  oldPrice: number;
  rating: number;
  stock: number;
  isFeatured: boolean;
  shortDescription: string;
  cpu: string;
  ram: string;
  storage: string;
  display: string;
  gpu: string;
  warranty: string;
}

export interface CreateProductResponse {
  message: string;
  product: Product;
}

export interface DeleteProductResponse {
  message: string;
  productId: string;
}
