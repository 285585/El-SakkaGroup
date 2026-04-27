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
  /** متوسط تقييمات المستخدمين الذين اشتروا واستلموا المنتج */
  averageRating?: number;
  /** عدد التقييمات */
  ratingsCount?: number;
  /** يظهر فقط عند فتح تفاصيل المنتج مع تسجيل دخول العميل */
  canRate?: boolean;
  myRating?: number | null;
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
export type OwnerDecision = 'pending' | 'approved' | 'rejected';

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
  ownerDecision: OwnerDecision;
  ownerReply: string;
  ownerDecisionUpdatedAt?: string;
  /** تاريخ تسجيل البيع (يُضبط تلقائياً: يومان بعد موافقة المالك) */
  saleDate?: string | null;
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

export interface UserInboxMessage {
  id: string;
  kind: 'order' | 'sell_request' | 'system';
  subject: string;
  body: string;
  relatedId: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt?: string;
}

export interface UserInboxReadResponse {
  message: string;
  inboxMessage: UserInboxMessage;
}

export interface SellRequest {
  id: string;
  userId: string;
  username: string;
  email: string;
  phone: string;
  name: string;
  brand: string;
  cpu: string;
  ram: string;
  storage: string;
  gpu: string;
  condition: string;
  expectedPrice: number;
  description: string;
  images: string[];
  decision: OwnerDecision;
  ownerReply: string;
  ownerDecisionUpdatedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSellRequestResponse {
  message: string;
  sellRequest: SellRequest;
}

export interface UpdateSellRequestDecisionResponse {
  message: string;
  sellRequest: SellRequest;
}

export interface DeleteSellRequestResponse {
  message: string;
  sellRequestId: string;
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
  oldPrice?: number;
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

export interface RateProductResponse {
  message: string;
  myRating: number;
  averageRating: number;
  ratingsCount: number;
}

export interface OwnerCommunication {
  id: string;
  userId: string;
  targetUsername: string;
  kind: 'order' | 'sell_request' | 'system';
  subject: string;
  body: string;
  relatedId: string;
  userInboxMessageId: string;
  createdAt?: string;
}
