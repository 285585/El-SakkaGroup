import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { OwnerLoginResponse } from '../models/store.models';
import { StoreApiService } from './store-api.service';

@Injectable({
  providedIn: 'root',
})
export class OwnerAuthService {
  private readonly tokenKey = 'el_sakka_owner_token';
  private readonly ownerModeSubject = new BehaviorSubject<boolean>(Boolean(this.getToken()));
  readonly ownerMode$ = this.ownerModeSubject.asObservable();

  constructor(
    private readonly storeApiService: StoreApiService,
    private readonly router: Router
  ) {}

  login(username: string, password: string): Observable<OwnerLoginResponse> {
    return this.storeApiService.ownerLogin({ username, password }).pipe(
      tap((response) => {
        this.setToken(response.token);
        this.ownerModeSubject.next(true);
      })
    );
  }

  logout(): void {
    this.clearToken();
    this.ownerModeSubject.next(false);
    this.router.navigate(['/owner/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isLoggedIn(): boolean {
    return Boolean(this.getToken());
  }

  isSessionValid(): Observable<boolean> {
    const token = this.getToken();
    if (!token) {
      return of(false);
    }

    return this.storeApiService.verifyOwnerSession(token).pipe(
      map(() => {
        this.ownerModeSubject.next(true);
        return true;
      }),
      catchError(() => {
        this.clearToken();
        this.ownerModeSubject.next(false);
        return of(false);
      })
    );
  }

  private setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  private clearToken(): void {
    localStorage.removeItem(this.tokenKey);
  }
}
