import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AdminUser,
  AdminOrder,
  AuthLoginRequest,
  AuthLoginResponse,
  AuthSessionResponse,
  CreateSellRequestResponse,
  CreateProductResponse,
  DeleteProductResponse,
  DeleteSellRequestResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  Product,
  ProductFilters,
  ProductListResponse,
  RegisterUserRequest,
  RegisterUserResponse,
  SellRequest,
  UpdateSellRequestDecisionResponse,
  UpdateUserCartRequest,
  UserInboxMessage,
  UserInboxReadResponse,
  UserCartResponse,
  UserOrder,
  RateProductResponse,
  OwnerCommunication,
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

  getProductById(id: string, token?: string | null): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/products/${id}`, {
      headers: token ? this.createAuthHeaders(token) : undefined,
    });
  }

  rateProduct(productId: string, value: number, token: string): Observable<RateProductResponse> {
    return this.http.post<RateProductResponse>(
      `${this.baseUrl}/products/${productId}/rate`,
      { value },
      { headers: this.createAuthHeaders(token) }
    );
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

  getUserCart(token: string): Observable<UserCartResponse> {
    return this.http.get<UserCartResponse>(`${this.baseUrl}/user/cart`, {
      headers: this.createAuthHeaders(token),
    });
  }

  updateUserCart(payload: UpdateUserCartRequest, token: string): Observable<UserCartResponse> {
    return this.http.put<UserCartResponse>(`${this.baseUrl}/user/cart`, payload, {
      headers: this.createAuthHeaders(token),
    });
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

  getAdminUsers(token: string): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.baseUrl}/admin/users`, {
      headers: this.createAuthHeaders(token),
    });
  }

  deleteAdminUser(
    userId: string,
    token: string
  ): Observable<{ message: string; userId: string }> {
    return this.http.delete<{ message: string; userId: string }>(
      `${this.baseUrl}/admin/users/${userId}`,
      {
        headers: this.createAuthHeaders(token),
      }
    );
  }

  deleteOwnerCommunication(
    communicationId: string,
    token: string
  ): Observable<{ message: string; communicationId: string }> {
    return this.http.delete<{ message: string; communicationId: string }>(
      `${this.baseUrl}/admin/communications/${communicationId}`,
      {
        headers: this.createAuthHeaders(token),
      }
    );
  }

  getAdminCommunications(token: string): Observable<OwnerCommunication[]> {
    return this.http.get<OwnerCommunication[]>(`${this.baseUrl}/admin/communications`, {
      headers: this.createAuthHeaders(token),
    });
  }

  getUserOrders(token: string): Observable<UserOrder[]> {
    return this.http.get<UserOrder[]>(`${this.baseUrl}/user/orders`, {
      headers: this.createAuthHeaders(token),
    });
  }

  getUserInbox(token: string): Observable<UserInboxMessage[]> {
    return this.http.get<UserInboxMessage[]>(`${this.baseUrl}/user/inbox`, {
      headers: this.createAuthHeaders(token),
    });
  }

  markInboxAsRead(messageId: string, token: string): Observable<UserInboxReadResponse> {
    return this.http.put<UserInboxReadResponse>(
      `${this.baseUrl}/user/inbox/${messageId}/read`,
      {},
      {
        headers: this.createAuthHeaders(token),
      }
    );
  }

  createSellRequest(formData: FormData, token: string): Observable<CreateSellRequestResponse> {
    return this.http.post<CreateSellRequestResponse>(`${this.baseUrl}/user/sell-requests`, formData, {
      headers: this.createAuthHeaders(token),
    });
  }

  getUserSellRequests(token: string): Observable<SellRequest[]> {
    return this.http.get<SellRequest[]>(`${this.baseUrl}/user/sell-requests`, {
      headers: this.createAuthHeaders(token),
    });
  }

  getAdminSellRequests(token: string): Observable<SellRequest[]> {
    return this.http.get<SellRequest[]>(`${this.baseUrl}/admin/sell-requests`, {
      headers: this.createAuthHeaders(token),
    });
  }

  updateSellRequestDecision(
    requestId: string,
    decision: 'approved' | 'rejected',
    reply: string,
    token: string
  ): Observable<UpdateSellRequestDecisionResponse> {
    return this.http.put<UpdateSellRequestDecisionResponse>(
      `${this.baseUrl}/admin/sell-requests/${requestId}/decision`,
      { decision, reply },
      {
        headers: this.createAuthHeaders(token),
      }
    );
  }

  deleteSellRequest(
    requestId: string,
    reply: string,
    token: string
  ): Observable<DeleteSellRequestResponse> {
    return this.http.request<DeleteSellRequestResponse>(
      'delete',
      `${this.baseUrl}/admin/sell-requests/${requestId}`,
      {
        headers: this.createAuthHeaders(token),
        body: { reply },
      }
    );
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

  updateOrderDecision(
    orderId: string,
    decision: 'approved' | 'rejected',
    reply: string,
    token: string
  ): Observable<{ message: string; order: AdminOrder }> {
    return this.http.put<{ message: string; order: AdminOrder }>(
      `${this.baseUrl}/admin/orders/${orderId}/decision`,
      { decision, reply },
      {
        headers: this.createAuthHeaders(token),
      }
    );
  }

  deleteOrder(orderId: string, reply: string, token: string): Observable<{ message: string; orderId: string }> {
    return this.http.request<{ message: string; orderId: string }>(
      'delete',
      `${this.baseUrl}/admin/orders/${orderId}`,
      {
        headers: this.createAuthHeaders(token),
        body: { reply },
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
