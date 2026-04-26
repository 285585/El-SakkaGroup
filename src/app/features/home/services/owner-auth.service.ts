import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import {
  AuthLoginResponse,
  CompleteGoogleSignupResponse,
  AuthUser,
  RegisterUserResponse,
} from '../models/store.models';
import { StoreApiService } from './store-api.service';

@Injectable({
  providedIn: 'root',
})
export class OwnerAuthService {
  private readonly tokenKey = 'el_sakka_owner_token';
  private readonly userKey = 'el_sakka_user_info';
  private readonly userSubject = new BehaviorSubject<AuthUser | null>(this.getStoredUser());
  private readonly ownerModeSubject = new BehaviorSubject<boolean>(
    this.userSubject.value?.role === 'owner'
  );
  readonly ownerMode$ = this.ownerModeSubject.asObservable();
  readonly currentUser$ = this.userSubject.asObservable();
  readonly isAuthenticated$ = this.currentUser$.pipe(map((user) => Boolean(user)));

  constructor(
    private readonly storeApiService: StoreApiService,
    private readonly router: Router
  ) {}

  login(username: string, password: string): Observable<AuthLoginResponse> {
    return this.storeApiService.login({ username, password }).pipe(
      tap((response) => this.setSession(response))
    );
  }

  register(email: string, username: string, password: string): Observable<RegisterUserResponse> {
    return this.storeApiService.register({ email, username, password }).pipe(
      tap((response) => this.setSession(response))
    );
  }

  completeGoogleSignup(
    setupToken: string,
    username: string,
    password: string
  ): Observable<CompleteGoogleSignupResponse> {
    return this.storeApiService
      .completeGoogleSignup({ setupToken, username, password })
      .pipe(tap((response) => this.setSession(response)));
  }

  logout(redirectUrl = '/login'): void {
    this.clearToken();
    this.clearStoredUser();
    this.ownerModeSubject.next(false);
    this.userSubject.next(null);
    this.router.navigate([redirectUrl]);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isLoggedIn(): boolean {
    return Boolean(this.getToken());
  }

  isSessionValid(): Observable<boolean> {
    return this.storeApiServiceSync().pipe(map((user) => Boolean(user)));
  }

  isOwnerSessionValid(): Observable<boolean> {
    return this.storeApiServiceSync().pipe(map((user) => user?.role === 'owner'));
  }

  getCurrentUser(): AuthUser | null {
    return this.userSubject.value;
  }

  private storeApiServiceSync(): Observable<AuthUser | null> {
    const token = this.getToken();
    if (!token) {
      this.ownerModeSubject.next(false);
      this.userSubject.next(null);
      return of(null);
    }

    return this.storeApiService.verifySession(token).pipe(
      map((response) => {
        const sessionUser = response.user;
        this.ownerModeSubject.next(sessionUser.role === 'owner');
        this.userSubject.next(sessionUser);
        this.setStoredUser(sessionUser);
        return sessionUser;
      }),
      catchError(() => {
        this.clearToken();
        this.clearStoredUser();
        this.ownerModeSubject.next(false);
        this.userSubject.next(null);
        return of(null);
      })
    );
  }

  private setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  private clearToken(): void {
    localStorage.removeItem(this.tokenKey);
  }

  private setSession(response: AuthLoginResponse | RegisterUserResponse): void {
    this.setToken(response.token);
    this.setStoredUser(response.user);
    this.userSubject.next(response.user);
    this.ownerModeSubject.next(response.user.role === 'owner');
  }

  private getStoredUser(): AuthUser | null {
    const raw = localStorage.getItem(this.userKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as AuthUser;
      if (parsed?.username && parsed?.role) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  private setStoredUser(user: AuthUser): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  private clearStoredUser(): void {
    localStorage.removeItem(this.userKey);
  }
}
