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
}

export interface ProductListResponse {
  total: number;
  products: Product[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CreateOrderRequest {
  customerName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface CreatedOrder {
  id: string;
  total: number;
  createdAt: string;
}

export interface CreateOrderResponse {
  message: string;
  order: CreatedOrder;
}

export interface OwnerLoginRequest {
  username: string;
  password: string;
}

export interface OwnerLoginResponse {
  token: string;
  owner: {
    username: string;
  };
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
