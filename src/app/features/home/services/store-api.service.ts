import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AdminOrder,
  AuthLoginRequest,
  AuthLoginResponse,
  AuthSessionResponse,
  CreateProductResponse,
  DeleteProductResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  Product,
  ProductFilters,
  ProductListResponse,
  RegisterUserRequest,
  RegisterUserResponse,
  SaveCardRequest,
  SaveCardResponse,
  SavedPaymentCard,
  UpdateCardResponse,
  UserOrder,
} from '../models/store.models';

@Injectable({
  providedIn: 'root',
})
export class StoreApiService {
  private readonly baseUrl = '/api';

  constructor(private readonly http: HttpClient) {}

  getProducts(filters: ProductFilters): Observable<ProductListResponse> {
    let params = new HttpParams();

    if (filters.search) {
      params = params.set('search', filters.search);
    }

    if (filters.brand) {
      params = params.set('brand', filters.brand);
    }

    if (filters.sort) {
      params = params.set('sort', filters.sort);
    }

    if (filters.minPrice !== undefined && filters.minPrice !== null) {
      params = params.set('minPrice', String(filters.minPrice));
    }

    if (filters.maxPrice !== undefined && filters.maxPrice !== null) {
      params = params.set('maxPrice', String(filters.maxPrice));
    }

    if (filters.inStock) {
      params = params.set('inStock', 'true');
    }

    return this.http.get<ProductListResponse>(`${this.baseUrl}/products`, { params });
  }

  getBrands(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/brands`);
  }

  getProductById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/products/${id}`);
  }

  createOrder(payload: CreateOrderRequest, token: string): Observable<CreateOrderResponse> {
    return this.http.post<CreateOrderResponse>(`${this.baseUrl}/orders`, payload, {
      headers: this.createAuthHeaders(token),
    });
  }

  login(payload: AuthLoginRequest): Observable<AuthLoginResponse> {
    return this.http.post<AuthLoginResponse>(`${this.baseUrl}/auth/login`, payload);
  }

  register(payload: RegisterUserRequest): Observable<RegisterUserResponse> {
    return this.http.post<RegisterUserResponse>(`${this.baseUrl}/auth/register`, payload);
  }

  createProduct(formData: FormData, token: string): Observable<CreateProductResponse> {
    return this.http.post<CreateProductResponse>(`${this.baseUrl}/admin/products`, formData, {
      headers: this.createAuthHeaders(token),
    });
  }

  updateProduct(
    productId: string,
    formData: FormData,
    token: string
  ): Observable<CreateProductResponse> {
    return this.http.put<CreateProductResponse>(
      `${this.baseUrl}/admin/products/${productId}`,
      formData,
      {
        headers: this.createAuthHeaders(token),
      }
    );
  }

  deleteProduct(productId: string, token: string): Observable<DeleteProductResponse> {
    return this.http.delete<DeleteProductResponse>(`${this.baseUrl}/admin/products/${productId}`, {
      headers: this.createAuthHeaders(token),
    });
  }

  getAdminProducts(token: string): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.baseUrl}/admin/products`, {
      headers: this.createAuthHeaders(token),
    });
  }

  getAdminOrders(token: string): Observable<AdminOrder[]> {
    return this.http.get<AdminOrder[]>(`${this.baseUrl}/admin/orders`, {
      headers: this.createAuthHeaders(token),
    });
  }

  getUserOrders(token: string): Observable<UserOrder[]> {
    return this.http.get<UserOrder[]>(`${this.baseUrl}/user/orders`, {
      headers: this.createAuthHeaders(token),
    });
  }

  getSavedCards(token: string): Observable<SavedPaymentCard[]> {
    return this.http.get<SavedPaymentCard[]>(`${this.baseUrl}/user/cards`, {
      headers: this.createAuthHeaders(token),
    });
  }

  savePaymentCard(payload: SaveCardRequest, token: string): Observable<SaveCardResponse> {
    return this.http.post<SaveCardResponse>(`${this.baseUrl}/user/cards`, payload, {
      headers: this.createAuthHeaders(token),
    });
  }

  deletePaymentCard(cardId: string, token: string): Observable<{ message: string; cardId: string }> {
    return this.http.delete<{ message: string; cardId: string }>(`${this.baseUrl}/user/cards/${cardId}`, {
      headers: this.createAuthHeaders(token),
    });
  }

  updatePaymentCard(
    cardId: string,
    payload: SaveCardRequest,
    token: string
  ): Observable<UpdateCardResponse> {
    return this.http.put<UpdateCardResponse>(`${this.baseUrl}/user/cards/${cardId}`, payload, {
      headers: this.createAuthHeaders(token),
    });
  }

  updateOrderStatus(
    orderId: string,
    status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'returned',
    token: string
  ): Observable<{ message: string; order: AdminOrder }> {
    return this.http.put<{ message: string; order: AdminOrder }>(
      `${this.baseUrl}/admin/orders/${orderId}/status`,
      { status },
      {
        headers: this.createAuthHeaders(token),
      }
    );
  }

  verifySession(token: string): Observable<AuthSessionResponse> {
    return this.http.get<AuthSessionResponse>(`${this.baseUrl}/auth/session`, {
      headers: this.createAuthHeaders(token),
    });
  }

  private createAuthHeaders(token: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }
}
