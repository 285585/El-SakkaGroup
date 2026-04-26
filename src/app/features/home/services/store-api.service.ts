import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreateProductResponse,
  DeleteProductResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  OwnerLoginRequest,
  OwnerLoginResponse,
  Product,
  ProductFilters,
  ProductListResponse,
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

    return this.http.get<ProductListResponse>(`${this.baseUrl}/products`, { params });
  }

  getBrands(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/brands`);
  }

  getProductById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/products/${id}`);
  }

  createOrder(payload: CreateOrderRequest): Observable<CreateOrderResponse> {
    return this.http.post<CreateOrderResponse>(`${this.baseUrl}/orders`, payload);
  }

  ownerLogin(payload: OwnerLoginRequest): Observable<OwnerLoginResponse> {
    return this.http.post<OwnerLoginResponse>(`${this.baseUrl}/auth/login`, payload);
  }

  createProduct(formData: FormData, token: string): Observable<CreateProductResponse> {
    return this.http.post<CreateProductResponse>(`${this.baseUrl}/admin/products`, formData, {
      headers: this.createOwnerHeaders(token),
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
        headers: this.createOwnerHeaders(token),
      }
    );
  }

  deleteProduct(productId: string, token: string): Observable<DeleteProductResponse> {
    return this.http.delete<DeleteProductResponse>(`${this.baseUrl}/admin/products/${productId}`, {
      headers: this.createOwnerHeaders(token),
    });
  }

  getAdminProducts(token: string): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.baseUrl}/admin/products`, {
      headers: this.createOwnerHeaders(token),
    });
  }

  verifyOwnerSession(token: string): Observable<{ owner: { username: string } }> {
    return this.http.get<{ owner: { username: string } }>(`${this.baseUrl}/auth/session`, {
      headers: this.createOwnerHeaders(token),
    });
  }

  private createOwnerHeaders(token: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }
}
