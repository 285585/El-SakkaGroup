import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Product } from '../models/store.models';

@Injectable({
  providedIn: 'root',
})
export class WishlistService {
  private readonly storageKey = 'el_sakka_wishlist_items';
  private readonly wishlistSubject = new BehaviorSubject<Product[]>(this.readFromStorage());
  readonly wishlist$ = this.wishlistSubject.asObservable();

  getItems(): Product[] {
    return this.wishlistSubject.value;
  }

  getCount(): number {
    return this.wishlistSubject.value.length;
  }

  has(productId: string): boolean {
    return this.wishlistSubject.value.some((item) => item.id === productId);
  }

  add(product: Product): void {
    if (this.has(product.id)) {
      return;
    }

    this.update([product, ...this.wishlistSubject.value]);
  }

  remove(productId: string): void {
    this.update(this.wishlistSubject.value.filter((item) => item.id !== productId));
  }

  toggle(product: Product): void {
    if (this.has(product.id)) {
      this.remove(product.id);
      return;
    }

    this.add(product);
  }

  private update(items: Product[]): void {
    this.wishlistSubject.next(items);
    localStorage.setItem(this.storageKey, JSON.stringify(items));
  }

  private readFromStorage(): Product[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as Product[];
      return Array.isArray(parsed) ? parsed.filter((item) => item?.id) : [];
    } catch {
      return [];
    }
  }
}
