import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CartItem, Product } from '../models/store.models';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly storageKey = 'el_sakka_cart_items';
  private readonly cartSubject = new BehaviorSubject<CartItem[]>(this.readCartFromStorage());
  readonly cart$ = this.cartSubject.asObservable();

  getItems(): CartItem[] {
    return this.cartSubject.value;
  }

  addProduct(product: Product): void {
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
    const items = [...this.cartSubject.value];
    const item = items.find((entry) => entry.product.id === productId);
    if (!item) {
      return;
    }

    item.quantity += 1;
    this.updateCart(items);
  }

  decrease(productId: string): void {
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
    this.updateCart(this.cartSubject.value.filter((item) => item.product.id !== productId));
  }

  clear(): void {
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

  private updateCart(items: CartItem[]): void {
    this.cartSubject.next(items);
    localStorage.setItem(this.storageKey, JSON.stringify(items));
  }

  private readCartFromStorage(): CartItem[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as CartItem[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((item) => item?.product?.id && item?.quantity > 0);
    } catch {
      return [];
    }
  }
}
