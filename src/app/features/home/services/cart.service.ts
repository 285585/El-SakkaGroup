import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CartItem, Product } from '../models/store.models';
import { OwnerAuthService } from './owner-auth.service';
import { StoreApiService } from './store-api.service';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly guestStorageKey = 'el_sakka_cart_guest';
  private readonly cartSubject = new BehaviorSubject<CartItem[]>([]);
  private currentStorageKey = this.guestStorageKey;
  readonly cart$ = this.cartSubject.asObservable();

  constructor(
    private readonly ownerAuthService: OwnerAuthService,
    private readonly storeApiService: StoreApiService
  ) {
    this.loadCartForActiveSession();
    this.ownerAuthService.currentUser$.subscribe(() => {
      this.loadCartForActiveSession();
    });
  }

  getItems(): CartItem[] {
    return this.cartSubject.value;
  }

  addProduct(product: Product): void {
    if (!this.ownerAuthService.requireRegisteredUser()) {
      return;
    }
    const items = [...this.cartSubject.value];
    const existing = items.find((item) => item.product.id === product.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      items.push({ product, quantity: 1 });
    }
    this.updateCart(items);
  }

  increase(productId: string): void {
    if (!this.ownerAuthService.requireRegisteredUser()) {
      return;
    }
    const items = [...this.cartSubject.value];
    const item = items.find((entry) => entry.product.id === productId);
    if (!item) {
      return;
    }

    item.quantity += 1;
    this.updateCart(items);
  }

  decrease(productId: string): void {
    if (!this.ownerAuthService.requireRegisteredUser()) {
      return;
    }
    const items = [...this.cartSubject.value];
    const item = items.find((entry) => entry.product.id === productId);
    if (!item) {
      return;
    }

    if (item.quantity <= 1) {
      this.remove(productId);
      return;
    }

    item.quantity -= 1;
    this.updateCart(items);
  }

  remove(productId: string): void {
    if (!this.ownerAuthService.requireRegisteredUser()) {
      return;
    }
    this.updateCart(this.cartSubject.value.filter((item) => item.product.id !== productId));
  }

  clear(): void {
    if (!this.ownerAuthService.requireRegisteredUser()) {
      return;
    }
    this.updateCart([]);
  }

  getCount(): number {
    return this.cartSubject.value.reduce((sum, item) => sum + item.quantity, 0);
  }

  getSubtotal(): number {
    return this.cartSubject.value.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
  }

  getShippingCost(): number {
    const subtotal = this.getSubtotal();
    if (subtotal <= 0) {
      return 0;
    }
    return subtotal >= 50000 ? 0 : 350;
  }

  getTotal(): number {
    return this.getSubtotal() + this.getShippingCost();
  }

  private updateCart(items: CartItem[], syncRemote = true): void {
    this.cartSubject.next(items);
    localStorage.setItem(this.currentStorageKey, JSON.stringify(items));
    if (syncRemote) {
      this.syncCartToServer();
    }
  }

  private loadCartForActiveSession(): void {
    const currentUser = this.ownerAuthService.getCurrentUser();
    this.currentStorageKey = this.resolveStorageKey(currentUser?.username);
    const localItems = this.readCartFromStorage(this.currentStorageKey);
    this.updateCart(localItems, false);

    const token = this.ownerAuthService.getToken();
    if (!token || currentUser?.role !== 'customer') {
      return;
    }

    this.storeApiService.getUserCart(token).subscribe({
      next: (response) => {
        const serverItems = this.sanitizeCartItems(response.items);
        if (serverItems.length === 0 && localItems.length > 0) {
          this.syncCartToServer();
          return;
        }

        this.updateCart(serverItems, false);
      },
    });
  }

  private syncCartToServer(): void {
    const currentUser = this.ownerAuthService.getCurrentUser();
    const token = this.ownerAuthService.getToken();
    if (!token || currentUser?.role !== 'customer') {
      return;
    }

    this.storeApiService
      .updateUserCart(
        {
          items: this.cartSubject.value.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
        },
        token
      )
      .subscribe({
        error: () => undefined,
      });
  }

  private resolveStorageKey(username?: string): string {
    const normalizedUsername = String(username || '').trim().toLowerCase();
    if (!normalizedUsername) {
      return this.guestStorageKey;
    }
    return `el_sakka_cart_${normalizedUsername}`;
  }

  private readCartFromStorage(storageKey: string): CartItem[] {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as CartItem[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return this.sanitizeCartItems(parsed);
    } catch {
      return [];
    }
  }

  private sanitizeCartItems(items: CartItem[]): CartItem[] {
    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .filter(
        (item) =>
          Boolean(item?.product?.id) &&
          Number.isInteger(Number(item?.quantity)) &&
          Number(item.quantity) > 0
      )
      .map((item) => ({
        product: item.product,
        quantity: Number(item.quantity),
      }));
  }
}
