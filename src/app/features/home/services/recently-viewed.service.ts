import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Product } from '../models/store.models';
import { OwnerAuthService } from './owner-auth.service';

@Injectable({
  providedIn: 'root',
})
export class RecentlyViewedService {
  private readonly maxItems = 10;
  private readonly viewedSubject = new BehaviorSubject<Product[]>([]);
  readonly viewed$ = this.viewedSubject.asObservable();

  constructor(private readonly ownerAuthService: OwnerAuthService) {
    this.ownerAuthService.currentUser$.subscribe((user) => {
      if (!user) {
        this.viewedSubject.next([]);
        return;
      }
      this.viewedSubject.next(this.readForUsername(user.username));
    });
  }

  add(product: Product): void {
    if (!this.ownerAuthService.getToken() || !this.ownerAuthService.getCurrentUser()) {
      return;
    }
    const username = this.ownerAuthService.getCurrentUser()!.username;
    const key = this.storageKeyForUsername(username);
    const next = [product, ...this.viewedSubject.value.filter((item) => item.id !== product.id)].slice(
      0,
      this.maxItems
    );
    this.viewedSubject.next(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore quota
    }
  }

  getItems(): Product[] {
    return this.viewedSubject.value;
  }

  private storageKeyForUsername(username: string): string {
    return `el_sakka_recently_viewed_${String(username).trim().toLowerCase()}`;
  }

  private readForUsername(username: string): Product[] {
    return this.readFromStorageKey(this.storageKeyForUsername(username));
  }

  private readFromStorageKey(key: string): Product[] {
    const raw = localStorage.getItem(key);
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
