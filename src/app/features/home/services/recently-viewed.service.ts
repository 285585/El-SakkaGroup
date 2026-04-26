import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Product } from '../models/store.models';

@Injectable({
  providedIn: 'root',
})
export class RecentlyViewedService {
  private readonly storageKey = 'el_sakka_recently_viewed';
  private readonly maxItems = 10;
  private readonly viewedSubject = new BehaviorSubject<Product[]>(this.readFromStorage());
  readonly viewed$ = this.viewedSubject.asObservable();

  add(product: Product): void {
    const next = [product, ...this.viewedSubject.value.filter((item) => item.id !== product.id)].slice(
      0,
      this.maxItems
    );
    this.viewedSubject.next(next);
    localStorage.setItem(this.storageKey, JSON.stringify(next));
  }

  getItems(): Product[] {
    return this.viewedSubject.value;
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
